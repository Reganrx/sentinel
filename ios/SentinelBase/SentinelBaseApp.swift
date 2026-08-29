import SwiftUI

@main
struct SentinelBaseApp: App {
    @StateObject private var app = SentinelAppModel()

    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(app).task { await app.start() }
        }
    }
}
