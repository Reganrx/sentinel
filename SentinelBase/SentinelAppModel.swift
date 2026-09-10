import Foundation
import UIKit
import Network
import MapKit
import CoreLocation
import LocalAuthentication
import Speech
import AVFoundation

@MainActor
final class SentinelAppModel: NSObject, ObservableObject, @preconcurrency CLLocationManagerDelegate {
    @Published var selected: SentinelPage = .home
    @Published var cloudOnline = false
    @Published var update: SentinelRelease?
    @Published private(set) var contentVersion: String
    @Published private(set) var isInstallingContent = false
    let nativeVersion: String

    @Published var pairingCode = ""
    @Published var pairingStatus = "Not paired"
    @Published var companionPaired = false
    @Published private(set) var companionLastSyncedAt: Date?

    @Published var status = "Starting Sentinel…"
    @Published var clipboardText = ""
    @Published private(set) var desktopClipboardText = ""
    @Published private(set) var remoteFiles: [SentinelRemoteFile] = []
    @Published private(set) var isRefreshingCompanionWorkspace = false

    @Published var chatMode: SentinelChatMode
    @Published var chatDraft = ""
    @Published private(set) var chatMessages: [SentinelChatMessage] = []
    @Published private(set) var conversationID: UUID
    @Published private(set) var conversations: [SentinelConversation] = []
    @Published private(set) var conversationTitle = "New conversation"
    @Published private(set) var isSendingChat = false
    @Published private(set) var chatError: String?
    @Published private(set) var chatAttachments: [SentinelChatAttachment] = []
    @Published private(set) var chatActions: [SentinelChatAction] = []
    @Published private(set) var chatCards: [SentinelChatCard] = []
    @Published private(set) var chatVerifiedAt: String?
    @Published private(set) var voiceStatus = ""
    @Published var spokenResponses: Bool
    @Published var accentTheme: SentinelAccentTheme
    @Published var reactorAnimation: SentinelReactorAnimation
    @Published var transfer: SentinelTransfer?

    @Published var networkStatus = "Checking network…"
    @Published var localNetworkAvailable = false

    @Published private(set) var activity: [SentinelActivity] = []
    @Published var showUnreadOnly = false

    @Published var mapSearch = ""
    @Published var mapStatus = "Search for a destination to open it in Apple Maps."
    @Published private(set) var placeResults: [SentinelPlaceResult] = []
    @Published var journeyDestination = ""
    @Published var journeyMode: SentinelJourneyMode = .driving
    @Published private(set) var journeyRoute: MKRoute?
    @Published private(set) var journeyDestinationItem: MKMapItem?
    @Published private(set) var journeyStatus = "Choose a destination to prepare a journey."
    @Published private(set) var isPlanningJourney = false
    @Published private(set) var savedPlaces: [SentinelSavedPlace] = []

    @Published var tripTitle = ""
    @Published var tripDate = Date()
    @Published var tripNotes = ""
    @Published private(set) var trips: [SentinelTrip] = []

    @Published var flightNumber = ""
    @Published var departureAirport = ""
    @Published var arrivalAirport = ""
    @Published var flightDate = Date()
    @Published var flightTerminal = ""
    @Published private(set) var flights: [SentinelFlight] = []
    @Published private(set) var flightStatus: SentinelAviationFlight?
    @Published private(set) var flightStatusMessage = "Search a flight number for live status."
    @Published private(set) var isLoadingFlightStatus = false
    @Published private(set) var aircraft: [SentinelAircraft] = []
    @Published private(set) var aircraftStatus = "Refresh to load nearby live aircraft."

    @Published private(set) var travelReadiness: Set<String> = []
    @Published private(set) var savedSearches: [String] = []

    @Published var weather: SentinelWeather?
    @Published private(set) var weatherDetails: SentinelWeatherAPIResponse?
    @Published var weatherStatus = "Request your location to load local conditions."
    @Published private(set) var weatherUpdatedAt: Date?
    @Published private(set) var radarMetadata: SentinelRadarMetadata?
    @Published private(set) var radarStatus = "Live radar is not configured for this Sentinel service."
    @Published private(set) var radarHTTPStatus = "Not requested"
    @Published private(set) var radarFrameCount = 0
    @Published private(set) var radarLatestFrame = "—"
    @Published private(set) var radarCurrentFrameIndex = 0
    @Published private(set) var lastKnownLocation: CLLocationCoordinate2D?

    @Published private(set) var appLockEnabled: Bool
    @Published private(set) var isLocked: Bool
    @Published private(set) var lockStatus = ""
    @Published private(set) var isAuthenticating = false

    @Published private(set) var visiblePageNames: Set<String>
    @Published private(set) var localSystem: SentinelLocalSystem

    @Published var showMobileAccessConsent = false
    @Published private(set) var availableMobileServices: Set<String>
    @Published private(set) var enabledMobileServices: Set<String>
    @Published private(set) var mobileAccessStatus = "Desktop required"
    @Published private(set) var mobileServiceStatus: SentinelMobileStatus?
    @Published private(set) var mobileServiceDiagnostics = "Not checked yet"
    @Published private(set) var mobileServicesCheckedAt: Date?
    @Published private(set) var isCheckingMobileServices = false
    @Published private(set) var desktopActionStatus = "No desktop request sent."
    @Published private(set) var desktopActionCommandID: String?

    private let cloud = SentinelCloud()
    private var reconnectTask: Task<Void, Never>?
    private let pathMonitor = NWPathMonitor()
    private let pathMonitorQueue = DispatchQueue(label: "uk.co.sentinel.base.network")
    private var monitoringNetwork = false
    private let locationManager = CLLocationManager()
    private let weatherService = SentinelWeatherService()
    private var loadingWeather = false
    private var lastCompanionConnection: CompanionConnection?
    private var currentLocation: CLLocationCoordinate2D?
    private var chatLocationContinuation: CheckedContinuation<CLLocationCoordinate2D?, Never>?
    private var chatLocationTimeout: Task<Void, Never>?
    private var backgroundedAt: Date?
    private let voiceInput = SentinelVoiceInput()
    private let conversationRepository = ConversationRepository()
    private let speechSynthesizer = AVSpeechSynthesizer()

    override init() {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "0.0.0"
        let build = info?["CFBundleVersion"] as? String ?? "0"

        nativeVersion = "v\(version) (\(build))"
        conversationID = UUID(uuidString: UserDefaults.standard.string(forKey: "sentinelConversationID") ?? "") ?? UUID()

        contentVersion =
            UserDefaults.standard.string(forKey: "sentinelContentVersion")
            ?? "0.0.0"

        companionLastSyncedAt =
            UserDefaults.standard.object(forKey: "sentinelCompanionLastSyncedAt")
            as? Date

        appLockEnabled =
            UserDefaults.standard.bool(forKey: "sentinelAppLockEnabled")

        spokenResponses = UserDefaults.standard.bool(forKey: "sentinelSpokenResponses")
        accentTheme = SentinelAccentTheme(rawValue: UserDefaults.standard.string(forKey: "sentinelAccentTheme") ?? "") ?? .sentinelBlue
        reactorAnimation = SentinelReactorAnimation(rawValue: UserDefaults.standard.string(forKey: "sentinelReactorAnimation") ?? "") ?? .balanced

        isLocked =
            UserDefaults.standard.bool(forKey: "sentinelAppLockEnabled")

        var initialVisiblePageNames = Set(
            UserDefaults.standard.stringArray(forKey: "sentinelVisiblePages")
            ?? SentinelPage.corePages.map(\.rawValue)
        )

        if !UserDefaults.standard.bool(forKey: "sentinelSystemPageMigration1") {
            initialVisiblePageNames.insert(SentinelPage.system.rawValue)

            UserDefaults.standard.set(
                Array(initialVisiblePageNames),
                forKey: "sentinelVisiblePages"
            )

            UserDefaults.standard.set(
                true,
                forKey: "sentinelSystemPageMigration1"
            )
        }

        visiblePageNames = initialVisiblePageNames

        UIDevice.current.isBatteryMonitoringEnabled = true
        localSystem = SentinelLocalSystem.capture()

        availableMobileServices = Set(
            UserDefaults.standard.stringArray(
                forKey: "sentinelAvailableMobileServices"
            ) ?? []
        )

        enabledMobileServices = Set(
            UserDefaults.standard.stringArray(
                forKey: "sentinelEnabledMobileServices"
            ) ?? []
        )

        mobileAccessStatus =
            KeychainStore.string(for: "mobileServiceAccessToken") == nil
            ? "Permission disabled"
            : "Independent access"

        let savedChatMode = UserDefaults.standard.string(forKey: "sentinelChatMode") ?? ""
        chatMode = savedChatMode == "File Sharing"
            ? .secureCompanion
            : SentinelChatMode(rawValue: savedChatMode) ?? .assistant
        if savedChatMode == "File Sharing" {
            UserDefaults.standard.set(SentinelChatMode.secureCompanion.rawValue, forKey: "sentinelChatMode")
        }

        chatDraft =
            UserDefaults.standard.string(forKey: "sentinelChatDraft") ?? ""

        super.init()
        locationManager.delegate = self
    }

    var accentColor: UIColor { accentTheme.uiColor }

    func setAccentTheme(_ theme: SentinelAccentTheme) {
        accentTheme = theme
        UserDefaults.standard.set(theme.rawValue, forKey: "sentinelAccentTheme")
    }

    func setReactorAnimation(_ animation: SentinelReactorAnimation) {
        reactorAnimation = animation
        UserDefaults.standard.set(animation.rawValue, forKey: "sentinelReactorAnimation")
    }

