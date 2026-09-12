(() => {
  "use strict";
  function inputFor(zone) { return zone.querySelector('input[type="file"][multiple]'); }
  document.addEventListener("dragover", event => {
    const zone = event.target.closest(".design-chat");
    if (!zone || !event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault(); zone.classList.add("design-drop-active");
  });
  document.addEventListener("dragleave", event => event.target.closest(".design-chat")?.classList.remove("design-drop-active"));
  document.addEventListener("drop", event => {
    const zone = event.target.closest(".design-chat");
    if (!zone || !event.dataTransfer?.files.length) return;
    event.preventDefault(); zone.classList.remove("design-drop-active");
    const input = inputFor(zone); if (!input) return;
    const transfer = new DataTransfer();
    [...event.dataTransfer.files].slice(0, 6).forEach(file => transfer.items.add(file));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
})();
