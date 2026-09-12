import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = await readFile(new URL("../SentinelBase/RootView.swift", import.meta.url), "utf8");
const model = await readFile(new URL("../SentinelBase/SentinelAppModel.swift", import.meta.url), "utf8");
const cloud = await readFile(new URL("../SentinelBase/SentinelCloud.swift", import.meta.url), "utf8");
const personal = await readFile(new URL("../src/pages/Travel/TravelView.tsx", import.meta.url), "utf8");

test("navigation is centred on phone coordinates rather than London", () => {
  assert.match(root, /Map\(position: \$cameraPosition\)/);
  assert.match(root, /centreOnPhone\(\)/);
  assert.match(model, /MKCoordinateRegion\(center: currentLocation/);
});

test("travel destination does not borrow navigation search state", () => {
  assert.match(root, /text: \$app\.travelDestinationSearch/);
  assert.match(root, /app\.travelDestinationResults/);
  assert.match(model, /func searchTravelDestination\(\)/);
});

test("paired Personal travel snapshots can reach mobile", () => {
  assert.match(personal, /SENTINEL_TRAVEL_V1:/);
  assert.match(personal, /sendCompanionText\(snapshot\)/);
  assert.match(cloud, /func listSharedItems\(\)/);
  assert.match(model, /func refreshPersonalTravel\(\)/);
  assert.match(root, /app\.personalFlights/);
});

test("a failed chat prompt is retried rather than duplicated", () => {
  assert.match(model, /chatError != nil, chatMessages\.last\?\.role == \.user/);
  assert.match(model, /await retryAssistantPrompt\(\)/);
});
