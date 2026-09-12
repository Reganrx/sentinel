import SwiftUI

@main
struct SentinelBaseApp: App {
    @StateObject private var app = SentinelAppModel()
    @StateObject private var liveConversation = LiveTalkManager()
    @Environment(\.scenePhase) private var scenePhase
    @State private var requiresUnlockOnForeground = false

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(app)
                .environmentObject(liveConversation)
                .task { await app.start() }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        Task {
                            if requiresUnlockOnForeground {
                                app.lockIfNeeded()
                                requiresUnlockOnForeground = false
                            }
                            await app.refreshCompanionConnection()
                            await app.refreshMobileServicesAfterForeground()
                            app.startReconnectMonitor()
                            liveConversation.resumeAfterForeground()
                        }
                    } else if phase == .background {
                        app.prepareForBackground()
                        liveConversation.suspendForBackground()
                        requiresUnlockOnForeground = true
                        app.stopReconnectMonitor()
                    }
                }
        }
    }
}
