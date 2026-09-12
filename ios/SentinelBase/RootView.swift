import SwiftUI

struct RootView: View {
    @EnvironmentObject private var app: SentinelAppModel

    var body: some View {
        NavigationSplitView {
            List(SentinelPage.allCases, selection: $app.selected) { page in
                Label(page.rawValue, systemImage: page.symbol).tag(page)
            }
            .navigationTitle("SENTINEL")
        } detail: {
            ZStack {
                LinearGradient(colors: [Color(red: 0.01, green: 0.04, blue: 0.09), Color(red: 0.03, green: 0.16, blue: 0.25)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                VStack(spacing: 24) {
                    HStack {
                        Circle().fill(app.cloudOnline ? .green : .orange).frame(width: 10)
                        Text(app.status.uppercased()).font(.caption.bold()).tracking(2)
                        Spacer()
                        Text("iOS BASE").font(.caption.monospaced())
                        Text("v\(app.contentVersion)").font(.caption.monospaced())
                    }
                    .foregroundStyle(.cyan)
                    .padding()

                    Image(systemName: app.selected.symbol).font(.system(size: 58)).foregroundStyle(.cyan)
                    Text(app.selected.rawValue).font(.system(size: 42, weight: .bold))
                    Text(pageDescription).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    if app.selected == .settings {
                        VStack(spacing: 14) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("PAIR WITH SENTINEL DESKTOP")
                                    .font(.caption.bold()).tracking(1.6).foregroundStyle(.cyan)
                                TextField("Six-digit pairing code", text: $app.pairingCode)
                                    .keyboardType(.numberPad)
                                    .textContentType(.oneTimeCode)
                                    .padding(12)
                                    .background(.black.opacity(0.25), in: RoundedRectangle(cornerRadius: 12))
                                    .onChange(of: app.pairingCode) { _, value in
                                        app.pairingCode = String(value.filter(\.isNumber).prefix(6))
                                    }
                                Button(app.companionPaired ? "Desktop paired" : "Pair securely") {
                                    Task { await app.pairCompanion() }
                                }
                                .buttonStyle(.borderedProminent).tint(app.companionPaired ? .green : .cyan)
                                .disabled(app.pairingCode.count != 6 && !app.companionPaired)
                                Text(app.pairingStatus).font(.caption).foregroundStyle(.secondary)
                            }
                            .padding()
                            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18))

                            Button("Check for iPhone updates") { Task { await app.checkForUpdates() } }
                                .buttonStyle(.borderedProminent).tint(.cyan)
                        }
                    }
                    if let release = app.update {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("CONTENT UPDATE \(release.version)").font(.caption.bold()).foregroundStyle(.cyan)
                            Text(release.notes ?? "Sentinel iPhone content update available.")
                            Button("Install content update") {
                                Task { await app.installContentUpdate() }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.cyan)
                            Text("App binaries continue through TestFlight or the App Store.").font(.caption).foregroundStyle(.secondary)
                        }.padding().background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18))
                    }
                    Spacer()
                }.padding()
            }.foregroundStyle(.white)
        }.preferredColorScheme(.dark)
    }

    private var pageDescription: String {
        switch app.selected {
        case .home: "Your mobile Sentinel command centre."
        case .chat: "Secure Sentinel chat and voice control."
        case .navigation: "Routes, nearby places and journey planning."
        case .travel: "Trips, flights, arrival intelligence and readiness."
        case .weather: "Current, hourly, weekly and radar weather."
        case .notifications: "Important Sentinel activity in one place."
        case .settings: "Private setup, appearance, services and updates."
        }
    }
}
