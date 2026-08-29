import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

const port = 31991;
const token = "sentinel-local-api-regression-token";
const baseUrl = `http://127.0.0.1:${port}`;
let server;

async function waitUntilReady() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, {
        headers: { "x-sentinel-local-token": token },
      });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Test server did not become ready.");
}

test.before(async () => {
  server = spawn(process.execPath, ["server/dist/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      SENTINEL_LOCAL_API_TOKEN: token,
      SENTINEL_DATA_DIR: ".test-data",
    },
    stdio: "ignore",
  });
  await waitUntilReady();
});

test.after(() => server?.kill());

test("rejects requests without the local app token", async () => {
  assert.equal((await fetch(baseUrl)).status, 401);
  assert.equal((await fetch(baseUrl, { headers: { "x-sentinel-local-token": "wrong" } })).status, 401);
});

test("accepts authenticated local requests", async () => {
  assert.equal((await fetch(baseUrl, { headers: { "x-sentinel-local-token": token } })).status, 200);
});

test("does not grant cross-origin access to an arbitrary website", async () => {
  const response = await fetch(baseUrl, {
    headers: { Origin: "https://attacker.invalid", "x-sentinel-local-token": token },
  });
  assert.notEqual(response.headers.get("access-control-allow-origin"), "https://attacker.invalid");
});

test("rejects unusable or unsupported voice recordings", async () => {
  const headers = { "x-sentinel-local-token": token };
  const short = await fetch(`${baseUrl}/audio/transcribe`, {
    method: "POST", headers: { ...headers, "content-type": "audio/webm" }, body: new Uint8Array(10),
  });
  assert.equal(short.status, 400);
  const unsupported = await fetch(`${baseUrl}/audio/transcribe`, {
    method: "POST", headers: { ...headers, "content-type": "audio/wav" }, body: new Uint8Array(900),
  });
  assert.equal(unsupported.status, 415);
});
