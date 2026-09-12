import { ipcRenderer, contextBridge } from "electron";

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) =>
      listener(event, ...args),
    );
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },

  // You can expose other APTs you need here.
  // ...
});

contextBridge.exposeInMainWorld("sentinelDesktop", {
  exportConversation(input: { title: string; content: string; created: string; updated: string }) {
    return ipcRenderer.invoke("sentinel:conversation-export", input) as Promise<{ path?: string; cancelled?: boolean }>;
  },
  integrationCommand(input: {id:string;commandId:string;deviceId:string;value:string}) {
    return ipcRenderer.invoke('sentinel:integration-command',input);
  },
  shutdown() {
    return ipcRenderer.invoke("sentinel:shutdown") as Promise<{
      closing: true;
    }>;
  },
  restart() {
    return ipcRenderer.invoke("sentinel:restart") as Promise<{
      restarting: true;
    }>;
  },
  mediaStatus() {
    return ipcRenderer.invoke("sentinel:media-status") as Promise<{
      available: boolean;
      devices: Array<{ name: string; status: string }>;
    }>;
  },
  mediaCommand(
    command:
      | "previous"
      | "next"
      | "playPause"
      | "stop"
      | "mute"
      | "volumeDown"
      | "volumeUp",
  ) {
    return ipcRenderer.invoke("sentinel:media-command", command) as Promise<{
      sent: true;
      command: string;
    }>;
  },
  openMediaService(service: string) {
    return ipcRenderer.invoke("sentinel:media-open", service) as Promise<{
      opened: true;
    }>;
  },
  virtualDJStatus() {
    return ipcRenderer.invoke("sentinel:virtualdj-status") as Promise<{ installed: boolean; running: boolean; executable: string | null; tidalConfigured: boolean; bridge: "connected" | "not-connected"; bridgeConfigured: boolean; bridgePort: number; bridgeError: string; sampledAt?: string; crossfader?: string; decks: Array<{ deck: string; title: string; artist: string; bpm: string; key: string; playing: string; elapsed?: string; duration?: string }> }>;
  },
  launchVirtualDJ() {
    return ipcRenderer.invoke("sentinel:virtualdj-launch") as Promise<{ launched: boolean; downloadOpened: boolean; focused?: boolean }>;
  },
  configureVirtualDJBridge(port: number, password: string) {
    return ipcRenderer.invoke("sentinel:virtualdj-bridge-configure", port, password) as Promise<{ saved: boolean; configured: boolean; connected: boolean; port: number; error: string }>;
  },
  virtualDJCommand(command: "playPause" | "automix" | "mixNext" | "skip" | "mixNow" | "stop" | "sync" | "loop4" | "echo" | "filter" | "prepareShow" | "startShow" | "pauseShow" | "cueNext" | "transitionFx" | "energyBoost" | "endShow", deck = 0) {
    return ipcRenderer.invoke("sentinel:virtualdj-command", command, deck) as Promise<{ sent: boolean; response: string }>;
  },
  openDeveloperTools(developerToken: string) {
    return ipcRenderer.invoke(
      "sentinel:open-developer-tools",
      developerToken,
    ) as Promise<{ opened: boolean; error?: string }>;
  },
  openSourceInVSCode(developerToken: string) {
    return ipcRenderer.invoke(
      "sentinel:open-source-in-vscode",
      developerToken,
    ) as Promise<{ opened: boolean; sourceRoot?: string; error?: string }>;
  },
  codexStatus(developerToken: string) {
    return ipcRenderer.invoke("sentinel:codex-status", developerToken) as Promise<{ available: boolean; authenticated: boolean; version?: string; error?: string }>;
  },
  codexChat(developerToken: string, prompt: string) {
    return ipcRenderer.invoke("sentinel:codex-chat", developerToken, prompt) as Promise<{ reply: string }>;
  },
  updateStatus() {
    return ipcRenderer.invoke("sentinel:update-status") as Promise<{
      currentVersion: string;
      edition: "personal" | "base";
      signingKeyReady: boolean;
      authorityApproved: boolean;
      pending: { version: string; releaseType?: "module" | "maintenance" | "full"; modules?: string[]; notes?: string; installationPolicy?: "optional" | "required" } | null;
      canRollback: boolean;
      publisherConfigured: boolean;
    }>;
  },
  checkForUpdates(manual = false) {
    return ipcRenderer.invoke("sentinel:update-check", manual);
  },
  downloadUpdate(version: string) {
    return ipcRenderer.invoke("sentinel:update-download", version);
  },
  deferUpdate(version: string) {
    return ipcRenderer.invoke("sentinel:update-defer", version);
  },
  declineUpdate(version: string) {
    return ipcRenderer.invoke("sentinel:update-decline", version);
  },
  configureUpdatePublisher(developerToken: string, endpoint: string, token: string) {
    return ipcRenderer.invoke("sentinel:update-configure-publisher", developerToken, endpoint, token) as Promise<{ configured: boolean; endpoint: string }>;
  },
  updatePublisherStatus(developerToken: string) {
    return ipcRenderer.invoke("sentinel:update-publisher-status", developerToken) as Promise<{ configured: boolean; connected: boolean; endpoint?: string; latestVersion?: string; publishedAt?: string; installations?: Array<{ installationId: string; platform: "windows" | "ios"; deviceName: string; appVersion: string; contentVersion: string; lastSeenAt: string }>; error?: string }>;
  },
  publishUpdate(developerToken: string, packagePath: string) {
    return ipcRenderer.invoke("sentinel:update-publish", developerToken, packagePath) as Promise<{ published: boolean; version: string; installationPolicy: "optional" | "required" }>;
  },
  updateReleaseCatalog() {
    return ipcRenderer.invoke("sentinel:update-release-catalog") as Promise<{
      modules: Array<{ id: string; label: string; description: string; group: "Core" | "Pages" | "Integrations"; dependencies: string[]; risk: "low" | "medium" | "high"; detected?: boolean; newlyDetected?: boolean }>;
      blocked: string[];
    }>;
  },
  configureXcodeCloud(developerToken: string, issuerId: string, keyId: string, workflowId: string) {
    return ipcRenderer.invoke("sentinel:xcode-cloud-configure", developerToken, issuerId, keyId, workflowId) as Promise<{ configured: boolean; connected?: boolean; workflowId?: string; cancelled?: boolean }>;
  },
  xcodeCloudStatus(developerToken: string) {
    return ipcRenderer.invoke("sentinel:xcode-cloud-status", developerToken) as Promise<{ configured: boolean; connected: boolean; workflowId?: string; workflowName?: string; latestRun?: { id: string; executionProgress?: string; completionStatus?: string; createdDate?: string; startedDate?: string; finishedDate?: string } | null; testFlight?: { state: "waiting" | "assigned"; buildNumber?: string; groupName?: string; message: string }; error?: string }>;
  },
  disconnectXcodeCloud(developerToken: string) {
    return ipcRenderer.invoke("sentinel:xcode-cloud-disconnect", developerToken) as Promise<{ disconnected: boolean }>;
  },
  startXcodeCloudBuild(developerToken: string) {
    return ipcRenderer.invoke("sentinel:xcode-cloud-start", developerToken) as Promise<{ started: boolean; runId?: string; createdDate?: string }>;
  },
  createUpdateSigningKey(developerToken: string) {
    return ipcRenderer.invoke(
      "sentinel:update-create-key",
      developerToken,
    ) as Promise<{ ready: boolean }>;
  },
  exportUpdatePublicKey(developerToken: string) {
    return ipcRenderer.invoke(
      "sentinel:update-export-public-key",
      developerToken,
    ) as Promise<{ path?: string; cancelled?: boolean }>;
  },
  createUpdatePackage(developerToken: string, version: string, releasePlan?: { releaseType: "module" | "maintenance" | "full"; modules: string[]; notes: string; installationPolicy: "optional" | "required"; target?: "desktop" | "ios" | "both"; audience?: "test" | "all"; testInstallationId?: string }) {
    return ipcRenderer.invoke(
      "sentinel:update-create-package",
      developerToken,
      version,
      releasePlan,
    ) as Promise<{ path?: string; version?: string; cancelled?: boolean }>;
  },
  buildUpdatePackage(developerToken: string, version: string, releasePlan?: { releaseType: "module" | "maintenance" | "full"; modules: string[]; notes: string; installationPolicy: "optional" | "required"; target?: "desktop" | "ios" | "both"; audience?: "test" | "all"; testInstallationId?: string }) {
    return ipcRenderer.invoke(
      "sentinel:update-build-package",
      developerToken,
      version,
      releasePlan,
    ) as Promise<{
      path?: string;
      version?: string;
      installerPath?: string;
      cancelled?: boolean;
    }>;
  },
  importUpdateAuthority(developerToken: string) {
    return ipcRenderer.invoke(
      "sentinel:update-import-authority",
      developerToken,
    ) as Promise<{ approved?: boolean; cancelled?: boolean }>;
  },
  selectUpdatePackage() {
    return ipcRenderer.invoke("sentinel:update-select-package") as Promise<{
      version?: string;
      cancelled?: boolean;
    }>;
  },
  installUpdate(developerToken: string, usePrevious = false) {
    return ipcRenderer.invoke(
      "sentinel:update-install",
      developerToken,
      usePrevious,
    ) as Promise<{ installing?: boolean; version?: string }>;
  },
});
