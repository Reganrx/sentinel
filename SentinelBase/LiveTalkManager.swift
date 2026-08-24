import Foundation
import AVFoundation
@preconcurrency import WebRTC
import UIKit

@MainActor
final class LiveTalkManager: NSObject, ObservableObject {
    enum State: String { case idle, connecting, listening, thinking, speaking, muted, failed, ended }
    @Published private(set) var state: State = .idle
    @Published private(set) var status = "Ready"
    @Published private(set) var transcript: [String] = []
    @Published var isPanelPresented = false
    var onVerifiedTool: ((String, [String: Any]) -> Void)?
    private var peer: RTCPeerConnection?
    private var channel: RTCDataChannel?
    private var microphoneTrack: RTCAudioTrack?
    private var assistantAudioTrack: RTCAudioTrack?
    private var sessionID: String?
    private var ephemeralToken: String?
    private var offerURL: URL?
    private let factory = RTCPeerConnectionFactory()
    private let peerDelegate = PeerDelegate()
    private var eventDelegate: EventDelegate?
    private var backgroundObserver: NSObjectProtocol?
    private var mutedBeforeBackground = false

    var isActive: Bool { [.connecting, .listening, .thinking, .speaking, .muted].contains(state) }

    override init() {
        super.init()
        peerDelegate.owner = self
        eventDelegate = EventDelegate(owner: self)
        backgroundObserver = NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in Task { @MainActor in self?.suspendForBackground() } }
    }

    deinit { if let backgroundObserver { NotificationCenter.default.removeObserver(backgroundObserver) } }

    func begin(conversationId: UUID, enabledServices: [String]) async {
        guard !isActive else { return }
        guard let token = KeychainStore.string(for: "mobileServiceAccessToken") else { state = .failed; status = "Mobile access has expired."; return }
        state = .connecting; status = "Creating secure live session…"
        do {
            let url = URL(string: "https://sentinel-relay.reganbelson.workers.dev/mobile/services/live-chat/session")!
            var request = URLRequest(url: url); request.httpMethod = "POST"; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization"); request.setValue("application/json", forHTTPHeaderField: "Content-Type"); request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.httpBody = try JSONSerialization.data(withJSONObject: ["platform":"ios", "conversationId":conversationId.uuidString, "locale":"en-GB", "voice":"cedar", "enabledServices":enabledServices])
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { state = .failed; status = "Live session could not be started."; return }
            let session = try JSONDecoder().decode(Session.self, from: data)
            guard session.transport == "webrtc", session.webrtcOfferUrl.hasPrefix("https://"), !session.ephemeralToken.isEmpty else { state = .failed; status = "Invalid live-session response."; return }
            sessionID = session.sessionId
            ephemeralToken = session.ephemeralToken; offerURL = URL(string: session.webrtcOfferUrl); try await preparePeerConnection(); status = "Listening"; state = .listening
        } catch { state = .failed; status = "Live session is unavailable." }
    }

    func end() { channel?.close(); peer?.close(); channel = nil; peer = nil; microphoneTrack = nil; assistantAudioTrack = nil; ephemeralToken = nil; sessionID = nil; try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation); state = .ended; status = "Conversation ended" }
    func open(conversationId: UUID, enabledServices: [String]) { isPanelPresented = true; guard !isActive else { return }; Task { await begin(conversationId: conversationId, enabledServices: enabledServices) } }
    func minimise() { isPanelPresented = false }
    func suspendForBackground() { guard isActive else { return }; mutedBeforeBackground = microphoneTrack?.isEnabled ?? false; microphoneTrack?.isEnabled = false; status = "Paused while Sentinel is in the background" }
    func resumeAfterForeground() { guard isActive else { return }; if mutedBeforeBackground { microphoneTrack?.isEnabled = true; mutedBeforeBackground = false; state = .listening; status = "Listening" } }
    func toggleMute() { guard let microphoneTrack else { return }; microphoneTrack.isEnabled = !microphoneTrack.isEnabled; state = microphoneTrack.isEnabled ? .listening : .muted; status = microphoneTrack.isEnabled ? "Listening" : "Muted" }
    func interrupt() { sendEvent(["type": "response.cancel"]); state = .listening; status = "Interrupted" }
    private func sendEvent(_ event: [String: Any]) { guard let data = try? JSONSerialization.data(withJSONObject: event) else { return }; _ = channel?.sendData(RTCDataBuffer(data: data, isBinary: false)) }

    private func preparePeerConnection() async throws {
        configureHandsFreeAudio()
        let configuration = RTCConfiguration()
        let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
        guard let connection = factory.peerConnection(with: configuration, constraints: constraints, delegate: peerDelegate) else { throw URLError(.cannotCreateFile) }
        let source = factory.audioSource(with: constraints)
        let track = factory.audioTrack(with: source, trackId: "sentinel-mic")
        microphoneTrack = track
        _ = connection.add(track, streamIds: ["sentinel"])
        let eventChannel = connection.dataChannel(forLabel: "oai-events", configuration: RTCDataChannelConfiguration())
        eventChannel?.delegate = eventDelegate
        channel = eventChannel
        peer = connection
        let offer = try await offer(for: connection, constraints: constraints)
        try await negotiate(offer: offer, connection: connection)
        // WebRTC activates its audio unit after the SDP answer; reapply the explicit
        // hands-free route through its coordinated audio session at that point.
        configureHandsFreeAudio()
    }

    private func configureHandsFreeAudio() {
        let options: AVAudioSession.CategoryOptions = [.defaultToSpeaker, .allowBluetoothHFP, .allowBluetoothA2DP]
        let rtcAudio = RTCAudioSession.sharedInstance()
        rtcAudio.lockForConfiguration()
        defer { rtcAudio.unlockForConfiguration() }
        try? rtcAudio.setCategory(.playAndRecord, mode: .voiceChat, options: options)
        try? rtcAudio.setActive(true)
        try? rtcAudio.overrideOutputAudioPort(.speaker)
    }

    private func offer(for connection: RTCPeerConnection, constraints: RTCMediaConstraints) async throws -> RTCSessionDescription {
        try await withCheckedThrowingContinuation { continuation in connection.offer(for: constraints) { offer, error in if let error { continuation.resume(throwing: error) } else if let offer { connection.setLocalDescription(offer) { error in if let error { continuation.resume(throwing: error) } else { continuation.resume(returning: offer) } } } else { continuation.resume(throwing: URLError(.badServerResponse)) } } }
    }

    private func negotiate(offer: RTCSessionDescription, connection: RTCPeerConnection) async throws {
        guard let offerURL, let ephemeralToken else { throw URLError(.userAuthenticationRequired) }
        let boundary = "SentinelRealtimeBoundary"
        var body = Data()
        func field(_ name: String, _ value: String, _ contentType: String) { body.append("--\(boundary)\r\n".data(using: .utf8)!); body.append("Content-Disposition: form-data; name=\"\(name)\"\r\nContent-Type: \(contentType)\r\n\r\n".data(using: .utf8)!); body.append(value.data(using: .utf8)!); body.append("\r\n".data(using: .utf8)!) }
        field("sdp", offer.sdp, "application/sdp")
        field("session", "{\"type\":\"realtime\",\"model\":\"gpt-realtime\"}", "application/json")
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        var request = URLRequest(url: offerURL); request.httpMethod = "POST"; request.httpBody = body; request.setValue("Bearer \(ephemeralToken)", forHTTPHeaderField: "Authorization"); request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode), let sdp = String(data: data, encoding: .utf8), !sdp.isEmpty else { throw URLError(.badServerResponse) }
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in connection.setRemoteDescription(RTCSessionDescription(type: .answer, sdp: sdp)) { error in if let error { continuation.resume(throwing: error) } else { continuation.resume(returning: ()) } } }
    }

    private struct Session: Decodable { let sessionId: String; let transport: String; let webrtcOfferUrl: String; let ephemeralToken: String; enum CodingKeys: String, CodingKey { case sessionId, transport, webrtcOfferUrl, ephemeralToken } }

    private func handleRealtimeEvent(_ object: [String: Any]) {
        guard let type = object["type"] as? String else { return }
        if type == "input_audio_buffer.speech_stopped" { state = .thinking; status = "Thinking…" }
        else if type == "response.output_audio_transcript.delta" {
            state = .speaking; status = "Speaking…"
            if let delta = object["delta"] as? String { appendAssistantTranscript(delta) }
        } else if type == "conversation.item.input_audio_transcription.completed", let text = object["transcript"] as? String, !text.isEmpty {
            transcript.append("You: \(text)")
        } else if type == "response.function_call_arguments.done" {
            Task { await runVerifiedTool(from: object) }
        } else if type == "response.done" { state = .listening; status = "Listening" }
        else if type == "error" { state = .failed; status = "Live service reported an error. Reconnect to continue." }
    }

    private func appendAssistantTranscript(_ delta: String) {
        if let index = transcript.indices.last, transcript[index].hasPrefix("Sentinel: ") {
            transcript[index] += delta
        } else {
            transcript.append("Sentinel: \(delta)")
        }
    }

    private func runVerifiedTool(from event: [String: Any]) async {
        guard let callID = event["call_id"] as? String,
              let name = event["name"] as? String, name == "use_sentinel",
              let rawArguments = event["arguments"] as? String,
              let argumentsData = rawArguments.data(using: .utf8),
              let arguments = try? JSONSerialization.jsonObject(with: argumentsData) as? [String: Any],
              let service = arguments["service"] as? String,
              ["weather", "navigation", "aviation"].contains(service),
              let query = arguments["query"] as? String,
              let sessionID,
              let token = KeychainStore.string(for: "mobileServiceAccessToken") else { return }

        status = "Checking \(service)…"
        do {
            let url = URL(string: "https://sentinel-relay.reganbelson.workers.dev/mobile/services/live-chat/tool")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.httpBody = try JSONSerialization.data(withJSONObject: ["sessionId": sessionID, "service": service, "query": query])
            let (data, response) = try await URLSession.shared.data(for: request)
            let output: String
            if let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
               let result = try? JSONSerialization.jsonObject(with: data) as? [String: Any], result["ok"] as? Bool == true {
                output = String(data: data, encoding: .utf8) ?? "{\"ok\":true}"
                status = "\(service.capitalized) verified"
                if let resultPayload = result["result"] as? [String: Any] {
                    onVerifiedTool?(service, resultPayload)
                }
            } else {
                let workerError = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
                output = "{\"ok\":false,\"error\":\"\(workerError ?? "The service is unavailable.")\"}"
                status = workerError ?? "The \(service) service is unavailable."
            }
            sendEvent(["type": "conversation.item.create", "item": ["type": "function_call_output", "call_id": callID, "output": output]])
            sendEvent(["type": "response.create"])
        } catch {
            sendEvent(["type": "conversation.item.create", "item": ["type": "function_call_output", "call_id": callID, "output": "{\"ok\":false,\"error\":\"The service is unavailable.\"}"]])
            sendEvent(["type": "response.create"])
            status = "The \(service) service is unavailable."
        }
    }

    private func receivedAssistantAudio(_ track: RTCAudioTrack) {
        assistantAudioTrack = track
        track.isEnabled = true
    }

    private final class PeerDelegate: NSObject, RTCPeerConnectionDelegate {
        weak var owner: LiveTalkManager?

        func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}
        func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {
            guard let track = stream.audioTracks.first else { return }
            Task { @MainActor in self.owner?.receivedAssistantAudio(track) }
        }
        func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
        func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
        func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {}
        func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}
        func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {}
        func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
        func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
        func peerConnection(_ peerConnection: RTCPeerConnection, didChange state: RTCPeerConnectionState) {
            guard state == .failed || state == .disconnected else { return }
            Task { @MainActor in
                self.owner?.state = .failed
                self.owner?.status = "Live connection interrupted. Reconnect to continue."
            }
        }
    }

    private final class EventDelegate: NSObject, RTCDataChannelDelegate {
        weak var owner: LiveTalkManager?
        init(owner: LiveTalkManager) { self.owner = owner }
        func dataChannelDidChangeState(_ dataChannel: RTCDataChannel) {}
        func dataChannel(_ dataChannel: RTCDataChannel, didReceiveMessageWith buffer: RTCDataBuffer) {
            guard let object = try? JSONSerialization.jsonObject(with: buffer.data) as? [String: Any], object["type"] as? String != nil else { return }
            Task { @MainActor in
                guard let owner = self.owner else { return }
                owner.handleRealtimeEvent(object)
            }
        }
    }
}
