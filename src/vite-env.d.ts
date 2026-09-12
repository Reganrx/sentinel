/// <reference types="vite/client" />

interface Window {
  sentinelDesktop?: {
    exportConversation: (input: { title: string; content: string; created: string; updated: string }) => Promise<{ path?: string; cancelled?: boolean }>;
    shutdown: () => Promise<{ closing: true }>;
    restart: () => Promise<{ restarting: true }>;
    mediaStatus: () => Promise<{
      available: boolean;
      devices: Array<{ name: string; status: string }>;
    }>;
    mediaCommand: (
      command:
        | "previous"
        | "next"
        | "playPause"
        | "stop"
        | "mute"
        | "volumeDown"
        | "volumeUp",
    ) => Promise<{ sent: true; command: string }>;
    openMediaService: (service: string) => Promise<{ opened: true }>;
    integrationCommand: (input: {id:string;commandId:string;deviceId:string;value:string}) => Promise<{cancelled?:boolean;success?:boolean;status?:number;accepted?:boolean;verified?:boolean}>;
    virtualDJStatus: () => Promise<{ installed: boolean; running: boolean; executable: string | null; tidalConfigured: boolean; bridge: "connected" | "not-connected"; bridgeConfigured: boolean; bridgePort: number; bridgeError: string; sampledAt?: string; crossfader?: string; decks: Array<{ deck: string; title: string; artist: string; bpm: string; key: string; playing: string; elapsed?: string; duration?: string }> }>;
    launchVirtualDJ: () => Promise<{ launched: boolean; downloadOpened: boolean; focused?: boolean }>;
    configureVirtualDJBridge: (port: number, password: string) => Promise<{ saved: boolean; configured: boolean; connected: boolean; port: number; error: string }>;
    virtualDJCommand: (command: "playPause" | "automix" | "mixNext" | "skip" | "mixNow" | "stop" | "sync" | "loop4" | "echo" | "filter" | "prepareShow" | "startShow" | "pauseShow" | "cueNext" | "transitionFx" | "energyBoost" | "endShow", deck?: number) => Promise<{ sent: boolean; response: string }>;
    openDeveloperTools: (
      developerToken: string,
    ) => Promise<{ opened: boolean; error?: string }>;
    openSourceInVSCode: (
      developerToken: string,
    ) => Promise<{ opened: boolean; sourceRoot?: string; error?: string }>;
    codexStatus: (developerToken: string) => Promise<{ available: boolean; authenticated: boolean; version?: string; error?: string }>;
    codexChat: (developerToken: string, prompt: string) => Promise<{ reply: string }>;
    updateStatus: () => Promise<{
      currentVersion: string;
      edition: "personal" | "base";
      signingKeyReady: boolean;
      authorityApproved: boolean;
      pending: { version: string; releaseType?: "module" | "maintenance" | "full"; modules?: string[]; notes?: string; installationPolicy?: "optional" | "required" } | null;
      canRollback: boolean;
      publisherConfigured: boolean;
    }>;
    checkForUpdates: (manual?: boolean) => Promise<{
      available: boolean;
      currentVersion: string;
      release?: {
        version: string;
        notes?: string;
        releaseType?: "module" | "maintenance" | "full";
        modules?: string[];
        installationPolicy?: "optional" | "required";
        publishedAt?: string;
      };
      declined?: boolean;
      deferred?: boolean;
      suppressed?: boolean;
    }>;
    downloadUpdate: (version: string) => Promise<{ downloaded: boolean; version: string }>;
    deferUpdate: (version: string) => Promise<{ deferred: boolean }>;
    declineUpdate: (version: string) => Promise<{ declined: boolean }>;
    configureUpdatePublisher: (developerToken: string, endpoint: string, token: string) => Promise<{ configured: boolean; endpoint: string }>;
    updatePublisherStatus: (developerToken: string) => Promise<{ configured: boolean; connected: boolean; endpoint?: string; latestVersion?: string; publishedAt?: string; installations?: Array<{ installationId: string; platform: "windows" | "ios"; deviceName: string; appVersion: string; contentVersion: string; lastSeenAt: string }>; error?: string }>;
    publishUpdate: (developerToken: string, packagePath: string) => Promise<{ published: boolean; version: string; installationPolicy: "optional" | "required" }>;
    updateReleaseCatalog: () => Promise<{
      modules: Array<{
        id: string;
        label: string;
        description: string;
        group: "Core" | "Pages" | "Integrations";
        dependencies: string[];
        risk: "low" | "medium" | "high";
        detected?: boolean;
        newlyDetected?: boolean;
      }>;
      blocked: string[];
    }>;
    configureXcodeCloud: (developerToken: string, issuerId: string, keyId: string, workflowId: string) => Promise<{ configured: boolean; connected?: boolean; workflowId?: string; cancelled?: boolean }>;
    xcodeCloudStatus: (developerToken: string) => Promise<{ configured: boolean; connected: boolean; workflowId?: string; workflowName?: string; latestRun?: { id: string; executionProgress?: string; completionStatus?: string; createdDate?: string; startedDate?: string; finishedDate?: string } | null; testFlight?: { state: "waiting" | "assigned"; buildNumber?: string; groupName?: string; message: string }; error?: string }>;
    disconnectXcodeCloud: (developerToken: string) => Promise<{ disconnected: boolean }>;
    startXcodeCloudBuild: (developerToken: string) => Promise<{ started: boolean; runId?: string; createdDate?: string }>;
    createUpdateSigningKey: (
      developerToken: string,
    ) => Promise<{ ready: boolean }>;
    exportUpdatePublicKey: (
      developerToken: string,
    ) => Promise<{ path?: string; cancelled?: boolean }>;
    createUpdatePackage: (
      developerToken: string,
      version: string,
      releasePlan?: { releaseType: "module" | "maintenance" | "full"; modules: string[]; notes: string; installationPolicy: "optional" | "required"; target?: "desktop" | "ios" | "both"; audience?: "test" | "all"; testInstallationId?: string },
    ) => Promise<{ path?: string; version?: string; cancelled?: boolean }>;
    buildUpdatePackage: (
      developerToken: string,
      version: string,
      releasePlan?: { releaseType: "module" | "maintenance" | "full"; modules: string[]; notes: string; installationPolicy: "optional" | "required"; target?: "desktop" | "ios" | "both"; audience?: "test" | "all"; testInstallationId?: string },
    ) => Promise<{
      path?: string;
      version?: string;
      installerPath?: string;
      cancelled?: boolean;
    }>;
    importUpdateAuthority: (
      developerToken: string,
    ) => Promise<{ approved?: boolean; cancelled?: boolean }>;
    selectUpdatePackage: () => Promise<{
      version?: string;
      cancelled?: boolean;
    }>;
    installUpdate: (
      developerToken: string,
      usePrevious?: boolean,
    ) => Promise<{ installing?: boolean; version?: string }>;
  };
}
