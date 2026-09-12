import { FormEvent, useState } from "react";
import "./SetupGate.css";
import "./SetupGateSecurity.css";
import { API_URL } from "../services/api";

type SetupGateProps = {
  onComplete: () => void;
};

const optionalFields = [
  ["OPENAI_API_KEY", "OpenAI API key"],
  ["GOOGLE_MAPS_API_KEY", "Google Maps API key"],
  ["WEATHER_API_KEY", "Weather API key"],
  ["GOVEE_API_KEY", "Govee API key"],
  ["HUE_BRIDGE_URL", "Philips Hue bridge URL"],
  ["HUE_APPLICATION_KEY", "Philips Hue application key"],
  ["RING_REFRESH_TOKEN", "Ring refresh token"],
] as const;

export default function SetupGate({ onComplete }: SetupGateProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"profile" | "security" | "services">("profile");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(key: string, value: string) {
    setValues(current => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!values.SENTINEL_USER_NAME?.trim()) {
      setError("Please tell Sentinel your name first.");
      setStep("profile");
      return;
    }
    if ((values.developerPassword ?? "").length < 10) {
      setError("Create a Developer Mode password containing at least 10 characters.");
      setStep("security");
      return;
    }
    if (values.developerPassword !== values.developerPasswordConfirmation) {
      setError("Developer passwords do not match.");
      setStep("security");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/setup/configuration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, edition: "base" }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Sentinel could not save the configuration.");
      onComplete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sentinel could not save the configuration.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="setup-gate">
      <section className="setup-gate__panel">
        <p className="setup-gate__eyebrow">SENTINEL BASE // FIRST RUN</p>
        <h1>Initialize your command centre.</h1>
        <p className="setup-gate__intro">Your keys stay on this device. Nothing is pre-configured and you can add services later in Settings.</p>

        <div className="setup-gate__steps" aria-label="Setup progress">
          <span className={step === "profile" ? "is-active" : ""}>1. Owner</span>
          <span className={step === "security" ? "is-active" : ""}>2. Security</span>
          <span className={step === "services" ? "is-active" : ""}>3. Services</span>
        </div>

        <form onSubmit={save}>
          {step === "profile" ? (
            <div className="setup-gate__section">
              <label htmlFor="owner-name">What should Sentinel call you?</label>
              <input id="owner-name" autoFocus value={values.SENTINEL_USER_NAME ?? ""} onChange={event => update("SENTINEL_USER_NAME", event.target.value)} placeholder="Your name" />
              <p>This is used only for Sentinel’s local conversation context.</p>
              <button type="button" className="setup-gate__primary" onClick={() => setStep("services")}>Continue</button>
            </div>
          ) : step === "security" ? (
            <div className="setup-gate__section">
              <label htmlFor="developer-password">Create your Developer Mode password</label>
              <input id="developer-password" autoFocus type="password" autoComplete="new-password" value={values.developerPassword ?? ""} onChange={event => update("developerPassword", event.target.value)} placeholder="At least 10 characters" />
              <label htmlFor="developer-password-confirmation">Confirm the password</label>
              <input id="developer-password-confirmation" type="password" autoComplete="new-password" value={values.developerPasswordConfirmation ?? ""} onChange={event => update("developerPasswordConfirmation", event.target.value)} placeholder="Enter it again" />
              <p>This protects source access and administrator-only controls. Sentinel stores a secure one-way hash, not your password.</p>
              <div className="setup-gate__actions"><button type="button" className="setup-gate__secondary" onClick={() => setStep("profile")}>Back</button><button type="button" className="setup-gate__primary" onClick={() => { setError(""); if ((values.developerPassword ?? "").length < 10) return setError("Use at least 10 characters."); if (values.developerPassword !== values.developerPasswordConfirmation) return setError("Developer passwords do not match."); setStep("services"); }}>Continue</button></div>
            </div>
          ) : (
            <div className="setup-gate__section">
              <p className="setup-gate__hint">Add the services you use. OpenAI enables chat; the remaining connections are optional and can be entered later.</p>
              <div className="setup-gate__fields">
                {optionalFields.map(([key, label]) => (
                  <label key={key}>
                    <span>{label}{key === "OPENAI_API_KEY" ? " (recommended)" : ""}</span>
                    <input type="password" autoComplete="off" value={values[key] ?? ""} onChange={event => update(key, event.target.value)} placeholder="Add later if needed" />
                  </label>
                ))}
              </div>
              <div className="setup-gate__actions">
                <button type="button" className="setup-gate__secondary" onClick={() => setStep("security")}>Back</button>
                <button className="setup-gate__primary" disabled={saving}>{saving ? "Securing configuration…" : "Complete setup"}</button>
              </div>
            </div>
          )}
          {error && <p className="setup-gate__error" role="alert">{error}</p>}
        </form>
      </section>
    </main>
  );
}
