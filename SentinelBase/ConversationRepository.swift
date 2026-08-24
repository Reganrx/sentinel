import Foundation

struct SentinelConversation: Identifiable, Codable {
    let id: UUID
    var title: String
    var createdAt: Date
    var updatedAt: Date
    var messages: [SentinelChatMessage]
    var summary: String?
    var isPinned: Bool
    var isArchived: Bool

    init(id: UUID = UUID(), title: String = "New conversation", createdAt: Date = .now, updatedAt: Date = .now, messages: [SentinelChatMessage] = [], summary: String? = nil, isPinned: Bool = false, isArchived: Bool = false) {
        self.id = id; self.title = title; self.createdAt = createdAt; self.updatedAt = updatedAt; self.messages = messages; self.summary = summary; self.isPinned = isPinned; self.isArchived = isArchived
    }

    var preview: String { messages.last?.text ?? "No messages yet" }
}

/// Private, Codable conversation storage. Credentials are deliberately not part of this store.
final class ConversationRepository {
    private let fileURL: URL
    init(fileManager: FileManager = .default) {
        let directory = (try? fileManager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)) ?? fileManager.temporaryDirectory
        let sentinelDirectory = directory.appendingPathComponent("Sentinel", isDirectory: true)
        try? fileManager.createDirectory(at: sentinelDirectory, withIntermediateDirectories: true)
        fileURL = sentinelDirectory.appendingPathComponent("conversations.json")
    }
    func load() -> [SentinelConversation] { guard let data = try? Data(contentsOf: fileURL) else { return [] }; return (try? JSONDecoder().decode([SentinelConversation].self, from: data)) ?? [] }
    func save(_ conversations: [SentinelConversation]) {
        guard let data = try? JSONEncoder().encode(conversations) else { return }
        do { try data.write(to: fileURL, options: [.atomic]); try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: fileURL.path) } catch { /* Conversation persistence is best-effort; never log private chat content. */ }
    }
    func removeAll() { try? FileManager.default.removeItem(at: fileURL) }
}