    func start() async {
        KeychainStore.migrateLegacyCompanionCredentials()
        startNetworkMonitor()
        loadActivity()
        loadTrips()
        loadFlights()
        loadSavedPlaces()
        loadCachedWeather()
        loadChatConversation()

        travelReadiness = Set(
            UserDefaults.standard.stringArray(
                forKey: "sentinelTravelReadiness"
            ) ?? []
        )

        savedSearches =
            UserDefaults.standard.stringArray(
                forKey: "sentinelSavedSearches"
            ) ?? []

        status = "Registering this iPhone…"

        async let registration = cloud.registerInstallation()
        async let release = try? cloud.latestRelease()

        cloudOnline = await registration

        if let availableRelease = await release {
            await handle(availableRelease)
        }

        status = cloudOnline ? "Sentinel online" : "Offline mode"

        await refreshCompanionConnection()
        await refreshMobileServiceStatus()
        startReconnectMonitor()
    }

    func checkForUpdates() async {
        status = "Checking iPhone content…"

        do {
            if let release = try await cloud.latestRelease() {
                await handle(release)
            } else {
                update = nil
                status = "iPhone content is current"
            }
        } catch {
            status = "Unable to check Sentinel content"
        }
    }

    func installContentUpdate() async {
        guard let release = update, !isInstallingContent else {
            return
        }

        isInstallingContent = true
        status = "Installing Sentinel content \(release.version)…"

        defer {
            isInstallingContent = false
        }

        do {
            try cloud.applyContentUpdate(release)

            contentVersion = release.version
            update = nil
            cloudOnline = await cloud.registerInstallation()
            status = "Sentinel content \(release.version) installed"

            recordActivity(
                "Content updated",
                detail: "Sentinel content \(release.version) is ready.",
                symbol: "arrow.down.app.fill"
            )
        } catch {
            status = "Content update could not be installed"

            recordActivity(
                "Content update failed",
                detail: error.localizedDescription,
                symbol: "exclamationmark.triangle.fill"
            )
        }
    }

    private func handle(_ release: SentinelRelease) async {
        guard release.supportsIOS,
              release.version.isNewer(than: contentVersion) else {
            update = nil
            status = "iPhone content is current"
            return
        }

        update = release

        if release.installationPolicy?.lowercased() == "required" {
            await installContentUpdate()
        } else {
            status = "Content update available"
        }
    }

    func pairCompanion() async {
        let cleanCode = pairingCode.filter(\.isNumber)

        guard cleanCode.count == 6 else {
            pairingStatus =
                "Enter the six-digit code shown by Sentinel Desktop"
            return
        }

        pairingStatus = "Pairing securely…"

        do {
            companionPaired =
                try await cloud.pairCompanion(code: cleanCode)

            pairingStatus = companionPaired
                ? "Paired with Sentinel Desktop"
                : "The pairing code was rejected or has expired"

            if companionPaired {
                pairingCode = ""
                startReconnectMonitor()

                recordActivity(
                    "Desktop paired",
                    detail: "Pairing credentials were saved in Keychain.",
                    symbol: "lock.shield.fill"
                )

                availableMobileServices = Set(
                    UserDefaults.standard.stringArray(
                        forKey: "sentinelAvailableMobileServices"
                    ) ?? []
                )

                if UserDefaults.standard.bool(
                    forKey: "sentinelIndependentAccessAvailable"
                ) {
                    showMobileAccessConsent = true
                }
            }
        } catch {
            companionPaired = false
            pairingStatus =
                "Pairing failed: \(error.localizedDescription)"
        }
    }

    func refreshCompanionConnection() async {
        guard KeychainStore.string(for: "cloudToken") != nil else {
            companionPaired = false
            pairingStatus = "Not paired"
            return
        }

        companionPaired = true
        pairingStatus = "Checking Sentinel Desktop…"

        if let connection = await cloud.reconnectCompanion() {
            pairingStatus = connection == .localNetwork
                ? "Paired with Sentinel Desktop — local"
                : "Paired with Sentinel Desktop — Cloudflare"

            if lastCompanionConnection != connection {
                recordActivity(
                    "Desktop reconnected",
                    detail: connection == .localNetwork
                        ? "Secure local companion connection verified."
                        : "Secure Cloudflare companion connection verified.",
                    symbol: "link.circle.fill"
                )
            }

            lastCompanionConnection = connection
            companionLastSyncedAt = .now

            UserDefaults.standard.set(
                companionLastSyncedAt,
                forKey: "sentinelCompanionLastSyncedAt"
            )
        } else {
            pairingStatus = "Paired — desktop temporarily unavailable"
            lastCompanionConnection = nil
        }
    }

    func refreshMobileServiceStatus() async {
        guard KeychainStore.string(for: "mobileServiceAccessToken") != nil else {
            mobileServiceStatus = nil
            mobileServiceDiagnostics = "Mobile Service Access has not been enabled for this iPhone."
            return
        }
        guard !isCheckingMobileServices else { return }
        isCheckingMobileServices = true
        defer { isCheckingMobileServices = false }

        var lastError: Error?
        for attempt in 0..<3 {
            do {
                let data = try await cloud.mobileService(path: "/mobile/services/status")
                let result = try JSONDecoder().decode(SentinelMobileStatus.self, from: data)
                mobileServiceStatus = result
                mobileServicesCheckedAt = .now
                enabledMobileServices = Set(result.services.compactMap { $0.value.permitted ? $0.key : nil })
                mobileServiceDiagnostics = result.online == false ? "Sentinel relay is temporarily unavailable." : "Mobile services checked successfully."
                return
            } catch {
                lastError = error
                guard shouldRetryMobileService(error), attempt < 2 else { break }
                try? await Task.sleep(for: .seconds(pow(2.0, Double(attempt))))
            }
        }
        mobileServiceDiagnostics = lastError?.localizedDescription ?? "Mobile service status could not be checked."
    }

    func queueDesktopAction(
        _ action: SentinelDesktopAction,
        target: String = "",
        command: String = "",
        approved: Bool = false
    ) async {
        guard KeychainStore.string(for: "mobileServiceAccessToken") != nil else {
            desktopActionStatus = MobileServiceError.permissionRequired.localizedDescription
            return
        }
        desktopActionStatus = "Sending request to Sentinel Personal…"
        desktopActionCommandID = nil
        do {
            let body = SentinelDesktopActionRequest(action: action.rawValue, target: target.nilIfBlank, command: command.nilIfBlank, approved: approved)
            let data = try await cloud.postMobileService(path: "/mobile/desktop/action", body: body)
            let response = try JSONDecoder().decode(SentinelDesktopActionResponse.self, from: data)
            desktopActionCommandID = response.commandID
            desktopActionStatus = response.message ?? (response.queued ? "Sentinel Personal accepted the request. Completion has not yet been confirmed." : "Desktop request was not queued.")
        } catch {
            desktopActionStatus = desktopActionMessage(for: error)
        }
    }

    private func shouldRetryMobileService(_ error: Error) -> Bool {
        if let serviceError = error as? MobileServiceError {
            return serviceError.httpStatus == 429 || serviceError.httpStatus == 502
        }
        if let urlError = error as? URLError {
            return [.timedOut, .networkConnectionLost, .notConnectedToInternet, .cannotConnectToHost].contains(urlError.code)
        }
        return false
    }

    private func desktopActionMessage(for error: Error) -> String {
        let message = error.localizedDescription
        switch message {
        case "desktop_offline": return "Sentinel Personal is offline. This request needs the paired desktop."
        case "desktop_control_denied": return "Desktop control is not permitted for this iPhone."
        case "desktop_action_rate_limit": return "Desktop action limit reached. Please wait and try again."
        case "unsupported_desktop_action": return "This desktop action is not supported by Sentinel Personal."
        case "desktop_command_missing": return "Sentinel Personal needs a target or command for this request."
        case "approval_required": return "Confirm this change before sending it to Sentinel Personal."
        default: return message
        }
    }

    func startReconnectMonitor() {
        guard KeychainStore.string(for: "cloudToken") != nil,
              reconnectTask == nil else {
            return
        }

        reconnectTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(10))

                guard !Task.isCancelled else {
                    return
                }

