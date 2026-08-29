import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Link2, RefreshCw } from "lucide-react";
import {
  createAlexaLinkCode,
  getRelayStatus,
  redeemRelayInvite,
  type RelayStatus,
} from "../../services/automation";
import "./BaseAlexaSetup.css";
import "./BaseAlexaSetupLayout.css";

export default function BaseAlexaSetup({
  onNotice,
}: {
  onNotice: (type: "success" | "error", text: string) => void;
}) {
  const [status, setStatus] = useState<RelayStatus | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => getRelayStatus().then(setStatus).catch(() => undefined);
  useEffect(() => { void refresh(); }, []);

  async function connect() {
    setBusy(true);
    try {
      await redeemRelayInvite(setupCode);
      setSetupCode("");
      await refresh();
      onNotice("success", "Amazon relay connected securely.");
    } catch (error) {
      onNotice("error", error instanceof Error ? error.message : "Unable to use that setup code.");
    } finally { setBusy(false); }
  }

  async function createLinkCode() {
    setBusy(true);
    try {
      const result = await createAlexaLinkCode();
      setLinkCode(result.linkCode);
      onNotice("success", "Alexa account linking code created.");
    } catch (error) {
      onNotice("error", error instanceof Error ? error.message : "Unable to create an Alexa linking code.");
    } finally { setBusy(false); }
  }

  return (
    <section className="base-alexa-setup">
      <header>
        <div><h4>Amazon Alexa setup</h4><p>Connect through Sentinel's managed relay. No Cloudflare account is required.</p></div>
        <button className="base-alexa-refresh" onClick={() => void refresh()} aria-label="Refresh Amazon connection"><RefreshCw /></button>
      </header>
      {!status?.configured ? (
        <div className="base-alexa-connect">
          <div className="base-alexa-step"><span>1</span><div><strong>Get a Base setup code</strong><p>The owner creates this one-time code in Sentinel Personal. It expires after seven days and works once.</p></div></div>
          <label><span>One-time Base setup code</span><div><input value={setupCode} onChange={(event) => setSetupCode(event.target.value.toUpperCase())} placeholder="Enter setup code" autoComplete="off" /><button onClick={() => void connect()} disabled={busy || setupCode.trim().length < 6}><KeyRound />{busy ? "Connecting…" : "Connect"}</button></div></label>
        </div>
      ) : (
        <div className="base-alexa-linked">
          <div className="base-alexa-state"><CheckCircle2 /><div><strong>Managed relay connected</strong><p>This Base installation has its own private credential stored only on this computer.</p></div></div>
          <div className="base-alexa-step"><span>2</span><div><strong>Link the user's Amazon account</strong><p>Create a code, enable or relink Sentinel AI in the Alexa app, then enter the code on Sentinel's secure linking page.</p></div></div>
          <button className="base-alexa-link" onClick={() => void createLinkCode()} disabled={busy}><Link2 />{busy ? "Creating…" : "Create Alexa linking code"}</button>
          {linkCode && <div className="base-alexa-code"><small>ALEXA ACCOUNT LINKING CODE</small><strong>{linkCode}</strong><span>Expires in 15 minutes.</span></div>}
        </div>
      )}
    </section>
  );
}
