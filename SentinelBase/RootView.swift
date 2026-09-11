import SwiftUI
import UniformTypeIdentifiers
import MapKit
import UIKit
import PhotosUI

struct RootView: View {
    @EnvironmentObject private var app: SentinelAppModel
    @EnvironmentObject private var live: LiveTalkManager
    @State private var browsePresented = false
    @State private var navigationPath: [SentinelPage] = []
    var body: some View {
        NavigationStack(path: $navigationPath) {
            SentinelPageView(page: .home)
                .navigationDestination(for: SentinelPage.self) { SentinelPageView(page: $0) }
                .toolbar { ToolbarItemGroup(placement: .topBarTrailing) { Button { live.open(conversationId: app.conversationID, enabledServices: app.enabledMobileServices.sorted()) } label: { Image(systemName: liveIcon).symbolEffect(.pulse, options: .repeating, isActive: live.state == .thinking || live.state == .speaking).foregroundStyle(Color(uiColor: app.accentColor)) }.accessibilityLabel(liveAccessibilityLabel); Button { browsePresented = true } label: { Label("Browse", systemImage: "square.grid.2x2") } } }
        }
        .tint(Color(uiColor: app.accentColor)).preferredColorScheme(.dark)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if app.selected != .chat { SentinelBottomBar(browsePresented: $browsePresented) }
        }
        .sheet(isPresented: $browsePresented) { SentinelBrowseView() }
        .onChange(of: app.selected) { _, page in
            let destination: [SentinelPage] = page == .home ? [] : [page]
            if navigationPath != destination { navigationPath = destination }
        }
        .onChange(of: navigationPath) { _, path in
            let visiblePage = path.last ?? .home
            if app.selected != visiblePage { app.selected = visiblePage }
        }
        .sheet(isPresented: $live.isPanelPresented) { TalkWithSentinelView() }
        .onAppear { live.onVerifiedTool = { service, result in app.applyVerifiedLiveTool(service: service, result: result) } }
        .overlay { if app.isLocked { SentinelLockView() } }
        .alert("Allow independent mobile service access?", isPresented: $app.showMobileAccessConsent) { Button("Not now", role: .cancel) {}; Button("Allow") { Task { await app.enrolMobileAccess() } } } message: { Text("Approved services use the secure Sentinel relay. API keys are never copied to this iPhone.") }
    }
    private var liveIcon: String { switch live.state { case .connecting, .thinking: "waveform.path.ecg"; case .speaking: "waveform.circle.fill"; case .listening, .muted: "waveform.badge.mic"; case .failed: "exclamationmark.triangle.fill"; default: "waveform.badge.mic" } }
    private var liveAccessibilityLabel: String { live.isActive ? "Open Talk with Sentinel, \(live.status)" : "Start Talk with Sentinel" }
}

private struct SentinelBottomBar: View {
    @EnvironmentObject private var app: SentinelAppModel
    @Binding var browsePresented: Bool
    private let primary: [SentinelPage] = [.home, .chat, .weather, .navigation, .travel]
    private var accent: Color { Color(uiColor: app.accentColor) }
    var body: some View {
        HStack(spacing: 3) {
            ForEach(primary) { page in
                Button { app.selected = page } label: {
                    VStack(spacing: 3) {
                        Image(systemName: page.symbol).font(.system(size: 17, weight: app.selected == page ? .semibold : .regular))
                        Text(page == .navigation ? "Navigate" : page.rawValue).font(.system(size: 9, weight: .medium)).lineLimit(1)
                    }
                    .foregroundStyle(app.selected == page ? accent : .secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(app.selected == page ? accent.opacity(0.13) : .clear, in: RoundedRectangle(cornerRadius: 12))
                }.buttonStyle(.plain).accessibilityLabel("Open \(page.rawValue)")
            }
            Button { browsePresented = true } label: {
                VStack(spacing: 3) { Image(systemName: "ellipsis.circle").font(.system(size: 17)); Text("More").font(.system(size: 9, weight: .medium)) }
                    .foregroundStyle(.secondary).frame(maxWidth: .infinity).padding(.vertical, 8)
            }.buttonStyle(.plain)
        }
        .padding(.horizontal, 8).padding(.vertical, 5)
        .background(.ultraThinMaterial).overlay(alignment: .top) { Divider().opacity(0.35) }
    }
}

private struct SentinelBrowseView: View {
    @EnvironmentObject private var app: SentinelAppModel
    @Environment(\.dismiss) private var dismiss
    var body: some View { NavigationStack { List(app.menuPages.filter { $0 != .home }) { page in Button { app.selected = page; dismiss() } label: { Label(page.rawValue, systemImage: page.symbol) } }.navigationTitle("Sentinel").toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } } }.preferredColorScheme(.dark) }
}

