/**
 * Add this helper to the existing Alexa skill Lambda. Call it near the start
 * of every LaunchRequest and IntentRequest. Registration is deliberately
 * non-blocking: voice commands still work if the relay is temporarily down.
 */
exports.registerInvokingEcho = async function registerInvokingEcho(
  handlerInput,
) {
  const system = handlerInput?.requestEnvelope?.context?.System;
  const device = system?.device;
  if (
    !device?.deviceId ||
    !process.env.SENTINEL_RELAY_URL ||
    !process.env.SENTINEL_RELAY_SHARED_SECRET
  )
    return;
  const url = `${process.env.SENTINEL_RELAY_URL.replace(/\/$/, "")}/alexa/devices/register`;
  await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${process.env.SENTINEL_RELAY_SHARED_SECRET}`,
    },
    body: JSON.stringify({
      deviceId: device.deviceId,
      supportedInterfaces: Object.keys(device.supportedInterfaces || {}),
    }),
  }).catch(() => undefined);
};
