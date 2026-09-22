(() => {
  const toggle = document.getElementById("music-toggle");
  const panel = document.getElementById("music-panel");
  const frame = document.getElementById("music-frame");
  let playing = false;

  function updateButton() {
    toggle.textContent = playing ? "MUSIC ON" : "JUKEBOX";
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
    toggle.setAttribute("aria-label", `${panel.hidden ? "Show" : "Hide"} Webamp jukebox${playing ? ", music playing" : ""}`);
  }
  function send(action) {
    if (frame.hasAttribute("src")) frame.contentWindow.postMessage({ type: "eve-jukebox", action }, location.origin);
  }
  function hide(pause = false) {
    if (pause) { send("pause"); playing = false; }
    panel.hidden = true; updateButton(); toggle.focus();
  }
  toggle.addEventListener("click", () => {
    if (!panel.hidden) return hide();
    panel.hidden = false;
    if (!frame.hasAttribute("src")) frame.src = "jukebox.html";
    else send("show");
    updateButton();
  });
  document.getElementById("music-hide").addEventListener("click", () => hide());
  document.getElementById("music-close").addEventListener("click", () => hide(true));
  document.getElementById("music-reset").addEventListener("click", () => {
    playing = false; updateButton(); frame.src = "jukebox.html";
  });
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.type !== "eve-jukebox") return;
    if (event.data.event === "closed") hide(true);
    if (event.data.event === "minimized") hide();
    if (event.data.event === "status") { playing = event.data.playing === true; updateButton(); }
    if (event.data.event === "ready" && panel.hidden) send("pause");
  });
  updateButton();
})();
