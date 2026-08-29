(() => {
  "use strict";

  document.addEventListener("click", event => {
    const suggestion = event.target.closest(".chat-suggestions button");
    if (!suggestion) return;

    const chat = suggestion.closest(".ai-chat");
    let attempts = 0;
    const submitWhenReady = () => {
      attempts += 1;
      const send = [...(chat || document).querySelectorAll("button")]
        .find(button => button.getAttribute("title") === "Send");
      const composer = (chat || document).querySelector(".composer-input");
      if (send && !send.disabled && composer?.value.trim()) {
        send.click();
        return;
      }
      if (attempts < 12) window.setTimeout(submitWhenReady, 25);
    };
    window.setTimeout(submitWhenReady, 0);
  }, true);
})();
