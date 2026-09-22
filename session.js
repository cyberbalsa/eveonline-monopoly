/* Serializable turn state. Decisions survive reloads; animations never own rules. */
(function expose(root) {
  const E = typeof module !== "undefined" && module.exports ? require("./engine.js") : root.GAME_ENGINE;
  const S = {
    version: 3,
    shuffle(length, random = Math.random) {
      const result = Array.from({ length }, (_, i) => i);
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    },
    create(data, players, random = Math.random) {
      const state = { version: this.version, players: players.map((p) => ({ ...p, cash: 1500, position: 0, properties: [], upgrades: {}, mortgaged: {}, jailCardDecks: [], inJail: false, jailTurns: 0, bankrupt: false })), current: 0, turn: 1, phase: "roll", doublesRun: 0, lastRoll: [0, 0], again: false, queue: [], log: [], bank: { houses: 32, hotels: 12 }, decks: { mail: this.shuffle(16, random), local: this.shuffle(16, random) }, gameOver: false };
      // A highest opening roll selects the first player, including tie rerolls.
      let candidates = players.map((_, i) => i);
      for (let attempt = 0; candidates.length > 1 && attempt < 100; attempt++) {
        const rolls = candidates.map((i) => ({ i, roll: 2 + Math.floor(random() * 6) + Math.floor(random() * 6) }));
        this.log(state, rolls.map(({ i, roll }) => `${players[i].name}: ${roll}`).join(" · "));
        const highest = Math.max(...rolls.map((r) => r.roll));
        candidates = rolls.filter((r) => r.roll === highest).map((r) => r.i);
      }
      state.current = candidates[0];
      this.log(state, `${state.players[state.current].name} won the opening roll. Sign the lease.`, state.players[state.current].color);
      return state;
    },
    log(state, text, color = "#93aab3", details = {}) { E.log(state, text, color, details); },
    deck(data, name) { return name === "mail" ? data.mailCards : data.localCards; },
    jail(state, id) {
      const p = state.players[id];
      p.position = 10; p.inJail = true; p.jailTurns = 0;
      state.again = false; state.doublesRun = 0;
      this.log(state, `${p.name} was banned for RMT and sent to Winning EVE. Go touch grass.`, "#df6f73", { kind: "jail", player: id });
    },
    move(state, data, id, target, salary = true) {
      const p = state.players[id];
      if (salary && target < p.position) {
        p.cash += data.salary;
        this.log(state, `${p.name} passed Undock. Collect 200M.`, p.color, { kind: "income", player: id });
      }
      p.position = target;
      this.log(state, `${p.name} moved to ${data.spaces[target].name}.`, p.color, { kind: "move", player: id, index: target });
    },
    roll(state, data, dice) {
      if (state.phase !== "roll" || state.gameOver || dice.length !== 2 || !dice.every((n) => Number.isInteger(n) && n >= 1 && n <= 6)) return false;
      const id = state.current, p = state.players[id], total = dice[0] + dice[1], doubles = dice[0] === dice[1];
      if (p.bankrupt) return false;
      state.lastRoll = dice; state.again = doubles;
      this.log(state, `${p.name} rolled ${dice[0]} + ${dice[1]}${doubles ? " (doubles)" : ""}.`, p.color, { kind: "roll", player: id });
      if (p.inJail) {
        state.again = false;
        if (doubles) { p.inJail = false; p.jailTurns = 0; this.log(state, `${p.name} rolled doubles and stopped winning EVE. Back to the launcher. Move once; no extra roll.`, p.color); }
        else if (++p.jailTurns < 3) { this.log(state, `${p.name}'s ban appeal failed (${p.jailTurns}/3). Still touching grass. No movement.`, p.color, { player: id }); state.phase = "end"; return true; }
        else state.queue.push({ type: "pay", player: id, to: null, amount: 50, reason: "third failed ban appeal" }, { type: "release", player: id });
      } else {
        state.doublesRun = doubles ? state.doublesRun + 1 : 0;
        if (state.doublesRun === 3) { this.jail(state, id); state.phase = "end"; return true; }
      }
      state.queue.push({ type: "move", player: id, target: (p.position + total) % 40, total }, { type: "finish", player: id });
      this.process(state, data);
      return true;
    },
    process(state, data) {
      state.phase = "resolving";
      while (state.queue.length && !state.gameOver) {
        const event = state.queue[0], p = state.players[event.player];
        if (p?.bankrupt && !["finish", "restore"].includes(event.type)) { state.queue.shift(); continue; }
        if (event.type === "pay") {
          if (event.to !== null && state.players[event.to].bankrupt) { state.queue.shift(); continue; }
          if (p.cash < event.amount) {
            if (!event.announced) { this.log(state, `${p.name} owes ${event.amount}M to ${event.to === null ? "the Bank" : state.players[event.to].name} for ${event.reason}; raising cash.`, p.color, { kind: "debt", player: event.player }); event.announced = true; }
            state.phase = "debt"; return;
          }
          p.cash -= event.amount;
          if (event.to !== null) state.players[event.to].cash += event.amount;
          this.log(state, `${p.name} paid ${event.amount}M to ${event.to === null ? "the Bank" : state.players[event.to].name}: ${event.reason}.`, p.color, { kind: event.rent ? "rent" : "payment", player: event.player, to: event.to, amount: event.amount, index: event.index });
          state.queue.shift(); continue;
        }
        if (event.type === "mortgage") { state.phase = "mortgage"; return; }
        state.queue.shift();
        switch (event.type) {
          case "move":
            this.move(state, data, event.player, event.target, event.salary !== false);
            state.queue.unshift({ type: "land", player: event.player, total: event.total || state.lastRoll[0] + state.lastRoll[1], special: event.special });
            break;
          case "land": {
            const index = p.position, space = data.spaces[index], owner = E.getOwner(state, index);
            if (space.price) {
              if (!owner) { state.purchase = { player: event.player, index }; state.phase = "purchase"; return; }
              if (owner !== p && !owner.mortgaged[index]) {
                if (space.type === "utility") { state.utility = { player: event.player, owner: state.players.indexOf(owner), index, multiplier: event.special === "utility" ? 10 : E.propertyCount(owner, "utility", data) === 2 ? 10 : 4 }; state.phase = "utility"; return; }
                const amount = E.calculateRent(state, data, index, event.total) * (event.special === "transit" ? 2 : 1);
                state.queue.unshift({ type: "pay", player: event.player, to: state.players.indexOf(owner), amount, reason: space.name, rent: true, index });
              }
            } else if (space.type === "tax") state.queue.unshift({ type: "pay", player: event.player, to: null, amount: space.amount, reason: space.name });
            else if (space.type === "gotojail") this.jail(state, event.player);
            else if (space.type === "card") {
              const cardIndex = state.decks[space.deck].shift();
              state.card = { player: event.player, deck: space.deck, index: cardIndex };
              state.phase = "card";
              this.log(state, `${p.name} drew ${this.deck(data, space.deck)[cardIndex].title}.`, p.color, { kind: "card", player: event.player });
              return;
            } else if (index === 20) this.log(state, `${p.name} docks at Freeport. Free parking, no payout.`, p.color);
            break;
          }
          case "release": p.inJail = false; p.jailTurns = 0; this.log(state, `${p.name}'s RMT ban was lifted. Finished touching grass; back to EVE.`, p.color, { player: event.player }); break;
          case "unmortgage": delete p.mortgaged[event.index]; this.log(state, `${p.name} redeemed ${data.spaces[event.index].name}.`, p.color, { kind: "mortgage", player: event.player }); break;
          case "auction": this.auction(state, data, event.index); return;
          case "restore":
            state.phase = event.phase === "roll" && state.players[state.current].bankrupt ? "end" : event.phase;
            if (event.phase === "debt") { this.process(state, data); }
            return;
          case "finish":
            state.phase = state.again && !p.inJail && !p.bankrupt ? "roll" : "end";
            if (state.phase === "roll") this.log(state, `${p.name} rolled doubles. Roll again.`, p.color);
            return;
        }
      }
      if (state.gameOver) state.phase = "over";
    },
    purchase(state, data, buy) {
      if (state.phase !== "purchase") return false;
      const { player, index } = state.purchase;
      if (buy) {
        if (!E.buySpace(state, data, state.players[player], index)) return false;
        this.log(state, `${state.players[player].name} leased ${data.spaces[index].name} for ${data.spaces[index].price}M.`, state.players[player].color, { kind: "purchase", player });
        delete state.purchase; this.process(state, data);
      } else { this.log(state, `${state.players[player].name} declined ${data.spaces[index].name}. Send it to auction.`, state.players[player].color, { player }); delete state.purchase; this.auction(state, data, index); }
      return true;
    },
    acknowledge(state, data) {
      if (state.phase !== "card") return false;
      const { player, deck, index } = state.card, p = state.players[player];
      const card = this.deck(data, deck)[index], effect = card.effect;
      this.log(state, `${p.name} ${effect.type === "escape" ? "kept" : "resolved"} ${card.title}: ${card.body}`, p.color, { kind: "card-resolved", player });
      delete state.card;
      if (effect.type === "escape") p.jailCardDecks.push(deck);
      else state.decks[deck].push(index);
      const actions = [], pay = (amount, to = null, payer = player) => ({ type: "pay", player: payer, amount, to, reason: "a card event" });
      switch (effect.type) {
        case "cash": if (effect.value >= 0) { p.cash += effect.value; this.log(state, `${p.name} received ${effect.value}M from the Bank: ${card.title}.`, p.color, { kind: "income", player }); } else actions.push(pay(-effect.value)); break;
        case "jail": this.jail(state, player); break;
        case "move": actions.push({ type: "move", player, target: effect.index }); break;
        case "back": actions.push({ type: "move", player, target: (p.position - effect.value + 40) % 40, salary: false }); break;
        case "nearestTransit": case "nearestUtility": {
          const targets = effect.type === "nearestTransit" ? [5, 15, 25, 35] : [12, 28];
          actions.push({ type: "move", player, target: targets.find((n) => n > p.position) ?? targets[0], special: effect.type === "nearestTransit" ? "transit" : "utility" });
          break;
        }
        case "classicRepairs": {
          const amount = Object.values(p.upgrades).reduce((sum, n) => sum + (n === 5 ? effect.hotel : n * effect.house), 0);
          if (amount) actions.push(pay(amount)); break;
        }
        case "payAll": case "collectAll":
          state.players.forEach((other, id) => { if (id !== player && !other.bankrupt) actions.push(effect.type === "payAll" ? pay(effect.value, id) : pay(effect.value, player, id)); });
          break;
      }
      state.queue.unshift(...actions); this.process(state, data); return true;
    },
    utilityRoll(state, data, dice) {
      if (state.phase !== "utility" || !dice.every((n) => Number.isInteger(n) && n >= 1 && n <= 6) || dice.length !== 2) return false;
      const { player, owner, index, multiplier } = state.utility;
      state.lastRoll = dice;
      this.log(state, `${state.players[player].name} rolled utility rent: ${dice.join(" + ")}. ${multiplier} times the total; no movement.`, state.players[player].color, { kind: "roll", player });
      state.queue.unshift({ type: "pay", player, to: owner, amount: multiplier * (dice[0] + dice[1]), reason: data.spaces[index].name, rent: true, index });
      delete state.utility; this.process(state, data); return true;
    },
    bail(state, data, card = null) {
      const p = state.players[state.current];
      if (state.phase !== "roll" || !p.inJail) return false;
      if (card) {
        if (!p.jailCardDecks.includes(card)) return false;
        p.jailCardDecks.splice(p.jailCardDecks.indexOf(card), 1);
        state.decks[card].push(this.deck(data, card).findIndex((c) => c.effect.type === "escape"));
        p.inJail = false; p.jailTurns = 0;
        this.log(state, `${p.name} used ${this.deck(data, card).find((c) => c.effect.type === "escape").title}.`, p.color);
      } else {
        state.queue.push({ type: "pay", player: state.current, to: null, amount: 50, reason: "ban appeal" }, { type: "release", player: state.current }, { type: "restore", phase: "roll" });
        this.process(state, data);
      }
      return true;
    },
    auction(state, data, index, building = null, returnPhase = null) {
      state.auction = { index, building, returnPhase, bid: 0, leader: null, targets: {}, passed: [] };
      if (building) {
        state.players.forEach((p, id) => { const target = p.properties.find((i) => E.canUpgrade(state, data, { ...p, cash: Infinity }, i) && ((p.upgrades[i] || 0) === 4 ? "hotels" : "houses") === building); if (target !== undefined) state.auction.targets[id] = target; });
      }
      state.phase = "auction";
      this.log(state, `Auction opened: ${building ? `last ${building === "houses" ? "Astrahus" : "Keepstar"}` : data.spaces[index].name}. All eligible pilots may bid.`, undefined, { kind: "auction" });
    },
    bid(state, data, id, amount, target) {
      if (state.phase !== "auction") return false;
      const a = state.auction, p = state.players[id];
      if (!p || p.bankrupt || !Number.isInteger(amount) || amount < (a.bid ? a.bid + 1 : 10) || amount > p.cash) return false;
      if (a.building) {
        target ??= a.targets[id];
        if (!p.properties.includes(target) || !E.canUpgrade(state, data, { ...p, cash: Math.max(p.cash, data.spaces[target].buildCost) }, target) || ((p.upgrades[target] || 0) === 4 ? "hotels" : "houses") !== a.building) return false;
        a.targets[id] = target;
      }
      a.bid = amount; a.leader = id; a.passed = [];
      this.log(state, `${p.name} bids ${amount}M for ${a.building ? `the last ${a.building === "houses" ? "Astrahus" : "Keepstar"}` : data.spaces[a.index].name}.`, p.color, { kind: "bid", player: id }); return true;
    },
    finishAuction(state, data) {
      if (state.phase !== "auction") return false;
      const a = state.auction;
      if (a.leader !== null) {
        const p = state.players[a.leader];
        if (a.building) {
          const index = a.targets[a.leader], cost = data.spaces[index].buildCost;
          p.cash += cost - a.bid;
          E.upgrade(state, data, p, index);
          this.log(state, `${p.name} won the last ${a.building === "houses" ? "Astrahus" : "Keepstar"} for ${a.bid}M and anchored it in ${data.spaces[index].name}.`, p.color, { kind: "build", player: a.leader });
        } else {
          E.buySpaceAtPrice(state, data, p, a.index, a.bid);
          this.log(state, `${p.name} won ${data.spaces[a.index].name} for ${a.bid}M.`, p.color, { kind: "purchase", player: a.leader });
        }
      } else this.log(state, "No bids. The Bank keeps the asset.");
      delete state.auction;
      if (a.returnPhase) state.phase = a.returnPhase;
      else this.process(state, data);
      return true;
    },
    build(state, data, id, index) {
      const p = state.players[id];
      if (!E.canUpgrade(state, data, p, index) || !["roll", "end", "purchase"].includes(state.phase)) return false;
      const kind = (p.upgrades[index] || 0) === 4 ? "hotels" : "houses";
      const competitors = state.players.some((other) => {
        if (other === p || other.bankrupt || !other.isBot) return false;
        const wanted = E.botUpgradeChoice(state, data, other, 0);
        return wanted !== null && ((other.upgrades[wanted] || 0) === 4 ? "hotels" : "houses") === kind;
      });
      const humanCanBid = id !== 0 && !state.players[0].isBot && !state.players[0].bankrupt && state.players[0].cash >= 10 && state.players[0].properties.some((i) => E.canUpgrade(state, data, { ...state.players[0], cash: Infinity }, i) && ((state.players[0].upgrades[i] || 0) === 4 ? "hotels" : "houses") === kind);
      if (state.bank[kind] === 1 && (competitors || humanCanBid)) {
        state.buildingRequest = { player: id, index, kind, returnPhase: state.phase };
        if (competitors) this.buildingResponse(state, data, true);
        else { this.log(state, `${p.name} requested the last ${kind === "houses" ? "Astrahus" : "Keepstar"} for ${data.spaces[index].name}; waiting for competitors.`, p.color, { player: id }); state.phase = "buildingOffer"; }
      } else { E.upgrade(state, data, p, index); this.log(state, `${p.name} anchored ${p.upgrades[index] === 5 ? "a Keepstar" : "an Astrahus"} in ${data.spaces[index].name} for ${data.spaces[index].buildCost}M.`, p.color, { kind: "build", player: id }); }
      return true;
    },
    buildingResponse(state, data, compete) {
      const request = state.buildingRequest;
      if (!request) return false;
      delete state.buildingRequest;
      if (compete) {
        this.auction(state, data, request.index, request.kind, request.returnPhase);
        state.auction.targets[request.player] = request.index;
        this.bid(state, data, request.player, 10, request.index);
      } else {
        E.upgrade(state, data, state.players[request.player], request.index);
        this.log(state, `${state.players[request.player].name} bought the last ${request.kind === "houses" ? "Astrahus" : "Keepstar"} for ${data.spaces[request.index].buildCost}M in ${data.spaces[request.index].name}.`, state.players[request.player].color, { kind: "build", player: request.player });
        state.phase = request.returnPhase;
      }
      return true;
    },
    mortgageChoice(state, data, lift) {
      if (state.phase !== "mortgage") return false;
      const event = state.queue.shift(), amount = lift ? E.unmortgageCost(data, event.index) : data.spaces[event.index].price / 20;
      this.log(state, `${state.players[event.player].name} chose to ${lift ? "redeem" : "keep the mortgage on"} ${data.spaces[event.index].name}; Bank charge ${amount}M.`, state.players[event.player].color, { player: event.player });
      const events = [{ type: "pay", player: event.player, to: null, amount, reason: "transferred mortgage" }];
      if (lift) events.push({ type: "unmortgage", player: event.player, index: event.index });
      state.queue.unshift(...events); this.process(state, data); return true;
    },
    trade(state, data, trade) {
      if (!["roll", "end", "purchase", "debt"].includes(state.phase)) return false;
      const mortgages = E.executeTrade(state, data, trade);
      if (!mortgages) return false;
      this.log(state, `${state.players[trade.from].name} traded ${this.describeTradeSide(data, trade.give)} to ${state.players[trade.to].name} for ${this.describeTradeSide(data, trade.take)}.`, state.players[trade.from].color, { kind: "trade", player: trade.from, to: trade.to });
      if (mortgages.length) {
        state.queue.unshift(...mortgages.map((item) => ({ type: "mortgage", ...item })), { type: "restore", phase: state.phase });
        this.process(state, data);
      } else if (state.phase === "debt") this.process(state, data);
      return true;
    },
    describeTradeSide(data, side) {
      return [`${side.cash}M`, ...side.properties.map((i) => data.spaces[i].name), ...side.cards.map((deck) => `${deck === "mail" ? "Alliance Mail" : "Local Spike"} escape card`)].join(" + ");
    },
    bankrupt(state, data) {
      if (state.phase !== "debt") return false;
      const debt = state.queue[0], p = state.players[debt.player];
      if (E.liquidationValue(data, p) >= debt.amount) return false;
      E.raiseCash(state, data, p, Infinity);
      const receiver = debt.to === null ? null : state.players[debt.to];
      const props = [...p.properties], cards = [...p.jailCardDecks];
      this.log(state, `${p.name} surrendered ${p.cash}M, ${props.length} leases and ${cards.length} held cards to ${receiver ? receiver.name : "the Bank (deeds will be auctioned)"}; unpaid debt: ${debt.amount}M.`, p.color, { player: debt.player });
      state.queue.shift();
      p.bankrupt = true;
      if (receiver) {
        receiver.cash += p.cash;
        receiver.properties.push(...props);
        receiver.jailCardDecks.push(...cards);
        for (const index of props) if (p.mortgaged[index]) receiver.mortgaged[index] = true;
        state.queue.unshift(...props.filter((index) => p.mortgaged[index]).map((index) => ({ type: "mortgage", player: debt.to, index })));
      } else {
        cards.forEach((deck) => state.decks[deck].push(this.deck(data, deck).findIndex((card) => card.effect.type === "escape")));
        state.queue.unshift(...props.map((index) => ({ type: "auction", index })));
      }
      p.cash = 0; p.properties = []; p.upgrades = {}; p.mortgaged = {}; p.jailCardDecks = [];
      this.log(state, `${p.name} is bankrupt. Didn't want that empire anyway.`, "#df6f73", { kind: "bankruptcy", player: debt.player });
      const living = state.players.filter((other) => !other.bankrupt);
      if (living.length === 1) { state.gameOver = true; state.phase = "over"; state.queue = []; this.log(state, `${living[0].name} wins. Everyone else is renting.`, living[0].color); }
      else this.process(state, data);
      return true;
    },
    end(state, data) {
      if (state.phase !== "end" || state.gameOver) return false;
      this.log(state, `${state.players[state.current].name} ended their turn.`, state.players[state.current].color, { kind: "turn", player: state.current });
      const next = E.nextPlayerIndex(state);
      if (next <= state.current) state.turn++;
      state.current = next; state.doublesRun = 0; state.again = false; state.phase = "roll";
      this.log(state, `${state.players[next].name}'s turn.`, state.players[next].color, { kind: "turn", player: next });
      return true;
    },
    validate(state, data) {
      if (!state || state.version !== this.version || !Array.isArray(state.players) || state.players.length !== 4 || !["roll", "end", "purchase", "card", "utility", "debt", "auction", "mortgage", "offer", "buildingOffer", "over"].includes(state.phase) || !Number.isInteger(state.current) || state.current < 0 || state.current > 3 || !Array.isArray(state.queue) || !Array.isArray(state.log) || !state.bank || !state.decks) return false;
      if (state.log.some((entry) => !entry || typeof entry.text !== "string")) return false;
      const seen = new Set(); let houses = state.bank.houses, hotels = state.bank.hotels;
      if (![houses, hotels].every((n) => Number.isInteger(n) && n >= 0)) return false;
      for (const p of state.players) {
        if (!Number.isFinite(p.cash) || p.cash < 0 || !Number.isInteger(p.position) || p.position < 0 || p.position > 39 || typeof p.name !== "string" || !Array.isArray(p.properties) || !Array.isArray(p.jailCardDecks) || !p.upgrades || !p.mortgaged) return false;
        for (const index of p.properties) {
          if (!data.spaces[index]?.price || seen.has(index)) return false;
          seen.add(index);
          const level = p.upgrades[index] || 0;
          if (!Number.isInteger(level) || level < 0 || level > 5) return false;
          if (level === 5) hotels++; else houses += level;
        }
      }
      if (houses !== 32 || hotels !== 12) return false;
      for (const deck of ["mail", "local"]) {
        const indexes = [...(state.decks[deck] || [])];
        state.players.forEach((p) => p.jailCardDecks.filter((d) => d === deck).forEach(() => indexes.push(this.deck(data, deck).findIndex((c) => c.effect.type === "escape"))));
        if (state.card?.deck === deck) indexes.push(state.card.index);
        if (indexes.length !== 16 || new Set(indexes).size !== 16 || indexes.some((i) => !Number.isInteger(i) || i < 0 || i > 15)) return false;
      }
      const validPlayer = (id) => Number.isInteger(id) && id >= 0 && id < state.players.length;
      const validDeed = (index) => Number.isInteger(index) && Boolean(data.spaces[index]?.price);
      if (!Array.isArray(state.lastRoll) || state.lastRoll.length !== 2 || state.lastRoll.some((n) => !Number.isInteger(n) || n < 0 || n > 6)) return false;
      if (state.phase === "card" && (!state.card || !validPlayer(state.card.player))) return false;
      if (state.phase === "purchase" && (!state.purchase || !validPlayer(state.purchase.player) || !validDeed(state.purchase.index))) return false;
      if (state.phase === "auction" && (!state.auction || !validDeed(state.auction.index) || !Number.isFinite(state.auction.bid) || state.auction.bid < 0 || state.auction.leader !== null && !validPlayer(state.auction.leader))) return false;
      if (state.phase === "utility" && (!state.utility || !validPlayer(state.utility.player) || !validPlayer(state.utility.owner) || ![4,10].includes(state.utility.multiplier))) return false;
      if (state.phase === "offer" && (!state.offer || !this.validOffer(state, data))) return false;
      if (state.phase === "buildingOffer" && (!state.buildingRequest || !validPlayer(state.buildingRequest.player) || !validDeed(state.buildingRequest.index))) return false;
      if (state.phase === "debt" && (state.queue[0]?.type !== "pay" || !validPlayer(state.queue[0].player) || !Number.isFinite(state.queue[0].amount) || state.queue[0].amount <= 0)) return false;
      if (state.phase === "mortgage" && (state.queue[0]?.type !== "mortgage" || !validPlayer(state.queue[0].player) || !validDeed(state.queue[0].index))) return false;
      if (state.gameOver !== (state.phase === "over") || state.phase === "over" && state.players.filter((p) => !p.bankrupt).length !== 1) return false;
      return true;
    },
    validOffer(state, data) {
      return E.validateTrade(state, data, state.offer.trade);
    }
  };
  root.GAME_SESSION = S;
  if (typeof module !== "undefined" && module.exports) module.exports = S;
})(typeof globalThis !== "undefined" ? globalThis : this);