                await self?.refreshCompanionConnection()
            }
        }
    }

    func stopReconnectMonitor() {
        reconnectTask?.cancel()
        reconnectTask = nil
    }

    func prepareForBackground() {
        backgroundedAt = .now
        UserDefaults.standard.set(
            chatDraft,
            forKey: "sentinelChatDraft"
        )
    }

    func refreshMobileServicesAfterForeground() async {
        defer { backgroundedAt = nil }
        guard let backgroundedAt,
              Date().timeIntervalSince(backgroundedAt) >= 180 else { return }
        await refreshMobileServiceStatus()
    }

    func lockIfNeeded() {
        if appLockEnabled && !isAuthenticating {
            isLocked = true
        }
    }

    var menuPages: [SentinelPage] {
        [.home] +
        SentinelPage.corePages
            .filter {
                $0 != .home &&
                visiblePageNames.contains($0.rawValue)
            }
            .sorted {
                $0.rawValue.localizedCaseInsensitiveCompare(
                    $1.rawValue
                ) == .orderedAscending
            }
    }

    func setPageVisible(_ page: SentinelPage, visible: Bool) {
        guard page != .home else {
            return
        }

        if visible {
            visiblePageNames.insert(page.rawValue)
        } else {
            visiblePageNames.remove(page.rawValue)
        }

        UserDefaults.standard.set(
            Array(visiblePageNames),
            forKey: "sentinelVisiblePages"
        )
    }

    func refreshLocalSystem() {
        localSystem = SentinelLocalSystem.capture()
    }

    func enableAppLock() async {
        lockStatus = "Confirm your identity to enable App Lock."

        guard await authenticate(reason: "Enable Sentinel App Lock") else {
            return
        }

        appLockEnabled = true

        UserDefaults.standard.set(
            true,
            forKey: "sentinelAppLockEnabled"
        )

        lockStatus =
            "App Lock is on. Sentinel locks whenever it leaves the foreground."

        recordActivity(
            "App Lock enabled",
            detail: "Biometric or passcode protection was enabled.",
            symbol: "lock.fill"
        )
    }

    func disableAppLock() async {
        lockStatus = "Confirm your identity to disable App Lock."

        guard await authenticate(reason: "Disable Sentinel App Lock") else {
            return
        }

        appLockEnabled = false
        isLocked = false

        UserDefaults.standard.set(
            false,
            forKey: "sentinelAppLockEnabled"
        )

        lockStatus = "App Lock is off."

        recordActivity(
            "App Lock disabled",
            detail: "Biometric or passcode protection was disabled.",
            symbol: "lock.open.fill"
        )
    }

    func unlock() async {
        lockStatus = "Unlocking Sentinel…"

        if await authenticate(reason: "Unlock Sentinel") {
            isLocked = false
            lockStatus = ""
        }
    }

    private func authenticate(reason: String) async -> Bool {
        isAuthenticating = true

        defer {
            isAuthenticating = false
        }

        let context = LAContext()
        var error: NSError?

        guard context.canEvaluatePolicy(
            .deviceOwnerAuthentication,
            error: &error
        ) else {
            lockStatus = "Device authentication is not available."
            return false
        }

        do {
            try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: reason
            )

            return true
        } catch {
            lockStatus = "Authentication was not completed."
            return false
        }
    }

    func prepareForNewPairingCode() {
        reconnectTask?.cancel()
        reconnectTask = nil

        pairingCode = ""
        companionPaired = false
        pairingStatus = "Enter the new code from Sentinel Desktop"

        KeychainStore.remove("mobileServiceAccessToken")

        enabledMobileServices = []
        mobileServiceStatus = nil
        mobileServiceDiagnostics = "Mobile Service Access was cleared."

        UserDefaults.standard.removeObject(
            forKey: "sentinelEnabledMobileServices"
        )

        mobileAccessStatus = "Permission disabled"
    }

    func enrolMobileAccess() async {
        let requested = Array(availableMobileServices)

        guard !requested.isEmpty else {
            mobileAccessStatus = "Not configured"
            return
        }

        mobileAccessStatus = "Requesting independent access…"

        do {
            let version =
                UserDefaults.standard.integer(
                    forKey: "sentinelMobilePermissionVersion"
                )

            let enrollment =
                try await cloud.enrolMobileAccess(
                    services: requested,
                    permissionVersion: max(version, 1)
                )

            enabledMobileServices = Set(enrollment.services)

            UserDefaults.standard.set(
                enrollment.services,
                forKey: "sentinelEnabledMobileServices"
            )

            mobileAccessStatus = "Independent access"
            await refreshMobileServiceStatus()
        } catch {
            mobileAccessStatus = "Connection unavailable"
        }
    }

    private func startNetworkMonitor() {
        guard !monitoringNetwork else {
            return
        }

        monitoringNetwork = true

        pathMonitor.pathUpdateHandler = { [weak self] path in
            let isConnected = path.status == .satisfied
            let usesWiFi = path.usesInterfaceType(.wifi)

            Task { @MainActor in
                self?.localNetworkAvailable = isConnected && usesWiFi

                self?.networkStatus = !isConnected
                    ? "Offline"
                    : (
                        usesWiFi
                        ? "Wi‑Fi — local transfer available"
                        : "Cellular — Cloudflare fallback only"
                    )

                if isConnected {
                    await self?.refreshCompanionConnection()
                }
            }
        }

        pathMonitor.start(queue: pathMonitorQueue)
    }

    deinit {
        pathMonitor.cancel()
    }

    func sendClipboard() async {
        let cleanText =
            clipboardText.trimmingCharacters(
                in: .whitespacesAndNewlines
            )

        guard !cleanText.isEmpty else {
            return
        }

        status = "Sharing text…"

        do {
            try await cloud.sendClipboard(cleanText)

            status = "Text shared with Sentinel Desktop"

            recordActivity(
                "Text shared",
                detail: "Shared clipboard text was sent to the desktop.",
                symbol: "doc.on.clipboard.fill"
            )
        } catch {
            status = "Text sharing failed: \(error.localizedDescription)"

            recordActivity(
                "Text sharing failed",
                detail: error.localizedDescription,
                symbol: "exclamationmark.triangle.fill"
            )
        }
    }

    func setChatMode(_ mode: SentinelChatMode) {
        chatMode = mode

        UserDefaults.standard.set(
            mode.rawValue,
            forKey: "sentinelChatMode"
        )
    }

    func submitAssistantPrompt() async {
        let prompt =
            chatDraft.trimmingCharacters(
                in: .whitespacesAndNewlines
            )

        guard (!prompt.isEmpty || !chatAttachments.isEmpty), !isSendingChat else {
            return
        }
        let messageText = prompt.isEmpty ? "Please analyse the attached file." : prompt
        let attachments = chatAttachments

        _ = await ensureCurrentLocationForChat()

        chatError = nil
        chatMessages.append(
            SentinelChatMessage(
                role: .user,
                text: messageText,
                attachments: attachments
            )
        )

        chatDraft = ""
        persistChatConversation()
        isSendingChat = true
        defer { isSendingChat = false }

        do {
            let reply = try await cloud.sendAssistantMessage(
                messages: Array(chatMessages.suffix(16)),
                allowCloudFallback: mobileChatAccessEnabled,
                conversationID: conversationID,
                context: chatContext,
                attachments: attachments
            )
            chatMessages.append(SentinelChatMessage(role: .assistant, text: reply.reply, generatedImages: storeGeneratedImages(reply.images)))
            applyChatDelivery(reply)
            if spokenResponses { speakAssistantResponse(reply.reply) }
            chatAttachments = []
            persistChatConversation()
        } catch {
            chatError = chatFailureMessage(error)
            persistChatConversation()
        }
    }

    func retryAssistantPrompt() async {
        guard chatMessages.last(where: { $0.role == .user }) != nil, !isSendingChat else { return }
        chatError = nil
        isSendingChat = true
        defer { isSendingChat = false }
        do {
            let reply = try await cloud.sendAssistantMessage(messages: Array(chatMessages.suffix(16)), allowCloudFallback: mobileChatAccessEnabled, conversationID: conversationID, context: chatContext, attachments: chatAttachments)
            chatMessages.append(SentinelChatMessage(role: .assistant, text: reply.reply, generatedImages: storeGeneratedImages(reply.images)))
            applyChatDelivery(reply)
            if spokenResponses { speakAssistantResponse(reply.reply) }
            persistChatConversation()
        } catch {
            chatError = chatFailureMessage(error)
        }
    }

    func clearConversation() {
        chatMessages = []
        chatError = nil
        persistChatConversation()
    }

    func newConversation() {
        conversationID = UUID()
        chatMessages = []
        chatError = nil
        conversationTitle = "New conversation"
        persistChatConversation()
    }

    func selectConversation(_ conversation: SentinelConversation) { conversationID = conversation.id; conversationTitle = conversation.title; chatMessages = conversation.messages; chatAttachments = []; chatError = nil }
    func renameConversation(_ title: String) { let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines); guard !trimmed.isEmpty else { return }; conversationTitle = String(trimmed.prefix(40)); persistChatConversation() }
    func toggleConversationPin(_ conversation: SentinelConversation) { updateConversation(conversation.id) { $0.isPinned.toggle() } }
    func toggleConversationArchive(_ conversation: SentinelConversation) { updateConversation(conversation.id) { $0.isArchived.toggle() } }
    func deleteConversation(_ conversation: SentinelConversation) { conversations.removeAll { $0.id == conversation.id }; conversationRepository.save(conversations); if conversation.id == conversationID { newConversation() } }
    func deleteAllConversations() { conversations = []; conversationRepository.removeAll(); newConversation() }

    func addChatAttachment(data: Data, name: String, mimeType: String) -> String? {
        let supported = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain", "text/markdown", "text/csv", "application/json"]
        guard supported.contains(mimeType) else { return "This file type is not supported in Sentinel AI chat." }
        guard data.count <= 10 * 1_024 * 1_024 else { return "Each chat attachment must be 10 MB or smaller." }
        guard chatAttachments.count < 6 else { return "You can attach up to six items to one message." }
        guard chatAttachments.reduce(0, { $0 + $1.byteCount }) + data.count <= 20 * 1_024 * 1_024 else { return "Chat attachments must total 20 MB or less." }
        chatAttachments.append(SentinelChatAttachment(name: name, mimeType: mimeType, data: "data:\(mimeType);base64,\(data.base64EncodedString())", byteCount: data.count))
        return nil
    }

    func removeChatAttachment(_ attachment: SentinelChatAttachment) { chatAttachments.removeAll { $0.id == attachment.id } }
    func showChatError(_ message: String) { chatError = message }
    func setSpokenResponses(_ enabled: Bool) { spokenResponses = enabled; UserDefaults.standard.set(enabled, forKey: "sentinelSpokenResponses"); if !enabled { speechSynthesizer.stopSpeaking(at: .immediate) } }
    func speakAssistantResponse(_ text: String) { let lower = text.lowercased(); guard !["password", "api key", "access token", "pairing code"].contains(where: lower.contains) else { return }; speechSynthesizer.stopSpeaking(at: .immediate); let utterance = AVSpeechUtterance(string: text); utterance.voice = AVSpeechSynthesisVoice(language: "en-GB"); speechSynthesizer.speak(utterance) }
    func stopSpeaking() { speechSynthesizer.stopSpeaking(at: .immediate) }
    var conversationExportText: String { "\(conversationTitle)\n\n" + chatMessages.map { "[\($0.role.rawValue.capitalized)] \($0.text)" }.joined(separator: "\n\n") }

    private func storeGeneratedImages(_ images: [AssistantGeneratedImage]) -> [SentinelGeneratedImage] {
        guard !images.isEmpty,
              let support = try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true) else { return [] }
        let directory = support.appendingPathComponent("Sentinel/GeneratedImages", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return images.compactMap { image in
            guard image.mimeType == "image/png", let bytes = Data(base64Encoded: image.data), !bytes.isEmpty else { return nil }
            let filename = "\(UUID().uuidString).png"
            let url = directory.appendingPathComponent(filename)
            do {
                try bytes.write(to: url, options: [.atomic])
                try? FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: url.path)
                return SentinelGeneratedImage(prompt: image.prompt, revisedPrompt: image.revisedPrompt, filename: filename)
            } catch { return nil }
        }
    }
    func runChatAction(_ action: SentinelChatAction) { switch action.type { case "open_directions": if let latitude = action.latitude, let longitude = action.longitude { let item = MKMapItem(placemark: MKPlacemark(coordinate: .init(latitude: latitude, longitude: longitude))); item.name = action.query; item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving]) }; case "view_weather": selected = .weather; if let query = action.query { mapSearch = query }; case "track_flight": selected = .travel; if let flight = action.flight { flightNumber = flight }; case "open_page": if let page = action.page, let destination = SentinelPage.allCases.first(where: { $0.rawValue.caseInsensitiveCompare(page) == .orderedSame }) { selected = destination }; default: break } }

    /// Applies only Worker-verified live-conversation results to the existing
    /// mobile pages. Raw Realtime model text never directly changes navigation.
    func applyVerifiedLiveTool(service: String, result: [String: Any]) {
        switch service {
        case "navigation":
            let destination = (result["destination"] as? [String: Any]) ?? result
            let name = (destination["name"] as? String) ?? (destination["address"] as? String)
            guard let name, !name.isEmpty else { return }
            selected = .navigation
            mapSearch = name
            journeyDestination = name
            mapStatus = "Verified destination received. Preparing route options…"
            Task { await searchMobilePlaces(); await planJourney() }
        case "weather":
            selected = .weather
            refreshWeather()
        case "aviation":
            if let flight = (result["flight"] as? [String: Any])?["iata"] as? String ?? result["flight"] as? String {
                flightNumber = flight
                selected = .travel
                Task { await fetchFlightStatus() }
            }
        case "page":
            if let page = result["page"] as? String,
               let destination = SentinelPage.allCases.first(where: { $0.rawValue.caseInsensitiveCompare(page) == .orderedSame }) {
                selected = destination
            }
        default:
            break
        }
    }

    func toggleVoiceChat() {
        if voiceInput.isListening { voiceInput.stop(); voiceStatus = ""; return }
        voiceStatus = "Requesting voice access…"
        voiceInput.start(onPartial: { [weak self] text in
            Task { @MainActor in self?.chatDraft = text; self?.voiceStatus = "Listening…" }
        }, onFinal: { [weak self] text in
            Task { @MainActor in
                guard let self, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
                self.chatDraft = text; self.voiceStatus = "Sending…"
                try? await Task.sleep(nanoseconds: 900_000_000)
                await self.submitAssistantPrompt()
                self.voiceStatus = ""
            }
        }, onError: { [weak self] message in Task { @MainActor in self?.voiceStatus = message } })
    }

    func refreshCompanionWorkspace() async {
        guard companionPaired,
              !isRefreshingCompanionWorkspace else {
            return
        }

        isRefreshingCompanionWorkspace = true

        defer {
            isRefreshingCompanionWorkspace = false
        }

        status = "Syncing companion workspace…"

        var clipboardLoaded = false
        var filesLoaded = false
        var errors: [String] = []

        do {
            let data = try await cloud.fetchClipboard()

            desktopClipboardText =
                SentinelClipboardPayload.text(from: data)

            clipboardLoaded = true
        } catch {
            errors.append(
                "Clipboard: \(error.localizedDescription)"
            )
        }

        do {
            let data = try await cloud.listFiles()

            remoteFiles =
                try SentinelRemoteFile.decodeList(from: data)

            filesLoaded = true
        } catch {
            errors.append(
                "Files: \(error.localizedDescription)"
            )
        }

        if clipboardLoaded || filesLoaded {
            companionLastSyncedAt = .now

            UserDefaults.standard.set(
                companionLastSyncedAt,
                forKey: "sentinelCompanionLastSyncedAt"
            )

            if desktopClipboardText.isEmpty && remoteFiles.isEmpty {
                status = "Workspace synced — no new shared items"
            } else {
                status = "Companion workspace synced"
            }

            recordActivity(
                "Companion workspace synced",
                detail: "Clipboard and file inventory refreshed.",
                symbol: "arrow.triangle.2.circlepath"
            )
        } else {
            status = errors.isEmpty
                ? "Companion workspace unavailable"
                : errors.joined(separator: " · ")
        }
    }

    func copyDesktopClipboardToPhone() {
        guard !desktopClipboardText.isEmpty else {
            return
        }

        UIPasteboard.general.string = desktopClipboardText

        status = "Desktop text copied to this iPhone"

        recordActivity(
            "Text copied to iPhone",
            detail:
                "Desktop clipboard text was added to the iPhone clipboard.",
            symbol: "doc.on.doc.fill"
        )
    }

    func deleteRemoteFile(_ file: SentinelRemoteFile) async {
        do {
            try await cloud.deleteFile(id: file.id)

            remoteFiles.removeAll {
                $0.id == file.id
            }

            status = "Removed \(file.name) from companion files"

            recordActivity(
                "Remote file removed",
                detail:
                    "\(file.name) was removed from companion files.",
                symbol: "trash.fill"
            )
        } catch {
            status =
                "Could not remove companion file: \(error.localizedDescription)"
        }
    }

    func sendFile(_ data: Data, filename: String) async {
        var item = SentinelTransfer(
            name: filename,
            byteCount: data.count,
            state: .preparing
        )

        transfer = item

        do {
            item.state = .transferring(0.25)
            transfer = item

            let route =
                try await cloud.transfer(
                    data: data,
                    filename: filename
                )

            item.route = route
            item.state = .complete
            transfer = item

            status = route == .localNetwork
                ? "File sent locally"
                : "File sent through Cloudflare"

            recordActivity(
                "File transfer complete",
                detail:
                    "\(filename) sent \(route == .localNetwork ? "on the local network" : "through Cloudflare").",
                symbol: "checkmark.circle.fill"
            )
        } catch {
            item.state = .failed(error.localizedDescription)
            transfer = item
            status = "File transfer failed"

            recordActivity(
                "File transfer failed",
                detail: error.localizedDescription,
                symbol: "exclamationmark.triangle.fill"
            )
        }
    }

    func clearActivity() {
        activity = []

        UserDefaults.standard.removeObject(
            forKey: "sentinelActivity"
        )
    }

    var unreadActivityCount: Int {
        activity.filter { !$0.isRead }.count
    }

    var filteredActivity: [SentinelActivity] {
        showUnreadOnly
            ? activity.filter { !$0.isRead }
            : activity
    }

    func markActivityRead(_ id: UUID) {
        guard let index =
                activity.firstIndex(where: { $0.id == id }) else {
            return
        }

        activity[index].isRead = true
        persistActivity()
    }

    func markAllActivityRead() {
        activity.indices.forEach {
            activity[$0].isRead = true
        }

        persistActivity()
    }

    func openInMaps() async {
        let query =
            mapSearch.trimmingCharacters(
                in: .whitespacesAndNewlines
            )

        guard !query.isEmpty else {
            mapStatus = "Enter a destination first."
            return
        }

        mapStatus = "Finding \(query)…"

        do {
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = query

            let response =
                try await MKLocalSearch(request: request).start()

            guard let item = response.mapItems.first else {
                mapStatus = "No location found for \(query)."
                return
            }

            item.openInMaps(
                launchOptions: [
                    MKLaunchOptionsDirectionsModeKey:
                        MKLaunchOptionsDirectionsModeDriving
                ]
            )

            if !savedSearches.contains(query) {
                savedSearches =
                    Array(([query] + savedSearches).prefix(8))

                UserDefaults.standard.set(
                    savedSearches,
                    forKey: "sentinelSavedSearches"
                )
            }

            mapStatus =
                "Opened \(item.name ?? query) in Apple Maps."

            recordActivity(
                "Navigation opened",
                detail:
                    "Directions requested for \(item.name ?? query).",
                symbol: "map.fill"
            )
        } catch {
            mapStatus = "Apple Maps search could not complete."
        }
    }

    func searchMobilePlaces() async {
        let rawQuery = mapSearch.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !rawQuery.isEmpty else { return }
        guard mobileServiceEnabled("navigation") else { mapStatus = MobileServiceError.permissionRequired.localizedDescription; return }
        let generic = ["pharmacy", "coffee", "restaurant", "restaurants", "food", "petrol"].contains(rawQuery.lowercased())
        let query: String
        if generic, let currentLocation { query = "\(rawQuery) near \(currentLocation.latitude),\(currentLocation.longitude)" } else { query = rawQuery }
        mapStatus = "Searching nearby places…"
        do {
            let data = try await cloud.mobileService(path: "/mobile/services/navigation", queryItems: [URLQueryItem(name: "query", value: query)])
            let response = try JSONDecoder().decode(SentinelPlacesResponse.self, from: data)
            if response.status != "OK" && response.status != "ZERO_RESULTS" { mapStatus = response.errorMessage ?? "Places search could not be completed."; return }
            placeResults = response.results.sorted { ($0.isUK ? 1 : 0, $0.rating ?? 0) > ($1.isUK ? 1 : 0, $1.rating ?? 0) }
            mapStatus = placeResults.isEmpty ? "No nearby places found." : "\(placeResults.count) nearby places found."
        } catch { mapStatus = error.localizedDescription }
    }

    func planJourney() async {
        let destinationText = journeyDestination.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !destinationText.isEmpty else { journeyStatus = "Enter a destination first."; return }
        guard let currentLocation else { journeyStatus = "Current location is required to plan this journey."; refreshWeather(); return }
        guard !isPlanningJourney else { return }
        isPlanningJourney = true; journeyStatus = "Finding destination…"
        defer { isPlanningJourney = false }
        let search = MKLocalSearch(request: { let request = MKLocalSearch.Request(); request.naturalLanguageQuery = destinationText; request.region = MKCoordinateRegion(center: currentLocation, span: .init(latitudeDelta: 1.2, longitudeDelta: 1.5)); return request }())
        do {
            let response = try await search.start()
            guard let destination = response.mapItems.first else { journeyStatus = "No destination was found."; return }
            let request = MKDirections.Request(); request.source = MKMapItem(placemark: .init(coordinate: currentLocation)); request.destination = destination; request.transportType = journeyMode.mapKitType
            journeyStatus = "Calculating route…"
            let directions = MKDirections(request: request)
            let calculated = try await directions.calculate()
            guard let route = calculated.routes.first else { journeyStatus = "No route is currently available."; return }
            journeyRoute = route; journeyDestinationItem = destination; journeyStatus = "Route ready."
        } catch { journeyStatus = "A route could not be calculated right now." }
    }

    func clearJourney() { journeyDestination = ""; journeyRoute = nil; journeyDestinationItem = nil; journeyStatus = "Choose a destination to prepare a journey." }

    func savePlace(_ place: SentinelPlaceResult) {
        let saved = SentinelSavedPlace(name: place.name, address: place.formattedAddress, latitude: place.latitude, longitude: place.longitude)
        guard !savedPlaces.contains(where: { abs($0.latitude - saved.latitude) < 0.00001 && abs($0.longitude - saved.longitude) < 0.00001 }) else { return }
        savedPlaces.insert(saved, at: 0)
        persistSavedPlaces()
    }

    func removeSavedPlace(_ place: SentinelSavedPlace) { savedPlaces.removeAll { $0.id == place.id }; persistSavedPlaces() }

    func openPlaceInMaps(_ place: SentinelPlaceResult) {
        let item = MKMapItem(placemark: MKPlacemark(coordinate: .init(latitude: place.latitude, longitude: place.longitude)))
        item.name = place.name
        item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
    }

    func refreshWeather() {
        switch locationManager.authorizationStatus {
        case .notDetermined:
            weatherStatus =
                "Location permission is needed for local weather."

            locationManager.requestWhenInUseAuthorization()

        case .restricted, .denied:
            weatherStatus =
                "Location access is off. Enable it in iPhone Settings to load local weather."

        default:
            weatherStatus = "Finding your location…"
            locationManager.requestLocation()
        }
    }

    func refreshRadar() async {
        guard mobileServiceEnabled("weather") else { radarStatus = "Weather access is not enabled for this iPhone."; radarHTTPStatus = "Not requested"; return }
        if lastKnownLocation == nil,
           locationManager.authorizationStatus == .authorizedAlways || locationManager.authorizationStatus == .authorizedWhenInUse {
            locationManager.requestLocation()
        }
        radarStatus = "Loading live radar…"
        radarHTTPStatus = "Requesting…"
        do {
            let response = try await cloud.mobileServiceResponse(path: "/mobile/services/weather/radar")
            radarHTTPStatus = "HTTP \(response.statusCode)"
            let metadata = try JSONDecoder().decode(SentinelRadarMetadata.self, from: response.data).sorted
            radarMetadata = metadata
            radarFrameCount = metadata.frames.count
            radarCurrentFrameIndex = metadata.frames.indices.min(by: { abs(metadata.frames[$0].date.timeIntervalSinceNow) < abs(metadata.frames[$1].date.timeIntervalSinceNow) }) ?? 0
            radarLatestFrame = metadata.frames.last?.date.formatted(date: .omitted, time: .shortened) ?? "No frames"
            radarStatus = metadata.frames.isEmpty ? "The radar service returned no frames." : "Live radar updated."
            if let saved = try? JSONEncoder().encode(metadata) { UserDefaults.standard.set(saved, forKey: "sentinelRadarMetadata") }
            UserDefaults.standard.set(Date(), forKey: "sentinelRadarMetadataDate")
        } catch {
            if let serviceError = error as? MobileServiceError {
                if let status = serviceError.httpStatus { radarHTTPStatus = "HTTP \(status)" } else { radarHTTPStatus = "No HTTP response" }
                if case .notPermitted = serviceError { radarStatus = "Weather access is not enabled for this iPhone." }
                else { radarStatus = radarMetadata == nil ? serviceError.localizedDescription : "Showing cached radar imagery. Live refresh will retry." }
            } else { radarHTTPStatus = "No HTTP response"; radarStatus = radarMetadata == nil ? "Live radar could not be refreshed." : "Showing cached radar imagery. Live refresh will retry." }
        }
    }

    func locationManagerDidChangeAuthorization(
        _ manager: CLLocationManager
    ) {
        if manager.authorizationStatus == .authorizedAlways ||
            manager.authorizationStatus == .authorizedWhenInUse {
            refreshWeather()
        }
    }

    func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard let location = locations.last else {
            return
        }

        currentLocation = location.coordinate
        lastKnownLocation = location.coordinate
        completeChatLocation(location.coordinate)

        guard !loadingWeather else { return }

        loadingWeather = true
        weatherStatus = "Loading local forecast…"

        Task {
            defer {
                loadingWeather = false
            }

            do {
                guard mobileServiceEnabled("weather") else {
                    weatherStatus = MobileServiceError.permissionRequired.localizedDescription
                    return
                }
                let query = "\(location.coordinate.latitude),\(location.coordinate.longitude)"
                let data = try await cloud.mobileService(path: "/mobile/services/weather", queryItems: [
                    URLQueryItem(name: "q", value: query),
                    URLQueryItem(name: "days", value: "7")
                ])
                let response = try JSONDecoder().decode(SentinelWeatherAPIResponse.self, from: data)
#if DEBUG
                print("Sentinel forecast days:", response.forecast.forecastday.count)
                for day in response.forecast.forecastday {
                    print("Forecast day:", day.date)
                }
#endif
                weatherDetails = response
                weather = SentinelWeather(weatherAPI: response)

                weatherStatus =
                    "Updated for your current location."

                weatherUpdatedAt = .now
                persistWeather()

                recordActivity(
                    "Weather updated",
                    detail: "Local conditions were refreshed.",
                    symbol: "cloud.sun.fill"
                )
            } catch {
                weatherStatus =
                    "Weather could not be loaded right now."
            }
        }
    }

    func locationManager(
        _ manager: CLLocationManager,
        didFailWithError error: Error
    ) {
        completeChatLocation(nil)
        weatherStatus =
            "Your location could not be determined."
    }

    func addTrip() {
        let title =
            tripTitle.trimmingCharacters(
                in: .whitespacesAndNewlines
            )

        guard !title.isEmpty else {
            return
        }

        trips.insert(
            SentinelTrip(
                title: title,
                date: tripDate,
                notes:
                    tripNotes.trimmingCharacters(
                        in: .whitespacesAndNewlines
                    )
            ),
            at: 0
        )

        saveTrips()

        recordActivity(
            "Trip saved",
            detail: "\(title) was added to your travel plan.",
            symbol: "airplane"
        )

        tripTitle = ""
        tripNotes = ""
        tripDate = Date()
    }

    func removeTrips(at offsets: IndexSet) {
        trips.remove(atOffsets: offsets)
        saveTrips()
    }

    func addFlight() {
        let number =
            flightNumber.trimmingCharacters(
                in: .whitespacesAndNewlines
            ).uppercased()

        guard !number.isEmpty else {
            return
        }

        flights.insert(
            SentinelFlight(
                number: number,
                departure:
                    departureAirport.trimmingCharacters(
                        in: .whitespacesAndNewlines
                    ).uppercased(),
                arrival:
                    arrivalAirport.trimmingCharacters(
                        in: .whitespacesAndNewlines
                    ).uppercased(),
                date: flightDate,
                terminal:
                    flightTerminal.trimmingCharacters(
                        in: .whitespacesAndNewlines
                    )
            ),
            at: 0
        )

        saveFlights()

        recordActivity(
            "Flight saved",
            detail: "\(number) was added to Flight Tracker.",
            symbol: "airplane"
        )

        flightNumber = ""
        departureAirport = ""
        arrivalAirport = ""
        flightTerminal = ""
        flightDate = Date()
    }

    func fetchFlightStatus() async {
        let number = flightNumber.replacingOccurrences(of: " ", with: "").uppercased()
        guard !number.isEmpty, !isLoadingFlightStatus else { return }
        guard mobileServiceEnabled("aviation") else { flightStatusMessage = "Enable this service in Sentinel Personal → Settings → Companion Sync → Mobile Service Access."; return }
        isLoadingFlightStatus = true; flightStatusMessage = "Checking flight status…"
        defer { isLoadingFlightStatus = false }
        do {
            let data = try await cloud.mobileService(path: "/mobile/services/aviation", queryItems: [URLQueryItem(name: "flight", value: number)])
            let response = try JSONDecoder().decode(SentinelAviationResponse.self, from: data)
            guard let first = response.data.first else { flightStatus = nil; flightStatusMessage = "No live provider result for \(number)."; return }
            flightStatus = first; flightStatusMessage = "Provider update received."
            if let cached = try? JSONEncoder().encode(first) { UserDefaults.standard.set(cached, forKey: "sentinelCachedFlightStatus") }
            UserDefaults.standard.set(Date(), forKey: "sentinelCachedFlightStatusDate")
        } catch { flightStatusMessage = error.localizedDescription }
    }

    func fetchAircraft() async {
        guard mobileServiceEnabled("aircraft") else { aircraftStatus = "Enable this service in Sentinel Personal → Settings → Companion Sync → Mobile Service Access."; return }
        aircraftStatus = "Loading live aircraft…"
        do {
            let data = try await cloud.mobileService(path: "/mobile/services/aircraft")
            let parsed = SentinelAircraft.decodeList(from: data)
            aircraft = parsed
            aircraftStatus = parsed.isEmpty ? "No aircraft positions were supplied." : "\(parsed.count) live aircraft loaded."
            if let cache = try? JSONEncoder().encode(parsed) { UserDefaults.standard.set(cache, forKey: "sentinelCachedAircraft") }
            UserDefaults.standard.set(Date(), forKey: "sentinelCachedAircraftDate")
        } catch { aircraftStatus = error.localizedDescription }
    }

    func removeFlight(_ flight: SentinelFlight) {
        flights.removeAll {
            $0.id == flight.id
        }

        saveFlights()
    }

    func toggleReadiness(_ item: String) {
        if travelReadiness.contains(item) {
            travelReadiness.remove(item)
        } else {
            travelReadiness.insert(item)
        }

        UserDefaults.standard.set(
            Array(travelReadiness),
            forKey: "sentinelTravelReadiness"
        )
    }

    private func loadActivity() {
        guard let data =
                UserDefaults.standard.data(
                    forKey: "sentinelActivity"
                ),
              let saved =
                try? JSONDecoder().decode(
                    [SentinelActivity].self,
                    from: data
                ) else {
            return
        }

        activity = saved
    }

    private func loadSavedPlaces() { guard let data = UserDefaults.standard.data(forKey: "sentinelSavedPlaces"), let saved = try? JSONDecoder().decode([SentinelSavedPlace].self, from: data) else { return }; savedPlaces = saved }
    private func persistSavedPlaces() { if let data = try? JSONEncoder().encode(savedPlaces) { UserDefaults.standard.set(data, forKey: "sentinelSavedPlaces") } }

    private var mobileChatAccessEnabled: Bool {
        enabledMobileServices.contains { $0.lowercased() == "chat" || $0.lowercased() == "ai chat" || $0.lowercased() == "ai" }
            && KeychainStore.string(for: "mobileServiceAccessToken") != nil
    }

    private func mobileServiceEnabled(_ service: String) -> Bool {
        enabledMobileServices.contains { $0.lowercased() == service.lowercased() }
            && KeychainStore.string(for: "mobileServiceAccessToken") != nil
    }

    private func loadChatConversation() {
        conversations = conversationRepository.load()
        if conversations.isEmpty,
           let data = UserDefaults.standard.data(forKey: "sentinelChatConversation"),
           let saved = try? JSONDecoder().decode([SentinelChatMessage].self, from: data) {
            let migrated = SentinelConversation(id: conversationID, messages: saved)
            conversations = [migrated]
            conversationRepository.save(conversations)
            UserDefaults.standard.removeObject(forKey: "sentinelChatConversation")
            UserDefaults.standard.removeObject(forKey: "sentinelConversationID")
        }
        if let active = conversations.first(where: { $0.id == conversationID }) ?? conversations.sorted(by: { $0.updatedAt > $1.updatedAt }).first { selectConversation(active) }
    }

    private func persistChatConversation() {
        let generatedTitle = chatMessages.first(where: { $0.role == .user && !$0.text.isEmpty }).map { String($0.text.prefix(40)) } ?? "New conversation"
        let conversation = SentinelConversation(id: conversationID, title: conversationTitle == "New conversation" ? generatedTitle : conversationTitle, updatedAt: .now, messages: chatMessages)
        conversationTitle = conversation.title
        if let index = conversations.firstIndex(where: { $0.id == conversationID }) {
            var updated = conversation
            updated.createdAt = conversations[index].createdAt
            updated.isPinned = conversations[index].isPinned
            updated.isArchived = conversations[index].isArchived
            updated.summary = conversations[index].summary
            conversations[index] = updated
        } else { conversations.append(conversation) }
        conversationRepository.save(conversations)
    }

    private func updateConversation(_ id: UUID, _ change: (inout SentinelConversation) -> Void) { guard let index = conversations.firstIndex(where: { $0.id == id }) else { return }; change(&conversations[index]); conversationRepository.save(conversations) }
    private func applyChatDelivery(_ delivery: AssistantChatDelivery) { if let title = delivery.title, !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, conversationTitle == "New conversation" { conversationTitle = String(title.prefix(40)) }; chatActions = delivery.actions.filter { ["open_page", "open_directions", "view_weather", "track_flight"].contains($0.type) }; chatCards = delivery.cards.filter { ["weather", "place", "flight", "info"].contains($0.type) }; chatVerifiedAt = delivery.verifiedAt; if let navigation = chatActions.first(where: { $0.type == "open_page" }) { runChatAction(navigation) } }

    private var chatContext: MobileChatContext {
        let capabilities = enabledMobileServices.union(["companion", "file-sharing"]).sorted()
        let location = currentLocation.map { MobileChatLocation(latitude: $0.latitude, longitude: $0.longitude) }
        return MobileChatContext(platform: "ios", appVersion: nativeVersion, contentVersion: contentVersion, currentPage: selected.rawValue.lowercased(), enabledServices: enabledMobileServices.sorted(), companionOnline: companionPaired, weatherSummary: weather.map { "\(Int($0.current.temperature2m))° \($0.conditionName)" }, weatherLocation: weatherDetails?.location.name, selectedDestination: mapSearch.isEmpty ? trips.first?.title : mapSearch, selectedFlight: flightStatus?.flight?.iata ?? flights.first?.number, localTime: ISO8601DateFormatter().string(from: .now), locale: "en-GB", capabilities: capabilities, location: location)
    }

    private func ensureCurrentLocationForChat() async -> CLLocationCoordinate2D? {
        if let currentLocation { return currentLocation }
        guard locationManager.authorizationStatus == .authorizedAlways || locationManager.authorizationStatus == .authorizedWhenInUse else { return nil }
        return await withCheckedContinuation { continuation in
            chatLocationTimeout?.cancel()
            chatLocationContinuation = continuation
            locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
            locationManager.requestLocation()
            chatLocationTimeout = Task { [weak self] in
                try? await Task.sleep(nanoseconds: 2_500_000_000)
                guard !Task.isCancelled else { return }
                self?.completeChatLocation(nil)
            }
        }
    }

    private func completeChatLocation(_ coordinate: CLLocationCoordinate2D?) {
        chatLocationTimeout?.cancel()
        chatLocationTimeout = nil
        let continuation = chatLocationContinuation
        chatLocationContinuation = nil
        continuation?.resume(returning: coordinate)
    }

    private func chatFailureMessage(_ error: Error) -> String {
        if let workerError = error as? LocalizedError,
           let detail = workerError.errorDescription,
           !detail.isEmpty {
            return detail
        }
        if !mobileChatAccessEnabled && !companionPaired {
            return "Pair Sentinel or enable AI Chat in Mobile Service Access, then try again."
        }
        if !mobileChatAccessEnabled {
            return "Sentinel could not reach the desktop bridge. AI Chat permission is not enabled for Cloudflare fallback."
        }
        return "Sentinel could not respond. Check your connection and try again."
    }

    private func loadCachedWeather() {
        if let data = UserDefaults.standard.data(forKey: "sentinelRadarMetadata"), let saved = try? JSONDecoder().decode(SentinelRadarMetadata.self, from: data) {
            radarMetadata = saved.sorted
            radarFrameCount = saved.frames.count
            radarLatestFrame = saved.frames.last?.date.formatted(date: .omitted, time: .shortened) ?? "No frames"
            radarStatus = "Showing cached radar metadata."
        }
        guard let data =
                UserDefaults.standard.data(
                    forKey: "sentinelCachedWeather"
                ),
              let cached =
                try? JSONDecoder().decode(
                    SentinelWeather.self,
                    from: data
                ) else {
            return
        }

        weather = cached

        weatherUpdatedAt =
            UserDefaults.standard.object(
                forKey: "sentinelCachedWeatherDate"
            ) as? Date

        weatherStatus = weatherUpdatedAt.map {
            "Showing saved conditions from \($0.formatted(date: .abbreviated, time: .shortened))."
        } ?? "Showing saved conditions."
    }

    private func persistWeather() {
        guard let weather,
              let data = try? JSONEncoder().encode(weather) else {
            return
        }

        UserDefaults.standard.set(
            data,
            forKey: "sentinelCachedWeather"
        )

        UserDefaults.standard.set(
            weatherUpdatedAt ?? Date(),
            forKey: "sentinelCachedWeatherDate"
        )
    }

    private func loadTrips() {
        guard let data =
                UserDefaults.standard.data(forKey: "sentinelTrips"),
              let saved =
                try? JSONDecoder().decode(
                    [SentinelTrip].self,
                    from: data
                ) else {
            return
        }

        trips = saved.sorted {
            $0.date < $1.date
        }
    }

    private func saveTrips() {
        trips.sort {
            $0.date < $1.date
        }

        if let data = try? JSONEncoder().encode(trips) {
            UserDefaults.standard.set(
                data,
                forKey: "sentinelTrips"
            )
        }
    }

    private func loadFlights() {
        guard let data =
                UserDefaults.standard.data(forKey: "sentinelFlights"),
              let saved =
                try? JSONDecoder().decode(
                    [SentinelFlight].self,
                    from: data
                ) else {
            return
        }

        flights = saved.sorted {
            $0.date < $1.date
        }
        if let data = UserDefaults.standard.data(forKey: "sentinelCachedFlightStatus"), let cached = try? JSONDecoder().decode(SentinelAviationFlight.self, from: data) { flightStatus = cached }
        if let data = UserDefaults.standard.data(forKey: "sentinelCachedAircraft"), let cached = try? JSONDecoder().decode([SentinelAircraft].self, from: data) { aircraft = cached; aircraftStatus = "Showing cached aircraft." }
    }

    private func saveFlights() {
        flights.sort {
            $0.date < $1.date
        }

        if let data = try? JSONEncoder().encode(flights) {
            UserDefaults.standard.set(
                data,
                forKey: "sentinelFlights"
            )
        }
    }

    private func recordActivity(
        _ title: String,
        detail: String,
        symbol: String
    ) {
        activity.insert(
            SentinelActivity(
                title: title,
                detail: detail,
                symbol: symbol
            ),
            at: 0
        )

        activity = Array(activity.prefix(50))
        persistActivity()
    }

    private func persistActivity() {
        if let data = try? JSONEncoder().encode(activity) {
            UserDefaults.standard.set(
                data,
                forKey: "sentinelActivity"
            )
        }
    }
}

