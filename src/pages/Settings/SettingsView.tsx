import { useEffect, useState } from "react";
import StartupScenes from "../../components/StartupScenes";
import {
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Database,
  Download,
  KeyRound,
  Link2,
  Lock,
  Activity,
  AlertTriangle,
  MapPin,
  Monitor,
  PackageCheck,
  Palette,
  Play,
  RotateCcw,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Unlock,
  Upload,
  Volume2,
  Ear,
  Trash2,
  X,
} from "lucide-react";
import {
  getDeveloperStatus,
  getDeveloperToken,
  lockDeveloperMode,
  unlockDeveloperMode,
} from "../../services/developer";
import { useSoundEffects } from "../../audio/SoundEffectsContext";
import {
  getLocationStatus,
  type LocationStatus,
  updateLocation,
} from "../../services/location";
import {
  disableCompanion,
  enableCompanion,
  createCompanionPairingCode,
  revokeCompanionDevice,
  listCompanionItems,
  sendCompanionText,
  sendCompanionFile,
  downloadCompanionItem,
  deleteCompanionItem,
  type CompanionItem,
  getCompanionStatus,
  getMobileAccessStatus,
  provisionMobileAccess,
  revokeMobileAccess,
  type CompanionStatus,
  type MobileAccessStatus,
  type MobileServiceId,
} from "../../services/automation";
import "./SettingsView.css";
import SetupCentre from "./SetupCentre";
import { availableNavigation as navigation } from "../../navigation/navigation";
import { API_URL } from "../../services/api";
import { setPageVisible, useHiddenPages } from "../../services/pageVisibility";
import { clearWakeActivity, defaultSleepPhrases, defaultWakePhrases, getWakeActivity, SLEEP_PHRASES_KEY, WAKE_ACTIVITY_KEY, WAKE_ENABLED_KEY, WAKE_PHRASES_KEY, WAKE_SENSITIVITY_KEY, WAKE_TONES_KEY, type WakeActivity } from "../../services/wakeVoice";
import { useMemory } from "../../memory/MemoryContext";

type Notice = { type: "success" | "error"; text: string } | null;
type AccentTheme = "blue" | "emerald" | "amber" | "purple" | "crimson" | "ice" | "teal" | "magenta" | "indigo";
type MotionLevel = "full" | "reduced" | "off";
const IS_PERSONAL_EDITION = import.meta.env.VITE_SENTINEL_EDITION !== "base";
const ACCENT_THEMES: { id: AccentTheme; label: string; colour: string }[] = [
  { id: "blue", label: "Sentinel Blue", colour: "#55d9ff" },
  { id: "emerald", label: "Emerald", colour: "#42e6a4" },
  { id: "amber", label: "Tactical Amber", colour: "#f6bd4a" },
  { id: "purple", label: "Royal Purple", colour: "#a982ff" },
  { id: "crimson", label: "Crimson", colour: "#ff5c78" },
  { id: "ice", label: "Arctic Ice", colour: "#d9fbff" },
  { id: "teal", label: "Ocean Teal", colour: "#20e0d0" },
  { id: "magenta", label: "Neon Magenta", colour: "#ff4fd8" },
  { id: "indigo", label: "Electric Indigo", colour: "#6f8cff" },
];
type UpdateStatus = {
  currentVersion: string;
  edition: "personal" | "base";
  signingKeyReady: boolean;
  authorityApproved: boolean;
  pending: { version: string; releaseType?: ReleaseType; modules?: string[]; notes?: string; installationPolicy?: "optional" | "required" } | null;
  canRollback: boolean;
  publisherConfigured: boolean;
};
type ReleaseModule = {
  id: string;
  label: string;
  description: string;
  group: "Core" | "Pages" | "Integrations";
  dependencies: string[];
  risk: "low" | "medium" | "high";
  detected?: boolean;
  newlyDetected?: boolean;
};
type ReleaseType = "module" | "maintenance" | "full";
type ReleaseDelivery = "content" | "native";
type ReleaseAudience = "test" | "all";
type BaseInstallation = { installationId: string; platform: "windows" | "ios"; deviceName: string; appVersion: string; contentVersion: string; lastSeenAt: string };
type PublisherStatus = { configured: boolean; connected: boolean; endpoint?: string; latestVersion?: string; publishedAt?: string; installations?: BaseInstallation[]; error?: string };
type XcodeCloudStatus = { configured: boolean; connected: boolean; workflowId?: string; workflowName?: string; latestRun?: { id: string; executionProgress?: string; completionStatus?: string; createdDate?: string; startedDate?: string; finishedDate?: string } | null; error?: string };
type DiagnosticCheck = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  action?: string;
  latencyMs?: number;
  repair?: "refresh-device" | "refresh-world" | "refresh-location";
};
type DiagnosticResult = {
  status: "healthy" | "warning" | "attention";
  checkedAt: string;
  durationMs: number;
  summary: { passed: number; warnings: number; failed: number };
  checks: DiagnosticCheck[];
};

