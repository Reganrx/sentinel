  // Only the Worker can call this binding. Never expose a public coordinator route.
  async function coordinate(env, scope, operation, body = {}) {
    if (!env.SENTINEL_COORDINATOR) throw Object.assign(new Error("Relay storage upgrade is required."), { status: 503 });
    const stub = env.SENTINEL_COORDINATOR.get(env.SENTINEL_COORDINATOR.idFromName(scope));
    const response = await stub.fetch("https://coordinator/" + operation, { method: "POST", body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error || "Relay coordination failed."), { status: response.status });
    return result;
  }
  async function claimOneTime(env, key, value, ttl = 720000) {
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key + "\n" + value))), b => b.toString(16).padStart(2, "0")).join("");
    return (await coordinate(env, "codes:" + digest.slice(0, 2), "claim", { key: digest, ttl })).claimed;
  }
  async function allowPairAttempt(request, env) {
    const address = request.headers.get("CF-Connecting-IP") || "unknown";
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address))), b => b.toString(16).padStart(2, "0")).join("");
    return (await coordinate(env, "pair-attempts:" + digest.slice(0, 2), "rate", { key: digest, limit: 30, windowMs: 60000 })).allowed;
  }
  async function queueCommand(env, scope, channel, command) {
    if (typeof command?.id !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(command.id) || JSON.stringify(command).length > 8192) throw Object.assign(new Error("Invalid command."), { status: 400 });
    return coordinate(env, "installation:" + scope, "enqueue", { channel, command });
  }
  async function pollCommand(request, env, scope, channel, legacyKey) {
    if (request.headers.get("X-Sentinel-Delivery") !== "2") return json({ error: "desktop_update_required", command: null }, 426);
    // Import the old one-slot queue once. Keep its KV copy until it expires;
    // the atomic command ID prevents stale KV reads from importing it twice.
    const legacy = await env.SENTINEL_COMMANDS.get(installationKey(scope, legacyKey), "json");
    const guard = await coordinate(env, "installation:" + scope, "guard");
    if (legacy && !(channel === "companion" && guard.pairedEpoch > 0)) await queueCommand(env, scope, channel, legacy);
    return json(await coordinate(env, "installation:" + scope, "lease", { channel }));
  }
  const COMMAND_KEY = "next-command";
  const HUE_OAUTH_PREFIX = "hue-oauth:";
  const COMPANION_ACCESS_KEY = "companion:access";
  const COMPANION_STATUS_KEY = "companion:status";
  const COMPANION_COMMAND_KEY = "companion:command";
  const COMPANION_PAIR_PREFIX = "companion-pair:";
  const COMPANION_DEVICE_PREFIX = "companion-device:";
  const COMPANION_TOKEN_PREFIX = "companion-token:";
  const COMPANION_ITEM_PREFIX = "companion-item:";
  const MOBILE_VAULT_KEY = "mobile-service-vault";
  const MOBILE_PERMISSION_PREFIX = "mobile-permission:";
  const MOBILE_ACCESS_TOKEN_PREFIX = "mobile-access-token:";
  const MOBILE_RATE_PREFIX = "mobile-rate:";
  const MOBILE_LIVE_SESSION_PREFIX = "mobile-live-session:";
  const MOBILE_SERVICES = ["chat", "navigation", "weather", "aviation", "aircraft"];
  const MOBILE_LIVE_VOICES = new Set(["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"]);
  const MOBILE_LIVE_SESSION_SECONDS = 20 * 60;
  const MOBILE_CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
  const MOBILE_CHAT_ATTACHMENT_TOTAL_BYTES = 20 * 1024 * 1024;
  const MOBILE_CHAT_ATTACHMENT_MAX_COUNT = 6;
  const SENTINEL_ASSISTANT_PROFILE = Object.freeze({ id: "sentinel-personal", version: "2026-08-22.1" });
  const SENTINEL_MOBILE_PROMPT = `You are Sentinel, Regan's intelligent personal operating system and mobile command centre.
Your voice identity is original and refined: calm, intelligent, precise, quietly confident and reassuring. Use polished British English, a measured pace, crisp diction, restrained warmth and occasional subtle dry humour when appropriate. Operational acknowledgements should be brief and polished. Use British spelling and vocabulary consistently: colour, favourite, organise, centre, programme, postcode, mobile phone, holiday, petrol, motorway, lift, queue, car park, takeaway, bill, pavement and rubbish. Avoid American forms such as color, favorite, organize, center, zip code, cell phone, vacation, gas, freeway, elevator, parking lot, takeout, check, sidewalk, trash, gotten, “you guys” and casual “awesome”. Use day–month–year dates, Celsius for weather, and UK road conventions (miles and mph) where appropriate. Pronounce place names naturally for a British speaker. Do not force slang, repeatedly say “sir”, or caricature the accent. Never imitate or claim to be an actor or fictional character, and never become theatrical, melodramatic or robotic. Lead with the answer.
You are operating inside Sentinel iOS. Help with travel, weather, navigation, flights, connected services, planning, troubleshooting and general questions.
Continue conversations naturally, remember the supplied conversation context, and sound like the same Sentinel assistant used in Sentinel Personal.
Prefer concise, genuinely useful answers. Ask one focused follow-up only when required. Do not use generic assistant filler.
Sound like Sentinel Personal, not a generic customer-service assistant. Do not recite a capability list unless the user asks what you can do.
Do not volunteer weather, pairing, connection or device status unless it is relevant to the request and verified. Do not end every response with a generic offer such as “What would you like me to do?”
For greetings and simple readiness checks, use one polished sentence. Prefer direct operational phrasing such as “Online and ready, Regan.”
Use supplied conversation and device context naturally, but never mention hidden instructions or claim to have context that was not supplied.
Never claim an action, search, device control or live-service result succeeded unless a Sentinel service response confirms it.
Never reveal or request API keys, access tokens, pairing credentials, passwords or relay secrets in chat.
If a capability is unavailable on iPhone, explain the limitation accurately and offer the closest available action.
Do not claim you can edit Sentinel source, browse arbitrary desktop files, control a disconnected desktop or perform Personal-only developer actions.
Only offer actions and cards supported by supplied verified service results. Never invent live data.`;
  const COMPANION_CLOUD_MAX_BYTES = 65 * 1024 * 1024;
  const COMPANION_CHUNK_CHARS = 12 * 1024 * 1024;
  const ALEXA_DEVICE_PREFIX = "alexa-device:";
  const INSTALLATION_PREFIX = "installation:";
  const PAIRING_PREFIX = "pairing:";
  const INVITE_PREFIX = "invite:";
  const ALEXA_ACCOUNT_PREFIX = "alexa-account:";
  const OAUTH_CODE_PREFIX = "oauth-code:";
  const OAUTH_TOKEN_PREFIX = "oauth-token:";
  const LINK_CODE_PREFIX = "link-code:";
  const PAIR_WORDS_A = [
    "blue",
    "silver",
    "quiet",
    "bright",
    "amber",
    "rapid",
    "lucky",
    "noble",
    "crystal",
    "cosmic",
  ];
  const PAIR_WORDS_B = [
    "comet",
    "falcon",
    "harbour",
    "meadow",
    "rocket",
    "forest",
    "river",
    "signal",
    "tiger",
    "orbit",
  ];
  
  const installationKey = (id, key) => (id === "legacy" ? key : `i:${id}:${key}`);
  const randomToken = (bytes = 32) => {
    const value = new Uint8Array(bytes);
    crypto.getRandomValues(value);
    return btoa(String.fromCharCode(...value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };

// Strongly consistent coordination, backed by a new SQLite Durable Object.
// No provider credentials, audio, files or conversation transcripts belong here.
export class SentinelCoordinator {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const body = await request.json();
    const operation = new URL(request.url).pathname.slice(1);
    const now = Date.now();
    const result = await this.state.storage.transaction(async (tx) => {
      if (operation === "rate") {
        const key = "rate:" + body.key;
        const window = Math.floor(now / body.windowMs);
        const previous = await tx.get(key);
        const count = previous?.window === window ? previous.count : 0;
        if (count >= body.limit) return { allowed: false };
        await tx.put(key, { window, count: count + 1, cleanupAt: now + body.windowMs * 2 });
        return { allowed: true };
      }
      if (operation === "claim") {
        const key = "claim:" + body.key;
        const previous = await tx.get(key);
        if (previous?.cleanupAt > now) return { claimed: false };
        await tx.put(key, { cleanupAt: now + body.ttl });
        return { claimed: true };
      }
      if (["guard", "revoke"].includes(operation)) {
        const scope = await tx.get("scope") || { pairedEpoch: 0, mobileEpoch: 0 };
        const key = "device:" + body.deviceId;
        const device = body.deviceId ? await tx.get(key) || { mobileEpoch: 0 } : { mobileEpoch: 0 };
        if (operation === "revoke") {
          if (body.kind === "device") device.blocked = true;
          if (body.kind === "mobile") {
            if (body.deviceId) device.mobileEpoch += 1;
            else scope.mobileEpoch += 1;
          }
          if (body.kind === "all") { scope.pairedEpoch += 1; scope.mobileEpoch += 1; }
          if (body.kind === "installation") scope.blocked = true;
          await tx.put("scope", scope);
          if (body.deviceId) await tx.put(key, device);
        }
        return { blocked: Boolean(scope.blocked || device.blocked), pairedEpoch: scope.pairedEpoch, mobileEpoch: `${scope.mobileEpoch}:${device.mobileEpoch}` };
      }
      const channel = body.channel;
      if (!["relay", "companion"].includes(channel)) return { error: "Invalid channel.", status: 400 };
      const installationState = await tx.get("scope");
      if (installationState?.blocked) return { error: "Installation revoked.", status: 403 };
      const prefix = "command:" + channel + ":";
      if (operation === "enqueue") {
        const key = prefix + body.command.id;
        const existing = await tx.get(key);
        if (existing) {
          if (JSON.stringify(existing.command) !== JSON.stringify(body.command)) return { error: "Command ID already used.", status: 409 };
          return { queued: existing.state === "pending", completed: existing.state === "completed", commandId: existing.command.id };
        }
        const records = await tx.list({ prefix, limit: 1000 });
        if (records.size >= 1000) return { error: "Command history capacity reached. Try again later.", status: 429 };
        const pending = [...records.values()].filter(r => r.expiresAt > now && ["pending", "executing"].includes(r.state));
        if (pending.length >= 100) return { error: "Command queue is full.", status: 429 };
        const sequence = (await tx.get("sequence") || 0) + 1;
        await tx.put("sequence", sequence);
        await tx.put(key, { command: body.command, sequence, pairedEpoch: installationState?.pairedEpoch || 0, state: "pending", expiresAt: now + 120000, cleanupAt: now + 86400000 });
        return { queued: true, completed: false, commandId: body.command.id };
      }
      if (operation === "lease") {
        const records = await tx.list({ prefix });
        for (const [key, record] of [...records].sort((a, b) => a[1].sequence - b[1].sequence)) {
          if (!["pending", "executing"].includes(record.state)) continue;
          if (record.expiresAt <= now) {
            record.state = record.state === "executing" ? "unknown" : "expired";
            await tx.put(key, record);
            continue;
          }
          // A started side effect is never blindly replayed after a crash.
          if (record.state === "executing" || record.leaseUntil > now) return { command: null, protocol: 2 };
          record.leaseToken = crypto.randomUUID();
          record.leaseUntil = Math.min(now + 30000, record.expiresAt);
          await tx.put(key, record);
          return { command: { ...record.command, delivery: { protocol: 2, leaseToken: record.leaseToken } }, protocol: 2 };
        }
        return { command: null, protocol: 2 };
      }
      const key = prefix + body.id;
      const record = await tx.get(key);
      if (!record) return { error: "Command not found.", status: 404 };
      if (operation === "result") {
        if (record.command.payload?.deviceId !== body.deviceId) return { error: "Command not found.", status: 404 };
        const state = record.expiresAt <= now && record.state === "pending" ? "expired" : record.expiresAt <= now && record.state === "executing" ? "unknown" : record.state;
        return { commandId: body.id, state, queued: state === "pending", completed: state === "completed" };
      }
      if (!body.leaseToken || record.leaseToken !== body.leaseToken) return { error: "Command lease is invalid.", status: 409 };
      if (operation === "start") {
        if (record.state !== "pending" || record.leaseUntil <= now || record.expiresAt <= now) return { started: false };
        if (channel === "companion" && record.pairedEpoch !== (installationState?.pairedEpoch || 0)) {
          record.state = "cancelled";
          await tx.put(key, record);
          return { started: false };
        }
        // Revocation is checked at execution, not only at enqueue time.
        if (record.command.payload?.deviceId) {
          const scope = await tx.get("scope");
          const device = await tx.get("device:" + record.command.payload.deviceId);
          const epoch = `${scope?.mobileEpoch || 0}:${device?.mobileEpoch || 0}`;
          if (scope?.blocked || device?.blocked || epoch !== (record.command.accessEpoch || "0:0") || (scope?.pairedEpoch || 0) !== (record.command.pairedEpoch || 0)) {
            record.state = "cancelled";
            await tx.put(key, record);
            return { started: false };
          }
        }
        record.state = "executing";
        await tx.put(key, record);
        return { started: true };
      }
      if (operation === "ack") {
        if (!["completed", "failed"].includes(body.outcome)) return { error: "Invalid acknowledgement.", status: 400 };
        if (["completed", "failed"].includes(record.state)) return record.state === body.outcome ? { acknowledged: true } : { error: "Conflicting acknowledgement.", status: 409 };
        if (!["executing", "unknown"].includes(record.state)) return { error: "Command was not started.", status: 409 };
        record.state = body.outcome;
        await tx.put(key, record);
        return { acknowledged: true };
      }
      return { error: "Unknown operation.", status: 400 };
    });
    if (["rate", "claim", "enqueue"].includes(operation) && !(await this.state.storage.getAlarm())) await this.state.storage.setAlarm(now + 60000);
    const { status = 200, ...payload } = result;
    return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
  }
  async alarm() {
    const now = Date.now();
    let startAfter;
    let pendingCleanup = false;
    do {
      const records = await this.state.storage.list({ limit: 256, ...(startAfter ? { startAfter } : {}) });
      if (!records.size) break;
      for (const [key] of records) {
        await this.state.storage.transaction(async tx => {
          const current = await tx.get(key);
          if (current?.cleanupAt <= now) await tx.delete(key);
          else if (current?.cleanupAt) pendingCleanup = true;
        });
        startAfter = key;
      }
      if (records.size < 256) break;
    } while (true);
    // Revocation tombstones are intentionally retained.
    if (pendingCleanup) await this.state.storage.setAlarm(now + 300000);
  }
}
  
  async function installationAuthorised(request, env) {
    const id = request.headers.get("X-Sentinel-Installation") || "";
    const secret = (request.headers.get("Authorization") || "").replace(
      /^Bearer\s+/i,
      "",
    );
    if (!id || !secret) return null;
    const record = await env.SENTINEL_COMMANDS.get(
      `${INSTALLATION_PREFIX}${id}`,
      "json",
    );
    if (!record || record.secret !== secret) return null;
    return (await coordinate(env, "installation:" + id, "guard")).blocked ? null : { id, record };
  }
  
  async function alexaInstallation(userId, env) {
    if (!userId) return null;
    const id = await env.SENTINEL_COMMANDS.get(
      `${ALEXA_ACCOUNT_PREFIX}${encodeURIComponent(userId)}`,
    );
    if (!id) return null;
    if ((id !== "legacy" && !(await env.SENTINEL_COMMANDS.get(`${INSTALLATION_PREFIX}${id}`))) || (await coordinate(env, "installation:" + id, "guard")).blocked) throw Object.assign(new Error("Alexa installation is no longer available."), { status: 403 });
    return id;
  }
  
  async function oauthInstallation(request, env) {
    const token = (request.headers.get("Authorization") || "").replace(
      /^Bearer\s+/i,
      "",
    );
    const id = token
      ? await env.SENTINEL_COMMANDS.get(`${OAUTH_TOKEN_PREFIX}${token}`)
      : null;
    if (!id || (id !== "legacy" && !(await env.SENTINEL_COMMANDS.get(`${INSTALLATION_PREFIX}${id}`)))) return null;
    return (await coordinate(env, "installation:" + id, "guard")).blocked ? null : id;
  }

  function validAlexaRedirect(value, env) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")) return false;
      // Optional exact list from the Alexa console; defaults preserve existing
      // Amazon-hosted redirects without accepting lookalike domains.
      const exact = String(env.ALEXA_OAUTH_REDIRECT_URIS || "").split(",").map((s) => s.trim()).filter(Boolean);
      return exact.length ? exact.includes(url.href) : url.hostname === "amazon.com" || url.hostname.endsWith(".amazon.com");
    } catch { return false; }
  }

  function safeMobileDesktopCommand(action, command, target) {
    // Read-only actions never carry arbitrary instructions into the legacy
    // natural-language automation executor, including on older desktops.
    if (action === "system_check") return "Check system status";
    if (action === "security_status") return "Check security status";
    if (["camera_view", "open_page"].includes(action)) return action === "camera_view" ? "View selected camera" : "Open selected page";
    if (action !== "smart_home_control") return null;
    const match = command.match(/^(?:please\s+)?(?:turn|switch)\s+(on|off)\s+(.+?)(?:\s+please)?[.!]?$/i);
    const normalise = (value) => value.toLowerCase().replace(/^(?:the|my)\s+/, "").replace(/\s+/g, " ").replace(/[.!]$/, "").trim();
    if (!match || !target || normalise(match[2]) !== normalise(target) || /[\r\n;&|]/.test(target) || /\b(?:and|then|turn|switch)\b/i.test(target)) return null;
    return `turn ${match[1].toLowerCase()} ${target}`;
  }
  
  function accountLinkPage(params, error = "") {
    const hidden = ["client_id", "redirect_uri", "state", "response_type"]
      .map(
        (name) =>
          `<input type="hidden" name="${name}" value="${String(params.get(name) || "").replace(/"/g, "&quot;")}">`,
      )
      .join("");
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Link Sentinel AI</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#061525;color:#edfaff;font:16px system-ui}.card{width:min(430px,calc(100% - 40px));padding:28px;border:1px solid #27617d;border-radius:20px;background:#0b2135}h1{margin:0 0 8px}p{color:#9bb5c6;line-height:1.5}.error{color:#ffaaa0}input,button{box-sizing:border-box;width:100%;padding:14px;border-radius:11px;font:inherit}input{margin:12px 0;border:1px solid #34708e;color:white;background:#061525;text-transform:uppercase}button{border:0;background:#55dcfa;color:#04202a;font-weight:900}</style></head><body><form class="card" method="post" action="/oauth/authorize"><h1>Link Sentinel AI</h1><p>Enter the one-time Alexa linking code shown in Sentinel Settings.</p>${error ? `<p class="error">${error}</p>` : ""}${hidden}<input name="link_code" autocomplete="one-time-code" required placeholder="Sentinel linking code"><button>Link Alexa account</button></form></body></html>`;
  }
  
  async function createPairingPhrase(env, installationId) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const random = crypto.getRandomValues(new Uint32Array(2));
      const phrase = `${PAIR_WORDS_A[random[0] % PAIR_WORDS_A.length]} ${PAIR_WORDS_B[random[1] % PAIR_WORDS_B.length]}`;
      const key = `${PAIRING_PREFIX}${phrase}`;
      if (!(await env.SENTINEL_COMMANDS.get(key)) && await claimOneTime(env, "allocate:" + key, "slot", 1020000)) {
        await env.SENTINEL_COMMANDS.put(key, installationId, {
          expirationTtl: 900,
        });
        return phrase;
      }
    }
    throw new Error("Unable to allocate a pairing phrase. Try again.");
  }
  
  function authorised(request, env) {
    return (
      typeof env.RELAY_SHARED_SECRET === "string" && env.RELAY_SHARED_SECRET.length >= 20 &&
      request.headers.get("Authorization") === `Bearer ${env.RELAY_SHARED_SECRET}`
    );
  }

  function releasePublisherAuthorised(request, env) {
    const token = String(env.UPDATE_PUBLISH_TOKEN || "");
    return token.length >= 20 && request.headers.get("Authorization") === `Bearer ${token}`;
  }

  const releaseMetadataKey = (platform, version) => `release:${platform}:${version}`;
  const releaseLatestKey = (platform) => `release:latest:${platform}`;

  async function sha256Hex(value) {
    return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value))))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function releasePlatforms(target) {
    if (target === "both") return ["desktop", "ios"];
    return target === "desktop" || target === "ios" ? [target] : [];
  }

  function validReleaseManifest(manifest) {
    return manifest?.format === "sentinel-update/v1" &&
      validReleaseVersion(manifest?.version) &&
      releasePlatforms(manifest?.target).length > 0 &&
      ["all", "test"].includes(manifest?.audience) &&
      (manifest.audience !== "test" || /^[A-Za-z0-9._-]{8,128}$/.test(String(manifest.testInstallationId || "")));
  }

  async function authorisedTestInstallation(request, releaseMetadata, platform, installationId) {
    if (!installationId) return false;
    const registration = await releaseMetadata.get(`installation:${platform === "desktop" ? "windows" : "ios"}:${installationId}`, "json");
    const secret = String(request.headers.get("X-Sentinel-Registration") || "");
    return Boolean(registration?.registrationHash && secret.length >= 32 && registration.registrationHash === await sha256Hex(secret));
  }

  function validReleaseVersion(version) {
    return /^\d+(\.\d+){1,3}([-.][A-Za-z0-9.]+)?$/.test(String(version || ""));
  }
  
  function json(value, status = 200) {
    return new Response(JSON.stringify(value), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
  
  async function companionAuthorised(url, env) {
    const accessKey = url.searchParams.get("key");
    const installationId = url.searchParams.get("installation") || "legacy";
    const registration = await env.SENTINEL_COMMANDS.get(
      installationKey(installationId, COMPANION_ACCESS_KEY),
      "json",
    );
    if (!accessKey || !registration || accessKey !== registration.accessKey) return false;
    const guard = await coordinate(env, "installation:" + installationId, "guard");
    return !guard.blocked && (registration.pairedEpoch || 0) === guard.pairedEpoch;
  }

  async function companionDeviceAuthorised(request, env) {
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const auth = await env.SENTINEL_COMMANDS.get(`${COMPANION_TOKEN_PREFIX}${token}`, "json");
    if (!auth?.installationId || !auth?.deviceId) return null;
    if (auth.installationId !== "legacy" && !(await env.SENTINEL_COMMANDS.get(`${INSTALLATION_PREFIX}${auth.installationId}`))) return null;
    const deviceKey = installationKey(auth.installationId, `${COMPANION_DEVICE_PREFIX}${auth.deviceId}`);
    const device = await env.SENTINEL_COMMANDS.get(deviceKey, "json");
    if (!device) return null;
    const guard = await coordinate(env, "installation:" + auth.installationId, "guard", { deviceId: auth.deviceId });
    if (guard.blocked || (auth.pairedEpoch || 0) !== guard.pairedEpoch) return null;
    // Authentication must be read-only: parallel page refreshes must not write
    // the same presence key or make valid credentials fail with storage errors.
    return auth;
  }

  const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
  const base64ToBytes = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  async function vaultCryptoKey(env) {
    const secret = String(env.MOBILE_VAULT_KEY || "");
    if (secret.length < 32) throw new Error("MOBILE_VAULT_KEY is not configured.");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  async function encryptVault(env, value) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await vaultCryptoKey(env), new TextEncoder().encode(JSON.stringify(value)));
    return { version: 1, iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(encrypted)) };
  }
  async function decryptVault(env, value) {
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(value.iv) }, await vaultCryptoKey(env), base64ToBytes(value.data));
    return JSON.parse(new TextDecoder().decode(decrypted));
  }
  async function mobileAccessAuthorised(request, env) {
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return null;
    let auth = await env.SENTINEL_COMMANDS.get(`${MOBILE_ACCESS_TOKEN_PREFIX}${token}`, "json");
    if (!auth) {
      // Compatibility for paired iOS builds that use their long-lived
      // companion token for both Sync and approved independent services.
      auth = await env.SENTINEL_COMMANDS.get(`${COMPANION_TOKEN_PREFIX}${token}`, "json");
    }
    if (!auth?.installationId || !auth?.deviceId || (auth.expiresAt && Date.now() > Number(auth.expiresAt))) return null;
    if (auth.installationId !== "legacy" && !(await env.SENTINEL_COMMANDS.get(`${INSTALLATION_PREFIX}${auth.installationId}`))) return null;
    const paired = await env.SENTINEL_COMMANDS.get(installationKey(auth.installationId, `${COMPANION_DEVICE_PREFIX}${auth.deviceId}`), "json");
    if (!paired) return null;
    const guard = await coordinate(env, "installation:" + auth.installationId, "guard", { deviceId: auth.deviceId });
    if (guard.blocked || (auth.pairedEpoch || 0) !== guard.pairedEpoch || (auth.mobileEpoch || "0:0") !== guard.mobileEpoch) return null;
    const permission = await env.SENTINEL_COMMANDS.get(installationKey(auth.installationId, `${MOBILE_PERMISSION_PREFIX}${auth.deviceId}`), "json");
    return permission?.enabled === true && Array.isArray(permission.services) ? { ...auth, permission } : null;
  }
  async function enforceMobileRateLimit(env, auth, service) {
    return (await coordinate(env, "installation:" + auth.installationId, "rate", { key: auth.deviceId + ":" + service, limit: 60, windowMs: 60000 })).allowed;
  }

  function serviceFailure(code, status = 502, retryable = false) {
    const messages = {
      upstream_timeout: "The service took too long to respond. Please try again.",
      upstream_unavailable: "The service is temporarily unavailable. Please try again.",
      provider_rate_limit: "The provider request limit was reached. Please wait before trying again.",
      provider_credentials: "The provider credentials or service access need checking in Sentinel Personal.",
      provider_request_rejected: "The provider could not process this request. Try a shorter or simpler request.",
      invalid_provider_response: "The provider returned an unreadable response. Please try again.",
      incomplete_ai_response: "Sentinel could not finish this reply. Please try again or ask a shorter question.",
      request_cancelled: "The request was cancelled.",
      response_too_large: "The service response was too large. Try a narrower request.",
    };
    return Object.assign(new Error(messages[code] || messages.upstream_unavailable), { serviceError: true, code, status, retryable });
  }
  function providerStatus(response) {
    if (response.ok) return;
    if (response.status === 429) throw serviceFailure("provider_rate_limit", 429, true);
    if ([401, 403].includes(response.status)) throw serviceFailure("provider_credentials", 409);
    if (response.status >= 500) throw serviceFailure("upstream_unavailable", 502, true);
    throw serviceFailure("provider_request_rejected", 422);
  }
  function serviceErrorResponse(error) {
    const safe = error?.serviceError ? error : serviceFailure("upstream_unavailable", 502, true);
    return json({ error: safe.message, code: safe.code, retryable: safe.retryable }, safe.status);
  }
  async function fetchWithTimeout(resource, init = {}, timeoutMs = 10000, maxBytes = 5000000) {
    const controller = new AbortController();
    let reader, timer;
    const aborted = () => controller.abort();
    if (init.signal?.aborted) throw serviceFailure("request_cancelled", 408);
    init.signal?.addEventListener("abort", aborted, { once: true });
    const work = async () => {
      const response = await fetch(resource, { ...init, signal: controller.signal });
      // Check status without reading a potentially huge or secret-bearing error body.
      if (!response.ok) { void response.body?.cancel().catch(() => {}); providerStatus(response); }
      if (Number(response.headers.get("content-length") || 0) > maxBytes) { void response.body?.cancel().catch(() => {}); throw serviceFailure("response_too_large"); }
      reader = response.body?.getReader();
      const chunks = [];
      let length = 0;
      if (reader) while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > maxBytes) throw serviceFailure("response_too_large");
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return new Response([204, 205, 304].includes(response.status) ? null : bytes, { status: response.status, headers: { "content-type": response.headers.get("content-type") || "application/json" } });
    };
    try {
      return await Promise.race([work(), new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(serviceFailure("upstream_timeout", 502, true)); }, Math.max(1, timeoutMs));
      })]);
    } catch (error) {
      controller.abort();
      if (reader) void reader.cancel().catch(() => {});
      if (error?.serviceError) throw error;
      throw serviceFailure(init.signal?.aborted ? "request_cancelled" : "upstream_unavailable", init.signal?.aborted ? 408 : 502, !init.signal?.aborted);
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", aborted);
    }
  }
  async function providerJson(resource, init = {}, timeoutMs = 10000) {
    const response = await fetchWithTimeout(resource, init, timeoutMs);
    try { return await response.json(); }
    catch { throw serviceFailure("invalid_provider_response", 502, true); }
  }
  async function enforceMobileLiveSessionLimit(env, auth) {
    return (await coordinate(env, "installation:" + auth.installationId, "rate", { key: auth.deviceId + ":live-chat", limit: 6, windowMs: 600000 })).allowed;
  }
  function safeLiveVoice(value) {
    const voice = String(value || "cedar").trim().toLowerCase();
    return MOBILE_LIVE_VOICES.has(voice) && voice === "cedar" ? voice : "cedar";
  }
  function safeConversationId(value) {
    const id = String(value || "").trim();
    return /^[A-Za-z0-9._:-]{8,128}$/.test(id) ? id : crypto.randomUUID();
  }
  async function mobileVault(env, installationId) {
    const encrypted = await env.SENTINEL_COMMANDS.get(installationKey(installationId, MOBILE_VAULT_KEY), "json");
    return encrypted ? decryptVault(env, encrypted) : null;
  }

  function mobileChatInput(body) {
    const supplied = Array.isArray(body?.messages) ? body.messages : [];
    const messages = supplied
      .filter((message) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
      .slice(-20)
      .map((message, index, all) => {
        const text = message.content.trim();
        const limit = index === all.length - 1 ? 12000 : 6000;
        return { role: message.role, content: text.length <= limit ? text : text.slice(0, 2000) + "\n[Earlier detail omitted to fit context]\n" + text.slice(-(limit - 2048)) };
      })
      .filter((message) => message.content);
    const legacyPrompt = String(body?.prompt || "").trim();
    if (!messages.length && legacyPrompt) messages.push({ role: "user", content: legacyPrompt.slice(0, 12000) });
    while (messages.length > 1 && messages.reduce((length, message) => length + message.content.length, 0) > 24000) messages.shift();
    if (!messages.length && Array.isArray(body?.attachments) && body.attachments.length) messages.push({ role: "user", content: "Please analyse the attached file." });
    if (!messages.length) return null;
    const context = body?.context && typeof body.context === "object" ? body.context : {};
    const safeContext = {
      platform: "ios",
      appVersion: String(context.appVersion || "unknown").slice(0, 40),
      contentVersion: String(context.contentVersion || "unknown").slice(0, 40),
      currentPage: String(context.currentPage || "chat").slice(0, 60),
      enabledServices: Array.isArray(context.enabledServices) ? context.enabledServices.filter((service) => MOBILE_SERVICES.includes(service)) : [],
      companionOnline: Boolean(context.companionOnline),
      location: context.location && typeof context.location.latitude === "number" && typeof context.location.longitude === "number" && Number.isFinite(context.location.latitude) && Number.isFinite(context.location.longitude) && Math.abs(context.location.latitude) <= 90 && Math.abs(context.location.longitude) <= 180
        ? { latitude: Number(context.location.latitude), longitude: Number(context.location.longitude) }
        : undefined,
      weatherSummary: typeof context.weatherSummary === "string" ? context.weatherSummary.slice(0, 500) : undefined,
      selectedDestination: typeof context.selectedDestination === "string" ? context.selectedDestination.slice(0, 500) : undefined,
      selectedFlight: typeof context.selectedFlight === "string" ? context.selectedFlight.slice(0, 80) : undefined,
    };
    const attachments = [];
    let attachmentBytes = 0;
    for (const item of Array.isArray(body?.attachments) ? body.attachments.slice(0, MOBILE_CHAT_ATTACHMENT_MAX_COUNT) : []) {
      const name = String(item?.name || "attachment").replace(/[\r\n]/g, " ").slice(0, 180);
      const mimeType = String(item?.mimeType || "").toLowerCase().slice(0, 100);
      const data = String(item?.data || "");
      const match = data.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
      if (!match || match[1].toLowerCase() !== mimeType) return null;
      const bytes = base64Bytes(match[2]);
      if (!bytes || bytes > MOBILE_CHAT_ATTACHMENT_MAX_BYTES) return null;
      attachmentBytes += bytes;
      if (attachmentBytes > MOBILE_CHAT_ATTACHMENT_TOTAL_BYTES) return null;
      const isImage = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType);
      const isFile = ["application/pdf", "text/plain", "text/markdown", "text/csv", "application/json"].includes(mimeType);
      if (!isImage && !isFile) return null;
      attachments.push({ name, mimeType, data, isImage });
    }
    if (attachments.length) {
      const lastUserIndex = messages.map((message) => message.role).lastIndexOf("user");
      if (lastUserIndex < 0) return null;
      const user = messages[lastUserIndex];
      user.content = [
        { type: "input_text", text: user.content || "Please analyse the attached file." },
        ...attachments.map((attachment) => attachment.isImage
          ? { type: "input_image", image_url: attachment.data, detail: "auto" }
          : { type: "input_file", filename: attachment.name, file_data: attachment.data }),
      ];
    }
    return { messages, safeContext, attachmentCount: attachments.length };
  }

  function responseOutputText(payload) {
    if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
    const parts = [];
    for (const output of Array.isArray(payload?.output) ? payload.output : []) {
      for (const content of Array.isArray(output?.content) ? output.content : []) {
        if (typeof content?.text === "string" && content.text.trim()) parts.push(content.text.trim());
      }
    }
    return parts.join("\n");
  }

  const assistantPlanSchema = { type: "object", additionalProperties: false, required: ["requests"], properties: { requests: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false, required: ["service", "query"], properties: { service: { type: "string", enum: ["weather", "navigation", "aviation"] }, query: { type: "string", maxLength: 180 } } } } } };
  const nullableString = (maxLength) => ({ type: ["string", "null"], maxLength });
  const nullableNumber = { type: ["number", "null"] };
  // Cards/actions are constructed from verified tool results, not generated twice.
  const assistantTextSchema = { type: "object", additionalProperties: false, required: ["content", "title", "summary"], properties: { content: { type: "string", minLength: 1, maxLength: 7000 }, title: nullableString(80), summary: nullableString(240) } };
  const assistantReplySchema = {
    type: "object", additionalProperties: false, required: ["content", "title", "summary", "actions", "cards"],
    properties: {
      content: { type: "string", minLength: 1, maxLength: 7000 }, title: nullableString(80), summary: nullableString(240),
      actions: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["id", "type", "label", "page", "query", "latitude", "longitude", "flight"], properties: { id: { type: "string", maxLength: 80 }, type: { type: "string", enum: ["open_page", "open_directions", "view_weather", "track_flight"] }, label: { type: "string", maxLength: 80 }, page: { type: ["string", "null"], enum: ["weather", "navigation", "travel", "chat", null] }, query: nullableString(180), latitude: nullableNumber, longitude: nullableNumber, flight: nullableString(16) } } },
      cards: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, required: ["id", "type", "title", "subtitle", "detail", "value"], properties: { id: { type: "string", maxLength: 80 }, type: { type: "string", enum: ["weather", "place", "flight", "info"] }, title: { type: "string", maxLength: 100 }, subtitle: { type: "string", maxLength: 160 }, detail: { type: "string", maxLength: 500 }, value: { type: "string", maxLength: 80 } } } },
    },
  };

  function chatContentText(content) {
    if (typeof content === "string") return content.trim();
    if (!Array.isArray(content)) return "";
    return content
      .filter((item) => item?.type === "input_text" && typeof item?.text === "string")
      .map((item) => item.text.trim())
      .filter(Boolean)
      .join("\n");
  }

  function latestUserChatText(messages) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role !== "user") continue;
      return chatContentText(messages[index].content);
    }
    return "";
  }

  function instantMobileChatReply(chat) {
    if (chat.attachmentCount) return null;
    const text = latestUserChatText(chat.messages).trim().toLowerCase().replace(/[.!?]+$/g, "").trim();
    if (!text || text.length > 80) return null;
    if (/^(hi|hello|hey|hiya|good morning|good afternoon|good evening)$/.test(text)) {
      const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(new Date()));
      const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
      return `${greeting}, Regan. Sentinel is online.`;
    }
    if (/^(online|are you online|are you there|are you ready|you online|you there|you ready|sentinel online|sentinel status|system online)$/.test(text)) {
      return "Online and ready, Regan.";
    }
    if (/^(test|system test|respond|response check)$/.test(text)) {
      return "Online and responsive, Regan.";
    }
    return null;
  }

  function mobilePageRequest(chat) {
    const text = latestUserChatText(chat.messages).trim().toLowerCase();
    if (!/\b(?:open|show|go to|switch to|take me to)\b/.test(text)) return null;
    const pages = [
      ["home", /\bhome(?: page| screen)?\b/], ["chat", /\bchat(?: page| screen)?\b/],
      ["navigation", /\b(?:navigation|map|maps)(?: page| screen)?\b/],
      ["travel", /\b(?:travel|flights?)(?: page| screen)?\b/], ["weather", /\bweather(?: page| screen)?\b/],
      ["notifications", /\bnotifications?(?: page| screen)?\b/], ["settings", /\bsettings?(?: page| screen)?\b/],
      ["system", /\b(?:system|system vitals)(?: page| screen)?\b/],
    ];
    return pages.find(([, pattern]) => pattern.test(text))?.[0] || null;
  }

  function isCurrentLocationQuestion(chat) {
    if (chat.attachmentCount) return false;
    const text = latestUserChatText(chat.messages).trim().toLowerCase().replace(/[.!?]+$/g, "").trim();
    return /^(where am i|what is my location|what's my location|whats my location|current location|where are we)$/.test(text);
  }

  function directAssistantRequests(chat) {
    const text = latestUserChatText(chat.messages).slice(0, 180);
    const lower = text.toLowerCase();
    const requests = [];
    const flightMatch = text.toUpperCase().match(/\b([A-Z]{2,3})\s?(\d{1,4}[A-Z]?)\b/);
    const asksForFlight = /\b(flight|departure|arrival|terminal|gate|delayed|delay|on time|track)\b/i.test(text);
    const asksForWeather = /\b(weather|forecast|temperature|rain|raining|snow|wind|sunny|cloudy|storm|humidity|umbrella|hot|cold)\b/i.test(text);
    const asksForPlace = /\b(directions?|navigate|navigation|route|near me|nearby|closest|where is|find (?:a |an |the )?|restaurant|cafe|coffee|pharmacy|chemist|petrol|fuel|hotel|airport|hospital|shop|supermarket|attraction)\b/i.test(text);

    if (flightMatch && asksForFlight) {
      requests.push({ service: "aviation", query: `${flightMatch[1]}${flightMatch[2]}` });
    }
    if (asksForWeather) {
      const namedLocation = text.match(/\b(?:in|for|at)\s+([\p{L}][\p{L}\p{M}' .-]{1,80})[?.!]*$/iu)?.[1]?.trim().replace(/\b(?:for\s+)?(?:today|tomorrow|this week|next week|the week|the next (?:seven|7) days)\b.*$/i, "").trim();
      requests.push({ service: "weather", query: namedLocation || "" });
    }
    if (asksForPlace) requests.push({ service: "navigation", query: text });
    return requests.slice(0, 3);
  }

  function needsAssistantPlanner(chat, directRequests) {
    if (directRequests.length || chat.attachmentCount) return false;
    const text = latestUserChatText(chat.messages);
    return /\b(look up|search for|find nearby|plan (?:a |my )?(?:journey|trip)|flight status)\b/i.test(text);
  }

  async function openAIJson(apiKey, input, instructions, name, schema, maxOutputTokens = 1800, timeoutMs = 18000) {
    const payload = await providerJson("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ model: "gpt-5-mini", store: false, reasoning: { effort: "low" }, instructions, input, max_output_tokens: maxOutputTokens, text: { format: { type: "json_schema", name, strict: true, schema } } }) }, timeoutMs);
    if (payload.status === "incomplete") throw serviceFailure("incomplete_ai_response", 502, false);
    if (payload.error || (payload.status && payload.status !== "completed")) throw serviceFailure("upstream_unavailable", 502, true);
    const output = responseOutputText(payload);
    if (!output) throw serviceFailure("invalid_provider_response", 502, true);
    try { const parsed = JSON.parse(output); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); return parsed; }
    catch { throw serviceFailure("invalid_provider_response", 502, true); }
  }

  async function executeAssistantTool(service, query, credentials, context) {
    if (service === "weather") {
      const requestedLocation = String(query || "").trim();
      const local = !requestedLocation || /^(near me|here|local|current location|my location)$/i.test(requestedLocation);
      const location = local ? (context?.location ? `${context.location.latitude},${context.location.longitude}` : "") : requestedLocation;
      if (!location || !credentials?.apiKey) throw new Error("Weather is not configured for this request.");
      const response = await fetchWithTimeout(`https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(credentials.apiKey)}&q=${encodeURIComponent(location)}&days=7&aqi=no&alerts=yes`, {}, 8000);
      if (!response.ok) throw new Error(`Weather returned ${response.status}.`);
      const value = await response.json();
      if (value?.error || !Number.isFinite(value?.current?.temp_c) || !Array.isArray(value?.forecast?.forecastday)) throw serviceFailure("invalid_provider_response", 502, true);
      return { service, verified: true, location: [value?.location?.name, value?.location?.region, value?.location?.country].filter(Boolean).join(", "), current: { temperatureC: value.current.temp_c, feelsLikeC: value.current.feelslike_c, condition: value.current.condition?.text, windMph: value.current.wind_mph, precipitationMm: value.current.precip_mm }, availableDays: Math.min(7, value.forecast.forecastday.length), forecast: value.forecast.forecastday.slice(0, 7).map((day) => ({ date: day.date, minC: day.day?.mintemp_c, maxC: day.day?.maxtemp_c, condition: day.day?.condition?.text, rainChance: day.day?.daily_chance_of_rain })) };
    }
    if (service === "navigation") {
      if (!query || !credentials?.apiKey) throw new Error("Navigation is not configured for this request.");
      const locationBias = context?.location ? { circle: { center: { latitude: context.location.latitude, longitude: context.location.longitude }, radius: 50000 } } : undefined;
      const response = await fetchWithTimeout("https://places.googleapis.com/v1/places:searchText", { method: "POST", headers: { "content-type": "application/json", "X-Goog-Api-Key": credentials.apiKey, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.types" }, body: JSON.stringify({ textQuery: String(query).slice(0, 180), languageCode: "en-GB", regionCode: "GB", maxResultCount: 6, ...(locationBias ? { locationBias } : {}) }) }, 8000);
      if (!response.ok) throw new Error(`Navigation returned ${response.status}.`);
      const value = await response.json();
      if (!value || value.error || (value.places !== undefined && !Array.isArray(value.places))) throw serviceFailure("invalid_provider_response", 502, true);
      return { service, verified: true, places: (value?.places || []).slice(0, 6).map((place) => ({ id: place.id, name: place.displayName?.text, address: place.formattedAddress, latitude: place.location?.latitude, longitude: place.location?.longitude, rating: place.rating, ratingCount: place.userRatingCount, openNow: place.currentOpeningHours?.openNow, types: (place.types || []).slice(0, 8) })) };
    }
    if (service === "aviation") {
      const flight = String(query || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 12).toUpperCase();
      if (!flight || !credentials?.apiKey) throw new Error("Flight status is not configured for this request.");
      const response = await fetchWithTimeout(`https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(credentials.apiKey)}&flight_iata=${encodeURIComponent(flight)}`, {}, 10000);
      if (!response.ok) throw new Error(`Flight status returned ${response.status}.`);
      const value = await response.json();
      if (value?.error || !Array.isArray(value?.data)) throw serviceFailure("invalid_provider_response", 502, true);
      return { service, verified: true, flights: (value?.data || []).slice(0, 4).map((item) => ({ flightNumber: item.flight?.iata || flight, status: item.flight_status, airline: item.airline?.name, departure: { airport: item.departure?.airport, iata: item.departure?.iata, terminal: item.departure?.terminal, gate: item.departure?.gate, scheduled: item.departure?.scheduled, estimated: item.departure?.estimated }, arrival: { airport: item.arrival?.airport, iata: item.arrival?.iata, terminal: item.arrival?.terminal, gate: item.arrival?.gate, scheduled: item.arrival?.scheduled, estimated: item.arrival?.estimated } })) };
    }
    throw new Error("Unsupported Sentinel service request.");
  }

  function verifiedAssistantPresentation(verifiedResults) {
    const actions = [];
    const cards = [];
    for (const result of verifiedResults.filter((item) => item?.verified)) {
      if (result.service === "weather" && result.current) {
        const today = result.forecast?.[0] || {};
        const detail = [
          Number.isFinite(Number(today.maxC)) ? `High ${Math.round(Number(today.maxC))}\u00b0` : "",
          Number.isFinite(Number(today.minC)) ? `Low ${Math.round(Number(today.minC))}\u00b0` : "",
          today.rainChance !== undefined ? `Rain ${today.rainChance}%` : "",
        ].filter(Boolean).join(" \u00b7 ");
        cards.push({ id: `weather-${crypto.randomUUID()}`, type: "weather", title: result.location || "Current weather", subtitle: result.current.condition || "Weather verified", detail, value: Number.isFinite(Number(result.current.temperatureC)) ? `${Math.round(Number(result.current.temperatureC))}\u00b0` : "" });
        actions.push({ id: `weather-action-${crypto.randomUUID()}`, type: "view_weather", label: "View Weather", query: result.location || "current location" });
      }
      if (result.service === "navigation") {
        for (const place of (result.places || []).slice(0, 4)) {
          if (!place?.name || !Number.isFinite(Number(place.latitude)) || !Number.isFinite(Number(place.longitude))) continue;
          const detail = [typeof place.openNow === "boolean" ? (place.openNow ? "Open now" : "Closed") : "", Number.isFinite(Number(place.rating)) ? `${Number(place.rating).toFixed(1)} stars` : ""].filter(Boolean).join(" \u00b7 ");
          cards.push({ id: `place-${place.id || crypto.randomUUID()}`, type: "place", title: place.name, subtitle: place.address || "", detail, value: "" });
          actions.push({ id: `directions-${place.id || crypto.randomUUID()}`, type: "open_directions", label: `Directions to ${place.name}`.slice(0, 80), latitude: Number(place.latitude), longitude: Number(place.longitude), query: place.name });
        }
      }
      if (result.service === "aviation") {
        for (const flight of (result.flights || []).slice(0, 3)) {
          if (!flight?.flightNumber) continue;
          const departure = flight.departure?.iata || flight.departure?.airport || "Departure";
          const arrival = flight.arrival?.iata || flight.arrival?.airport || "Arrival";
          cards.push({ id: `flight-${flight.flightNumber}-${crypto.randomUUID()}`, type: "flight", title: flight.flightNumber, subtitle: flight.airline || "Flight status", detail: `${departure} \u2192 ${arrival}`, value: flight.status || "Status verified" });
          actions.push({ id: `flight-action-${flight.flightNumber}-${crypto.randomUUID()}`, type: "track_flight", label: `Track ${flight.flightNumber}`, flight: flight.flightNumber });
        }
      }
    }
    return { actions: actions.slice(0, 4), cards: cards.slice(0, 6) };
  }

  function sanitiseAssistantReply(reply, verifiedResults) {
    const presentation = verifiedAssistantPresentation(verifiedResults);
    return { content: typeof reply?.content === "string" ? reply.content.trim().slice(0, 7000) : "", title: typeof reply?.title === "string" ? reply.title.slice(0, 80) : null, summary: typeof reply?.summary === "string" ? reply.summary.slice(0, 240) : null, ...presentation };
  }

  function mobileImageRequest(chat) {
    const text = latestUserChatText(chat.messages).trim().slice(0, 3500);
    if (!text) return null;
    const asksForImage = /\b(?:create|generate|draw|design|make|produce|render|show me)\b[\s\S]{0,120}\b(?:image|picture|photo|illustration|artwork|wallpaper|poster|logo)\b/i.test(text)
      || /\b(?:image|picture|photo|illustration|artwork|wallpaper|poster|logo)\b[\s\S]{0,120}\b(?:create|generate|draw|design|make|produce|render)\b/i.test(text);
    const previousAssistantIndex = chat.messages.map((message) => message.role).lastIndexOf("assistant");
    const previousAssistant = previousAssistantIndex >= 0 ? chat.messages[previousAssistantIndex]?.content : null;
    const revisesImage = typeof previousAssistant === "string"
      && /generated (?:an |the |your )?image/i.test(previousAssistant)
      && /^(?:please\s+)?(?:change|edit|revise|adjust|make|turn|try)\b/i.test(text);
    if (asksForImage) return text;
    if (!revisesImage) return null;
    for (let index = previousAssistantIndex - 1; index >= 0; index -= 1) {
      if (chat.messages[index]?.role !== "user") continue;
      const original = chatContentText(chat.messages[index].content).trim();
      if (original) return `${original.slice(0, 2800)}\n\nRevision requested: ${text}`;
    }
    return text;
  }

  async function generateMobileImage(apiKey, prompt) {
    const payload = await providerJson("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-2", prompt, size: "1024x1024", quality: "medium", n: 1 }),
    }, 90000);
    const result = Array.isArray(payload?.data) ? payload.data[0] : null;
    const data = String(result?.b64_json || "");
    if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw serviceFailure("invalid_provider_response", 502, true);
    return {
      id: crypto.randomUUID(),
      prompt,
      revisedPrompt: typeof result?.revised_prompt === "string" ? result.revised_prompt.slice(0, 4000) : null,
      mimeType: "image/png",
      data,
    };
  }

  async function runAssistantTools(requests, auth, vault, context) {
    const seen = new Set();
    const selected = requests.filter(item => {
      if (!item || !["weather", "navigation", "aviation"].includes(item.service) || typeof item.query !== "string") return false;
      const key = item.service + ":" + item.query.trim();
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 3);
    const outcomes = await Promise.all(selected.map(async item => {
      const activity = { service: item.service };
      if (!auth.permission.services.includes(item.service)) return { activity: { ...activity, status: "denied", label: `${item.service} access is not enabled` } };
      const credentials = vault?.credentials?.[item.service];
      if (!credentials) return { activity: { ...activity, status: "unavailable", label: `${item.service} is not configured` } };
      try { return { result: await executeAssistantTool(item.service, item.query, credentials, context), activity: { ...activity, status: "completed", label: `${item.service} verified` } }; }
      catch { return { activity: { ...activity, status: "failed", label: `${item.service} is temporarily unavailable` } }; }
    }));
    return { verifiedResults: outcomes.filter(item => item.result).map(item => item.result), toolActivity: outcomes.map(item => item.activity) };
  }

  const companionChunkKey = (prefix, id, index) => `${prefix}${id}:chunk:${index}`;
  const validCompanionItemId = (id) => /^[A-Za-z0-9_-]{8,128}$/.test(String(id || ""));
  const utf8Bytes = (value) => new TextEncoder().encode(String(value || "")).byteLength;
  const base64Bytes = (value) => Math.max(0, Math.floor(String(value || "").replace(/=+$/, "").length * 3 / 4));
  const companionPayloadBytes = (item) => item?.kind === "file" ? base64Bytes(item.data) : utf8Bytes(item?.text ?? item?.data);

  async function putCompanionItem(env, prefix, item) {
    const invalid = (message, status = 400) => { const error = new Error(message); error.status = status; throw error; };
    if (!item || !validCompanionItemId(item.id) || !["text", "file"].includes(item.kind)) invalid("Invalid shared item.");
    if (item.kind === "file" && typeof item.data === "string" && item.data.length > Math.ceil(COMPANION_CLOUD_MAX_BYTES / 3) * 4) invalid("Cloud backup supports files up to 65 MB. Use local Wi-Fi for larger files.", 413);
    if (item.kind === "file" && (typeof item.data !== "string" || item.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(item.data))) invalid("The file must contain valid base64 data.");
    if (item.kind === "text" && (typeof item.text !== "string" || !item.text.trim())) invalid("Enter some text to share.");
    if (item.kind === "text" && utf8Bytes(item.text) > 256 * 1024) invalid("Shared text is limited to 256 KB. Send larger content as a file.", 413);
    // Never persist client-controlled chunk pointers, timestamps or arbitrary
    // metadata. The endpoint supplies the authenticated device identity.
    item = {
      id: item.id, kind: item.kind,
      ...(item.kind === "text" ? { text: item.text } : {
        data: item.data,
        name: String(item.name || "Shared file").replace(/[\r\n\\/]/g, "_").slice(0, 180),
        mimeType: /^[\w.+-]+\/[\w.+-]+$/.test(String(item.mimeType || "")) ? item.mimeType : "application/octet-stream",
      }),
      sourceName: String(item.sourceName || "Sentinel").replace(/[\r\n]/g, " ").slice(0, 80),
      sourceDeviceId: String(item.sourceDeviceId || "desktop").slice(0, 128),
      createdAt: new Date().toISOString(),
    };
    const size = companionPayloadBytes(item);
    if (size > COMPANION_CLOUD_MAX_BYTES) {
      const error = new Error("Cloud backup supports files up to 65 MB. Use local Wi-Fi for larger files.");
      error.status = 413;
      throw error;
    }
    const field = "data";
    const value = String(item[field] || "");
    const chunks = [];
    for (let offset = 0; offset < value.length; offset += COMPANION_CHUNK_CHARS) chunks.push(value.slice(offset, offset + COMPANION_CHUNK_CHARS));
    const manifest = { ...item, [field]: chunks.length > 1 ? undefined : value, size, _cloudChunks: chunks.length > 1 ? chunks.length : 0, _cloudField: chunks.length > 1 ? field : undefined };
    if (chunks.length > 1) {
      await Promise.all(chunks.map((chunk, index) => env.SENTINEL_COMMANDS.put(companionChunkKey(prefix, item.id, index), chunk, { expirationTtl: 86700 })));
    }
    await env.SENTINEL_COMMANDS.put(`${prefix}${item.id}`, JSON.stringify(manifest), { expirationTtl: 86400 });
  }

  async function getCompanionItem(env, prefix, id) {
    if (!validCompanionItemId(id)) return null;
    const item = await env.SENTINEL_COMMANDS.get(`${prefix}${id}`, "json");
    if (!item) return null;
    if (item._cloudChunks && item._cloudField) {
      if (!Number.isInteger(item._cloudChunks) || item._cloudChunks < 1 || item._cloudChunks > 8 || item._cloudField !== "data") return null;
      const chunks = await Promise.all(Array.from({ length: item._cloudChunks }, (_, index) => env.SENTINEL_COMMANDS.get(companionChunkKey(prefix, id, index))));
      if (chunks.some((chunk) => chunk === null)) return null;
      item[item._cloudField] = chunks.join("");
    }
    delete item._cloudChunks;
    delete item._cloudField;
    return item;
  }

  async function listCompanionItems(env, prefix) {
    const items = [];
    let cursor;
    do {
      const page = await env.SENTINEL_COMMANDS.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
      const manifests = page.keys.filter((key) => !key.name.includes(":chunk:"));
      for (let start = 0; start < manifests.length; start += 20) {
        const batch = await Promise.all(manifests.slice(start, start + 20).map((key) => env.SENTINEL_COMMANDS.get(key.name, "json")));
        for (const value of batch.filter(Boolean)) {
          const { data, _cloudChunks, _cloudField, ...item } = value;
          items.push(item);
        }
      }
      const next = page.list_complete ? undefined : page.cursor;
      if (!page.list_complete && (!next || next === cursor)) throw new Error("Shared item listing could not be completed. Please retry.");
      cursor = next;
    } while (cursor);
    return items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }

  async function deleteCompanionItem(env, prefix, id) {
    if (!validCompanionItemId(id)) { const error = new Error("Invalid shared item ID."); error.status = 400; throw error; }
    const item = await env.SENTINEL_COMMANDS.get(`${prefix}${id}`, "json");
    const keys = [`${prefix}${id}`];
    for (let index = 0; index < Math.min(8, Number(item?._cloudChunks || 0)); index += 1) keys.push(companionChunkKey(prefix, id, index));
    await Promise.all(keys.map((key) => env.SENTINEL_COMMANDS.delete(key)));
  }
  
  function companionPage(accessKey) {
    const safeKey = JSON.stringify(accessKey || "");
  
    return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sentinel Companion</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #06111f; color: #e9f8ff; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      .app { min-height: 100vh; display: grid; grid-template-columns: 220px 1fr; background: radial-gradient(circle at 50% 0%, #123b59 0%, #071625 43%, #06111f 72%); }
      aside { padding: 28px 18px; background: rgba(6, 21, 36, .9); border-right: 1px solid #1b435d; }
      .brand { font-size: 21px; font-weight: 900; letter-spacing: .14em; }
      .brand small, .eyebrow { display: block; margin-top: 6px; color: #55dcff; font-size: 11px; font-weight: 800; letter-spacing: .16em; }
      nav { display: grid; gap: 8px; margin-top: 42px; }
      nav button { border: 0; border-radius: 12px; padding: 13px; color: #b7cbd9; background: transparent; text-align: left; font: inherit; font-weight: 750; cursor: pointer; }
      nav button.active, nav button:hover { color: #fff; background: #11344d; box-shadow: inset 3px 0 #4bddff; }
      main { width: min(1260px, 100%); margin: 0 auto; padding: 30px clamp(22px, 5vw, 72px); }
      .top { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding-bottom: 23px; border-bottom: 1px solid #183850; }
      .badge { padding: 11px 13px; border-radius: 12px; background: #071a2a; color: #a9c1d1; }
      .dot { color: #6ff0ad; }
      .view { display: none; }
      .view.active { display: block; }
      h1 { margin: 7px 0; font-size: clamp(34px, 5vw, 58px); letter-spacing: -.06em; }
      p { color: #94aabb; line-height: 1.55; }
      .reactor { width: 170px; aspect-ratio: 1; margin: 26px auto; display: grid; place-items: center; border: 16px solid #1f7eab; border-radius: 50%; box-shadow: 0 0 0 13px #08334c, 0 0 58px #36d9ff9c, inset 0 0 40px #35d8ff; animation: pulse 3s ease-in-out infinite; }
      .reactor b { padding: 18px; border: 4px solid #fff; border-radius: 50%; font-size: 27px; box-shadow: 0 0 22px #61e8ff; }
      @keyframes pulse { 50% { transform: scale(1.04); box-shadow: 0 0 0 13px #08334c, 0 0 84px #36d9ffcc, inset 0 0 55px #35d8ff; } }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 28px; }
      .card { padding: 21px; border: 1px solid #1e5675; border-radius: 19px; background: linear-gradient(145deg, rgba(11,36,56,.94), rgba(7,21,36,.94)); }
      .card h2 { margin: 0; }
      .command { display: flex; gap: 10px; margin-top: 15px; }
      input, button { font: inherit; }
      input { min-width: 0; flex: 1; padding: 13px; border: 1px solid #265775; border-radius: 12px; outline: none; color: #fff; background: #061321; }
      button.action { padding: 13px; border: 0; border-radius: 12px; color: #04202a; background: linear-gradient(135deg, #64e4ff, #32bddf); font-weight: 900; cursor: pointer; }
      button.secondary { margin-top: 10px; color: #d8f8ff; background: #0d2b41; }
      .status, .route { margin-top: 14px; padding: 13px; border-radius: 10px; color: #a9c1d1; background: #071929; }
      .route { border-left: 3px solid #45d8ff; }
      .link { display: inline-block; margin-top: 15px; color: #67dfff; font-weight: 800; }
      @media (max-width: 720px) { .app { grid-template-columns: 1fr; } aside { padding: 16px; border-right: 0; border-bottom: 1px solid #1a425b; } nav { display: flex; overflow: auto; margin-top: 16px; } nav button { white-space: nowrap; } main { padding: 22px; } .top { align-items: flex-start; flex-direction: column; } .grid { grid-template-columns: 1fr; } .command { flex-wrap: wrap; } .command input { min-width: 100%; } }
    </style>
  </head>
  <body>
    <div class="app">
      <aside>
        <div class="brand">SENTINEL<small>COMPANION</small></div>
        <nav>
          <button class="active" data-view="home">Home</button>
          <button data-view="automation">Automation</button>
          <button data-view="security">Security</button>
          <button data-view="navigation">Navigation</button>
        </nav>
      </aside>
      <main>
        <div class="top"><b><span class="dot">●</span> SENTINEL ONLINE</b><div id="connection" class="badge">Checking secure link...</div></div>
        <section id="home" class="view active">
          <span class="eyebrow">REMOTE OPERATIONS</span><h1>Sentinel, anywhere.</h1><p>Your secure command centre for the home you left behind.</p>
          <div class="reactor"><b>S</b></div>
          <article class="card"><h2>Quick command</h2><div class="command"><input id="command" placeholder="e.g. turn on living room lights" /><button class="action" id="send-command">Send</button></div><div id="status" class="status">Ready.</div></article>
        </section>
        <section id="automation" class="view">
          <span class="eyebrow">HOME AUTOMATION</span><h1>Control your home.</h1><p>Commands are delivered securely to Sentinel Personal while it is running.</p>
          <div class="grid">
            <article class="card"><h2>All lights</h2><p>Control your connected Hue and Govee devices.</p><button class="action" data-command="turn on all lights">Turn on</button><button class="action secondary" data-command="turn off all lights">Turn off</button></article>
            <article class="card"><h2>Room control</h2><p>Use the exact room or light name.</p><div class="command"><input id="room" placeholder="Turn on kitchen lights" /><button class="action" id="send-room">Send</button></div></article>
            <article class="card"><h2>Delivery</h2><p>Commands expire after two minutes and are deleted after delivery.</p><div id="automation-status" class="status">Checking status...</div></article>
          </div>
        </section>
        <section id="security" class="view"><span class="eyebrow">SECURITY CONTROL</span><h1>Security stays private.</h1><p>Ring uses its own protected remote service for camera feeds and two-way audio.</p><div class="grid"><article class="card"><h2>Ring security</h2><p>Open Ring for live view, talkback and event history.</p><a class="link" href="https://ring.com" target="_blank" rel="noreferrer">Open Ring</a></article><article class="card"><h2>Sentinel status</h2><p>Your Personal app must be online to receive remote commands.</p><div id="security-status" class="status">Checking status...</div></article></div></section>
        <section id="navigation" class="view"><span class="eyebrow">NAVIGATION CONSOLE</span><h1>Find your way.</h1><p>Open live directions from the device you are currently using.</p><article class="card"><div class="command"><input id="destination" placeholder="Address, landmark, or place" /><button class="action" id="directions">Directions</button></div><div class="route">Traffic and alternative routes open in Google Maps on this device.</div><div class="route">Your current location is never sent to Sentinel.</div></article></section>
      </main>
    </div>
    <script>
      const accessKey = ${safeKey};
      const endpoint = (path) => path + (path.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(accessKey);
      const statusIds = ['status', 'automation-status', 'security-status'];
      const byId = (id) => document.getElementById(id);
      function setStatus(text) { statusIds.forEach((id) => { const node = byId(id); if (node) node.textContent = text; }); }
      async function refresh() {
        const connection = byId('connection');
        try {
          const response = await fetch(endpoint('/companion/status'));
          const data = await response.json();
          const online = response.ok && Boolean(data.online);
          connection.innerHTML = online ? '<span class="dot">●</span> Sentinel Personal online' : '○ Sentinel Personal offline';
          setStatus(online ? 'Sentinel is online and ready for commands.' : 'Sentinel is offline. Commands cannot be delivered.');
        } catch (_) { connection.textContent = 'Secure link unavailable'; setStatus('Unable to verify companion connection.'); }
      }
      async function sendCommand(command) {
        if (!command || !command.trim()) return;
        setStatus('Sending command...');
        try {
          const response = await fetch(endpoint('/companion/command'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ command: command.trim() }) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Command rejected');
          setStatus('Command queued for Sentinel.');
        } catch (error) { setStatus(error.message || 'Unable to send command.'); }
      }
      document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('[data-view]').forEach((node) => node.classList.remove('active')); document.querySelectorAll('.view').forEach((node) => node.classList.remove('active')); button.classList.add('active'); byId(button.dataset.view).classList.add('active'); }));
      byId('send-command').addEventListener('click', () => sendCommand(byId('command').value));
      byId('send-room').addEventListener('click', () => sendCommand(byId('room').value));
      document.querySelectorAll('[data-command]').forEach((button) => button.addEventListener('click', () => sendCommand(button.dataset.command)));
      byId('directions').addEventListener('click', () => { const destination = byId('destination').value.trim(); if (destination) window.open('https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(destination), '_blank', 'noopener'); });
      refresh(); setInterval(refresh, 10000);
    </script>
  </body>
  </html>`;
  }
  
  export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      const releaseMetadata = env.UPDATE_RELEASES || env.SENTINEL_COMMANDS;
      const releaseBucket = env.UPDATE_RELEASES_BUCKET || env.SENTINEL_RELEASES;

      try {
        if (url.pathname === "/health") return json({ online: true });
        if (url.pathname === "/v1/installations/register" && request.method === "POST") {
          if (!releaseMetadata) return json({ error: "The installation registry is unavailable." }, 503);
          const payload = await request.json().catch(() => ({}));
          const platform = payload?.platform === "ios" ? "ios" : payload?.platform === "windows" ? "windows" : null;
          const installationId = String(payload?.installationId || "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 128);
          const registrationSecret = String(request.headers.get("X-Sentinel-Registration") || "");
          if (!platform || installationId.length < 8 || registrationSecret.length < 32 || registrationSecret.length > 256) return json({ error: "Invalid installation identity." }, 400);
          const key = `installation:${platform}:${installationId}`;
          const registrationHash = await sha256Hex(registrationSecret);
          const existing = await releaseMetadata.get(key, "json");
          if (existing?.registrationHash && existing.registrationHash !== registrationHash) return json({ error: "This installation identity is already registered to another device credential." }, 409);
          const record = {
            installationId,
            platform,
            edition: "base",
            appVersion: String(payload?.appVersion || "unknown").slice(0, 40),
            contentVersion: String(payload?.contentVersion || "none").slice(0, 40),
            updateChannel: String(payload?.updateChannel || "stable").slice(0, 30),
            deviceName: String(payload?.deviceName || "Sentinel device").slice(0, 100),
            registrationHash,
            registeredAt: existing?.registeredAt || new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
          };
          await releaseMetadata.put(key, JSON.stringify(record));
          return json({ registered: true, platform, lastSeenAt: record.lastSeenAt });
        }
        if (url.pathname === "/v1/installations" && request.method === "GET") {
          if (!releasePublisherAuthorised(request, env))
            return json({ error: "Installation inventory is not authorised." }, 401);
          if (!releaseMetadata) return json({ error: "The installation registry is unavailable." }, 503);
          const installations = [];
          let cursor;
          do {
            const page = await releaseMetadata.list({ prefix: "installation:", cursor });
            for (const key of page.keys) {
              const record = await releaseMetadata.get(key.name, "json");
              if (record) { const { registrationHash, ...safeRecord } = record; installations.push(safeRecord); }
            }
            cursor = page.list_complete ? undefined : page.cursor;
          } while (cursor);
          installations.sort((a, b) => String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
          return json({ installations, count: installations.length });
        }
        if (url.pathname === "/v1/releases/publisher-status" && request.method === "GET") {
          if (!releasePublisherAuthorised(request, env))
            return json({ error: "Release publishing is not authorised." }, 401);
          return json({
            authorised: true,
            releaseBucketReady: Boolean(releaseBucket),
            metadataStoreReady: Boolean(releaseMetadata),
          });
        }
        if (url.pathname === "/v1/releases" && request.method === "POST") {
          if (!releasePublisherAuthorised(request, env))
            return json({ error: "Release publishing is not authorised." }, 401);
          if (!releaseBucket)
            return json({ error: "The release bucket is not configured." }, 503);
          if (!releaseMetadata)
            return json({ error: "The release metadata store is not configured." }, 503);
          const form = await request.formData();
          const packageFile = form.get("package");
          let manifest;
          try {
            manifest = JSON.parse(String(form.get("manifest") || "{}"));
          } catch {
            return json({ error: "The release manifest is invalid." }, 400);
          }
          if (
            !validReleaseManifest(manifest) ||
            !packageFile ||
            typeof packageFile.arrayBuffer !== "function"
          )
            return json({ error: "A valid signed Sentinel release is required." }, 400);
          if (packageFile.size > 1024 * 1024 * 1024)
            return json({ error: "The release package is too large." }, 413);
          const objectKey = `sentinel-releases/${manifest.target}/${manifest.version}/${String(packageFile.name || "Sentinel.sentinel-update").replace(/[^A-Za-z0-9._-]/g, "_")}`;
          await releaseBucket.put(objectKey, packageFile.stream(), {
            httpMetadata: { contentType: "application/octet-stream" },
            customMetadata: { version: manifest.version },
          });
          const record = {
            manifest,
            objectKey,
            publishedAt: new Date().toISOString(),
          };
          for (const platform of releasePlatforms(manifest.target)) {
            await releaseMetadata.put(releaseMetadataKey(platform, manifest.version), JSON.stringify(record));
            await releaseMetadata.put(releaseLatestKey(platform), JSON.stringify(record));
          }
          return json({ published: true, version: manifest.version });
        }
        if (url.pathname === "/v1/releases/multipart/init" && request.method === "POST") {
          if (!releasePublisherAuthorised(request, env))
            return json({ error: "Release publishing is not authorised." }, 401);
          if (!releaseBucket || !releaseMetadata)
            return json({ error: "Release storage is not configured." }, 503);
          const payload = await request.json().catch(() => ({}));
          const manifest = payload?.manifest;
          if (!validReleaseManifest(manifest))
            return json({ error: "The release manifest is invalid." }, 400);
          const filename = String(payload?.filename || `Sentinel-Base-${manifest.version}.sentinel-update`).replace(/[^A-Za-z0-9._-]/g, "_");
          const objectKey = `sentinel-releases/${manifest.target}/${manifest.version}/${filename}`;
          const upload = await releaseBucket.createMultipartUpload(objectKey, {
            httpMetadata: { contentType: "application/octet-stream" },
            customMetadata: { version: manifest.version },
          });
          return json({ uploadId: upload.uploadId, objectKey });
        }
        if (url.pathname === "/v1/releases/multipart/part" && request.method === "PUT") {
          if (!releasePublisherAuthorised(request, env))
            return json({ error: "Release publishing is not authorised." }, 401);
          if (!releaseBucket) return json({ error: "Release storage is not configured." }, 503);
          const uploadId = url.searchParams.get("uploadId");
          const objectKey = url.searchParams.get("objectKey");
          const partNumber = Number(url.searchParams.get("partNumber"));
          if (!uploadId || !objectKey || !Number.isInteger(partNumber) || partNumber < 1)
            return json({ error: "Invalid multipart upload part." }, 400);
          const upload = releaseBucket.resumeMultipartUpload(objectKey, uploadId);
          const part = await upload.uploadPart(partNumber, request.body);
          return json({ partNumber: part.partNumber, etag: part.etag });
        }
        if (url.pathname === "/v1/releases/multipart/complete" && request.method === "POST") {
          if (!releasePublisherAuthorised(request, env))
            return json({ error: "Release publishing is not authorised." }, 401);
          if (!releaseBucket || !releaseMetadata)
            return json({ error: "Release storage is not configured." }, 503);
          const payload = await request.json().catch(() => ({}));
          const { uploadId, objectKey, manifest, parts } = payload || {};
          const expectedPrefix = `sentinel-releases/${manifest?.target}/${manifest?.version}/`;
          if (!uploadId || !objectKey || !validReleaseManifest(manifest) || !objectKey.startsWith(expectedPrefix) || !Array.isArray(parts) || !parts.length)
            return json({ error: "Invalid multipart completion request." }, 400);
          const upload = releaseBucket.resumeMultipartUpload(objectKey, uploadId);
          await upload.complete(parts);
          const record = { manifest, objectKey, publishedAt: new Date().toISOString() };
          for (const platform of releasePlatforms(manifest.target)) {
            await releaseMetadata.put(releaseMetadataKey(platform, manifest.version), JSON.stringify(record));
            await releaseMetadata.put(releaseLatestKey(platform), JSON.stringify(record));
          }
          return json({ published: true, version: manifest.version });
        }
        if (url.pathname === "/v1/releases/latest" && request.method === "GET") {
          if (!releaseMetadata)
            return json({ error: "The release metadata store is not configured." }, 503);
          const platform = url.searchParams.get("platform") === "ios" ? "ios" : "desktop";
          const installationId = String(url.searchParams.get("installationId") || "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 128);
          const record = await releaseMetadata.get(releaseLatestKey(platform), "json");
          if (!record) return json({ available: false }, 404);
          if (record.manifest?.audience === "test" && !releasePublisherAuthorised(request, env) && (record.manifest.testInstallationId !== installationId || !(await authorisedTestInstallation(request, releaseMetadata, platform, installationId)))) return json({ available: false, reason: "This release is restricted to its selected test installation." }, 404);
          return json({
            available: true,
            ...record.manifest,
            publishedAt: record.publishedAt,
            packageUrl: new URL(
              `/v1/releases/${encodeURIComponent(record.manifest.version)}/package?platform=${encodeURIComponent(platform)}&installationId=${encodeURIComponent(installationId)}`,
              url,
            ).toString(),
          });
        }
        const releasePackageMatch = url.pathname.match(/^\/v1\/releases\/([^/]+)\/package$/);
        if (releasePackageMatch && request.method === "GET") {
          if (!releaseBucket)
            return json({ error: "The release bucket is not configured." }, 503);
          if (!releaseMetadata)
            return json({ error: "The release metadata store is not configured." }, 503);
          const version = decodeURIComponent(releasePackageMatch[1]);
          // Existing Windows Base clients did not include platform. Keep that exact
          // request desktop-only while all new clients send an explicit platform.
          const platform = url.searchParams.get("platform") === "ios" ? "ios" : "desktop";
          const installationId = String(url.searchParams.get("installationId") || "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 128);
          const record = await releaseMetadata.get(releaseMetadataKey(platform, version), "json");
          if (!record) return json({ error: "Release not found." }, 404);
          if (record.manifest?.audience === "test" && !releasePublisherAuthorised(request, env) && (record.manifest.testInstallationId !== installationId || !(await authorisedTestInstallation(request, releaseMetadata, platform, installationId)))) return json({ error: "Release not found." }, 404);
          const object = await releaseBucket.get(record.objectKey);
          if (!object) return json({ error: "Release package not found." }, 404);
          return new Response(object.body, {
            headers: {
              "content-type": "application/octet-stream",
              "content-disposition": `attachment; filename="Sentinel-Base-${version}.sentinel-update"`,
              "cache-control": "public, max-age=300",
              etag: object.httpEtag,
            },
          });
        }
        if (url.pathname === "/oauth/authorize" && request.method === "GET")
          return new Response(accountLinkPage(url.searchParams), {
            headers: {
              "content-type": "text/html;charset=utf-8",
              "cache-control": "no-store",
            },
          });
        if (url.pathname === "/oauth/authorize" && request.method === "POST") {
          const form = await request.formData();
          const params = new URLSearchParams();
          for (const name of [
            "client_id",
            "redirect_uri",
            "state",
            "response_type",
          ])
            params.set(name, String(form.get(name) || ""));
          const redirectUri = params.get("redirect_uri") || "";
          if (
            params.get("client_id") !== "sentinel-alexa" ||
            params.get("response_type") !== "code" ||
            !validAlexaRedirect(redirectUri, env)
          )
            return new Response(
              accountLinkPage(params, "Invalid Alexa linking request."),
              {
                status: 400,
                headers: { "content-type": "text/html;charset=utf-8" },
              },
            );
          const linkCode = String(form.get("link_code") || "")
            .trim()
            .toUpperCase();
          const key = `${LINK_CODE_PREFIX}${linkCode}`;
          const installationId = await env.SENTINEL_COMMANDS.get(key);
          if (!installationId)
            return new Response(
              accountLinkPage(
                params,
                "That code is invalid, expired, or already used.",
              ),
              {
                status: 400,
                headers: { "content-type": "text/html;charset=utf-8" },
              },
            );
          if (!(await claimOneTime(env, key, installationId, 900000))) return json({ error: "Link code has already been used." }, 409);
          const code = randomToken(32);
          await Promise.all([
            env.SENTINEL_COMMANDS.put(
              `${OAUTH_CODE_PREFIX}${code}`,
              JSON.stringify({ installationId, clientId: "sentinel-alexa", redirectUri }),
              { expirationTtl: 300 },
            ),
            env.SENTINEL_COMMANDS.delete(key),
          ]);
          const destination = new URL(redirectUri);
          destination.searchParams.set("code", code);
          destination.searchParams.set("state", params.get("state") || "");
          return Response.redirect(destination.toString(), 302);
        }
        if (url.pathname === "/oauth/token" && request.method === "POST") {
          const contentType = request.headers.get("content-type") || "";
          const body = contentType.includes("json")
            ? await request.json()
            : Object.fromEntries(await request.formData());
          if (
            String(env.ALEXA_OAUTH_CLIENT_SECRET || "").length < 20 ||
            String(body.client_id || "") !== "sentinel-alexa" ||
            String(body.client_secret || "") !==
              String(env.ALEXA_OAUTH_CLIENT_SECRET || "")
          )
            return json({ error: "invalid_client" }, 401);
          if (body.grant_type !== "authorization_code")
            return json({ error: "unsupported_grant_type" }, 400);
          const grantValue = await env.SENTINEL_COMMANDS.get(
            `${OAUTH_CODE_PREFIX}${body.code}`,
          );
          let grant; try { grant = JSON.parse(grantValue); } catch { grant = null; }
          if (!grant?.installationId || grant.clientId !== body.client_id || grant.redirectUri !== body.redirect_uri) return json({ error: "invalid_grant" }, 400);
          const installationId = grant.installationId;
          if (installationId !== "legacy" && !(await env.SENTINEL_COMMANDS.get(`${INSTALLATION_PREFIX}${installationId}`))) return json({ error: "invalid_grant" }, 400);
          if (!(await claimOneTime(env, `${OAUTH_CODE_PREFIX}${body.code}`, grantValue, 600000))) return json({ error: "invalid_grant" }, 400);
          const accessToken = randomToken(40);
          await Promise.all([
            env.SENTINEL_COMMANDS.put(
              `${OAUTH_TOKEN_PREFIX}${accessToken}`,
              installationId,
              { expirationTtl: 31536000 },
            ),
            env.SENTINEL_COMMANDS.delete(`${OAUTH_CODE_PREFIX}${body.code}`),
          ]);
          return json({
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: 31536000,
          });
        }
        if (
          url.pathname === "/installations" &&
          request.method === "GET"
        ) {
          if (!authorised(request, env))
            return json({ error: "Relay owner authorisation required." }, 401);
          const records = [];
          let cursor;
          do {
            const page = await env.SENTINEL_COMMANDS.list({
              prefix: INSTALLATION_PREFIX,
              cursor,
            });
            for (const key of page.keys) {
              const record = await env.SENTINEL_COMMANDS.get(key.name, "json");
              if (record)
                records.push({
                  id: record.id,
                  name: record.name || "Sentinel installation",
                  createdAt: record.createdAt || null,
                });
            }
            cursor = page.list_complete ? undefined : page.cursor;
          } while (cursor);
          records.sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
          );
          return json({ installations: records });
        }
        const installationDeleteMatch = url.pathname.match(
          /^\/installations\/([0-9a-f-]+)$/i,
        );
        if (installationDeleteMatch && request.method === "DELETE") {
          if (!authorised(request, env))
            return json({ error: "Relay owner authorisation required." }, 401);
          const installationId = installationDeleteMatch[1];
          const recordKey = `${INSTALLATION_PREFIX}${installationId}`;
          if (!(await env.SENTINEL_COMMANDS.get(recordKey)))
            return json({ error: "Installation profile not found." }, 404);
          await coordinate(env, "installation:" + installationId, "revoke", { kind: "installation" });
          const keysToDelete = new Set([recordKey]);
          const collectPrefix = async (prefix) => {
            let cursor;
            do {
              const page = await env.SENTINEL_COMMANDS.list({ prefix, cursor });
              page.keys.forEach((key) => keysToDelete.add(key.name));
              cursor = page.list_complete ? undefined : page.cursor;
            } while (cursor);
          };
          await collectPrefix(`i:${installationId}:`);
          for (const prefix of [
            ALEXA_ACCOUNT_PREFIX,
            PAIRING_PREFIX,
            OAUTH_TOKEN_PREFIX,
            OAUTH_CODE_PREFIX,
            LINK_CODE_PREFIX,
          ]) {
            let cursor;
            do {
              const page = await env.SENTINEL_COMMANDS.list({ prefix, cursor });
              for (const key of page.keys) {
                const value = await env.SENTINEL_COMMANDS.get(key.name);
                if (value === installationId) keysToDelete.add(key.name);
              }
              cursor = page.list_complete ? undefined : page.cursor;
            } while (cursor);
          }
          await Promise.all(
            [...keysToDelete].map((key) => env.SENTINEL_COMMANDS.delete(key)),
          );
          return json({ deleted: true, installationId });
        }
        if (
          url.pathname === "/installations/register" &&
          request.method === "POST"
        ) {
          if (!authorised(request, env))
            return json({ error: "Relay owner authorisation required." }, 401);
          const body = await request.json().catch(() => ({}));
          const id = crypto.randomUUID();
          const secret = randomToken(36);
          const pairingPhrase = await createPairingPhrase(env, id);
          const record = {
            id,
            secret,
            name: String(body.name || "Sentinel installation").slice(0, 80),
            createdAt: new Date().toISOString(),
          };
          await Promise.all([
            env.SENTINEL_COMMANDS.put(
              `${INSTALLATION_PREFIX}${id}`,
              JSON.stringify(record),
            ),
          ]);
          return json({
            installationId: id,
            installationSecret: secret,
            pairingPhrase,
            pairingExpiresIn: 900,
          });
        }
        if (
          url.pathname === "/installations/invite" &&
          request.method === "POST"
        ) {
          if (!authorised(request, env))
            return json({ error: "Relay owner authorisation required." }, 401);
          const body = await request.json().catch(() => ({}));
          const inviteCode = randomToken(9).toUpperCase();
          await env.SENTINEL_COMMANDS.put(
            `${INVITE_PREFIX}${inviteCode}`,
            JSON.stringify({
              name: String(body.name || "Sentinel Base").slice(0, 80),
            }),
            { expirationTtl: 604800 },
          );
          return json({ inviteCode, expiresIn: 604800 });
        }
        if (
          url.pathname === "/installations/redeem" &&
          request.method === "POST"
        ) {
          const body = await request.json().catch(() => ({}));
          const key = `${INVITE_PREFIX}${String(body.inviteCode || "")
            .trim()
            .toUpperCase()}`;
          const invite = await env.SENTINEL_COMMANDS.get(key, "json");
          if (!invite)
            return json(
              { error: "Setup code is invalid, expired, or already used." },
              400,
            );
          if (!(await claimOneTime(env, key, JSON.stringify(invite), 604860000))) return json({ error: "Setup code has already been used." }, 409);
          const id = crypto.randomUUID(),
            secret = randomToken(36);
          const pairingPhrase = await createPairingPhrase(env, id);
          await Promise.all([
            env.SENTINEL_COMMANDS.put(
              `${INSTALLATION_PREFIX}${id}`,
              JSON.stringify({
                id,
                secret,
                name: invite.name,
                createdAt: new Date().toISOString(),
              }),
            ),
            env.SENTINEL_COMMANDS.delete(key),
          ]);
          return json({
            installationId: id,
            installationSecret: secret,
            pairingPhrase,
            pairingExpiresIn: 900,
          });
        }
        if (
          url.pathname === "/installations/pair-alexa" &&
          request.method === "POST"
        ) {
          if (!authorised(request, env))
            return json({ error: "Alexa skill authorisation failed." }, 401);
          const body = await request.json().catch(() => ({}));
          const phrase = String(body.pairingPhrase || body.pairingCode || "")
            .toLowerCase()
            .replace(/[^a-z\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          const installationId = await env.SENTINEL_COMMANDS.get(
            `${PAIRING_PREFIX}${phrase}`,
          );
          if (!installationId || !body.userId)
            return json({ error: "Pairing code is invalid or expired." }, 400);
          if (installationId !== "legacy" && !(await env.SENTINEL_COMMANDS.get(`${INSTALLATION_PREFIX}${installationId}`))) return json({ error: "Pairing installation no longer exists." }, 410);
          if (!(await claimOneTime(env, `${PAIRING_PREFIX}${phrase}`, installationId, 960000))) return json({ error: "Pairing code has already been used." }, 409);
          await Promise.all([
            env.SENTINEL_COMMANDS.put(
              `${ALEXA_ACCOUNT_PREFIX}${encodeURIComponent(body.userId)}`,
              installationId,
            ),
            env.SENTINEL_COMMANDS.delete(`${PAIRING_PREFIX}${phrase}`),
          ]);
          return json({ paired: true });
        }
        if (url.pathname === "/privacy")
          return new Response(
            "<h1>Sentinel Privacy Policy</h1><p>Commands are retained only long enough to reach the owner's Sentinel installation.</p>",
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
  
        if (url.pathname === "/hue/callback" && request.method === "GET") {
          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          if (!code || !state)
            return new Response(
              "Sentinel could not complete the Philips Hue connection.",
              { status: 400 },
            );
          await env.SENTINEL_COMMANDS.put(
            `${HUE_OAUTH_PREFIX}${state}`,
            JSON.stringify({ code, receivedAt: Date.now() }),
            { expirationTtl: 600 },
          );
          return new Response(
            "<h1>Philips Hue approval received</h1><p>Return to Sentinel to finish connecting.</p>",
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
  
        if (url.pathname === "/companion" && request.method === "GET") {
          if (!(await companionAuthorised(url, env)))
            return new Response("Invalid companion link.", { status: 401 });
          return new Response(companionPage(url.searchParams.get("key")), {
            headers: {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "no-store",
            },
          });
        }
        if (url.pathname === "/companion/status" && request.method === "GET") {
          const pairedDevice = await companionDeviceAuthorised(request, env);
          if (pairedDevice) {
            const desktop = (await env.SENTINEL_COMMANDS.get(
              installationKey(pairedDevice.installationId, COMPANION_STATUS_KEY),
              "json",
            )) || { online: false };
            return json({ paired: true, workspaceAvailable: true, desktopOnline: Boolean(desktop.online), ...desktop });
          }
          if (!(await companionAuthorised(url, env))) return json({ error: "Invalid companion link." }, 401);
          return json(
            (await env.SENTINEL_COMMANDS.get(
              installationKey(
                url.searchParams.get("installation") || "legacy",
                COMPANION_STATUS_KEY,
              ),
              "json",
            )) || {
              online: false,
            },
          );
        }
        if (url.pathname === "/companion/command" && request.method === "POST") {
          if (!(await companionAuthorised(url, env)))
            return json({ error: "Invalid companion link." }, 401);
          const body = await request.json();
          if (
            typeof body.command !== "string" ||
            !body.command.trim() ||
            body.command.length > 280
          )
            return json({ error: "Enter a short command." }, 400);
          const queued = await queueCommand(env, url.searchParams.get("installation") || "legacy", "companion", {
              id: crypto.randomUUID(),
              source: "companion",
              type: "sentinel.command",
              payload: { command: body.command.trim() },
            });
          return json(queued, 202);
        }
        if (url.pathname === "/companion/pair" && request.method === "POST") {
          if (!(await allowPairAttempt(request, env))) return json({ error: "Too many pairing attempts. Wait a minute and try again." }, 429);
          const body = await request.json().catch(() => ({}));
          const code = String(body.code || "").trim();
          if (!/^\d{6}$/.test(code)) return json({ error: "Enter the six-digit pairing code." }, 400);
          const pairingValue = await env.SENTINEL_COMMANDS.get(`${COMPANION_PAIR_PREFIX}${code}`);
          if (!pairingValue) return json({ error: "Pairing code is invalid or expired." }, 400);
          let pairing; try { pairing = JSON.parse(pairingValue); } catch { pairing = { installationId: pairingValue }; }
          const installationId = pairing.installationId;
          if (!installationId || (installationId !== "legacy" && !(await env.SENTINEL_COMMANDS.get(`${INSTALLATION_PREFIX}${installationId}`)))) return json({ error: "This desktop pairing is no longer available." }, 410);
          // Preflight vault work before atomically claiming the one-time code.
          let vault;
          try { vault = await mobileVault(env, installationId); }
          catch { return json({ error: "Mobile service configuration could not be read. Your pairing code has not been consumed." }, 503); }
          if (!(await claimOneTime(env, `${COMPANION_PAIR_PREFIX}${code}`, pairingValue))) return json({ error: "Pairing code has already been used. Request a new code." }, 409);
          const deviceId = crypto.randomUUID();
          const token = randomToken(32);
          const guard = await coordinate(env, "installation:" + installationId, "guard", { deviceId });
          if (guard.blocked) return json({ error: "This installation is no longer available." }, 410);
          const device = {
            id: deviceId,
            name: String(body.name || "iPhone").trim().slice(0, 60) || "iPhone",
            platform: String(body.platform || "ios").trim().slice(0, 20),
            pairedAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            installationId,
          };
          const pairWrites = await Promise.allSettled([
            env.SENTINEL_COMMANDS.put(installationKey(installationId, `${COMPANION_DEVICE_PREFIX}${deviceId}`), JSON.stringify(device)),
            env.SENTINEL_COMMANDS.put(`${COMPANION_TOKEN_PREFIX}${token}`, JSON.stringify({ installationId, deviceId, pairedEpoch: guard.pairedEpoch, mobileEpoch: guard.mobileEpoch }), { expirationTtl: 31536000 }),
            env.SENTINEL_COMMANDS.delete(`${COMPANION_PAIR_PREFIX}${code}`),
          ]);
          if (pairWrites.some(result => result.status === "rejected")) {
            await coordinate(env, "installation:" + installationId, "revoke", { deviceId, kind: "device" });
            await Promise.allSettled([env.SENTINEL_COMMANDS.delete(installationKey(installationId, `${COMPANION_DEVICE_PREFIX}${deviceId}`)), env.SENTINEL_COMMANDS.delete(`${COMPANION_TOKEN_PREFIX}${token}`)]);
            return json({ error: "Pairing could not be saved. Request a new pairing code." }, 503);
          }
          return json({
            paired: true,
            token,
            installationId,
            deviceId,
            local: pairing.local || null,
            independentAccessAvailable: Boolean(vault),
            availableServices: vault?.services || [],
            permissionVersion: 1,
            device: { ...device, installationId: undefined },
          });
        }
        if (url.pathname === "/companion/mobile-access/enrol" && request.method === "POST") {
          const deviceAuth = await companionDeviceAuthorised(request, env);
          if (!deviceAuth) return json({ error: "This device is not paired." }, 401);
          const vault = await mobileVault(env, deviceAuth.installationId);
          if (!vault) return json({ error: "Independent mobile services have not been enabled in Sentinel Personal." }, 409);
          const body = await request.json().catch(() => ({}));
          const requested = Array.isArray(body.requestedServices) ? body.requestedServices : [];
          const services = [...new Set(requested)].filter((service) => vault.services.includes(service));
          if (!services.length) return json({ error: "Choose at least one available mobile service." }, 400);
          const accessToken = randomToken(32);
          const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
          const permission = { enabled: true, services, permissionVersion: 1, updatedAt: new Date().toISOString() };
          const guard = await coordinate(env, "installation:" + deviceAuth.installationId, "guard", { deviceId: deviceAuth.deviceId });
          await Promise.all([
            env.SENTINEL_COMMANDS.put(installationKey(deviceAuth.installationId, `${MOBILE_PERMISSION_PREFIX}${deviceAuth.deviceId}`), JSON.stringify(permission), { expirationTtl: 90 * 24 * 60 * 60 }),
            env.SENTINEL_COMMANDS.put(`${MOBILE_ACCESS_TOKEN_PREFIX}${accessToken}`, JSON.stringify({ installationId: deviceAuth.installationId, deviceId: deviceAuth.deviceId, expiresAt, pairedEpoch: guard.pairedEpoch, mobileEpoch: guard.mobileEpoch }), { expirationTtl: 90 * 24 * 60 * 60 }),
          ]);
          return json({
            enabled: true,
            services,
            enabledServices: services,
            availableServices: vault.services,
            mobileServiceAccessToken: accessToken,
            accessToken,
            expiresAt: new Date(expiresAt).toISOString(),
            permissionVersion: 1,
          });
        }
        if (url.pathname === "/companion/mobile-access/status" && request.method === "GET") {
          const deviceAuth = await companionDeviceAuthorised(request, env);
          if (deviceAuth) {
            const vault = await mobileVault(env, deviceAuth.installationId);
            const permission = await env.SENTINEL_COMMANDS.get(installationKey(deviceAuth.installationId, `${MOBILE_PERMISSION_PREFIX}${deviceAuth.deviceId}`), "json");
            return json({ configured: Boolean(vault), availableServices: vault?.services || [], permission: permission || null, permissionVersion: 1 });
          }
        }
        if (url.pathname === "/companion/mobile-access/revoke" && request.method === "POST") {
          const deviceAuth = await companionDeviceAuthorised(request, env);
          if (deviceAuth) {
            await coordinate(env, "installation:" + deviceAuth.installationId, "revoke", { deviceId: deviceAuth.deviceId, kind: "mobile" });
            await env.SENTINEL_COMMANDS.delete(installationKey(deviceAuth.installationId, `${MOBILE_PERMISSION_PREFIX}${deviceAuth.deviceId}`));
            const tokens = await env.SENTINEL_COMMANDS.list({ prefix: MOBILE_ACCESS_TOKEN_PREFIX, limit: 1000 });
            await Promise.all(tokens.keys.map(async (key) => { const value = await env.SENTINEL_COMMANDS.get(key.name, "json"); if (value?.installationId === deviceAuth.installationId && value?.deviceId === deviceAuth.deviceId) await env.SENTINEL_COMMANDS.delete(key.name); }));
            return json({ revoked: true });
          }
        }
        if (url.pathname === "/companion/mobile-access/refresh" && request.method === "POST") {
          const auth = await mobileAccessAuthorised(request, env);
          if (!auth) return json({ error: "Independent mobile access is invalid or expired." }, 401);
          const accessToken = randomToken(32);
          const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
          // A refreshed token must not outlive its permission record.
          await env.SENTINEL_COMMANDS.put(installationKey(auth.installationId, `${MOBILE_PERMISSION_PREFIX}${auth.deviceId}`), JSON.stringify(auth.permission), { expirationTtl: 90 * 24 * 60 * 60 });
          await env.SENTINEL_COMMANDS.put(`${MOBILE_ACCESS_TOKEN_PREFIX}${accessToken}`, JSON.stringify({ installationId: auth.installationId, deviceId: auth.deviceId, expiresAt, pairedEpoch: auth.pairedEpoch || 0, mobileEpoch: auth.mobileEpoch || "0:0" }), { expirationTtl: 90 * 24 * 60 * 60 });
          return json({ accessToken, mobileServiceAccessToken: accessToken, expiresAt: new Date(expiresAt).toISOString(), services: auth.permission.services, enabledServices: auth.permission.services, permissionVersion: auth.permission.permissionVersion || 1 });
        }
        if (url.pathname === "/mobile/services/status" && request.method === "GET") {
          const auth = await mobileAccessAuthorised(request, env);
          if (!auth) return json({ error: "Mobile access has expired. Reconnect or refresh Mobile Service Access.", code: "mobile_access_expired", retryable: false }, 401);
          const vault = await mobileVault(env, auth.installationId);
          if (!vault) return json({ error: "Independent mobile services are no longer configured in Sentinel Personal.", code: "mobile_vault_missing", retryable: false }, 409);
          const permitted = Array.isArray(auth.permission?.services) ? auth.permission.services : [];
          const desktop = await env.SENTINEL_COMMANDS.get(installationKey(auth.installationId, COMPANION_STATUS_KEY), "json");
          const desktopOnline = Boolean(desktop?.online);
          const services = Object.fromEntries(MOBILE_SERVICES.map((service) => {
            const configured = Boolean(vault?.credentials?.[service]);
            const allowed = permitted.includes(service);
            return [service, { permitted: allowed, configured, available: allowed && configured }];
          }));
          return json({
            online: true,
            platform: "ios",
            serverTime: new Date().toISOString(),
            profile: SENTINEL_ASSISTANT_PROFILE,
            permissionVersion: auth.permission.permissionVersion || 1,
            tokenExpiresAt: auth.expiresAt ? new Date(Number(auth.expiresAt)).toISOString() : null,
            services,
            capabilities: {
              structuredChat: services.chat.available,
              liveTalk: services.chat.available,
              weather: services.weather.available,
              navigation: services.navigation.available,
              flightStatus: services.aviation.available,
              liveAircraft: services.aircraft.available,
              companionSync: true,
              desktopOnline,
              desktopActions: desktopOnline,
              cameraRequests: desktopOnline,
              smartHomeRequests: desktopOnline,
            },
          });
        }
        if (url.pathname.startsWith("/mobile/desktop/commands/") && request.method === "GET") {
          const auth = await mobileAccessAuthorised(request, env);
          if (!auth) return json({ error: "mobile_access_expired" }, 401);
          if (!auth.permission.services.includes("chat")) return json({ error: "desktop_control_denied" }, 403);
          const id = url.pathname.slice("/mobile/desktop/commands/".length);
          return json(await coordinate(env, "installation:" + auth.installationId, "result", { channel: "companion", id, deviceId: auth.deviceId }));
        }
        if (url.pathname === "/mobile/desktop/action" && request.method === "POST") {
          const auth = await mobileAccessAuthorised(request, env);
          if (!auth) return json({ error: "mobile_access_expired", message: "Mobile access has expired. Reconnect or refresh Mobile Service Access.", retryable: false }, 401);
          if (!auth.permission.services.includes("chat")) return json({ error: "desktop_control_denied", message: "Chat control is not enabled for this iPhone.", retryable: false }, 403);
          if (!(await enforceMobileRateLimit(env, auth, "desktop-action"))) return json({ error: "desktop_action_rate_limit", message: "Desktop action limit reached. Try again shortly.", retryable: true }, 429);
          const desktop = await env.SENTINEL_COMMANDS.get(installationKey(auth.installationId, COMPANION_STATUS_KEY), "json");
          if (!desktop?.online) return json({ error: "desktop_offline", message: "Sentinel Personal is currently offline. This action needs the paired desktop.", retryable: true }, 409);
          const body = await request.json().catch(() => ({}));
          const action = String(body.action || "").trim().toLowerCase();
          const allowedActions = new Set(["system_check", "security_status", "camera_view", "smart_home_control", "open_page"]);
          if (!allowedActions.has(action)) return json({ error: "unsupported_desktop_action", message: "This desktop action is not supported.", retryable: false }, 400);
          const command = String(body.command || "").trim().replace(/[\r\n]+/g, " ").slice(0, 280);
          const target = String(body.target || "").trim().replace(/[\r\n]+/g, " ").slice(0, 120);
          if (!command) return json({ error: "desktop_command_missing", message: "Enter a valid Sentinel command.", retryable: false }, 400);
          if (["camera_view", "smart_home_control", "open_page"].includes(action) && !target) return json({ error: "desktop_command_missing", message: "Choose a target for this Sentinel action.", retryable: false }, 400);
          const requiresApproval = action === "smart_home_control";
          if (requiresApproval && body.approved !== true) return json({ error: "approval_required", message: "Explicit approval is required before changing a smart-home device.", retryable: false, requiresApproval: true }, 409);
          const safeCommand = safeMobileDesktopCommand(action, command, target);
          if (!safeCommand) return json({ error: "unsupported_desktop_action", message: "Use one on/off command matching the approved target. Other controls are not supported by this bridge yet.", retryable: false }, 400);
          if (body.requestId !== undefined && (typeof body.requestId !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(body.requestId))) return json({ error: "Invalid request ID." }, 400);
          const commandId = body.requestId ? `mobile:${auth.deviceId}:${body.requestId}` : crypto.randomUUID();
          const queued = await queueCommand(env, auth.installationId, "companion", { id: commandId, source: "sentinel-ios", type: "sentinel.command", accessEpoch: auth.mobileEpoch || "0:0", pairedEpoch: auth.pairedEpoch || 0, payload: { action, command: safeCommand, target, approved: body.approved === true, deviceId: auth.deviceId } });
          return json({ ...queued, action, requiresDesktop: true, message: queued.completed ? "The desktop confirmed this command completed." : "Sentinel Personal accepted the request. Completion has not yet been confirmed." }, 202);
        }
        if (url.pathname === "/mobile/services/live-chat/session" && request.method === "POST") {
          const auth = await mobileAccessAuthorised(request, env);
          if (!auth) return json({ error: "Mobile access has expired. Reconnect or refresh Mobile Service Access." }, 401);
          if (!auth.permission.services.includes("chat")) return json({ error: "Chat access is not enabled for this iPhone." }, 403);
          if (!(await enforceMobileLiveSessionLimit(env, auth))) return json({ error: "Live conversation limit reached. Try again shortly." }, 429);

          const vault = await mobileVault(env, auth.installationId);
          const apiKey = String(vault?.credentials?.chat?.apiKey || "");
          if (apiKey.length < 20) return json({ error: "Chat credentials are no longer configured in Sentinel Personal." }, 409);

          const body = await request.json().catch(() => ({}));
          if (String(body.platform || "ios").toLowerCase() !== "ios") return json({ error: "This live conversation endpoint is for Sentinel iOS." }, 400);
          const conversationId = safeConversationId(body.conversationId);
          const voice = safeLiveVoice(body.voice);
          const requestedServices = [...new Set(Array.isArray(body.enabledServices) ? body.enabledServices : [])]
            .filter((service) => MOBILE_SERVICES.includes(service) && auth.permission.services.includes(service));
          if (!requestedServices.includes("chat")) requestedServices.unshift("chat");

          const sessionInstructions = `${SENTINEL_MOBILE_PROMPT}\n\nYou are in Talk with Sentinel, a natural real-time speech conversation. Listen carefully, respond conversationally and briefly, and allow interruption. Never speak secrets, passwords, API keys, access tokens, pairing codes or developer credentials. Use the use_sentinel tool whenever live weather, directions, places, flight information, or opening a Sentinel page is requested. Never claim a tool action succeeded until its verified result is returned. Enabled services for this device: ${requestedServices.join(", ")}.`;
          const realtime = await providerJson("https://api.openai.com/v1/realtime/client_secrets", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              session: {
                type: "realtime",
                model: "gpt-realtime",
                instructions: sessionInstructions,
                output_modalities: ["audio"],
                max_output_tokens: 1200,
                audio: {
                  input: {
                    noise_reduction: { type: "near_field" },
                    transcription: { model: "gpt-4o-mini-transcribe", language: "en" },
                    turn_detection: { type: "semantic_vad", eagerness: "auto", create_response: true, interrupt_response: true },
                  },
                  output: { voice },
                },
                tools: [{
                  type: "function",
                  name: "use_sentinel",
                  description: "Request verified weather, navigation/place, aviation information, or open a page in Sentinel iOS.",
                  parameters: {
                    type: "object",
                    additionalProperties: false,
                    required: ["service", "query"],
                    properties: {
                      service: { type: "string", enum: ["weather", "navigation", "aviation", "page"] },
                      query: { type: "string", minLength: 1, maxLength: 180 },
                    },
                  },
                }],
                tool_choice: "auto",
              },
            }),
          });
          const ephemeralToken = String(realtime?.value || realtime?.client_secret?.value || "");
          const providerExpiry = Number(realtime?.expires_at || realtime?.client_secret?.expires_at || 0);
          if (!ephemeralToken) return json({ error: "The realtime voice provider returned no session credential." }, 502);

          const sessionId = String(realtime?.session?.id || `sentinel-live-${crypto.randomUUID()}`).slice(0, 160);
          const sessionEndsAt = Date.now() + MOBILE_LIVE_SESSION_SECONDS * 1000;
          await env.SENTINEL_COMMANDS.put(`${MOBILE_LIVE_SESSION_PREFIX}${sessionId}`, JSON.stringify({
            installationId: auth.installationId,
            deviceId: auth.deviceId,
            conversationId,
            services: requestedServices,
            context: mobileChatInput({ prompt: "live session", context: body.context })?.safeContext || {},
            createdAt: new Date().toISOString(),
            expiresAt: sessionEndsAt,
          }), { expirationTtl: MOBILE_LIVE_SESSION_SECONDS });

          return json({
            sessionId,
            transport: "webrtc",
            webrtcOfferUrl: "https://api.openai.com/v1/realtime/calls",
            dataChannel: "oai-events",
            ephemeralToken,
            expiresAt: new Date((providerExpiry > 0 ? providerExpiry * 1000 : Date.now() + 60_000)).toISOString(),
            sessionEndsAt: new Date(sessionEndsAt).toISOString(),
            maxDurationSeconds: MOBILE_LIVE_SESSION_SECONDS,
            profile: SENTINEL_ASSISTANT_PROFILE,
            conversationId,
            enabledServices: requestedServices,
            voice,
          });
        }
        if (url.pathname === "/mobile/services/live-chat/tool" && request.method === "POST") {
          const auth = await mobileAccessAuthorised(request, env);
          if (!auth) return json({ error: "Mobile access has expired. End this conversation and reconnect." }, 401);
          if (!auth.permission.services.includes("chat")) return json({ error: "Chat access is not enabled for this iPhone." }, 403);
          if (!(await enforceMobileRateLimit(env, auth, "live-tool"))) return json({ error: "Live tool request limit reached. Try again shortly." }, 429);
          const body = await request.json().catch(() => ({}));
          const sessionId = String(body.sessionId || "");
          const session = sessionId ? await env.SENTINEL_COMMANDS.get(`${MOBILE_LIVE_SESSION_PREFIX}${sessionId}`, "json") : null;
          if (!session || session.installationId !== auth.installationId || session.deviceId !== auth.deviceId || Date.now() > Number(session.expiresAt || 0)) return json({ error: "This live conversation has ended. Reconnect to continue." }, 401);
          const service = String(body.service || "");
          const query = String(body.query || "").trim().slice(0, 180);
          if (!query || !["weather", "navigation", "aviation", "page"].includes(service)) return json({ error: "Enter a supported live Sentinel request." }, 400);
          if (service === "page") {
            const page = mobilePageRequest({ messages: [{ role: "user", content: `open ${query}` }] });
            if (!page) return json({ error: "That Sentinel page is not available." }, 400);
            return json({ ok: true, service, status: "completed", verifiedAt: new Date().toISOString(), result: { service, verified: true, page } });
          }
          if (!session.services.includes(service) || !auth.permission.services.includes(service)) return json({ error: `${service} access is not enabled for this iPhone.` }, 403);
          const vault = await mobileVault(env, auth.installationId);
          const credentials = vault?.credentials?.[service];
          if (!credentials) return json({ error: `${service} credentials are no longer configured in Sentinel Personal.` }, 409);
          try {
            const context = mobileChatInput({ prompt: "live tool", context: body.context || session.context })?.safeContext || {};
            const result = await executeAssistantTool(service, query, credentials, { ...context, platform: "ios", enabledServices: session.services });
            return json({ ok: true, service, status: "completed", verifiedAt: new Date().toISOString(), result });
          } catch (error) {
            return serviceErrorResponse(error);
          }
        }
        if (url.pathname.startsWith("/mobile/services/") && request.method !== "OPTIONS") {
          const auth = await mobileAccessAuthorised(request, env);
          if (!auth) return json({ error: "Independent mobile access is invalid or expired." }, 401);
          const service = url.pathname.split("/")[3];
          if (!MOBILE_SERVICES.includes(service) || !auth.permission.services.includes(service)) return json({ error: "This service is not permitted for this iPhone." }, 403);
          const expectedMethod = service === "chat" ? "POST" : "GET";
          if (request.method !== expectedMethod) return json({ error: `${service} requires ${expectedMethod}.` }, 405);
          if (!(await enforceMobileRateLimit(env, auth, service))) return json({ error: "Mobile service rate limit reached. Try again shortly." }, 429);
          if (/^\/mobile\/services\/weather\/radar\/?$/.test(url.pathname)) {
            const radarCache = caches.default;
            const radarCacheKey = new Request(`${url.origin}/__sentinel-cache/weather/radar`, { method: "GET" });
            const cachedRadar = await radarCache.match(radarCacheKey);
            if (cachedRadar) return cachedRadar;
            const currentHour = new Date();
            currentHour.setUTCMinutes(0, 0, 0);
            const frames = Array.from({ length: 7 }, (_, offset) => {
              const frameDate = new Date(currentHour.getTime() + offset * 60 * 60 * 1000);
              const dateHour = [
                frameDate.getUTCFullYear(),
                String(frameDate.getUTCMonth() + 1).padStart(2, "0"),
                String(frameDate.getUTCDate()).padStart(2, "0"),
                String(frameDate.getUTCHours()).padStart(2, "0"),
              ].join("");
              const time = Math.floor(frameDate.getTime() / 1000);
              return {
                id: String(time),
                time,
                timestamp: frameDate.toISOString(),
                forecast: offset > 0,
                status: offset > 0 ? "Forecast" : "Current",
                tileTemplate: `https://weathermaps.weatherapi.com/precip/tiles/${dateHour}/{z}/{x}/{y}.png`,
              };
            });
            const radarResponse = new Response(JSON.stringify({
              provider: "WeatherAPI",
              attribution: "Weather map data \u00a9 WeatherAPI.com",
              generatedAt: new Date().toISOString(),
              tileSize: 256,
              smooth: true,
              snow: true,
              currentFrameId: frames[0].id,
              forecastHours: 6,
              frames,
            }), { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, max-age=300" } });
            await radarCache.put(radarCacheKey, radarResponse.clone());
            return radarResponse;
          }
          if (url.pathname !== `/mobile/services/${service}`) return json({ error: "Unknown mobile service endpoint." }, 404);
          const vault = await mobileVault(env, auth.installationId);
          const credentials = vault?.credentials?.[service];
          if (!credentials) return json({ error: "The service credentials are no longer configured in Sentinel Personal." }, 409);
          const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
          let target;
          let init = { method: "GET", headers: {} };
          if (service === "chat") {
            const chat = mobileChatInput(body);
            if (!chat) return json({ error: "Enter a valid chat message." }, 400);
            const requestedPage = mobilePageRequest(chat);
            if (requestedPage) {
              const content = `Opening ${requestedPage === "home" ? "Home" : requestedPage.charAt(0).toUpperCase() + requestedPage.slice(1)}.`;
              const conversationId = String(body.conversationId || crypto.randomUUID()).slice(0, 128);
              return json({ profile: SENTINEL_ASSISTANT_PROFILE, conversationId, title: null, summary: null, message: { id: crypto.randomUUID(), role: "assistant", content, createdAt: new Date().toISOString() }, actions: [{ id: `page-${crypto.randomUUID()}`, type: "open_page", label: content, page: requestedPage }], cards: [], toolActivity: [{ service: "chat", status: "completed", label: "Page selected" }], output_text: content, verifiedAt: new Date().toISOString() });
            }
            const imagePrompt = mobileImageRequest(chat);
            if (imagePrompt) {
              try {
                const image = await generateMobileImage(credentials.apiKey, imagePrompt);
                const content = "I generated your image. You can open it full size, share it, or save it from this conversation.";
                const conversationId = String(body.conversationId || crypto.randomUUID()).slice(0, 128);
                return json({
                  profile: SENTINEL_ASSISTANT_PROFILE,
                  conversationId,
                  title: "Generated image",
                  summary: imagePrompt.slice(0, 240),
                  message: { id: crypto.randomUUID(), role: "assistant", content, createdAt: new Date().toISOString() },
                  images: [image],
                  actions: [],
                  cards: [],
                  toolActivity: [{ service: "chat", status: "completed", label: "Image generated" }],
                  output_text: content,
                  verifiedAt: new Date().toISOString(),
                });
              } catch (error) {
                return serviceErrorResponse(error);
              }
            }
            const instantReply = instantMobileChatReply(chat);
            if (instantReply) {
              const conversationId = String(body.conversationId || crypto.randomUUID()).slice(0, 128);
              return json({
                profile: SENTINEL_ASSISTANT_PROFILE,
                conversationId,
                title: null,
                summary: null,
                message: { id: crypto.randomUUID(), role: "assistant", content: instantReply, createdAt: new Date().toISOString() },
                actions: [],
                cards: [],
                toolActivity: [],
                output_text: instantReply,
                verifiedAt: null,
              });
            }
            if (isCurrentLocationQuestion(chat)) {
              const conversationId = String(body.conversationId || crypto.randomUUID()).slice(0, 128);
              const location = chat.safeContext.location;
              let content = "Location access is not currently available on this iPhone. Check Sentinel's location permission in iOS Settings.";
              let verifiedAt = null;
              const toolActivity = [];
              if (location) {
                content = "Your location is available, but I couldn't resolve the local place name just now.";
                const weatherCredentials = vault?.credentials?.weather;
                if (auth.permission.services.includes("weather") && weatherCredentials?.apiKey) {
                  try {
                    const response = await fetchWithTimeout(`https://api.weatherapi.com/v1/current.json?key=${encodeURIComponent(weatherCredentials.apiKey)}&q=${encodeURIComponent(`${location.latitude},${location.longitude}`)}&aqi=no`, {}, 5000);
                    if (!response.ok) throw new Error(`Location lookup returned ${response.status}.`);
                    const value = await response.json();
                    const place = [value?.location?.name, value?.location?.region, value?.location?.country].filter(Boolean).join(", ");
                    if (place) {
                      content = `You're currently near ${place}.`;
                      verifiedAt = new Date().toISOString();
                      toolActivity.push({ service: "weather", status: "completed", label: "Location verified" });
                    }
                  } catch (error) {
                    toolActivity.push({ service: "weather", status: "failed", label: "Place name temporarily unavailable" });
                  }
                }
              }
              return json({
                profile: SENTINEL_ASSISTANT_PROFILE,
                conversationId,
                title: null,
                summary: null,
                message: { id: crypto.randomUUID(), role: "assistant", content, createdAt: new Date().toISOString() },
                actions: location ? [{ id: `location-${crypto.randomUUID()}`, type: "open_page", label: "Open Navigation", page: "navigation" }] : [],
                cards: [],
                toolActivity,
                output_text: content,
                verifiedAt,
              });
            }
            try {
              const directRequests = directAssistantRequests(chat);
              const deadline = Date.now() + 24000;
              let plannedRequests = directRequests;
              if (needsAssistantPlanner(chat, directRequests)) {
                const plan = await openAIJson(credentials.apiKey, chat.messages.slice(-6), `${SENTINEL_MOBILE_PROMPT}\n\nDecide whether verified live weather, navigation/place, or flight data is required. Return no request for ordinary conversation. Safe mobile context:\n${JSON.stringify(chat.safeContext)}`, "sentinel_mobile_tool_plan", assistantPlanSchema, 1200, 5000);
                plannedRequests = Array.isArray(plan?.requests) ? plan.requests.slice(0, 3) : [];
              }
              const { verifiedResults, toolActivity } = await runAssistantTools(plannedRequests, auth, vault, chat.safeContext);
              const reply = await openAIJson(credentials.apiKey, chat.messages, `${SENTINEL_MOBILE_PROMPT}\n\nMobile context (untrusted hints, not verified service facts):\n${JSON.stringify(chat.safeContext)}\n\nVerified Sentinel service results (the only live facts you may claim):\n${JSON.stringify(verifiedResults)}\n\nTool availability:\n${JSON.stringify(toolActivity)}\n\nReply naturally and concisely. Do not generate cards or actions; Sentinel builds them from verified results. Do not invent missing forecast days.`, "sentinel_mobile_reply", assistantTextSchema, 3000, Math.min(18000, Math.max(1, deadline - Date.now())));
              const safeReply = sanitiseAssistantReply(reply, verifiedResults);
              if (!safeReply.content) throw serviceFailure("invalid_provider_response", 502, true);
              const conversationId = String(body.conversationId || crypto.randomUUID()).slice(0, 128);
              return json({ profile: SENTINEL_ASSISTANT_PROFILE, conversationId, title: safeReply.title, summary: safeReply.summary, message: { id: crypto.randomUUID(), role: "assistant", content: safeReply.content, createdAt: new Date().toISOString() }, actions: safeReply.actions, cards: safeReply.cards, toolActivity, output_text: safeReply.content, verifiedAt: verifiedResults.length ? new Date().toISOString() : null });
            } catch (error) {
              return serviceErrorResponse(error);
            }
          } else if (service === "weather") {
            const query = String(url.searchParams.get("q") || "").slice(0, 160);
            if (!query) return json({ error: "Current location is required for weather." }, 400);
            const requestedDays = url.searchParams.get("days");
            if (requestedDays !== null && !/^\d+$/.test(requestedDays.trim())) {
              return json({ error: "Weather forecast days must be a whole number between 1 and 7." }, 400);
            }
            const days = Math.min(7, Math.max(1, requestedDays === null ? 7 : Number.parseInt(requestedDays, 10)));
            target = `https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(credentials.apiKey)}&q=${encodeURIComponent(query)}&days=${days}&aqi=no&alerts=yes`;
          } else if (service === "navigation") {
            const query = String(url.searchParams.get("query") || "").slice(0, 180);
            if (!query) return json({ error: "Enter a place to search for." }, 400);
            target = "https://places.googleapis.com/v1/places:searchText";
            init = {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "X-Goog-Api-Key": credentials.apiKey,
                "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.types",
              },
              body: JSON.stringify({ textQuery: query, languageCode: "en-GB", regionCode: "GB", maxResultCount: 20 }),
            };
          } else if (service === "aviation") {
            const flight = String(url.searchParams.get("flight") || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
            if (!flight) return json({ error: "Enter a valid flight number." }, 400);
            target = `https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(credentials.apiKey)}&flight_iata=${encodeURIComponent(flight)}`;
          } else {
            const token = await providerJson("https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: credentials.clientId, client_secret: credentials.clientSecret }) });
            if (typeof token?.access_token !== "string" || !token.access_token) throw serviceFailure("invalid_provider_response", 502, true);
            target = "https://opensky-network.org/api/states/all";
            init = { method: "GET", headers: { Authorization: `Bearer ${token.access_token}` } };
          }
          const upstream = await fetchWithTimeout(target, init);
          const responseText = await upstream.text();
          let decoded;
          try { decoded = JSON.parse(responseText); } catch { throw serviceFailure("invalid_provider_response", 502, true); }
          if (!decoded || typeof decoded !== "object" || Array.isArray(decoded) || decoded.error) throw serviceFailure("invalid_provider_response", 502, true);
          if (service === "navigation") {
            if (decoded.places !== undefined && !Array.isArray(decoded.places)) throw serviceFailure("invalid_provider_response", 502, true);
            const results = (Array.isArray(decoded.places) ? decoded.places : []).map((place) => ({
              name: place.displayName?.text || "Unknown place",
              formatted_address: place.formattedAddress || "",
              geometry: { location: { lat: place.location?.latitude, lng: place.location?.longitude } },
              rating: place.rating,
              user_ratings_total: place.userRatingCount,
              opening_hours: typeof place.currentOpeningHours?.openNow === "boolean" ? { open_now: place.currentOpeningHours.openNow } : undefined,
              place_id: place.id,
              types: Array.isArray(place.types) ? place.types : [],
            }));
            return json({ status: "OK", results });
          }
          return new Response(responseText, { status: 200, headers: { "content-type": upstream.headers.get("content-type") || "application/json", "cache-control": "no-store" } });
        }
        const isClipboardPath =
          url.pathname === "/clipboard" ||
          url.pathname === "/companion/clipboard" ||
          url.pathname === "/companion/sync/clipboard";
        const isDeviceWorkspacePath =
          url.pathname === "/status" ||
          url.pathname === "/companion/status" ||
          isClipboardPath ||
          url.pathname === "/files" ||
          url.pathname.startsWith("/files/") ||
          url.pathname === "/companion/sync/status";
        if (isDeviceWorkspacePath && request.method !== "OPTIONS") {
          const deviceAuth = await companionDeviceAuthorised(request, env);
          if (!deviceAuth) return json({ error: "This device is not paired." }, 401);
          const prefix = installationKey(deviceAuth.installationId, COMPANION_ITEM_PREFIX);
          if (url.pathname === "/status" || url.pathname === "/companion/status" || url.pathname === "/companion/sync/status") {
            const desktop = (await env.SENTINEL_COMMANDS.get(
              installationKey(deviceAuth.installationId, COMPANION_STATUS_KEY),
              "json",
            )) || { online: false };
            return json({
              paired: true,
              workspaceAvailable: true,
              desktopOnline: Boolean(desktop.online),
              ...desktop,
            });
          }
          if (isClipboardPath && request.method === "GET") {
            const textItems = (await listCompanionItems(env, prefix))
              .filter((item) => item.kind === "text")
              .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
            const latest =
              textItems.find((item) => item.sourceDeviceId === "desktop") ||
              textItems[0] ||
              null;
            const latestText = String(latest?.text || "");
            return json({
              items: textItems,
              item: latest,
              text: latestText,
              clipboard: latestText,
              value: latestText,
              message: latestText,
              sourceName: latest?.sourceName || "",
              updatedAt: latest?.createdAt || null,
              available: Boolean(latest),
            });
          }
          if (isClipboardPath && request.method === "POST") {
            const body = await request.json();
            const text = String(body.text || "").trim();
            if (!text) return json({ error: "Enter some text to share." }, 400);
            const id = crypto.randomUUID();
            await putCompanionItem(env, prefix, {
              id,
              kind: "text",
              text,
              sourceName: body.sourceName || "Sentinel iPhone",
              sourceDeviceId: deviceAuth.deviceId,
              createdAt: new Date().toISOString(),
            });
            return json({ queued: true, id });
          }
          if (url.pathname === "/files" && request.method === "GET") {
            const items = await listCompanionItems(env, prefix);
            return json({ items: items.filter((item) => item.kind === "file") });
          }
          if (url.pathname === "/files" && request.method === "POST") {
            const body = await request.json();
            const id = validCompanionItemId(body.id) ? body.id : crypto.randomUUID();
            const item = {
              ...body,
              id,
              kind: "file",
              sourceName: body.sourceName || "Sentinel iPhone",
              sourceDeviceId: deviceAuth.deviceId,
              createdAt: new Date().toISOString(),
            };
            try { await putCompanionItem(env, prefix, item); }
            catch (error) { return json({ error: error.message }, error.status || 500); }
            return json({ queued: true, id });
          }
          const fileId = decodeURIComponent(url.pathname.slice("/files/".length));
          if (url.pathname.startsWith("/files/") && request.method === "GET") {
            const item = await getCompanionItem(env, prefix, fileId);
            return item ? json(item) : json({ error: "Shared file not found." }, 404);
          }
          if (url.pathname.startsWith("/files/") && request.method === "DELETE") {
            await deleteCompanionItem(env, prefix, fileId);
            return json({ deleted: true });
          }
        }
        if (url.pathname.startsWith("/companion/sync/") && request.method !== "OPTIONS") {
          const deviceAuth = await companionDeviceAuthorised(request, env);
          if (!deviceAuth) return json({ error: "This device is not paired." }, 401);
          const prefix = installationKey(deviceAuth.installationId, COMPANION_ITEM_PREFIX);
          if (url.pathname === "/companion/sync/items" && request.method === "GET") {
            return json({ items: await listCompanionItems(env, prefix) });
          }
          if (url.pathname === "/companion/sync/items" && request.method === "POST") {
            const body = await request.json();
            const id = validCompanionItemId(body.id) ? body.id : crypto.randomUUID();
            const item = { ...body, id, sourceDeviceId: deviceAuth.deviceId, createdAt: new Date().toISOString() };
            try { await putCompanionItem(env, prefix, item); } catch (error) { return json({ error: error.message }, error.status || 500); }
            return json({ queued: true, id });
          }
          const itemId = decodeURIComponent(url.pathname.slice("/companion/sync/items/".length));
          const itemKey = `${prefix}${itemId}`;
          if (url.pathname.startsWith("/companion/sync/items/") && request.method === "GET") {
            const item = await getCompanionItem(env, prefix, itemId);
            return item ? json(item) : json({ error: "Shared item not found." }, 404);
          }
          if (url.pathname.startsWith("/companion/sync/items/") && request.method === "DELETE") {
            await deleteCompanionItem(env, prefix, itemId); return json({ deleted: true });
          }
        }
  
        const installation = await installationAuthorised(request, env);
        const oauthScope = await oauthInstallation(request, env);
        const legacyAuthorised = authorised(request, env);
        if (oauthScope && !(request.method === "POST" && ["/dispatch", "/alexa/devices/register"].includes(url.pathname))) return json({ error: "This credential is restricted to Alexa commands and registration." }, 403);
        if (!installation && !legacyAuthorised && !oauthScope)
          return new Response("Unauthorised", { status: 401 });
        const scope = installation?.id || oauthScope || "legacy";
        if (
          url.pathname === "/installations/alexa-link-code" &&
          request.method === "POST"
        ) {
          if (!installation)
            return json({ error: "An isolated installation is required." }, 400);
          const linkCode = randomToken(8).toUpperCase();
          await env.SENTINEL_COMMANDS.put(
            `${LINK_CODE_PREFIX}${linkCode}`,
            installation.id,
            { expirationTtl: 900 },
          );
          return json({ linkCode, expiresIn: 900 });
        }
        if (
          url.pathname === "/installations/pairing" &&
          request.method === "POST"
        ) {
          if (!installation)
            return json({ error: "An isolated installation is required." }, 400);
          const pairingPhrase = await createPairingPhrase(env, installation.id);
          return json({ pairingPhrase, pairingExpiresIn: 900 });
        }
  
        if (url.pathname === "/hue/poll" && request.method === "GET") {
          const state = url.searchParams.get("state");
          if (!state) return json({ error: "Missing OAuth state." }, 400);
          const key = `${HUE_OAUTH_PREFIX}${state}`;
          const result = await env.SENTINEL_COMMANDS.get(key, "json");
          if (result) await env.SENTINEL_COMMANDS.delete(key);
          return json({ result });
        }
        if (url.pathname === "/dispatch" && request.method === "POST") {
          const command = await request.json();
          if (!command.id || !command.source || !command.type)
            return json({ error: "Invalid command" }, 400);
          if (oauthScope && (command.source !== "alexa" || command.type !== "sentinel.command" || typeof command.payload?.command !== "string" || command.payload.command.length > 280)) return json({ error: "Unsupported Alexa command." }, 400);
          const alexaScope =
            oauthScope ||
            (command.source === "alexa"
              ? await alexaInstallation(command.payload?.userId, env)
              : null);
          if (installation && alexaScope && alexaScope !== installation.id) return json({ error: "Command destination does not belong to this installation." }, 403);
          const destination = installation?.id || oauthScope || alexaScope || (legacyAuthorised && command.source !== "alexa" ? "legacy" : null);
          if (command.source === "alexa" && !destination)
            return json(
              { error: "Alexa is not paired with a Sentinel installation." },
              409,
            );
          return json(await queueCommand(env, destination, "relay", command), 202);
        }
        if (
          url.pathname === "/alexa/devices/register" &&
          request.method === "POST"
        ) {
          const body = await request.json();
          if (typeof body.deviceId !== "string" || body.deviceId.length < 8)
            return json({ error: "Invalid Alexa device." }, 400);
          const alexaScope =
            oauthScope || (await alexaInstallation(body.userId, env));
          if (installation && alexaScope && alexaScope !== installation.id) return json({ error: "Device destination does not belong to this installation." }, 403);
          const destination = alexaScope || (installation ? scope : null);
          if (!destination)
            return json({ error: "Alexa is not paired with Sentinel." }, 409);
          const key = installationKey(
            destination,
            `${ALEXA_DEVICE_PREFIX}${body.deviceId}`,
          );
          const existing = (await env.SENTINEL_COMMANDS.get(key, "json")) || {};
          const interfaces = Array.isArray(body.supportedInterfaces)
            ? body.supportedInterfaces
                .filter((value) => typeof value === "string")
                .slice(0, 30)
            : [];
          const device = {
            deviceId: body.deviceId,
            name: existing.name || "",
            supportedInterfaces: interfaces,
            firstSeenAt: existing.firstSeenAt || new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
          };
          await env.SENTINEL_COMMANDS.put(key, JSON.stringify(device));
          return json({ registered: true });
        }
        if (url.pathname === "/alexa/devices" && request.method === "GET") {
          const keys = await env.SENTINEL_COMMANDS.list({
            prefix: installationKey(scope, ALEXA_DEVICE_PREFIX),
            limit: 100,
          });
          const devices = (
            await Promise.all(
              keys.keys.map((key) => env.SENTINEL_COMMANDS.get(key.name, "json")),
            )
          ).filter(Boolean);
          return json({ devices });
        }
        if (
          url.pathname.startsWith("/alexa/devices/") &&
          request.method === "PATCH"
        ) {
          const deviceId = decodeURIComponent(
            url.pathname.slice("/alexa/devices/".length),
          );
          const key = installationKey(scope, `${ALEXA_DEVICE_PREFIX}${deviceId}`);
          const existing = await env.SENTINEL_COMMANDS.get(key, "json");
          if (!existing) return json({ error: "Alexa device not found." }, 404);
          const body = await request.json();
          const name =
            typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
          await env.SENTINEL_COMMANDS.put(
            key,
            JSON.stringify({ ...existing, name }),
          );
          return json({ renamed: true, name });
        }
        if (
          url.pathname.startsWith("/alexa/devices/") &&
          request.method === "DELETE"
        ) {
          const deviceId = decodeURIComponent(
            url.pathname.slice("/alexa/devices/".length),
          );
          await env.SENTINEL_COMMANDS.delete(
            installationKey(scope, `${ALEXA_DEVICE_PREFIX}${deviceId}`),
          );
          return json({ forgotten: true });
        }
        if (url.pathname === "/poll" && request.method === "POST") {
          return pollCommand(request, env, scope, "relay", COMMAND_KEY);
        }
        if (["/commands/start", "/commands/ack", "/companion/commands/start", "/companion/commands/ack"].includes(url.pathname) && request.method === "POST") {
          const body = await request.json().catch(() => ({}));
          const channel = url.pathname.startsWith("/companion/") ? "companion" : "relay";
          return json(await coordinate(env, "installation:" + scope, url.pathname.endsWith("/start") ? "start" : "ack", { channel, id: body.commandId, leaseToken: body.leaseToken, outcome: body.outcome }));
        }
        if (url.pathname === "/companion/mobile-access/status" && request.method === "GET") {
          const vault = await mobileVault(env, scope);
          return json({
            configured: Boolean(vault),
            permissionVersion: Number(vault?.permissionVersion || 1),
            provisionedServices: vault?.services || [],
            updatedAt: vault?.updatedAt,
          });
        }
        if (url.pathname === "/companion/mobile-access/provision" && request.method === "POST") {
          if (!installation && !legacyAuthorised) return json({ error: "Installation authentication is required." }, 401);
          const body = await request.json().catch(() => ({}));
          const services = [...new Set(Array.isArray(body.services) ? body.services : [])].filter((service) => MOBILE_SERVICES.includes(service));
          if (!services.length) return json({ error: "Choose at least one supported service." }, 400);
          const credentials = {};
          for (const service of services) {
            const value = body.credentials?.[service];
            if (!value || typeof value !== "object" || !Object.values(value).every((entry) => typeof entry === "string" && entry.length >= 8)) return json({ error: `${service} credentials are incomplete.` }, 400);
            credentials[service] = value;
          }
          const updatedAt = new Date().toISOString();
          const encrypted = await encryptVault(env, { services, credentials, permissionVersion: 1, updatedAt });
          encrypted.services = services;
          await env.SENTINEL_COMMANDS.put(installationKey(scope, MOBILE_VAULT_KEY), JSON.stringify(encrypted));
          return json({ configured: true, permissionVersion: 1, availableServices: services, provisionedServices: services, updatedAt });
        }
        if (url.pathname === "/companion/mobile-access/revoke" && request.method === "POST") {
          if (!installation && !legacyAuthorised) return json({ error: "Installation authentication is required." }, 401);
          await coordinate(env, "installation:" + scope, "revoke", { kind: "mobile" });
          await env.SENTINEL_COMMANDS.delete(installationKey(scope, MOBILE_VAULT_KEY));
          const permissionKeys = await env.SENTINEL_COMMANDS.list({ prefix: installationKey(scope, MOBILE_PERMISSION_PREFIX), limit: 1000 });
          await Promise.all(permissionKeys.keys.map((key) => env.SENTINEL_COMMANDS.delete(key.name)));
          const tokens = await env.SENTINEL_COMMANDS.list({ prefix: MOBILE_ACCESS_TOKEN_PREFIX, limit: 1000 });
          await Promise.all(tokens.keys.map(async (key) => { const value = await env.SENTINEL_COMMANDS.get(key.name, "json"); if (value?.installationId === scope) await env.SENTINEL_COMMANDS.delete(key.name); }));
          return json({ configured: false, permissionVersion: 1, availableServices: [], provisionedServices: [] });
        }
        if (url.pathname === "/companion/register" && request.method === "POST") {
          const body = await request.json();
          if (typeof body.accessKey !== "string" || body.accessKey.length < 32)
            return json({ error: "Invalid companion access key." }, 400);
          const guard = await coordinate(env, "installation:" + scope, "guard");
          await env.SENTINEL_COMMANDS.put(
            installationKey(scope, COMPANION_ACCESS_KEY),
            JSON.stringify({
              accessKey: body.accessKey,
              pairedEpoch: guard.pairedEpoch,
              createdAt: Date.now(),
              name: body.name || "Sentinel Personal",
              local: body.local || null,
            }),
            { expirationTtl: 31536000 },
          );
          return json({ registered: true });
        }
        if (url.pathname === "/companion/pairing-code" && request.method === "POST") {
          let code = "";
          for (let attempt = 0; attempt < 10; attempt += 1) {
            const candidate = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
            if (!(await env.SENTINEL_COMMANDS.get(`${COMPANION_PAIR_PREFIX}${candidate}`)) && await claimOneTime(env, "allocate:" + COMPANION_PAIR_PREFIX + candidate, "slot")) { code = candidate; break; }
          }
          if (!code) return json({ error: "Unable to allocate a pairing code. Try again." }, 503);
          const body = await request.json().catch(() => ({}));
          await env.SENTINEL_COMMANDS.put(`${COMPANION_PAIR_PREFIX}${code}`, JSON.stringify({ installationId: scope, local: body.local || null, generation: crypto.randomUUID() }), { expirationTtl: 600 });
          return json({ code, expiresAt: new Date(Date.now() + 600000).toISOString() });
        }
        if (url.pathname === "/companion/devices" && request.method === "GET") {
          const prefix = installationKey(scope, COMPANION_DEVICE_PREFIX);
          const keys = await env.SENTINEL_COMMANDS.list({ prefix, limit: 100 });
          const devices = (await Promise.all(keys.keys.map((key) => env.SENTINEL_COMMANDS.get(key.name, "json")))).filter(Boolean).map(({ installationId, ...device }) => device);
          return json({ devices });
        }
        if (url.pathname.startsWith("/companion/devices/") && request.method === "DELETE") {
          const deviceId = decodeURIComponent(url.pathname.slice("/companion/devices/".length));
          await coordinate(env, "installation:" + scope, "revoke", { kind: "device", deviceId });
          await Promise.all([
            env.SENTINEL_COMMANDS.delete(installationKey(scope, `${COMPANION_DEVICE_PREFIX}${deviceId}`)),
            env.SENTINEL_COMMANDS.delete(installationKey(scope, `${MOBILE_PERMISSION_PREFIX}${deviceId}`)),
          ]);
          const tokens = await env.SENTINEL_COMMANDS.list({ prefix: COMPANION_TOKEN_PREFIX, limit: 1000 });
          await Promise.all(tokens.keys.map(async (key) => { const value = await env.SENTINEL_COMMANDS.get(key.name, "json"); if (value?.installationId === scope && value?.deviceId === deviceId) await env.SENTINEL_COMMANDS.delete(key.name); }));
          const mobileTokens = await env.SENTINEL_COMMANDS.list({ prefix: MOBILE_ACCESS_TOKEN_PREFIX, limit: 1000 });
          await Promise.all(mobileTokens.keys.map(async (key) => { const value = await env.SENTINEL_COMMANDS.get(key.name, "json"); if (value?.installationId === scope && value?.deviceId === deviceId) await env.SENTINEL_COMMANDS.delete(key.name); }));
          return json({ revoked: true });
        }
        if (url.pathname === "/companion/items" && request.method === "GET") {
          const prefix = installationKey(scope, COMPANION_ITEM_PREFIX);
          return json({ items: await listCompanionItems(env, prefix) });
        }
        if (url.pathname === "/companion/items" && request.method === "POST") {
          const body = await request.json(); const id = validCompanionItemId(body.id) ? body.id : crypto.randomUUID();
          const item = { ...body, id, sourceName: "Sentinel Desktop", sourceDeviceId: "desktop", createdAt: new Date().toISOString() };
          try { await putCompanionItem(env, installationKey(scope, COMPANION_ITEM_PREFIX), item); } catch (error) { return json({ error: error.message }, error.status || 500); }
          return json({ queued: true, id });
        }
        if (url.pathname.startsWith("/companion/items/") && request.method === "GET") {
          const id = decodeURIComponent(url.pathname.slice("/companion/items/".length));
          const item = await getCompanionItem(env, installationKey(scope, COMPANION_ITEM_PREFIX), id);
          return item ? json(item) : json({ error: "Shared item not found." }, 404);
        }
        if (url.pathname.startsWith("/companion/items/") && request.method === "DELETE") {
          const id = decodeURIComponent(url.pathname.slice("/companion/items/".length));
          await deleteCompanionItem(env, installationKey(scope, COMPANION_ITEM_PREFIX), id); return json({ deleted: true });
        }
        if (
          url.pathname === "/companion/heartbeat" &&
          request.method === "POST"
        ) {
          const body = await request.json();
          // Cloudflare KV requires an expiration TTL of at least 60 seconds.
          // A short record keeps the public companion dashboard honest if the PC goes offline.
          await env.SENTINEL_COMMANDS.put(
            installationKey(scope, COMPANION_STATUS_KEY),
            JSON.stringify({
              online: Boolean(body.online),
              checkedAt: body.checkedAt || new Date().toISOString(),
              name: body.name || "Sentinel Personal",
              serviceAccess: Array.isArray(body.serviceAccess) ? body.serviceAccess : [],
              sharesApiKeys: false,
              local: body.local || null,
            }),
            { expirationTtl: 60 },
          );
          return json({ received: true });
        }
        if (url.pathname === "/companion/poll" && request.method === "POST") {
          return pollCommand(request, env, scope, "companion", COMPANION_COMMAND_KEY);
        }
        if (url.pathname === "/companion/revoke" && request.method === "POST") {
          await coordinate(env, "installation:" + scope, "revoke", { kind: "all" });
          await Promise.all([
            env.SENTINEL_COMMANDS.delete(
              installationKey(scope, COMPANION_ACCESS_KEY),
            ),
            env.SENTINEL_COMMANDS.delete(
              installationKey(scope, COMPANION_STATUS_KEY),
            ),
            env.SENTINEL_COMMANDS.delete(
              installationKey(scope, COMPANION_COMMAND_KEY),
            ),
          ]);
          return json({ revoked: true });
        }
  
        return new Response("Not found", { status: 404 });
      } catch (error) {
        // Do not leak provider responses, URLs containing keys, or tokens.
        if (error?.serviceError) return serviceErrorResponse(error);
        return json(
          {
            error: error?.status === 503 ? "Relay storage upgrade is required or temporarily unavailable." : "Sentinel Relay request failed.",
          },
          [400, 403, 404, 409, 429, 503].includes(error?.status) ? error.status : 500,
        );
      }
    },
  };
