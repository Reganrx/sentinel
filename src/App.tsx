import Layout from "./app/Layout";
import { useEffect, useState } from "react";
import StartupSequence from "./components/StartupSequence";
import AppBackground from "./components/AppBackground";
import "./styles/SentinelDesign.css";
import CommandPalette from "./components/CommandPalette";
import SetupGate from "./components/SetupGate";
import { API_URL } from "./services/api";
import BaseUpdatePrompt from "./components/BaseUpdatePrompt";

export default function App() {

  const [booting, setBooting] = useState(() => localStorage.getItem("sentinel-startup-sequence") !== "false" && sessionStorage.getItem("sentinel-boot-complete") !== "true");
  const isBaseEdition = import.meta.env.VITE_SENTINEL_EDITION === "base";
  const [baseSetupState, setBaseSetupState] = useState<"checking" | "required" | "ready">(() => isBaseEdition ? "checking" : "ready");

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.sentinelTheme = localStorage.getItem("sentinel-accent-theme") || "blue";
    root.dataset.sentinelMotion = localStorage.getItem("sentinel-motion-level") || "full";
    root.style.setProperty("--sentinel-accent-intensity", String(Number(localStorage.getItem("sentinel-accent-intensity") ?? 85) / 100));
  }, []);

  useEffect(() => {
    if (!isBaseEdition) return;
    fetch(`${API_URL}/setup/status`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Setup service unavailable")))
      .then((status: { configured?: boolean; edition?: string }) => setBaseSetupState(status.edition === "base" && Boolean(status.configured) ? "ready" : "required"))
      .catch(() => setBaseSetupState("required"));
  }, [isBaseEdition]);

  if (baseSetupState === "checking") {
    return <div className="sentinel-app-shell"><AppBackground /></div>;
  }

  if (baseSetupState === "required") {
    return <SetupGate onComplete={() => {
      sessionStorage.removeItem("sentinel-boot-complete");
      window.location.reload();
    }} />;
  }

  function completeStartup() {
    sessionStorage.setItem("sentinel-boot-complete", "true");
    setBooting(false);
  }

  return (

    <div className="sentinel-app-shell">
      <AppBackground />
      <Layout />
      <CommandPalette />
      {booting && <StartupSequence onComplete={completeStartup} />}
      <BaseUpdatePrompt active={!booting && baseSetupState === "ready"} />
    </div>

  );

}
