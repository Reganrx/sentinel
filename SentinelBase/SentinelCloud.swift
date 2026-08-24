import Foundation
import UIKit

@MainActor
struct SentinelCloud {
    private let endpoint = URL(string: "https://sentinel-relay.reganbelson.workers.dev")!
    static let relayBaseURL = "https://sentinel-relay.reganbelson.workers.dev"

    func registerInstallation() async -> Bool {
        var request = URLRequest(url: endpoint.appending(path: "v1/installations/register"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let identifier = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "installationId": identifier,
            "platform": "ios",
            "appVersion": version,
            "contentVersion": UserDefaults.standard.string(forKey: "sentinelContentVersion") ?? "none",
            "updateChannel": "stable",
            "deviceName": UIDevice.current.name,
        ])
        guard let (_, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200 else { return false }
        return true
    }

    func latestRelease() async throws -> SentinelRelease? {
        var components = URLComponents(url: endpoint.appending(path: "v1/releases/latest"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "platform", value: "ios")]
        let (data, response) = try await URLSession.shared.data(from: components.url!)
        if (response as? HTTPURLResponse)?.statusCode == 404 { return nil }
        return try JSONDecoder().decode(SentinelRelease.self, from: data)
    }

    func applyContentUpdate(_ release: SentinelRelease) throws {
        let defaults = UserDefaults.standard
        defaults.set(release.version, forKey: "sentinelContentVersion")
        let content = release.mobileContent ?? SentinelMobileContent()
        defaults.set(try JSONEncoder().encode(content), forKey: "sentinelMobileContent")
        defaults.set(content.companionProtocolVersion ?? "", forKey: "sentinelCompanionProtocolVersion")
        defaults.set(content.companionTransport ?? "", forKey: "sentinelCompanionTransport")
        defaults.set(content.serviceAccessMode ?? "", forKey: "sentinelServiceAccessMode")
        let requestedBytes = max(0, content.cloudFileLimit ?? 65) * 1_024 * 1_024
        defaults.set(min(requestedBytes, 65 * 1_024 * 1_024), forKey: "sentinelCloudFileLimit")
        defaults.set(false, forKey: "sentinelSharesApiKeys")
        defaults.set(Date(), forKey: "sentinelContentInstalledAt")
    }

    func pairCompanion(code: String) async throws -> Bool {
        var request = URLRequest(url: endpoint.appending(path: "companion/pair"))
        request.httpMethod = "POST"; request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["code": code, "name": UIDevice.current.name, "platform": "ios"])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200,
              let value = try JSONSerialization.jsonObject(with: data) as? [String: Any], let token = value["token"] as? String else { return false }
        try KeychainStore.set(token, for: "cloudToken")
        if let independent = value["independentAccessAvailable"] as? Bool { UserDefaults.standard.set(independent, forKey: "sentinelIndependentAccessAvailable") }
        if let services = value["availableServices"] as? [String] { UserDefaults.standard.set(services, forKey: "sentinelAvailableMobileServices") }
        if let permissionVersion = value["permissionVersion"] as? Int { UserDefaults.standard.set(permissionVersion, forKey: "sentinelMobilePermissionVersion") }
        if let local = value["local"] as? [String: Any] {
            if let endpoint = local["endpoint"] as? String { try KeychainStore.set(endpoint, for: "localEndpoint") }
            if let localToken = local["token"] as? String { try KeychainStore.set(localToken, for: "localToken") }
        } else {
            KeychainStore.remove("localEndpoint")
            KeychainStore.remove("localToken")
        }
        // Remove values written by previous app builds after their secure migration.
        ["sentinelCompanionCloudToken", "sentinelCompanionLocalEndpoint", "sentinelCompanionLocalToken"].forEach(UserDefaults.standard.removeObject(forKey:))
        return true
    }

