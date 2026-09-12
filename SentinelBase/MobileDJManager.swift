import AVFoundation
import Combine
import Foundation

struct MobileDJTrack: Identifiable, Equatable {
    let id: String
    let url: URL
    var title: String {
        let name = url.deletingPathExtension().lastPathComponent
        return (name.components(separatedBy: " · ").last ?? name).replacingOccurrences(of: "_", with: " ")
    }
}

@MainActor
final class MobileDJManager: ObservableObject {
    @Published private(set) var tracks: [MobileDJTrack] = []
    @Published private(set) var deckATrackID: String?
    @Published private(set) var deckBTrackID: String?
    @Published private(set) var isPlayingA = false
    @Published private(set) var isPlayingB = false
    @Published private(set) var progressA = 0.0
    @Published private(set) var progressB = 0.0
    @Published var crossfade = 0.0 { didSet { updateVolumes() } }
    @Published var autoMix = false
    @Published private(set) var status = "Import MP3, M4A, AAC or WAV tracks to prepare the decks."

    private var playerA: AVAudioPlayer?
    private var playerB: AVAudioPlayer?
    private var timer: Timer?
    private var fadeStartedAt: Date?
    private var fadeFrom = 0.0
    private var fadeTo = 0.0
    private var nextTrackIndex = 0
    private let fadeDuration = 8.0
    private let allowedExtensions: Set<String> = ["mp3", "m4a", "aac", "wav"]

    init() {
        reloadTracks()
        timer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }

    private var musicDirectory: URL? {
        guard let support = try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true) else { return nil }
        return support.appendingPathComponent("Sentinel/DJ", isDirectory: true)
    }

    private func reloadTracks() {
        guard let directory = musicDirectory else { return }
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        tracks = files.filter { allowedExtensions.contains($0.pathExtension.lowercased()) }.sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }.map { MobileDJTrack(id: $0.lastPathComponent, url: $0) }
    }

    func importTracks(_ urls: [URL]) {
        guard let directory = musicDirectory else { status = "Local music storage is unavailable."; return }
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var imported = 0
        for source in urls {
            guard allowedExtensions.contains(source.pathExtension.lowercased()) else { continue }
            let scoped = source.startAccessingSecurityScopedResource()
            defer { if scoped { source.stopAccessingSecurityScopedResource() } }
            let destination = directory.appendingPathComponent("\(UUID().uuidString.prefix(8)) · \(source.lastPathComponent)")
            do { try FileManager.default.copyItem(at: source, to: destination); imported += 1 }
            catch { status = "Could not import \(source.lastPathComponent): \(error.localizedDescription)" }
        }
        reloadTracks()
        if imported > 0 { status = "\(imported) track\(imported == 1 ? "" : "s") imported. Load a track onto each deck." }
        else if !urls.isEmpty { status = "No supported tracks were imported. Choose MP3, M4A, AAC or WAV files." }
    }

    func title(for deck: String) -> String {
        let id = deck == "A" ? deckATrackID : deckBTrackID
        return tracks.first(where: { $0.id == id })?.title ?? "No track loaded"
    }

    func load(_ track: MobileDJTrack, onto deck: String) {
        do {
            let player = try AVAudioPlayer(contentsOf: track.url)
            player.prepareToPlay()
            if deck == "A" {
                playerA?.stop(); playerA = player; deckATrackID = track.id; isPlayingA = false; progressA = 0
            } else {
                playerB?.stop(); playerB = player; deckBTrackID = track.id; isPlayingB = false; progressB = 0
            }
            updateVolumes()
            status = "\(track.title) loaded on Deck \(deck)."
        } catch { status = "That audio file could not be decoded on iPhone: \(error.localizedDescription)" }
    }

    func playPause(_ deck: String) {
        guard let player = deck == "A" ? playerA : playerB else { status = "Load a track onto Deck \(deck) first."; return }
        if player.isPlaying { player.pause() }
        else {
            do { try AVAudioSession.sharedInstance().setCategory(.playback); try AVAudioSession.sharedInstance().setActive(true); player.play() }
            catch { status = "Audio playback could not start: \(error.localizedDescription)" }
        }
        isPlayingA = playerA?.isPlaying ?? false
        isPlayingB = playerB?.isPlaying ?? false
    }

    func stopAll() {
        playerA?.stop(); playerB?.stop()
        playerA?.currentTime = 0; playerB?.currentTime = 0
        isPlayingA = false; isPlayingB = false; progressA = 0; progressB = 0
        fadeStartedAt = nil
        status = "Both decks stopped."
    }

    func mixNext() {
        guard !tracks.isEmpty else { status = "Import tracks before mixing."; return }
        guard fadeStartedAt == nil else { return }
        let outgoing = crossfade <= 0.5 ? "A" : "B"
        let incoming = outgoing == "A" ? "B" : "A"
        let currentID = outgoing == "A" ? deckATrackID : deckBTrackID
        if (incoming == "A" ? deckATrackID : deckBTrackID) == nil || (incoming == "A" ? deckATrackID : deckBTrackID) == currentID {
            let currentIndex = tracks.firstIndex(where: { $0.id == currentID })
            let selectedIndex = currentIndex.map { ($0 + 1) % tracks.count } ?? nextTrackIndex % tracks.count
            let next = tracks[selectedIndex]
            nextTrackIndex = selectedIndex + 1
            load(next, onto: incoming)
        }
        guard (incoming == "A" ? playerA : playerB) != nil else { return }
        if !(outgoing == "A" ? (playerA?.isPlaying ?? false) : (playerB?.isPlaying ?? false)) { playPause(outgoing) }
        if !(incoming == "A" ? (playerA?.isPlaying ?? false) : (playerB?.isPlaying ?? false)) { playPause(incoming) }
        fadeFrom = crossfade
        fadeTo = incoming == "A" ? 0 : 1
        fadeStartedAt = .now
        status = "Mixing into Deck \(incoming)."
    }

    private func updateVolumes() {
        let position = max(0, min(1, crossfade))
        playerA?.volume = Float(cos(position * .pi / 2))
        playerB?.volume = Float(sin(position * .pi / 2))
    }

    private func tick() {
        progressA = playerA.map { $0.duration > 0 ? min(1, $0.currentTime / $0.duration) : 0 } ?? 0
        progressB = playerB.map { $0.duration > 0 ? min(1, $0.currentTime / $0.duration) : 0 } ?? 0
        isPlayingA = playerA?.isPlaying ?? false
        isPlayingB = playerB?.isPlaying ?? false
        if let started = fadeStartedAt {
            let amount = min(1, Date().timeIntervalSince(started) / fadeDuration)
            crossfade = fadeFrom + (fadeTo - fadeFrom) * amount
            if amount >= 1 {
                fadeStartedAt = nil
                if fadeTo == 0 { playerB?.stop(); playerB = nil; deckBTrackID = nil; isPlayingB = false; progressB = 0 }
                else { playerA?.stop(); playerA = nil; deckATrackID = nil; isPlayingA = false; progressA = 0 }
                status = "Mix complete. Deck \(fadeTo == 0 ? "A" : "B") is on air."
            }
        } else if autoMix && !tracks.isEmpty {
            let active = crossfade <= 0.5 ? playerA : playerB
            if let active, active.isPlaying, active.duration - active.currentTime <= 12 { mixNext() }
        }
    }
}