export default function SettingsView() {
  const { openMemory } = useMemory();
  const [isDeveloperUnlocked, setIsDeveloperUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [compactMode, setCompactMode] = useState(
    () => localStorage.getItem("sentinel-compact-mode") === "true",
  );
  const [notifications, setNotifications] = useState(
    () => localStorage.getItem("sentinel-notifications") !== "false",
  );
  const [startupSequence, setStartupSequence] = useState(
    () => localStorage.getItem("sentinel-startup-sequence") !== "false",
  );
  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>(getLocationStatus);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const hiddenPages = useHiddenPages();
  const [visiblePagesOpen, setVisiblePagesOpen] = useState(false);
  const [experienceOpen, setExperienceOpen] = useState(false);
  const [companionOpen, setCompanionOpen] = useState(false);
  const [voicePrivacyOpen, setVoicePrivacyOpen] = useState(false);
  const [wakeEnabled, setWakeEnabled] = useState(() => localStorage.getItem(WAKE_ENABLED_KEY) === "true");
  const [wakePhrases, setWakePhrases] = useState(() => localStorage.getItem(WAKE_PHRASES_KEY) ?? defaultWakePhrases.join(", "));
  const [sleepPhrases, setSleepPhrases] = useState(() => localStorage.getItem(SLEEP_PHRASES_KEY) ?? defaultSleepPhrases.join(", "));
  const [wakeSensitivity, setWakeSensitivity] = useState(() => Number(localStorage.getItem(WAKE_SENSITIVITY_KEY) ?? 60));
  const [wakeTones, setWakeTones] = useState(() => localStorage.getItem(WAKE_TONES_KEY) !== "false");
  const [wakeActivity, setWakeActivity] = useState<WakeActivity[]>(getWakeActivity);
  const [accentTheme, setAccentTheme] = useState<AccentTheme>(() => (localStorage.getItem("sentinel-accent-theme") as AccentTheme) || "blue");
  const [motionLevel, setMotionLevel] = useState<MotionLevel>(() => (localStorage.getItem("sentinel-motion-level") as MotionLevel) || "full");
  const [accentIntensity, setAccentIntensity] = useState(() => Number(localStorage.getItem("sentinel-accent-intensity") ?? 85));
  const [guideOpen, setGuideOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetting, setResetting] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [baseStudioOpen, setBaseStudioOpen] = useState(false);
  const [updateVersion, setUpdateVersion] = useState("1.2.0");
  const [releaseBuildStatus, setReleaseBuildStatus] = useState<{
    type: "idle" | "building" | "success" | "error";
    text: string;
  }>({ type: "idle", text: "" });
  const [releasePublishStatus, setReleasePublishStatus] = useState<{
    type: "idle" | "publishing" | "success" | "error";
    text: string;
  }>({ type: "idle", text: "" });
  const [releaseModules, setReleaseModules] = useState<ReleaseModule[]>([]);
  const [selectedReleaseModules, setSelectedReleaseModules] = useState<string[]>([]);
  const [releaseType, setReleaseType] = useState<ReleaseType>("module");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [installationPolicy, setInstallationPolicy] = useState<"optional" | "required">("optional");
  const [releaseTarget, setReleaseTarget] = useState<"desktop" | "ios" | "both">("desktop");
  const [releaseDelivery, setReleaseDelivery] = useState<ReleaseDelivery>("content");
  const [releaseAudience, setReleaseAudience] = useState<ReleaseAudience>("test");
  const [testInstallationId, setTestInstallationId] = useState("");
  const [testFlightBuild, setTestFlightBuild] = useState(() => localStorage.getItem("sentinel-testflight-build") ?? "");
  const [testFlightUrl, setTestFlightUrl] = useState(() => localStorage.getItem("sentinel-testflight-url") ?? "");
  const [xcodeIssuerId, setXcodeIssuerId] = useState(() => localStorage.getItem("sentinel-xcode-issuer-id") ?? "");
  const [xcodeKeyId, setXcodeKeyId] = useState(() => localStorage.getItem("sentinel-xcode-key-id") ?? "");
  const [xcodeWorkflowId, setXcodeWorkflowId] = useState(() => localStorage.getItem("sentinel-xcode-workflow-id") ?? "");
  const [xcodeCloudStatus, setXcodeCloudStatus] = useState<XcodeCloudStatus | null>(null);
  const [isXcodeCloudBusy, setIsXcodeCloudBusy] = useState(false);
  const [preflightStatus, setPreflightStatus] = useState<{ type: "idle" | "success" | "error"; items: string[] }>({ type: "idle", items: [] });
  const [builtPackagePath, setBuiltPackagePath] = useState("");
  const [publisherEndpoint, setPublisherEndpoint] = useState("");
  const [publisherToken, setPublisherToken] = useState("");
  const [publisherStatus, setPublisherStatus] = useState<PublisherStatus | null>(null);
  const [blockedReleaseFeatures, setBlockedReleaseFeatures] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [companionStatus, setCompanionStatus] =
    useState<CompanionStatus | null>(null);
  const [isCompanionBusy, setIsCompanionBusy] = useState(false);
  const [companionPairing, setCompanionPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [companionText, setCompanionText] = useState("");
  const [companionFile, setCompanionFile] = useState<File | null>(null);
  const [companionItems, setCompanionItems] = useState<CompanionItem[]>([]);
  const [isTransferBusy, setIsTransferBusy] = useState(false);
  const [mobileAccess, setMobileAccess] = useState<MobileAccessStatus | null>(null);
  const [selectedMobileServices, setSelectedMobileServices] = useState<MobileServiceId[]>([]);
  const [isMobileAccessBusy, setIsMobileAccessBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [repairing, setRepairing] = useState<string | null>(null);
  const {
    enabled: soundEffectsEnabled,
    volume: soundEffectsVolume,
    setEnabled: setSoundEffectsEnabled,
    setVolume: setSoundEffectsVolume,
    playNavigation,
  } = useSoundEffects();

  useEffect(() => {
    const refreshWakeActivity = (event: Event) => setWakeActivity((event as CustomEvent<{ activity?: WakeActivity[] }>).detail?.activity ?? getWakeActivity());
    window.addEventListener("sentinel:wake-activity", refreshWakeActivity);
    window.addEventListener("storage", refreshWakeActivity);
    return () => { window.removeEventListener("sentinel:wake-activity", refreshWakeActivity); window.removeEventListener("storage", refreshWakeActivity); };
  }, []);

  useEffect(() => {
    localStorage.setItem(WAKE_PHRASES_KEY, wakePhrases);
    localStorage.setItem(SLEEP_PHRASES_KEY, sleepPhrases);
    localStorage.setItem(WAKE_SENSITIVITY_KEY, String(wakeSensitivity));
    localStorage.setItem(WAKE_TONES_KEY, String(wakeTones));
  }, [wakePhrases, sleepPhrases, wakeSensitivity, wakeTones]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.sentinelTheme = accentTheme;
    root.dataset.sentinelMotion = motionLevel;
    root.style.setProperty("--sentinel-accent-intensity", String(accentIntensity / 100));
    localStorage.setItem("sentinel-accent-theme", accentTheme);
    localStorage.setItem("sentinel-motion-level", motionLevel);
    localStorage.setItem("sentinel-accent-intensity", String(accentIntensity));
  }, [accentTheme, motionLevel, accentIntensity]);

  useEffect(() => {
    const applyVoiceTheme = (event: Event) => {
      const theme = (event as CustomEvent<{ theme?: AccentTheme }>).detail?.theme;
      if (theme && ACCENT_THEMES.some((item) => item.id === theme)) setAccentTheme(theme);
    };
    window.addEventListener("sentinel:theme-change", applyVoiceTheme);
    return () => window.removeEventListener("sentinel:theme-change", applyVoiceTheme);
  }, []);

  useEffect(() => {
    const requestVoiceUnlock = () => {
      setNotice({ type: "success", text: "Voice request received. Enter your Developer Mode password to authorise access." });
      window.setTimeout(() => {
        const input = document.getElementById("developer-password") as HTMLInputElement | null;
        input?.scrollIntoView({ behavior: "smooth", block: "center" });
        input?.focus();
      }, 80);
    };
    const updateVoiceStatus = (event: Event) => {
      const unlocked = Boolean((event as CustomEvent<{ unlocked?: boolean }>).detail?.unlocked);
      setIsDeveloperUnlocked(unlocked);
      if (!unlocked) setNotice({ type: "success", text: "Developer Mode locked by voice command." });
    };
    window.addEventListener("sentinel:developer-unlock-request", requestVoiceUnlock);
    window.addEventListener("sentinel:developer-status-change", updateVoiceStatus);
    return () => {
      window.removeEventListener("sentinel:developer-unlock-request", requestVoiceUnlock);
      window.removeEventListener("sentinel:developer-status-change", updateVoiceStatus);
    };
  }, []);

  useEffect(() => {
    getDeveloperStatus()
      .then((status) => setIsDeveloperUnlocked(status.unlocked))
      .catch(() =>
        setNotice({
          type: "error",
          text: "Sentinel server is unavailable. Developer Mode remains locked.",
        }),
      )
      .finally(() => setIsChecking(false));
  }, []);

  const refreshUpdateStatus = () =>
    window.sentinelDesktop
      ?.updateStatus()
      .then(setUpdateStatus)
      .catch(() => undefined);

  const refreshPublisherStatus = async () => {
    if (!window.sentinelDesktop || !isDeveloperUnlocked) return;
    setIsUpdating(true);
    try {
      const status = await window.sentinelDesktop.updatePublisherStatus(getDeveloperToken());
      setPublisherStatus(status);
      if (status.connected && status.latestVersion) {
        localStorage.setItem("sentinel-display-version", status.latestVersion);
        window.dispatchEvent(new CustomEvent("sentinel:version-updated", {
          detail: { version: status.latestVersion },
        }));
      }
      setNotice(status.connected
        ? { type: "success", text: `Cloud publisher connected${status.latestVersion ? ` · latest Base release ${status.latestVersion}` : " · no release published yet"}.` }
        : { type: "error", text: status.error || "The cloud publisher is not ready." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Could not test the cloud publisher." });
    } finally {
      setIsUpdating(false);
    }
  };

  const refreshXcodeCloudStatus = async () => {
    if (!window.sentinelDesktop || !isDeveloperUnlocked) return;
    try {
      const status = await window.sentinelDesktop.xcodeCloudStatus(getDeveloperToken());
      setXcodeCloudStatus(status);
      if (releaseBuildStatus.type === "building" && status.latestRun?.executionProgress === "COMPLETE") {
        const succeeded = status.latestRun.completionStatus === "SUCCEEDED";
        const distributed = status.testFlight?.state === "assigned";
        setReleaseBuildStatus({
          type: succeeded ? (distributed ? "success" : "building") : "error",
          text: succeeded
            ? status.testFlight?.message || "Xcode Cloud finished successfully. Sentinel is waiting for Apple to process and distribute the TestFlight build."
            : `Xcode Cloud finished with ${status.latestRun.completionStatus || "an unsuccessful result"}. Open the run in App Store Connect for its build log.`,
        });
      }
    }
    catch (error) { setXcodeCloudStatus({ configured: true, connected: false, error: error instanceof Error ? error.message : "Unable to reach Xcode Cloud." }); }
  };

  const configureXcodeCloud = async () => {
    if (!window.sentinelDesktop) return;
    setIsXcodeCloudBusy(true);
    try {
      const result = await window.sentinelDesktop.configureXcodeCloud(getDeveloperToken(), xcodeIssuerId, xcodeKeyId, xcodeWorkflowId);
      if (!result.cancelled) {
        localStorage.setItem("sentinel-xcode-issuer-id", xcodeIssuerId.trim());
        localStorage.setItem("sentinel-xcode-key-id", xcodeKeyId.trim());
        localStorage.setItem("sentinel-xcode-workflow-id", xcodeWorkflowId.trim());
        setNotice({ type: "success", text: "Xcode Cloud connected. Native iPhone builds can now be started from Sentinel Personal." });
        await refreshXcodeCloudStatus();
      }
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to connect Xcode Cloud." }); }
    finally { setIsXcodeCloudBusy(false); }
  };

  const startXcodeCloudBuild = async () => {
    if (!window.sentinelDesktop || !window.confirm("Start a new Apple-signed Sentinel iPhone build in Xcode Cloud?")) return;
    setIsXcodeCloudBusy(true);
    try {
      const result = await window.sentinelDesktop.startXcodeCloudBuild(getDeveloperToken());
      setReleaseBuildStatus({ type: "building", text: `Xcode Cloud build started${result.runId ? ` · ${result.runId}` : ""}. Sentinel can now monitor it without opening Xcode.` });
      setNotice({ type: "success", text: "The iPhone build was submitted to Xcode Cloud." });
      await refreshXcodeCloudStatus();
    } catch (error) { const message = error instanceof Error ? error.message : "Unable to start the Xcode Cloud build."; setReleaseBuildStatus({ type: "error", text: message }); setNotice({ type: "error", text: message }); }
    finally { setIsXcodeCloudBusy(false); }
  };

  const disconnectXcodeCloud = async () => {
    if (!window.sentinelDesktop || !window.confirm("Remove the encrypted Xcode Cloud connection from this PC? You can reconnect with the same or a new .p8 key.")) return;
    setIsXcodeCloudBusy(true);
    try {
      await window.sentinelDesktop.disconnectXcodeCloud(getDeveloperToken());
      setXcodeCloudStatus({ configured: false, connected: false });
      setNotice({ type: "success", text: "Xcode Cloud disconnected from this PC. Apple credentials were removed from Sentinel." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to disconnect Xcode Cloud." });
    } finally { setIsXcodeCloudBusy(false); }
  };

  useEffect(() => {
    void refreshUpdateStatus();
  }, []);
  useEffect(() => {
    if (isDeveloperUnlocked) { void refreshPublisherStatus(); void refreshXcodeCloudStatus(); }
    // Refresh exactly when developer access changes; both helpers read the
    // current secure token at invocation time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDeveloperUnlocked]);
  useEffect(() => {
    if (!isDeveloperUnlocked || releaseBuildStatus.type !== "building" || !xcodeCloudStatus?.connected) return;
    const timer = window.setInterval(() => { void refreshXcodeCloudStatus(); }, 30_000);
    return () => window.clearInterval(timer);
    // Poll only while a build started from this session is active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDeveloperUnlocked, releaseBuildStatus.type, xcodeCloudStatus?.connected]);
  useEffect(() => {
    if (updateStatus?.edition !== "personal" || !window.sentinelDesktop) return;
    window.sentinelDesktop.updateReleaseCatalog().then(({ modules, blocked }) => {
      setReleaseModules(modules);
      setBlockedReleaseFeatures(blocked);
      setSelectedReleaseModules(current => current.length ? current : ["core"]);
    }).catch(() => undefined);
  }, [updateStatus?.edition]);

  const resolvedReleaseModules = (() => {
    if (releaseType === "full") return releaseModules.map(module => module.id);
    const byId = new Map(releaseModules.map(module => [module.id, module]));
    const resolved = new Set<string>();
    const include = (id: string) => {
      if (resolved.has(id)) return;
      byId.get(id)?.dependencies.forEach(include);
      if (byId.has(id)) resolved.add(id);
    };
    selectedReleaseModules.forEach(include);
    return [...resolved];
  })();

  const releasePlan = {
    releaseType,
    modules: resolvedReleaseModules,
    notes: releaseNotes,
    installationPolicy,
    target: releaseTarget,
    audience: releaseAudience,
    testInstallationId: releaseAudience === "test" ? testInstallationId : "",
  };

  const targetInstallations = (publisherStatus?.installations ?? []).filter(item =>
    releaseTarget === "both" || (releaseTarget === "ios" ? item.platform === "ios" : item.platform === "windows"),
  );
  const selectedTestInstallation = targetInstallations.find(item => item.installationId === testInstallationId);
  const releasePreflight = (() => {
    const errors: string[] = [];
    const checks: string[] = [];
    if (releaseDelivery === "native") {
      if (releaseTarget === "desktop") errors.push("TestFlight delivery requires iPhone or Both as the target.");
      if (!xcodeCloudStatus?.connected && !testFlightBuild.trim()) errors.push("Connect Xcode Cloud or enter an existing TestFlight build number.");
      if (xcodeCloudStatus?.connected) checks.push("Xcode Cloud automation is connected.");
      else if (testFlightBuild.trim()) checks.push(`TestFlight build ${testFlightBuild.trim()} recorded.`);
      if (xcodeCloudStatus?.latestRun?.id) checks.push(`Latest Xcode Cloud run ${xcodeCloudStatus.latestRun.id} is visible.`);
      return { errors, checks };
    }
    if (!/^\d+(\.\d+){1,3}([-.][A-Za-z0-9.]+)?$/.test(updateVersion.trim())) errors.push("Enter a valid newer release version.");
    else checks.push(`Version ${updateVersion.trim()} is valid.`);
    if (!releaseNotes.trim()) errors.push("Add release notes before publishing.");
    else checks.push("Release notes are present.");
    if (releaseDelivery === "content" && resolvedReleaseModules.length === 0) errors.push("Select at least one compatible module.");
    else if (releaseDelivery === "content") checks.push(`${resolvedReleaseModules.length} approved content modules selected.`);
    if (releaseAudience === "test" && !selectedTestInstallation) errors.push("Choose a registered target device for the test release.");
    else if (releaseAudience === "test") checks.push(`Test release restricted to ${selectedTestInstallation?.deviceName}.`);
    if (!updateStatus?.signingKeyReady) errors.push("Personal signing authority is not ready.");
    else checks.push("Personal signing authority is ready.");
    if (!updateStatus?.publisherConfigured) errors.push("Remote publisher is not configured.");
    else checks.push("Remote publisher is configured.");
    return { errors, checks };
  })();

  function runReleasePreflight() {
    setPreflightStatus({
      type: releasePreflight.errors.length ? "error" : "success",
      items: releasePreflight.errors.length ? releasePreflight.errors : releasePreflight.checks,
    });
  }

  useEffect(() => {
    localStorage.setItem("sentinel-testflight-build", testFlightBuild);
    localStorage.setItem("sentinel-testflight-url", testFlightUrl);
  }, [testFlightBuild, testFlightUrl]);

  useEffect(() => {
    setPreflightStatus({ type: "idle", items: [] });
    if (releaseAudience === "test" && !targetInstallations.some(item => item.installationId === testInstallationId)) {
      setTestInstallationId(targetInstallations[0]?.installationId ?? "");
    }
    // This effect intentionally resets preflight state only when release inputs
    // change; installation refreshes are handled by their own workflow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseTarget, releaseDelivery, releaseAudience, updateVersion, releaseNotes, resolvedReleaseModules.length, publisherStatus]);

  function toggleReleaseModule(id: string) {
    setSelectedReleaseModules(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id],
    );
  }

  async function restartSentinel() {
    if (!window.confirm("Restart Sentinel now? Any unsaved text will be lost."))
      return;
    setIsRestarting(true);
    setNotice({ type: "success", text: "Restarting Sentinel…" });
    try {
      await window.sentinelDesktop?.restart();
    } catch (error) {
      setIsRestarting(false);
      setNotice({
        type: "error",
        text:
          error instanceof Error ? error.message : "Sentinel could not restart.",
      });
    }
  }
  useEffect(() => {
    let active = true;
    const refresh = () => getCompanionStatus()
      .then(status => { if (active) setCompanionStatus(status); })
      .catch(() => undefined);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!companionStatus?.configured) { setMobileAccess(null); return; }
    getMobileAccessStatus().then(status => {
      setMobileAccess(status);
      setSelectedMobileServices(status.provisionedServices.length ? status.provisionedServices : status.availableServices);
    }).catch(() => undefined);
  }, [companionStatus?.configured]);
  useEffect(() => {
    if (!companionStatus?.configured) { setCompanionItems([]); return; }
    let active = true;
    const refresh = () => listCompanionItems()
      .then(result => { if (active) setCompanionItems(result.items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))); })
      .catch(() => undefined);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [companionStatus?.configured]);

  async function saveMobileAccess() {
    if (!selectedMobileServices.length) return;
    if (!window.confirm("Allow paired iPhones to request independent access to the selected services? API keys remain encrypted in the Sentinel relay and are never shown to the phone.")) return;
    setIsMobileAccessBusy(true);
    try {
      const result = await provisionMobileAccess(selectedMobileServices);
      setMobileAccess(result);
      setNotice({ type: "success", text: "Independent mobile services are ready. The iPhone can now request permission after pairing." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to enable independent mobile access." });
    } finally { setIsMobileAccessBusy(false); }
  }

  async function removeMobileAccess() {
    if (!window.confirm("Revoke independent service access from every paired iPhone?")) return;
    setIsMobileAccessBusy(true);
    try {
      const result = await revokeMobileAccess();
      setMobileAccess(result);
      setNotice({ type: "success", text: "Independent mobile access and device permissions were revoked." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to revoke mobile access." });
    } finally { setIsMobileAccessBusy(false); }
  }

  useEffect(() => {
    const onLocationStatus = (event: Event) =>
      setLocationStatus(
        (event as CustomEvent<{ status: LocationStatus }>).detail.status,
      );
    window.addEventListener("sentinel:location-status", onLocationStatus);
    return () =>
      window.removeEventListener("sentinel:location-status", onLocationStatus);
  }, []);

  function updatePreference(
    key: string,
    value: boolean,
    update: (value: boolean) => void,
  ) {
    localStorage.setItem(key, String(value));
    update(value);
  }

  async function handleUnlock(event: React.FormEvent) {
    event.preventDefault();
    if (!password) return;
    setIsSubmitting(true);
    setNotice(null);
    try {
      await unlockDeveloperMode(password);
      setPassword("");
      setIsDeveloperUnlocked(true);
      setNotice({
        type: "success",
        text: "Developer Mode unlocked for this session.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to unlock Developer Mode.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLock() {
    setIsSubmitting(true);
    try {
      await lockDeveloperMode();
      setIsDeveloperUnlocked(false);
      setNotice({
        type: "success",
        text: "Developer Mode locked. Source access is disabled.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to lock Developer Mode.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOpenDeveloperTools() {
    if (!window.sentinelDesktop) {
      setNotice({
        type: "error",
        text: "Developer Tools are available only in the Sentinel desktop app.",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const result =
        await window.sentinelDesktop.openDeveloperTools(getDeveloperToken());
      if (!result.opened)
        throw new Error(result.error ?? "Unable to open Developer Tools.");
      setNotice({
        type: "success",
        text: "Developer Tools opened in a separate window.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to open Developer Tools.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOpenSourceInVSCode() {
    if (!window.sentinelDesktop) {
      setNotice({
        type: "error",
        text: "Source access is available only in the Sentinel desktop app.",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await window.sentinelDesktop.openSourceInVSCode(
        getDeveloperToken(),
      );
      if (!result.opened)
        throw new Error(result.error ?? "Unable to open Sentinel in VS Code.");
      setNotice({
        type: "success",
        text: "Sentinel's editable source workspace opened in VS Code.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to open Sentinel in VS Code.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestLocation() {
    setIsRequestingLocation(true);
    setNotice(null);
    try {
      const location = await updateLocation();
      setNotice({
        type: "success",
        text: location?.approximate
          ? "Windows location was unavailable, so Sentinel restored an approximate network location."
          : "Live location access granted. Sentinel will keep it updated as you move.",
      });
    } catch {
      setNotice({
        type: "error",
        text: "Windows could not provide a location. Enable Location Services, then try again.",
      });
    } finally {
      setIsRequestingLocation(false);
    }
  }

  async function handleUpdateAction(
    action: () => Promise<unknown>,
    success: string,
  ) {
    if (!window.sentinelDesktop) {
      setNotice({
        type: "error",
        text: "Updates are available only in the Sentinel desktop app.",
      });
      return;
    }
    setIsUpdating(true);
    setNotice(null);
    try {
      const result = (await action()) as {
        cancelled?: boolean;
        path?: string;
        version?: string;
      };
      if (!result.cancelled)
        setNotice({
          type: "success",
          text: result.path
            ? `${success} ${result.path}`
            : result.version
              ? `${success} Version ${result.version}.`
              : success,
        });
      await refreshUpdateStatus();
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Update action failed.",
      });
    } finally {
      setIsUpdating(false);
    }
  }

  async function buildSignedBaseUpdate() {
    if (!window.sentinelDesktop) {
      setReleaseBuildStatus({
        type: "error",
        text: "Update building is available only in the Sentinel desktop app.",
      });
      return;
    }

    setIsUpdating(true);
    setNotice(null);
    setBuiltPackagePath("");
    setReleaseBuildStatus({
      type: "building",
      text: "Building the Base installer, checking Personal-only boundaries, then signing the update. This can take several minutes—keep Sentinel open.",
    });

    try {
      const result = await window.sentinelDesktop.buildUpdatePackage(
        getDeveloperToken(),
        updateVersion,
        releasePlan,
      );
      if (result.cancelled) {
        setReleaseBuildStatus({ type: "idle", text: "Build cancelled." });
        return;
      }
      if (!result.path) throw new Error("The build finished without creating an update package.");
      setBuiltPackagePath(result.path);
      setReleaseBuildStatus({
        type: "success",
        text: `Signed update ready: ${result.path}`,
      });
      await refreshUpdateStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Update build failed.";
      setReleaseBuildStatus({ type: "error", text: message });
      setNotice({ type: "error", text: message });
    } finally {
      setIsUpdating(false);
    }
  }

  async function publishSignedBaseUpdate() {
    if (!window.sentinelDesktop || !builtPackagePath) return;
    setIsUpdating(true);
    setNotice(null);
    setReleasePublishStatus({
      type: "publishing",
      text: "Uploading the signed update in secure chunks. Keep Sentinel open until cloud verification completes.",
    });
    try {
      const result = await window.sentinelDesktop.publishUpdate(getDeveloperToken(), builtPackagePath);
      setReleasePublishStatus({
        type: "success",
        text: `Version ${result.version} is published and available to Sentinel Base.`,
      });
      setNotice({ type: "success", text: `Published production update. Version ${result.version}.` });
      localStorage.setItem("sentinel-display-version", result.version);
      window.dispatchEvent(new CustomEvent("sentinel:version-updated", {
        detail: { version: result.version },
      }));
      await refreshPublisherStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Publishing failed.";
      setReleasePublishStatus({ type: "error", text: message });
      setNotice({ type: "error", text: message });
    } finally {
      setIsUpdating(false);
    }
  }

  async function refreshSentinel() {
    setResetting(true);
    setNotice(null);
    try {
      const response = await fetch(`${API_URL}/setup/factory-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: resetPassword,
          confirmation: resetConfirmation,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Sentinel could not be reset.");
      localStorage.clear();
      sessionStorage.clear();
      setResetOpen(false);
      setResetPassword("");
      setResetConfirmation("");
      window.location.reload();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Sentinel could not be reset.",
      });
      setResetting(false);
    }
  }

  async function handleCompanion(enabled: boolean) {
    setIsCompanionBusy(true);
    setNotice(null);
    try {
      const result = enabled
        ? await enableCompanion()
        : await disableCompanion();
      setCompanionStatus(result);
      setNotice({
        type: enabled && result.lastError ? "error" : "success",
        text: enabled
          ? result.lastError
            ? "Companion Sync is enabled locally but the relay has not accepted it yet. Sentinel will retry automatically; update the deployed relay before pairing a device."
            : "Companion Sync enabled. Keep its private pairing details to yourself."
          : result.lastError
            ? "Companion Sync is disabled on this device. The relay could not confirm cloud revocation, but Sentinel has stopped accepting sync requests."
            : "Companion Sync disabled and its access revoked.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to update the remote companion.",
      });
    } finally {
      setIsCompanionBusy(false);
    }
  }

  async function generateCompanionPairingCode() {
    setIsCompanionBusy(true);
    setNotice(null);
    try {
      const result = await createCompanionPairingCode();
      setCompanionPairing(result);
      setNotice({
        type: "success",
        text: "Pairing code created. Enter it on the iPhone before it expires.",
      });
      setCompanionStatus(await getCompanionStatus());
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to create a pairing code.",
      });
    } finally {
      setIsCompanionBusy(false);
    }
  }

  async function revokePairedDevice(deviceId: string) {
    setIsCompanionBusy(true);
    try {
      await revokeCompanionDevice(deviceId);
      setCompanionStatus(await getCompanionStatus());
      setNotice({ type: "success", text: "Paired device access revoked." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to revoke the device." });
    } finally {
      setIsCompanionBusy(false);
    }
  }

  async function sendCompanionTransfer() {
    if (!companionText.trim() && !companionFile) return;
    setIsTransferBusy(true);
    try {
      let result: { transport: string; cloudBackup?: boolean };
      if (companionFile) {
        if (companionFile.size > 100 * 1024 * 1024) throw new Error("Files are limited to 100 MB.");
        const encoded = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
          reader.onerror = () => reject(new Error("Unable to read the selected file."));
          reader.readAsDataURL(companionFile);
        });
        result = await sendCompanionFile({ name: companionFile.name, mimeType: companionFile.type || "application/octet-stream", data: encoded });
      } else {
        result = await sendCompanionText(companionText.trim());
      }
      setCompanionText("");
      setCompanionFile(null);
      setCompanionItems((await listCompanionItems()).items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
      setNotice({ type: "success", text: `Sent through ${result.transport === "wifi" ? "local Wi-Fi" : "local Wi-Fi with cloud fallback"}.` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to send this item." });
    } finally {
      setIsTransferBusy(false);
    }
  }

  async function saveCompanionFile(item: CompanionItem) {
    try {
      const full = await downloadCompanionItem(item.id);
      if (!full.data) throw new Error("This file is no longer available.");
      const bytes = Uint8Array.from(atob(full.data), character => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: full.mimeType || "application/octet-stream" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = full.name || "Sentinel file";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to save the file." });
    }
  }

  async function removeCompanionItem(itemId: string) {
    await deleteCompanionItem(itemId);
    setCompanionItems(current => current.filter(item => item.id !== itemId));
  }

  async function runDiagnostics() {
    setIsDiagnosing(true);
    setNotice(null);
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`${API_URL}/system/diagnostics`, {
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      if (!response.ok)
        throw new Error("The diagnostic service did not respond.");
      const result = (await response.json()) as DiagnosticResult;
      const microphoneCheck: DiagnosticCheck = !navigator.mediaDevices
        ?.enumerateDevices
        ? {
            id: "microphone",
            label: "Voice input",
            status: "fail",
            detail: "Microphone access is not supported",
            action: "Check Windows media permissions or reinstall Sentinel",
          }
        : await navigator.mediaDevices
            .enumerateDevices()
            .then((devices) =>
              devices.some((device) => device.kind === "audioinput")
                ? ({
                    id: "microphone",
                    label: "Voice input",
                    status: "pass",
                    detail: "A microphone input device is available",
                  } as DiagnosticCheck)
                : ({
                    id: "microphone",
                    label: "Voice input",
                    status: "warn",
                    detail: "No microphone input device was detected",
                    action:
                      "Connect or enable a microphone in Windows Sound settings",
                  } as DiagnosticCheck),
            )
            .catch(() => ({
              id: "microphone",
              label: "Voice input",
              status: "warn",
              detail: "Microphone availability could not be checked",
              action: "Check microphone privacy permission in Windows Settings",
            }));
      const checks = [...result.checks, microphoneCheck];
      const summary = {
        passed: checks.filter((check) => check.status === "pass").length,
        warnings: checks.filter((check) => check.status === "warn").length,
        failed: checks.filter((check) => check.status === "fail").length,
      };
      setDiagnostics({
        ...result,
        checks,
        summary,
        status: summary.failed
          ? "attention"
          : summary.warnings
            ? "warning"
            : "healthy",
      });
    } catch (error) {
      setDiagnostics(null);
      setNotice({
        type: "error",
        text:
          error instanceof DOMException && error.name === "AbortError"
            ? "Diagnostics timed out. The Sentinel backend may be unavailable."
            : error instanceof Error
              ? error.message
              : "Unable to run diagnostics.",
      });
    } finally {
      setIsDiagnosing(false);
    }
  }

  async function repairSystem(check: DiagnosticCheck) {
    if (
      !check.repair ||
      !window.confirm(
        `Run the safe repair for ${check.label}? Sentinel will refresh this service and then test it again.`,
      )
    )
      return;
    setRepairing(check.id);
    setNotice(null);
    try {
      if (check.repair === "refresh-location") await updateLocation();
      else {
        const response = await fetch(`${API_URL}/system/repair`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: check.repair }),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok)
          throw new Error(result.error || "The repair could not be completed.");
      }
      setNotice({
        type: "success",
        text: `${check.label} was refreshed. Sentinel is checking it again.`,
      });
      await runDiagnostics();
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Repair failed.",
      });
    } finally {
      setRepairing(null);
    }
  }

  return (
    <div className="settings-view">
      <header className="settings-heading">
        <div>
          <p>CONTROL CENTRE</p>
          <h1>Settings</h1>
          <span>Personalise Sentinel and manage secure system features.</span>
        </div>
        <div className="settings-heading-actions">
          <button
            className="settings-button settings-button--secondary settings-restart"
            disabled={isRestarting || !window.sentinelDesktop}
            onClick={() => void restartSentinel()}
          >
            <RotateCcw size={17} className={isRestarting ? "spin" : ""} />
            {isRestarting ? "Restarting…" : "Restart Sentinel"}
          </button>
          <button
            className="settings-button settings-button--secondary settings-howto"
            onClick={() => setGuideOpen(true)}
          >
            <BookOpen size={17} /> How to use Sentinel
          </button>
          <div className="settings-status">
            <span /> Sentinel online
          </div>
        </div>
      </header>

      {notice && (
        <div className={`settings-notice settings-notice--${notice.type}`}>
          {notice.type === "success" ? <Check size={18} /> : <X size={18} />}{" "}
          {notice.text}
        </div>
      )}

      <div className="settings-grid">
        <SetupCentre
          onNotice={(type, text) => setNotice({ type, text })}
          isDeveloperUnlocked={isDeveloperUnlocked}
        />
        <section className="settings-card settings-card--wide diagnostic-card">
          <div className="settings-card-title">
            <Activity />
            <div>
              <h2>Quick self-diagnosis</h2>
              <p>
                Checks the critical services Sentinel needs most. It does not
                run a full system scan.
              </p>
            </div>
            <button
              className="settings-button"
              disabled={isDiagnosing}
              onClick={() => void runDiagnostics()}
            >
              <Play size={17} /> {isDiagnosing ? "Checking…" : "Run diagnosis"}
            </button>
          </div>
          {diagnostics && (
            <div className="diagnostic-results">
              <div
                className={`diagnostic-summary diagnostic-summary--${diagnostics.status}`}
              >
                {diagnostics.status === "healthy" ? (
                  <ShieldCheck />
                ) : (
                  <AlertTriangle />
                )}
                <div>
                  <strong>
                    {diagnostics.status === "healthy"
                      ? "Critical systems healthy"
                      : diagnostics.status === "warning"
                        ? "Core systems online with warnings"
                        : "A critical system needs attention"}
                  </strong>
                  <span>
                    {diagnostics.summary.passed} passed ·{" "}
                    {diagnostics.summary.warnings} warnings ·{" "}
                    {diagnostics.summary.failed} failed · completed in{" "}
                    {diagnostics.durationMs} ms
                  </span>
                </div>
              </div>
              <div className="diagnostic-list">
                {diagnostics.checks.map((check) => (
                  <div className="diagnostic-item" key={check.id}>
                    <i
                      className={`diagnostic-dot diagnostic-dot--${check.status}`}
                    />
                    <div>
                      <strong>
                        {check.label}
                        {typeof check.latencyMs === "number"
                          ? ` · ${check.latencyMs} ms`
                          : ""}
                      </strong>
                      <span>{check.detail}</span>
                      {check.action && <small>{check.action}</small>}
                      {check.repair && (
                        <button
                          className="diagnostic-repair"
                          disabled={repairing === check.id}
                          onClick={() => void repairSystem(check)}
                        >
                          {repairing === check.id
                            ? "Repairing…"
                            : "Repair safely"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
        <section className="settings-card settings-card--wide settings-accordion">
          <button className="settings-accordion-heading" onClick={() => setExperienceOpen((value) => !value)} aria-expanded={experienceOpen}>
            <span><Palette /><span><strong>Experience</strong><small>Appearance, sound, motion, notifications and display preferences.</small></span></span>
            <span>{ACCENT_THEMES.find((theme) => theme.id === accentTheme)?.label}<ChevronDown className={experienceOpen ? "is-open" : ""} /></span>
          </button>
          {experienceOpen && <div className="settings-accordion-content">
          <div className="appearance-editor">
            <div className="appearance-heading"><div><strong>Sentinel colour</strong><span>Changes the reactor, navigation, controls and ambient interface lighting.</span></div><button className="settings-link appearance-reset" onClick={() => { setAccentTheme("blue"); setAccentIntensity(85); setMotionLevel("full"); }}><RotateCcw size={15} /> Reset</button></div>
            <div className="appearance-swatches" role="radiogroup" aria-label="Sentinel colour theme">
              {ACCENT_THEMES.map((theme) => <button key={theme.id} type="button" role="radio" aria-checked={accentTheme === theme.id} className={accentTheme === theme.id ? "is-selected" : ""} onClick={() => setAccentTheme(theme.id)}><i style={{ background: theme.colour }} /><span>{theme.label}</span>{accentTheme === theme.id && <Check size={15} />}</button>)}
            </div>
            <div className="appearance-controls"><label><span>Accent intensity</span><input type="range" min="45" max="100" value={accentIntensity} onChange={(event) => setAccentIntensity(Number(event.target.value))} /><strong>{accentIntensity}%</strong></label><label><span>Animation level</span><select value={motionLevel} onChange={(event) => setMotionLevel(event.target.value as MotionLevel)}><option value="full">Full</option><option value="reduced">Reduced</option><option value="off">Off</option></select></label></div>
            <small className="appearance-safety"><ShieldCheck size={14} /> Safety colours remain fixed: green means healthy, amber means warning and red means critical.</small>
          </div>
          <StartupScenes
            enabled={startupSequence}
            onEnabled={(value) =>
              updatePreference(
                "sentinel-startup-sequence",
                value,
                setStartupSequence,
              )
            }
          />
          <SettingToggle
            icon={<Monitor />}
            title="Compact layout"
            detail="Use tighter spacing on smaller screens."
            checked={compactMode}
            onChange={(value) =>
              updatePreference("sentinel-compact-mode", value, setCompactMode)
            }
          />
          <SettingToggle
            icon={<Bell />}
            title="System notifications"
            detail="Show updates and important Sentinel alerts."
            checked={notifications}
            onChange={(value) =>
              updatePreference(
                "sentinel-notifications",
                value,
                setNotifications,
              )
            }
          />
          <div className="settings-row sound-effects-row">
            <div className="settings-row-icon">
              <Volume2 />
            </div>
            <div className="settings-row-copy">
              <strong>Sound effects</strong>
              <span>
                Navigation clicks and adaptive reactor ambience on the Home
                page.
              </span>
            </div>
            <button
              aria-label="Toggle sound effects"
              className={`settings-toggle ${soundEffectsEnabled ? "settings-toggle--on" : ""}`}
              onClick={() => {
                setSoundEffectsEnabled(!soundEffectsEnabled);
                if (!soundEffectsEnabled) playNavigation();
              }}
            >
              <i />
            </button>
          </div>
          <div
            className={`sound-volume ${soundEffectsEnabled ? "" : "sound-volume--disabled"}`}
          >
            <span>Effects volume</span>
            <input
              aria-label="Sound effects volume"
              type="range"
              min="0"
              max="100"
              value={Math.round(soundEffectsVolume * 100)}
              disabled={!soundEffectsEnabled}
              onChange={(event) =>
                setSoundEffectsVolume(Number(event.target.value) / 100)
              }
            />
            <strong>{Math.round(soundEffectsVolume * 100)}%</strong>
          </div>
          </div>}
        </section>

        <section className="settings-card settings-card--wide page-visibility-card">
          <button
            className="page-visibility-heading"
            onClick={() => setVisiblePagesOpen((value) => !value)}
            aria-expanded={visiblePagesOpen}
          >
            <span>
              <Monitor />
              <span>
                <strong>Visible pages</strong>
                <small>
                  Choose which optional pages appear. Home and Settings always
                  remain available.
                </small>
              </span>
            </span>
            <span>
              {navigation.length - 2 - hiddenPages.length}/
              {navigation.length - 2} shown{" "}
              <ChevronDown className={visiblePagesOpen ? "is-open" : ""} />
            </span>
          </button>
          {visiblePagesOpen && (
            <div className="page-visibility-list">
              {navigation
                .filter((item) => item.id !== "home" && item.id !== "settings")
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <SettingToggle
                      key={item.id}
                      icon={<Icon />}
                      title={item.title}
                      detail={`Show ${item.title} in the sidebar and command search.`}
                      checked={!hiddenPages.includes(item.id)}
                      onChange={(visible) => setPageVisible(item.id, visible)}
                    />
                  );
                })}
            </div>
          )}
        </section>

        {IS_PERSONAL_EDITION && (
        <section className="settings-card settings-card--wide settings-accordion companion-accordion">
          <button type="button" className="settings-accordion-heading" aria-expanded={companionOpen} aria-controls="companion-settings-content" onClick={() => setCompanionOpen(value => !value)}>
            <span><Link2 /><span><strong>Companion Sync</strong><small>Pair trusted iPhones and move text or files between your devices.</small></span></span>
            <span>{companionStatus?.online ? "Sync online" : companionStatus?.configured ? "Awaiting connection" : "Disabled"}<ChevronDown className={companionOpen ? "is-open" : ""} /></span>
          </button>
          <div id="companion-settings-content" className="settings-accordion-content" hidden={!companionOpen}>
        <section className="settings-card settings-card--wide companion-card">
          <div className="settings-card-title">
            <Link2 />
            <div>
              <h2>Companion Sync</h2>
              <p>
                Pair trusted iPhones and securely move text, files and Sentinel
                services between your devices.
              </p>
            </div>
            <div
              className={`developer-state ${companionStatus?.online ? "developer-state--open" : ""}`}
            >
              {companionStatus?.configured
                ? companionStatus.online
                  ? companionStatus.activeDeviceCount
                    ? `${companionStatus.activeDeviceCount} device online`
                    : "Relay online"
                  : "Awaiting Sentinel"
                : "Disabled"}
            </div>
          </div>
          <div className="developer-explainer">
            <ShieldCheck />
            <div>
              <strong>Private, paired sync.</strong>
              <span>
                Transfers use local Wi-Fi when available, with the private
                Cloudflare relay as a fallback away from home. Ring live video
                remains protected by Ring's own service.
              </span>
            </div>
          </div>
          {companionStatus?.configured ? (
            <div className="companion-pairing-panel">
              {companionStatus.lastError && (
                <small className="companion-status-error">{companionStatus.lastError}</small>
              )}
              <div className="companion-pairing-actions">
                <div>
                  <strong>Pair an iPhone</strong>
                  <span>Create a one-time six-digit code, then enter it in Sentinel on the iPhone.</span>
                </div>
                <button className="settings-button" disabled={isCompanionBusy} onClick={() => void generateCompanionPairingCode()}>
                  <KeyRound size={17} /> {isCompanionBusy ? "Creating…" : "Create pairing code"}
                </button>
              </div>
              {companionPairing && (
                <div className="companion-pairing-code" role="status">
                  <small>ONE-TIME PAIRING CODE</small>
                  <strong>{companionPairing.code.replace(/(\d{3})(\d{3})/, "$1 $2")}</strong>
                  <span>Expires {new Date(companionPairing.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              )}
              {!!companionStatus.devices?.length && (
                <div className="companion-device-list">
                  <strong>Paired devices</strong>
                  {companionStatus.devices.map((device) => (
                    <div key={device.id}>
                      <span><b>{device.name || "iPhone"}</b><small>{device.platform || "iOS"}{device.lastSeenAt ? ` · Last seen ${new Date(device.lastSeenAt).toLocaleString()}` : ""}</small></span>
                      <button disabled={isCompanionBusy} onClick={() => void revokePairedDevice(device.id)}>Revoke</button>
                    </div>
                  ))}
                </div>
              )}
              <button
                className="settings-button"
                disabled={isCompanionBusy}
                onClick={() => void handleCompanion(false)}
              >
                {isCompanionBusy ? "Revoking…" : "Disable Companion Sync"}
              </button>
            </div>
          ) : (
            <div className="developer-actions">
              <div>
                <strong>Connect Sentinel across your devices</strong>
                <span>
                  Enable Companion Sync, then pair your iPhone using a secure
                  one-time code.
                </span>
              </div>
              <button
                className="settings-button"
                disabled={isCompanionBusy}
                onClick={() => void handleCompanion(true)}
              >
                {isCompanionBusy ? (
                  "Enabling…"
                ) : (
                  <>
                    <Link2 size={17} /> Enable Companion Sync
                  </>
                )}
              </button>
            </div>
          )}
          {companionStatus?.configured && (
            <div className="companion-transfer-workspace">
              <header>
                <div><strong>Shared Workspace</strong><small>Send text or files between Sentinel Personal and paired iPhones.</small></div>
                <span>Wi-Fi first · Cloud fallback up to 65 MB</span>
              </header>
              <div className="companion-compose">
                <textarea
                  rows={3}
                  placeholder="Paste or type text to send to your paired iPhone…"
                  value={companionText}
                  disabled={Boolean(companionFile)}
                  onChange={(event) => setCompanionText(event.target.value)}
                />
                <label className="settings-button settings-button--secondary">
                  <Upload size={17} /> {companionFile ? companionFile.name : "Choose file"}
                  <input type="file" hidden onChange={(event) => setCompanionFile(event.target.files?.[0] ?? null)} />
                </label>
                {companionFile && <button className="transfer-clear" onClick={() => setCompanionFile(null)}><X size={15} /> Remove</button>}
                <button className="settings-button" disabled={isTransferBusy || (!companionText.trim() && !companionFile)} onClick={() => void sendCompanionTransfer()}>
                  <Upload size={17} /> {isTransferBusy ? "Sending…" : "Send to iPhone"}
                </button>
              </div>
              <div className="companion-inbox">
                <div className="companion-inbox-heading"><strong>Recent shared items</strong><small>{companionItems.length ? `${companionItems.length} available` : "Nothing shared yet"}</small></div>
                {companionItems.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.kind === "file" ? item.name || "Shared file" : item.text || "Shared text"}</strong>
                      <small>{item.sourceName || "Sentinel"} · {new Date(item.createdAt).toLocaleString()}{item.size ? ` · ${(item.size / 1024 / 1024).toFixed(item.size > 1024 * 1024 ? 1 : 2)} MB` : ""}</small>
                    </div>
                    {item.kind === "text" && item.text && <button onClick={() => void navigator.clipboard.writeText(item.text!)}>Copy</button>}
                    {item.kind === "file" && <button onClick={() => void saveCompanionFile(item)}>Save</button>}
                    <button className="danger" onClick={() => void removeCompanionItem(item.id)}>Delete</button>
                  </article>
                ))}
              </div>
            </div>
          )}
          {companionStatus?.configured && mobileAccess && (
            <div className="mobile-service-access">
              <header>
                <div><strong>Mobile Service Access</strong><small>Let paired iPhones use selected cloud services when this desktop is offline.</small></div>
                <span>{mobileAccess.configured ? "Independent access ready" : "Setup required"}</span>
              </header>
              <div className="mobile-service-grid">
                {mobileAccess.availableServices.map(service => (
                  <label key={service}>
                    <input type="checkbox" checked={selectedMobileServices.includes(service)} onChange={event => setSelectedMobileServices(current => event.target.checked ? [...new Set([...current, service])] : current.filter(item => item !== service))} />
                    <span>{({ chat: "AI Chat", navigation: "Navigation & Places", weather: "Weather", aviation: "Flight Status", aircraft: "Live Aircraft" } as Record<MobileServiceId, string>)[service]}</span>
                  </label>
                ))}
              </div>
              <div className="mobile-service-actions">
                <button className="settings-button" disabled={isMobileAccessBusy || !selectedMobileServices.length} onClick={() => void saveMobileAccess()}><ShieldCheck size={17} /> {mobileAccess.configured ? "Update mobile permissions" : "Enable independent access"}</button>
                {mobileAccess.configured && <button className="settings-button settings-button--secondary" disabled={isMobileAccessBusy} onClick={() => void removeMobileAccess()}>Revoke mobile access</button>}
              </div>
              <small>Raw API keys are never returned to the iPhone. Revoking the pairing or this vault immediately removes independent access.</small>
            </div>
          )}
        </section>
          </div>
        </section>
        )}

        <section className="settings-card settings-card--wide settings-accordion voice-privacy-accordion">
          <button type="button" className="settings-accordion-heading" aria-expanded={voicePrivacyOpen} aria-controls="voice-privacy-settings-content" onClick={() => setVoicePrivacyOpen(value => !value)}>
            <span><Ear /><span><strong>Always listening & voice privacy</strong><small>Configure wake phrases, standby sensitivity, confirmation tones and microphone activity.</small></span></span>
            <span>{wakeEnabled ? "Standby active" : "Off"}<ChevronDown className={voicePrivacyOpen ? "is-open" : ""} /></span>
          </button>
          <div id="voice-privacy-settings-content" className="settings-accordion-content" hidden={!voicePrivacyOpen}>
          <div className="wake-voice-grid">
            <label className="wake-voice-switch"><span><strong>Hey Sentinel standby</strong><small>The microphone waits for a wake phrase; detected speech is transiently transcribed and raw audio is not saved.</small></span><input type="checkbox" checked={wakeEnabled} onChange={(event) => { const enabled = event.target.checked; setWakeEnabled(enabled); localStorage.setItem(WAKE_ENABLED_KEY, String(enabled)); window.dispatchEvent(new Event("sentinel:wake-settings-change")); }} /></label>
            <label><strong>Wake phrases</strong><small>Separate alternatives with commas (maximum six).</small><input value={wakePhrases} onChange={(event) => setWakePhrases(event.target.value)} onBlur={() => window.dispatchEvent(new Event("sentinel:wake-settings-change"))} /></label>
            <label><strong>Standby phrases</strong><small>These end live voice and return Sentinel to wake standby.</small><input value={sleepPhrases} onChange={(event) => setSleepPhrases(event.target.value)} onBlur={() => window.dispatchEvent(new Event("sentinel:wake-settings-change"))} /></label>
            <label><strong>Microphone sensitivity: {wakeSensitivity}%</strong><small>Raise this if Sentinel misses you; lower it in noisy rooms.</small><input type="range" min="1" max="100" value={wakeSensitivity} onChange={(event) => setWakeSensitivity(Number(event.target.value))} onMouseUp={() => window.dispatchEvent(new Event("sentinel:wake-settings-change"))} /></label>
            <label className="wake-voice-switch"><span><strong>Wake and standby tones</strong><small>Play a short local confirmation sound when the state changes.</small></span><input type="checkbox" checked={wakeTones} onChange={(event) => setWakeTones(event.target.checked)} /></label>
          </div>
          <div className="wake-privacy-history">
            <header><div><strong>Microphone activity</strong><small>State changes only—no audio, transcript content, passwords or tokens.</small></div><button className="settings-button settings-button--secondary" disabled={!wakeActivity.length} onClick={() => { clearWakeActivity(); localStorage.removeItem(WAKE_ACTIVITY_KEY); }}><Trash2 size={15} /> Clear</button></header>
            {wakeActivity.length ? <div>{wakeActivity.slice(0, 8).map((item) => <article key={item.id}><i /><span><strong>{item.label}</strong><small>{new Date(item.at).toLocaleString("en-GB")}</small></span></article>)}</div> : <p>No wake-listener activity recorded yet.</p>}
          </div>
          </div>
        </section>

        <section className="settings-card settings-card--wide">
          <div className="settings-card-title">
            <MapPin />
            <div>
              <h2>Location access</h2>
              <p>
                Use your device’s live location for weather, navigation, and
                local context.
              </p>
            </div>
          </div>
          <div className="settings-row location-access-row">
            <div className="settings-row-icon">
              <MapPin />
            </div>
            <div className="settings-row-copy">
              <strong>
                {locationStatus === "active"
                  ? "Live location active"
                  : locationStatus === "syncing"
                    ? "Requesting live location"
                    : "Location access needed"}
              </strong>
              <span>
                {locationStatus === "active"
                  ? "Sentinel updates your location as the device reports a better position."
                  : "Select the button to request Windows location access."}
              </span>
            </div>
            <button
              className="settings-button"
              onClick={() => void handleRequestLocation()}
              disabled={isRequestingLocation}
            >
              {isRequestingLocation
                ? "Requesting…"
                : locationStatus === "active"
                  ? "Refresh location"
                  : "Allow location access"}
            </button>
          </div>
        </section>

        <section className="settings-card settings-card--wide developer-card">
          <div className="settings-card-title">
            <Code2 />
            <div>
              <h2>Developer Mode</h2>
              <p>Protected source-code access for trusted operators only.</p>
            </div>
            <div
              className={`developer-state ${isDeveloperUnlocked ? "developer-state--open" : ""}`}
            >
              {isDeveloperUnlocked ? <Unlock size={15} /> : <Lock size={15} />}{" "}
              {isChecking
                ? "Checking…"
                : isDeveloperUnlocked
                  ? "Unlocked"
                  : "Locked"}
            </div>
          </div>
          <div className="developer-explainer">
            <ShieldCheck />
            <div>
              <strong>Your code stays protected.</strong>
              <span>
                Read, search, and change proposals are disabled until Developer
                Mode is unlocked. Every source edit still requires separate
                approval before it is written.
              </span>
            </div>
          </div>
          {isDeveloperUnlocked ? (
            <div className="developer-actions">
              <div>
                <strong>Developer session active</strong>
                <span>
                  It automatically expires after 30 minutes or when you lock it. In Sentinel Personal, Chat now also exposes the read-only Codex Developer engine using your locally authenticated Codex account.
                </span>
              </div>
              <div>
                <button
                  className="settings-button"
                  onClick={() => void handleOpenDeveloperTools()}
                  disabled={isSubmitting}
                >
                  <Code2 size={17} /> Open Developer Tools
                </button>
                {updateStatus?.edition === "personal" && (
                  <button
                    className="settings-button"
                    onClick={() => void handleOpenSourceInVSCode()}
                    disabled={isSubmitting}
                  >
                    <Monitor size={17} /> Open Sentinel in VS Code
                  </button>
                )}
                <button
                  className="settings-button settings-button--secondary"
                  onClick={handleLock}
                  disabled={isSubmitting}
                >
                  <Lock size={17} /> Lock Developer Mode
                </button>
              </div>
            </div>
          ) : (
            <form className="developer-unlock" onSubmit={handleUnlock}>
              <label htmlFor="developer-password">
                <KeyRound size={16} /> Developer password
              </label>
              <div>
                <input
                  id="developer-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                />
                <button
                  className="settings-button"
                  type="submit"
                  disabled={isSubmitting || !password}
                >
                  {isSubmitting ? (
                    "Unlocking…"
                  ) : (
                    <>
                      <Unlock size={17} /> Unlock
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </section>

        {updateStatus && (
          <section className="settings-card settings-card--wide update-card">
            <div className="settings-card-title">
              <PackageCheck />
              <div>
                <h2>Secure updates</h2>
                <p>
                  {updateStatus.edition === "personal"
                    ? "Create signed release packages after testing changes in Sentinel Personal."
                    : "Install only packages signed by your approved Sentinel Personal update authority."}
                </p>
              </div>
              <div className="sentinel-version">Sentinel {updateStatus.edition === "personal" ? "Personal" : "Base"}<strong>Version {updateStatus.currentVersion}</strong></div>
            </div>
            {updateStatus.edition === "personal" ? (
              <div className="update-actions">
                <div className="update-status">
                  <strong>
                    {updateStatus.signingKeyReady
                      ? "Personal update authority ready"
                      : "Create your Personal update authority"}
                  </strong>
                  <span>
                    The private signing key stays in this app’s private data
                    folder. Export only its public key for Base.
                  </span>
                </div>
                <div className="update-buttons">
                  {!updateStatus.signingKeyReady && (
                    <button
                      className="settings-button"
                      disabled={!isDeveloperUnlocked || isUpdating}
                      onClick={() =>
                        void handleUpdateAction(
                          () =>
                            window.sentinelDesktop!.createUpdateSigningKey(
                              getDeveloperToken(),
                            ),
                          "Personal signing key created.",
                        )
                      }
                    >
                      <KeyRound size={17} /> Create signing key
                    </button>
                  )}
                  {updateStatus.signingKeyReady && (
                    <button
                      className="settings-button settings-button--secondary"
                      disabled={!isDeveloperUnlocked || isUpdating}
                      onClick={() =>
                        void handleUpdateAction(
                          () =>
                            window.sentinelDesktop!.exportUpdatePublicKey(
                              getDeveloperToken(),
                            ),
                          "Public key exported to",
                        )
                      }
                    >
                      <Download size={17} /> Export public key
                    </button>
                  )}
                </div>
                {updateStatus.signingKeyReady && (
                  <>
                    <div className="update-workflow">
                      <span>1</span>
                      <div>
                        <strong>Choose a release number</strong>
                        <small>
                          Use a newer number for every release, for example
                          1.1.0 then 1.2.0.
                        </small>
                      </div>
                      <span>2</span>
                      <div>
                        <strong>Build and sign</strong>
                        <small>
                          Sentinel compiles a clean Base installer, excludes
                          personal keys, then signs the update.
                        </small>
                      </div>
                      <span>3</span>
                      <div>
                        <strong>Move it to Base</strong>
                        <small>
                          Open the resulting .sentinel-update file from Base
                          Settings to verify and install it.
                        </small>
                      </div>
                    </div>
                    <div className={`update-studio ${baseStudioOpen ? "is-open" : ""}`}>
                      <button
                        type="button"
                        className="update-studio-toggle"
                        aria-expanded={baseStudioOpen}
                        onClick={() => setBaseStudioOpen((open) => !open)}
                      >
                        <div>
                          <span>PERSONAL RELEASE CONTROL</span>
                          <strong>Sentinel Release Centre</strong>
                          <small>{baseStudioOpen ? "Prepare, validate and publish Desktop or iPhone releases from one protected workflow." : "Expand to manage Desktop, iPhone and combined releases."}</small>
                        </div>
                        <ChevronDown className={baseStudioOpen ? "is-open" : ""} />
                      </button>
                      {baseStudioOpen && <div className="update-studio-body">
                      <div className="installation-policy">
                        <div><strong>Release target</strong><small>Choose which Sentinel Base installations receive this release.</small></div>
                        <div role="radiogroup" aria-label="Release target">
                          <button type="button" className={releaseTarget === "desktop" ? "selected" : ""} onClick={() => setReleaseTarget("desktop")}><strong>Desktop</strong><small>Windows Base only</small></button>
                          <button type="button" className={releaseTarget === "ios" ? "selected" : ""} onClick={() => setReleaseTarget("ios")}><strong>iPhone</strong><small>iOS safe content only</small></button>
                          <button type="button" className={releaseTarget === "both" ? "selected" : ""} onClick={() => setReleaseTarget("both")}><strong>Both</strong><small>Desktop and iOS</small></button>
                        </div>
                      </div>
                      <div className="release-console-grid">
                        <div className="installation-policy">
                          <div><strong>Delivery type</strong><small>Content can publish now. Native iPhone binaries continue through TestFlight.</small></div>
                          <div role="radiogroup" aria-label="Delivery type">
                            <button type="button" className={releaseDelivery === "content" ? "selected" : ""} onClick={() => setReleaseDelivery("content")}><strong>Sentinel content</strong><small>Modules, configuration and compatible UI content</small></button>
                            <button type="button" className={releaseDelivery === "native" ? "selected" : ""} onClick={() => { setReleaseDelivery("native"); if (releaseTarget === "desktop") setReleaseTarget("ios"); }}><strong>Native TestFlight</strong><small>Tracks an Apple-signed iPhone build</small></button>
                          </div>
                        </div>
                        <div className="installation-policy">
                          <div><strong>Release audience</strong><small>Prove a release on one registered device before making it generally available.</small></div>
                          <div role="radiogroup" aria-label="Release audience">
                            <button type="button" className={releaseAudience === "test" ? "selected" : ""} onClick={() => setReleaseAudience("test")}><strong>Test device</strong><small>Restricted validation release</small></button>
                            <button type="button" className={releaseAudience === "all" ? "selected" : ""} onClick={() => setReleaseAudience("all")}><strong>All devices</strong><small>Production release</small></button>
                          </div>
                        </div>
                      </div>
                      {releaseAudience === "test" && (
                        <label className="release-device-select">
                          Test installation
                          <select value={testInstallationId} onChange={event => setTestInstallationId(event.target.value)}>
                            <option value="">Choose a registered device</option>
                            {targetInstallations.map(item => <option key={item.installationId} value={item.installationId}>{item.deviceName} · {item.platform === "ios" ? "iPhone" : "Desktop"} · app {item.appVersion} · content {item.contentVersion}</option>)}
                          </select>
                        </label>
                      )}
                      {releaseDelivery === "native" && (
                        <div className="xcode-cloud-panel">
                          <header><div><strong>Xcode Cloud & TestFlight</strong><small>Start Apple-signed iPhone builds from Sentinel Personal. The private key is encrypted by Windows and never sent to Sentinel Base or Cloudflare.</small></div><span className={xcodeCloudStatus?.connected ? "is-connected" : ""}>{xcodeCloudStatus?.connected ? "Connected" : xcodeCloudStatus?.configured ? "Attention needed" : "Setup required"}</span></header>
                          {!xcodeCloudStatus?.connected && <div className="xcode-cloud-config">
                            <label>Issuer ID<input value={xcodeIssuerId} onChange={event => setXcodeIssuerId(event.target.value)} placeholder="App Store Connect issuer UUID" /></label>
                            <label>Key ID<input value={xcodeKeyId} onChange={event => setXcodeKeyId(event.target.value.toUpperCase())} placeholder="API key ID" /></label>
                            <label>Workflow ID<input value={xcodeWorkflowId} onChange={event => setXcodeWorkflowId(event.target.value)} placeholder="Xcode Cloud workflow ID" /></label>
                            <button type="button" className="settings-button" disabled={isXcodeCloudBusy || !xcodeIssuerId.trim() || !xcodeKeyId.trim() || !xcodeWorkflowId.trim()} onClick={() => void configureXcodeCloud()}><KeyRound size={16} /> Select .p8 key and connect</button>
                          </div>}
                          {xcodeCloudStatus?.connected && <div className="xcode-cloud-live">
                            <div><strong>{xcodeCloudStatus.workflowName || "Sentinel iOS"}</strong><small>Workflow {xcodeCloudStatus.workflowId}</small></div>
                            <div><strong>{xcodeCloudStatus.latestRun?.executionProgress || xcodeCloudStatus.latestRun?.completionStatus || "Ready"}</strong><small>{xcodeCloudStatus.latestRun?.id ? `Latest run ${xcodeCloudStatus.latestRun.id}` : "No previous build found"}</small></div>
                            <button type="button" className="settings-button settings-button--secondary" disabled={isXcodeCloudBusy} onClick={() => void refreshXcodeCloudStatus()}><RefreshCw size={16} /> Refresh</button>
                            <button type="button" className="settings-button" disabled={isXcodeCloudBusy || releasePreflight.errors.length > 0} onClick={() => void startXcodeCloudBuild()}><Play size={16} /> Start TestFlight build</button>
                            <button type="button" className="settings-button settings-button--secondary" disabled={isXcodeCloudBusy} onClick={() => void disconnectXcodeCloud()}><KeyRound size={16} /> Change connection</button>
                          </div>}
                          {xcodeCloudStatus?.error && <small className="companion-status-error">{xcodeCloudStatus.error}</small>}
                          <div className="testflight-fallback"><label>Existing build number<input value={testFlightBuild} onChange={event => setTestFlightBuild(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="Optional manual build" /></label><label>TestFlight link<input value={testFlightUrl} onChange={event => setTestFlightUrl(event.target.value)} placeholder="https://testflight.apple.com/join/..." /></label></div>
                        </div>
                      )}
                      <div className="release-discovery-notice">
                        <Monitor />
                        <div>
                          <strong>Registered Base installations</strong>
                          <small>
                            {(publisherStatus?.installations ?? []).length === 0
                              ? "No Base clients have registered yet. Windows and iPhone clients appear here after their next cloud check."
                              : `${(publisherStatus?.installations ?? []).filter(item => item.platform === "windows").length} Desktop · ${(publisherStatus?.installations ?? []).filter(item => item.platform === "ios").length} iPhone`}
                          </small>
                        </div>
                      </div>
                      {(publisherStatus?.installations ?? []).length > 0 && (
                        <div className="release-installations">
                          <header><strong>Device readiness</strong><small>Last cloud check and installed versions. Sentinel collects no personal content.</small></header>
                          {(publisherStatus?.installations ?? []).map(item => {
                            const stale = Date.now() - new Date(item.lastSeenAt).getTime() > 7 * 24 * 60 * 60 * 1000;
                            return <div key={item.installationId}>
                              <span className={`release-platform release-platform--${item.platform}`}>{item.platform === "ios" ? "iOS" : "PC"}</span>
                              <div><strong>{item.deviceName}</strong><small>App {item.appVersion} · Content {item.contentVersion}</small></div>
                              <time className={stale ? "is-stale" : ""}>{stale ? "Check-in stale" : new Date(item.lastSeenAt).toLocaleString()}</time>
                            </div>;
                          })}
                        </div>
                      )}
                      <div className="release-type-picker" role="radiogroup" aria-label="Release type">
                        {([
                          ["module", "Module update", "Only selected features"],
                          ["maintenance", "Maintenance", "Shared fixes and selected systems"],
                          ["full", "Full Base release", "Every approved Base module"],
                        ] as const).map(([id, label, detail]) => (
                          <button key={id} type="button" className={releaseType === id ? "selected" : ""} onClick={() => setReleaseType(id)}>
                            <strong>{label}</strong><small>{detail}</small>
                          </button>
                        ))}
                      </div>
                      <div className="installation-policy">
                        <div><strong>Installation choice shown to Base users</strong><small>This policy is signed into the release and cannot be changed in the cloud.</small></div>
                        <div role="radiogroup" aria-label="Installation policy">
                          <button type="button" className={installationPolicy === "optional" ? "selected" : ""} onClick={() => setInstallationPolicy("optional")}><strong>Accept or decline</strong><small>The update is optional.</small></button>
                          <button type="button" className={installationPolicy === "required" ? "selected" : ""} onClick={() => setInstallationPolicy("required")}><strong>Install now or later</strong><small>It cannot be permanently declined.</small></button>
                        </div>
                      </div>
                      {releaseModules.some(module => module.newlyDetected) && (
                        <div className="release-discovery-notice">
                          <Sparkles />
                          <div>
                            <strong>New source components detected after restart</strong>
                            <small>
                              {releaseModules
                                .filter(module => module.newlyDetected)
                                .map(module => module.label)
                                .join(" · ")} can now be included in a Base update.
                            </small>
                          </div>
                        </div>
                      )}
                      <div className="release-module-grid">
                        {releaseModules.map(module => {
                          const selected = resolvedReleaseModules.includes(module.id);
                          const dependency = selected && !selectedReleaseModules.includes(module.id) && releaseType !== "full";
                          return (
                            <button key={module.id} type="button" className={selected ? "selected" : ""} disabled={releaseType === "full" || dependency} onClick={() => toggleReleaseModule(module.id)}>
                              <span>{selected ? <Check size={15} /> : null}</span>
                              <div><strong>{module.label}</strong><small>{module.description}</small></div>
                              <em className={`risk-${module.risk}`}>{module.newlyDetected ? "New" : dependency ? "Required" : module.risk}</em>
                            </button>
                          );
                        })}
                      </div>
                      <div className="release-safety">
                        <ShieldCheck />
                        <div><strong>Personal-only boundary enforced</strong><small>{blockedReleaseFeatures.join(" · ") || "Personal administration features are blocked from Base releases."}</small></div>
                      </div>
                      <label className="release-notes">
                        Release notes
                        <textarea value={releaseNotes} onChange={event => setReleaseNotes(event.target.value)} placeholder="What changed, what was fixed, and anything the Base user should know…" maxLength={4000} />
                      </label>
                      <div className="release-preview">
                        <strong>Package preview</strong>
                        <span>{releaseDelivery === "native" ? `TestFlight build ${testFlightBuild || "not set"}` : `${resolvedReleaseModules.length} approved modules`} · {releaseAudience === "test" ? selectedTestInstallation?.deviceName || "test device not selected" : "all registered devices"}</span>
                        <div>{resolvedReleaseModules.map(id => <small key={id}>{releaseModules.find(module => module.id === id)?.label ?? id}</small>)}</div>
                      </div>
                      <div className="release-preflight">
                        <div><strong>Pre-publish safety check</strong><small>Dry-run validation changes nothing and uploads nothing.</small></div>
                        <button type="button" className="settings-button settings-button--secondary" onClick={runReleasePreflight}><ShieldCheck size={17} /> Run dry check</button>
                        {preflightStatus.type !== "idle" && <ul className={preflightStatus.type}>{preflightStatus.items.map(item => <li key={item}>{item}</li>)}</ul>}
                      </div>
                    <div className="update-package-form">
                      <label>
                        Release version
                        <input
                          value={updateVersion}
                          onChange={(event) =>
                            setUpdateVersion(event.target.value)
                          }
                          placeholder="1.1.0"
                        />
                      </label>
                      {releaseDelivery === "content" ? <button
                        type="button"
                        className="settings-button"
                        disabled={
                          !isDeveloperUnlocked ||
                          isUpdating ||
                          !updateVersion.trim() ||
                          resolvedReleaseModules.length === 0 ||
                          releasePreflight.errors.length > 0
                        }
                        onClick={() => void buildSignedBaseUpdate()}
                      >
                        <PackageCheck size={17} />{" "}
                        {isUpdating
                          ? "Building update…"
                          : "Build signed Base update"}
                      </button> : <button type="button" className="settings-button" disabled={releasePreflight.errors.length > 0 || isXcodeCloudBusy} onClick={xcodeCloudStatus?.connected ? () => void startXcodeCloudBuild() : runReleasePreflight}><PackageCheck size={17} /> {xcodeCloudStatus?.connected ? "Build through Xcode Cloud" : "Validate TestFlight release"}</button>}
                    </div>
                    {releaseBuildStatus.type !== "idle" || releaseBuildStatus.text ? (
                      <div className={`release-build-status release-build-status--${releaseBuildStatus.type}`} role="status" aria-live="polite">
                        {releaseBuildStatus.type === "building" ? <RefreshCw className="release-build-spinner" size={18} /> : releaseBuildStatus.type === "success" ? <Check size={18} /> : null}
                        <div>
                          <strong>{releaseBuildStatus.type === "building" ? "Build in progress" : releaseBuildStatus.type === "success" ? "Build complete" : releaseBuildStatus.type === "error" ? "Build failed" : "Build status"}</strong>
                          <small>{releaseBuildStatus.text}</small>
                        </div>
                      </div>
                    ) : null}
                    <div className="release-publisher">
                      <header><div><strong>Remote Release Publisher</strong><small>Publishes signed Sentinel releases only. No user content or personal settings are collected.</small></div><span>{publisherStatus?.connected ? "Connected" : updateStatus.publisherConfigured ? "Configured · test required" : "Setup required"}</span></header>
                      {!updateStatus.publisherConfigured && (
                        <div className="publisher-config">
                          <label>Private update service URL<input value={publisherEndpoint} onChange={event => setPublisherEndpoint(event.target.value)} placeholder="https://updates.example.com" /></label>
                          <label>Publishing token<input type="password" value={publisherToken} onChange={event => setPublisherToken(event.target.value)} placeholder="Stored encrypted on this PC" /></label>
                          <button type="button" className="settings-button" disabled={!isDeveloperUnlocked || isUpdating || !publisherEndpoint || !publisherToken} onClick={() => void handleUpdateAction(() => window.sentinelDesktop!.configureUpdatePublisher(getDeveloperToken(), publisherEndpoint, publisherToken).then(result => { setPublisherToken(""); setPublisherStatus({ configured: true, connected: true, endpoint: result.endpoint }); return result; }), "Private update publisher connected and configured.")}><ShieldCheck size={17} /> Save and test publisher</button>
                        </div>
                      )}
                      {updateStatus.publisherConfigured && <div className="publisher-test"><button type="button" className="settings-button settings-button--secondary" disabled={!isDeveloperUnlocked || isUpdating} onClick={() => void refreshPublisherStatus()}><RefreshCw size={17} /> Test cloud publisher</button><small>{publisherStatus?.latestVersion ? `Latest published Base release: ${publisherStatus.latestVersion}` : "Checks the private token, release storage and metadata service."}</small></div>}
                      <div className="publisher-ready">
                        <div><strong>{builtPackagePath ? `Ready: ${updateVersion}` : "Build a signed update first"}</strong><small>{builtPackagePath || "The package remains local until you explicitly publish it."}</small></div>
                        <button type="button" className="settings-button" disabled={!isDeveloperUnlocked || isUpdating || !updateStatus.publisherConfigured || !builtPackagePath} onClick={() => void publishSignedBaseUpdate()}><Upload size={17} /> {releasePublishStatus.type === "publishing" ? "Publishing…" : "Publish update"}</button>
                      </div>
                      {releasePublishStatus.type !== "idle" ? (
                        <div className={`release-build-status release-build-status--${releasePublishStatus.type === "publishing" ? "building" : releasePublishStatus.type}`} role="status" aria-live="polite">
                          {releasePublishStatus.type === "publishing" ? <RefreshCw className="release-build-spinner" size={18} /> : releasePublishStatus.type === "success" ? <Check size={18} /> : null}
                          <div><strong>{releasePublishStatus.type === "publishing" ? "Cloud upload in progress" : releasePublishStatus.type === "success" ? "Update published" : "Publish failed"}</strong><small>{releasePublishStatus.text}</small></div>
                        </div>
                      ) : null}
                    </div>
                    <details className="update-advanced">
                      <summary>Advanced: package an existing installer</summary>
                      <p>
                        Use this only when you already built and tested a Base
                        installer manually.
                      </p>
                      <button
                        type="button"
                        className="settings-button settings-button--secondary"
                        disabled={!isDeveloperUnlocked || isUpdating}
                        onClick={() =>
                          void handleUpdateAction(
                            () =>
                              window.sentinelDesktop!.createUpdatePackage(
                                getDeveloperToken(),
                                updateVersion,
                                releasePlan,
                              ),
                            "Signed update package created at",
                          )
                        }
                      >
                        <Upload size={17} /> Select existing installer
                      </button>
                    </details>
                      </div>}
                    </div>
                  </>
                )}
                {!isDeveloperUnlocked && (
                  <small>
                    Unlock Developer Mode to manage the Personal update
                    authority.
                  </small>
                )}
              </div>
            ) : (
              <div className="update-actions">
                <div className="update-status">
                  <strong>
                    {updateStatus.authorityApproved
                      ? "Approved Personal update authority"
                      : "No update authority approved"}
                  </strong>
                  <span>
                    {updateStatus.authorityApproved
                      ? "Selected packages must pass signature and installer-hash verification before Sentinel will stage them."
                      : "An approved operator must unlock Developer Mode and import the public key exported by Sentinel Personal."}
                  </span>
                </div>
                <div className="update-buttons">
                  {!updateStatus.authorityApproved && (
                    <button
                      className="settings-button"
                      disabled={!isDeveloperUnlocked || isUpdating}
                      onClick={() =>
                        void handleUpdateAction(
                          () =>
                            window.sentinelDesktop!.importUpdateAuthority(
                              getDeveloperToken(),
                            ),
                          "Update authority approved.",
                        )
                      }
                    >
                      <KeyRound size={17} /> Approve Personal key
                    </button>
                  )}
                  {updateStatus.authorityApproved && (
                    <button
                      className="settings-button settings-button--secondary"
                      disabled={isUpdating}
                      onClick={() =>
                        void handleUpdateAction(
                          () => window.sentinelDesktop!.selectUpdatePackage(),
                          "Verified update staged.",
                        )
                      }
                    >
                      <Upload size={17} /> Select update package
                    </button>
                  )}
                  {updateStatus.pending && (
                    <button
                      className="settings-button"
                      disabled={isUpdating}
                      onClick={() =>
                        void handleUpdateAction(
                          () => window.sentinelDesktop!.installUpdate(getDeveloperToken()),
                          "Installer started. Sentinel will now close.",
                        )
                      }
                    >
                      <Download size={17} /> Install{" "}
                      {updateStatus.pending.version}
                    </button>
                  )}
                  {updateStatus.canRollback && (
                    <button
                      className="settings-button settings-button--secondary"
                      disabled={isUpdating}
                      onClick={() =>
                        void handleUpdateAction(
                          () => window.sentinelDesktop!.installUpdate(getDeveloperToken(), true),
                          "Rollback installer started. Sentinel will now close.",
                        )
                      }
                    >
                      <Download size={17} /> Restore previous release
                    </button>
                  )}
                </div>
                {updateStatus.pending && (
                  <div className="base-update-preview">
                    <strong>Verified {updateStatus.pending.releaseType ?? "legacy"} release · {updateStatus.pending.version}</strong>
                    <span>{updateStatus.pending.installationPolicy === "required" ? "Required update — install now or later" : "Optional update — accept or decline"}</span>
                    {updateStatus.pending.modules?.length ? <span>{updateStatus.pending.modules.join(" · ")}</span> : null}
                    {updateStatus.pending.notes ? <p>{updateStatus.pending.notes}</p> : null}
                    <small>Sentinel retains verified packages so the previous release can be restored if needed.</small>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {updateStatus?.edition === "base" && (
          <section className="settings-card settings-card--wide factory-reset-card">
            <div className="settings-card-title">
              <RotateCcw />
              <div>
                <h2>Refresh Sentinel</h2>
                <p>
                  Return this Base installation to its original first-run state.
                </p>
              </div>
              <button
                className="settings-button factory-reset-button"
                onClick={() => setResetOpen(true)}
              >
                <RotateCcw size={17} /> Refresh Sentinel
              </button>
            </div>
            <div className="factory-reset-warning">
              <AlertTriangle />
              <span>
                This erases all API keys, integrations, owner details, Developer
                Mode password, conversations, trips, trusted-device labels and
                interface preferences from this Base installation.
              </span>
            </div>
          </section>
        )}

        <section className="settings-card settings-card--small">
          <div className="settings-card-title">
            <Database />
            <div>
              <h2>Memory</h2>
              <p>
                Conversations are retained locally so Sentinel can keep context.
              </p>
            </div>
          </div>
          <button className="settings-link" onClick={openMemory}>
            Manage saved memory <ChevronRight size={17} />
          </button>
        </section>
        <section className="settings-card settings-card--small">
          <div className="settings-card-title">
            <Sparkles />
            <div>
              <h2>Sentinel intelligence</h2>
              <p>Weather, device monitoring, and chat services are active.</p>
            </div>
          </div>
          <div className="service-health">
            <span /> All core services ready
          </div>
        </section>
      </div>
      {guideOpen && <SentinelGuide onClose={() => setGuideOpen(false)} />}
      {resetOpen && (
        <div
          className="sentinel-guide-backdrop"
          onMouseDown={() => !resetting && setResetOpen(false)}
        >
          <section
            className="factory-reset-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="factory-reset-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <AlertTriangle />
              <div>
                <p>DESTRUCTIVE ACTION</p>
                <h2 id="factory-reset-title">Refresh Sentinel Base?</h2>
              </div>
            </header>
            <p>
              This permanently removes this Base user’s configuration and
              returns Sentinel to first-run setup. It cannot be undone.
            </p>
            <label>
              Current Developer Mode password
              <input
                type="password"
                autoComplete="current-password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
              />
            </label>
            <label>
              Type <strong>REFRESH SENTINEL</strong> to confirm
              <input
                value={resetConfirmation}
                onChange={(event) => setResetConfirmation(event.target.value)}
                placeholder="REFRESH SENTINEL"
              />
            </label>
            <div>
              <button
                className="settings-button settings-button--secondary"
                disabled={resetting}
                onClick={() => setResetOpen(false)}
              >
                Cancel
              </button>
              <button
                className="settings-button factory-reset-confirm"
                disabled={
                  resetting ||
                  !resetPassword ||
                  resetConfirmation !== "REFRESH SENTINEL"
                }
                onClick={() => void refreshSentinel()}
              >
                {resetting ? "Refreshing…" : "Erase and restart"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SentinelGuide({ onClose }: { onClose: () => void }) {
  const sections = [
    {
      title: "1. First run and Core setup",
      text: "Open Settings → Setup Centre → Core setup and enter your name. Sentinel Personal has eight core services: OpenAI for Sentinel AI, Chat, voice transcription and image generation; ElevenLabs for sound-effect generation from Chat; Google Maps for maps, routes and places; WeatherAPI for forecasts; FlyStack for scheduled-flight information; Govee for supported smart lighting; OpenSky for live aircraft; and Cloudflare Relay for approved remote, companion and Alexa services. ElevenLabs is Personal-only and is not copied into Base releases. On Sentinel Base, enter the one-time Cloudflare setup code generated by Sentinel Personal—never the owner's Cloudflare secret. Use Get your key where offered, save Core setup, then run Quick self-diagnosis. Configured means a credential is stored securely on this computer; it does not guarantee that the provider is currently reachable.",
    },
    {
      title: "2. Modules and Integration Builder",
      text: "Use dedicated connection panels for built-in providers. In Sentinel Personal or Base, unlock Developer Mode and open Integration Builder to connect another HTTPS JSON API. Enter the service name, choose Automation, Security or Installed modules, explain what Sentinel should do, and store the credential separately. Paste provider documentation without keys or passwords and Sentinel AI can prepare a constrained mapping draft; it never receives the credential and does not edit source code. Review Technical mapping before saving. Test API response checks JSON, not physical device state. Discover devices before Run; commands require native desktop approval. OAuth, custom signing, SDKs and local software need a dedicated reviewed integration rather than the generic wizard.",
    },
    {
      title: "3. Alexa, Ring, Hue and Govee",
      text: "Alexa uses the Sentinel AI skill and managed relay: enter the temporary Base setup code, link the household, then open Sentinel AI on each Echo you want Sentinel to recognise. Amazon does not provide a complete household inventory or unrestricted Echo controls. Connect Ring only through its dedicated secure flow and never paste Ring tokens into Chat. For Hue, complete cloud or bridge authorisation as shown; for Govee, use its approved API credentials. Provider availability, permissions and rate limits still apply even when a card says Connected.",
    },
    {
      title: "4. Home and Quick Command",
      text: "Home is the live command centre. The reactor and status cards show current Sentinel state; the five cards open Chat, Weather, System, Navigation and Notifications. Type in Quick Command for a short request, select the microphone for one-shot dictation, or select the waveform for a persistent live conversation. Quick Command can answer questions and request supported page, route, weather, system, camera and home actions. Sentinel reports completion only after the relevant local service or provider confirms it.",
    },
    {
      title: "5. Persistent voice conversation",
      text: "Start Talk with Sentinel from Home, the Chat waveform button or the waveform in the top bar. The same conversation remains active when you move between pages. Close the panel with X to minimise it without ending the session; select the top waveform to show it again. End it with End conversation, an accepted standby phrase such as ‘Hey Sentinel, shut down’, or by remaining silent for 30 seconds. Mute pauses microphone input. The transcript follows the latest exchange automatically and recent conversation context is retained for the active session.",
    },
    {
      title: "6. Wake standby and voice privacy",
      text: "In Settings → Always listening & voice privacy, enable Hey Sentinel standby and configure up to six wake phrases, standby phrases, microphone sensitivity and confirmation tones. Say a configured phrase such as ‘Hey Sentinel, start a chat’ to open live conversation. The top voice control shows whether standby or a session is active. Wake audio is processed transiently; raw audio is not saved. Microphone activity records state changes only and can be cleared. Lower sensitivity in noisy rooms or raise it when phrases are missed.",
    },
    {
      title: "7. Chat, memory and attachments",
      text: "Chat keeps named conversations and supports text, one-shot voice input, attachments and a Memory manager. Use New Chat to separate subjects, the conversation menu to rename or delete, the paperclip to attach a supported file, the microphone to dictate one message, the brain to review memory, and the waveform for live conversation. Attach an XLSX, CSV or TSV file to analyse its sheets, formulas and data quality, or ask Sentinel to build or improve an Excel workbook and download the finished XLSX from Chat. Sentinel can remember useful preferences and project context when memory is enabled; review or remove saved memories from the Memory manager. Do not place passwords, API keys, setup codes or private tokens in a conversation.",
    },
    {
      title: "8. Developer Mode and Codex Developer",
      text: "Developer Mode is protected by your developer password and automatically expires after 30 minutes. When unlocked in Sentinel Personal, Chat exposes Codex Developer using the locally authenticated Codex account. It can inspect and search the authorised Sentinel workspace and prepare source changes, but it cannot reveal hidden model reasoning. Source edits, Windows control and other consequential actions require the applicable approval before execution. Lock Developer Mode when finished; voice locking is supported, while voice unlocking must still satisfy the configured permission and approval rules.",
    },
    {
      title: "9. Mission Control overview",
      text: "Mission Control combines four workspaces: Mission Control, Home Command, Routines, Automation and Security. The overview shows verified service, device, camera and activity counts, house state, recent events and shortcuts. Customise controls which overview sections are visible. Choose Home, Away, Night, Guest or Holiday to record the current operating mode; a mode label does not itself change devices unless a reviewed routine or automation is run.",
    },
    {
      title: "10. Home Command, colours and routines",
      text: "Home Command groups verified devices by room. Select a room, then select an individual controllable device to turn only that device on or off. Compatible Hue and Govee lighting also exposes brightness, colour temperature or colour controls when the provider reports support. Routines coordinates reviewed multi-device actions such as Arrival, Movie mode and Good night; open Review & run, inspect the targets, then approve. Only provider-confirmed completions enter Run history. Rate-limit or offline errors are shown honestly and should be retried later rather than repeatedly.",
    },
    {
      title: "11. Automation and Security",
      text: "Automation contains integration status, connection details, rooms, groups, scenes and device controls; its large sections can be collapsed to keep the page manageable. Security contains Ring and added security providers, cameras, live view, audio where supported, device state and verified event history. Camera video and device changes depend on provider permissions and network availability. A Connected integration can still have an unreachable device, an expired session or a temporary provider limit, so refresh and inspect the displayed error before changing configuration.",
    },
    {
      title: "12. Navigation and Places",
      text: "Navigation uses your current location as the default origin. Search an address, landmark, town or postcode, select a suggestion, then calculate driving, walking or transit directions. The route panel shows distance, ETA and available traffic context and can hand off to the supported map service. Places searches nearby categories such as food, coffee, fuel and pharmacy and prioritises relevant local results. Voice can open Navigation and request a route, but check the displayed destination before travelling.",
    },
    {
      title: "13. Travel and flights",
      text: "Travel contains Ready to go, Destination and Flight tracker. Save a trip with departure and return dates, complete the readiness checklist, review weather and official entry reminders, and search destination recommendations. Flight tracker can check a flight without saving it and can store booked itineraries with terminal details; the complete My flights area, including new and saved flights, can be collapsed. Scheduled status and live aircraft telemetry come from different providers and may differ. Always follow the airline, airport and official travel guidance.",
    },
    {
      title: "14. Weather",
      text: "Today shows current conditions and hourly weather. Weekly forecast shows provider-supplied days; select a day for its hourly outlook. Weather radar uses WeatherAPI precipitation forecast maps, not historical radar: seven hourly frames from the current hour to six hours ahead. Now returns to the current-hour forecast; Play forecast advances forward; Refresh forecast reloads the timeline. Times are shown in your local timezone. Forecast tiles have limited spatial detail when zoomed in, and missing tiles show an error rather than implying dry weather.",
    },
    {
      title: "15. Network Centre and System",
      text: "Network Centre performs approved network inventory and connection diagnostics. Unlock Developer Mode before discovery, run a safe scan, then mark recognised devices Trusted, Blocked or Unknown. These are personal labels only and do not grant control or alter router security. System shows current Windows and Sentinel vitals, service health and available checks. Use Settings → Quick self-diagnosis for the critical application path; neither page is a replacement for antivirus, router administration or professional security analysis.",
    },
    {
      title: "16. Audio Control and AI DJ",
      text: "Audio Control manages supported Windows playback devices, system volume and enabled music services. AI DJ is Sentinel's self-contained local mixer: choose a folder containing music files you own, select a show personality, then Sentinel manages two decks, automatic transitions and effects. Spotify and other streaming catalogues remain playback-only and subject to their provider restrictions; Sentinel does not download or remix protected streams.",
    },
    {
      title: "17. Concierge and express approval",
      text: "Concierge turns a natural-language meal request into an editable basket, supports saved favourites and stores the delivery profile locally. Review every item, provider, estimate, postcode, allergies and budget before selecting Express approval. Approval records permission for the handoff only: no payment is taken by Sentinel, and you must still verify the live basket, address, allergens, total and payment in the provider checkout.",
    },
    {
      title: "18. Design, Notifications and visible pages",
      text: "Design accepts a description plus supported images or documents, produces measured project geometry and allows review before export; verify all dimensions before manufacture. Notifications combines security events, service health and important system activity, with read state and refresh controls. Settings → Visible pages hides optional pages from the sidebar and command search without uninstalling modules or deleting their data. Home and Settings remain available.",
    },
    {
      title: "19. Companion Sync and iPhone access",
      text: "In Sentinel Personal, enable Companion Sync, create a one-time six-digit pairing code and enter it on the iPhone. Shared Workspace sends text or files over local Wi-Fi first with the private relay as fallback; review and delete received items when finished. Mobile Service Access separately grants selected device-scoped permissions for AI Chat, Navigation, Weather, Flight Status and Live Aircraft while the desktop is offline. Raw provider keys are never returned to iPhone. Revoke a device or Mobile Service Access immediately if the phone is lost or no longer trusted.",
    },
    {
      title: "20. Experience, location and accessibility",
      text: "Experience controls the interface colour, accent intensity, animation level, compact layout, notifications, volume and startup sequence. Theme colours apply across Sentinel while green, amber and red remain reserved for status. Under Location access, approve the Windows request and use Refresh location after moving or changing networks; Weather, Navigation, Travel and nearby results depend on it. Use reduced animation or compact layout when preferred, and keep the window large enough for complex dashboards while retaining page scrolling in shorter windows.",
    },
    {
      title: "21. Diagnosis, updates and safe repair",
      text: "Run Quick self-diagnosis after setup and whenever an important feature fails. It checks the local server, required configuration and critical connections, then offers a repair only when the action is safe. It cannot invent a missing credential or repair an invalid provider account. Secure updates show version and release information and require the applicable developer authorisation. Sentinel Personal can create signed release packages; Base should install only packages signed by its approved Personal authority.",
    },
    {
      title: "22. Privacy, approvals and reset",
      text: "Keep API keys, developer passwords, setup codes, Ring tokens, pairing codes and private relay links out of Chat and screenshots. Read-only queries can run directly, while smart-home changes, purchases, source edits, Windows control and other consequential operations require the appropriate explicit approval. Queued means accepted, not completed. For faults, confirm Sentinel Online, check the relevant network, refresh the page or location, then run diagnosis. Refresh Sentinel is the last resort: after password confirmation it permanently removes local keys, settings, memories and the developer password and returns the app to first-run setup.",
    },
  ];
  return (
    <div className="sentinel-guide-backdrop" onMouseDown={onClose}>
      <section
        className="sentinel-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sentinel-guide-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <BookOpen />
            <span>
              <p>COMPLETE SETUP AND USER GUIDE</p>
              <h2 id="sentinel-guide-title">How to use Sentinel</h2>
            </span>
          </div>
          <button aria-label="Close guide" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="sentinel-guide-content">
          {sections.map((section) => (
            <article key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.text}</p>
            </article>
          ))}
        </div>
        <footer>
          <button className="settings-button" onClick={onClose}>
            Close guide
          </button>
        </footer>
      </section>
    </div>
  );
}

function SettingToggle({
  icon,
  title,
  detail,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-icon">{icon}</div>
      <div className="settings-row-copy">
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <button
        aria-label={`Toggle ${title}`}
        className={`settings-toggle ${checked ? "settings-toggle--on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <i />
      </button>
    </div>
  );
}