    func enrolMobileAccess(services: [String], permissionVersion: Int) async throws -> MobileAccessEnrollment {
        guard let token = KeychainStore.string(for: "cloudToken") else { throw URLError(.userAuthenticationRequired) }
        var request = URLRequest(url: endpoint.appending(path: "companion/mobile-access/enrol"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(MobileAccessRequest(requestedServices: services, permissionVersion: permissionVersion))
        let (data, response) = try await URLSession.shared.data(for: request)
        guard isSuccess(response) else { throw URLError(.badServerResponse) }
        let enrollment = try JSONDecoder().decode(MobileAccessEnrollment.self, from: data)
        guard enrollment.enabled else { throw URLError(.userAuthenticationRequired) }
        try KeychainStore.set(enrollment.accessToken, for: "mobileServiceAccessToken")
        return enrollment
    }

    func companionRequest(path: String, method: String = "GET", body: Data? = nil) async throws -> Data {
        if let data = try? await localCompanionRequest(path: path, method: method, body: body) { return data }
        return try await cloudCompanionRequest(path: path, method: method, body: body)
    }

    private func cloudCompanionRequest(path: String, method: String, body: Data?) async throws -> Data {
        guard let token = KeychainStore.string(for: "cloudToken") else { throw URLError(.userAuthenticationRequired) }
        var cloud = URLRequest(url: endpoint.appending(path: "companion/sync" + path)); cloud.httpMethod = method; cloud.httpBody = body
        cloud.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization"); cloud.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await URLSession.shared.data(for: cloud)
        guard isSuccess(response) else { throw URLError(.badServerResponse) }
        return data
    }

    private func localCompanionRequest(path: String, method: String, body: Data?) async throws -> Data {
        guard let base = KeychainStore.string(for: "localEndpoint"),
              let token = KeychainStore.string(for: "localToken"),
              let url = companionURL(base: base, path: path) else { throw URLError(.cannotConnectToHost) }
        var request = URLRequest(url: url)
        request.httpMethod = method; request.httpBody = body; request.timeoutInterval = 2
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard isSuccess(response) else { throw URLError(.badServerResponse) }
        return data
    }

    func reconnectCompanion() async -> CompanionConnection? {
        guard KeychainStore.string(for: "cloudToken") != nil else { return nil }
        if (try? await localCompanionRequest(path: "/status", method: "GET", body: nil)) != nil { return .localNetwork }
        if (try? await cloudCompanionRequest(path: "/status", method: "GET", body: nil)) != nil { return .cloudflare }
        return nil
    }

    func sendAssistantMessage(messages: [SentinelChatMessage], allowCloudFallback: Bool, conversationID: UUID, context: MobileChatContext, attachments: [SentinelChatAttachment] = []) async throws -> AssistantChatDelivery {
        let prompt = AssistantChatRequest.combinedPrompt(from: messages)

        // The legacy local bridge accepts only a flat prompt. When iPhone location
        // is available, prefer the structured Cloudflare route so it cannot lose
        // the authoritative coordinate and guess a country from stale desktop data.
        if context.location == nil {
            let localBody = try JSONEncoder().encode(AssistantChatRequest(prompt: prompt))
            if let data = try? await localCompanionRequest(path: "/chat", method: "POST", body: localBody),
               let delivery = AssistantChatResponse.delivery(from: data) {
                return delivery
            }
        }

        guard allowCloudFallback,
              let token = KeychainStore.string(for: "mobileServiceAccessToken") else {
            throw AssistantChatError.cloudPermissionRequired
        }

        let structuredBody = try JSONEncoder().encode(MobileChatRequest(conversationID: conversationID.uuidString, messages: messages.suffix(20).map { .init(role: $0.apiRole, content: $0.text) }.filter { !$0.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }, context: context, attachments: attachments.map { .init(name: $0.name, mimeType: $0.mimeType, data: $0.data) }))
        do {
            let data = try await mobileServiceRequest(
                path: "/mobile/services/chat",
                body: structuredBody,
                token: token
            )
            guard let delivery = AssistantChatResponse.delivery(from: data) else {
                throw AssistantChatError.invalidResponse
            }
            return delivery
        } catch {
            // Retain a useful local fallback during a temporary cloud outage. The
            // plain bridge receives a concise, explicit location line instead of
            // silently using its own desktop location.
            if let location = context.location {
                let contextualPrompt = "Current iPhone location (authoritative): \(location.latitude),\(location.longitude). Use this location for local questions.\n\n\(prompt)"
                let localBody = try JSONEncoder().encode(AssistantChatRequest(prompt: contextualPrompt))
                if let localData = try? await localCompanionRequest(path: "/chat", method: "POST", body: localBody),
                   let delivery = AssistantChatResponse.delivery(from: localData) {
                    return delivery
                }
            }
            throw error
        }
    }

    private func mobileServiceRequest(path: String, body: Data, token: String) async throws -> Data {
        var request = URLRequest(url: endpoint.appending(path: path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))))
        request.httpMethod = "POST"; request.httpBody = body; request.timeoutInterval = 20
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard isSuccess(response) else { throw MobileServiceError.from(response: response, data: data) }
        return data
    }

