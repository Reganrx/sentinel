import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = await readFile(new URL("../SentinelBase/RootView.swift", import.meta.url), "utf8");
const model = await readFile(new URL("../SentinelBase/SentinelAppModel.swift", import.meta.url), "utf8");
const weather = await readFile(new URL("../SentinelBase/SentinelWeather.swift", import.meta.url), "utf8");

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

test("chat capability questions do not consume provider quota", () => {
  assert.match(model, /localChatCapabilityReply/);
  assert.match(model, /generate images/);
  assert.match(root, /Your message is saved\. Retry after a short pause\./);
});
