import Foundation
import UIKit
import Security

struct SentinelCloud {
    private let endpoint = URL(string: "https://sentinel-relay.reganbelson.workers.dev")!

    private func registrationCredentials() -> (id: String, secret: String) {
        let id = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        let account = "sentinel.update.registration.\(id)"
        let key: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "SentinelBase", kSecAttrAccount as String: account]
        var lookup = key
        lookup[kSecReturnData as String] = true
        var item: CFTypeRef?
        if SecItemCopyMatching(lookup as CFDictionary, &item) == errSecSuccess,
           let data = item as? Data, let saved = String(data: data, encoding: .utf8), saved.count >= 32 {
            return (id, saved)
        }
        let secret = "\(UUID().uuidString)\(UUID().uuidString)"
        let add: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "SentinelBase", kSecAttrAccount as String: account, kSecValueData as String: Data(secret.utf8), kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        SecItemDelete(key as CFDictionary)
        SecItemAdd(add as CFDictionary, nil)
        return (id, secret)
    }

    func registerInstallation() async -> Bool {
        var request = URLRequest(url: endpoint.appending(path: "v1/installations/register"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let credentials = registrationCredentials()
        request.setValue(credentials.secret, forHTTPHeaderField: "X-Sentinel-Registration")
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "installationId": credentials.id,
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
        let credentials = registrationCredentials()
        components.queryItems = [URLQueryItem(name: "platform", value: "ios"), URLQueryItem(name: "installationId", value: credentials.id)]
        var request = URLRequest(url: components.url!)
        request.setValue(credentials.secret, forHTTPHeaderField: "X-Sentinel-Registration")
        let (data, response) = try await URLSession.shared.data(for: request)
        if (response as? HTTPURLResponse)?.statusCode == 404 { return nil }
        return try JSONDecoder().decode(SentinelRelease.self, from: data)
    }

    func applyContentUpdate(_ release: SentinelRelease) throws {
        guard release.target == nil || release.target == "ios" || release.target == "both" else {
            throw URLError(.unsupportedURL)
        }
        let defaults = UserDefaults.standard
        defaults.set(release.version, forKey: "sentinelContentVersion")
        if let content = release.mobileContent {
            defaults.set(try JSONEncoder().encode(content), forKey: "sentinelMobileContent")
            defaults.set(content.protocolVersion ?? 1, forKey: "sentinelCompanionProtocolVersion")
            defaults.set(content.companionTransport ?? "cloudflare", forKey: "sentinelCompanionTransport")
            defaults.set(content.serviceAccessMode ?? "desktop-proxy", forKey: "sentinelServiceAccessMode")
            defaults.set(false, forKey: "sentinelSharesApiKeys")
            defaults.set(content.maxCloudFileBytes ?? 65 * 1024 * 1024, forKey: "sentinelCloudFileLimit")
        }
        defaults.set(Date(), forKey: "sentinelContentInstalledAt")
    }

    func pairCompanion(code: String) async throws -> Bool {
        var request = URLRequest(url: endpoint.appending(path: "companion/pair"))
        request.httpMethod = "POST"; request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["code": code, "name": UIDevice.current.name, "platform": "ios"])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200,
              let value = try JSONSerialization.jsonObject(with: data) as? [String: Any], let token = value["token"] as? String else { return false }
        UserDefaults.standard.set(token, forKey: "sentinelCompanionCloudToken")
        if let local = value["local"] as? [String: Any] { UserDefaults.standard.set(local["endpoint"], forKey: "sentinelCompanionLocalEndpoint"); UserDefaults.standard.set(local["token"], forKey: "sentinelCompanionLocalToken") }
        return true
    }

    func companionRequest(path: String, method: String = "GET", body: Data? = nil) async throws -> Data {
        if let base = UserDefaults.standard.string(forKey: "sentinelCompanionLocalEndpoint"), let token = UserDefaults.standard.string(forKey: "sentinelCompanionLocalToken"), let url = URL(string: base + path) {
            var local = URLRequest(url: url); local.httpMethod = method; local.httpBody = body; local.timeoutInterval = 3
            local.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization"); local.setValue("application/json", forHTTPHeaderField: "Content-Type")
            if let (data, response) = try? await URLSession.shared.data(for: local), (response as? HTTPURLResponse)?.statusCode == 200 { return data }
        }
        guard let token = UserDefaults.standard.string(forKey: "sentinelCompanionCloudToken") else { throw URLError(.userAuthenticationRequired) }
        let cleanPath = path.hasPrefix("/") ? path : "/" + path
        let nativeAliases = cleanPath == "/status" || cleanPath == "/clipboard" || cleanPath == "/files" || cleanPath.hasPrefix("/files/")
        let cloudPath = nativeAliases ? cleanPath : "/companion/sync" + cleanPath
        var cloud = URLRequest(url: endpoint.appending(path: String(cloudPath.dropFirst()))); cloud.httpMethod = method; cloud.httpBody = body
        cloud.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization"); cloud.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await URLSession.shared.data(for: cloud); guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }; return data
    }
}