    func mobileService(path: String, queryItems: [URLQueryItem] = []) async throws -> Data {
        try await mobileServiceResponse(path: path, queryItems: queryItems).data
    }

    /// Sends a token-authenticated command to a Sentinel mobile-service endpoint.
    /// Credentials remain in Keychain; callers receive only the Worker response.
    func postMobileService<Body: Encodable>(path: String, body: Body) async throws -> Data {
        guard let token = KeychainStore.string(for: "mobileServiceAccessToken") else {
            throw MobileServiceError.permissionRequired
        }
        let data = try JSONEncoder().encode(body)
        return try await mobileServiceRequest(path: path, body: data, token: token)
    }

    func mobileServiceResponse(path: String, queryItems: [URLQueryItem] = []) async throws -> (data: Data, statusCode: Int) {
        guard let token = KeychainStore.string(for: "mobileServiceAccessToken") else { throw MobileServiceError.permissionRequired }
        var components = URLComponents(url: endpoint.appending(path: path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))), resolvingAgainstBaseURL: false)!
        components.queryItems = queryItems
        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"; request.timeoutInterval = 20
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: request)
        let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard isSuccess(response) else { throw MobileServiceError.from(response: response, data: data) }
        return (data, statusCode)
    }

    private func companionURL(base: String, path: String) -> URL? {
        URL(string: base.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/" + path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
    }

    private func isSuccess(_ response: URLResponse) -> Bool {
        guard let status = (response as? HTTPURLResponse)?.statusCode else { return false }
        return (200..<300).contains(status)
    }

    func sendClipboard(_ text: String) async throws {
        let body = try JSONEncoder().encode(["text": text])
        _ = try await companionRequest(path: "/clipboard", method: "POST", body: body)
    }

    func fetchClipboard() async throws -> Data { try await companionRequest(path: "/clipboard") }
    func listFiles() async throws -> Data { try await companionRequest(path: "/files") }
    func deleteFile(id: String) async throws { _ = try await companionRequest(path: "/files/\(id)", method: "DELETE") }

    func transfer(data: Data, filename: String) async throws -> TransferRoute {
        let megabyte = 1_024 * 1_024
        if data.count <= 100 * megabyte,
           KeychainStore.string(for: "localEndpoint") != nil,
           KeychainStore.string(for: "localToken") != nil {
            let body = try JSONEncoder().encode(["filename": filename, "content": data.base64EncodedString()])
            if (try? await localCompanionRequest(path: "/files", method: "POST", body: body)) != nil { return .localNetwork }
        }
        let configuredCloudLimit = UserDefaults.standard.integer(forKey: "sentinelCloudFileLimit")
        let cloudLimit = configuredCloudLimit > 0 ? min(configuredCloudLimit, 65 * megabyte) : 65 * megabyte
        guard data.count <= cloudLimit else { throw TransferError.tooLargeForCloud }
        guard KeychainStore.string(for: "cloudToken") != nil else { throw TransferError.noAvailableRoute }
        let body = try JSONEncoder().encode(["filename": filename, "content": data.base64EncodedString()])
        _ = try await companionRequest(path: "/files", method: "POST", body: body)
        return .cloudflare
    }
}

private struct MobileAccessRequest: Encodable { let requestedServices: [String]; let permissionVersion: Int }
struct MobileAccessEnrollment: Decodable { let enabled: Bool; let services: [String]; let accessToken: String; let expiresAt: String? }

enum CompanionConnection: Equatable { case localNetwork, cloudflare }