private struct SentinelPageView: View {
    let page: SentinelPage
    @EnvironmentObject private var app: SentinelAppModel
    @EnvironmentObject private var live: LiveTalkManager
    @State private var importingFile = false
    @State private var weatherSection = 0
    @State private var travelSection = 0
    @State private var showHomeQuickReply = false
    @State private var helpPresented = false
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.015, green: 0.035, blue: 0.07), Color(red: 0.015, green: 0.13, blue: 0.19)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            if page == .chat {
                SentinelChatWorkspace(importingFile: $importingFile)
            } else {
                ScrollView { VStack(alignment: .leading, spacing: 16) { Header(page: page); content }.padding().padding(.bottom, 28) }
                    .refreshable { await app.refreshCompanionConnection(); if page == .weather { app.refreshWeather() } }
            }
        }
        .navigationTitle(page.rawValue).navigationBarTitleDisplayMode(.inline)
        .onAppear { app.selected = page; if page == .home { showHomeQuickReply = false }; if page == .settings { Task { await app.refreshMobileServiceStatus() } } }
        .fileImporter(isPresented: $importingFile, allowedContentTypes: [.data]) { result in
            guard case let .success(url) = result else { return }; let access = url.startAccessingSecurityScopedResource(); defer { if access { url.stopAccessingSecurityScopedResource() } }; guard let data = try? Data(contentsOf: url) else { return }; Task { await app.sendFile(data, filename: url.lastPathComponent) }
        }
        .sheet(isPresented: $helpPresented) { SentinelMobileHelpView() }
    }
    @ViewBuilder private var content: some View {
        switch page {
        case .home: home
        case .chat: EmptyView()
        case .navigation: navigation
        case .travel: travel
        case .weather: weather
        case .missionControl: missionControl
        case .notifications: notifications
        case .settings: settings
        case .system: system
        }
    }
    private var home: some View { Group {
        HomeHero()
        Card(title: "QUICK COMMAND", symbol: "sparkles") { Text("Ask Sentinel anything, dictate once, or start a live conversation.").font(.caption).foregroundStyle(.secondary); if showHomeQuickReply, let latest = app.chatMessages.last { VStack(alignment: .leading, spacing: 5) { Text(latest.role == .user ? "YOU" : "SENTINEL").font(.caption2.bold()).foregroundStyle(Color(uiColor: app.accentColor)); Text(latest.text).font(.subheadline).textSelection(.enabled) }.padding(10).frame(maxWidth: .infinity, alignment: .leading).background(latest.role == .user ? Color(uiColor: app.accentColor).opacity(0.16) : Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 13)) }; if app.isSendingChat { HStack { ProgressView().tint(Color(uiColor: app.accentColor)); Text("Sentinel is thinking…").font(.caption).foregroundStyle(.secondary) } }; if let error = app.chatError, showHomeQuickReply { Text(error).font(.caption).foregroundStyle(.orange); Button("Retry") { Task { await app.retryAssistantPrompt() } }.buttonStyle(.bordered) }; HStack(spacing: 10) { TextField("Ask Sentinel anything…", text: $app.chatDraft, axis: .vertical).lineLimit(1...3).submitLabel(.send).onSubmit { sendHomeQuickCommand() }.textFieldStyle(.roundedBorder); Button { live.open(conversationId: app.conversationID, enabledServices: app.enabledMobileServices.sorted()) } label: { Image(systemName: "waveform.badge.mic").font(.title3) }.accessibilityLabel("Talk with Sentinel"); Button { sendHomeQuickCommand() } label: { Image(systemName: "arrow.up.circle.fill").font(.system(size: 34)) }.disabled(app.chatDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || app.isSendingChat) } }
        if let weather = app.weather { NavigationLink(value: SentinelPage.weather) { HomeWeatherCard(weather: weather, location: app.weatherDetails?.location.name, updatedAt: app.weatherUpdatedAt) }.buttonStyle(.plain).accessibilityLabel("Open weather") }
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 11), GridItem(.flexible(), spacing: 11)], spacing: 11) { ForEach([SentinelPage.chat, .weather, .navigation, .travel]) { item in NavigationLink(value: item) { HomeAction(page: item, subtitle: homeShortcutSubtitle(item)) } } }
        Card(title: "UP NEXT", symbol: "calendar") { Text(app.trips.first.map { "\($0.title) · \($0.date.formatted(date: .abbreviated, time: .shortened))" } ?? "No upcoming trips saved. Add one in Travel for a mobile briefing.") }
    } }
    private var navigation: some View { SentinelNavigationWorkspace() }
    private var travel: some View { SentinelTravelWorkspace(section: $travelSection) }
    private var weather: some View { SentinelWeatherDashboard(section: $weatherSection) }
    private var missionControl: some View { SentinelMissionControl() }
    private var notifications: some View { Card(title: "ACTIVITY", symbol: "bell.badge.fill") { HStack { Toggle("Unread only", isOn: $app.showUnreadOnly); Spacer(); if app.unreadActivityCount > 0 { Button("Mark all as read") { app.markAllActivityRead() }.buttonStyle(.borderedProminent) } }; ForEach(app.filteredActivity) { item in HStack(alignment: .top) { Image(systemName: item.symbol).foregroundStyle(Color(uiColor: app.accentColor)); VStack(alignment: .leading) { Text(item.title).bold(); Text(item.detail).font(.caption).foregroundStyle(.secondary) }; Spacer(); if !item.isRead { Button { app.markActivityRead(item.id) } label: { Image(systemName: "checkmark.circle") } } } } } }
    private var settings: some View { VStack(alignment: .leading, spacing: 16) {
        Card(title: "SENTINEL CONTROL CENTRE", symbol: "slider.horizontal.3") { StatusRow("Status", app.status, good: app.cloudOnline); StatusRow("Native app", app.nativeVersion, good: true); StatusRow("Content", "v\(app.contentVersion)", good: true); HStack { Button("Check for updates") { Task { await app.checkForUpdates() } }.buttonStyle(.borderedProminent); Button("How to use") { helpPresented = true }.buttonStyle(.bordered) } }
        Card(title: "EXPERIENCE", symbol: "paintpalette.fill") { Picker("Accent colour", selection: Binding(get: { app.accentTheme }, set: { app.setAccentTheme($0) })) { ForEach(SentinelAccentTheme.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.menu); Picker("Reactor animation", selection: Binding(get: { app.reactorAnimation }, set: { app.setReactorAnimation($0) })) { ForEach(SentinelReactorAnimation.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.segmented); Text("Visible pages").font(.caption.bold()).foregroundStyle(.secondary); ForEach(SentinelPage.corePages.filter { $0 != .home && $0 != .settings }) { page in Toggle(page.rawValue, isOn: Binding(get: { app.visiblePageNames.contains(page.rawValue) }, set: { app.setPageVisible(page, visible: $0) })) } }
        Card(title: "VOICE & AUDIO", symbol: "waveform") { StatusRow("Talk with Sentinel", "cedar", good: true); Toggle("Spoken replies", isOn: $app.spokenResponses).onChange(of: app.spokenResponses) { _, enabled in app.setSpokenResponses(enabled) }; Text("Live conversations default to the iPhone speaker. Microphone and speech permissions remain under iOS control.").font(.caption).foregroundStyle(.secondary) }
        MobileServicesDiagnosticsPanel()
        Card(title: "DESKTOP SYNC", symbol: "link") { TextField("Six-digit pairing code", text: $app.pairingCode).keyboardType(.numberPad).textFieldStyle(.roundedBorder); StatusRow("Connection", app.pairingStatus, good: app.companionPaired); if let date = app.companionLastSyncedAt { Text("Last connected \(date, style: .relative)").font(.caption).foregroundStyle(.secondary) }; HStack { Button(app.companionPaired ? "Desktop paired" : "Pair securely") { Task { await app.pairCompanion() } }.disabled(app.pairingCode.count != 6 && !app.companionPaired).buttonStyle(.borderedProminent); Button("Reconnect") { Task { await app.refreshCompanionConnection() } }.buttonStyle(.bordered) }; Button("Test Personal + iPhone") { Task { await app.testPersonalAndMobile() } }.buttonStyle(.bordered); Text(app.crossDeviceTestStatus).font(.caption2).foregroundStyle(.secondary); if app.companionPaired { Button("Unpair this iPhone", role: .destructive) { Task { await app.unpairCompanion() } } } }
        Card(title: "PRIVACY & UPDATES", symbol: "lock.shield.fill") { Toggle("Face ID lock", isOn: Binding(get: { app.appLockEnabled }, set: { enabled in Task { if enabled { await app.enableAppLock() } else { await app.disableAppLock() } } })); Text("App binaries update through Xcode, TestFlight or the App Store. Sentinel content and configuration updates remain separate.").font(.caption).foregroundStyle(.secondary); Button("Check Sentinel content") { Task { await app.checkForUpdates() } }.buttonStyle(.bordered) }
    } }
    private var system: some View { Group {
        Card(title: "THIS IPHONE", symbol: "iphone") { HStack(spacing: 16) { ZStack { Circle().fill(Color(uiColor: app.accentColor).opacity(0.14)).frame(width: 72, height: 72); Image(systemName: "iphone").font(.system(size: 34, weight: .medium)).foregroundStyle(Color(uiColor: app.accentColor)) }; VStack(alignment: .leading, spacing: 5) { Text(app.localSystem.deviceName).font(.title3.bold()).lineLimit(1); Text(app.localSystem.systemVersion).font(.subheadline).foregroundStyle(.secondary); Label("Private local device status", systemImage: "lock.fill").font(.caption).foregroundStyle(Color(uiColor: app.accentColor)) }; Spacer() } }
        Card(title: "POWER", symbol: "battery.100percent") { HStack(alignment: .center, spacing: 14) { Image(systemName: batterySymbol).font(.system(size: 36)).foregroundStyle(batteryColor); VStack(alignment: .leading, spacing: 3) { Text(app.localSystem.batteryLevel.map { "\($0)%" } ?? "Unavailable").font(.system(size: 30, weight: .bold)); Text(app.localSystem.batteryState).font(.caption).foregroundStyle(.secondary) }; Spacer(); Text("iPhone battery information is supplied by iOS.").font(.caption2).foregroundStyle(.secondary).frame(maxWidth: 120, alignment: .trailing) } }
        Card(title: "SENTINEL", symbol: "app.badge") { StatusRow("Native app", app.nativeVersion, good: true); StatusRow("Content", "v\(app.contentVersion)", good: true); StatusRow("Uptime", formattedUptime(app.localSystem.uptime), good: true); Button { app.refreshLocalSystem() } label: { Label("Refresh local status", systemImage: "arrow.clockwise") }.buttonStyle(.bordered).tint(Color(uiColor: app.accentColor)) }
        Card(title: "DEVICE PRIVACY", symbol: "hand.raised.fill") { Text("Sentinel reads only the device details iOS makes available. It cannot change iPhone system settings or access hardware diagnostics that iOS restricts.").font(.caption).foregroundStyle(.secondary) }
    } }
    private var batterySymbol: String { guard let level = app.localSystem.batteryLevel else { return "battery.0" }; if app.localSystem.batteryState == "Charging" { return "battery.100percent.bolt" }; return level > 66 ? "battery.100percent" : level > 33 ? "battery.50percent" : "battery.25percent" }
    private var batteryColor: Color { guard let level = app.localSystem.batteryLevel else { return .secondary }; return level > 20 ? Color(uiColor: app.accentColor) : .orange }
    private func formattedUptime(_ interval: TimeInterval) -> String { let total = Int(interval); return "\(total / 3600)h \((total % 3600) / 60)m" }
    private func sendHomeQuickCommand() { showHomeQuickReply = true; Task { await app.submitAssistantPrompt() } }
    private func homeShortcutSubtitle(_ page: SentinelPage) -> String { switch page { case .chat: "Ready"; case .weather: app.weather?.conditionName ?? "Local forecast"; case .navigation: app.lastKnownLocation == nil ? "Set location" : "Current location"; case .travel: app.trips.first?.title ?? "No trip planned"; default: "Open" } }
}

private struct SentinelMissionControl: View {
    @EnvironmentObject private var app: SentinelAppModel
    @State private var section = 0
    @State private var device = ""
    @State private var command = ""
    @State private var confirmCommand = false
    private var accent: Color { Color(uiColor: app.accentColor) }
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Picker("Mission Control section", selection: $section) { Text("Overview").tag(0); Text("Security").tag(1); Text("Automation").tag(2) }.pickerStyle(.segmented)
            if section == 0 { overview } else if section == 1 { security } else { automation }
        }
        .alert("Confirm home command", isPresented: $confirmCommand) { Button("Cancel", role: .cancel) {}; Button("Send") { Task { await app.queueDesktopAction(.smartHomeControl, target: device, command: "\(command) \(device)", approved: true) } } } message: { Text("Send “\(command) \(device)” to Sentinel Personal?") }
    }
    private var overview: some View { Group {
        Card(title: "MISSION STATUS", symbol: "shield.lefthalf.filled") { StatusRow("Sentinel Personal", app.pairingStatus, good: app.companionPaired); StatusRow("Mobile services", app.mobileAccessStatus, good: app.hasMobileServiceAccess); Text(app.desktopActionStatus).font(.caption).foregroundStyle(.secondary); Button("Test Personal + iPhone") { Task { await app.testPersonalAndMobile() } }.buttonStyle(.borderedProminent).tint(accent) }
        Card(title: "QUICK COMMANDS", symbol: "command") { Button("Run system check") { Task { await app.queueDesktopAction(.systemCheck) } }.buttonStyle(.bordered); Button("Open Automation in Personal") { Task { await app.queueDesktopAction(.openPage, target: "automation", command: "Open Automation") } }.buttonStyle(.bordered); Button("Open Home Control in Personal") { Task { await app.queueDesktopAction(.openPage, target: "home-control", command: "Open Home Control") } }.buttonStyle(.bordered) }
    } }
    private var security: some View { Group {
        Card(title: "SECURITY", symbol: "lock.shield.fill") { Text("Request a current security report from your paired Sentinel Personal computer.").font(.caption).foregroundStyle(.secondary); Button("Check security status") { Task { await app.queueDesktopAction(.securityStatus) } }.buttonStyle(.borderedProminent).tint(accent); Button("Open Security in Personal") { Task { await app.queueDesktopAction(.openPage, target: "security", command: "Open Security") } }.buttonStyle(.bordered); Text(app.desktopActionStatus).font(.caption).foregroundStyle(.secondary) }
    } }
    private var automation: some View { Group {
        Card(title: "HOME COMMAND", symbol: "house.and.flag.fill") { TextField("Device, room or scene", text: $device).textFieldStyle(.roundedBorder); TextField("Command, e.g. turn off", text: $command).textFieldStyle(.roundedBorder); Button("Review command") { confirmCommand = true }.buttonStyle(.borderedProminent).tint(accent).disabled(device.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || command.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty); Text("Commands require the paired Personal app and retain its approval and device-safety rules.").font(.caption2).foregroundStyle(.secondary) }
        Card(title: "AUTOMATION", symbol: "bolt.badge.clock.fill") { Button("Open Automation in Personal") { Task { await app.queueDesktopAction(.openPage, target: "automation", command: "Open Automation") } }.buttonStyle(.borderedProminent).tint(accent); Text(app.desktopActionStatus).font(.caption).foregroundStyle(.secondary) }
    } }
}

private struct MobileServicesDiagnosticsPanel: View {
    @EnvironmentObject private var app: SentinelAppModel
    @State private var cameraTarget = "Front door camera"
    @State private var smartHomeTarget = ""
    @State private var smartHomeCommand = ""
    @State private var confirmSmartHome = false
    private let services = [("AI Chat", "chat"), ("Weather", "weather"), ("Navigation & Places", "navigation"), ("Flight Status", "aviation"), ("Live Aircraft", "aircraft")]

    var body: some View {
        Card(title: "MOBILE SERVICES", symbol: "bolt.horizontal.circle.fill") {
            if let status = app.mobileServiceStatus {
                StatusRow("Relay", status.online == false ? "Unavailable" : "Connected", good: status.online != false)
                ForEach(services, id: \.1) { label, key in
                    let service = status.services[key]
                    StatusRow(label, serviceLabel(service, fallbackEnabled: app.enabledMobileServices.contains(key)), good: service?.available == true)
                }
                if let profile = status.profile?.version { Text("Profile \(profile) · Permission v\(status.permissionVersion ?? 1)").font(.caption2).foregroundStyle(.secondary) }
                if let expiry = status.tokenExpiresAt { Text("Token expiry: \(expiry)").font(.caption2).foregroundStyle(.secondary).lineLimit(1) }
            } else {
                Text(app.mobileServiceDiagnostics).font(.caption).foregroundStyle(.secondary)
            }
            HStack {
                Button(app.isCheckingMobileServices ? "Checking…" : "Test mobile services") { Task { await app.refreshMobileServiceStatus() } }.buttonStyle(.borderedProminent).disabled(app.isCheckingMobileServices)
                Button("Reconnect") { Task { await app.refreshCompanionConnection(); await app.refreshMobileServiceStatus() } }.buttonStyle(.bordered)
            }
            if app.hasMobileServiceAccess {
                Button("Disable Mobile Services", role: .destructive) { Task { await app.disableMobileAccess() } }.buttonStyle(.bordered)
            } else {
                Button { Task { await app.requestMobileAccess() } } label: { Label("Enable Mobile Services", systemImage: "bolt.shield.fill") }.buttonStyle(.borderedProminent).disabled(!app.companionPaired)
                Text(app.companionPaired ? "Uses the services approved in Sentinel Personal without copying API keys to this iPhone." : "Pair this iPhone with Sentinel Personal first.").font(.caption2).foregroundStyle(.secondary)
            }
            Text(app.mobileServicesCheckedAt.map { "Last checked \($0.formatted(date: .omitted, time: .shortened))" } ?? app.mobileServiceDiagnostics).font(.caption2).foregroundStyle(.secondary)

            Divider().overlay(Color.white.opacity(0.1))
            Text("PAIRED DESKTOP REQUESTS").font(.caption.bold()).foregroundStyle(Color(uiColor: app.accentColor))
            Text("These requests are queued for Sentinel Personal. A queued request is not confirmation that it completed.").font(.caption2).foregroundStyle(.secondary)
            HStack {
                Button("System check") { Task { await app.queueDesktopAction(.systemCheck) } }.buttonStyle(.bordered)
                Button("Security status") { Task { await app.queueDesktopAction(.securityStatus) } }.buttonStyle(.bordered)
            }
            HStack(spacing: 8) {
                TextField("Camera name", text: $cameraTarget).textFieldStyle(.roundedBorder)
                Button("Request camera") { Task { await app.queueDesktopAction(.cameraView, target: cameraTarget, command: "Show the \(cameraTarget)") } }.buttonStyle(.bordered)
            }
            VStack(alignment: .leading, spacing: 7) {
                TextField("Smart-home device", text: $smartHomeTarget).textFieldStyle(.roundedBorder)
                TextField("Command, e.g. Turn off", text: $smartHomeCommand).textFieldStyle(.roundedBorder)
                Button("Request smart-home change") { confirmSmartHome = true }.buttonStyle(.bordered).disabled(smartHomeTarget.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || smartHomeCommand.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            Text(app.desktopActionStatus).font(.caption).foregroundStyle(.secondary)
        }
        .alert("Confirm smart-home change", isPresented: $confirmSmartHome) {
            Button("Cancel", role: .cancel) {}
            Button("Send request") { Task { await app.queueDesktopAction(.smartHomeControl, target: smartHomeTarget, command: "\(smartHomeCommand) \(smartHomeTarget)", approved: true) } }
        } message: { Text("Send “\(smartHomeCommand) \(smartHomeTarget)” to Sentinel Personal? It will be queued for the paired desktop; completion is not guaranteed.") }
    }

    private func serviceLabel(_ service: SentinelMobileStatus.Service?, fallbackEnabled: Bool) -> String {
        guard let service else { return fallbackEnabled ? "Enabled" : "Permission required" }
        if !service.permitted { return "Permission required" }
        if !service.configured { return "Credentials missing" }
        return service.available ? "Available" : "Provider unavailable"
    }
}

private struct SentinelNavigationWorkspace: View {
    @EnvironmentObject private var app: SentinelAppModel
    @State private var tab = 0
    private var accent: Color { Color(uiColor: app.accentColor) }
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Picker("Navigation section", selection: $tab) {
                Text("Journey").tag(0); Text("Places").tag(1); Text("Saved").tag(2)
            }
            .pickerStyle(.segmented)
            .padding(4)
            .background(Color.white.opacity(0.045), in: Capsule())
            if tab == 0 { journey } else if tab == 1 { places } else { saved }
        }
    }

