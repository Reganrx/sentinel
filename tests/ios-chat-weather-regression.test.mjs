import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = await readFile(new URL("../SentinelBase/RootView.swift", import.meta.url), "utf8");
const model = await readFile(new URL("../SentinelBase/SentinelAppModel.swift", import.meta.url), "utf8");
const weather = await readFile(new URL("../SentinelBase/SentinelWeather.swift", import.meta.url), "utf8");
const cloud = await readFile(new URL("../SentinelBase/SentinelCloud.swift", import.meta.url), "utf8");
const localCompanion = await readFile(new URL("../server/automation/companionLocal.ts", import.meta.url), "utf8");
const dj = await readFile(new URL("../SentinelBase/MobileDJManager.swift", import.meta.url), "utf8");
const project = await readFile(new URL("../SentinelBase.xcodeproj/project.pbxproj", import.meta.url), "utf8");

test("local radar can request WeatherAPI precipitation tiles at phone zoom levels", () => {
  assert.match(root, /overlay\.maximumZ = 12/);
  assert.match(root, /Rain chance/);
  assert.match(root, /Rain amount/);
});

test("radar rain details use WeatherAPI hourly amount and future hours", () => {
  assert.match(weather, /precipMm = "precip_mm"/);
  assert.match(weather, /willItRain = "will_it_rain"/);
  assert.match(root, /ForEach\(futureHours\(weather, limit: 6\)/);
  assert.match(root, /hourlyRainAmount/);
  assert.match(root, /dateInterval\(of: \.hour, for: \.now\)/);
  assert.match(root, /weatherDate\(\$0\.element\) >= nextHour/);
});

test("legacy RainViewer cache cannot reappear", () => {
  assert.match(model, /caseInsensitiveCompare\("WeatherAPI"\)/);
  assert.match(model, /Legacy radar cache removed/);
  assert.match(model, /removeObject\(forKey: "sentinelRadarMetadata"\)/);
});

test("WeatherAPI radar metadata decodes without legacy colour-scheme data", () => {
  assert.match(weather, /let colorScheme: Int\?/);
  assert.match(model, /if radarHTTPStatus == "Requesting…"/);
  assert.match(model, /Radar response error:/);
});

test("chat capability questions do not consume provider quota", () => {
  assert.match(model, /localChatCapabilityReply/);
  assert.match(model, /generate images/);
  assert.match(root, /Your message is saved\. Retry after a short pause\./);
});

test("paired iPhone chat can use authenticated desktop chat before cloud", () => {
  assert.match(localCompanion, /req\.headers\.authorization !== `Bearer \$\{currentToken\}`/);
  assert.match(localCompanion, /url\.pathname === "\/chat" && req\.method === "POST"/);
  assert.match(localCompanion, /127\.0\.0\.1:\$\{Number\(process\.env\.PORT\) \|\| 3001\}\/chat/);
  assert.match(localCompanion, /url\.pathname === "\/status"/);
  assert.match(cloud, /LocalChatRequest\(message: localMessage, history: history\)/);
  assert.match(cloud, /request\.timeoutInterval = path == "\/chat" \|\| path == "\/concierge\/plan" \? 100/);
  assert.ok(cloud.indexOf('localCompanionRequest(path: "/chat"') < cloud.indexOf('path: "/mobile/services/chat"'));
});

test("mobile Concierge uses the paired Personal planner and requires review before handoff", () => {
  assert.match(localCompanion, /url\.pathname === "\/concierge\/plan" && req\.method === "POST"/);
  assert.match(cloud, /planConciergeOrder\(_ request: ConciergePlanRequest\)/);
  assert.match(root, /private struct SentinelConciergeWorkspace/);
  assert.match(root, /Toggle\("I have reviewed this plan", isOn: \$reviewed\)/);
  assert.match(root, /if let url = handoffURL, reviewed/);
  assert.match(root, /Sentinel does not submit or pay for an order/);
});

test("mobile Mission Control exposes verified per-light controls", () => {
  assert.match(localCompanion, /url\.pathname === "\/home\/lights" && req\.method === "GET"/);
  assert.match(localCompanion, /url\.pathname\.match\(\/\^\\\/home\\\/lights\\\//);
  assert.match(localCompanion, /Choose brightness from 1 to 100 percent/);
  assert.match(localCompanion, /Choose a valid RGB colour/);
  assert.match(root, /private var homeControl: some View/);
  assert.match(root, /app\.togglePersonalLight\(light\)/);
  assert.match(root, /app\.setPersonalLightBrightness\(light/);
  assert.match(root, /app\.setPersonalLightColour\(light/);
});

test("mobile Media only sends allowlisted Windows playback commands", () => {
  assert.match(localCompanion, /url\.pathname === "\/media\/command" && req\.method === "POST"/);
  assert.match(localCompanion, /Object\.hasOwn\(mediaKeys, command\)/);
  assert.match(localCompanion, /Unsupported media command/);
  assert.match(root, /private struct SentinelMediaWorkspace/);
  assert.match(root, /Playback state is not verified|mediaCommandStatus/);
});

test("mobile Device Scanner retains Personal developer gating and trusted labels", () => {
  assert.match(localCompanion, /url\.pathname === "\/devices\/scan"/);
  assert.match(localCompanion, /if \(!hasActiveDeveloperSession\(\)\) return reply\(res, 403/);
  assert.match(root, /private struct SentinelScannerWorkspace/);
  assert.match(root, /app\.setDeviceTrusted\(device/);
  assert.match(model, /sentinelMobileTrustedDevices/);
});

test("mobile DJ uses actual local audio decks and is compiled into iOS target", () => {
  assert.match(dj, /AVAudioPlayer\(contentsOf: track\.url\)/);
  assert.match(dj, /playerA\?\.volume = Float\(cos/);
  assert.match(dj, /playerB\?\.volume = Float\(sin/);
  assert.match(dj, /autoMix && !tracks\.isEmpty/);
  assert.match(project, /MobileDJManager\.swift in Sources/);
  assert.match(root, /dj\.title\(for: name\)/);
  assert.doesNotMatch(model.slice(model.indexOf("enum SentinelPage:"), model.indexOf("enum SentinelJourneyMode:")), /case design\s*=/);
});

test("mobile Mission Control reads Govee and Ring without copying credentials", () => {
  assert.match(localCompanion, /"\/mission\/govee": "\/automation\/govee\/devices"/);
  assert.match(localCompanion, /"\/mission\/ring\/events": "\/automation\/ring\/events"/);
  assert.match(localCompanion, /This connected device cannot be controlled/);
  assert.match(root, /app\.personalRingEvents/);
  assert.match(root, /app\.controlGovee\(item/);
});

test("mobile home and notifications provide direct operational navigation", () => {
  assert.match(root, /Tap the reactor for live controls/);
  assert.match(root, /reactorControl\("Mission"/);
  assert.match(root, /notificationDestination/);
  assert.match(root, /app\.markActivityRead\(item\.id\); app\.selected/);
});
