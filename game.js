/* global GAME_DATA, GAME_ENGINE, GAME_SESSION, GAME_BOTS */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const E = GAME_ENGINE, S = GAME_SESSION, B = GAME_BOTS, D = GAME_DATA;
const SAVE_KEY = "new-eden-renters-edition-v3";
const diceGlyphs = ["·", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const PLAYER_SHIPS = [
  { name: "Rifter", path: "assets/rifter.png", note: "rust first" },
  { name: "Venture", path: "assets/venture.png", note: "bait fit" },
  { name: "Catalyst", path: "assets/catalyst.png", note: "safety red" },
  { name: "Caracal", path: "assets/caracal.png", note: "kite away" },
  { name: "Drake", path: "assets/drake.png", note: "can I bring" },
  { name: "Gila", path: "assets/gila.png", note: "abyss brain" },
  { name: "Ishtar", path: "assets/ishtar.png", note: "very human" },
  { name: "Dominix", path: "assets/dominix.png", note: "space potato" }
];
let state = null, selectedShip = 0, timer = null, generation = 0, busy = false, paused = false;
let audioEnabled = true, audioContext = null, visualPositions = null, inspected = null;
const h = (text) => String(text).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[c]);
const money = (value) => `${Number(value.toFixed(2)).toLocaleString()}M`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function dice() { return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]; }
function setDie(element, value) {
  const pips = [[],[4],[0,8],[0,4,8],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8]];
  element.innerHTML = [1,2,3,4,5,6].map((n) => `<span class="die-face face-${n}" aria-hidden="true">${Array.from({length:9},(_,i)=>`<span class="die-pip ${pips[n].includes(i)?"filled":""}"></span>`).join("")}</span>`).join("");
  const angles = [[-12,-15],[-12,-15],[-102,-15],[-12,-105],[-12,75],[78,-15],[-12,165]][value];
  element.style.setProperty("--die-x", `${angles[0]}deg`); element.style.setProperty("--die-y", `${angles[1]}deg`);
  element.setAttribute("aria-label", value ? `Die: ${value}` : "Die: not rolled");
  element.setAttribute("role", "img");
}
function newState(name = "Capsuleer", ship = PLAYER_SHIPS[0]) {
  return S.create(D, [{ name: name.trim().slice(0, 18) || "Capsuleer", ship: ship.path, shipName: ship.name, color: "#55d8e8", motto: "probably human", isBot: false }, ...D.botProfiles.map((p, i) => ({ ...p, shipName: ["Drake", "Dominix", "Providence"][i], isBot: true }))]);
}
function boardPosition(i) {
  if (i <= 10) return [11, 11 - i];
  if (i <= 20) return [21 - i, 1];
  if (i <= 30) return [1, i - 19];
  return [i - 29, 11];
}
function renderBoard() {
  D.spaces.forEach((space, index) => {
    const cell = document.createElement("button"), [row, column] = boardPosition(index);
    cell.type = "button";
    cell.className = `space ${["corner", "gotojail"].includes(space.type) ? "corner" : space.type} ${space.deck || ""}`;
    cell.dataset.index = index; cell.style.gridRow = row; cell.style.gridColumn = column;
    cell.setAttribute("aria-label", space.name);
    cell.title = space.flavor || space.text || space.name;
    if (space.group) cell.style.setProperty("--group-color", D.groups[space.group].color);
    cell.innerHTML = `${space.group ? '<span class="color-bar"></span>' : ""}${space.icon ? `<span class="space-icon">${space.icon}</span>` : ""}<span class="space-name">${space.name}</span><span class="space-price">${space.price ? `${space.price}M ISK` : space.amount ? `PAY ${space.amount}M` : ""}</span><span class="upgrade-pips"></span><span class="tokens"></span>`;
    cell.addEventListener("click", () => inspectSpace(index));
    $("#board").appendChild(cell);
  });
}
function saveGame() {
  if (!state) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); $("#save-status").textContent = "CAMPAIGN SAVED"; }
  catch { $("#save-status").textContent = "STORAGE UNAVAILABLE · KEEP THIS TAB OPEN"; }
}
function render() {
  if (!state) return;
  const current = state.players[state.current], human = state.players[0], actor = state.players[B.actor(state)];
  $("#turn-counter").textContent = `ROUND ${state.turn}`;
  $("#bank-supply").innerHTML = `<span>BANK SUPPLY</span><b>${state.bank.houses} ASTRAHUS</b><b>${state.bank.hotels} KEEPSTARS</b>`;
  $("#active-pilot").innerHTML = `<img class="pilot-portrait" src="${current.ship}" alt="${current.shipName}" style="--pilot:${current.color}"><div><h3>${h(current.name)}</h3><p>${current.isBot ? "AUTOPILOT" : "HUMAN"} · <b>${money(current.cash)}</b></p><p>${current.shipName} · ${current.motto}</p></div>`;
  $("#roster").innerHTML = state.players.map((p, i) => `<div class="roster-row ${i === state.current ? "active" : ""} ${p.bankrupt ? "bankrupt" : ""}" style="--pilot:${p.color}"><img src="${p.ship}" alt="${p.shipName}"><div><strong>${h(p.name)}</strong><small>${p.bankrupt ? "BIOMASSED" : `${p.properties.length} LEASES · ${p.strategyLabel || p.shipName}`}</small></div><div class="roster-money">${money(p.cash)}<small>${p.inJail ? "RMT BAN" : D.spaces[p.position].name}</small></div></div>`).join("");
  $$(".space").forEach((cell) => {
    const index = Number(cell.dataset.index), owner = E.getOwner(state, index), count = owner?.upgrades[index] || 0;
    cell.classList.toggle("active-space", index === current.position);
    cell.classList.toggle("mortgaged", Boolean(owner?.mortgaged[index]));
    $(".owner-rail", cell)?.remove();
    if (owner) { cell.style.setProperty("--owner", owner.color); cell.insertAdjacentHTML("beforeend", '<span class="owner-rail"></span>'); }
    $(".upgrade-pips", cell).innerHTML = count === 5 ? '<img class="structure-token tier-5" src="assets/keepstar.png" alt="Keepstar">' : Array.from({ length: count }, () => '<img class="structure-token house-token" src="assets/astrahus.png" alt="Astrahus">').join("");
    $(".tokens", cell).innerHTML = state.players.map((p, i) => (visualPositions?.[i] ?? p.position) === index && !p.bankrupt ? `<span class="ship-token ${busy ? "warping" : ""}" data-player="${i}" style="--token:${p.color};--token-order:${i}" title="${h(p.name)} · ${p.shipName}"><span class="ship-glow"></span><img src="${p.ship}" alt="${p.shipName} pawn"></span>` : "").join("");
  });
  $("#event-log").innerHTML = state.log.slice(-40).reverse().map((entry) => `<p class="log-entry" style="--entry:${entry.color}">${h(entry.text)}</p>`).join("");
  const utility = state.phase === "utility";
  $("#roll-button").disabled = busy || state.gameOver || (utility ? actor.isBot : current.isBot || current.bankrupt || state.phase !== "roll");
  $("#roll-button").innerHTML = utility ? `<span>ROLL UTILITY RENT</span><small>${state.utility.multiplier} × fresh dice · no movement</small>` : `<span>${current.inJail ? "ROLL DOUBLES" : "ROLL DICE"}</span><small>${current.inJail ? "Third miss costs 50M" : "Undock and hope"}</small>`;
  $("#end-turn-button").disabled = busy || state.phase !== "end" || current.isBot || current.bankrupt;
  $("#finance-button").disabled = busy || human.bankrupt || state.gameOver;
  $("#trade-button").disabled = busy || human.bankrupt || state.gameOver || !["roll", "end", "purchase", "debt"].includes(state.phase);
  $("#pause-bots").textContent = paused ? "RESUME BOTS" : "PAUSE BOTS";
  if (!busy) {
    setDie($("#die-one"), state.lastRoll[0]);
    setDie($("#die-two"), state.lastRoll[1]);
    renderDecisions();
  }
}
function showDialog(id) { const d = $(`#${id}`); if (!d.open) d.showModal(); }
function closeDialog(id) { const d = $(`#${id}`); if (d.open) d.close(); }
function decision(text, actions = []) {
  const box = $("#decision-box"); box.hidden = false;
  box.innerHTML = `<p>${text}</p><div class="decision-actions">${actions.map((a) => `<button id="${a.id}" ${a.disabled ? "disabled" : ""}>${a.label}</button>`).join("")}</div>`;
  actions.forEach((a) => $(`#${a.id}`).addEventListener("click", a.run));
}
function renderDecisions() {
  const p = state.players[state.current], actor = state.players[B.actor(state)];
  $("#decision-box").hidden = true;
  if (state.phase !== "card") closeDialog("card-modal");
  if (state.phase !== "auction") closeDialog("auction-modal");
  if (state.phase === "over") {
    const winner = state.players.find((p) => !p.bankrupt);
    decision(`<strong>${h(winner.name)}</strong> wins with ${money(winner.cash)} and ${winner.properties.length} leases.`, [{ id: "play-again", label: "NEW CAMPAIGN", run: resetGame }]);
  } else if (state.phase === "purchase" && !actor.isBot) {
    const space = D.spaces[state.purchase.index];
    decision(`<strong>${space.name}</strong> is unclaimed. Buy it for ${money(space.price)}, or let everyone bid.`, [
      { id: "claim-space", label: `CLAIM ${money(space.price)}`, disabled: actor.cash < space.price, run: () => commit(() => S.purchase(state, D, true)) },
      { id: "pass-space", label: "AUCTION", run: () => commit(() => S.purchase(state, D, false)) }
    ]);
  } else if (state.phase === "roll" && p.inJail && !p.isBot) {
    decision("<strong>Account under review.</strong> Pay 50M, use a held card, or try doubles. You still collect rent while banned.", [
      { id: "pay-bail", label: "PAY 50M", run: () => commit(() => S.bail(state, D)) },
      ...p.jailCardDecks.map((deck) => ({ id: `use-${deck}-card`, label: S.deck(D, deck).find((c) => c.effect.type === "escape").title.toUpperCase(), run: () => commit(() => S.bail(state, D, deck)) }))
    ]);
  } else if (state.phase === "debt" && !actor.isBot) {
    const debt = state.queue[0];
    decision(`<strong>${money(debt.amount)} due.</strong> Wallet: ${money(actor.cash)}. Sell buildings, mortgage leases, or negotiate a trade.`, [
      { id: "manage-debt", label: "MANAGE ASSETS", run: showFinance },
      { id: "settle-debt", label: "PAY IN FULL", disabled: actor.cash < debt.amount, run: () => commit(() => { S.process(state, D); return true; }) },
      { id: "auto-raise", label: "AUTO RAISE CASH", run: () => commit(() => { E.raiseCash(state, D, actor, debt.amount); return true; }) },
      { id: "bankrupt-button", label: "DECLARE BANKRUPTCY", disabled: E.liquidationValue(D, actor) >= debt.amount, run: () => commit(() => S.bankrupt(state, D)) }
    ]);
  } else if (state.phase === "mortgage" && !actor.isBot) {
    const index = state.queue[0].index;
    decision(`You received mortgaged <strong>${D.spaces[index].name}</strong>. Lift it now or pay 10% interest now and 110% when redeemed later.`, [
      { id: "inherit-lift", label: `REDEEM ${money(E.unmortgageCost(D, index))}`, run: () => commit(() => S.mortgageChoice(state, D, true)) },
      { id: "inherit-keep", label: `KEEP · ${money(D.spaces[index].price * 0.05)}`, run: () => commit(() => S.mortgageChoice(state, D, false)) }
    ]);
  } else if (state.phase === "buildingOffer") {
    const r = state.buildingRequest;
    decision(`<strong>${h(state.players[r.player].name)}</strong> wants the last ${r.kind === "houses" ? "Astrahus" : "Keepstar"}. Do you want to compete for it?`, [
      { id: "compete-building", label: "START AUCTION", run: () => commit(() => S.buildingResponse(state,D,true)) },
      { id: "pass-building", label: "LET THEM BUY", run: () => commit(() => S.buildingResponse(state,D,false)) }
    ]);
  } else if (state.phase === "offer") {
    const trade = state.offer.trade;
    decision(`<strong>${h(state.players[trade.from].name)}</strong> offers ${describeSide(trade.give)} for your ${describeSide(trade.take)}.`, [
      { id: "accept-offer", label: "ACCEPT CONTRACT", run: () => acceptOffer(true) },
      { id: "decline-offer", label: "DECLINE", run: () => acceptOffer(false) }
    ]);
  } else if (state.players[0].bankrupt && !state.gameOver) decision("Your rental empire is gone. The bots will finish the campaign. You can watch or start a new one.");
  if (state.phase === "card") {
    const card = S.deck(D, state.card.deck)[state.card.index];
    $("#drawn-card").style.setProperty("--card-color", state.card.deck === "mail" ? "#67e8f9" : "#e76c70");
    $("#drawn-card").classList.toggle("escape-card", card.effect.type === "escape");
    $("#drawn-card").innerHTML = `<div class="card-icon">${card.effect.type === "escape" ? "◉" : state.card.deck === "mail" ? "✉" : "⌁"}</div><div class="card-deck">${state.card.deck === "mail" ? "ALLIANCE MAIL" : "LOCAL SPIKE"}</div>${card.kicker ? `<small class="card-kicker">${card.kicker}</small>` : ""}<h2>${card.title}</h2><p>${card.body}</p>${card.source ? `<a class="card-source" href="${card.source}" target="_blank" rel="noreferrer">The story behind the card ↗</a>` : ""}`;
    $("#resolve-card").disabled = actor.isBot;
    $("#resolve-card").textContent = actor.isBot ? `${actor.name} IS READING LOCAL` : card.effect.type === "escape" ? "KEEP THIS CARD" : "ACKNOWLEDGE PING";
    showDialog("card-modal");
  }
  if (state.phase === "auction") renderAuction();
}
function renderAuction() {
  const a = state.auction, human = state.players[0], next = a.bid ? a.bid + 1 : 10;
  $("#auction-title").textContent = a.building ? `Last ${a.building === "houses" ? "Astrahus" : "Keepstar"}` : D.spaces[a.index].name;
  $("#auction-status").innerHTML = `<div class="current-bid"><span>CURRENT BID</span><strong>${a.bid ? money(a.bid) : "NO BIDS"}</strong><small>${a.leader === null ? "Opening bid: 10M" : h(state.players[a.leader].name)}</small></div><p>Your wallet: ${money(human.cash)}. Bids may rise by 1M. Everyone can bid, including the pilot who declined the lease.</p>${a.building && a.targets[0] !== undefined ? `<label>Build in <select id="auction-target">${human.properties.filter((i) => E.canUpgrade(state, D, human, i) && ((human.upgrades[i] || 0) === 4 ? "hotels" : "houses") === a.building).map((i) => `<option value="${i}">${D.spaces[i].name}</option>`).join("")}</select></label>` : ""}`;
  $("#bid-amount").value = next; $("#bid-amount").min = next; $("#bid-amount").max = human.cash;
  $("#submit-bid").disabled = human.bankrupt || human.cash < next || Boolean(a.building && a.targets[0] === undefined);
  showDialog("auction-modal");
}
function commit(action) {
  if (!state || busy) return false;
  clearTimeout(timer);
  const result = action();
  if (result === false) { toast("Contract rejected", "That action is not available."); schedule(); return false; }
  saveGame(); render(); schedule(); return true;
}
function passiveModalOpen() { return ["launch-modal", "property-modal", "finance-modal", "trade-modal", "intel-modal"].some((id) => $(`#${id}`).open); }
function schedule() {
  clearTimeout(timer);
  if (!state || busy || paused || state.gameOver || ["offer", "buildingOffer"].includes(state.phase) || passiveModalOpen()) return;
  const token = generation;
  timer = setTimeout(() => {
    if (token !== generation || !state || busy || paused || passiveModalOpen()) return;
    if (state.phase === "auction") {
      const changed = B.auctionRound(state, D);
      if (changed) { saveGame(); render(); schedule(); return; }
      if (state.players[0].bankrupt || state.auction.leader === 0) commit(() => S.finishAuction(state, D));
      return;
    }
    if (state.phase === "end" && state.players[state.current].bankrupt) { commit(() => S.end(state, D)); return; }
    if (!state.players[B.actor(state)].isBot) return;
    if (state.phase === "roll" || state.phase === "utility") animateAction(() => B.step(state, D));
    else commit(() => B.step(state, D));
  }, 950);
}
async function animateAction(action) {
  if (busy || !state) return;
  const token = generation, oldPositions = state.players.map((p) => p.position), oldDice = state.lastRoll.join();
  clearTimeout(timer);
  if (action() === false) return;
  saveGame();
  const rolled = oldDice !== state.lastRoll.join() || state.log.at(-1)?.text.includes("rolled");
  busy = true; visualPositions = oldPositions; render();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (rolled && !reduced) {
    $$(".die").forEach((d) => d.classList.add("rolling")); sound("roll");
    for (let n = 0; n < 7; n++) {
      setDie($("#die-one"), 1 + Math.floor(Math.random() * 6));
      setDie($("#die-two"), 1 + Math.floor(Math.random() * 6));
      await wait(55); if (token !== generation) return;
    }
  }
  $$(".die").forEach((d) => d.classList.remove("rolling"));
  for (let id = 0; id < state.players.length; id++) {
    const target = state.players[id].position, distance = (target - oldPositions[id] + 40) % 40;
    if (!reduced && distance && distance <= 12 && !state.players[id].inJail) {
      for (let n = 0; n < distance; n++) {
        visualPositions[id] = (visualPositions[id] + 1) % 40; render();
        await wait(65); if (token !== generation) return;
      }
    }
  }
  busy = false; visualPositions = null; render(); schedule();
}
function inspectSpace(index) {
  if (!state || busy) return;
  const space = D.spaces[index];
  if (!space.price) { toast(space.name, space.text || "Draw a card."); return; }
  clearTimeout(timer); inspected = index;
  const owner = E.getOwner(state, index), p = state.players[0], level = owner?.upgrades[index] || 0;
  const committedGroup = state.phase === "auction" && state.auction.building && state.auction.leader === 0 ? D.spaces[state.auction.targets[0]].group : null;
  const yours = owner === p && !p.bankrupt && !state.gameOver && (!committedGroup || committedGroup !== space.group);
  const color = space.group ? D.groups[space.group].color : "#8b82e8";
  const labels = ["Open space", "1 Astrahus", "2 Astrahus", "3 Astrahus", "4 Astrahus", "Keepstar"];
  const rent = space.rent ? space.rent.map((r, i) => `<div class="rent-line ${i === level ? "current" : ""}"><span>${labels[i]}</span><b>${money(r)}</b></div>`).join("") + `<p class="property-note">Unbuilt full set: ${money(space.rent[0] * 2)}. Build cost: ${money(space.buildCost)} each.</p>` : `<p>${space.type === "transit" ? "1 / 2 / 3 / 4 bridges: 25 / 50 / 100 / 200M rent." : "1 utility: 4 × fresh dice. Both utilities: 10 × fresh dice."}</p>`;
  const committedBid = state.phase === "auction" && state.auction.leader === 0 ? state.auction.bid : 0;
  const canBuild = yours && ["roll", "end", "purchase"].includes(state.phase) && E.canUpgrade(state, D, p, index);
  $("#property-detail").innerHTML = `<div class="property-sheet" style="--sheet-color:${color}"><div class="property-banner"><div class="eyebrow">${space.group ? D.groups[space.group].name : space.type}</div><h2>${space.name}</h2></div><p class="property-flavor">${space.flavor || space.text}</p><div class="property-stats"><div><span>LEASE</span><b>${money(space.price)}</b></div><div><span>OWNER</span><b>${owner ? h(owner.name) : "BANK"}</b></div><div><span>STATUS</span><b>${owner?.mortgaged[index] ? "MORTGAGED" : space.group ? labels[level] : "ACTIVE"}</b></div></div><div class="rent-table">${rent}</div>${space.group ? `<div class="citadel-track">${[1, 2, 3, 4, 5].map((n) => `<div class="${level === n ? "built" : ""}"><img src="assets/${n === 5 ? "keepstar" : "astrahus"}.png" alt="${n === 5 ? "Keepstar" : "Astrahus"}"><span>${labels[n]}</span></div>`).join("")}</div>` : ""}${yours ? `<div class="property-actions"><button id="upgrade-property" ${canBuild ? "" : "disabled"}>BUILD ${space.buildCost ? money(space.buildCost) : ""}</button><button id="sell-building" ${E.canSellBuilding(state, D, p, index) ? "" : "disabled"}>SELL ONE BUILDING</button><button id="sell-group" ${space.group && E.groupSpaces(space.group, D).some((s) => p.upgrades[s.index]) ? "" : "disabled"}>SELL ALL IN COLOR SET</button><button id="mortgage-property" ${E.canMortgage(state, D, p, index) ? "" : "disabled"}>MORTGAGE · +${money(space.price / 2)}</button><button id="unmortgage-property" ${p.mortgaged[index] && p.cash - committedBid >= E.unmortgageCost(D, index) ? "" : "disabled"}>REDEEM · ${money(E.unmortgageCost(D, index))}</button></div>` : ""}<p class="property-note">Build and sell evenly. Mortgaged leases collect no rent. Sell all buildings in a color set before mortgaging or trading it.</p></div>`;
  if (yours) {
    const actions = { "upgrade-property": () => S.build(state, D, 0, index), "sell-building": () => E.sellBuilding(state, D, p, index), "sell-group": () => E.sellGroup(state, D, p, space.group), "mortgage-property": () => E.mortgage(state, D, p, index), "unmortgage-property": () => E.unmortgage(D, p, index) };
    Object.entries(actions).forEach(([id, run]) => $(`#${id}`).addEventListener("click", () => {
      if (!commit(run)) return;
      sound("cash");
      if (state.phase === "auction") { closeDialog("property-modal"); closeDialog("finance-modal"); renderAuction(); schedule(); }
      else inspectSpace(index);
      if ($("#finance-modal").open) renderFinance();
    }));
  }
  showDialog("property-modal");
}
function renderFinance() {
  const p = state.players[0];
  $("#finance-content").innerHTML = `<p>Wallet: <strong>${money(p.cash)}</strong> · Bank liquidation value: ${money(E.liquidationValue(D, p))}</p><p>Click a lease to build, sell, mortgage, or redeem. Bots pause while you manage assets.</p><div class="asset-list">${p.properties.map((i) => `<button data-asset="${i}" style="--asset:${D.groups[D.spaces[i].group]?.color || "#8b82e8"}"><strong>${D.spaces[i].name}</strong><small>${p.mortgaged[i] ? "MORTGAGED" : p.upgrades[i] === 5 ? "KEEPSTAR" : `${p.upgrades[i] || 0} ASTRAHUS`}</small></button>`).join("") || "No leases. Yet."}</div><h3>Held cards</h3>${p.jailCardDecks.map((d) => `<p>${S.deck(D, d).find((c) => c.effect.type === "escape").title} · ${d === "mail" ? "Alliance Mail" : "Local Spike"}</p>`).join("") || "<p>No escape cards.</p>"}`;
  $$('[data-asset]').forEach((button) => button.addEventListener("click", () => inspectSpace(Number(button.dataset.asset))));
}
function showFinance() { if (!state || busy) return; clearTimeout(timer); renderFinance(); showDialog("finance-modal"); }
function describeSide(side) { return [...side.properties.map((i) => D.spaces[i].name), ...side.cards.map((d) => S.deck(D, d).find((c) => c.effect.type === "escape").title), ...(side.cash ? [money(side.cash)] : [])].map(h).join(", ") || "nothing"; }
function tradeSide(p, name) {
  return `<fieldset><legend>${name === "give" ? "YOU GIVE" : "YOU RECEIVE"}</legend><label>Cash (M ISK)<input type="number" min="0" max="${p.cash}" step="0.5" value="0" name="${name}-cash"></label>${p.properties.filter((i) => E.tradeable(D, p, i)).map((i) => `<label class="trade-item"><input type="checkbox" name="${name}-property" value="${i}">${D.spaces[i].name}${p.mortgaged[i] ? " (mortgaged)" : ""}</label>`).join("")}${p.jailCardDecks.map((d) => `<label class="trade-item"><input type="checkbox" name="${name}-card" value="${d}">${S.deck(D, d).find((c) => c.effect.type === "escape").title}</label>`).join("")}</fieldset>`;
}
function renderTrade() {
  const id = Number($("#trade-partner").value);
  $("#trade-terms").innerHTML = tradeSide(state.players[0], "give") + tradeSide(state.players[id], "take");
  $("#trade-feedback").textContent = "No loans or rent immunity. Mortgaged leases carry an immediate Bank charge for the recipient.";
}
function showTrade() {
  if (!state || busy || !["roll", "end", "purchase", "debt"].includes(state.phase)) return;
  clearTimeout(timer);
  $("#trade-partner").innerHTML = state.players.map((p, i) => i && !p.bankrupt ? `<option value="${i}">${h(p.name)}</option>` : "").join("");
  renderTrade(); showDialog("trade-modal");
}
function submitTrade() {
  const side = (name) => ({ cash: Number($(`[name="${name}-cash"]`).value), properties: $$(`[name="${name}-property"]:checked`).map((x) => Number(x.value)), cards: $$(`[name="${name}-card"]:checked`).map((x) => x.value) });
  const trade = { from: 0, to: Number($("#trade-partner").value), give: side("give"), take: side("take") };
  const verdict = E.evaluateTrade(state, D, trade, trade.to);
  $("#trade-feedback").textContent = verdict.reason;
  if (verdict.accept && commit(() => S.trade(state, D, trade))) { closeDialog("trade-modal"); schedule(); toast("Contract accepted", verdict.reason); }
}
function acceptOffer(accept) {
  commit(() => { const offer = state.offer; delete state.offer; state.phase = offer.returnPhase; return accept ? S.trade(state, D, offer.trade) : true; });
}
function toast(title, body) {
  const item = document.createElement("div"); item.className = "toast";
  item.innerHTML = `<strong>${h(title)}</strong>${h(body)}`; $("#toast-stack").appendChild(item);
  setTimeout(() => item.remove(), 3900);
}
function sound(kind) {
  if (!audioEnabled) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), now = audioContext.currentTime;
    oscillator.frequency.setValueAtTime({ roll: 110, cash: 420, alert: 74 }[kind] || 185, now);
    oscillator.type = "sine"; gain.gain.setValueAtTime(0.035, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    oscillator.connect(gain).connect(audioContext.destination); oscillator.start(now); oscillator.stop(now + 0.14);
  } catch { /* Optional audio. */ }
}
function startGame() {
  generation++; clearTimeout(timer); busy = false; visualPositions = null; paused = false;
  state = newState($("#pilot-name").value, PLAYER_SHIPS[selectedShip]);
  closeDialog("launch-modal"); saveGame(); render(); schedule();
}
function loadGame() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!S.validate(parsed, D)) { toast("Save unavailable", "This campaign is incomplete or uses an older rules version."); return false; }
    // Player-entered text is escaped; art and styles always come from local metadata.
    parsed.players.forEach((p, i) => {
      const ship = i ? null : PLAYER_SHIPS.find((s) => s.name === p.shipName) || PLAYER_SHIPS[0];
      if (i) Object.assign(p, D.botProfiles[i - 1], { isBot: true, shipName: ["Drake", "Dominix", "Providence"][i - 1] });
      else Object.assign(p, { ship: ship.path, shipName: ship.name, color: "#55d8e8", isBot: false, motto: "probably human" });
    });
    parsed.log.forEach((entry) => { entry.color = /^#[0-9a-f]{6}$/i.test(entry.color) ? entry.color : "#93aab3"; });
    state = parsed; generation++; busy = false; paused = false; visualPositions = null;
    closeDialog("launch-modal"); render(); schedule(); return true;
  } catch { toast("Save unavailable", "The browser could not read this campaign."); return false; }
}
function resetGame() {
  generation++; clearTimeout(timer); state = null; busy = false; visualPositions = null;
  $$('dialog[open]').forEach((d) => d.close()); $$(".die").forEach((d) => d.classList.remove("rolling"));
  try { localStorage.removeItem(SAVE_KEY); } catch { /* Storage is optional. */ }
  $("#resume-game").hidden = true; showDialog("launch-modal");
}
function renderShipPicker() {
  $("#ship-picker").innerHTML = PLAYER_SHIPS.map((s, i) => `<button class="ship-choice ${i === selectedShip ? "selected" : ""}" role="radio" aria-checked="${i === selectedShip}" data-ship="${i}" type="button"><img src="${s.path}" alt="${s.name}"><span>${s.name}</span><small>${s.note}</small></button>`).join("");
  $$(".ship-choice").forEach((button) => button.addEventListener("click", () => { selectedShip = Number(button.dataset.ship); renderShipPicker(); }));
}
function init() {
  renderBoard(); renderShipPicker();
  $("#start-game").addEventListener("click", startGame);
  $("#resume-game").addEventListener("click", loadGame);
  $("#roll-button").addEventListener("click", () => { if (!state || state.players[B.actor(state)].isBot) return; animateAction(() => state.phase === "utility" ? S.utilityRoll(state, D, dice()) : S.roll(state, D, dice())); });
  $("#end-turn-button").addEventListener("click", () => { if (state && !state.players[state.current].isBot) commit(() => S.end(state, D)); });
  $("#resolve-card").addEventListener("click", () => commit(() => S.acknowledge(state, D)));
  $("#new-game-button").addEventListener("click", () => { if (!state || confirm("End this campaign and clear the saved lease?")) resetGame(); });
  $("#clear-log").addEventListener("click", () => { if (state) commit(() => { state.log = []; return true; }); });
  $("#sound-toggle").addEventListener("click", (e) => { audioEnabled = !audioEnabled; e.currentTarget.textContent = audioEnabled ? "SFX ON" : "SFX OFF"; });
  $("#pause-bots").addEventListener("click", () => { paused = !paused; render(); schedule(); });
  $("#view-toggle").addEventListener("click", (e) => { const tilted = $("#board").classList.toggle("tactical-3d"); e.currentTarget.textContent = tilted ? "FLAT VIEW" : "3D VIEW"; e.currentTarget.setAttribute("aria-pressed", String(tilted)); });
  $("#finance-button").addEventListener("click", showFinance);
  $("#auction-finance").addEventListener("click", showFinance);
  $("#trade-button").addEventListener("click", showTrade);
  $("#trade-partner").addEventListener("change", renderTrade);
  $("#submit-trade").addEventListener("click", submitTrade);
  $("#bid-form").addEventListener("submit", (event) => {
    event.preventDefault();
    commit(() => {
      const ok = S.bid(state, D, 0, Number($("#bid-amount").value), $("#auction-target") ? Number($("#auction-target").value) : undefined);
      if (ok) { B.auctionRound(state, D); if (state.auction.leader === 0) S.finishAuction(state, D); }
      return ok;
    });
  });
  $("#auction-pass").addEventListener("click", () => commit(() => { for (let n = 0; n < 5 && B.auctionRound(state, D); n++); return S.finishAuction(state, D); }));
  $$('[data-open]').forEach((button) => button.addEventListener("click", () => { clearTimeout(timer); showDialog(button.dataset.open); }));
  $$('[data-close]').forEach((button) => button.addEventListener("click", () => closeDialog(button.dataset.close)));
  $$('dialog').forEach((dialog) => {
    dialog.addEventListener("close", schedule);
    if (["launch-modal", "card-modal", "auction-modal"].includes(dialog.id)) dialog.addEventListener("cancel", (event) => event.preventDefault());
  });
  $("#pilot-name").addEventListener("keydown", (event) => { if (event.key === "Enter" && $("#launch-modal").open) startGame(); });
  try { $("#resume-game").hidden = !localStorage.getItem(SAVE_KEY); } catch { $("#resume-game").hidden = true; }
  showDialog("launch-modal");
}
init();
