import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  CloudSun,
  ExternalLink,
  KeyRound,
  Map,
  PackagePlus,
  Plane,
  PlugZap,
  Power,
  RotateCcw,
  Shield,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  createCustomModule,
  getSetupCentre,
  removeSetupModule,
  saveCoreSetup,
  setSetupModuleState,
  testSetupModule,
  type SetupCentreState,
  type SetupModule,
} from "../../services/setup";
import CustomIntegrationConsole from "./CustomIntegrationConsole";
import AlexaRelayEditor from "./AlexaRelayEditor";
import BaseAlexaSetup from "./BaseAlexaSetup";
import GuidedIntegrationBuilder from "./GuidedIntegrationBuilder";
import "./SetupCentre.css";
import "./IntegrationBuilderAdvanced.css";

const coreFields = [
  {
    key: "OPENAI_API_KEY",
    state: "openAI" as const,
    name: "OpenAI",
    detail: "Chat, reasoning and voice transcription",
    icon: Bot,
    help: "https://platform.openai.com/api-keys",
  },
  {
    key: "GOOGLE_MAPS_API_KEY",
    state: "maps" as const,
    name: "Google Maps",
    detail: "Navigation, places, routes and map display",
    icon: Map,
    help: "https://console.cloud.google.com/google/maps-apis/credentials",
  },
  {
    key: "WEATHER_API_KEY",
    state: "weather" as const,
    name: "WeatherAPI",
    detail: "Current conditions and local weather",
    icon: CloudSun,
    help: "https://www.weatherapi.com/my/",
  },
  {
    key: "FLYSTACK_API_KEY",
    state: "aviation" as const,
    name: "FlyStack Aviation",
    detail: "Live flight status, terminals, gates and delays",
    icon: Plane,
    help: "https://www.flystack.dev/",
  },
];
const builderDefaults = {
  apiKeyHeader: "Authorization",
  apiKeyPrefix: "Bearer ",
  healthPath: "/",
  devicesArrayPath: "data",
  deviceIdPath: "id",
  deviceNamePath: "name",
  commandMethod: "POST",
};

