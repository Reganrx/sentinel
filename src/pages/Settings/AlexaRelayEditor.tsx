import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  Cloud,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  PlugZap,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  configureRelay,
  createAlexaLinkCode,
  createRelayInstallation,
  createRelayInvite,
  getRelayStatus,
  listRelayInstallations,
  deleteRelayInstallation,
  type RelayInstallation,
  type RelayStatus,
} from "../../services/automation";
import "./AlexaRelayEditor.css";

export default function AlexaRelayEditor({
  onNotice,
  isDeveloperUnlocked,
}: {
  onNotice: (type: "success" | "error", text: string) => void;
  isDeveloperUnlocked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<boolean | string>(false);
  const [secret, setSecret] = useState("");
  const [pendingInviteSecret, setPendingInviteSecret] = useState("");
  const [installationConfirmed, setInstallationConfirmed] = useState(false);
  const [name, setName] = useState("Regan's Sentinel");
  const [alexaLinkCode, setAlexaLinkCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [url, setUrl] = useState(
    "https://sentinel-relay.reganbelson.workers.dev",
  );
  const [status, setStatus] = useState<RelayStatus | null>(null);
  const [installations, setInstallations] = useState<RelayInstallation[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  useEffect(() => {
    void getRelayStatus()
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  async function createInstallation() {
    if (!name.trim()) {
      onNotice("error", "Enter an installation name first.");
      return;
    }
    if (!/^https:\/\//i.test(url.trim())) {
      onNotice("error", "Enter a valid HTTPS Cloudflare relay address first.");
      return;
    }
    if (secret.trim().length < 20) {
      onNotice(
        "error",
        "Enter your Cloudflare owner secret above before creating an isolated installation.",
      );
      return;
    }
    setBusy(true);
    try {
      const installation = await createRelayInstallation(url, secret, name);
      setInstallations((current) => [
        {
          id: installation.installationId,
          name: name.trim(),
          createdAt: new Date().toISOString(),
        },
        ...current.filter((item) => item.id !== installation.installationId),
      ]);
      setProfilesLoaded(true);
      setPendingInviteSecret(secret);
      setSecret("");
      setStatus(await getRelayStatus());
      setInstallationConfirmed(true);
      onNotice(
        "success",
        "Private relay installation created and connected.",
      );
    } catch (error) {
      onNotice(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to create relay installation.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function loadProfiles() {
    const ownerSecret = secret || pendingInviteSecret;
    if (!isDeveloperUnlocked) {
      onNotice("error", "Unlock Developer Mode to manage installation profiles.");
      return;
    }
    if (ownerSecret.trim().length < 20) {
      onNotice("error", "Enter the Cloudflare owner secret to view profiles.");
      return;
    }
    setBusy(true);
    try {
      const result = await listRelayInstallations(url, ownerSecret);
      setInstallations(result.installations);
      setProfilesLoaded(true);
      onNotice("success", `${result.installations.length} installation profile${result.installations.length === 1 ? "" : "s"} loaded.`);
    } catch (error) {
      onNotice("error", error instanceof Error ? error.message : "Unable to load installation profiles.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProfile(profile: RelayInstallation) {
    const ownerSecret = secret || pendingInviteSecret;
    if (!isDeveloperUnlocked) {
      onNotice("error", "Unlock Developer Mode before deleting a profile.");
      return;
    }
    if (ownerSecret.trim().length < 20) {
      onNotice("error", "Enter the Cloudflare owner secret before deleting a profile.");
      return;
    }
    if (!window.confirm(`Revoke and permanently delete ${profile.name}? This installation will immediately lose relay access.`))
      return;
    setBusy(profile.id);
    try {
      await deleteRelayInstallation(url, ownerSecret, profile.id);
      setInstallations((current) => current.filter((item) => item.id !== profile.id));
      onNotice("success", `${profile.name} was revoked and deleted.`);
    } catch (error) {
      onNotice("error", error instanceof Error ? error.message : "Unable to delete installation profile.");
    } finally {
      setBusy(false);
    }
  }

  async function saveExisting() {
    setBusy(true);
    try {
      setStatus(await configureRelay(url, secret));
      setSecret("");
      onNotice("success", "Relay credential saved and verified.");
    } catch (error) {
      onNotice(
        "error",
        error instanceof Error ? error.message : "Unable to update relay.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function createInvite() {
    if (!/^https:\/\//i.test(url.trim())) {
      onNotice("error", "Enter a valid HTTPS Cloudflare relay address first.");
      return;
    }
    const inviteSecret = secret || pendingInviteSecret;
    if (inviteSecret.trim().length < 20) {
      onNotice(
        "error",
        "Enter your Cloudflare owner secret above before creating a Base setup code.",
      );
      return;
    }
    setBusy(true);
    try {
      const result = await createRelayInvite(
        url,
        inviteSecret,
        name || "Sentinel Base",
      );
      setInviteCode(result.inviteCode);
      setPendingInviteSecret(inviteSecret);
      setSecret("");
      setInstallationConfirmed(false);
      onNotice("success", "One-time Base setup code created.");
    } catch (error) {
      onNotice(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to create Base setup code.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function generateAlexaLinkCode() {
    setBusy(true);
    try {
      const result = await createAlexaLinkCode();
      setAlexaLinkCode(result.linkCode);
      onNotice("success", "Alexa account linking code created.");
    } catch (error) {
      onNotice(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to create pairing phrase.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`alexa-relay-editor setup-cloudflare-service ${open ? "is-open" : ""}`}>
      <Cloud />
      <div className="setup-cloudflare-copy">
        <strong>Cloudflare Relay</strong>
        <span>Private Base installations and Alexa voice relay.</span>
        <small className={status?.connected ? "connected" : ""}>{status?.connected ? <><Check />Connected</> : "Setup required"}</small>
      </div>
      <button
        className="alexa-relay-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        <KeyRound />
        {open ? "Close relay setup" : "Manage relay"}
        <ChevronDown className="relay-chevron" />
      </button>
      {open && (
        <div className="alexa-relay-form">
          <p>
            Create an isolated installation on your existing Cloudflare Worker.
            After confirmation, Sentinel guides you to create the Base user's
            one-time setup code. Base users do not need Cloudflare accounts.
          </p>
          <label>
            Installation name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Relay address
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </label>
          <label className="relay-secret">
            Cloudflare owner secret
            <div>
              <input
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder="Used once to create the installation"
              />
              <button
                aria-label={show ? "Hide secret" : "Show secret"}
                onClick={() => setShow((value) => !value)}
              >
                {show ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          <button
            className="settings-button"
            disabled={Boolean(busy)}
            onClick={() => void createInstallation()}
          >
            <Cloud />
            {busy ? "Creating…" : "Create isolated installation"}
          </button>
          <button
            className="settings-button settings-button--secondary"
            disabled={
              Boolean(busy) ||
              (!pendingInviteSecret && secret.trim().length < 20)
            }
            onClick={() => void createInvite()}
            title={
              !pendingInviteSecret && secret.trim().length < 20
                ? "Re-enter the Cloudflare owner secret to generate another code."
                : undefined
            }
          >
            <KeyRound />
            Create another Base setup code
          </button>
          {installationConfirmed && (
            <div className="relay-confirmation-backdrop" role="presentation">
              <div
                className="relay-confirmation-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="relay-confirmation-title"
              >
                <div className="relay-confirmation-icon">
                  <Check />
                </div>
                <small>INSTALLATION CONFIRMED</small>
                <h3 id="relay-confirmation-title">
                  Isolated installation created
                </h3>
                <p>
                  The private Cloudflare installation is connected. Now create
                  the one-time setup code to connect the Base user's Sentinel.
                </p>
                <button
                  className="settings-button"
                  disabled={Boolean(busy)}
                  onClick={() => void createInvite()}
                >
                  <KeyRound />
                  {busy ? "Creating…" : "Create Base setup code"}
                </button>
              </div>
            </div>
          )}
          {status?.connected && (
            <button
              className="settings-button settings-button--secondary"
              disabled={Boolean(busy)}
              onClick={() => void generateAlexaLinkCode()}
            >
              <PlugZap />
              Link Alexa account
            </button>
          )}
          {alexaLinkCode && (
            <div className="relay-pairing">
              <small>ALEXA ACCOUNT LINKING CODE</small>
              <strong>{alexaLinkCode}</strong>
              <span>
                Expires in 15 minutes. Enable or relink Sentinel AI in the Alexa
                app, then enter this code on the secure Sentinel page.
              </span>
            </div>
          )}
          {inviteCode && (
            <div className="relay-pairing relay-invite">
              <small>ONE-TIME BASE SETUP CODE</small>
              <strong>{inviteCode}</strong>
              <span>
                Valid for seven days and one use. Give this code to the Base
                user—never give them your Cloudflare secret.
              </span>
            </div>
          )}
          <section className="relay-profile-manager">
            <header>
              <div>
                <strong>Managed Base installations</strong>
                <small>
                  View or revoke isolated profiles. Installation secrets are
                  never displayed.
                </small>
              </div>
              <button
                className="settings-button settings-button--secondary"
                disabled={
                  Boolean(busy) ||
                  !isDeveloperUnlocked
                }
                onClick={() => void loadProfiles()}
                title={!isDeveloperUnlocked ? "Unlock Developer Mode to manage profiles." : undefined}
              >
                {isDeveloperUnlocked ? <RefreshCw /> : <LockKeyhole />}
                {profilesLoaded ? "Refresh profiles" : "View profiles"}
              </button>
            </header>
            {!isDeveloperUnlocked && (
              <p className="relay-profile-locked">
                <LockKeyhole /> Unlock Developer Mode to view, revoke or delete
                installation profiles.
              </p>
            )}
            {isDeveloperUnlocked && !pendingInviteSecret && secret.trim().length < 20 && (
              <p className="relay-profile-secret-needed">
                <KeyRound /> Enter your Cloudflare owner secret in the field above, then select View profiles. It is held only for this Sentinel session.
              </p>
            )}
            {isDeveloperUnlocked && profilesLoaded && (
              <div className="relay-profile-list">
                {installations.length ? (
                  installations.map((profile) => (
                    <article key={profile.id}>
                      <div>
                        <strong>{profile.name}</strong>
                        <small>
                          Created {profile.createdAt ? new Date(profile.createdAt).toLocaleString() : "date unavailable"}
                        </small>
                        <code>{profile.id}</code>
                      </div>
                      <button
                        className="relay-profile-delete"
                        disabled={Boolean(busy)}
                        onClick={() => void deleteProfile(profile)}
                      >
                        <Trash2 />
                        {busy === profile.id ? "Deleting…" : "Revoke and delete"}
                      </button>
                    </article>
                  ))
                ) : (
                  <p>No isolated installation profiles were found.</p>
                )}
              </div>
            )}
          </section>
          <details className="relay-legacy">
            <summary>Advanced: connect an existing credential</summary>
            <p>Enter its secret above, then save and test it.</p>
            <button
              className="settings-button settings-button--secondary"
              disabled={Boolean(busy) || secret.trim().length < 20}
              onClick={() => void saveExisting()}
            >
              <PlugZap />
              Save existing secret
            </button>
          </details>
        </div>
      )}
    </div>
  );
}
