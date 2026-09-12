# Sentinel relay

This Cloudflare Worker is Sentinel's public, always-on relay for future Alexa and Ring callbacks. It never contains Hue, Govee, Alexa, or Ring passwords. It holds a short-lived encrypted command until Sentinel collects it on launch.

## One-time deployment

1. Install Node.js, then run `npm install --global wrangler`.
2. In this folder, run `wrangler login` and complete the browser sign-in.
3. Run `wrangler secret put RELAY_SHARED_SECRET` and enter a newly generated long random value.
4. Run `wrangler secret put MOBILE_VAULT_KEY` and enter a separate random value of at least 32 characters. This encrypts independent iPhone service credentials at rest.
5. Run `wrangler deploy`.

`MOBILE_VAULT_KEY` must not be the relay password and must never be placed directly in `worker.js`. Changing it later invalidates existing encrypted mobile-service vaults; re-enable Mobile Service Access from Sentinel Personal after rotating it.
5. Create a Workers KV namespace called `sentinel-commands`, bind it to the Worker as `SENTINEL_COMMANDS`, then copy the Worker URL into Sentinel's Alexa/Ring setup screen when it is added.

## Production Base updates

The same Worker can host Sentinel's privacy-preserving Base update channel. Base clients only read signed release metadata and packages; they do not upload settings, API keys, usage, or personal data.

1. Create the release bucket: `wrangler r2 bucket create sentinel-releases`.
2. Bind that bucket as `SENTINEL_RELEASES` (the included `wrangler.jsonc` already declares the binding).
3. Add a separate long random publishing credential with `wrangler secret put UPDATE_PUBLISH_TOKEN`.
4. Replace the placeholder KV namespace ID in `wrangler.jsonc`, then run `wrangler deploy`.
5. In Sentinel Personal, open Release Studio, enter the Worker HTTPS address and the same publishing token, then choose **Save and test publisher**.

Only Sentinel Personal can publish. Sentinel Base can check, download, verify and install signed releases, but it never receives the publishing token or Personal-only administration modules.

The `/dispatch` and `/poll` endpoints are intentionally protected by the shared secret. Alexa and Ring signature/OAuth verification will be added before their provider callbacks are enabled.

## Register the Echo that invoked Sentinel

Copy `alexa-skill-device-registration.js` into the existing Alexa skill Lambda. Set its `SENTINEL_RELAY_URL` and `SENTINEL_RELAY_SHARED_SECRET` environment variables, then call `await registerInvokingEcho(handlerInput)` near the start of each LaunchRequest and IntentRequest handler. The request records only Amazon's anonymous skill-specific device ID, supported interfaces, and timestamps. Invoke Sentinel once from each Echo, then rename the observed devices in Security Control.