export default function SetupCentre({
  onNotice,
  isDeveloperUnlocked,
}: {
  onNotice: (type: "success" | "error", text: string) => void;
  isDeveloperUnlocked: boolean;
}) {
  const [state, setState] = useState<SetupCentreState | null>(null),
    [open, setOpen] = useState(false),
    [section, setSection] = useState<"core" | "modules" | "builder">("core");
  const [values, setValues] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(""),
    [custom, setCustom] = useState<Record<string, string>>(builderDefaults);
  const load = useCallback(() =>
    getSetupCentre()
      .then(setState)
      .catch((error) =>
        onNotice(
          "error",
          error instanceof Error
            ? error.message
            : "Setup Centre is unavailable.",
        ),
      ), [onNotice]);
  useEffect(() => {
    void load();
  }, [load]);
  async function saveCore() {
    setBusy("core");
    try {
      await saveCoreSetup({
        SENTINEL_USER_NAME:
          values.SENTINEL_USER_NAME || state?.core.owner || "Sentinel user",
        ...values,
      });
      onNotice(
        "success",
        "Configuration saved securely. Restart Sentinel to activate changed core keys.",
      );
      await load();
    } catch (error) {
      onNotice(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to save configuration.",
      );
    } finally {
      setBusy("");
    }
  }
  async function updateModule(
    module: SetupModule,
    installed: boolean,
    enabled: boolean,
  ) {
    setBusy(module.id);
    try {
      await setSetupModuleState(module.id, installed, enabled);
      await load();
      onNotice("success", `${module.name} updated.`);
    } catch (error) {
      onNotice(
        "error",
        error instanceof Error ? error.message : "Unable to update module.",
      );
    } finally {
      setBusy("");
    }
  }
  async function remove(module: SetupModule) {
    if (!window.confirm(`Remove ${module.name} from Sentinel?`)) return;
    setBusy(module.id);
    try {
      await removeSetupModule(module.id);
      await load();
      onNotice("success", `${module.name} removed.`);
    } catch (error) {
      onNotice(
        "error",
        error instanceof Error ? error.message : "Unable to remove module.",
      );
    } finally {
      setBusy("");
    }
  }
  async function addCustom() {
    setBusy("custom");
    try {
      const commands =
        custom.commandName && custom.commandPath
          ? [
              {
                id: custom.commandName,
                name: custom.commandName,
                method: custom.commandMethod,
                path: custom.commandPath,
                bodyTemplate: custom.bodyTemplate,
                valueHint: custom.valueHint,
              },
            ]
          : [];
      await createCustomModule({ ...custom, commands });
      setCustom(builderDefaults);
      await load();
      setSection("modules");
      onNotice(
        "success",
        "Integration created. Discover a device in Modules to test it.",
      );
    } catch (error) {
      onNotice(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to create integration.",
      );
    } finally {
      setBusy("");
    }
  }
  const field = (
    name: string,
    label: string,
    placeholder = "",
    wide = false,
    type = "text",
  ) => (
    <label className={wide ? "wide" : ""}>
      {label}
      <input
        type={type}
        placeholder={placeholder}
        value={custom[name] ?? ""}
        onChange={(event) =>
          setCustom((current) => ({ ...current, [name]: event.target.value }))
        }
      />
    </label>
  );
  if (!state) return null;
  const configuredCoreCount =
    coreFields.filter((item) => state.core[item.state]).length +
    (state.core.openSky ? 1 : 0) +
    (state.core.relay ? 1 : 0);
  return (
    <section className="settings-card settings-card--wide setup-centre">
      <button
        className="setup-centre-heading"
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <Wrench />
          <span>
            <strong>Setup Centre</strong>
            <small>
              Configure core services and choose exactly which integrations
              Sentinel includes.
            </small>
          </span>
        </span>
        <span className="setup-progress">
          {configuredCoreCount}/6 core services{" "}
          <ChevronDown className={open ? "is-open" : ""} />
        </span>
      </button>
      {open && (
        <div className="setup-centre-body">
          <nav>
            <button
              className={section === "core" ? "active" : ""}
              onClick={() => setSection("core")}
            >
              <KeyRound />
              Core setup
            </button>
            <button
              className={section === "modules" ? "active" : ""}
              onClick={() => setSection("modules")}
            >
              <PlugZap />
              Modules
            </button>
            <button
              className={section === "builder" ? "active" : ""}
              onClick={() => setSection("builder")}
            >
              <PackagePlus />
              Integration builder
            </button>
          </nav>
          {section === "core" && (
            <div className="setup-core">
              <header>
                <h3>Essential services</h3>
                <p>
                  Get each key from the provider, paste it here, and Sentinel
                  stores it only on this computer.
                </p>
              </header>
              <label className="setup-owner">
                <span>Owner name</span>
                <input
                  value={values.SENTINEL_USER_NAME ?? state.core.owner}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      SENTINEL_USER_NAME: event.target.value,
                    }))
                  }
                />
              </label>
              {coreFields.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.key}>
                    <Icon />
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.detail}</span>
                      <a href={item.help} target="_blank" rel="noreferrer">
                        Get your key <ExternalLink />
                      </a>
                    </div>
                    <div className="setup-key">
                      <span
                        className={state.core[item.state] ? "ready" : "missing"}
                      >
                        {state.core[item.state] ? (
                          <>
                            <Check />
                            Configured
                          </>
                        ) : (
                          "Not configured"
                        )}
                      </span>
                      <input
                        type="password"
                        placeholder={
                          state.core[item.state]
                            ? "Enter a replacement key"
                            : "Paste API key"
                        }
                        value={values[item.key] ?? ""}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [item.key]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </article>
                );
              })}
              <article>
                <Plane />
                <div>
                  <strong>OpenSky Network</strong>
                  <span>Authenticated live aircraft positions and flight radar</span>
                  <a href="https://opensky-network.org/my-opensky/account" target="_blank" rel="noreferrer">
                    Create API client <ExternalLink />
                  </a>
                </div>
                <div className="setup-key setup-key--pair">
                  <span className={state.core.openSky ? "ready" : "missing"}>
                    {state.core.openSky ? <><Check /> Configured</> : "Not configured"}
                  </span>
                  <input type="text" autoComplete="off"
                    placeholder={state.core.openSky ? "Replacement client ID" : "OpenSky client ID"}
                    value={values.OPENSKY_CLIENT_ID ?? ""}
                    onChange={(event) => setValues((current) => ({ ...current, OPENSKY_CLIENT_ID: event.target.value }))}
                  />
                  <input type="password" autoComplete="new-password"
                    placeholder={state.core.openSky ? "Replacement client secret" : "OpenSky client secret"}
                    value={values.OPENSKY_CLIENT_SECRET ?? ""}
                    onChange={(event) => setValues((current) => ({ ...current, OPENSKY_CLIENT_SECRET: event.target.value }))}
                  />
                  <small>Use the client ID and client secret from My OpenSky → Account → API Clients.</small>
                </div>
              </article>
              {state.edition === "personal" && (
                <AlexaRelayEditor
                  onNotice={onNotice}
                  isDeveloperUnlocked={isDeveloperUnlocked}
                />
              )}
              <button
                className="settings-button"
                disabled={busy === "core"}
                onClick={() => void saveCore()}
              >
                {busy === "core" ? "Securing…" : "Save core setup"}
              </button>
            </div>
          )}
          {section === "modules" && (
            <div className="setup-modules">
              <header>
                <h3>Installed modules</h3>
                <p>
                  Choose which integrations Sentinel uses, test connections, and
                  safely run configured controls.
                </p>
              </header>
              {state.modules.map((module) => (
                <article key={module.id}>
                  <div className="module-mark">
                    <Shield />
                  </div>
                  <div>
                    <strong>{module.name}</strong>
                    <span>{module.description}</span>
                    <small>
                      {module.configured
                        ? "Connected"
                        : module.auth === "local"
                          ? "Ready to pair"
                          : "Needs configuration"}{" "}
                      · {module.category}
                    </small>
                  </div>
                  <div className="module-actions">
                    {!module.installed ? (
                      <button
                        onClick={() => void updateModule(module, true, true)}
                      >
                        <RotateCcw />
                        Install
                      </button>
                    ) : (
                      <>
                        <button
                          className={module.enabled ? "enabled" : ""}
                          onClick={() =>
                            void updateModule(module, true, !module.enabled)
                          }
                        >
                          <Power />
                          {module.enabled ? "Enabled" : "Disabled"}
                        </button>
                        {!module.builtIn && (
                          <button
                            onClick={() =>
                              void testSetupModule(module.id)
                                .then(() =>
                                  onNotice(
                                    "success",
                                    `${module.name} connection succeeded.`,
                                  ),
                                )
                                .catch((error) =>
                                  onNotice("error", error.message),
                                )
                            }
                          >
                            <PlugZap />
                            Test
                          </button>
                        )}
                        <button
                          className="remove"
                          onClick={() => void remove(module)}
                        >
                          <Trash2 />
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                  {!module.builtIn && module.installed && (
                    <CustomIntegrationConsole
                      module={module}
                      onNotice={onNotice}
                    />
                  )}
                  {module.id === "alexa" && module.installed && state.edition === "base" && (
                    <BaseAlexaSetup onNotice={onNotice} />
                  )}
                </article>
              ))}
            </div>
          )}
          {section === "builder" && state.edition === "personal" && (
            <GuidedIntegrationBuilder
              onNotice={onNotice}
              onSaved={() => void load()}
            />
          )}
          {section === "builder" && state.edition !== "personal" && (
            <div className="setup-builder">
              <header>
                <h3>Build a working API integration</h3>
                <p>
                  Connect a provider, map its device list, and define one safe
                  command. Use paths and field names from the provider’s API
                  guide.
                </p>
              </header>
              <div className="builder-grid">
                {field("name", "Name", "HomeCare")}
                {field(
                  "baseUrl",
                  "HTTPS API address",
                  "https://api.example.com",
                )}
                {field("apiKeyHeader", "API key header")}
                {field(
                  "apiKeyPrefix",
                  "Key prefix",
                  "Bearer (leave blank if unused)",
                )}
                {field("healthPath", "Connection-test path", "/status")}
                {field(
                  "description",
                  "Description",
                  "What this service controls",
                )}
                {field(
                  "apiKey",
                  "API key",
                  "Paste the key created by the provider",
                  true,
                  "password",
                )}
                <div className="builder-section">
                  <h4>Device discovery</h4>
                  <p>
                    Tell Sentinel where the provider lists devices and which
                    response fields contain their IDs and names.
                  </p>
                </div>
                {field("devicesPath", "Device-list path", "/devices")}
                {field(
                  "devicesArrayPath",
                  "Device array location",
                  "data.devices",
                )}
                {field("deviceIdPath", "Device ID field", "id")}
                {field("deviceNamePath", "Device name field", "name")}
                <div className="builder-section">
                  <h4>First command</h4>
                  <p>
                    {
                      "Placeholders supported: {{value}}, {{requestId}}, and device fields such as {{device.id}}."
                    }
                  </p>
                </div>
                {field("commandName", "Command name", "Set power")}
                <label>
                  Method
                  <select
                    value={custom.commandMethod}
                    onChange={(event) =>
                      setCustom((current) => ({
                        ...current,
                        commandMethod: event.target.value,
                      }))
                    }
                  >
                    {["GET", "POST", "PUT", "PATCH"].map((method) => (
                      <option key={method}>{method}</option>
                    ))}
                  </select>
                </label>
                {field(
                  "commandPath",
                  "Command path",
                  "/devices/{{device.id}}/control",
                )}
                {field(
                  "valueHint",
                  "Value instructions",
                  "For example: on or off",
                )}
                <label className="wide">
                  JSON request body
                  <textarea
                    placeholder={
                      '{\n  "device": "{{device.id}}",\n  "value": "{{value}}"\n}'
                    }
                    value={custom.bodyTemplate ?? ""}
                    onChange={(event) =>
                      setCustom((current) => ({
                        ...current,
                        bodyTemplate: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="builder-safety">
                <Shield />
                Sentinel permits HTTPS APIs only, encrypts the key locally, and
                asks before sending a device command.
              </div>
              <button
                className="settings-button"
                disabled={busy === "custom"}
                onClick={() => void addCustom()}
              >
                <PackagePlus />
                {busy === "custom" ? "Creating…" : "Create integration"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