    private var journey: some View {
        VStack(spacing: 14) {
            Map {
                if let coordinate = app.lastKnownLocation { Marker("Your location", coordinate: coordinate) }
                if let destination = app.journeyDestinationItem { Marker(destination.name ?? "Destination", coordinate: destination.placemark.coordinate) }
                if let route = app.journeyRoute { MapPolyline(route.polyline).stroke(accent, lineWidth: 5) }
            }
            .mapStyle(.standard(elevation: .flat, emphasis: .muted))
            .frame(height: 260)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(alignment: .topLeading) { Label(app.journeyRoute == nil ? "READY TO PLAN" : "ROUTE READY", systemImage: app.journeyRoute == nil ? "location.magnifyingglass" : "checkmark.circle.fill").font(.caption.bold()).foregroundStyle(.white).padding(.horizontal, 10).padding(.vertical, 7).background(.black.opacity(0.55), in: Capsule()).padding(12) }
            .overlay(alignment: .bottomTrailing) { Button { app.refreshWeather() } label: { Image(systemName: "location.fill").font(.headline).padding(12).background(.ultraThinMaterial, in: Circle()) }.padding(12).accessibilityLabel("Refresh current location") }

            Card(title: "JOURNEY PLANNER", symbol: "point.topleft.down.curvedto.point.bottomright.up") {
                HStack(spacing: 10) {
                    Image(systemName: "location.fill").foregroundStyle(accent).frame(width: 20)
                    VStack(alignment: .leading, spacing: 2) { Text("From").font(.caption2.weight(.semibold)).foregroundStyle(.secondary); Text(app.lastKnownLocation == nil ? "Location needed" : "Current location").font(.subheadline.weight(.medium)) }
                    Spacer()
                    Image(systemName: "arrow.down").font(.caption).foregroundStyle(.secondary)
                }
                Divider().overlay(Color.white.opacity(0.1))
                HStack(spacing: 10) {
                    Image(systemName: "mappin.and.ellipse").foregroundStyle(accent).frame(width: 20)
                    TextField("Where do you want to go?", text: $app.journeyDestination).submitLabel(.search).onSubmit { Task { await app.planJourney() } }
                }
                .padding(.horizontal, 11).padding(.vertical, 10).background(Color.black.opacity(0.26), in: RoundedRectangle(cornerRadius: 14))
                Picker("Travel mode", selection: $app.journeyMode) { ForEach(SentinelJourneyMode.allCases) { Label($0.rawValue, systemImage: $0.symbol).tag($0) } }.pickerStyle(.segmented)
                HStack(spacing: 10) {
                    Button(app.isPlanningJourney ? "Planning…" : "Plan journey") { Task { await app.planJourney() } }.buttonStyle(.borderedProminent).tint(accent).disabled(app.isPlanningJourney || app.journeyDestination.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    Button { app.clearJourney() } label: { Label("Clear", systemImage: "xmark") }.buttonStyle(.bordered)
                }
                Text(app.journeyStatus).font(.caption).foregroundStyle(.secondary)
                if let route = app.journeyRoute {
                    HStack { journeyMetric("Distance", Measurement(value: route.distance, unit: UnitLength.meters).formatted(.measurement(width: .abbreviated, usage: .road)), "point.topleft.down.curvedto.point.bottomright.up"); journeyMetric("Arrival", Date.now.addingTimeInterval(route.expectedTravelTime).formatted(date: .omitted, time: .shortened), "clock"); journeyMetric("Time", journeyTime(route.expectedTravelTime), "timer") }
                    Button { app.journeyDestinationItem?.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: app.journeyMode == .walking ? MKLaunchOptionsDirectionsModeWalking : MKLaunchOptionsDirectionsModeDriving]) } label: { Label("Start in Apple Maps", systemImage: "arrow.triangle.turn.up.right.diamond.fill") }.buttonStyle(.bordered).tint(accent)
                }
            }
        }
    }

    private var places: some View {
        VStack(alignment: .leading, spacing: 14) {
            Card(title: "EXPLORE NEARBY", symbol: "mappin.and.ellipse") {
                Text("Find useful places around your current location.").font(.caption).foregroundStyle(.secondary)
                HStack(spacing: 9) {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                    TextField("Search places", text: $app.mapSearch).submitLabel(.search).onSubmit { Task { await app.searchMobilePlaces() } }
                    if !app.mapSearch.isEmpty { Button { app.mapSearch = "" } label: { Image(systemName: "xmark.circle.fill") }.foregroundStyle(.secondary) }
                }
                .padding(.horizontal, 12).padding(.vertical, 11).background(Color.black.opacity(0.28), in: RoundedRectangle(cornerRadius: 15))
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 92), spacing: 8)], spacing: 8) {
                    ForEach([("Food", "fork.knife"), ("Coffee", "cup.and.saucer.fill"), ("Fuel", "fuelpump.fill"), ("Pharmacy", "cross.case.fill"), ("Shopping", "bag.fill"), ("Hotels", "bed.double.fill"), ("Parking", "parkingsign.circle.fill"), ("Hospitals", "cross.fill")], id: \.0) { item in
                        Button { app.mapSearch = item.0; Task { await app.searchMobilePlaces() } } label: { Label(item.0, systemImage: item.1).font(.caption.weight(.semibold)).frame(maxWidth: .infinity).padding(.vertical, 9) }.buttonStyle(.bordered).tint(accent)
                    }
                }
                Text(app.mapStatus).font(.caption).foregroundStyle(.secondary)
            }
            if app.placeResults.isEmpty {
                ContentUnavailableView("Find somewhere nearby", systemImage: "mappin.circle", description: Text("Choose a category or enter a search above."))
                    .foregroundStyle(.secondary).padding(.vertical, 28)
            } else {
                ForEach(app.placeResults) { place in Card(title: place.name, symbol: "mappin.circle.fill") { Text(place.formattedAddress ?? "Address not supplied").font(.caption).foregroundStyle(.secondary); HStack { if let rating = place.rating { Label("\(rating, specifier: "%.1f")", systemImage: "star.fill").foregroundStyle(.yellow) }; if let open = place.openingHours?.openNow { Text(open ? "Open now" : "Closed").font(.caption.weight(.semibold)).foregroundStyle(open ? .green : .orange) }; Spacer(); Button("Route") { app.journeyDestination = place.name; tab = 0; Task { await app.planJourney() } }.buttonStyle(.bordered).tint(accent); Button { app.savePlace(place) } label: { Image(systemName: "bookmark") }.buttonStyle(.bordered) } } }
            }
        }
    }

    private var saved: some View { Card(title: "SAVED PLACES", symbol: "bookmark.fill") { if app.savedPlaces.isEmpty { ContentUnavailableView("No saved places", systemImage: "bookmark", description: Text("Save a result from Places to keep it ready for a future journey.")).padding(.vertical, 22) } else { ForEach(app.savedPlaces) { place in HStack { VStack(alignment: .leading, spacing: 2) { Text(place.name).font(.headline); if let address = place.address { Text(address).font(.caption).foregroundStyle(.secondary).lineLimit(1) } }; Spacer(); Button { app.journeyDestination = place.name; tab = 0; Task { await app.planJourney() } } label: { Image(systemName: "arrow.turn.up.right") }.buttonStyle(.bordered).tint(accent); Button(role: .destructive) { app.removeSavedPlace(place) } label: { Image(systemName: "trash") } } } } } }
    private func journeyMetric(_ label: String, _ value: String, _ symbol: String) -> some View { VStack(alignment: .leading, spacing: 3) { Label(label, systemImage: symbol).font(.caption2).foregroundStyle(.secondary); Text(value).font(.caption.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.75) }.frame(maxWidth: .infinity, alignment: .leading).padding(9).background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12)) }
    private func journeyTime(_ interval: TimeInterval) -> String { let minutes = max(1, Int(interval / 60)); return minutes >= 60 ? "\(minutes / 60)h \(minutes % 60)m" : "\(minutes)m" }
}