struct SentinelActivity: Identifiable, Codable {
    let id: UUID
    let title: String
    let detail: String
    let symbol: String
    let date: Date
    var isRead: Bool

    init(
        title: String,
        detail: String,
        symbol: String,
        date: Date = .now
    ) {
        id = UUID()
        self.title = title
        self.detail = detail
        self.symbol = symbol
        self.date = date
        isRead = false
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case title
        case detail
        case symbol
        case date
        case isRead
    }

    init(from decoder: Decoder) throws {
        let values =
            try decoder.container(keyedBy: CodingKeys.self)

        id = try values.decode(UUID.self, forKey: .id)
        title = try values.decode(String.self, forKey: .title)
        detail = try values.decode(String.self, forKey: .detail)
        symbol = try values.decode(String.self, forKey: .symbol)
        date = try values.decode(Date.self, forKey: .date)

        isRead =
            try values.decodeIfPresent(
                Bool.self,
                forKey: .isRead
            ) ?? false
    }
}

struct SentinelTrip: Identifiable, Codable {
    let id: UUID
    let title: String
    let date: Date
    let notes: String

    init(title: String, date: Date, notes: String) {
        id = UUID()
        self.title = title
        self.date = date
        self.notes = notes
    }
}

struct SentinelFlight: Identifiable, Codable {
    let id: UUID
    let number: String
    let departure: String
    let arrival: String
    let date: Date
    let terminal: String

