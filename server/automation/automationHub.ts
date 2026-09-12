export type IntegrationId = string;

type Integration = {
  id: IntegrationId;
  name: string;
  connected: boolean;
  description: string;
  setup: string;
};

import { getHueCloudStatus, getHueConfig } from "./hue.js";
import { getGoveeConfig } from "./govee.js";
import { getRingConfig } from "./ring.js";
import { getRelayStatus } from "./relay.js";
import { listModules } from "../setup/integrationManager.js";

export async function getAutomationIntegrations(): Promise<Integration[]> {
  const modules = await listModules();
  const hue = await getHueConfig();
  const hueCloud = await getHueCloudStatus();
  const govee = await getGoveeConfig();
  const ring = await getRingConfig();
  const relay = getRelayStatus();
  const integrations = [
    {
      id: "hue",
      name: "Philips Hue",
      connected: Boolean(hue) || hueCloud.connected,
      description: "Lights, rooms, zones, and scenes through your Hue Bridge.",
      setup: "Pair your local Bridge or connect your approved Hue cloud account for secure remote control.",
    },
    {
      id: "govee",
      name: "Govee",
      connected: Boolean(govee?.apiKey),
      description: "Compatible Govee lights and environmental devices.",
      setup: "Add GOVEE_API_KEY to the Sentinel server environment.",
    },
    {
      id: "alexa",
      name: "Amazon Alexa",
      connected: relay.configured,
      description: "Sentinel's Alexa skill relay for voice commands and smart-home control.",
      setup: "Configure the Sentinel relay shared secret used by your Alexa skill.",
    },
    {
      id: "ring",
      name: "Ring",
      connected: Boolean(ring?.refreshToken),
      description: "Doorbell and camera status, live events, and alerts.",
      setup: "Complete the Ring account authorisation and store its refresh token on the server.",
    },
  ];
  const visible = integrations.filter(integration => modules.some(module => module.id === integration.id && module.installed && module.enabled));
  const custom = modules.filter(module => !module.builtIn && module.installed && module.enabled).map(module => ({ id: module.id as IntegrationId, name: module.name, connected: module.configured, description: module.description, setup: "Managed in Settings → Setup Centre." }));
  return [...visible, ...custom];
}