private struct SentinelTravelWorkspace: View {
    @EnvironmentObject private var app: SentinelAppModel
    @Binding var section: Int
    var body: some View { VStack(alignment: .leading, spacing: 14) { Picker("Travel section", selection: $section) { Text("Ready to Go").tag(0); Text("Destination").tag(1); Text("Flight Tracker").tag(2) }.pickerStyle(.segmented); if section == 0 { ready } else if section == 1 { destination } else { flights } } }
    private var ready: some View { VStack(alignment: .leading, spacing: 14) { Card(title: "UPCOMING TRIPS", symbol: "suitcase.fill") { TextField("Trip or destination", text: $app.tripTitle).textFieldStyle(.roundedBorder); DatePicker("Departure", selection: $app.tripDate, displayedComponents: .date); TextField("Hotel, resort or notes", text: $app.tripNotes).textFieldStyle(.roundedBorder); Button("Add trip") { app.addTrip() }.buttonStyle(.borderedProminent); if app.trips.isEmpty { Text("No trip planned yet.").font(.caption).foregroundStyle(.secondary) } else { ForEach(app.trips) { trip in HStack { VStack(alignment: .leading) { Text(trip.title).font(.headline); Text(trip.date.formatted(date: .abbreviated, time: .omitted)).font(.caption).foregroundStyle(.secondary) }; Spacer(); Text(trip.date > .now ? "\(Calendar.current.dateComponents([.day], from: .now, to: trip.date).day ?? 0)d" : "Saved").font(.caption.bold()).foregroundStyle(Color(uiColor: app.accentColor)) } } } }
        Card(title: "READINESS", symbol: "checklist") { Text("Keep passport, insurance, boarding passes, medication, chargers and airport transfer details ready before departure.").font(.caption).foregroundStyle(.secondary) } } }
    private var destination: some View { VStack(alignment: .leading, spacing: 14) { Card(title: "DESTINATION", symbol: "mappin.and.ellipse") { TextField("City, hotel, resort or landmark", text: $app.mapSearch).textFieldStyle(.roundedBorder).submitLabel(.search).onSubmit { Task { await app.searchMobilePlaces() } }; HStack { Button("Find places") { Task { await app.searchMobilePlaces() } }.buttonStyle(.borderedProminent); Button("Open Navigation") { app.selected = .navigation }.buttonStyle(.bordered) }; Text("Searches use the selected destination or your current location when available.").font(.caption).foregroundStyle(.secondary) }; ForEach(app.placeResults.prefix(6)) { place in Card(title: place.name, symbol: "star.circle.fill") { Text(place.formattedAddress ?? "Address not supplied").font(.caption).foregroundStyle(.secondary); HStack { if let rating = place.rating { Label("\(rating, specifier: "%.1f")", systemImage: "star.fill").foregroundStyle(.yellow) }; Spacer(); Button("Directions") { app.openPlaceInMaps(place) }.buttonStyle(.bordered) } } } } }
    private var flights: some View { VStack(alignment: .leading, spacing: 14) { Card(title: "FLIGHT STATUS", symbol: "airplane") { TextField("Flight number, e.g. BA281", text: $app.flightNumber).textInputAutocapitalization(.characters).submitLabel(.search).onSubmit { Task { await app.fetchFlightStatus() } }.textFieldStyle(.roundedBorder); HStack { Button(app.isLoadingFlightStatus ? "Checking…" : "Check status") { Task { await app.fetchFlightStatus() } }.buttonStyle(.borderedProminent).disabled(app.isLoadingFlightStatus); Button("Save flight") { app.addFlight() }.buttonStyle(.bordered) }; Text(app.flightStatusMessage).font(.caption).foregroundStyle(.secondary); if let flight = app.flightStatus { VStack(alignment: .leading, spacing: 7) { Text(flight.flight?.iata ?? flight.flight?.icao ?? "Flight").font(.title3.bold()); Text(flight.airline?.name ?? "Airline not supplied").foregroundStyle(.secondary); StatusRow("Status", flight.flightStatus ?? "Provider has not supplied this information", good: true); StatusRow("Departure", flight.departure?.airport ?? "Provider has not supplied this information", good: true); StatusRow("Arrival", flight.arrival?.airport ?? "Provider has not supplied this information", good: true); if let gate = flight.departure?.gate { StatusRow("Gate", gate, good: true) }; if let delay = flight.departure?.delay { StatusRow("Delay", "\(delay) min", good: delay == 0) } } } }; if !app.flights.isEmpty { Card(title: "SAVED FLIGHTS", symbol: "bookmark.fill") { ForEach(app.flights) { Text("\($0.number) · \($0.departure) → \($0.arrival)") } } }; AircraftPanel() } }
}

private struct SentinelWeatherDashboard: View {
    @EnvironmentObject private var app: SentinelAppModel
    @Binding var section: Int
    @State private var selectedDay: Int?
    @State private var radarFrameIndex = 0
    @State private var radarPlaying = false
    @State private var radarSpeed = 1.0
    @State private var radarOpacity = 0.75
    @State private var radarLoop = false
    @State private var radarRecenterNonce = 0
    @State private var radarWideView = false
    @State private var radarPlaybackTask: Task<Void, Never>?
    private var accent: Color { Color(uiColor: app.accentColor) }
    var body: some View {
        ZStack {
            VStack(alignment: .leading, spacing: 16) {
                Picker("Weather section", selection: $section) { Text("Current & Hourly").tag(0); Text("Weekly").tag(1); Text("Radar").tag(2) }.pickerStyle(.segmented)
                if section == 0 { currentHourly } else if section == 1 { weekly } else { radar }
            }
            if let selectedDay { Color.black.opacity(0.58).ignoresSafeArea().onTapGesture { self.selectedDay = nil }; weeklyDetailPanel(selectedDay) }
        }
        .onChange(of: section) { _, value in
            if value == 2, app.radarMetadata == nil { Task { await app.refreshRadar() } }
            if value != 2 { stopRadarPlayback() }
        }
        .onChange(of: app.radarMetadata?.frames.count) { _, _ in radarFrameIndex = app.radarCurrentFrameIndex }
        .onDisappear { stopRadarPlayback() }
    }
    private var currentHourly: some View {
        Group {
            if let weather = app.weather {
                VStack(alignment: .leading, spacing: 14) {
                    ZStack(alignment: .bottomLeading) {
                        LinearGradient(colors: weatherHeroColours(weather.current.weatherCode), startPoint: .topLeading, endPoint: .bottomTrailing)
                        Image(systemName: weather.symbol).font(.system(size: 132, weight: .thin)).foregroundStyle(.white.opacity(0.11)).offset(x: 215, y: -34)
                        VStack(alignment: .leading, spacing: 10) {
                            HStack { Label(app.weatherDetails?.location.name ?? "Local weather", systemImage: "location.fill").font(.caption.weight(.semibold)); Spacer(); Button { app.refreshWeather() } label: { Image(systemName: "arrow.clockwise").padding(10).background(.white.opacity(0.13), in: Circle()) }.accessibilityLabel("Refresh weather") }
                            Spacer(minLength: 18)
                            Text("\(Int(weather.current.temperature2m))°").font(.system(size: 72, weight: .thin, design: .rounded)).contentTransition(.numericText())
                            Text(weather.conditionName).font(.title2.bold())
                            Text(rainSummary(weather)).font(.subheadline.weight(.medium)).foregroundStyle(.white.opacity(0.82))
                        }.padding(20)
                    }
                    .frame(height: 270).clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 28).stroke(.white.opacity(0.14)))

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        weatherMetric("Feels like", "\(Int(weather.current.apparentTemperature))°", "thermometer.medium")
                        weatherMetric("Wind", "\(Int(weather.current.windSpeed10m)) km/h", "wind")
                        if let details = app.weatherDetails {
                            weatherMetric("Humidity", "\(details.current.humidity)%", "humidity.fill")
                            weatherMetric("Visibility", "\(Int(details.current.visKm)) km", "eye.fill")
                            weatherMetric("UV index", "\(Int(details.current.uv))", "sun.max.fill")
                            weatherMetric("Rain now", String(format: "%.1f mm", details.current.precipMm), "drop.fill")
                        }
                    }
                    Text(app.weatherUpdatedAt.map { "Updated \($0.formatted(date: .omitted, time: .shortened))" } ?? app.weatherStatus).font(.caption).foregroundStyle(.secondary)
                }

