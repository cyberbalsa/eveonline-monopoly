/* Persistent pawn elements keep model loads and movement independent of the HUD. */
(function(root) {
  const q = selector => document.querySelector(selector);
  const rect = cell => ({x:cell.offsetLeft,y:cell.offsetTop,width:cell.offsetWidth,height:cell.offsetHeight});
  const text = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function icon(space, index) {
    if (space.deck) return space.deck;
    if (space.type === 'transit') return 'navigation';
    if (space.type === 'tax') return 'wallet';
    if (space.type === 'utility') return index === 12 ? 'industry' : 'wallet';
    return ({0:'undock',10:'security',20:'station',30:'security'})[index] || null;
  }
  function sync(state, positions, busy, locate) {
    const slots = new Map(), lines = [], alive = new Set(), berths = [];
    state.players.forEach((p,id) => {
      if (p.bankrupt) return;
      alive.add(String(id));
      const index = positions?.[id] ?? p.position, cell = q(`.space[data-index="${index}"]`), r = rect(cell);
      let slot = slots.get(index) || 0, point = root.BoardCamera.pawnPoint(r,index,slot);
      // The last tile on one edge meets the first on the next. Resolve those
      // berth collisions too, not just multiple pilots sharing a single tile.
      while (berths.some(other=>Math.abs(other.x-point.x)<76&&Math.abs(other.y-point.y)<72)) point = root.BoardCamera.pawnPoint(r,index,++slot);
      slots.set(index,slot + 1); berths.push(point);
      const name = p.shipName.toLowerCase();
      let token = q(`.ship-token[data-player="${id}"]`);
      if (!token || token.dataset.hull !== name) {
        token?.remove(); token = document.createElement('button'); token.type = 'button'; token.className = 'ship-token'; token.dataset.player = id; token.dataset.hull = name;
        token.innerHTML = `<span class="model-slot" data-model="${name}"><img src="${p.ship}" alt="${p.shipName} pawn"></span><b class="pawn-number">${id + 1}</b><span class="pawn-callsign">${id === 0 ? 'YOU' : text(p.name)}</span>`;
        token.addEventListener('click',() => locate(id)); q('#pawn-layer').append(token);
      }
      token.style.left = `${point.x - 36}px`; token.style.top = `${point.y - 34}px`; token.style.setProperty('--token',p.color);
      token.classList.toggle('moving',busy); token.classList.toggle('current-pawn',id === state.current);
      token.setAttribute('aria-label',`Locate pilot ${id + 1}: ${p.name}, ${p.shipName}, ${state.players[id].inJail ? 'reshipping at ' : ''}${GAME_DATA.spaces[index].name}`);
      token.title = `${p.name} · ${p.shipName} · ${GAME_DATA.spaces[index].name}`;
      token.dataset.position = index;
      lines.push(`<line x1="${r.x + r.width / 2}" y1="${r.y + r.height / 2}" x2="${point.x}" y2="${point.y}" stroke="${p.color}"/><circle cx="${r.x + r.width / 2}" cy="${r.y + r.height / 2}" r="5" fill="${p.color}"/>`);
    });
    document.querySelectorAll('.ship-token').forEach(token => {if (!alive.has(token.dataset.player)) token.remove();});
    q('#pawn-tethers').innerHTML = lines.join('');
    root.EveModels?.sync();
  }
  function pointFor(id) {
    const token = q(`.ship-token[data-player="${id}"]`);
    if (!token) return {x:512,y:512};
    const cell = q(`.space[data-index="${token.dataset.position}"]`), r = rect(cell);
    return {x:(parseFloat(token.style.left) + 36 + r.x + r.width / 2) / 2, y:(parseFloat(token.style.top) + 34 + r.y + r.height / 2) / 2};
  }
  function buildings(cell,count) {
    const container = cell.querySelector('.upgrade-pips');
    if (container.dataset.count === String(count)) return;
    container.dataset.count = count;
    const name = count === 5 ? 'keepstar' : 'astrahus';
    container.innerHTML = count ? `<span class="model-slot structure-model" data-model="${name}"><img class="structure-token" src="assets/${name}.png" alt="${count === 5 ? 'Keepstar' : `${count} Astrahus`}"></span><b class="building-count">${count === 5 ? '1 K' : `${count} A`}</b>` : '';
  }
  function chips(players,index,positions) {
    return players.map((p,id) => !p.bankrupt && (positions?.[id] ?? p.position) === index ? `<b class="location-chip" style="--token:${p.color}" title="${text(p.name)}">${id + 1}</b>` : '').join('');
  }
  root.BoardPieces = {icon,sync,pointFor,buildings,chips};
})(globalThis);
