import { useState } from "react";
import { Camera, CheckCircle2, Cpu, KeyRound, PackagePlus, ShieldCheck, Sparkles } from "lucide-react";
import { createCustomModule } from "../../services/setup";
import "./GuidedIntegrationBuilder.css";

type ServiceType = "home" | "security" | "custom";
const serviceTypes = [
  { id: "home" as const, name: "Smart home", detail: "Lights, plugs, appliances, heating and connected technology", destination: "Home Automation", icon: Sparkles },
  { id: "security" as const, name: "Security", detail: "Cameras, alarms, doorbells, locks and monitoring services", destination: "Mission Control → Security", icon: Camera },
  { id: "custom" as const, name: "Other service", detail: "A service unrelated to smart-home or security equipment", destination: "Installed Modules", icon: Cpu },
];

export default function GuidedIntegrationBuilder({ onNotice, onSaved }: {
  onNotice: (type: "success" | "error", text: string) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("home");
  const [credential, setCredential] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = serviceTypes.find((item) => item.id === serviceType)!;
  const SelectedIcon = selected.icon;

  async function addService() {
    if (!name.trim() || !credential.trim()) return;
    setBusy(true);
    try {
      await createCustomModule({ name: name.trim(), description: `${selected.name} service added through the guided Integration Builder.`, category: serviceType, auth: "token", apiKey: credential.trim() });
      const serviceName = name.trim();
      setName("");
      setCredential("");
      onSaved();
      onNotice("success", `${serviceName} was added to ${selected.destination}. Sentinel will clearly show if provider-specific connection mapping is still required.`);
    } catch (error) {
      onNotice("error", error instanceof Error ? error.message : "Unable to add this service.");
    } finally { setBusy(false); }
  }

  return <div className="guided-builder">
    <header><p className="guided-eyebrow">ADD A NEW SERVICE</p><h3>Tell Sentinel what the service is and where it belongs.</h3><p>Core services stay in Core Setup. Amazon Alexa and Ring stay in Modules. Use this only for an additional provider Sentinel does not already include.</p></header>
    <section className="guided-credential-card guided-new-service">
      <label className="guided-name-field"><span>Service name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Provider or platform name" autoComplete="off" /></label>
      <div className="guided-type-heading"><strong>What does this service control?</strong><small>Sentinel uses this to place its module on the correct page.</small></div>
      <div className="guided-provider-grid guided-type-grid">{serviceTypes.map((item) => { const Icon = item.icon; return <button type="button" key={item.id} className={serviceType === item.id ? "selected" : ""} onClick={() => setServiceType(item.id)}><Icon /><span><strong>{item.name}</strong><small>{item.detail}</small></span>{serviceType === item.id && <CheckCircle2 className="configured" />}</button>; })}</div>
      <label className="guided-token-field"><span><KeyRound /> API key or access token</span><input type="password" value={credential} onChange={(event) => setCredential(event.target.value)} placeholder="Paste the credential supplied by the provider" autoComplete="off" /></label>
      <div className="guided-route-preview"><SelectedIcon /><span><strong>Module destination: {selected.destination}</strong><small>The module is created immediately. Sentinel marks it clearly if API-specific mapping is still needed before controls can work.</small></span></div>
      <div className="guided-security"><ShieldCheck /><span>The credential is encrypted locally and is never added to chat history.</span></div>
      <button className="guided-create-button" type="button" onClick={() => void addService()} disabled={busy || !name.trim() || !credential.trim()}><PackagePlus /> {busy ? "Adding service…" : "Add service"}</button>
    </section>
    <section className="guided-special-connections"><div><strong>Amazon Alexa and Ring stay in Modules</strong><p>They use dedicated account-verification flows rather than this generic key form.</p></div></section>
  </div>;
}