    init(
        number: String,
        departure: String,
        arrival: String,
        date: Date,
        terminal: String
    ) {
        id = UUID()
        self.number = number
        self.departure = departure
        self.arrival = arrival
        self.date = date
        self.terminal = terminal
    }
}

struct SentinelPlaceResult: Identifiable, Decodable {
    struct Geometry: Decodable { struct Location: Decodable { let lat: Double; let lng: Double }; let location: Location }
    struct OpeningHours: Decodable { let openNow: Bool?; enum CodingKeys: String, CodingKey { case openNow = "open_now" } }
    let name: String
    let formattedAddress: String?
    let geometry: Geometry
    let rating: Double?
    let userRatingsTotal: Int?
    let openingHours: OpeningHours?
    let placeID: String?
    let types: [String]?
    enum CodingKeys: String, CodingKey { case name, formattedAddress = "formatted_address", geometry, rating, userRatingsTotal = "user_ratings_total", openingHours = "opening_hours", placeID = "place_id", types }
    var id: String { placeID ?? "\(name)-\(latitude)-\(longitude)" }
    var latitude: Double { geometry.location.lat }
    var longitude: Double { geometry.location.lng }
    var isUK: Bool { formattedAddress?.localizedCaseInsensitiveContains("UK") == true || formattedAddress?.localizedCaseInsensitiveContains("United Kingdom") == true }
}

