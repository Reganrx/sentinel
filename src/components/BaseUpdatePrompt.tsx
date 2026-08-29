import { useEffect, useState } from "react";
import { Download, ShieldCheck, X } from "lucide-react";
import { getDeveloperToken, unlockDeveloperMode } from "../services/developer";
import "./BaseUpdatePrompt.css";

type Release = {
  version: string;
  notes?: string;
  releaseType?: "module" | "maintenance" | "full";
  modules?: string[];
  installationPolicy?: "optional" | "required";
};

export default function BaseUpdatePrompt({ active }: { active: boolean }) {
  const [release, setRelease] = useState<Release | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active || import.meta.env.VITE_SENTINEL_EDITION !== "base" || !window.sentinelDesktop) return;
    let cancelled = false;
    window.sentinelDesktop.checkForUpdates().then(result => {
      if (!cancelled && result.available && !result.suppressed && result.release) setRelease(result.release);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [active]);

  if (!release) return null;
  const activeRelease = release;
  const required = activeRelease.installationPolicy === "required";

  async function prepare() {
    setBusy(true);
    setError("");
    try {
      await window.sentinelDesktop!.downloadUpdate(activeRelease.version);
      setReady(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The update could not be downloaded.");
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    setBusy(true);
    setError("");
    try {
      if (!ready) await window.sentinelDesktop!.downloadUpdate(activeRelease.version);
      await unlockDeveloperMode(password);
      await window.sentinelDesktop!.installUpdate(getDeveloperToken());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The update could not be installed.");
      setBusy(false);
    }
  }

  async function later() {
    await window.sentinelDesktop!.deferUpdate(activeRelease.version);
    setRelease(null);
  }

  async function decline() {
    await window.sentinelDesktop!.declineUpdate(activeRelease.version);
    setRelease(null);
  }

  return (
    <div className="base-update-backdrop" role="dialog" aria-modal="true" aria-labelledby="base-update-title">
      <section className="base-update-dialog">
        {!required && <button className="base-update-close" onClick={() => void later()} aria-label="Install later"><X /></button>}
        <div className="base-update-icon"><Download /></div>
        <span className="base-update-kicker">SIGNED SENTINEL RELEASE</span>
        <h2 id="base-update-title">Sentinel {activeRelease.version} is available</h2>
        <p>{activeRelease.notes || "A verified Sentinel update is ready for this computer."}</p>
        {activeRelease.modules?.length ? <small>{activeRelease.modules.join(" · ")}</small> : null}
        <div className="base-update-policy"><ShieldCheck size={17} /> {required ? "Required release — install now or later" : "Optional release — install, postpone or decline"}</div>
        {!ready ? (
          <button className="base-update-primary" disabled={busy} onClick={() => void prepare()}>{busy ? "Verifying…" : "Download and verify"}</button>
        ) : (
          <div className="base-update-authorise">
            <label>Developer password<input type="password" autoFocus value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && password) void install(); }} /></label>
            <button className="base-update-primary" disabled={busy || !password} onClick={() => void install()}>{busy ? "Starting installer…" : "Authorise and install"}</button>
          </div>
        )}
        {error && <div className="base-update-error">{error}</div>}
        <div className="base-update-secondary">
          <button disabled={busy} onClick={() => void later()}>Install later</button>
          {!required && <button disabled={busy} onClick={() => void decline()}>Decline this version</button>}
        </div>
        <small className="base-update-privacy">The check sends only the installed version. Personal settings, keys and device data stay on this computer.</small>
      </section>
    </div>
  );
}
