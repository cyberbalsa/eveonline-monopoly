/* Full saved history; a bounded DOM page keeps long campaigns inexpensive. */
(function expose(root) {
  const PAGE = 100;
  const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  function filter(entries, players, mode = 'all', query = '') {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const actor = players[entry.player];
      const match = mode === 'all' || (mode === 'human' ? entry.player === 0 || entry.to === 0 : actor?.isBot);
      return match && (!needle || entry.text.toLowerCase().includes(needle));
    });
  }
  function stamp(entry) {
    return Number.isFinite(entry.time) ? timeFormat.format(entry.time) : 'earlier';
  }
  function exportText(state) {
    return ['NEW EDEN — LOCAL / ACTION LOG', ...state.log.map((entry) => `[${stamp(entry)}] [Round ${entry.round || '?'}] ${entry.text}`)].join('\n');
  }
  function create(getState) {
    const list = document.getElementById('event-log'), query = document.getElementById('log-search'), mode = document.getElementById('log-filter');
    let offset = 0, previousState, previousLength = -1, previousMatches = 0, dirty = true;
    function render() {
      const state = getState(); if (!state) return;
      if (state !== previousState) { offset = 0; dirty = true; }
      if (!dirty && previousLength === state.log.length) return;
      const changed = state !== previousState ? 0 : Math.max(0, state.log.length - previousLength);
      const entries = filter(state.log, state.players, mode.value, query.value);
      if (offset && changed) offset += Math.max(0, entries.length - previousMatches);
      offset = Math.min(offset, Math.max(0, entries.length - 1));
      const end = entries.length - offset, start = Math.max(0, end - PAGE);
      const fragment = document.createDocumentFragment();
      for (const entry of entries.slice(start, end)) {
        const row = document.createElement('p'); row.className = 'log-entry';
        row.style.setProperty('--entry', /^#[0-9a-f]{6}$/i.test(entry.color) ? entry.color : '#93aab3');
        const meta = document.createElement('small'), text = document.createElement('span');
        const p = Number.isInteger(entry.player) ? state.players[entry.player] : null;
        meta.textContent = `${stamp(entry)} · R${entry.round || '?'} · ${p ? `${entry.player + 1} ${p.isBot ? 'BOT' : 'YOU'}` : 'SCC'}`;
        text.textContent = entry.text; row.append(meta, text); fragment.append(row);
      }
      const atBottom = list.scrollHeight - list.clientHeight - list.scrollTop < 24;
      const scrollTop = list.scrollTop;
      list.replaceChildren(fragment);
      document.getElementById('log-count').textContent = `${entries.length ? start + 1 : 0}–${end} of ${entries.length} · ${state.log.length} saved`;
      document.getElementById('log-earlier').disabled = start === 0;
      document.getElementById('log-newer').disabled = offset === 0;
      document.getElementById('log-latest').disabled = offset === 0;
      list.scrollTop = !offset && (dirty || atBottom) ? list.scrollHeight : scrollTop;
      if (changed) document.getElementById('log-live').textContent = state.log.at(-1)?.text || '';
      previousState = state; previousLength = state.log.length; previousMatches = entries.length; dirty = false;
    }
    for (const el of [query, mode]) el.addEventListener('input', () => { offset = 0; dirty = true; render(); });
    document.getElementById('log-earlier').addEventListener('click', () => { offset += PAGE; dirty = true; render(); });
    document.getElementById('log-newer').addEventListener('click', () => { offset = Math.max(0, offset - PAGE); dirty = true; render(); });
    document.getElementById('log-latest').addEventListener('click', () => { offset = 0; dirty = true; render(); });
    document.getElementById('log-export').addEventListener('click', () => {
      const state = getState(); if (!state) return;
      const url = URL.createObjectURL(new Blob([exportText(state)], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = 'new-eden-campaign-log.txt'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    return { render };
  }
  const api = { filter, exportText, create, PAGE };
  root.ActivityLog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