struct SentinelSavedPlace: Identifiable, Codable {
    let id: UUID
    var name: String
    let address: String?
    let latitude: Double
    let longitude: Double
    init(id: UUID = UUID(), name: String, address: String?, latitude: Double, longitude: Double) { self.id = id; self.name = name; self.address = address; self.latitude = latitude; self.longitude = longitude }
}

struct SentinelPlacesResponse: Decodable {
    let status: String
    let errorMessage: String?
    let results: [SentinelPlaceResult]
    enum CodingKeys: String, CodingKey { case status, errorMessage = "error_message", results }
}

struct SentinelAviationResponse: Codable { let data: [SentinelAviationFlight] }
struct SentinelAviationFlight: Identifiable, Codable {
    struct Airline: Codable { let name: String?; let iata: String? }
    struct Flight: Codable { let iata: String?; let icao: String?; let codeshared: [String: String]? }
    struct Airport: Codable { let airport: String?; let iata: String?; let terminal: String?; let gate: String?; let scheduled: String?; let estimated: String?; let actual: String?; let delay: Int?; let baggage: String?; let timezone: String? }
    struct Aircraft: Codable { let registration: String?; let iata: String?; let icao: String? }
    struct Live: Codable { let latitude: Double?; let longitude: Double?; let altitude: Double?; let speedHorizontal: Double?; let direction: Double?; let updated: String?; enum CodingKeys: String, CodingKey { case latitude, longitude, altitude, speedHorizontal = "speed_horizontal", direction, updated } }
    let airline: Airline?; let flight: Flight?; let flightStatus: String?; let departure: Airport?; let arrival: Airport?; let aircraft: Aircraft?; let live: Live?
    enum CodingKeys: String, CodingKey { case airline, flight, flightStatus = "flight_status", departure, arrival, aircraft, live }
    var id: String { flight?.iata ?? flight?.icao ?? "unknown-flight" }
}

