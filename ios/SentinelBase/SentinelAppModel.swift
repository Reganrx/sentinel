import Foundation
import UIKit

@MainActor
final class SentinelAppModel: ObservableObject {
    @Published var selected: SentinelPage = .home
    @Published var cloudOnline = false
    @Published var update: SentinelRelease?
    @Published var pairingCode = ""
    @Published var pairingStatus = "Not paired"
    @Published var companionPaired = false
    @Published var contentVersion = UserDefaults.standard.string(forKey: "sentinelContentVersion") ?? "1.2.0"
    @Published var status = "Starting Sentinel…"

    private let cloud = SentinelCloud()

    func start() async {
        status = "Registering this iPhone…"
        cloudOnline = await cloud.registerInstallation()
        update = try? await cloud.latestRelease()
        if let release = update,
           release.installationPolicy == "required",
           isNewer(release.version, than: contentVersion) {
            await installContentUpdate(release)
        } else if let release = update,
                  !isNewer(release.version, than: contentVersion) {
            update = nil
        }
        status = cloudOnline ? "Sentinel online" : "Offline mode"
    }

    func checkForUpdates() async {
        status = "Checking iPhone content…"
        update = try? await cloud.latestRelease()
        guard let release = update,
              release.target == nil || release.target == "ios" || release.target == "both",
              isNewer(release.version, than: contentVersion) else {
            update = nil
            status = "iPhone content is current"
            return
        }
        if release.installationPolicy == "required" {
            await installContentUpdate(release)
        } else {
            status = "Update available"
        }
    }

    func installContentUpdate(_ release: SentinelRelease? = nil) async {
        guard let release = release ?? update else { return }
        status = "Installing Sentinel contentâ€¦"
        do {
            try cloud.applyContentUpdate(release)
            contentVersion = release.version
            update = nil
            cloudOnline = await cloud.registerInstallation()
            status = "Sentinel content \(release.version) installed"
        } catch {
            status = "Update failed: \(error.localizedDescription)"
        }
    }

    private func isNewer(_ candidate: String, than installed: String) -> Bool {
        let left = candidate.split(separator: ".").map { Int($0) ?? 0 }
        let right = installed.split(separator: ".").map { Int($0) ?? 0 }
        for index in 0..<max(left.count, right.count) {
            let a = index < left.count ? left[index] : 0
            let b = index < right.count ? right[index] : 0
            if a != b { return a > b }
        }
        return false
    }

    func pairCompanion() async {
        let cleanCode = pairingCode.filter(\.isNumber)
        guard cleanCode.count == 6 else {
            pairingStatus = "Enter the six-digit code shown by Sentinel Desktop"
            return
        }
        pairingStatus = "Pairing securely…"
        do {
            companionPaired = try await cloud.pairCompanion(code: cleanCode)
            pairingStatus = companionPaired
                ? "Paired with Sentinel Desktop"
                : "The pairing code was rejected or has expired"
            if companionPaired { pairingCode = "" }
        } catch {
            companionPaired = false
            pairingStatus = "Pairing failed: \(error.localizedDescription)"
        }
    }
}

enum SentinelPage: String, CaseIterable, Identifiable {
    case home = "Home", chat = "Chat", navigation = "Navigation", travel = "Travel", weather = "Weather", notifications = "Notifications", settings = "Settings"
    var id: String { rawValue }
    var symbol: String {
        switch self {
        case .home: "house.fill"; case .chat: "message.fill"; case .navigation: "map.fill"
        case .travel: "airplane"; case .weather: "cloud.sun.fill"; case .notifications: "bell.fill"; case .settings: "gearshape.fill"
        }
    }
}

struct SentinelRelease: Codable, Identifiable {
    var id: String { version }
    let version: String
    let notes: String?
    let installationPolicy: String?
    let modules: [String]?
    let target: String?
    let mobileContent: SentinelMobileContent?
}

struct SentinelMobileContent: Codable {
    let protocolVersion: Int?
    let companionTransport: String?
    let serviceAccessMode: String?
    let sharesApiKeys: Bool?
    let maxCloudFileBytes: Int?
}
