(() => {
  "use strict";
  const KEY = "sentinel-design-revisions-v2";
  let latest = null, latestMode = null, selectedShape = null;
  const reviewOpen = { foam: false, print: false };
  const toggleStyles = document.createElement("style");
  toggleStyles.textContent = `.design-result{position:relative}.design-review-summary{display:flex;align-items:center;gap:13px}.design-review-toggle{display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid rgba(var(--sentinel-accent-rgb),.35);border-radius:10px;background:rgba(var(--sentinel-accent-rgb),.12);color:#dff8ff;font-size:10px;font-weight:800;cursor:pointer}.design-review-toggle:hover{background:rgba(var(--sentinel-accent-rgb),.2)}.design-review-toggle i{font-size:15px;font-style:normal;transition:transform .2s ease}.design-smart-panel.is-open .design-review-toggle i{transform:rotate(180deg)}.design-smart-body{display:none}.design-smart-panel.is-open .design-smart-body{display:block}.design-smart-panel:not(.is-open){position:relative;z-index:4;top:auto;right:auto;width:min(100%,620px);max-width:100%;margin:12px 0 18px auto;padding:10px 13px}.design-smart-panel:not(.is-open) h3{font-size:15px}.design-smart-panel:not(.is-open) .score{font-size:17px}@media(max-width:1050px){.design-smart-panel:not(.is-open){width:100%;margin:12px 0 18px}}`;
  document.head.appendChild(toggleStyles);
  const editHistory = [];
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const url = String(args[0] || "");
    if (url.includes("/design/generate") && response.ok) {
      response.clone().json().then(design => {
        const mode = document.querySelector(".design-tabs button.active")?.textContent?.includes("3D") ? "print" : "foam";
        latest = design; latestMode = mode;
        const revisions = load();
        revisions.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), mode, design });
        localStorage.setItem(KEY, JSON.stringify(revisions.slice(0, 20)));
        window.setTimeout(enhance, 50);
      }).catch(() => {});
    }
    return response;
  };
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
  function boxes(shape) {
    const radius = shape.radius || shape.width / 2;
    return shape.kind === "circle" ? { x: shape.x - radius, y: shape.y - radius, w: radius * 2, h: radius * 2 } : { x: shape.x, y: shape.y, w: shape.width, h: shape.height };
  }
  function review(design, mode) {
    const warnings = [], positives = [];
    let score = 100;
    if (!design?.shapes?.length) return { score: 0, warnings: ["No geometry has been generated."], positives: [] };
    if (design.needsClarification) { score -= 35; warnings.push("Critical measurements still need clarification."); }
    const { width, height, depth } = design.project || {};
    if (![width, height, depth].every(value => Number(value) > 0)) { score -= 35; warnings.push("Project dimensions are incomplete."); }
    const shapes = design.shapes.map(shape => ({ shape, box: boxes(shape) }));
    shapes.forEach(({ shape, box }) => {
      if ([box.x, box.y, box.w, box.h].some(value => !Number.isFinite(Number(value))) || box.w <= 0 || box.h <= 0) { score -= 18; warnings.push(`${shape.label || "An element"} has invalid geometry.`); }
      if (box.x < 0 || box.y < 0 || box.x + box.w > width || box.y + box.h > height) { score -= 14; warnings.push(`${shape.label || "An element"} crosses the project boundary.`); }
      const edge = Math.min(box.x, box.y, width - box.x - box.w, height - box.y - box.h);
      if (mode === "foam" && edge < 8) { score -= 5; warnings.push(`${shape.label || "A pocket"} is only ${Math.max(0, edge).toFixed(1)} mm from an edge.`); }
      if (mode === "print" && Number(shape.depth || depth) > 80 && Math.min(box.w, box.h) < 4) { score -= 7; warnings.push(`${shape.label || "A feature"} may be too slender to print reliably.`); }
    });
    for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i].box, b = shapes[j].box;
      const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      if (overlap) { score -= mode === "foam" ? 12 : 4; warnings.push(`${shapes[i].shape.label} overlaps ${shapes[j].shape.label}.`); }
    }
    if (!warnings.length) positives.push("No boundary, overlap or critical-dimension problems detected.");
    if (mode === "foam") positives.push("CNC checks include pocket spacing, sheet boundaries and cutter access assumptions.");
    else positives.push("Print checks include feature size, project volume and basic support-risk assumptions.");
    return { score: Math.max(0, Math.min(100, score)), warnings: [...new Set(warnings)].slice(0, 6), positives };
  }
  function setPrompt(text) {
    const area = document.querySelector(".design-composer textarea");
    if (!area) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(area, text); area.dispatchEvent(new Event("input", { bubbles: true })); area.focus();
  }
  function applyPatch(id, patch, remember = true) {
    if (!latest?.shapes) return;
    const shape = latest.shapes.find(item => item.id === id); if (!shape) return;
    if (remember) editHistory.push({ id, patch: Object.fromEntries(Object.keys(patch).map(key => [key, shape[key]])) });
    Object.assign(shape, patch);
    window.dispatchEvent(new CustomEvent("sentinel:design-shape-edit", { detail: { id, patch } }));
    document.querySelector(".design-smart-panel")?.remove(); window.setTimeout(enhance, 20);
  }
  function downloadReport(mode, result) {
    if (!latest) return;
    const shapes = latest.shapes || [], area = Number(latest.project.width) * Number(latest.project.height), occupied = shapes.reduce((sum, shape) => { const box = boxes(shape); return sum + box.w * box.h; }, 0);
    const perimeter = shapes.reduce((sum, shape) => { const box = boxes(shape); return sum + (shape.kind === "circle" ? Math.PI * box.w : 2 * (box.w + box.h)); }, 0);
    const volume = shapes.reduce((sum, shape) => { const box = boxes(shape); return sum + box.w * box.h * Number(shape.depth || latest.project.depth || 0); }, 0);
    const report = { generatedAt: new Date().toISOString(), mode, readinessScore: result.score, project: latest.project, estimates: mode === "foam" ? { sheetUtilisationPercent: area ? occupied / area * 100 : 0, approximateToolpathMm: perimeter, elements: shapes.length } : { primitiveVolumeCm3: volume / 1000, estimatedMaterialGramsAt20PercentInfill: volume / 1000 * 1.24 * .2, elements: shapes.length }, warnings: result.warnings, notes: latest.notes || [], shapes };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }), link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${latest.project.name || "Sentinel-design"}-fabrication-report.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  function showExactEditor(panel, shape) {
    const host = panel.querySelector(".design-exact-editor"); if (!host || !shape) return;
    host.innerHTML = `<label>X mm<input data-field="x" type="number" step="0.1" value="${Number(shape.x || 0)}"></label><label>Y mm<input data-field="y" type="number" step="0.1" value="${Number(shape.y || 0)}"></label><label>Width mm<input data-field="width" type="number" min="0.1" step="0.1" value="${Number(shape.width || 0)}"></label><label>Height mm<input data-field="height" type="number" min="0.1" step="0.1" value="${Number(shape.height || 0)}"></label><button data-apply-exact>Apply geometry</button>`;
    host.querySelector("[data-apply-exact]").onclick = () => { const patch = {}; host.querySelectorAll("[data-field]").forEach(input => patch[input.dataset.field] = Number(input.value)); applyPatch(shape.id, patch); };
  }
  function renderPanel(result, mode) {
    const signature = `${mode}:${result.score}:${latest?.project?.name}:${latest?.shapes?.length}:${latest?.assistantMessage || ""}`;
    const existing = document.querySelector(".design-smart-panel");
    if (existing?.dataset.signature === signature) return;
    existing?.remove();
    const target = document.querySelector(".design-result .design-canvas"); if (!target) return;
    const panel = document.createElement("section"); panel.className = "design-smart-panel"; panel.dataset.signature = signature;
    const revisions = load().filter(item => item.mode === mode);
    const status = result.score >= 85 ? "READY" : result.score >= 60 ? "REVIEW" : "NOT READY";
    panel.innerHTML = `<header><div><small>FABRICATION INTELLIGENCE</small><h3>Readiness review</h3></div><strong class="score score-${status.replace(" ", "-").toLowerCase()}">${result.score}<i>/100</i><span>${status}</span></strong></header><div class="design-smart-grid"><div><h4>Automated checks</h4>${result.warnings.length ? `<ul>${result.warnings.map(item => `<li>${item}</li>`).join("")}</ul>` : `<p class="design-smart-clear">✓ Geometry passed current automated checks.</p>`}</div><div><h4>Revision intelligence</h4><p>${revisions.length} generated revision${revisions.length === 1 ? "" : "s"} retained locally.</p><div class="design-smart-actions"><button data-smart-prompt="Check every measurement, collision, edge clearance and fabrication risk. Ask me for anything missing before changing the design.">Deep validation</button><button data-smart-prompt="Optimise this layout for material use while preserving safe clearances and all required dimensions.">Optimise layout</button><button data-smart-prompt="Create a fabrication plan with tool choice, operation order, tolerances and final safety checks for this design.">Build plan</button><button data-undo-edit>Undo edit</button><button data-download-report>Export report</button></div></div></div><div class="design-precision"><span><b>Precision editor</b><small>Click or drag a generated shape, or enter exact dimensions.</small></span><div><button data-direct="x:-5">← 5 mm</button><button data-direct="x:5">5 mm →</button><button data-direct="y:-5">↑ 5 mm</button><button data-direct="y:5">↓ 5 mm</button><button data-nudge="Increase the clearance around {shape} by 2 mm and recheck collisions.">AI clearance</button></div></div><div class="design-exact-editor"><span>Select a generated shape to edit exact geometry.</span></div>`;
    const header = panel.querySelector("header");
    const body = document.createElement("div"); body.className = "design-smart-body";
    while (header.nextSibling) body.appendChild(header.nextSibling);
    panel.appendChild(body);
    const summary = document.createElement("div"); summary.className = "design-review-summary";
    const score = header.querySelector(".score"); if (score) summary.appendChild(score);
    const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "design-review-toggle";
    const syncToggle = () => { panel.classList.toggle("is-open", reviewOpen[mode]); toggle.setAttribute("aria-expanded", String(reviewOpen[mode])); toggle.innerHTML = `${reviewOpen[mode] ? "Close review" : "Open review"}<i>⌄</i>`; };
    toggle.onclick = () => { reviewOpen[mode] = !reviewOpen[mode]; syncToggle(); };
    summary.appendChild(toggle); header.appendChild(summary); syncToggle();
    target.insertAdjacentElement("beforebegin", panel);
    panel.querySelectorAll("[data-smart-prompt]").forEach(button => button.addEventListener("click", () => setPrompt(button.dataset.smartPrompt)));
    let selected = "the selected feature";
    document.querySelectorAll(".design-canvas > i").forEach(shape => {
      shape.addEventListener("click", event => { event.stopPropagation(); document.querySelectorAll(".design-canvas > i").forEach(item => item.classList.remove("design-shape-selected")); shape.classList.add("design-shape-selected"); selected = shape.textContent?.trim() || "the selected feature"; selectedShape = latest.shapes.find(item => item.id === shape.dataset.shapeId) || null; panel.querySelector(".design-precision small").textContent = `${selected} selected · drag it or enter exact geometry`; showExactEditor(panel, selectedShape); });
      if (!shape.dataset.directDrag) { shape.dataset.directDrag = "true"; shape.addEventListener("pointerdown", event => { const startX = event.clientX, startY = event.clientY, canvas = shape.closest(".design-canvas"), initial = latest.shapes.find(item => item.id === shape.dataset.shapeId); if (!initial || !canvas) return; shape.setPointerCapture(event.pointerId); const finish = up => { shape.removeEventListener("pointerup", finish); const box = canvas.getBoundingClientRect(), dx = (up.clientX - startX) * latest.project.width / box.width, dy = (up.clientY - startY) * latest.project.height / box.height; if (Math.abs(dx) > .2 || Math.abs(dy) > .2) applyPatch(initial.id, { x: Number(initial.x) + dx, y: Number(initial.y) + dy }); }; shape.addEventListener("pointerup", finish); }); }
    });
    panel.querySelectorAll("[data-nudge]").forEach(button => button.addEventListener("click", () => setPrompt(button.dataset.nudge.replace("{shape}", selected))));
    panel.querySelectorAll("[data-direct]").forEach(button => button.addEventListener("click", () => { if (!selectedShape) return; const [field, delta] = button.dataset.direct.split(":"); applyPatch(selectedShape.id, { [field]: Number(selectedShape[field] || 0) + Number(delta) }); }));
    panel.querySelector("[data-undo-edit]").onclick = () => { const previous = editHistory.pop(); if (previous) applyPatch(previous.id, previous.patch, false); };
    panel.querySelector("[data-download-report]").onclick = () => downloadReport(mode, result);
  }
  function enhance() {
    const view = document.querySelector(".design-view"); if (!view) return;
    const mode = document.querySelector(".design-tabs button.active")?.textContent?.includes("3D") ? "print" : "foam";
    if (!latest || latestMode !== mode) { const saved = load().find(item => item.mode === mode); latest = saved?.design || null; latestMode = saved ? mode : null; }
    const visibleDesign = latest || { project: { name: mode === "foam" ? "New CNC design" : "New 3D print", width: 0, height: 0, depth: 0 }, shapes: [], notes: [], needsClarification: true };
    renderPanel(review(visibleDesign, mode), mode);
  }
  new MutationObserver(() => window.requestAnimationFrame(enhance)).observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(enhance, 1800);
})();
