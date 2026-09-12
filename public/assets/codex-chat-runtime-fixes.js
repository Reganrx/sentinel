/* Reliable native file selection for the packaged Electron chat. */
document.addEventListener("click", (event) => {
  const button = event.target.closest('button[title="Attach File"]');
  if (!button) return;

  const composer = button.closest(".composer");
  const reactInput = composer?.querySelector('input[type="file"]');
  if (!reactInput) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ".txt,.md,.json,.csv,.js,.jsx,.ts,.tsx,.html,.css,.scss,.py,.java,.cs,.cpp,.xml,.sql,.yml,.yaml,.ini,.toml,.log";
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    reactInput.files = transfer.files;
    reactInput.dispatchEvent(new Event("change", { bubbles: true }));
  }, { once: true });
  picker.click();
}, true);