struct SentinelAircraft: Identifiable, Codable {
    let icao24: String; let callsign: String; let country: String; let longitude: Double; let latitude: Double; let altitudeMetres: Double?; let velocityMetresPerSecond: Double?; let heading: Double?; let verticalRate: Double?; let onGround: Bool; let squawk: String?; let lastContact: Int?
    var id: String { icao24 }
    var altitudeFeet: Int? { altitudeMetres.map { Int($0 * 3.28084) } }
    var speedKnots: Int? { velocityMetresPerSecond.map { Int($0 * 1.94384) } }
    static func decodeList(from data: Data) -> [Self] {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let states = object["states"] as? [[Any]] else { return [] }
        return states.compactMap { state in
            guard state.count > 10, let icao = state[0] as? String, let longitude = state[5] as? Double, let latitude = state[6] as? Double else { return nil }
            return Self(icao24: icao, callsign: (state[1] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "Unknown", country: state[2] as? String ?? "Unknown", longitude: longitude, latitude: latitude, altitudeMetres: state[13] as? Double ?? state[7] as? Double, velocityMetresPerSecond: state[9] as? Double, heading: state[10] as? Double, verticalRate: state[11] as? Double, onGround: state[8] as? Bool ?? false, squawk: state.count > 14 ? state[14] as? String : nil, lastContact: state[4] as? Int)
        }
    }
}

struct SentinelLocalSystem {
    let deviceName: String
    let systemVersion: String
    let batteryLevel: Int?
    let batteryState: String
    let uptime: TimeInterval

    static func capture() -> Self {
        let device = UIDevice.current

        let level =
            device.batteryLevel >= 0
            ? Int((device.batteryLevel * 100).rounded())
            : nil

        let state: String = switch device.batteryState {
        case .charging:
            "Charging"
        case .full:
            "Fully charged"
        case .unplugged:
            "On battery"
        default:
            "Unavailable"
        }

        return Self(
            deviceName: device.name,
            systemVersion: "iOS \(device.systemVersion)",
            batteryLevel: level,
            batteryState: state,
            uptime: ProcessInfo.processInfo.systemUptime
        )
    }
}

private struct SentinelClipboardPayload: Decodable {
    let text: String?
    let clipboard: String?
    let value: String?
    let message: String?
    let item: ClipboardItem?
    let items: [ClipboardItem]?

    struct ClipboardItem: Decodable {
        let id: String?
        let kind: String?
        let text: String?
        let sourceName: String?
        let createdAt: String?
    }

    static func text(from data: Data) -> String {
        let decoder = JSONDecoder()

        if let directItems =
            try? decoder.decode(
                [ClipboardItem].self,
                from: data
            ) {
            return latestDesktopText(from: directItems)
        }

        if let payload =
            try? decoder.decode(
                Self.self,
                from: data
            ) {
            let directValues: [String?] = [
                payload.text,
                payload.clipboard,
                payload.value,
                payload.message
            ]

            if let directText =
                directValues
                    .compactMap({ value in
                        value?.trimmingCharacters(
                            in: .whitespacesAndNewlines
                        )
                    })
                    .first(where: { !$0.isEmpty }) {
                return directText
            }

            if let itemText =
                payload.item?.text?
                    .trimmingCharacters(
                        in: .whitespacesAndNewlines
                    ),
               !itemText.isEmpty {
                return itemText
            }

            if let items = payload.items {
                return latestDesktopText(from: items)
            }
        }

        if let object =
            try? JSONSerialization.jsonObject(with: data),
           object is [String: Any] ||
            object is [[String: Any]] {
            return ""
        }

        return String(data: data, encoding: .utf8)?
            .trimmingCharacters(
                in: .whitespacesAndNewlines
            ) ?? ""
    }

    private static func latestDesktopText(
        from items: [ClipboardItem]
    ) -> String {
        let textItems =
            items
                .filter {
                    let kindMatches =
                        $0.kind == nil || $0.kind == "text"

                    let cleanText =
                        $0.text?.trimmingCharacters(
                            in: .whitespacesAndNewlines
                        ) ?? ""

                    return kindMatches && !cleanText.isEmpty
                }
                .sorted {
                    ($0.createdAt ?? "") >
                    ($1.createdAt ?? "")
                }

        let desktopItem =
            textItems.first {
                ($0.sourceName ?? "")
                    .localizedCaseInsensitiveContains("desktop")
            }

        return (desktopItem ?? textItems.first)?
            .text?
            .trimmingCharacters(
                in: .whitespacesAndNewlines
            ) ?? ""
    }
}

struct SentinelRemoteFile: Identifiable, Decodable {
    let id: String
    let name: String
    let byteCount: Int?
    let createdAt: Date?

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case filename
        case byteCount
        case size
        case sizeBytes
        case createdAt
    }

    init(from decoder: Decoder) throws {
        let values =
            try decoder.container(keyedBy: CodingKeys.self)

        id = try values.decode(String.self, forKey: .id)

        name =
            (try? values.decode(String.self, forKey: .name))
            ?? (try? values.decode(String.self, forKey: .filename))
            ?? "Unnamed file"

        byteCount =
            (try? values.decode(Int.self, forKey: .byteCount))
            ?? (try? values.decode(Int.self, forKey: .sizeBytes))
            ?? (try? values.decode(Int.self, forKey: .size))

        createdAt =
            try? values.decode(Date.self, forKey: .createdAt)
    }

    static func decodeList(from data: Data) throws -> [Self] {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        if let list =
            try? decoder.decode([Self].self, from: data) {
            return list
        }

        if let container =
            try? decoder.decode(Container.self, from: data) {
            return container.files ?? container.items ?? []
        }

        return []
    }

    private struct Container: Decodable {
        let files: [SentinelRemoteFile]?
        let items: [SentinelRemoteFile]?
    }
}

enum SentinelChatMode: String, CaseIterable, Identifiable {
    case assistant = "Sentinel AI"
    case secureCompanion = "Companion Sync"

    var id: String {
        rawValue
    }
}

