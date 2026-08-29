(() => {
  "use strict";
  const API = "http://localhost:3001";
  const SAVED_KEY = "sentinel-smart-places-v1";
  const PREFS_KEY = "sentinel-journey-preferences-v1";
  const state = { tab: "journey", results: [], timer: null };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
  const saved = () => read(SAVED_KEY, []);
  const genericNearby = /^(pharmacy|chemist|hospital|supermarket|groceries|petrol|gas station|coffee|cafe|food|restaurant|parking|ev charger|toilet|atm|bank|hotel)s?$/i;
  async function suggestions(query) {
    const endpoint = genericNearby.test(query.trim()) ? "navigation/discover" : "navigation/search";
    const response = await fetch(`${API}/${endpoint}?q=${encodeURIComponent(query.trim())}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Suggestions unavailable.");
    const list = Array.isArray(data) ? data : data.results || data.places || [];
    return list.slice(0, 8).map((item, index) => ({ id:String(item.id || `${item.name}-${index}`), name:item.name || item.address, address:item.address || item.name, type:item.category || item.type || "Place", latitude:item.latitude, longitude:item.longitude }));
  }
  function attachAutocomplete(input, host, onSelect) {
    if (!input || input.dataset.sentinelAutocomplete) return;
    input.dataset.sentinelAutocomplete = "true"; host.style.position = "relative";
    const menu = document.createElement("div"); menu.className = "nav-autocomplete"; host.appendChild(menu);
    input.addEventListener("input", () => {
      clearTimeout(input._sentinelSuggestTimer); const query = input.value.trim();
      if (query.length < 2) { menu.classList.remove("open"); return; }
      input._sentinelSuggestTimer = setTimeout(async () => {
        menu.innerHTML = '<span class="nav-autocomplete-loading">Finding nearby and matching places…</span>'; menu.classList.add("open");
        try {
          const items = await suggestions(query);
          menu.innerHTML = items.length ? items.map((item, index) => `<button type="button" data-suggestion="${index}"><strong>${esc(item.name)}</strong><span>${esc(item.address)}</span><small>${esc(item.type)}</small></button>`).join("") : '<span class="nav-autocomplete-loading">No matching places found.</span>';
          menu.querySelectorAll("button").forEach(button => button.onclick = () => { const item = items[Number(button.dataset.suggestion)]; input.value = item.address || item.name; input.dispatchEvent(new Event("input", { bubbles:true })); menu.classList.remove("open"); onSelect?.(item); });
        } catch (error) { menu.innerHTML = `<span class="nav-autocomplete-loading">${esc(error.message)}</span>`; }
      }, 350);
    });
    input.addEventListener("keydown", event => { if (event.key === "Escape") menu.classList.remove("open"); });
    input.addEventListener("blur", () => setTimeout(() => menu.classList.remove("open"), 180));
  }
  function navigationInput() { return document.querySelector(".navigation-search input, .navigation-view input[type=search], .navigation-view input[placeholder*='destination' i]"); }
  function sendToJourney(place) {
    const input = navigationInput();
    if (!input) return;
    activate("journey");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, place.address || place.name);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.focus();
  }
  function placeCard(place) {
    const isSaved = saved().some(item => item.id === place.id);
    return `<article class="smart-place-card"><div class="smart-place-icon">${esc(place.icon || "⌖")}</div><div><strong>${esc(place.name)}</strong><p>${esc(place.address || place.description || "Location details unavailable")}</p><span>${esc(place.type || place.category || "Place")}</span></div><div class="smart-place-actions"><button data-route="${esc(place.id)}">Route</button><button data-save="${esc(place.id)}">${isSaved ? "Saved" : "Save"}</button></div></article>`;
  }
  function bindPlaces(panel) {
    panel.querySelectorAll("[data-route]").forEach(button => button.onclick = () => { const place = state.results.find(item => String(item.id) === button.dataset.route) || saved().find(item => String(item.id) === button.dataset.route); if (place) sendToJourney(place); });
    panel.querySelectorAll("[data-save]").forEach(button => button.onclick = () => {
      const place = state.results.find(item => String(item.id) === button.dataset.save);
      if (!place) return;
      const entries = saved(), index = entries.findIndex(item => item.id === place.id);
      if (index >= 0) entries.splice(index, 1); else entries.unshift(place);
      localStorage.setItem(SAVED_KEY, JSON.stringify(entries.slice(0, 80)));
      renderPlaces(panel);
    });
  }
  async function searchPlaces(panel, query) {
    const results = panel.querySelector(".smart-place-results");
    if (!query.trim()) { state.results = []; renderPlaces(panel); return; }
    results.innerHTML = '<div class="nav-smart-loading"><i></i><span>Discovering useful places…</span></div>';
    try {
      const response = await fetch(`${API}/travel/search-places?q=${encodeURIComponent(query.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Place discovery failed.");
      const raw = Array.isArray(data) ? data : data.places || data.results || [];
      state.results = raw.slice(0, 18).map((item, index) => ({ id: String(item.id || item.placeId || `${item.name}-${index}`), name: item.name || item.displayName || item.address, address: item.address || item.formattedAddress || item.description, type: item.type || item.category || "Place", lat: item.lat || item.latitude, lng: item.lng || item.longitude }));
      renderPlaces(panel, query);
    } catch (error) { results.innerHTML = `<div class="nav-smart-empty"><strong>Discovery unavailable</strong><p>${esc(error.message)}</p></div>`; }
  }
  const categories = [
    ["Highlights","top attractions and hidden gems"],["Food","best restaurants and local food"],["Hotels","hotels and resorts"],["Essentials","pharmacy supermarket hospital"],["Transport","airport train station bus terminal"],["Family","family activities"],["Nightlife","bars nightlife entertainment"],["Quiet spots","parks beaches viewpoints quiet places"]
  ];
  function renderPlaces(panel, currentQuery = "") {
    const entries = saved();
    panel.innerHTML = `<section class="nav-smart-hero"><small>GLOBAL PLACE INTELLIGENCE</small><h2>Explore here or anywhere in the world</h2><p>Search around home, a holiday resort, an airport or a future destination. Sentinel keeps useful places ready for routes and trip planning.</p><div class="nav-place-search"><input value="${esc(currentQuery)}" placeholder="Try: family activities near Blue Bay Platinum Marmaris"><button>Discover</button></div><div class="nav-place-context"><button data-context="near me">Near me</button><button data-context="near my hotel">Near my hotel</button><button data-context="near the arrival airport">Arrival airport</button><button data-context="open now">Open now</button></div></section><div class="nav-place-categories">${categories.map(([name, query]) => `<button data-category="${esc(query)}"><strong>${name}</strong><span>${query}</span></button>`).join("")}</div><div class="smart-place-section"><header><div><small>DISCOVERY RESULTS</small><h3>${state.results.length ? `${state.results.length} places found` : "Start exploring"}</h3></div></header><div class="smart-place-results">${state.results.length ? state.results.map(placeCard).join("") : '<div class="nav-smart-empty"><strong>Holiday-ready discovery</strong><p>Include a city, hotel or resort name for precise results, or use a category above.</p></div>'}</div></div><div class="smart-place-section"><header><div><small>YOUR COLLECTIONS</small><h3>Saved places</h3></div><span>${entries.length} saved</span></header><div class="smart-place-results">${entries.length ? entries.map(placeCard).join("") : '<div class="nav-smart-empty"><p>Save restaurants, attractions, hospitals, airports and anything else you may need later.</p></div>'}</div></div>`;
    const input = panel.querySelector(".nav-place-search input");
    const run = suffix => searchPlaces(panel, `${input.value.trim()} ${suffix}`.trim());
    panel.querySelector(".nav-place-search button").onclick = () => run("");
    input.onkeydown = event => { if (event.key === "Enter") run(""); };
    input.oninput = () => { clearTimeout(state.timer); if (input.value.trim().length >= 4) state.timer = setTimeout(() => searchPlaces(panel, input.value), 550); };
    panel.querySelectorAll("[data-category]").forEach(button => button.onclick = () => run(button.dataset.category));
    panel.querySelectorAll("[data-context]").forEach(button => button.onclick = () => run(button.dataset.context));
    bindPlaces(panel);
  }
  function renderPlan(panel) {
    const prefs = read(PREFS_KEY, { mode:"drive", route:"fastest", tolls:false, motorways:false, ferries:false });
    panel.innerHTML = `<section class="nav-smart-hero"><small>JOURNEY PLANNER</small><h2>Build the journey before you leave</h2><p>Plan ordinary drives, airport transfers and holiday journeys with stops and sensible route preferences.</p></section><div class="nav-plan-grid"><section><h3>Journey details</h3><label>Destination<input class="plan-destination" placeholder="Address, hotel, resort or attraction"></label><div class="plan-row"><label>Leave or arrive<select class="plan-time-mode"><option value="leave">Leave at</option><option value="arrive">Arrive by</option></select></label><label>Date and time<input class="plan-time" type="datetime-local"></label></div><label>Stops<textarea class="plan-stops" placeholder="One stop per line: fuel, hotel, airport parking…"></textarea></label></section><section><h3>Route intelligence</h3><div class="route-choice">${["fastest","shortest","efficient","scenic"].map(value => `<button data-route-choice="${value}" class="${prefs.route === value ? "active" : ""}">${value}</button>`).join("")}</div><div class="route-switches"><label><input type="checkbox" data-pref="tolls" ${prefs.tolls ? "checked" : ""}> Avoid tolls</label><label><input type="checkbox" data-pref="motorways" ${prefs.motorways ? "checked" : ""}> Avoid motorways</label><label><input type="checkbox" data-pref="ferries" ${prefs.ferries ? "checked" : ""}> Avoid ferries</label></div><div class="route-readiness"><strong>Sentinel will check</strong><span>Traffic and delays</span><span>Weather along the route</span><span>Fuel, charging and useful stops</span><span>Parking and arrival context</span></div></section></div><button class="nav-plan-start">Send to Journey</button>`;
    const planDestination = panel.querySelector(".plan-destination");
    attachAutocomplete(planDestination, planDestination.parentElement);
    panel.querySelectorAll("[data-route-choice]").forEach(button => button.onclick = () => { prefs.route = button.dataset.routeChoice; localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); renderPlan(panel); });
    panel.querySelectorAll("[data-pref]").forEach(input => input.onchange = () => { prefs[input.dataset.pref] = input.checked; localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); });
    panel.querySelector(".nav-plan-start").onclick = () => {
      const destination = panel.querySelector(".plan-destination").value.trim();
      if (!destination) { panel.querySelector(".plan-destination").focus(); return; }
      sendToJourney({ name:destination, address:destination });
    };
  }
  function activate(tab) {
    state.tab = tab;
    const view = document.querySelector(".navigation-view"), panel = view?.querySelector(".navigation-smart-panel");
    if (!view || !panel) return;
    view.querySelectorAll(".navigation-centre-tabs button").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
    [...view.children].forEach(child => { if (!child.matches(".navigation-heading,.navigation-centre-tabs,.navigation-smart-panel")) child.style.display = tab === "journey" ? "" : "none"; });
    panel.style.display = tab === "journey" ? "none" : "";
    if (tab === "plan") renderPlan(panel); else if (tab === "places") renderPlaces(panel); else if (tab === "journey") setTimeout(() => { const input = navigationInput(); if (input) attachAutocomplete(input, input.closest(".navigation-search") || input.parentElement); }, 50);
  }
  function enhance() {
    const view = document.querySelector(".navigation-view");
    if (!view || view.dataset.smartNavigation) return;
    view.dataset.smartNavigation = "true";
    const heading = view.querySelector(".navigation-heading");
    const tabs = document.createElement("nav"); tabs.className = "navigation-centre-tabs"; tabs.innerHTML = '<button data-tab="journey">Journey</button><button data-tab="plan">Plan</button><button data-tab="places">Places</button>';
    const panel = document.createElement("section"); panel.className = "navigation-smart-panel";
    (heading || view.firstElementChild)?.insertAdjacentElement("afterend", tabs); tabs.insertAdjacentElement("afterend", panel);
    tabs.querySelectorAll("button").forEach(button => button.onclick = () => activate(button.dataset.tab));
    activate("journey");
  }
  new MutationObserver(enhance).observe(document.documentElement, { childList:true, subtree:true });
  setInterval(enhance, 1000); enhance();
})();
