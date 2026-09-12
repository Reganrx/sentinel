import { useMemo, useState } from "react";
import {
  Check,
  Cloud,
  Copy,
  MonitorSmartphone,
  Pencil,
  Radio,
  RefreshCw,
  Search,
  Speaker,
  Trash2,
  Wifi,
} from "lucide-react";
import {
  forgetAmazonDevice,
  renameAmazonDevice,
  type AmazonDevice,
} from "../../services/automation";
import "./AmazonDevicePanel.css";

const isScreen = (device: AmazonDevice) =>
  /screen/i.test(device.model) ||
  Boolean(
    device.capabilities?.some((item) => /APL|Display|VideoApp/i.test(item)),
  );
const isSpeaker = (device: AmazonDevice) =>
  /speaker/i.test(device.model) || device.capabilities?.includes("AudioPlayer");
const date = (value?: string) =>
  value ? new Date(value).toLocaleString() : "Not recorded";

export default function AmazonDevicePanel({
  devices,
  loading,
  onRefresh,
  onError,
}: {
  devices: AmazonDevice[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const [copied, setCopied] = useState(false);
  const filtered = useMemo(() => {
    const result = devices.filter((device) =>
      `${device.name} ${device.model} ${device.connection}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    );
    return result.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : new Date(b.lastSeenAt ?? 0).getTime() -
          new Date(a.lastSeenAt ?? 0).getTime(),
    );
  }, [devices, query, sort]);

  async function save(device: AmazonDevice) {
    setSaving(true);
    try {
      await renameAmazonDevice(device.id, name);
      setEditing(null);
      setName("");
      await onRefresh();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Unable to rename Echo.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function forget(device: AmazonDevice) {
    if (
      !window.confirm(
        `Forget ${device.name}? It will return after Sentinel AI is opened on it again.`,
      )
    )
      return;
    try {
      await forgetAmazonDevice(device.id);
      await onRefresh();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Unable to forget Echo.",
      );
    }
  }

  async function copyPhrase() {
    await navigator.clipboard.writeText("Alexa, open Sentinel AI");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="automation-section amazon-devices">
      <div className="automation-section-title">
        <div>
          <h2>Amazon devices</h2>
          <p>
            Echo and Fire hardware that has opened Sentinel AI or was found
            locally. Amazon does not provide this custom skill with a complete
            household device list.
          </p>
        </div>
        <button
          className="automation-refresh"
          onClick={() => void onRefresh()}
          disabled={loading}
        >
          <RefreshCw className={loading ? "automation-spin" : ""} />
          {loading ? "Discovering…" : "Refresh"}
        </button>
      </div>

      <div className="amazon-summary">
        <div>
          <strong>{devices.length}</strong>
          <span>Registered devices</span>
        </div>
        <div>
          <strong>{devices.filter((item) => item.available).length}</strong>
          <span>Active in last 10 min</span>
        </div>
        <div>
          <strong>{devices.filter((item) => !item.name.startsWith("Echo device ")).length}</strong>
          <span>Named devices</span>
        </div>
        <div>
          <strong>{devices.filter((item) => item.name.startsWith("Echo device ")).length}</strong>
          <span>Needs naming</span>
        </div>
      </div>

      <div className="amazon-intelligence">
        <div>
          <strong>What Sentinel understands</strong>
          <span>
            It identifies each Echo when that device opens Sentinel AI, remembers
            your chosen name, records its last contact and tailors responses to
            its screen or audio capabilities. Open the skill once on every Echo
            you want listed here.
          </span>
        </div>
        <button onClick={() => void copyPhrase()}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy registration phrase"}
        </button>
      </div>

      {devices.length > 0 && (
        <div className="amazon-tools">
          <label>
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find an Amazon device"
            />
          </label>
          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as "recent" | "name")
            }
          >
            <option value="recent">Most recently used</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      )}

      {filtered.length ? (
        <div className="amazon-device-grid">
          {filtered.map((device) => {
            const cloud = device.connection === "Alexa skill";
            const status = cloud
              ? device.available
                ? "Recently used"
                : "Registered"
              : device.available
                ? "Visible locally"
                : "Not visible";
            return (
              <article key={device.id}>
                <div className="amazon-device-icon">
                  {isScreen(device) ? <MonitorSmartphone /> : <Speaker />}
                </div>
                <div className="amazon-device-copy">
                  <div className="amazon-device-heading">
                    <strong>{device.name}</strong>
                    <span className={device.available ? "online" : ""}>
                      <i />
                      {status}
                    </span>
                  </div>
                  <p>{device.model}</p>
                  <div className="amazon-capabilities">
                    {isSpeaker(device) && <em>Audio</em>}
                    {isScreen(device) && <em>Screen</em>}
                    <em>{device.connection}</em>
                  </div>
                  <small>
                    {cloud ? (
                      <Cloud />
                    ) : device.connection === "Network" ? (
                      <Wifi />
                    ) : (
                      <Radio />
                    )}
                    {cloud
                      ? `Last used ${date(device.lastSeenAt)}`
                      : (device.address ?? "Local discovery")}
                  </small>
                  {cloud && (
                    <small className="amazon-first-seen">
                      Registered {date(device.firstSeenAt)}
                    </small>
                  )}
                  {editing === device.id && (
                    <form
                      className="amazon-rename"
                      onClick={(event) => event.stopPropagation()}
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (name.trim()) void save(device);
                      }}
                    >
                      <input
                        autoFocus
                        aria-label={`New name for ${device.name}`}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="For example, Kitchen Echo"
                        onKeyDown={(event) => event.stopPropagation()}
                      />
                      <button
                        type="submit"
                        disabled={saving || !name.trim()}
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </form>
                  )}
                </div>
                {cloud && (
                  <div className="amazon-actions">
                    <button
                      onClick={() => {
                        setEditing(editing === device.id ? null : device.id);
                        setName(
                          device.name.startsWith("Echo device ")
                            ? ""
                            : device.name,
                        );
                      }}
                    >
                      <Pencil />
                      Name
                    </button>
                    <button
                      className="danger"
                      title="Forget device"
                      onClick={() => void forget(device)}
                    >
                      <Trash2 />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="automation-empty">
          <Speaker />
          <div>
            <strong>
              {devices.length
                ? "No matching Amazon devices"
                : "No Amazon devices observed yet"}
            </strong>
            <span>
              {devices.length
                ? "Try a different search."
                : "Say “Alexa, open Sentinel AI” once on each Echo. Local devices may also appear while you are on the home network."}
            </span>
          </div>
        </div>
      )}
      <p className="amazon-limit">
        <strong>Amazon limitation:</strong> account linking identifies the
        household account, but it does not reveal every Echo on that account.
        Registration confirms that a specific device used the skill; it does
        not grant Sentinel permission to change Echo volume, alarms, music,
        routines or settings.
      </p>
    </section>
  );
}
