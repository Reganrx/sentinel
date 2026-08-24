import Foundation
import Security

enum KeychainStore {
    private static let service = "uk.co.sentinel.base.companion"

    static func string(for key: String) -> String? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func set(_ value: String, for key: String) throws {
        let data = Data(value.utf8)
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key
        ]
        let attributes: [CFString: Any] = [
            kSecValueData: data,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            attributes.forEach { item[$0.key] = $0.value }
            let addStatus = SecItemAdd(item as CFDictionary, nil)
            guard addStatus == errSecSuccess else { throw KeychainError.unexpectedStatus(addStatus) }
        } else if status != errSecSuccess {
            throw KeychainError.unexpectedStatus(status)
        }
    }

    static func remove(_ key: String) {
        SecItemDelete([
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key
        ] as CFDictionary)
    }

    static func migrateLegacyCompanionCredentials() {
        let legacyKeys = [
            ("sentinelCompanionCloudToken", "cloudToken"),
            ("sentinelCompanionLocalEndpoint", "localEndpoint"),
            ("sentinelCompanionLocalToken", "localToken")
        ]
        for (legacyKey, keychainKey) in legacyKeys {
            if string(for: keychainKey) == nil,
               let value = UserDefaults.standard.string(forKey: legacyKey) {
                try? set(value, for: keychainKey)
            }
            UserDefaults.standard.removeObject(forKey: legacyKey)
        }
    }
}

enum KeychainError: LocalizedError {
    case unexpectedStatus(OSStatus)

    var errorDescription: String? { "Secure credential storage is unavailable." }
}
