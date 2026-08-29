(() => {
  "use strict";
  const API = "http://localhost:3001";
  const HISTORY_KEY = "sentinel-network-diagnostics-v1";
  const state = { tab: "overview", diagnostics: null, devices: null };
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const storedJson = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); return value && typeof value === "object" ? value : fallback; } catch { return fallback; } };
  const history = () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; } };
  const saveHistory = result => localStorage.setItem(HISTORY_KEY, JSON.stringify([result, ...history()].slice(0, 20)));
  function rename() {
    document.querySelectorAll("span,h1,h2,strong").forEach(element => {
      if ((element.textContent || "").trim() === "Device Scanner") element.textContent = "Network Centre";
    });
    document.querySelectorAll("p").forEach(element => {
      if ((element.textContent || "").trim() === "NETWORK INVENTORY") element.textContent = "NETWORK INTELLIGENCE";
    });
    const heading = document.querySelector(".scanner-heading span");
    if (heading) heading.textContent = "Understand your connection, devices, performance and local network security.";
  }
  async function scan() {
    const token = sessionStorage.getItem("sentinel-developer-token") || "";
    const response = await fetch(`${API}/devices/scan`, { headers: { "x-sentinel-developer-token": token } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unlock Developer Mode to scan the network.");
    state.devices = data;
    return data;
  }
  function metric(label, value, detail = "") { return `<article><small>${label}</small><strong>${value}</strong><span>${detail}</span></article>`; }
  function overview(panel) {
    const last = history()[0];
    panel.innerHTML = `<div class="network-panel-heading"><div><small>COMMAND OVERVIEW</small><h2>Your network at a glance</h2><p>Saved inventory and the latest connection assessment.</p></div><button data-go="diagnostics">Run diagnostics</button></div><div class="network-metrics">${metric("CONNECTION", navigator.onLine ? "Online" : "Offline", "Windows network state")}${metric("LAST HEALTH SCORE", last ? `${last.score}/100` : "Not tested", last ? new Date(last.testedAt).toLocaleString() : "Run your first diagnostic")}${metric("KNOWN DEVICES", Object.keys(storedJson("sentinel-device-trust", {})).length, "Saved trust records")}${metric("LAST SCAN", storedJson("sentinel-device-scan-ids", []).length || "None", "Devices retained from the previous scan")}</div><section class="network-advice"><strong>Sentinel network intelligence</strong><p>${last ? escapeHtml(last.findings?.[0] || "Your latest test is available in Diagnostics.") : "Run Diagnostics for measured latency, jitter, packet loss, DNS response and short download/upload tests."}</p></section>`;
    panel.querySelector('[data-go="diagnostics"]')?.addEventListener("click", () => activate("diagnostics"));
  }
  async function map(panel) {
    panel.innerHTML = '<div class="network-loading"><i></i><strong>Building network map…</strong><span>Reading the current trusted inventory</span></div>';
    try {
      const data = state.devices || await scan();
      const devices = data.devices || [];
      panel.innerHTML = `<div class="network-panel-heading"><div><small>LOCAL TOPOLOGY</small><h2>Network map</h2><p>A safe inventory view—not a claim of router control.</p></div><span class="network-status-pill">${devices.length} observed</span></div><div class="network-map"><div class="network-map-core"><b>S</b><strong>Sentinel</strong><span>This PC</span></div><div class="network-map-router"><b>⌁</b><strong>Gateway</strong><span>Local network</span></div>${devices.slice(0, 24).map((device, index) => `<article style="--node:${index}"><b>${device.kind === "bluetooth" ? "B" : "•"}</b><strong title="${escapeHtml(device.name)}">${escapeHtml(device.name)}</strong><span>${escapeHtml(device.address || device.interfaceName || device.kind)}</span></article>`).join("")}</div>`;
    } catch (error) { panel.innerHTML = `<div class="network-empty"><strong>Network map is locked</strong><p>${escapeHtml(error.message)}</p><span>Unlock Developer Mode in Settings, then return here.</span></div>`; }
  }
  function renderDiagnostics(panel) {
    const result = state.diagnostics || history()[0];
    panel.innerHTML = `<div class="network-panel-heading"><div><small>CONNECTION LAB</small><h2>Network diagnostics</h2><p>Measures the current connection and separates local responsiveness from ISP performance.</p></div><button class="run-network-test">${result ? "Test again" : "Run full test"}</button></div>${result ? `<div class="network-score"><div><strong>${result.score}</strong><span>/100</span></div><p>${result.score >= 85 ? "Connection is performing well" : result.score >= 65 ? "Connection has room for improvement" : "Connection needs attention"}</p></div><div class="network-metrics network-metrics--six">${metric("DOWNLOAD", `${result.downloadMbps.toFixed(1)} Mbps`, "Short throughput test")}${metric("UPLOAD", `${result.uploadMbps.toFixed(1)} Mbps`, "Short throughput test")}${metric("PING", result.internetPing.latencyMs == null ? "Failed" : `${result.internetPing.latencyMs.toFixed(0)} ms`, "To 1.1.1.1")}${metric("JITTER", result.internetPing.jitterMs == null ? "—" : `${result.internetPing.jitterMs.toFixed(1)} ms`, "Timing stability")}${metric("PACKET LOSS", `${result.internetPing.packetLossPercent.toFixed(0)}%`, "Five test packets")}${metric("DNS", `${result.dnsMs.toFixed(0)} ms`, "Lookup response")}</div><div class="network-findings"><h3>Sentinel assessment</h3>${result.findings.map(item => `<p>• ${escapeHtml(item)}</p>`).join("")}<button class="optimise-network">Apply safe optimisation</button><small>Clears the Windows DNS cache only. Router, firewall, adapter and DNS-provider settings are not changed.</small></div>` : '<div class="network-empty"><strong>No diagnostic result yet</strong><p>Run a controlled test for download, upload, ping, jitter, packet loss, gateway latency and DNS response.</p></div>'}`;
    panel.querySelector(".run-network-test")?.addEventListener("click", () => runDiagnostics(panel));
    panel.querySelector(".optimise-network")?.addEventListener("click", () => optimise(panel));
  }
  async function runDiagnostics(panel) {
    panel.innerHTML = '<div class="network-loading"><i></i><strong>Analysing your connection…</strong><span>Testing gateway, DNS, latency, stability and short data transfers</span></div>';
    try {
      const response = await fetch(`${API}/network/diagnostics`), data = await response.json();
      if (!response.ok) throw new Error(data.error || "Diagnostics failed.");
      state.diagnostics = data; saveHistory(data); renderDiagnostics(panel);
    } catch (error) { panel.innerHTML = `<div class="network-empty"><strong>Test could not complete</strong><p>${escapeHtml(error.message)}</p><button class="run-network-test">Try again</button></div>`; panel.querySelector("button")?.addEventListener("click", () => runDiagnostics(panel)); }
  }
  async function optimise(panel) {
    const button = panel.querySelector(".optimise-network"); if (button) { button.disabled = true; button.textContent = "Optimising…"; }
    try {
      const response = await fetch(`${API}/network/optimise`, { method: "POST" }), data = await response.json();
      if (!response.ok) throw new Error(data.error || "Optimisation failed.");
      const box = document.createElement("div"); box.className = "network-result"; box.innerHTML = `<strong>Safe optimisation complete</strong><p>${data.actions.map(escapeHtml).join(" · ")}</p><button>Verify with another test</button>`; panel.appendChild(box); box.querySelector("button").addEventListener("click", () => runDiagnostics(panel));
    } catch (error) { if (button) button.textContent = error.message; }
  }
  async function security(panel) {
    panel.innerHTML = '<div class="network-loading"><i></i><strong>Reviewing inventory…</strong></div>';
    try {
      const data = state.devices || await scan(), trust = storedJson("sentinel-device-trust", {}), previous = new Set(storedJson("sentinel-device-scan-ids", []));
      const unknown = data.devices.filter(device => trust[device.id] !== "trusted"), newDevices = data.devices.filter(device => !previous.has(device.id));
      panel.innerHTML = `<div class="network-panel-heading"><div><small>LOCAL SECURITY</small><h2>Inventory review</h2><p>Highlights unfamiliar changes without probing ports or bypassing device security.</p></div><span class="network-status-pill ${unknown.length ? "warning" : ""}">${unknown.length ? `${unknown.length} to review` : "All reviewed"}</span></div><div class="network-metrics">${metric("OBSERVED", data.devices.length, "Current Windows records")}${metric("TRUSTED", data.devices.length - unknown.length, "Recognised by you")}${metric("NEEDS REVIEW", unknown.length, "Not marked trusted")}${metric("NEW", newDevices.length, "Compared with saved scan")}</div><div class="network-findings"><h3>Security guidance</h3><p>• Unknown does not automatically mean dangerous—it means you have not labelled it.</p><p>• Review unexpected devices in the Devices tab and check your router’s own admin page if something is unfamiliar.</p><p>• Sentinel does not run intrusive port scans or attempt device logins.</p></div>`;
    } catch (error) { panel.innerHTML = `<div class="network-empty"><strong>Security review is locked</strong><p>${escapeHtml(error.message)}</p></div>`; }
  }
  function renderHistory(panel) {
    const rows = history();
    panel.innerHTML = `<div class="network-panel-heading"><div><small>PERFORMANCE MEMORY</small><h2>Diagnostic history</h2><p>Compare connection quality over time on this computer.</p></div>${rows.length ? '<button class="clear-network-history">Clear history</button>' : ""}</div>${rows.length ? `<div class="network-history">${rows.map(row => `<article><div><strong>${row.score}/100</strong><span>${new Date(row.testedAt).toLocaleString()}</span></div><b>${row.downloadMbps.toFixed(1)} ↓</b><b>${row.uploadMbps.toFixed(1)} ↑</b><b>${row.internetPing.latencyMs?.toFixed(0) ?? "—"} ms</b></article>`).join("")}</div>` : '<div class="network-empty"><strong>No history yet</strong><p>Completed diagnostics will be retained locally here.</p></div>'}`;
    panel.querySelector(".clear-network-history")?.addEventListener("click", () => { localStorage.removeItem(HISTORY_KEY); state.diagnostics = null; renderHistory(panel); });
  }
  function activate(tab) {
    state.tab = tab;
    const view = document.querySelector(".device-scanner-view"), panel = view?.querySelector(".network-centre-panel"); if (!view || !panel) return;
    view.querySelectorAll(".network-centre-tabs button").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
    [...view.children].forEach(child => { if (!child.matches(".scanner-heading,.network-centre-tabs,.network-centre-panel")) child.style.display = tab === "devices" ? "" : "none"; });
    panel.style.display = tab === "devices" ? "none" : "";
    if (tab === "overview") overview(panel); else if (tab === "map") map(panel); else if (tab === "diagnostics") renderDiagnostics(panel); else if (tab === "security") security(panel); else if (tab === "history") renderHistory(panel);
  }
  function enhance() {
    rename();
    const view = document.querySelector(".device-scanner-view"); if (!view || view.dataset.networkCentre) return;
    view.dataset.networkCentre = "true";
    const tabs = document.createElement("nav"); tabs.className = "network-centre-tabs"; tabs.innerHTML = [["overview","Overview"],["devices","Devices"],["map","Network map"],["diagnostics","Diagnostics"],["security","Security"],["history","History"]].map(([id,label]) => `<button data-tab="${id}">${label}</button>`).join("");
    const panel = document.createElement("section"); panel.className = "network-centre-panel";
    view.querySelector(".scanner-heading")?.insertAdjacentElement("afterend", tabs); tabs.insertAdjacentElement("afterend", panel);
    tabs.querySelectorAll("button").forEach(button => button.addEventListener("click", () => activate(button.dataset.tab)));
    activate("overview");
  }
  new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true }); setInterval(enhance, 1000); enhance();
})();
