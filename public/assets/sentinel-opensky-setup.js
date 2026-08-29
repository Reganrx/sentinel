(() => {
  "use strict";
  const API = "http://localhost:3001";
  const findByText = (selector, pattern) => [...document.querySelectorAll(selector)].find(element => pattern.test(element.textContent || ""));
  async function status() {
    try {
      const response = await fetch(`${API}/setup/opensky/status`);
      return response.ok ? await response.json() : { configured: false };
    } catch { return { configured: false }; }
  }
  function findServiceRow() {
    const flyStack = findByText("h1,h2,h3,h4,strong", /^FlyStack Aviation$/i);
    return flyStack?.closest("article") || null;
  }
  let syncedCoreCount = null;
  let coreCountRequestedAt = 0;
  async function refreshCoreCount() {
    if (Date.now() - coreCountRequestedAt < 4000) return;
    coreCountRequestedAt = Date.now();
    try {
      const response = await fetch(`${API}/setup/centre`);
      if (!response.ok) return;
      const data = await response.json();
      const core = data.core || {};
      syncedCoreCount = ["openAI", "maps", "weather", "aviation", "relay", "openSky"].filter(key => Boolean(core[key])).length;
      updateCoreCount();
    } catch {}
  }
  function updateCoreCount() {
    const setup = document.querySelector(".setup-centre");
    if (!setup) return;
    const counter = [...setup.querySelectorAll("span")].find(element => /^\d+\/\d+ core services$/i.test((element.textContent || "").trim()));
    if (!counter) return;
    if (syncedCoreCount !== null) counter.textContent = `${syncedCoreCount}/6 core services`;
    refreshCoreCount();
  }
  function nestVisiblePages() {
    const experience = document.querySelector(".settings-accordion");
    const visiblePages = document.querySelector(".page-visibility-card");
    if (!experience || !visiblePages) return;
    const heading = experience.querySelector(".settings-accordion-heading");
    if (heading && !heading.dataset.visiblePagesNesting) {
      heading.dataset.visiblePagesNesting = "true";
      heading.addEventListener("click", () => {
        if (heading.getAttribute("aria-expanded") === "true") {
          experience.insertAdjacentElement("afterend", visiblePages);
          visiblePages.style.display = "none";
        }
      }, { capture: true });
    }
    const content = experience.querySelector(".settings-accordion-content");
    if (content) {
      if (visiblePages.parentElement !== content) content.appendChild(visiblePages);
      visiblePages.style.display = "";
      visiblePages.classList.add("page-visibility-card--nested");
    } else {
      visiblePages.style.display = "none";
    }
  }
  async function enhance() {
    if (document.querySelector(".opensky-core-service")) return;
    const heading = findByText("h1,h2,h3", /Essential services/i);
    const flyRow = findServiceRow();
    if (!heading || !flyRow || !/Core setup/i.test(document.body.textContent || "")) return;
    const configured = await status();
    if (!flyRow.isConnected || document.querySelector(".opensky-core-service")) return;
    const card = document.createElement("div");
    card.className = "opensky-core-service";
    card.innerHTML = `
      <span class="opensky-service-icon">⌁</span>
      <div class="opensky-service-info"><strong>OpenSky Network</strong><span>Authenticated live aircraft positions and flight radar</span><a href="https://opensky-network.org/my-opensky/account" target="_blank" rel="noreferrer">Create API client ↗</a></div>
      <div class="setup-key opensky-service-control">
        <span class="opensky-state ${configured.configured ? "is-ready" : ""}">${configured.configured ? "✓ Configured" : "Not configured"}</span>
        <div class="opensky-fields">
          <input autocomplete="off" name="opensky-client-id" placeholder="OpenSky client ID">
          <input autocomplete="new-password" name="opensky-client-secret" type="password" placeholder="OpenSky client secret">
          <button type="button">Save & test</button>
        </div>
        <small>Use the client ID and client secret from My OpenSky → Account → API clients.</small>
      </div>`;
    flyRow.insertAdjacentElement("afterend", card);
    updateCoreCount();
    const button = card.querySelector("button"), state = card.querySelector(".opensky-state");
    button.addEventListener("click", async () => {
      const clientId = card.querySelector('[name="opensky-client-id"]').value.trim();
      const clientSecret = card.querySelector('[name="opensky-client-secret"]').value.trim();
      if (!clientId || !clientSecret) { state.textContent = "Enter both values"; state.classList.remove("is-ready"); return; }
      button.disabled = true; button.textContent = "Connecting…"; state.textContent = "Testing OpenSky";
      try {
        const save = await fetch(`${API}/setup/configuration`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ edition: "personal", OPENSKY_CLIENT_ID: clientId, OPENSKY_CLIENT_SECRET: clientSecret }) });
        const saved = await save.json();
        if (!save.ok) throw new Error(saved.error || "Could not save OpenSky credentials.");
        const test = await fetch(`${API}/setup/opensky/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, clientSecret }) });
        const result = await test.json();
        if (!test.ok) throw new Error(result.error || "OpenSky rejected these credentials.");
        state.textContent = "✓ Connected"; state.classList.add("is-ready"); syncedCoreCount = 6; updateCoreCount();
        card.querySelector('[name="opensky-client-id"]').value = "";
        card.querySelector('[name="opensky-client-secret"]').value = "";
      } catch (error) { state.textContent = error.message || "Connection failed"; state.classList.remove("is-ready"); updateCoreCount(); }
      finally { button.disabled = false; button.textContent = "Save & test"; }
    });
  }
  let queued = false;
  const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; enhance(); nestVisiblePages(); updateCoreCount(); }); };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(() => { enhance(); nestVisiblePages(); updateCoreCount(); }, 1200); enhance(); nestVisiblePages(); updateCoreCount();
})();
