import Foundation

enum TransferRoute: String { case localNetwork, cloudflare }
enum TransferState: Equatable { case idle, preparing, transferring(Double), complete, failed(String) }

struct SentinelTransfer: Identifiable {
    let id = UUID()
    let name: String
    let byteCount: Int
    var route: TransferRoute?
    var state: TransferState = .idle
}

enum TransferError: LocalizedError {
    case tooLargeForLocal
    case tooLargeForCloud
    case noAvailableRoute

    var errorDescription: String? {
        switch self {
        case .tooLargeForLocal: "Local transfers are limited to 100 MB."
        case .tooLargeForCloud: "Cloudflare fallback transfers are limited to 65 MB."
        case .noAvailableRoute: "Neither the paired desktop nor the Cloudflare fallback is available."
        }
    }
}
