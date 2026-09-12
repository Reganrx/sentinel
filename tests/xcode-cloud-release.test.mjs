import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const main = await readFile(new URL("../electron/main.ts", import.meta.url), "utf8");
const settings = await readFile(new URL("../src/pages/Settings/SettingsView.tsx", import.meta.url), "utf8");

test("Xcode Cloud status uses Apple's supported workflow build-runs route", () => {
  assert.match(main, /ciWorkflows\/\$\{encodeURIComponent\(config\.workflowId\)\}\/buildRuns\?limit=200/);
  assert.doesNotMatch(main, /buildRuns\?limit=1&sort=/);
  assert.match(main, /Date\.parse\(left\?\.attributes\?\.createdDate/);
});

test("successful Xcode Cloud builds are explicitly assigned to internal TestFlight testers", () => {
  assert.match(main, /filter\[bundleId\]=uk\.co\.sentinel\.base/);
  assert.match(main, /isInternalGroup === true/);
  assert.match(main, /relationships\/builds/);
  assert.match(main, /ensureLatestSentinelTestFlightDistribution/);
  assert.match(settings, /status\.testFlight\?\.state === "assigned"/);
  assert.match(settings, /distributed \? "success" : "building"/);
});

test("TestFlight assignment is recovered in the background after closing Release Centre or restarting Sentinel", () => {
  assert.match(main, /function startXcodeCloudDistributionMonitor\(\)/);
  assert.match(main, /reconcileLatestXcodeCloudDistribution/);
  assert.match(main, /setInterval\(\(\) => \{ void reconcileLatestXcodeCloudDistribution\(\); \}, 60_000\)/);
  assert.match(main, /startXcodeCloudDistributionMonitor\(\)/);
  assert.match(main, /TestFlight distribution check will retry/);
});

test("Xcode Cloud credentials can be removed securely and remain Personal-only", () => {
  assert.match(main, /sentinel:xcode-cloud-disconnect/);
  assert.match(main, /if \(isBaseEdition\(\)\) throw new Error\("Xcode Cloud control is available only in Sentinel Personal\."\)/);
  assert.match(main, /unlinkSync\(xcodeCloudConfigFile\(\)\)/);
  assert.match(settings, /Change connection/);
  assert.match(settings, /setInterval\(\(\) => \{ void refreshXcodeCloudStatus\(\); \}, 30_000\)/);
});

test("Release Studio is rendered only for Sentinel Personal", () => {
  assert.match(settings, /updateStatus\.edition === "personal" \? \(/);
  assert.match(main, /Release Studio is available only in Sentinel Personal/);
  assert.match(main, /Release publishing is available only in Sentinel Personal/);
});

test("native TestFlight preflight is independent of desktop publishing", () => {
  const nativeStart = settings.indexOf('if (releaseDelivery === "native")');
  const contentVersion = settings.indexOf('if (!/^\\d+', nativeStart);
  assert.ok(nativeStart >= 0 && contentVersion > nativeStart, "native preflight must run before content checks");
  const nativeBlock = settings.slice(nativeStart, contentVersion);
  assert.match(nativeBlock, /Xcode Cloud automation is connected/);
  assert.doesNotMatch(nativeBlock, /signingKeyReady|publisherConfigured|releaseNotes|selectedTestInstallation/);
});
