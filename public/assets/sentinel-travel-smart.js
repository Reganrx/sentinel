(() => {
  "use strict";
  const API = "http://localhost:3001";
  const HOTEL_KEY = "sentinel-travel-hotels-v1";
  const airports = [
    ["LHR", "London Heathrow Airport"], ["LGW", "London Gatwick Airport"], ["STN", "London Stansted Airport"],
    ["LTN", "London Luton Airport"], ["LCY", "London City Airport"], ["MAN", "Manchester Airport"],
    ["BHX", "Birmingham Airport"], ["BRS", "Bristol Airport"], ["EDI", "Edinburgh Airport"],
    ["GLA", "Glasgow Airport"], ["JFK", "New York John F. Kennedy Airport"], ["EWR", "Newark Liberty Airport"],
    ["LAX", "Los Angeles International Airport"], ["MCO", "Orlando International Airport"], ["CDG", "Paris Charles de Gaulle Airport"],
    ["ORY", "Paris Orly Airport"], ["AMS", "Amsterdam Schiphol Airport"], ["BCN", "Barcelona El Prat Airport"],
    ["PMI", "Palma de Mallorca Airport"], ["AGP", "Málaga Airport"], ["ALC", "Alicante Airport"],
    ["FAO", "Faro Airport"], ["TFS", "Tenerife South Airport"], ["DXB", "Dubai International Airport"],
    ["AUH", "Abu Dhabi International Airport"], ["SIN", "Singapore Changi Airport"], ["SYD", "Sydney Airport"]
  ];
  const q = (selector, root = document) => (root || document).querySelector(selector);
  const hotelStore = () => { try { return JSON.parse(localStorage.getItem(HOTEL_KEY) || "{}"); } catch { return {}; } };
  const normalise = value => String(value || "").trim().toLowerCase();
  const setReactValue = (input, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  async function searchPlaces(query) {
    if (query.trim().length < 2) return [];
    try {
      const response = await fetch(`${API}/navigation/search?q=${encodeURIComponent(query.trim())}`);
      if (!response.ok) return [];
      return (await response.json()).slice(0, 6);
    } catch { return []; }
  }
  async function searchTravelPlaces(query) {
    if (query.trim().length < 2) return [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`${API}/travel/search-places?q=${encodeURIComponent(query.trim())}`);
        if (response.ok) return (await response.json()).slice(0, 9);
      } catch {}
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 450 * (attempt + 1)));
    }
    return searchPlaces(query);
  }
  function localAirports(query) {
    const term = normalise(query);
    return airports.filter(([code, name]) => `${code} ${name}`.toLowerCase().includes(term)).slice(0, 6)
      .map(([code, name]) => ({ name, code, kind: "Airport", value: code }));
  }
  function closeMenus(except) { document.querySelectorAll(".travel-smart-results").forEach(menu => { if (menu !== except) menu.remove(); }); }
  function renderResults(input, results, onSelect) {
    closeMenus();
    if (!results.length) return;
    const menu = document.createElement("div");
    menu.className = "travel-smart-results";
    results.forEach((result, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.index = String(index);
      button.innerHTML = `<i>${result.kind === "Airport" ? "✈" : result.kind === "Hotel" ? "⌂" : "⌖"}</i><span><strong>${result.name}</strong><small>${result.code ? `${result.code} · ` : ""}${result.kind}${result.detail ? ` · ${result.detail}` : ""}</small></span>`;
      button.addEventListener("mousedown", event => { event.preventDefault(); onSelect(result); menu.remove(); });
      menu.appendChild(button);
    });
    const box = input.getBoundingClientRect();
    menu.style.left = `${box.left}px`; menu.style.top = `${box.bottom + 6}px`; menu.style.width = `${Math.max(box.width, 330)}px`;
    document.body.appendChild(menu);
  }
  function enhanceInput(input, mode) {
    if (!input || input.dataset.travelSmart) return;
    input.dataset.travelSmart = mode;
    input.autocomplete = "off";
    let timer = 0, request = 0, active = -1;
    input.addEventListener("input", () => {
      clearTimeout(timer); active = -1;
      const value = input.value;
      timer = window.setTimeout(async () => {
        const id = ++request;
        let results = [];
        if (mode === "airport" || mode === "arrival") {
          results = localAirports(value).map(result => mode === "arrival" ? { ...result, value: `${result.code} - ${result.name}` } : result);
          if (value.trim().length >= 3 && results.length < 4) {
            const remote = await searchPlaces(`${value} airport`);
            results.push(...remote.map(place => ({ name: place.name, kind: "Airport", detail: "Live location", value: place.name })));
          }
        } else {
          const remote = await searchTravelPlaces(value);
          results = remote.map(place => ({ name: place.name, kind: /hotel|resort|inn|spa|apart/i.test(`${place.name} ${place.category} ${place.resultType}`) ? "Hotel" : mode === "hotel" ? "Resort or hotel" : "Destination", detail: [place.resultType || place.category, place.rating ? `${place.rating} ★` : "", place.address && place.address !== place.name ? place.address : ""].filter(Boolean).join(" · "), value: place.name }));
        }
        if (id !== request || document.activeElement !== input) return;
        renderResults(input, results.slice(0, 7), result => { setReactValue(input, result.value); input.dataset.selectedName = result.name; });
      }, 260);
    });
    input.addEventListener("keydown", event => {
      const menu = q(".travel-smart-results"); if (!menu) return;
      const items = [...menu.querySelectorAll("button")];
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); active = Math.max(0, Math.min(items.length - 1, active + (event.key === "ArrowDown" ? 1 : -1))); items.forEach((item, i) => item.classList.toggle("active", i === active)); }
      if (event.key === "Enter" && active >= 0) { event.preventDefault(); items[active].dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); }
      if (event.key === "Escape") closeMenus();
    });
    input.addEventListener("blur", () => window.setTimeout(() => closeMenus(), 140));
  }
  function ensureHotelField(form, destinationInput) {
    const host = form || destinationInput.parentElement;
    if (!host || host.dataset.travelSubmitting === "true" || q(".travel-hotel-field", host)) return;
    const label = document.createElement("label");
    label.className = "travel-hotel-field";
    label.innerHTML = 'Hotel / accommodation<input placeholder="Start typing a hotel or resort" autocomplete="off"><small>Optional · saved with this destination</small>';
    destinationInput.insertAdjacentElement("afterend", label);
    const hotelInput = q("input", label);
    enhanceInput(hotelInput, "hotel");
    const saveHotel = () => {
      const destination = destinationInput.value.trim(), hotel = hotelInput.value.trim();
      if (!destination || !hotel) return;
      const data = hotelStore(); data[normalise(destination)] = hotel;
      localStorage.setItem(HOTEL_KEY, JSON.stringify(data));
    };
    const prepareSubmit = () => {
      saveHotel();
      host.dataset.travelSubmitting = "true";
      label.remove();
      window.setTimeout(() => { delete host.dataset.travelSubmitting; enhance(); }, 1800);
    };
    form?.addEventListener("submit", prepareSubmit, { capture: true, once: true });
    const addButton = [...host.querySelectorAll("button")].find(button => /add trip/i.test(button.textContent || ""));
    if (!form) addButton?.addEventListener("click", prepareSubmit, { capture: true, once: true });
  }
  function showSavedHotel() {
    const hero = q(".travel-hero-copy"); if (!hero) return;
    const heading = q("h2", hero); if (!heading || /No destination/i.test(heading.textContent)) return;
    const hotel = hotelStore()[normalise(heading.textContent)];
    let card = q(".travel-saved-hotel", hero);
    if (!hotel) { card?.remove(); return; }
    if (!card) { card = document.createElement("div"); card.className = "travel-saved-hotel"; hero.appendChild(card); }
    if (card.dataset.hotel !== hotel) {
      card.dataset.hotel = hotel;
      card.innerHTML = `<i>⌂</i><span><small>YOUR HOTEL</small><strong>${hotel}</strong></span>`;
    }
  }
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const formatValue = (value, suffix = "") => value === undefined || value === null || value === "" ? "—" : `${Number.isFinite(Number(value)) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 }) : value}${suffix}`;
  const haversineKm = (a, b) => {
    if (![a?.latitude, a?.longitude, b?.latitude, b?.longitude].every(value => Number.isFinite(Number(value)))) return null;
    const radians = value => Number(value) * Math.PI / 180;
    const dLat = radians(b.latitude - a.latitude), dLon = radians(b.longitude - a.longitude);
    const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  };
  async function resolvePlace(query) {
    const results = await searchTravelPlaces(query);
    return results.find(item => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))) || results[0] || null;
  }
  async function resolveAccommodation(hotel, destination, arrival) {
    if (!hotel) return null;
    const searches = [`${hotel}, ${destination}`, `${hotel} near ${destination}`, hotel];
    for (const query of searches) {
      const results = await searchTravelPlaces(query);
      const ranked = results
        .filter(item => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)))
        .map(item => ({
          item,
          hotelMatch: normalise(`${item.name} ${item.address || ""}`).includes(normalise(hotel)),
          distanceFromArrival: haversineKm(arrival, item),
        }))
        .filter(candidate => candidate.distanceFromArrival === null || candidate.distanceFromArrival > 0.15)
        .sort((a, b) => Number(b.hotelMatch) - Number(a.hotelMatch) || (a.distanceFromArrival ?? Infinity) - (b.distanceFromArrival ?? Infinity));
      if (ranked[0]?.item) return ranked[0].item;
    }
    return null;
  }
  function ensureDestinationIntelligence() {
    const page = q(".travel-subpage:not(.travel-flight-page)");
    const discover = page && q(".travel-discover", page);
    const heroHeading = page && q(".travel-hero-copy h2", page);
    if (!page || !discover || !heroHeading || /no destination/i.test(heroHeading.textContent || "")) return;
    const destination = heroHeading.textContent.trim();
    const hotel = hotelStore()[normalise(destination)] || q(".travel-saved-hotel strong", page)?.textContent?.trim() || "";
    const signature = `${destination}|${hotel}`;
    let panel = q(".travel-intelligence", page);
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "travel-intelligence";
      discover.insertAdjacentElement("beforebegin", panel);
    }
    if (panel.dataset.signature === signature) return;
    panel.dataset.signature = signature;
    panel.innerHTML = '<div class="travel-intelligence-head"><div><small>DESTINATION INTELLIGENCE</small><h3>Building your arrival brief…</h3></div><span class="travel-intelligence-pulse"></span></div>';
    resolvePlace(destination).then(async arrival => [arrival, await resolveAccommodation(hotel, destination, arrival)]).then(([arrival, accommodation]) => {
      if (!panel.isConnected || panel.dataset.signature !== signature) return;
      const distance = haversineKm(arrival, accommodation);
      panel.innerHTML = `
        <div class="travel-intelligence-head"><div><small>DESTINATION INTELLIGENCE</small><h3>Your arrival at a glance</h3></div><span class="travel-intelligence-live">READY</span></div>
        <div class="travel-intelligence-grid">
          <article><b>✈</b><span><small>ARRIVAL POINT</small><strong>${escapeHtml(arrival?.name || destination)}</strong><em>${escapeHtml(arrival?.address || "Saved destination")}</em></span></article>
          <article><b>⌂</b><span><small>ACCOMMODATION</small><strong>${escapeHtml(hotel || "Not added yet")}</strong><em>${escapeHtml(accommodation?.address || (hotel ? "Saved with this trip" : "Add a hotel in Ready to go"))}</em></span></article>
          <article><b>↗</b><span><small>ARRIVAL TRANSFER</small><strong>${distance === null ? "Route pending" : `About ${distance.toFixed(distance < 10 ? 1 : 0)} km`}</strong><em>${distance === null ? "Add both locations to calculate" : "Straight-line distance · road travel will be longer"}</em></span></article>
        </div>
        <div class="travel-intelligence-actions">
          <button type="button" data-action="hotel">Explore near hotel</button>
          <button type="button" data-action="food">Find restaurants</button>
          <button type="button" data-action="things">Things to do</button>
        </div>`;
      panel.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
        const action = button.dataset.action;
        const phrase = action === "food" ? "restaurants near" : action === "things" ? "things to do near" : "places near";
        const anchor = hotel || accommodation?.name || arrival?.name || destination;
        const query = `${phrase} ${anchor}`;
        const search = q('input, textarea', discover);
        if (search) {
          setReactValue(search, query);
          search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
        }
        const category = action === "food" ? "Restaurants" : action === "things" ? "Things To Do" : "Hidden Gems";
        [...discover.querySelectorAll("button")].find(item => normalise(item.textContent) === normalise(category))?.click();
        const trigger = [...discover.querySelectorAll("button")].find(item => /find|recommend|discover|search|explore/i.test(item.textContent || ""));
        window.setTimeout(() => trigger?.click(), 40);
        discover.scrollIntoView({ behavior: "smooth", block: "start" });
      }));
    }).catch(() => {
      if (panel.isConnected) panel.innerHTML = '<div class="travel-intelligence-head"><div><small>DESTINATION INTELLIGENCE</small><h3>Saved trip ready</h3><p>Live place details are temporarily unavailable.</p></div></div>';
    });
  }
  function ensureFlightRadar() {
    const page = q(".travel-flight-page");
    if (!page || q(".sentinel-flight-radar", page)) return;
    const flightManagement = q(".travel-flight-management", page);
    const savedFlights = q(".travel-flights", page);
    const radar = document.createElement("section");
    radar.className = "sentinel-flight-radar";
    radar.innerHTML = `
      <div class="flight-radar-heading">
        <div><small>LIVE AVIATION</small><h2>Sentinel flight radar</h2><p>Track any active flight without adding it to a trip.</p></div>
        <span class="flight-radar-provider">DAILY TRACKER</span>
      </div>
      <form class="flight-radar-search">
        <label>Flight number<input name="flight" autocomplete="off" placeholder="e.g. BA283 or EZY6512"></label>
        <button type="submit">Track flight</button>
      </form>
      <div class="flight-radar-body">
        <div class="flight-radar-scope">
          <div class="flight-radar-rings"></div><div class="flight-radar-sweep"></div>
          <div class="flight-radar-plane" hidden>✈</div>
          <div class="flight-radar-idle"><strong>RADAR STANDBY</strong><span>Enter a flight number to scan live aviation signals</span></div>
        </div>
        <div class="flight-radar-telemetry">
          <div class="flight-radar-status"><small>STATUS</small><strong>Ready to search</strong><span>No flight selected</span></div>
          <div class="flight-radar-metrics">
            <article><small>ALTITUDE</small><strong data-metric="altitude">—</strong></article>
            <article><small>GROUND SPEED</small><strong data-metric="speed">—</strong></article>
            <article><small>HEADING</small><strong data-metric="heading">—</strong></article>
            <article><small>LAST SIGNAL</small><strong data-metric="updated">—</strong></article>
          </div>
        </div>
      </div>`;
    (flightManagement || savedFlights || page.firstElementChild)?.insertAdjacentElement(flightManagement || savedFlights ? "beforebegin" : "afterend", radar);
    const form = q("form", radar), input = q("input", radar), plane = q(".flight-radar-plane", radar), idle = q(".flight-radar-idle", radar);
    const status = q(".flight-radar-status", radar), provider = q(".flight-radar-provider", radar);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const number = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (number.length < 3) { status.innerHTML = "<small>CHECK ENTRY</small><strong>Enter a valid flight number</strong><span>Try BA283 or EZY6512</span>"; return; }
      input.value = number; radar.classList.add("is-scanning"); plane.hidden = true;
      idle.innerHTML = `<strong>SCANNING ${escapeHtml(number)}</strong><span>Checking live and scheduled aviation sources…</span>`;
      status.innerHTML = `<small>SEARCHING</small><strong>${escapeHtml(number)}</strong><span>Contacting aviation services</span>`;
      try {
        const response = await fetch(`${API}/travel/flights/${encodeURIComponent(number)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Flight lookup failed");
        const live = Boolean(data.live || (data.latitude != null && data.longitude != null));
        provider.textContent = data.provider || "AVIATION DATA";
        status.innerHTML = `<small>${live ? "LIVE FLIGHT" : "FLIGHT STATUS"}</small><strong>${escapeHtml(data.number || number)} · ${escapeHtml(data.status || "Status received")}</strong><span>${escapeHtml([data.departure, data.arrival].filter(Boolean).join(" → ") || (live ? "Aircraft signal acquired" : "No active aircraft signal found"))}</span>`;
        idle.innerHTML = live ? `<strong>${escapeHtml(data.number || number)}</strong><span>${escapeHtml(data.status || "Live airborne")}</span>` : `<strong>NOT CURRENTLY AIRBORNE</strong><span>${escapeHtml(number)} is not broadcasting a live position right now</span>`;
        plane.hidden = !live;
        if (live) {
          const x = 18 + Math.abs(Number(data.longitude || 0) * 7) % 65, y = 18 + Math.abs(Number(data.latitude || 0) * 5) % 62;
          plane.style.left = `${x}%`; plane.style.top = `${y}%`; plane.style.transform = `translate(-50%, -50%) rotate(${Number(data.heading || 0) - 45}deg)`;
        }
        q('[data-metric="altitude"]', radar).textContent = data.altitude == null ? "—" : `${formatValue(Number(data.altitude) * 3.28084, " ft")}`;
        q('[data-metric="speed"]', radar).textContent = data.speed == null ? "—" : `${formatValue(Number(data.speed) * 1.94384, " kt")}`;
        q('[data-metric="heading"]', radar).textContent = data.heading == null ? "—" : `${formatValue(data.heading, "°")}`;
        q('[data-metric="updated"]', radar).textContent = data.updatedAt ? new Date(Number(data.updatedAt) < 1e12 ? Number(data.updatedAt) * 1000 : data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
      } catch (error) {
        provider.textContent = "RADAR OFFLINE"; idle.innerHTML = "<strong>SIGNAL UNAVAILABLE</strong><span>Your saved trips have not been affected</span>";
        status.innerHTML = `<small>LOOKUP FAILED</small><strong>Could not reach live aviation</strong><span>${escapeHtml(error.message || "Try again shortly")}</span>`;
      } finally { radar.classList.remove("is-scanning"); }
    });
  }
  function ensureUpcomingFlightsDropdown() {
    const flights = q(".travel-flight-page .travel-flights");
    if (!flights) return;
    const heading = q("h2", flights);
    if (!heading) return;
    flights.dataset.upcomingDropdown = "true";
    const header = heading.parentElement;
    header?.classList.add("travel-upcoming-header");
    if (q(".travel-upcoming-toggle", header)) return;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "travel-upcoming-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = '<span>Show flights</span><i>⌄</i>';
    header?.appendChild(toggle);
    const setOpen = open => {
      flights.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.innerHTML = `<span>${open ? "Hide flights" : "Show flights"}</span><i>⌄</i>`;
    };
    toggle.addEventListener("click", () => setOpen(!flights.classList.contains("is-open")));
    setOpen(false);
  }
  function enhance() {
    const destination = q('input[placeholder="Destination city or resort"], input[data-travel-smart="arrival"]');
    if (destination) {
      destination.placeholder = "Arrival airport or airport code";
      enhanceInput(destination, "arrival");
      ensureHotelField(destination.closest("form"), destination);
    }
    enhanceInput(q('input[placeholder="LHR"]'), "airport");
    enhanceInput(q('input[placeholder="JFK"]'), "airport");
    showSavedHotel();
    ensureDestinationIntelligence();
    ensureFlightRadar();
  }
  document.addEventListener("click", event => { if (!event.target.closest(".travel-smart-results")) closeMenus(); });
  let enhancementQueued = false;
  const scheduleEnhance = () => {
    if (enhancementQueued) return;
    enhancementQueued = true;
    window.requestAnimationFrame(() => { enhancementQueued = false; enhance(); });
  };
  new MutationObserver(scheduleEnhance).observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(enhance, 1000); enhance();
})();
