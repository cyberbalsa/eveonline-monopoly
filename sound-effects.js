/* Local EVE and Kenney one-shots. Never waits in the turn engine or controls Webamp. */
(function expose(root) {
  const clips = {
    roll: ['dice-roll', 0.72], move: ['ship-thrust', 0.32], card: ['notification', 0.65],
    income: ['complete', 0.55], purchase: ['complete', 0.45], build: ['complete', 0.5],
    trade: ['notification', 0.5], offer: ['notification', 0.55], bid: ['interface', 0.45],
    payment: ['capacitor', 0.5], debt: ['capacitor', 0.65],
    jail: ['structure', 0.65], bankruptcy: ['structure', 0.75]
  };
  const KEY = 'new-eden-sfx-v1';
  function settings(value) {
    return { enabled: value?.enabled !== false, volume: Number.isFinite(value?.volume) ? Math.max(0, Math.min(1, value.volume)) : 0.35 };
  }
  function create(doc = document, win = window) {
    let prefs = settings(), context, master, epoch = 0;
    try { prefs = settings(JSON.parse(win.localStorage.getItem(KEY))); } catch { /* Optional storage. */ }
    const cache = new Map(), playing = new Set(), recent = new Map();
    const toggle = doc.getElementById('sound-toggle'), slider = doc.getElementById('sfx-volume');
    const stats = { played: 0, last: null, failed: 0, decoded: 0 };
    function stop() {
      epoch++;
      for (const source of playing) { try { source.stop(); } catch { /* Already ended. */ } }
      playing.clear();
    }
    function update() {
      toggle.textContent = prefs.enabled ? 'SFX ON' : 'SFX OFF';
      toggle.setAttribute('aria-pressed', String(prefs.enabled));
      slider.value = String(Math.round(prefs.volume * 100));
      slider.setAttribute('aria-valuetext', `${slider.value}%`);
      if (master) master.gain.setTargetAtTime(prefs.enabled ? prefs.volume : 0, context.currentTime, 0.015);
      try { win.localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* Optional storage. */ }
    }
    function load(name) {
      if (!cache.has(name)) cache.set(name, (async () => {
        const response = await win.fetch(`assets/sounds/${name}.mp3`, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error('Audio unavailable');
        const buffer = await context.decodeAudioData(await response.arrayBuffer()); stats.decoded++; return buffer;
      })().catch(() => { stats.failed++; return null; }));
      return cache.get(name);
    }
    function unlock() {
      if (!prefs.enabled || doc.hidden) return;
      try {
        if (!context) {
          const Audio = win.AudioContext || win.webkitAudioContext;
          if (!Audio) return;
          context = new Audio({ latencyHint: 'interactive' });
          master = context.createGain(); master.gain.value = prefs.volume; master.connect(context.destination);
          for (const name of new Set(Object.values(clips).map(([name]) => name))) void load(name);
        }
        if (context.state === 'suspended') void context.resume().catch(() => {});
      } catch { /* The game remains playable without Web Audio. */ }
    }
    async function play(kind) {
      if (!clips[kind] || !prefs.enabled || !prefs.volume || !context || doc.hidden) return false;
      const started = performance.now(), token = epoch;
      if (started - (recent.get(kind) ?? -Infinity) < 250) return false;
      recent.set(kind, started);
      const [name, level] = clips[kind], buffer = await load(name);
      if (!buffer || token !== epoch || !prefs.enabled || !prefs.volume || doc.hidden || context.state !== 'running' || performance.now() - started > 1200) return false;
      try {
        if (playing.size >= 3) { const oldest = playing.values().next().value; oldest.stop(); playing.delete(oldest); }
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = buffer; gain.gain.value = level;
        source.connect(gain).connect(master); playing.add(source);
        source.onended = () => { playing.delete(source); source.disconnect(); gain.disconnect(); };
        source.start(); stats.played++; stats.last = kind; return true;
      } catch { return false; }
    }
    toggle.addEventListener('click', () => { prefs.enabled = !prefs.enabled; if (!prefs.enabled) stop(); update(); if (prefs.enabled) { unlock(); void play('card'); } });
    slider.addEventListener('input', () => { prefs.volume = Math.max(0, Math.min(1, Number(slider.value) / 100)); if (!prefs.volume) stop(); update(); });
    slider.addEventListener('change', () => { unlock(); void play('card'); });
    // Trusted input unlocks audio. Loading a save never replays old sounds.
    for (const name of ['pointerdown', 'keydown', 'click']) doc.addEventListener(name, (e) => { if (e.isTrusted) unlock(); }, { capture: true, passive: true });
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) { stop(); if (context?.state === 'running') void context.suspend().catch(() => {}); } else if (context && prefs.enabled) void context.resume().catch(() => {}); });
    update();
    return { play, stop, get status() { return { ...stats, enabled: prefs.enabled, volume: prefs.volume, active: playing.size, loaded: cache.size, context: context?.state || 'locked' }; } };
  }
  const api = { create, settings, clips };
  root.EveSound = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