                Card(title: "HOURLY FORECAST", symbol: "clock.fill") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(futureHours(weather, limit: 24), id: \.offset) { index, time in
                                VStack(spacing: 8) {
                                    Text(String(time.suffix(5))).font(.caption.weight(.semibold))
                                    Image(systemName: hourlySymbol(index, fallback: weather.current.weatherCode)).font(.title3).foregroundStyle(accent)
                                    Text("\(Int(weather.hourly.temperature2m[index]))°").font(.title3.bold())
                                    Label("\(weather.hourly.precipitationProbability[index])%", systemImage: "drop.fill").font(.caption2.weight(.medium)).foregroundStyle(weather.hourly.precipitationProbability[index] >= 60 ? .blue : .secondary)
                                }
                                .frame(width: 78).padding(.vertical, 12)
                                .background(index == futureHours(weather, limit: 24).first?.offset ? accent.opacity(0.16) : Color.white.opacity(0.065), in: RoundedRectangle(cornerRadius: 17))
                                .overlay(RoundedRectangle(cornerRadius: 17).stroke(index == futureHours(weather, limit: 24).first?.offset ? accent.opacity(0.32) : .clear))
                            }
                        }
                    }
                }
            } else {
                ContentUnavailableView("Weather unavailable", systemImage: "cloud.slash", description: Text(app.weatherStatus))
                Button("Load local weather") { app.refreshWeather() }.buttonStyle(.borderedProminent).tint(accent)
            }
        }
    }
    private var weekly: some View { Group { if let weather = app.weather { Card(title: weather.daily.time.count >= 7 ? "SEVEN-DAY OUTLOOK" : "FORECAST — \(weather.daily.time.count) DAYS AVAILABLE", symbol: "calendar") { ForEach(Array(weather.daily.time.prefix(7).enumerated()), id: \.offset) { index, day in Button { selectedDay = index } label: { HStack { Image(systemName: SentinelWeather.symbol(for: weather.daily.weatherCode[index])).foregroundStyle(accent).frame(width: 28); VStack(alignment: .leading) { Text(day).font(.headline); Text("Tap for forecast details").font(.caption).foregroundStyle(.secondary) }; Spacer(); Text("\(Int(weather.daily.temperature2mMin[index]))°").foregroundStyle(.secondary); Text("\(Int(weather.daily.temperature2mMax[index]))°").bold().foregroundStyle(accent); Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary) }.contentShape(Rectangle()) }.buttonStyle(.plain); if index < min(weather.daily.time.count, 7) - 1 { Divider().overlay(accent.opacity(0.18)) } } } } else { Card(title: "WEEKLY FORECAST", symbol: "calendar") { Text(app.weatherStatus); Button("Refresh weather") { app.refreshWeather() }.buttonStyle(.borderedProminent) } } } }
    private var radar: some View { Card(title: "WEATHER RADAR", symbol: "map.fill") {
        let frames = app.radarMetadata?.frames ?? []
        let frame = frames.indices.contains(radarFrameIndex) ? frames[radarFrameIndex] : nil
        RadarTileMap(tileTemplate: frame?.tileTemplate, centre: app.lastKnownLocation, recenterNonce: radarRecenterNonce, opacity: radarOpacity, wideView: radarWideView)
            .frame(height: 470).clipShape(RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(accent.opacity(0.25)))
            .overlay(alignment: .topLeading) { if let frame { VStack(alignment: .leading, spacing: 2) { Text(radarFrameLabel(frame.date).uppercased()).font(.caption2.bold()).tracking(1); Text(frame.date.formatted(date: .omitted, time: .shortened)).font(.headline) }.padding(.horizontal, 12).padding(.vertical, 9).background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 13)).padding(12) } }
            .overlay(alignment: .bottomTrailing) { Button { radarWideView = false; radarRecenterNonce += 1 } label: { Image(systemName: "location.fill").font(.headline).padding(12).background(.ultraThinMaterial, in: Circle()) }.padding(12).disabled(app.lastKnownLocation == nil).accessibilityLabel("Return to current location") }
        HStack(spacing: 0) {
            radarLegend("None", .clear); radarLegend("Light", .blue); radarLegend("Moderate", .green); radarLegend("Heavy", .yellow); radarLegend("Severe", .red)
        }.padding(8).background(Color.black.opacity(0.28), in: RoundedRectangle(cornerRadius: 13))
        HStack { Label(app.radarMetadata == nil ? "Radar unavailable" : "\(app.radarMetadata?.provider ?? "Radar")", systemImage: "cloud.rain.fill"); Spacer(); Button { radarWideView.toggle(); radarRecenterNonce += 1 } label: { Label(radarWideView ? "Local view" : "Wider UK view", systemImage: radarWideView ? "location.fill" : "globe.europe.africa.fill") }.buttonStyle(.bordered).tint(accent); Button { Task { await app.refreshRadar() } } label: { Image(systemName: "arrow.clockwise") }.buttonStyle(.bordered).tint(accent) }.font(.caption).foregroundStyle(.secondary)
        Text(app.radarStatus).font(.caption).foregroundStyle(app.radarMetadata == nil ? .orange : .secondary)
        if let frame {
            HStack { Button { previousRadarFrame() } label: { Image(systemName: "backward.frame.fill") }.buttonStyle(.bordered); Button { toggleRadarPlayback() } label: { Image(systemName: radarPlaying ? "pause.fill" : "play.fill") }.buttonStyle(.borderedProminent).tint(Color(uiColor: app.accentColor)); Button { nextRadarFrame() } label: { Image(systemName: "forward.frame.fill") }.buttonStyle(.bordered); Button("Now") { Task { await app.refreshRadar(); radarFrameIndex = app.radarCurrentFrameIndex; stopRadarPlayback() } }.buttonStyle(.bordered); Spacer(); VStack(alignment: .trailing) { Text(frame.date.formatted(date: .omitted, time: .shortened)).font(.caption).foregroundStyle(Color(uiColor: app.accentColor)); Text(radarFrameLabel(frame.date)).font(.caption2).foregroundStyle(frame.date <= .now ? .green : .orange) } }
            Slider(value: Binding(get: { Double(radarFrameIndex) }, set: { radarFrameIndex = Int($0.rounded()); stopRadarPlayback() }), in: 0...Double(max(0, frames.count - 1)), step: 1).tint(accent).disabled(frames.count < 2)
            Picker("Playback speed", selection: $radarSpeed) { Text("0.5×").tag(0.5); Text("1×").tag(1.0); Text("2×").tag(2.0) }.pickerStyle(.segmented).onChange(of: radarSpeed) { _, _ in if radarPlaying { startRadarPlayback() } }
            HStack { Picker("Radar opacity", selection: $radarOpacity) { Text("25%").tag(0.25); Text("50%").tag(0.5); Text("75%").tag(0.75); Text("100%").tag(1.0) }.pickerStyle(.segmented); Toggle("Loop", isOn: $radarLoop).font(.caption).fixedSize() }
            Text(app.radarMetadata?.attribution ?? "").font(.caption2).foregroundStyle(.secondary)
        }
        DisclosureGroup("Radar diagnostics") { VStack(alignment: .leading, spacing: 3) { Text("Request: \(SentinelCloud.relayBaseURL)/mobile/services/weather/radar"); Text("Status: \(app.radarHTTPStatus) · Mobile token found: \(KeychainStore.string(for: "mobileServiceAccessToken") == nil ? "No" : "Yes")"); Text("Frames: \(app.radarFrameCount) · Latest: \(app.radarLatestFrame)") }.font(.caption2).foregroundStyle(.secondary).textSelection(.enabled) }.font(.caption2).foregroundStyle(.secondary)
        Text("No colour means no precipitation in the selected frame. Use Wider UK view to see systems approaching your area.").font(.caption2).foregroundStyle(.secondary)
        if let weather = app.weather { VStack(alignment: .leading, spacing: 7) { Text("NEXT 6 HOURS").font(.caption.bold()).foregroundStyle(accent); ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(Array(weather.hourly.time.prefix(6).enumerated()), id: \.offset) { index, time in VStack(spacing: 3) { Text(String(time.suffix(5))).font(.caption2); Image(systemName: weather.symbol).foregroundStyle(accent); Text("\(Int(weather.hourly.temperature2m[index]))°").font(.caption.bold()); Text("\(weather.hourly.precipitationProbability[index])%").font(.caption2).foregroundStyle(.secondary) }.frame(width: 58).padding(6).background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 10)) } } } } }
    } }
    private func weatherMetric(_ title: String, _ value: String, _ symbol: String) -> some View { HStack(spacing: 11) { Image(systemName: symbol).font(.title3).foregroundStyle(accent).frame(width: 27); VStack(alignment: .leading, spacing: 2) { Text(title).font(.caption).foregroundStyle(.secondary); Text(value).font(.headline) }; Spacer() }.padding(13).background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 16)) }
    private func weatherHeroColours(_ code: Int) -> [Color] { switch code { case 0: [Color(red: 0.05, green: 0.38, blue: 0.72), Color(red: 0.08, green: 0.69, blue: 0.88)]; case 45, 48: [Color(red: 0.18, green: 0.25, blue: 0.31), Color(red: 0.35, green: 0.43, blue: 0.48)]; case 51...67, 80...82: [Color(red: 0.04, green: 0.12, blue: 0.24), Color(red: 0.08, green: 0.31, blue: 0.47)]; case 95...99: [Color(red: 0.08, green: 0.05, blue: 0.19), Color(red: 0.28, green: 0.13, blue: 0.40)]; default: [Color(red: 0.08, green: 0.22, blue: 0.38), Color(red: 0.18, green: 0.43, blue: 0.59)] } }
    private func rainSummary(_ weather: SentinelWeather) -> String { let hours = futureHours(weather, limit: 6); guard let wet = hours.first(where: { weather.hourly.precipitationProbability[$0.offset] >= 50 }) else { return "Low chance of rain for the next six hours" }; return "Rain chance reaches \(weather.hourly.precipitationProbability[wet.offset])% around \(String(wet.element.suffix(5)))" }
    private func hourlySymbol(_ index: Int, fallback: Int) -> String { let hours = app.weatherDetails?.forecast.forecastday.flatMap(\.hour) ?? []; guard hours.indices.contains(index) else { return SentinelWeather.symbol(for: fallback) }; return SentinelWeather.symbol(for: SentinelWeather.conditionCode(for: hours[index].condition.text)) }
    private func radarLegend(_ title: String, _ colour: Color) -> some View { VStack(spacing: 4) { RoundedRectangle(cornerRadius: 3).fill(title == "None" ? Color.white.opacity(0.14) : colour).frame(height: 5); Text(title).font(.system(size: 8, weight: .semibold)).foregroundStyle(.secondary) }.frame(maxWidth: .infinity) }
    private func previousRadarFrame() { guard let count = app.radarMetadata?.frames.count, count > 0 else { return }; radarFrameIndex = (radarFrameIndex - 1 + count) % count; stopRadarPlayback() }
    private func radarFrameLabel(_ date: Date) -> String { guard date <= .now else { return "Forecast" }; let minutes = Int(Date().timeIntervalSince(date) / 60); return minutes > 15 ? "Observed · \(minutes)m ago" : "Observed · current" }
    private func nextRadarFrame() { guard let count = app.radarMetadata?.frames.count, count > 0 else { return }; radarFrameIndex = min(radarFrameIndex + 1, count - 1); stopRadarPlayback() }
    private func toggleRadarPlayback() { radarPlaying ? stopRadarPlayback() : startRadarPlayback() }
    private func startRadarPlayback() { guard let count = app.radarMetadata?.frames.count, count > 1 else { return }; radarPlaybackTask?.cancel(); radarPlaying = true; let interval = UInt64((0.6 / radarSpeed) * 1_000_000_000); radarPlaybackTask = Task { while !Task.isCancelled { try? await Task.sleep(nanoseconds: interval); guard !Task.isCancelled else { return }; let shouldStop = await MainActor.run { () -> Bool in if radarFrameIndex >= count - 1 { if radarLoop { radarFrameIndex = 0; return false }; radarPlaying = false; return true }; radarFrameIndex += 1; return false }; if shouldStop { return } } } }
    private func stopRadarPlayback() { radarPlaybackTask?.cancel(); radarPlaybackTask = nil; radarPlaying = false }
    private func futureHours(_ weather: SentinelWeather, limit: Int) -> [(offset: Int, element: String)] { Array(weather.hourly.time.enumerated().filter { weatherDate($0.element) > Date() }.prefix(limit)) }
    private func weatherDate(_ value: String) -> Date { let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_GB"); formatter.timeZone = .current; formatter.dateFormat = "yyyy-MM-dd HH:mm"; return formatter.date(from: value) ?? .distantFuture }
    private func weeklyDetailPanel(_ index: Int) -> some View { Group { if let weather = app.weather, index < weather.daily.time.count { VStack(alignment: .leading, spacing: 12) { HStack { VStack(alignment: .leading, spacing: 2) { Text(weather.daily.time[index]).font(.title3.bold()); Text(SentinelWeather.conditionName(for: weather.daily.weatherCode[index])).foregroundStyle(.secondary) }; Spacer(); Button { selectedDay = nil } label: { Image(systemName: "xmark.circle.fill").font(.title2) }.accessibilityLabel("Close forecast details") }; HStack { Image(systemName: SentinelWeather.symbol(for: weather.daily.weatherCode[index])).font(.system(size: 38)).foregroundStyle(Color(uiColor: app.accentColor)); Text("\(Int(weather.daily.temperature2mMax[index]))°").font(.title.bold()); Text("/ \(Int(weather.daily.temperature2mMin[index]))°").foregroundStyle(.secondary) }; Divider(); Text("HOURLY OUTLOOK").font(.caption.bold()).foregroundStyle(Color(uiColor: app.accentColor)); ScrollView { VStack(spacing: 8) { ForEach(Array(weather.hourly.time.enumerated().filter { $0.element.hasPrefix(weather.daily.time[index]) }), id: \.offset) { hourIndex, time in StatusRow(String(time.suffix(5)), "\(Int(weather.hourly.temperature2m[hourIndex]))° · \(weather.hourly.precipitationProbability[hourIndex])% rain", good: true) } } }.frame(maxHeight: 230) }.padding(20).frame(maxWidth: 330).background(Color(red: 0.05, green: 0.10, blue: 0.14), in: RoundedRectangle(cornerRadius: 24)).overlay(RoundedRectangle(cornerRadius: 24).stroke(Color(uiColor: app.accentColor).opacity(0.35))).shadow(color: .black.opacity(0.5), radius: 22) } } }
    private func legend(_ title: String, _ color: Color) -> some View { HStack(spacing: 3) { Circle().fill(title == "clear" ? Color.white.opacity(0.2) : color).frame(width: 8, height: 8); Text(title) } }
}
private struct WeatherDaySelection: Identifiable { let index: Int; var id: Int { index } }