private struct AssistantChatRequest: Encodable {
    let prompt: String
    static func combinedPrompt(from messages: [SentinelChatMessage]) -> String {
        messages.suffix(16).map { message in
            "\(message.apiRole == "assistant" ? "Sentinel" : "User"): \(message.text)"
        }.joined(separator: "\n\n")
    }
}
private enum AssistantChatError: LocalizedError { case cloudPermissionRequired, invalidResponse; var errorDescription: String? { switch self { case .cloudPermissionRequired: "AI Chat permission is required for the Cloudflare route."; case .invalidResponse: "Sentinel received a chat response without assistant text." } } }
private struct AssistantChatResponse: Decodable {
    struct Output: Decodable { struct Content: Decodable { let text: String? }; let content: [Content]? }
    struct Message: Decodable { let content: String? }
    let message: Message?
    let replyText: String?
    let outputText: String?
    let output: [Output]?
    let title: String?
    let summary: String?
    let verifiedAt: String?
    let actions: [SentinelChatAction]?
    let cards: [SentinelChatCard]?
    enum CodingKeys: String, CodingKey { case message, replyText = "reply", outputText = "output_text", output, title, summary, verifiedAt = "verifiedAt", actions, cards }
    static func delivery(from data: Data) -> AssistantChatDelivery? {
        guard let response = try? JSONDecoder().decode(Self.self, from: data) else { return nil }
        let outputText = (response.output ?? []).flatMap { output in (output.content ?? []).compactMap { $0.text } }
        let candidates = [response.message?.content, response.outputText, response.replyText].compactMap { $0 } + outputText
        guard let reply = candidates.map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) }).first(where: { !$0.isEmpty }) else { return nil }
        return AssistantChatDelivery(reply: reply, title: response.title, summary: response.summary, actions: response.actions ?? [], cards: response.cards ?? [], verifiedAt: response.verifiedAt)
    }
}
struct AssistantChatDelivery { let reply: String; let title: String?; let summary: String?; let actions: [SentinelChatAction]; let cards: [SentinelChatCard]; let verifiedAt: String? }
struct MobileChatLocation: Encodable { let latitude: Double; let longitude: Double }
struct MobileChatContext: Encodable { let platform: String; let appVersion: String; let contentVersion: String; let currentPage: String; let enabledServices: [String]; let companionOnline: Bool; let weatherSummary: String?; let weatherLocation: String?; let selectedDestination: String?; let selectedFlight: String?; let localTime: String; let locale: String; let capabilities: [String]; let location: MobileChatLocation? }
private struct MobileChatRequest: Encodable { struct Message: Encodable { let role: String; let content: String }; struct Attachment: Encodable { let name: String; let mimeType: String; let data: String }; let conversationID: String; let messages: [Message]; let context: MobileChatContext; let attachments: [Attachment]; enum CodingKeys: String, CodingKey { case conversationID = "conversationId", messages, context, attachments } }
private struct WorkerServiceError: LocalizedError {
    let detail: String
    var errorDescription: String? { detail }
    static func message(from data: Data) -> WorkerServiceError {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return .init(detail: "The Sentinel service rejected the chat request.") }
        if let error = object["error"] as? String, !error.isEmpty { return .init(detail: error) }
        if let error = object["error"] as? [String: Any], let message = error["message"] as? String, !message.isEmpty { return .init(detail: message) }
        return .init(detail: "The Sentinel service rejected the chat request.")
    }
}

enum MobileServiceError: LocalizedError {
    case permissionRequired, accessExpired, notPermitted, endpointMissing, credentialsMissing, rateLimited, providerUnavailable, message(String), response(Int, String)
    var errorDescription: String? {
        switch self {
        case .permissionRequired: "This service has not been enabled for this iPhone. Enable it in Sentinel Personal → Settings → Companion Sync → Mobile Service Access."
        case .accessExpired: "Mobile access has expired. Reconnect or refresh Mobile Service Access."
        case .notPermitted: "This service is not permitted for this iPhone."
        case .endpointMissing: "The deployed Worker does not contain the radar endpoint."
        case .credentialsMissing: "The service credentials are no longer configured in Sentinel Personal."
        case .rateLimited: "Rate limit reached. Please wait and try again."
        case .providerUnavailable: "The upstream provider is temporarily unavailable."
        case .message(let message): message
        case .response(_, let message): message
        }
    }
    var httpStatus: Int? { switch self { case .accessExpired: 401; case .notPermitted: 403; case .endpointMissing: 404; case .credentialsMissing: 409; case .rateLimited: 429; case .providerUnavailable: 502; case .response(let status, _): status; default: nil } }
    static func from(response: URLResponse, data: Data) -> MobileServiceError {
        let status = (response as? HTTPURLResponse)?.statusCode
        let workerError = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
        if let workerError, !workerError.isEmpty { return .response(status ?? 0, workerError) }
        switch status {
        case 401: return .accessExpired
        case 403: return .notPermitted
        case 404: return .endpointMissing
        case 409: return .credentialsMissing
        case 429: return .rateLimited
        case 502: return .providerUnavailable
        default: return .response(status ?? 0, "The Sentinel mobile service could not complete this request.")
        }
    }
}
