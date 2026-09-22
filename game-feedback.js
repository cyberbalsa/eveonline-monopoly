/* Presentation consumes completed events. It cannot move money or resolve turns. */
(function expose(root) {
  function rentNotice(entry, state, data) {
    if (entry.kind !== 'rent' || (entry.player !== 0 && entry.to !== 0) || entry.player === entry.to || !Number.isFinite(entry.amount) || entry.amount <= 0) return null;
    const from = state.players[entry.player], to = state.players[entry.to], space = data.spaces[entry.index];
    if (!from || !to || !space?.price) return null;
    return { received: entry.to === 0, amount: entry.amount, from: from.name, to: to.name, property: space.name };
  }
  function create(sound, data) {
    let cursor = 0, timer, pending = [];
    const popup = document.getElementById('rent-notice');
    function hide() {
      clearTimeout(timer);
      if (popup.hidePopover && popup.matches(':popover-open')) popup.hidePopover();
      popup.hidden = true;
    }
    function next() {
      hide(); const notice = pending.shift(); if (!notice) return;
      popup.classList.toggle('rent-income', notice.received);
      popup.classList.toggle('rent-expense', !notice.received);
      document.getElementById('rent-title').textContent = notice.received ? 'RENT RECEIVED' : 'RENT PAID';
      document.getElementById('rent-amount').textContent = `${notice.received ? '+' : '−'}${notice.amount.toLocaleString()}M ISK`;
      document.getElementById('rent-route').textContent = `${notice.from} → ${notice.to}`;
      document.getElementById('rent-property').textContent = notice.property;
      popup.hidden = false;
      if (popup.showPopover) popup.showPopover();
      timer = setTimeout(next, 6500);
    }
    document.getElementById('rent-dismiss').addEventListener('click', next);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { pending = []; hide(); } });
    return {
      reset(state) { cursor = state?.log.length || 0; pending = []; hide(); sound.stop(); },
      present(state) {
        const entries = state.log.slice(cursor); cursor = state.log.length;
        if (document.hidden) return;
        // Only one outcome cue per action: a ban should not be buried under wallet pings.
        const priority = ['bankruptcy', 'jail', 'debt', 'card', 'offer', 'rent', 'build', 'purchase', 'trade', 'income', 'payment', 'bid'];
        const event = priority.map((kind) => entries.find((entry) => entry.kind === kind)).find(Boolean);
        if (event) void sound.play(event.kind === 'rent' ? (event.to === 0 ? 'income' : 'payment') : event.kind);
        for (const entry of entries) { const notice = rentNotice(entry, state, data); if (notice) pending.push(notice); }
        if (popup.hidden && pending.length) next();
      }
    };
  }
  const api = { rentNotice, create };
  root.GameFeedback = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