/// Keeps the base map alive while replacing only the selected RainViewer tile overlay.
private struct RadarTileMap: UIViewRepresentable {
    let tileTemplate: String?
    let centre: CLLocationCoordinate2D?
    let recenterNonce: Int
    let opacity: Double
    let wideView: Bool

    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.mapType = .mutedStandard
        map.overrideUserInterfaceStyle = .dark
        map.isZoomEnabled = true
        map.isScrollEnabled = true
        map.isRotateEnabled = true
        map.isPitchEnabled = false
        map.showsUserLocation = true
        map.setRegion(MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: 51.5072, longitude: -0.1276), span: MKCoordinateSpan(latitudeDelta: 3.0, longitudeDelta: 3.0)), animated: false)
        return map
    }
    func updateUIView(_ map: MKMapView, context: Context) {
        if context.coordinator.tileTemplate != tileTemplate {
            map.removeOverlays(map.overlays)
            context.coordinator.tileTemplate = tileTemplate
            if let tileTemplate {
                let overlay = MKTileOverlay(urlTemplate: tileTemplate)
                overlay.minimumZ = 0
                overlay.maximumZ = 7
                overlay.tileSize = CGSize(width: 256, height: 256)
                overlay.canReplaceMapContent = false
                map.addOverlay(overlay, level: .aboveLabels)
            }
        }
        context.coordinator.opacity = CGFloat(opacity)
        for overlay in map.overlays { if let renderer = map.renderer(for: overlay) as? MKTileOverlayRenderer { renderer.alpha = CGFloat(opacity); renderer.setNeedsDisplay() } }
        if let centre, !context.coordinator.didSetInitialCamera || context.coordinator.recenterNonce != recenterNonce {
            context.coordinator.didSetInitialCamera = true
            context.coordinator.recenterNonce = recenterNonce
            let region: MKCoordinateRegion
            if wideView { region = MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: 54.2, longitude: -2.5), span: MKCoordinateSpan(latitudeDelta: 8.0, longitudeDelta: 10.0)) }
            else { region = MKCoordinateRegion(center: centre, span: MKCoordinateSpan(latitudeDelta: 1.1, longitudeDelta: 1.5)) }
            map.setRegion(region, animated: context.coordinator.recenterNonce != 0)
        }
    }
    final class Coordinator: NSObject, MKMapViewDelegate {
        var tileTemplate: String?
        var recenterNonce = 0
        var didSetInitialCamera = false
        var opacity: CGFloat = 0.75
        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let tileOverlay = overlay as? MKTileOverlay { let renderer = MKTileOverlayRenderer(tileOverlay: tileOverlay); renderer.alpha = opacity; return renderer }
            return MKOverlayRenderer(overlay: overlay)
        }
    }
}

private struct SentinelChatWorkspace: View {
    @EnvironmentObject private var app: SentinelAppModel
    @EnvironmentObject private var live: LiveTalkManager
    @Binding var importingFile: Bool
    @State private var importingChatAttachment = false
    @State private var historyPresented = false
    @State private var renamePresented = false
    @State private var renamedTitle = ""
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var cameraPresented = false
    private var accent: Color { Color(uiColor: app.accentColor) }
    var body: some View {
        VStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                Header(page: .chat)
                Picker("Workspace", selection: Binding(get: { app.chatMode }, set: { app.setChatMode($0) })) { ForEach(SentinelChatMode.allCases) { Text($0.rawValue).tag($0) } }
                    .pickerStyle(.segmented)
            }
            .padding(.horizontal)
            if app.chatMode == .assistant { assistantWorkspace } else { sharingWorkspace }
        }
        .padding(.top, 12)
        .sheet(isPresented: $historyPresented) { ConversationHistorySheet() }
        .alert("Rename conversation", isPresented: $renamePresented) { TextField("Title", text: $renamedTitle); Button("Cancel", role: .cancel) {}; Button("Save") { app.renameConversation(renamedTitle) } }
    }

    private var assistantWorkspace: some View {
        VStack(spacing: 6) {
            HStack(spacing: 8) { VStack(alignment: .leading, spacing: 0) { Text(app.conversationTitle).font(.headline).lineLimit(1); Text("Sentinel AI").font(.caption2).foregroundStyle(.secondary) }; Spacer(); Button { renamedTitle = app.conversationTitle; renamePresented = true } label: { Image(systemName: "pencil") }.buttonStyle(.bordered); Button { historyPresented = true } label: { Image(systemName: "clock.arrow.circlepath") }.buttonStyle(.bordered).accessibilityLabel("Conversation history"); Menu { Button(app.spokenResponses ? "Turn spoken replies off" : "Turn spoken replies on") { app.setSpokenResponses(!app.spokenResponses) }; ShareLink(item: app.conversationExportText) { Label("Export conversation", systemImage: "square.and.arrow.up") }; Button("New conversation") { app.newConversation() }; Button("Clear current conversation", role: .destructive) { app.clearConversation() } } label: { Image(systemName: "ellipsis.circle") }.buttonStyle(.bordered).accessibilityLabel("Conversation options") }.padding(.horizontal)
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        if app.chatMessages.isEmpty {
                            VStack(spacing: 12) {
                                Image(systemName: "sparkles").font(.system(size: 30)).foregroundStyle(accent)
                                Text("How can Sentinel help?").font(.title3.bold())
                                Text("Your conversation is private to this paired Sentinel service.").font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
                                HStack { quickPrompt("Plan my day"); quickPrompt("Summarise a note") }
                            }
                            .frame(maxWidth: .infinity, minHeight: 270)
                            .padding()
                        }
                        ForEach(app.chatMessages) { message in
                            HStack {
                                if message.role == .user { Spacer(minLength: 40) }
                                VStack(alignment: .leading, spacing: 7) {
                                    Text(message.text).font(.body).textSelection(.enabled)
                                    if !message.attachments.isEmpty {
                                        ForEach(message.attachments) { attachment in
                                            Label("\(attachment.name) · \(ByteCountFormatter.string(fromByteCount: Int64(attachment.byteCount), countStyle: .file))", systemImage: attachment.isImage ? "photo" : "doc").font(.caption).foregroundStyle(accent)
                                        }
                                    }
                                    ForEach(message.generatedImages) { image in SentinelGeneratedImageCard(image: image) }
                                }
                                .padding(.horizontal, 14).padding(.vertical, 11)
                                .frame(maxWidth: UIScreen.main.bounds.width * 0.82, alignment: .leading)
                                .background(message.role == .user ? accent.opacity(0.27) : Color.white.opacity(0.10), in: RoundedRectangle(cornerRadius: 18))
                                .overlay(RoundedRectangle(cornerRadius: 18).stroke(message.role == .user ? accent.opacity(0.35) : Color.white.opacity(0.08)))
                                if message.role == .assistant { Spacer(minLength: 40) }
                            }.id(message.id)
                        }
                        if !app.chatCards.isEmpty || !app.chatActions.isEmpty { SentinelStructuredReply() }
                        if app.isSendingChat { HStack(spacing: 10) { ProgressView().tint(accent); Text("Sentinel is thinking…").foregroundStyle(.secondary) }.padding(.vertical, 8) }
                        if let error = app.chatError { VStack(alignment: .leading, spacing: 8) { Label(error, systemImage: "exclamationmark.triangle.fill").font(.caption).foregroundStyle(.orange); Button("Retry") { Task { await app.retryAssistantPrompt() } }.buttonStyle(.bordered).tint(accent) }.padding(12).background(Color.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 14)) }
                        Color.clear.frame(height: 1).id("chat-bottom")
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 4)
                }
                .onChange(of: app.chatMessages.count) { _, _ in withAnimation { proxy.scrollTo("chat-bottom", anchor: .bottom) } }
                .onChange(of: app.isSendingChat) { _, _ in withAnimation { proxy.scrollTo("chat-bottom", anchor: .bottom) } }
            }
        }
        .frame(maxHeight: .infinity)
        .safeAreaInset(edge: .bottom, spacing: 0) { composer.background(.ultraThinMaterial) }
        .fileImporter(isPresented: $importingChatAttachment, allowedContentTypes: [.jpeg, .png, .pdf, .plainText, .commaSeparatedText, .json, UTType(filenameExtension: "webp") ?? .data, UTType(filenameExtension: "gif") ?? .data, UTType(filenameExtension: "md") ?? .plainText], allowsMultipleSelection: true) { result in
            guard case let .success(urls) = result else { return }
            for url in urls {
                let access = url.startAccessingSecurityScopedResource(); defer { if access { url.stopAccessingSecurityScopedResource() } }
                guard let data = try? Data(contentsOf: url) else { continue }
                let type = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
                if let error = app.addChatAttachment(data: data, name: url.lastPathComponent, mimeType: type) { app.showChatError(error) }
            }
        }
        .onChange(of: selectedPhoto) { _, item in Task { guard let item, let data = try? await item.loadTransferable(type: Data.self) else { return }; _ = app.addChatAttachment(data: data, name: "Photo.jpg", mimeType: "image/jpeg"); selectedPhoto = nil } }
        .sheet(isPresented: $cameraPresented) { SentinelCameraPicker { image in if let data = image.jpegData(compressionQuality: 0.82) { _ = app.addChatAttachment(data: data, name: "Camera photo.jpg", mimeType: "image/jpeg") }; cameraPresented = false } }
    }

    private var composer: some View {
        VStack(spacing: 8) {
            if !app.chatAttachments.isEmpty { ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(app.chatAttachments) { attachment in HStack(spacing: 6) { Image(systemName: attachment.isImage ? "photo.fill" : "doc.fill").foregroundStyle(accent); VStack(alignment: .leading, spacing: 1) { Text(attachment.name).lineLimit(1).font(.caption); Text(ByteCountFormatter.string(fromByteCount: Int64(attachment.byteCount), countStyle: .file)).font(.caption2).foregroundStyle(.secondary) }; Button { app.removeChatAttachment(attachment) } label: { Image(systemName: "xmark.circle.fill") }.foregroundStyle(.secondary) }.padding(8).frame(maxWidth: 200).background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12)) } } } }
            HStack(alignment: .bottom, spacing: 10) {
                Menu { Button { importingChatAttachment = true } label: { Label("Choose file", systemImage: "folder") }; Button { cameraPresented = true } label: { Label("Take photo", systemImage: "camera") }; PhotosPicker(selection: $selectedPhoto, matching: .images) { Label("Photo library", systemImage: "photo.on.rectangle") } } label: { Image(systemName: "plus.circle.fill").font(.system(size: 31)) }.tint(accent).disabled(app.isSendingChat).accessibilityLabel("Add attachment")
                TextField("Message Sentinel…", text: $app.chatDraft, axis: .vertical).lineLimit(1...5).padding(11).background(Color.black.opacity(0.42), in: RoundedRectangle(cornerRadius: 16))
                Button { app.toggleVoiceChat() } label: { Image(systemName: app.voiceStatus == "Listening…" ? "waveform.circle.fill" : "mic.circle.fill").font(.system(size: 30)) }.buttonStyle(.plain).foregroundStyle(accent).disabled(app.isSendingChat)
                Button { live.open(conversationId: app.conversationID, enabledServices: app.enabledMobileServices.sorted()) } label: { Image(systemName: "waveform.badge.mic").font(.system(size: 25)) }.buttonStyle(.plain).foregroundStyle(accent).accessibilityLabel("Talk with Sentinel")
                Button { Task { await app.submitAssistantPrompt() } } label: { Image(systemName: app.isSendingChat ? "hourglass" : "arrow.up.circle.fill").font(.system(size: 34)) }.disabled((app.chatDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && app.chatAttachments.isEmpty) || app.isSendingChat)
            }
        }
        .padding(.horizontal)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    private func quickPrompt(_ prompt: String) -> some View { Button(prompt) { app.chatDraft = prompt; Task { await app.submitAssistantPrompt() } }.buttonStyle(.bordered).tint(accent).font(.caption) }
    private var sharingWorkspace: some View { ScrollView { VStack(alignment: .leading, spacing: 16) { Card(title: "COMPANION SYNC", symbol: "link.badge.plus") { Text("Securely share notes and files with your paired Sentinel desktop.").font(.caption).foregroundStyle(.secondary); TextField("Type shared text…", text: $app.clipboardText, axis: .vertical).lineLimit(2...5).textFieldStyle(.roundedBorder); HStack { Button("Send text") { Task { await app.sendClipboard() } }.buttonStyle(.borderedProminent).tint(accent); Button("Send file") { importingFile = true }.buttonStyle(.bordered).tint(accent) }; if !app.desktopClipboardText.isEmpty { Divider(); Text("FROM DESKTOP").font(.caption2.bold()).foregroundStyle(accent); Text(app.desktopClipboardText).font(.subheadline).lineLimit(4); Button("Copy to iPhone") { app.copyDesktopClipboardToPhone() }.buttonStyle(.bordered) } }; Card(title: "SHARED FILES", symbol: "folder.fill") { HStack { Text(app.remoteFiles.isEmpty ? "No files received yet." : "\(app.remoteFiles.count) shared file\(app.remoteFiles.count == 1 ? "" : "s")").foregroundStyle(.secondary); Spacer(); Button { Task { await app.refreshCompanionWorkspace() } } label: { Label("Refresh", systemImage: "arrow.clockwise") }.buttonStyle(.bordered).tint(accent) }; ForEach(app.remoteFiles) { file in HStack(spacing: 12) { Image(systemName: "doc.fill").foregroundStyle(accent); VStack(alignment: .leading) { Text(file.name).lineLimit(1); if let bytes = file.byteCount { Text(ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)).font(.caption).foregroundStyle(.secondary) } }; Spacer(); Button(role: .destructive) { Task { await app.deleteRemoteFile(file) } } label: { Image(systemName: "trash") } } } } }.padding(.horizontal) } }
}

