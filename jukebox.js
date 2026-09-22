/* global Webamp, EVE_SOUNDTRACK */
(() => {
  const loading = document.getElementById("player-loading");
  const status = document.getElementById("player-status");
  const retry = document.getElementById("player-retry");
  let player = null;
  let loadingPlayer = false;
  let lastStatus = "";

  function notify(event, extra = {}) {
    if (parent !== window) parent.postMessage({ type: "eve-jukebox", event, ...extra }, location.origin);
  }

  function loadLibrary() {
    if (window.Webamp) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timeout = setTimeout(() => fail(), 20000);
      const fail = () => {
        clearTimeout(timeout); script.remove();
        reject(new Error("Webamp couldn't load. Check your connection or try the Archive link."));
      };
      script.src = EVE_SOUNDTRACK.webamp.url;
      script.integrity = EVE_SOUNDTRACK.webamp.integrity;
      script.crossOrigin = "anonymous";
      script.onload = () => { clearTimeout(timeout); resolve(); };
      script.onerror = fail;
      document.head.append(script);
    });
  }

  async function initialize() {
    if (loadingPlayer || player) return;
    loadingPlayer = true; retry.hidden = true;
    status.textContent = "Loading Webamp. Fuel bill not included.";
    try {
      await loadLibrary();
      if (!Webamp.browserIsSupported()) throw new Error("Webamp isn't supported in this browser. The Archive link still works.");
      player = new Webamp({
        initialTracks: EVE_SOUNDTRACK.tracks,
        enableHotkeys: false,
        enableMediaSession: true,
        windowLayout: {
          main: { position: { top: 0, left: 0 } },
          equalizer: { position: { top: 116, left: 0 } },
          playlist: { position: { top: 232, left: 0 } }
        }
      });
      player.setVolume(35);
      player.onClose(() => { player.pause(); notify("closed"); });
      player.onMinimize(() => notify("minimized"));
      await player.renderInto(document.getElementById("webamp-container"));
      // Exposed for browser checks and the standalone player page, not game state.
      window.eveJukebox = player;
      loading.hidden = true;
      notify("ready");
    } catch (error) {
      if (player) player.dispose();
      player = null;
      document.getElementById("webamp-container").replaceChildren();
      status.textContent = error.message;
      loading.hidden = false; retry.hidden = false;
      notify("error");
    } finally {
      loadingPlayer = false;
    }
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.type !== "eve-jukebox") return;
    if (event.data.action === "pause") player?.pause();
    if (event.data.action === "show") player?.reopen();
  });
  // Webamp's public API exposes playback status, but no playback-status listener.
  setInterval(() => {
    if (!player) return;
    const current = player.getMediaStatus();
    if (current !== lastStatus) { lastStatus = current; notify("status", { playing: current === "PLAYING" }); }
  }, 500);
  retry.addEventListener("click", initialize);
  initialize();
})();
