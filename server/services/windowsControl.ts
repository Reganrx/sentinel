import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

export type WindowsRisk = "low" | "medium" | "high";

type WindowsActionId =
  | "flush-dns"
  | "reset-store-cache"
  | "restart-explorer"
  | "repair-component-store"
  | "repair-system-files";

export type WindowsControlAction = {
  id: WindowsActionId;
  label: string;
  command: string;
  effect: string;
  risk: WindowsRisk;
  requiresElevation: boolean;
};

export type WindowsDiagnostics = {
  capturedAt: string;
  computerName: string;
  os: string;
  version: string;
  lastBoot: string;
  memory: { usedPercent: number; freeGb: number; totalGb: number };
  systemDrive: { freeGb: number; totalGb: number; freePercent: number };
  network: { connectedAdapters: string[]; internetReachable: boolean };
  pendingRestart: boolean;
  defender: { available: boolean; antivirusEnabled?: boolean; realtimeProtectionEnabled?: boolean };
  notes: string[];
};

export type WindowsControlPlan = {
  id: string;
  request: string;
  createdAt: string;
  expiresAt: string;
  diagnostics: WindowsDiagnostics;
  actions: WindowsControlAction[];
  status: "awaiting_approval" | "diagnostics_only" | "running" | "completed" | "failed" | "expired";
};

const plans = new Map<string, WindowsControlPlan>();
const PLAN_LIFETIME_MS = 10 * 60 * 1000;

const ACTIONS: Record<WindowsActionId, WindowsControlAction> = {
  "flush-dns": {
    id: "flush-dns",
    label: "Flush the Windows DNS cache",
    command: "ipconfig.exe /flushdns",
    effect: "Clears cached name-resolution entries. Network requests may briefly reconnect.",
    risk: "low",
    requiresElevation: false,
  },
  "reset-store-cache": {
    id: "reset-store-cache",
    label: "Reset the Microsoft Store cache",
    command: "wsreset.exe",
    effect: "Clears the Store cache and may open Microsoft Store when complete.",
    risk: "medium",
    requiresElevation: false,
  },
  "restart-explorer": {
    id: "restart-explorer",
    label: "Restart Windows Explorer",
    command: "Stop-Process explorer; Start-Process explorer.exe",
    effect: "The taskbar, desktop and File Explorer windows may disappear briefly.",
    risk: "medium",
    requiresElevation: false,
  },
  "repair-component-store": {
    id: "repair-component-store",
    label: "Repair the Windows component store",
    command: "DISM.exe /Online /Cleanup-Image /RestoreHealth",
    effect: "Runs the Microsoft DISM repair. It can take a considerable time and requires elevation.",
    risk: "high",
    requiresElevation: true,
  },
  "repair-system-files": {
    id: "repair-system-files",
    label: "Repair protected Windows system files",
    command: "sfc.exe /scannow",
    effect: "Checks and repairs protected system files. It can take a considerable time and requires elevation.",
    risk: "high",
    requiresElevation: true,
  },
};

function run(file: string, args: string[], timeoutMs = 30_000) {
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true, shell: false });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("The Windows operation timed out."));
    }, timeoutMs);
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? -1 });
    });
  });
}

export async function runWindowsDiagnostics(): Promise<WindowsDiagnostics> {
  const script = String.raw`
$ErrorActionPreference='SilentlyContinue'
$os=Get-CimInstance Win32_OperatingSystem
$drive=Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$adapters=@(Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object -ExpandProperty Name)
$reachable=Test-NetConnection -ComputerName 1.1.1.1 -Port 443 -InformationLevel Quiet
$pending=(Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending') -or (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired')
$defender=Get-MpComputerStatus
[pscustomobject]@{
 computerName=$env:COMPUTERNAME
 os=$os.Caption
 version=$os.Version
 lastBoot=$os.LastBootUpTime.ToString('o')
 totalMemoryGb=[math]::Round($os.TotalVisibleMemorySize/1MB,2)
 freeMemoryGb=[math]::Round($os.FreePhysicalMemory/1MB,2)
 driveTotalGb=[math]::Round($drive.Size/1GB,2)
 driveFreeGb=[math]::Round($drive.FreeSpace/1GB,2)
 connectedAdapters=$adapters
 internetReachable=[bool]$reachable
 pendingRestart=[bool]$pending
 defenderAvailable=[bool]($null -ne $defender)
 antivirusEnabled=[bool]$defender.AntivirusEnabled
 realtimeProtectionEnabled=[bool]$defender.RealTimeProtectionEnabled
} | ConvertTo-Json -Compress
`;
  const result = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], 35_000);
  if (result.code !== 0 || !result.stdout) throw new Error(result.stderr || "Windows diagnostics did not return a result.");
  const raw = JSON.parse(result.stdout) as Record<string, unknown>;
  const totalMemory = Number(raw.totalMemoryGb || 0);
  const freeMemory = Number(raw.freeMemoryGb || 0);
  const driveTotal = Number(raw.driveTotalGb || 0);
  const driveFree = Number(raw.driveFreeGb || 0);
  const notes: string[] = [];
  if (raw.pendingRestart) notes.push("Windows reports that a restart is pending.");
  if (!raw.internetReachable) notes.push("The external connectivity probe did not succeed.");
  if (driveTotal && driveFree / driveTotal < 0.1) notes.push("The system drive has less than 10% free space.");
  if (raw.defenderAvailable && !raw.realtimeProtectionEnabled) notes.push("Microsoft Defender realtime protection is not reporting as enabled.");
  return {
    capturedAt: new Date().toISOString(),
    computerName: String(raw.computerName || "Windows PC"),
    os: String(raw.os || "Windows"),
    version: String(raw.version || "Unknown"),
    lastBoot: String(raw.lastBoot || "Unknown"),
    memory: {
      usedPercent: totalMemory ? Math.round(((totalMemory - freeMemory) / totalMemory) * 100) : 0,
      freeGb: freeMemory,
      totalGb: totalMemory,
    },
    systemDrive: {
      freeGb: driveFree,
      totalGb: driveTotal,
      freePercent: driveTotal ? Math.round((driveFree / driveTotal) * 100) : 0,
    },
    network: {
      connectedAdapters: Array.isArray(raw.connectedAdapters) ? raw.connectedAdapters.map(String) : raw.connectedAdapters ? [String(raw.connectedAdapters)] : [],
      internetReachable: Boolean(raw.internetReachable),
    },
    pendingRestart: Boolean(raw.pendingRestart),
    defender: {
      available: Boolean(raw.defenderAvailable),
      antivirusEnabled: Boolean(raw.antivirusEnabled),
      realtimeProtectionEnabled: Boolean(raw.realtimeProtectionEnabled),
    },
    notes,
  };
}