struct SentinelChatAttachment: Identifiable, Codable {
    let id: UUID
    let name: String
    let mimeType: String
    let data: String
    let byteCount: Int
    init(id: UUID = UUID(), name: String, mimeType: String, data: String, byteCount: Int) { self.id = id; self.name = name; self.mimeType = mimeType; self.data = data; self.byteCount = byteCount }
    var isImage: Bool { mimeType.hasPrefix("image/") }
}

struct SentinelChatAction: Identifiable, Codable {
    let id: String
    let type: String
    let label: String?
    let page: String?
    let query: String?
    let latitude: Double?
    let longitude: Double?
    let flight: String?
}

struct SentinelChatCard: Identifiable, Codable {
    let id: String
    let type: String
    let title: String?
    let subtitle: String?
    let detail: String?
    let value: String?
}

/// Native, on-device speech capture. Audio is never sent anywhere except the final
/// user-approved transcription through the existing chat request.
final class SentinelVoiceInput: NSObject {
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en_GB"))
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private(set) var isListening = false

    func start(onPartial: @escaping (String) -> Void, onFinal: @escaping (String) -> Void, onError: @escaping (String) -> Void) {
        SFSpeechRecognizer.requestAuthorization { [weak self] speechStatus in
            guard speechStatus == .authorized else { onError("Speech recognition is disabled. Enable it in iPhone Settings."); return }
            AVAudioApplication.requestRecordPermission { granted in
                guard granted else { onError("Microphone access is disabled. Enable it in iPhone Settings."); return }
                DispatchQueue.main.async { self?.begin(onPartial: onPartial, onFinal: onFinal, onError: onError) }
            }
        }
    }

    private func begin(onPartial: @escaping (String) -> Void, onFinal: @escaping (String) -> Void, onError: @escaping (String) -> Void) {
        stop()
        guard let recognizer, recognizer.isAvailable else { onError("Speech recognition is currently unavailable."); return }
        let request = SFSpeechAudioBufferRecognitionRequest(); request.shouldReportPartialResults = true
        self.request = request
        let input = audioEngine.inputNode
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { buffer, _ in request.append(buffer) }
        do { try AVAudioSession.sharedInstance().setCategory(.record, mode: .measurement); try AVAudioSession.sharedInstance().setActive(true, options: .notifyOthersOnDeactivation); audioEngine.prepare(); try audioEngine.start(); isListening = true } catch { stop(); onError("Sentinel could not start the microphone."); return }
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            let text = result?.bestTranscription.formattedString ?? ""
            if !text.isEmpty { onPartial(text) }
            if result?.isFinal == true { self?.stop(); onFinal(text) }
            else if error != nil { self?.stop(); if !text.isEmpty { onFinal(text) } else { onError("Voice recognition did not return a message.") } }
        }
    }

    func stop() { audioEngine.stop(); audioEngine.inputNode.removeTap(onBus: 0); request?.endAudio(); task?.cancel(); request = nil; task = nil; isListening = false; try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) }
}

struct SentinelChatMessage: Identifiable, Codable {
    enum Role: String, Codable {
        case user
        case assistant
    }

    let id: UUID
    let role: Role
    let text: String
    let attachments: [SentinelChatAttachment]
    let generatedImages: [SentinelGeneratedImage]

    init(id: UUID = UUID(), role: Role, text: String, attachments: [SentinelChatAttachment] = [], generatedImages: [SentinelGeneratedImage] = []) {
        self.id = id
        self.role = role
        self.text = text
        self.attachments = attachments
        self.generatedImages = generatedImages
    }

    enum CodingKeys: String, CodingKey { case id, role, text, attachments, generatedImages }
    init(from decoder: Decoder) throws { let c = try decoder.container(keyedBy: CodingKeys.self); id = try c.decode(UUID.self, forKey: .id); role = try c.decode(Role.self, forKey: .role); text = try c.decode(String.self, forKey: .text); attachments = try c.decodeIfPresent([SentinelChatAttachment].self, forKey: .attachments) ?? []; generatedImages = try c.decodeIfPresent([SentinelGeneratedImage].self, forKey: .generatedImages) ?? [] }

    var apiRole: String { role.rawValue }
}

struct SentinelGeneratedImage: Identifiable, Codable {
    let id: UUID
    let prompt: String
    let revisedPrompt: String?
    let filename: String

    init(id: UUID = UUID(), prompt: String, revisedPrompt: String?, filename: String) { self.id = id; self.prompt = prompt; self.revisedPrompt = revisedPrompt; self.filename = filename }

    var fileURL: URL? {
        guard filename == URL(fileURLWithPath: filename).lastPathComponent,
              let support = try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: false) else { return nil }
        return support.appendingPathComponent("Sentinel/GeneratedImages", isDirectory: true).appendingPathComponent(filename)
    }
}

enum SentinelPage: String, CaseIterable, Identifiable {
    case home = "Home"
    case chat = "Chat"
    case navigation = "Navigation"
    case travel = "Travel"
    case weather = "Weather"
    case notifications = "Notifications"
    case settings = "Settings"
    case system = "System"

    static let corePages: [SentinelPage] = [
        .home,
        .chat,
        .navigation,
        .travel,
        .weather,
        .notifications,
        .settings,
        .system
    ]

    var id: String {
        rawValue
    }

    var symbol: String {
        switch self {
        case .home:
            "house.fill"
        case .chat:
            "message.fill"
        case .navigation:
            "map.fill"
        case .travel:
            "airplane"
        case .weather:
            "cloud.sun.fill"
        case .notifications:
            "bell.fill"
        case .settings:
            "gearshape.fill"
        case .system:
            "iphone"
        }
    }
}

enum SentinelJourneyMode: String, CaseIterable, Identifiable {
    case driving = "Driving", walking = "Walking", transit = "Transit"
    var id: String { rawValue }
    var mapKitType: MKDirectionsTransportType { switch self { case .driving: .automobile; case .walking: .walking; case .transit: .transit } }
    var symbol: String { switch self { case .driving: "car.fill"; case .walking: "figure.walk"; case .transit: "bus.fill" } }
}

enum SentinelAccentTheme: String, CaseIterable, Identifiable {
    case sentinelBlue = "Sentinel Blue", arcCyan = "Arc Cyan", emerald = "Emerald", violet = "Violet", crimson = "Crimson", amber = "Amber", iceWhite = "Ice White", rose = "Rose"
    var id: String { rawValue }
    var uiColor: UIColor {
        switch self {
        case .sentinelBlue: UIColor(red: 0.10, green: 0.80, blue: 1.00, alpha: 1)
        case .arcCyan: UIColor(red: 0.00, green: 0.90, blue: 0.95, alpha: 1)
        case .emerald: UIColor(red: 0.20, green: 0.86, blue: 0.53, alpha: 1)
        case .violet: UIColor(red: 0.61, green: 0.42, blue: 1.00, alpha: 1)
        case .crimson: UIColor(red: 1.00, green: 0.28, blue: 0.36, alpha: 1)
        case .amber: UIColor(red: 1.00, green: 0.66, blue: 0.12, alpha: 1)
        case .iceWhite: UIColor(red: 0.84, green: 0.95, blue: 1.00, alpha: 1)
        case .rose: UIColor(red: 1.00, green: 0.38, blue: 0.67, alpha: 1)
        }
    }
}

enum SentinelReactorAnimation: String, CaseIterable, Identifiable {
    case full = "Full", balanced = "Balanced", minimal = "Minimal", off = "Off"
    var id: String { rawValue }
}

struct SentinelRelease: Decodable, Identifiable {
    var id: String {
        version
    }

    let version: String
    let notes: String?
    let installationPolicy: String?
    let modules: [String]?
    let target: String?
    let mobileContent: SentinelMobileContent?

    var supportsIOS: Bool {
        let cleanTarget =
            target?.lowercased() ?? "both"

        return cleanTarget == "ios" ||
            cleanTarget == "both"
    }
}

struct SentinelMobileContent: Codable {
    let companionProtocolVersion: String?
    let companionTransport: String?
    let serviceAccessMode: String?
    let cloudFileLimit: Int?

    init(
        companionProtocolVersion: String? = nil,
        companionTransport: String? = nil,
        serviceAccessMode: String? = nil,
        cloudFileLimit: Int? = nil
    ) {
        self.companionProtocolVersion =
            companionProtocolVersion

        self.companionTransport =
            companionTransport

        self.serviceAccessMode =
            serviceAccessMode

        self.cloudFileLimit =
            cloudFileLimit
    }
}

struct SentinelMobileStatus: Decodable {
    struct Profile: Decodable { let id: String?; let version: String? }
    struct Service: Decodable { let permitted: Bool; let configured: Bool; let available: Bool }
    let online: Bool?
    let serverTime: String?
    let profile: Profile?
    let permissionVersion: Int?
    let tokenExpiresAt: String?
    let services: [String: Service]
    let capabilities: [String: Bool]?
}

enum SentinelDesktopAction: String, CaseIterable, Identifiable {
    case systemCheck = "system_check"
    case securityStatus = "security_status"
    case cameraView = "camera_view"
    case smartHomeControl = "smart_home_control"
    case openPage = "open_page"
    var id: String { rawValue }
}

private struct SentinelDesktopActionRequest: Encodable {
    let action: String
    let target: String?
    let command: String?
    let approved: Bool
}

private struct SentinelDesktopActionResponse: Decodable {
    let queued: Bool
    let completed: Bool?
    let commandID: String?
    let requiresDesktop: Bool?
    let message: String?
    enum CodingKeys: String, CodingKey { case queued, completed, commandID = "commandId", requiresDesktop, message }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

private extension String {
    func isNewer(than installed: String) -> Bool {
        let lhs =
            split(separator: ".").map {
                Int($0) ?? 0
            }

        let rhs =
            installed.split(separator: ".").map {
                Int($0) ?? 0
            }

        for index in 0..<max(lhs.count, rhs.count) {
            let left =
                index < lhs.count
                ? lhs[index]
                : 0

            let right =
                index < rhs.count
                ? rhs[index]
                : 0

            if left != right {
                return left > right
            }
        }

        return false
    }
}