private struct SentinelGeneratedImageCard: View {
    @EnvironmentObject private var app: SentinelAppModel
    let image: SentinelGeneratedImage
    @State private var isPresented = false
    private var uiImage: UIImage? { guard let url = image.fileURL, let data = try? Data(contentsOf: url) else { return nil }; return UIImage(data: data) }
    var body: some View {
        if let uiImage {
            VStack(alignment: .leading, spacing: 8) {
                Button { isPresented = true } label: {
                    Image(uiImage: uiImage).resizable().scaledToFit().clipShape(RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(uiColor: app.accentColor).opacity(0.25)))
                }.buttonStyle(.plain).accessibilityLabel("Open generated image")
                HStack {
                    Label("Generated by Sentinel", systemImage: "sparkles").font(.caption).foregroundStyle(Color(uiColor: app.accentColor))
                    Spacer()
                    if let url = image.fileURL { ShareLink(item: url) { Label("Share", systemImage: "square.and.arrow.up").font(.caption) } }
                }
            }
            .sheet(isPresented: $isPresented) {
                NavigationStack {
                    ZStack { Color.black.ignoresSafeArea(); Image(uiImage: uiImage).resizable().scaledToFit().padding() }
                        .navigationTitle("Sentinel Image").navigationBarTitleDisplayMode(.inline)
                        .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Done") { isPresented = false } }; if let url = image.fileURL { ToolbarItem(placement: .topBarTrailing) { ShareLink(item: url) { Image(systemName: "square.and.arrow.up") } } } }
                }.preferredColorScheme(.dark)
            }
        } else {
            Label("Generated image is no longer available", systemImage: "photo.badge.exclamationmark").font(.caption).foregroundStyle(.secondary)
        }
    }
}

private struct TalkWithSentinelView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var app: SentinelAppModel
    @EnvironmentObject private var live: LiveTalkManager
    var body: some View { ZStack { LinearGradient(colors: [Color.black, Color(red: 0.01, green: 0.12, blue: 0.17)], startPoint: .top, endPoint: .bottom).ignoresSafeArea(); VStack(spacing: 20) { HStack { Button { live.minimise(); dismiss() } label: { Image(systemName: "chevron.down.circle.fill").font(.title2) }; Spacer(); Text("Talk with Sentinel").font(.title2.bold()); Spacer(); Color.clear.frame(width: 28) }; Image(systemName: live.state == .speaking ? "waveform.circle.fill" : "waveform.badge.mic").font(.system(size: 60)).foregroundStyle(Color(uiColor: app.accentColor)); Text(live.status).foregroundStyle(.secondary); ScrollView { VStack(alignment: .leading, spacing: 8) { ForEach(Array(live.transcript.enumerated()), id: \.offset) { _, line in Text(line).padding(10).background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12)) } }.frame(maxWidth: .infinity, alignment: .leading) }.frame(maxHeight: .infinity); HStack { Button(live.state == .muted ? "Unmute" : "Mute") { live.toggleMute() }.buttonStyle(.bordered); Button("Interrupt") { live.interrupt() }.buttonStyle(.bordered); Button("Reconnect") { Task { live.end(); await live.begin(conversationId: app.conversationID, enabledServices: app.enabledMobileServices.sorted()) } }.buttonStyle(.borderedProminent).tint(Color(uiColor: app.accentColor)); Button("End", role: .destructive) { live.end(); dismiss() }.buttonStyle(.bordered) } }.padding() } }
}

private struct SentinelStructuredReply: View {
    @EnvironmentObject private var app: SentinelAppModel
    private var accent: Color { Color(uiColor: app.accentColor) }
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !app.chatCards.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack { ForEach(app.chatCards) { card in
                        VStack(alignment: .leading, spacing: 5) {
                            Label(card.type.capitalized, systemImage: icon(for: card.type)).font(.caption.bold()).foregroundStyle(accent)
                            if let title = card.title { Text(title).font(.headline) }
                            if let subtitle = card.subtitle { Text(subtitle).font(.caption).foregroundStyle(.secondary) }
                            if let value = card.value, !value.isEmpty { Text(value).font(.title3.bold()).foregroundStyle(accent) }
                            if let detail = card.detail { Text(detail).font(.caption).foregroundStyle(.secondary) }
                            if app.chatVerifiedAt != nil { Label("Live information verified", systemImage: "checkmark.seal.fill").font(.caption2).foregroundStyle(.green) }
                        }.frame(width: 205, alignment: .leading).padding(12).background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(accent.opacity(0.2)))
                    } }
                }
            }
            if !app.chatActions.isEmpty { HStack { ForEach(app.chatActions) { action in Button(action.label ?? "Open") { app.runChatAction(action) }.buttonStyle(.bordered).tint(accent) } } }
        }.padding(.vertical, 4)
    }
    private func icon(for type: String) -> String { type == "weather" ? "cloud.sun.fill" : type == "flight" ? "airplane" : "info.circle.fill" }
}

private struct ConversationHistorySheet: View {
    @EnvironmentObject private var app: SentinelAppModel
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var includeArchived = false
    @State private var confirmingDelete: SentinelConversation?
    private var conversations: [SentinelConversation] { app.conversations.filter { (includeArchived || !$0.isArchived) && (query.isEmpty || $0.title.localizedCaseInsensitiveContains(query) || $0.preview.localizedCaseInsensitiveContains(query)) }.sorted { ($0.isPinned ? 1 : 0, $0.updatedAt) > ($1.isPinned ? 1 : 0, $1.updatedAt) } }
    var body: some View { NavigationStack { List { Toggle("Show archived", isOn: $includeArchived); ForEach(conversations) { conversation in Button { app.selectConversation(conversation); dismiss() } label: { VStack(alignment: .leading, spacing: 4) { HStack { Text(conversation.title).font(.headline); if conversation.isPinned { Image(systemName: "pin.fill").foregroundStyle(Color(uiColor: app.accentColor)) } }; Text(conversation.preview).lineLimit(2).font(.caption).foregroundStyle(.secondary); Text("Updated \(conversation.updatedAt, style: .relative)").font(.caption2).foregroundStyle(.secondary) } }.contextMenu { Button(conversation.isPinned ? "Unpin" : "Pin") { app.toggleConversationPin(conversation) }; Button(conversation.isArchived ? "Restore" : "Archive") { app.toggleConversationArchive(conversation) }; Button("Delete", role: .destructive) { confirmingDelete = conversation } } } }.searchable(text: $query, prompt: "Search conversations").navigationTitle("Conversation Memory").toolbar { ToolbarItem(placement: .topBarLeading) { Button("Done") { dismiss() } }; ToolbarItem(placement: .topBarTrailing) { Button { app.newConversation(); dismiss() } label: { Image(systemName: "square.and.pencil") } } }.alert("Delete conversation?", isPresented: Binding(get: { confirmingDelete != nil }, set: { if !$0 { confirmingDelete = nil } })) { Button("Cancel", role: .cancel) {}; Button("Delete", role: .destructive) { if let conversation = confirmingDelete { app.deleteConversation(conversation) }; confirmingDelete = nil } } message: { Text("This removes the local conversation and its stored attachment data from Sentinel.") } }.preferredColorScheme(.dark) }
}

private struct SentinelCameraPicker: UIViewControllerRepresentable {
    let completion: (UIImage) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(completion: completion) }
    func makeUIViewController(context: Context) -> UIImagePickerController { let picker = UIImagePickerController(); picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary; picker.delegate = context.coordinator; return picker }
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate { let completion: (UIImage) -> Void; init(completion: @escaping (UIImage) -> Void) { self.completion = completion }; func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) { if let image = info[.originalImage] as? UIImage { completion(image) } }; func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { picker.dismiss(animated: true) } }
}

private struct HomeHero: View {
    @EnvironmentObject private var app: SentinelAppModel
    private var accent: Color { Color(uiColor: app.accentColor) }
    private var greeting: String { let hour = Calendar.current.component(.hour, from: .now); return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening" }
    var body: some View {
        VStack(spacing: 10) {
            HStack(alignment: .firstTextBaseline) { VStack(alignment: .leading, spacing: 2) { Text(greeting).font(.title2.weight(.semibold)); Text(app.cloudOnline ? "Sentinel is ready" : "Sentinel is standing by").font(.subheadline).foregroundStyle(.secondary) }; Spacer(); Label(app.cloudOnline ? "ONLINE" : "OFFLINE", systemImage: "circle.fill").font(.caption.bold()).foregroundStyle(app.cloudOnline ? .green : .orange) }
            SentinelReactorView(state: app.isSendingChat ? .thinking : (app.cloudOnline ? .online : .offline), accent: accent, animation: app.reactorAnimation).frame(height: 292).accessibilityLabel("Sentinel reactor: \(app.cloudOnline ? "online" : "offline")")
            HStack(spacing: 0) { statusItem("bolt.fill", "SERVICES", app.mobileAccessStatus == "Independent access" ? "Independent" : app.mobileAccessStatus); Divider().frame(height: 30); statusItem("link", "SYNC", app.companionPaired ? "Paired" : "Offline"); Divider().frame(height: 30); statusItem("number", "VERSION", app.nativeVersion) }.padding(.vertical, 10).background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(accent.opacity(0.16)))
        }.padding(.top, 2)
    }
    private func statusItem(_ icon: String, _ label: String, _ value: String) -> some View { HStack(spacing: 6) { Image(systemName: icon).font(.caption).foregroundStyle(accent); VStack(alignment: .leading, spacing: 1) { Text(label).font(.system(size: 9, weight: .bold)).foregroundStyle(.secondary); Text(value).font(.caption.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.72) } }.frame(maxWidth: .infinity, alignment: .center).padding(.horizontal, 7) }
}

