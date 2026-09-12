(() => {
  "use strict";

  const sections = [
    ["1. First launch and developer password", "Complete First-Time Setup before using Sentinel. Create a developer password you will remember: it protects sensitive setup, repair and update actions. Home and Settings always remain available."],
    ["2. Connect the six core services", "Open Settings > Setup Centre > Core setup. Configure OpenAI for chat and voice, Google Maps for maps and places, WeatherAPI for forecasts, FlyStack Aviation for booked-flight status, OpenSky Network for live aircraft radar, and Cloudflare Relay for protected remote, companion and Alexa connections. Save Core setup when the counter shows the expected services."],
    ["3. Optional modules and new integrations", "Use Setup Centre > Modules for dedicated Amazon Alexa and Ring setup. Use Integration builder for another supported provider: enter its name, choose Smart home, Security or Other service, then paste the provider's API key or token. Sentinel creates the correct module area; provider-specific command mapping may still be required before controls become active."],
    ["4. Experience, appearance and visible pages", "Open Experience to select a colour theme, accent intensity, sound, motion, window and startup behaviour. Visible pages is inside Experience, letting each user hide optional pages without deleting their data. You can also disable the cinematic startup sequence."],
    ["5. Chat and voice", "Chat supports text, images and files. Selected attachments appear before sending and remain visible in the conversation; an image can be sent without extra text. Quick-action buttons send immediately. Voice mode listens until you stop speaking, then submits the command automatically."],
    ["6. Navigation", "Journey provides the live map and return-to-location control. Plan builds timed journeys with route preferences and stops; its destination field suggests nearby and relevant places as you type. Places searches locally first, while still supporting hotels, resorts, airports and attractions for holidays abroad."],
    ["7. Travel", "Ready to go stores the arrival airport, accommodation and dates, then builds a departure checklist and briefing. Destination shows arrival intelligence, transfer context and recommendations around the hotel. Flight tracker contains live aircraft radar, flight-number search and a collapsible Upcoming flights list for saved journeys."],
    ["8. Network Centre", "Network Centre replaces Device Scanner. With Developer Mode unlocked it can discover devices, maintain a trusted inventory and flag unfamiliar hardware. Its Diagnostics area checks latency, connectivity and speed, then offers safe improvement actions without changing router security automatically."],
    ["9. Media Control", "Choose which media services are shown, open connected services and control supported local playback. Volume changes in five-point steps. Availability depends on the service and the controls exposed by Windows or that provider."],
    ["10. Weather", "Current and Hourly show conditions relative to now. Weekly opens a selected day in a larger vertical panel with that day's hourly temperatures; click outside to close it. Radar includes an intensity key, animated playback and a return-to-current-location button."],
    ["11. Notifications and self-diagnosis", "Notifications collects important Sentinel events away from System Control. Quick self-diagnosis checks the critical services, keys, location, backend and desktop bridge, then explains safe repairs. Review any repair before approving it."],
    ["12. Amazon Alexa, Ring and remote access", "Alexa and Ring use their dedicated setup flows. Cloudflare Relay can pair Base installations and companion access without sharing another user's private settings. Amazon restrictions mean Sentinel can only expose controls supported by the configured skill and relay."],
    ["13. Cloud updates", "Sentinel Base checks for signed published updates at startup. Depending on the publisher policy, users can install now, install later or decline. Installing requires that user's developer password. Successfully installed versions are remembered so the same prompt is not repeatedly shown."],
    ["14. Privacy, reset and troubleshooting", "API keys and personal settings stay on the current computer unless a feature clearly says otherwise. Refresh Sentinel permanently removes personal settings, keys and the developer password after a warning and password check. If a feature fails, restart Sentinel, run Quick self-diagnosis, confirm its required service in Core setup, then check the relevant module."],
  ];

  function refreshGuide() {
    document.querySelectorAll(".sentinel-guide-content").forEach((guide) => {
      if (guide.dataset.sentinelGuideVersion === "2026-08-20") return;
      guide.replaceChildren(...sections.map(([title, text]) => {
        const article = document.createElement("article");
        const heading = document.createElement("h3");
        const paragraph = document.createElement("p");
        heading.textContent = title;
        paragraph.textContent = text;
        article.append(heading, paragraph);
        return article;
      }));
      guide.dataset.sentinelGuideVersion = "2026-08-20";
    });
  }

  function removeIntegrationNote() {
    document.querySelectorAll(".guided-special-connections").forEach((note) => {
      if (note.textContent.includes("Amazon Alexa and Ring stay in Modules")) note.remove();
    });
  }

  let scheduled = false;
  function refresh() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      refreshGuide();
      removeIntegrationNote();
    });
  }

  new MutationObserver(refresh).observe(document.documentElement, { childList: true, subtree: true });
  refresh();
})();
