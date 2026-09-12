(() => {
  "use strict";
  let session = [], projectRefs = [], context = null, activeRoot = null, rendering = false;
  const projectExtensions = new Set(["ptx", "ptf", "aaf", "omf", "als", "logicx", "flp", "rpp"]);
  const extension = file => (file.name.split(".").pop() || "").toLowerCase();
  function enhance() {
    document.querySelectorAll(".sas-input").forEach(input => {
      input.multiple = true;
      input.accept = "audio/*,.wav,.wave,.aif,.aiff,.flac,.mp3,.m4a,.aac,.ogg,.ptx,.ptf,.aaf,.omf,.als,.logicx,.flp,.rpp";
      if (input.dataset.sessionReady) return;
      input.dataset.sessionReady = "true";
      const root = input.closest(".sas-backdrop");
      const hint = root?.querySelector(".sas-file span");
      if (hint) hint.textContent = "Import a mix, multiple stems, exported WAV/AIFF files, or retain a DAW project as a session reference.";
    });
  }
  async function decode(file) {
    context ||= new AudioContext();
    return context.decodeAudioData(await file.arrayBuffer());
  }
  function sample(buffer, channel, frame, targetRate) {
    const source = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));
    const position = frame * buffer.sampleRate / targetRate, left = Math.floor(position), right = Math.min(source.length - 1, left + 1), mix = position - left;
    return (source[left] || 0) * (1 - mix) + (source[right] || 0) * mix;
  }
  function mixedBuffer() {
    const audible = session.filter(stem => !stem.muted && (!session.some(item => item.solo) || stem.solo));
    if (!audible.length) return null;
    const rate = Math.max(...audible.map(stem => stem.buffer.sampleRate));
    const duration = Math.max(...audible.map(stem => stem.buffer.duration));
    const length = Math.ceil(duration * rate), output = context.createBuffer(2, length, rate);
    const left = output.getChannelData(0), right = output.getChannelData(1);
    for (const stem of audible) {
      const gain = Math.pow(10, stem.gain / 20), angle = (stem.pan + 1) * Math.PI / 4, leftGain = Math.cos(angle) * gain, rightGain = Math.sin(angle) * gain;
      for (let frame = 0; frame < length; frame++) {
        const l = sample(stem.buffer, 0, frame, rate), r = stem.buffer.numberOfChannels > 1 ? sample(stem.buffer, 1, frame, rate) : l;
        left[frame] += l * leftGain; right[frame] += r * rightGain;
      }
    }
    let peak = 0; for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    const safety = peak > .98 ? .98 / peak : 1; if (safety < 1) for (let i = 0; i < length; i++) { left[i] *= safety; right[i] *= safety; }
    return output;
  }
  function wav(buffer) {
    const channels = buffer.numberOfChannels, length = 44 + buffer.length * channels * 2, bytes = new ArrayBuffer(length), view = new DataView(bytes);
    const word = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    word(0, "RIFF"); view.setUint32(4, length - 8, true); word(8, "WAVEfmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); word(36, "data"); view.setUint32(40, length - 44, true);
    let offset = 44; for (let frame = 0; frame < buffer.length; frame++) for (let channel = 0; channel < channels; channel++) { const value = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[frame])); view.setInt16(offset, value < 0 ? value * 32768 : value * 32767, true); offset += 2; }
    return new Blob([bytes], { type: "audio/wav" });
  }
  async function feedMasteringEngine(root) {
    if (rendering) return; rendering = true;
    try {
      const buffer = mixedBuffer(); if (!buffer) return;
      const blob = wav(buffer), file = new File([blob], session.length === 1 ? session[0].file.name.replace(/\.[^.]+$/, "") + "-mix.wav" : `Sentinel-${session.length}-stem-mix.wav`, { type: "audio/wav" });
      const input = root.querySelector(".sas-input"), transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
      const event = new Event("change", { bubbles: true }); event.sentinelMixed = true; input.dispatchEvent(event);
    } finally { rendering = false; }
  }
  function renderSession(root) {
    root.querySelector(".sas-session-panel")?.remove();
    if (!session.length && !projectRefs.length) return;
    const panel = document.createElement("section"); panel.className = "sas-session-panel";
    panel.innerHTML = `<header><div><small>SESSION WORKSPACE</small><h2>${session.length > 1 ? `${session.length}-stem mix` : "Audio session"}</h2></div><span>${projectRefs.length ? `${projectRefs.length} project reference${projectRefs.length === 1 ? "" : "s"}` : "Local processing"}</span></header><div class="sas-stem-list">${session.map((stem, index) => `<article data-stem="${index}"><div><strong>${stem.file.name}</strong><small>${stem.buffer.numberOfChannels} ch · ${stem.buffer.sampleRate} Hz · ${stem.buffer.duration.toFixed(1)}s</small></div><label>Gain <input data-gain type="range" min="-24" max="12" step="0.5" value="${stem.gain}"><b>${stem.gain} dB</b></label><label>Pan <input data-pan type="range" min="-1" max="1" step="0.05" value="${stem.pan}"><b>${stem.pan === 0 ? "C" : stem.pan < 0 ? "L" : "R"}</b></label><button data-mute class="${stem.muted ? "active" : ""}">M</button><button data-solo class="${stem.solo ? "active" : ""}">S</button><button data-remove>×</button></article>`).join("")}</div>${projectRefs.length ? `<div class="sas-project-refs"><strong>DAW project references</strong>${projectRefs.map(file => `<span>▣ ${file.name}<small>${extension(file).toUpperCase()} · reference only</small></span>`).join("")}<p>Proprietary project files are retained as references. Export or consolidate their tracks as WAV/AIFF stems for Sentinel to process the audio.</p></div>` : ""}<footer><button class="sas-remix">Refresh stem mix</button><span>All stems are decoded and mixed locally on this computer.</span></footer>`;
    root.querySelector(".sas-import")?.insertAdjacentElement("afterend", panel);
    panel.querySelectorAll("[data-stem]").forEach(row => {
      const stem = session[Number(row.dataset.stem)], refresh = () => feedMasteringEngine(root);
      row.querySelector("[data-gain]").oninput = event => { stem.gain = Number(event.target.value); row.querySelector("[data-gain]+b").textContent = `${stem.gain} dB`; };
      row.querySelector("[data-gain]").onchange = refresh;
      row.querySelector("[data-pan]").oninput = event => { stem.pan = Number(event.target.value); row.querySelector("[data-pan]+b").textContent = stem.pan === 0 ? "C" : stem.pan < 0 ? `L ${Math.round(Math.abs(stem.pan) * 100)}` : `R ${Math.round(stem.pan * 100)}`; };
      row.querySelector("[data-pan]").onchange = refresh;
      row.querySelector("[data-mute]").onclick = () => { stem.muted = !stem.muted; renderSession(root); refresh(); };
      row.querySelector("[data-solo]").onclick = () => { stem.solo = !stem.solo; renderSession(root); refresh(); };
      row.querySelector("[data-remove]").onclick = () => { session.splice(Number(row.dataset.stem), 1); renderSession(root); refresh(); };
    });
    panel.querySelector(".sas-remix")?.addEventListener("click", () => feedMasteringEngine(root));
  }
  document.addEventListener("change", async event => {
    const input = event.target.closest?.(".sas-input"); if (!input || event.sentinelMixed) return;
    const files = [...input.files]; if (!files.length) return;
    event.preventDefault(); event.stopImmediatePropagation(); activeRoot = input.closest(".sas-backdrop");
    projectRefs = files.filter(file => projectExtensions.has(extension(file)));
    const audioFiles = files.filter(file => !projectExtensions.has(extension(file)));
    const status = activeRoot.querySelector(".sas-status"); if (status) status.textContent = `Decoding ${audioFiles.length} audio file${audioFiles.length === 1 ? "" : "s"} locally…`;
    const decoded = [];
    for (const file of audioFiles.slice(0, 24)) { try { decoded.push({ file, buffer: await decode(file), gain: 0, pan: 0, muted: false, solo: false }); } catch {} }
    session = decoded; renderSession(activeRoot);
    if (session.length) await feedMasteringEngine(activeRoot);
    else if (status) { status.textContent = "Project reference loaded. Export its tracks as WAV or AIFF stems to begin audio processing."; status.classList.add("sas-warn"); }
  }, true);
  new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true }); enhance();
})();