function actionsForRequest(request: string): WindowsControlAction[] {
  const value = request.toLowerCase();
  const selected = new Set<WindowsActionId>();
  if (/\b(dns|name resolution|internet|network|connection)\b/.test(value)) selected.add("flush-dns");
  if (/\b(microsoft store|store cache|windows store)\b/.test(value)) selected.add("reset-store-cache");
  if (/\b(explorer|taskbar|desktop icons?|file explorer)\b/.test(value)) selected.add("restart-explorer");
  if (/\b(repair|corrupt|corruption|system files?|windows health|fix windows|required changes)\b/.test(value)) {
    selected.add("repair-component-store");
    selected.add("repair-system-files");
  }
  return [...selected].map((id) => ACTIONS[id]);
}

export async function createWindowsControlPlan(request: string): Promise<WindowsControlPlan> {
  const diagnostics = await runWindowsDiagnostics();
  const actions = actionsForRequest(request);
  const now = Date.now();
  const plan: WindowsControlPlan = {
    id: randomUUID(),
    request,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + PLAN_LIFETIME_MS).toISOString(),
    diagnostics,
    actions,
    status: actions.length ? "awaiting_approval" : "diagnostics_only",
  };
  plans.set(plan.id, plan);
  audit("plan_created", plan, { actionIds: actions.map((action) => action.id) });
  return plan;
}

async function executeAction(action: WindowsControlAction) {
  if (action.id === "flush-dns") return run("ipconfig.exe", ["/flushdns"], 30_000);
  if (action.id === "reset-store-cache") return run("wsreset.exe", [], 120_000);
  if (action.id === "restart-explorer") {
    return run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue; Start-Process explorer.exe"], 30_000);
  }
  const executable = action.id === "repair-component-store" ? "DISM.exe" : "sfc.exe";
  const argumentList = action.id === "repair-component-store" ? "/Online /Cleanup-Image /RestoreHealth" : "/scannow";
  const elevated = `Start-Process -FilePath '${executable}' -ArgumentList '${argumentList}' -Verb RunAs -Wait`;
  return run("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", elevated], 45 * 60_000);
}

export async function approveWindowsControlPlan(id: string, highRiskConfirmation: string) {
  const plan = plans.get(id);
  if (!plan) throw new Error("That Windows proposal no longer exists. Run the check again.");
  if (Date.parse(plan.expiresAt) < Date.now()) {
    plan.status = "expired";
    throw new Error("That Windows proposal has expired. Run the check again.");
  }
  if (plan.status !== "awaiting_approval") throw new Error("That Windows proposal is not awaiting approval.");
  if (plan.actions.some((action) => action.risk === "high") && highRiskConfirmation !== "APPROVE WINDOWS CONTROL") {
    throw new Error("High-risk Windows repairs require the confirmation phrase APPROVE WINDOWS CONTROL.");
  }
  plan.status = "running";
  const results: Array<{ action: WindowsControlAction; ok: boolean; output: string }> = [];
  try {
    for (const action of plan.actions) {
      const result = await executeAction(action);
      results.push({ action, ok: result.code === 0, output: result.stdout || result.stderr || `Exit code ${result.code}` });
      if (result.code !== 0) throw new Error(`${action.label} failed: ${result.stderr || `exit code ${result.code}`}`);
    }
    plan.status = "completed";
    audit("plan_completed", plan, { results: results.map((result) => ({ action: result.action.id, ok: result.ok })) });
    return { plan, results };
  } catch (error) {
    plan.status = "failed";
    audit("plan_failed", plan, { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

function audit(event: string, plan: WindowsControlPlan, detail: unknown) {
  try {
    const directory = path.join(process.cwd(), "logs");
    mkdirSync(directory, { recursive: true });
    appendFileSync(path.join(directory, "windows-control-audit.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), event, planId: plan.id, detail })}\n`, "utf8");
  } catch {
    // Auditing must never expose or interrupt the user operation.
  }
}