private struct SentinelReactorView: View {
    enum ReactorState { case offline, online, thinking }
    let state: ReactorState
    let accent: Color
    let animation: SentinelReactorAnimation
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        TimelineView(.animation(minimumInterval: animation == .full ? 1.0 / 30.0 : 1.0 / 12.0, paused: animation == .off || reduceMotion || scenePhase != .active)) { timeline in
            GeometryReader { geometry in
                let size = min(geometry.size.width, geometry.size.height)
                let time = timeline.date.timeIntervalSinceReferenceDate
                let motion = state == .thinking ? time * 1.25 : time * 0.30
                ZStack {
                    Circle().fill(RadialGradient(colors: [accent.opacity(state == .offline ? 0.05 : 0.27), accent.opacity(0.05), .clear], center: .center, startRadius: 8, endRadius: size * 0.50)).frame(width: size, height: size)
                    hudGrid(size: size)
                    ReactorSegmentRing(size: size * 0.94, segments: 48, accent: accent, rotation: motion * 13, opacity: state == .offline ? 0.25 : 0.62)
                    ReactorRing(size: size * 0.79, segments: 8, accent: accent, rotation: motion * 24, reverse: false, thickness: 2.2)
                    ReactorRing(size: size * 0.63, segments: 5, accent: accent, rotation: motion * 39, reverse: true, thickness: 4.5)
                    ReactorSegmentRing(size: size * 0.48, segments: 18, accent: accent, rotation: -motion * 46, opacity: 0.82)
                    OrbitingStatusNode(size: size * 0.79, angle: motion * 24 + 28, accent: accent)
                    OrbitingStatusNode(size: size * 0.63, angle: -motion * 39 + 205, accent: accent)
                    ReactorCore(size: size * 0.30, accent: accent, active: state != .offline)
                }.frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .overlay(alignment: .bottom) { Label(state == .offline ? "STANDBY" : "ONLINE", systemImage: "circle.fill").font(.caption2.bold()).tracking(1.6).foregroundStyle(state == .offline ? .secondary : accent).padding(.bottom, 2) }
    }
    private func hudGrid(size: CGFloat) -> some View { ZStack { ForEach(0..<3, id: \.self) { index in Circle().stroke(accent.opacity(0.08), lineWidth: 1).frame(width: size * (0.32 + CGFloat(index) * 0.22), height: size * (0.32 + CGFloat(index) * 0.22)) }; ForEach(0..<8, id: \.self) { index in Capsule().fill(accent.opacity(0.08)).frame(width: 1, height: size * 0.86).rotationEffect(.degrees(Double(index) * 22.5)) } } }
}

private struct ReactorRing: View { let size: CGFloat; let segments: Int; let accent: Color; let rotation: Double; let reverse: Bool; let thickness: CGFloat; var body: some View { ZStack { ForEach(0..<segments, id: \.self) { item in Circle().trim(from: 0.025, to: 0.105).stroke(accent.opacity(0.86), style: StrokeStyle(lineWidth: thickness, lineCap: .butt)).rotationEffect(.degrees(Double(item) * 360 / Double(segments))) } }.frame(width: size, height: size).rotationEffect(.degrees(reverse ? -rotation : rotation)) } }
private struct ReactorSegmentRing: View { let size: CGFloat; let segments: Int; let accent: Color; let rotation: Double; let opacity: Double; var body: some View { ZStack { ForEach(0..<segments, id: \.self) { item in Capsule().fill(accent.opacity(item.isMultiple(of: 6) ? opacity : opacity * 0.45)).frame(width: 1.5, height: item.isMultiple(of: 6) ? 10 : 5).offset(y: -size / 2).rotationEffect(.degrees(Double(item) * 360 / Double(segments))) } }.frame(width: size, height: size).rotationEffect(.degrees(rotation)) } }
private struct OrbitingStatusNode: View { let size: CGFloat; let angle: Double; let accent: Color; var body: some View { Circle().fill(Color.white).frame(width: 6, height: 6).shadow(color: accent, radius: 7).overlay(Circle().stroke(accent, lineWidth: 2).frame(width: 13, height: 13)).offset(y: -size / 2).rotationEffect(.degrees(angle)) } }
private struct ReactorCore: View { let size: CGFloat; let accent: Color; let active: Bool; var body: some View { ZStack { Circle().fill(RadialGradient(colors: [.white.opacity(active ? 0.95 : 0.35), accent.opacity(active ? 0.92 : 0.30), .clear], center: .center, startRadius: 0, endRadius: size / 2)).frame(width: size, height: size).shadow(color: accent.opacity(active ? 0.85 : 0.15), radius: 20); Image(systemName: "s.circle.fill").font(.system(size: size * 0.54, weight: .medium)).foregroundStyle(Color.white.opacity(active ? 0.94 : 0.48)) } } }

private struct HomeWeatherCard: View { let weather: SentinelWeather; let location: String?; let updatedAt: Date?; @EnvironmentObject private var app: SentinelAppModel; var body: some View { let accent = Color(uiColor: app.accentColor); HStack(spacing: 14) { Image(systemName: weather.symbol).font(.system(size: 33)).foregroundStyle(accent).frame(width: 42); Text("\(Int(weather.current.temperature2m))°").font(.system(size: 45, weight: .bold, design: .rounded)); VStack(alignment: .leading, spacing: 3) { Text(location ?? "Local weather").font(.caption.weight(.semibold)).foregroundStyle(.secondary); Text(weather.conditionName).font(.headline); Text("Feels \(Int(weather.current.apparentTemperature))° · Wind \(Int(weather.current.windSpeed10m)) km/h").font(.caption).foregroundStyle(.secondary); if let updatedAt { Text("Updated \(updatedAt, style: .relative)").font(.caption2).foregroundStyle(.secondary) } }; Spacer(minLength: 0); Image(systemName: "chevron.right.circle.fill").foregroundStyle(accent).font(.title3) }.padding(16).background(Color.white.opacity(0.075), in: RoundedRectangle(cornerRadius: 20)).overlay(RoundedRectangle(cornerRadius: 20).stroke(accent.opacity(0.18))) } }

private struct HomeAction: View { let page: SentinelPage; let subtitle: String; @EnvironmentObject private var app: SentinelAppModel; var body: some View { let accent = Color(uiColor: app.accentColor); HStack(spacing: 10) { Image(systemName: page.symbol).font(.title3).foregroundStyle(accent); VStack(alignment: .leading, spacing: 2) { Text(page.rawValue).font(.headline); Text(subtitle).font(.caption2).foregroundStyle(.secondary).lineLimit(1) }; Spacer(); Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(accent.opacity(0.7)) }.padding(14).frame(maxWidth: .infinity, alignment: .leading).background(accent.opacity(0.10), in: RoundedRectangle(cornerRadius: 19)).overlay(RoundedRectangle(cornerRadius: 19).stroke(accent.opacity(0.18))) } }
private struct AircraftPanel: View {
    @EnvironmentObject private var app: SentinelAppModel
    @State private var query = ""
    var filtered: [SentinelAircraft] { app.aircraft.filter { query.isEmpty || $0.callsign.localizedCaseInsensitiveContains(query) || $0.icao24.localizedCaseInsensitiveContains(query) }.prefix(80).map { $0 } }
    var body: some View { let accent = Color(uiColor: app.accentColor); Card(title: "LIVE AIRCRAFT", symbol: "airplane.circle.fill") { HStack { TextField("Callsign or ICAO24", text: $query).textFieldStyle(.roundedBorder); Button { Task { await app.fetchAircraft() } } label: { Image(systemName: "arrow.clockwise") }.buttonStyle(.bordered).tint(accent) }; Text(app.aircraftStatus).font(.caption).foregroundStyle(.secondary); if !filtered.isEmpty { Map { ForEach(filtered) { aircraft in Annotation(aircraft.callsign, coordinate: CLLocationCoordinate2D(latitude: aircraft.latitude, longitude: aircraft.longitude)) { Image(systemName: "airplane").font(.caption).foregroundStyle(aircraft.onGround ? .orange : accent).rotationEffect(.degrees(aircraft.heading ?? 0)) } } }.frame(height: 260).clipShape(RoundedRectangle(cornerRadius: 16)); ForEach(filtered.prefix(8)) { aircraft in HStack { Text(aircraft.callsign).font(.headline); Spacer(); Text(aircraft.onGround ? "On ground" : "\(aircraft.altitudeFeet.map { "\($0) ft" } ?? "Altitude unavailable")").font(.caption).foregroundStyle(.secondary) } } } } }
}
private struct Header: View { let page: SentinelPage; @EnvironmentObject private var app: SentinelAppModel; var body: some View { let accent = Color(uiColor: app.accentColor); HStack { Image(systemName: page.symbol).font(.title2).foregroundStyle(accent); VStack(alignment: .leading) { Text(page.rawValue.uppercased()).font(.caption.bold()).tracking(1.4).foregroundStyle(accent); Text(page == .home ? "Your mobile command centre" : "Sentinel mobile").font(.caption).foregroundStyle(.secondary) }; Spacer() } } }
private struct Card<Content: View>: View { let title: String; let symbol: String; @EnvironmentObject private var app: SentinelAppModel; @ViewBuilder let content: Content; var body: some View { let accent = Color(uiColor: app.accentColor); VStack(alignment: .leading, spacing: 12) { Label(title, systemImage: symbol).font(.caption.bold()).tracking(1).foregroundStyle(accent); content }.frame(maxWidth: .infinity, alignment: .leading).padding(16).background(Color.white.opacity(0.075), in: RoundedRectangle(cornerRadius: 20)).overlay(RoundedRectangle(cornerRadius: 20).stroke(accent.opacity(0.18))) } }
private struct StatusRow: View { let label: String; let value: String; let good: Bool; init(_ label: String, _ value: String, good: Bool) { self.label = label; self.value = value; self.good = good }; var body: some View { HStack { Text(label); Spacer(); Text(value).foregroundStyle(good ? .green : .orange).multilineTextAlignment(.trailing) }.font(.subheadline) } }
private struct SentinelLockView: View { @EnvironmentObject private var app: SentinelAppModel; var body: some View { let accent = Color(uiColor: app.accentColor); ZStack { Color.black.opacity(0.96).ignoresSafeArea(); VStack(spacing: 20) { Image(systemName: "lock.shield.fill").font(.system(size: 54)).foregroundStyle(accent); Text("Sentinel Locked").font(.title2.bold()); Button("Unlock") { Task { await app.unlock() } }.buttonStyle(.borderedProminent).tint(accent) } } } }

private struct SentinelMobileHelpView: View {
    private struct HelpSection: Identifiable {
        let id = UUID()
        let title: String
        let detail: String
    }
    @Environment(\.dismiss) private var dismiss
    private let sections = [
        HelpSection(title: "Chat and images", detail: "Ask Sentinel normally, attach a file or photo with the plus button, or request an image in plain English. Generated images stay with the conversation; tap one for full-screen viewing and use Share to save or send it. Use History to reopen an earlier conversation."),
        HelpSection(title: "Voice", detail: "The microphone sends one dictated message. Talk with Sentinel starts a live conversation; minimise its panel to move around without ending the session. You can ask Live Talk to open Home, Chat, Navigation, Travel, Weather, Notifications, Settings or System."),
        HelpSection(title: "Weather and navigation", detail: "Weather uses the current location and approved mobile service access. Navigation can search nearby places, calculate a route and hand the journey to Apple Maps."),
        HelpSection(title: "Travel", detail: "Save journeys and flights, review destination information, and keep readiness items together. Confirm important details with the airline or official travel guidance."),
        HelpSection(title: "Desktop sync", detail: "Pair using the six-digit code from Sentinel Personal. Mobile service permissions are separate and never copy raw provider keys to the iPhone."),
        HelpSection(title: "Updates and privacy", detail: "Native app updates arrive through TestFlight or the App Store. Sentinel content updates are checked separately. Face ID and iOS permissions remain under your control."),
    ]
    var body: some View {
        NavigationStack {
            List(sections) { section in
                VStack(alignment: .leading, spacing: 6) {
                    Text(section.title).font(.headline)
                    Text(section.detail).font(.subheadline).foregroundStyle(.secondary)
                }.padding(.vertical, 5)
            }
            .navigationTitle("How to use Sentinel")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }.preferredColorScheme(.dark)
    }
}
