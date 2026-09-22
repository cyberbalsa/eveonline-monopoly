/* Board-game opponents. No future dice or deck inspection. See research.html. */
(function expose(root) {
  const common = typeof module !== "undefined" && module.exports;
  const E = common ? require("./engine.js") : root.GAME_ENGINE;
  const S = common ? require("./session.js") : root.GAME_SESSION;
  const B = {
    actor(state) {
      return ({ purchase: state.purchase?.player, card: state.card?.player, utility: state.utility?.player, debt: state.queue[0]?.player, mortgage: state.queue[0]?.player })[state.phase] ?? state.current;
    },
    bidCap(state, data, id) {
      const p = state.players[id], a = state.auction;
      if (p.bankrupt || !p.isBot) return 0;
      if (!a.building) return E.botAuctionBid(state, data, p, a.index);
      const target = a.targets[id];
      if (target === undefined) return 0;
      const level = p.upgrades[target] || 0, space = data.spaces[target];
      const reserve = E.projectedRentExposure(state, data, p).recommendedReserve;
      return Math.max(0, Math.floor(Math.min(p.cash - reserve, space.buildCost * 1.4 + (space.rent[level + 1] - space.rent[level]) * 0.3)));
    },
    auctionRound(state, data) {
      if (state.phase !== "auction") return false;
      // Bots publicly bid against each other until only a human response remains.
      const caps = state.players.map((_, id) => ({ id, cap: this.bidCap(state, data, id) })).filter((x) => x.cap >= 10).sort((a, b) => b.cap - a.cap || a.id - b.id);
      const contender = caps.find((x) => x.id !== state.auction.leader && x.cap >= (state.auction.bid ? state.auction.bid + 1 : 10));
      if (!contender) return false;
      const rival = caps.find((x) => x.id !== contender.id);
      const bid = Math.min(contender.cap, Math.max(10, state.auction.bid + 1, (rival?.cap || 0) + 1));
      return S.bid(state, data, contender.id, bid);
    },
    proposal(state, data, id) {
      const bot = state.players[id];
      const wanted = data.spaces.map((space, index) => ({ ...space, index })).filter((s) => s.group && !bot.properties.includes(s.index) && E.groupSpaces(s.group, data).filter((g) => bot.properties.includes(g.index)).length === E.groupSpaces(s.group, data).length - 1);
      for (const target of wanted) {
        const owner = E.getOwner(state, target.index);
        if (!owner || !E.tradeable(data, owner, target.index)) continue;
        const to = state.players.indexOf(owner);
        const alternatives = [null, ...bot.properties.filter((index) => E.tradeable(data, bot, index) && data.spaces[index].group !== target.group)];
        for (const giveIndex of alternatives) {
          const offset = giveIndex === null ? target.price : target.price - data.spaces[giveIndex].price;
          const opening = Math.max(0, Math.round((offset + target.price * 0.7) / 5) * 5);
          const budget = Math.floor(bot.cash - Math.max(150, E.projectedRentExposure(state, data, bot).recommendedReserve));
          // Search a bargaining range: face value misses the value of unlocking
          // a whole set. Require both parties' acceptance for bot-to-bot deals.
          const prices = [...new Set([opening, ...Array.from({length:16},(_,n)=>Math.round(budget*n/15/5)*5)])].sort((a,b)=>a-b);
          for (const cash of prices) {
            if (cash < opening || cash > budget) continue;
            const trade = { from: id, to, give: { properties: giveIndex === null ? [] : [giveIndex], cash, cards: [] }, take: { properties: [target.index], cash: 0, cards: [] } };
            if (E.evaluateTrade(state, data, trade, id).accept && (!owner.isBot || E.evaluateTrade(state, data, trade, to).accept)) return trade;
          }
        }
      }
      return null;
    },
    manage(state, data, id) {
      const p = state.players[id];
      const key = `${state.turn}:${id}`;
      if (state.tradeAttempt !== key) {
        state.tradeAttempt = key;
        const trade = this.proposal(state, data, id);
        if (trade) {
          if (state.players[trade.to].isBot) S.trade(state, data, trade);
          else { state.offer = { trade, returnPhase: state.phase }; state.phase = "offer"; }
          return true;
        }
      }
      const reserve = E.projectedRentExposure(state, data, p).recommendedReserve;
      const mortgages = p.properties.filter((index) => p.mortgaged[index]).sort((a, b) => (E.ownsGroup(p, data.spaces[b].group, data) ? 1 : 0) - (E.ownsGroup(p, data.spaces[a].group, data) ? 1 : 0));
      for (const index of mortgages) {
        if (p.cash - E.unmortgageCost(data, index) > Math.max(250, reserve)) {
          E.unmortgage(data, p, index); S.log(state, `${p.name} redeemed ${data.spaces[index].name}.`, p.color); return true;
        }
      }
      const index = E.botUpgradeChoice(state, data, p, 0);
      if (index !== null) return S.build(state, data, id, index);
      return false;
    },
    step(state, data, random = Math.random) {
      const id = this.actor(state), p = state.players[id];
      if (!p?.isBot || state.gameOver) return false;
      switch (state.phase) {
        case "roll":
          if (this.manage(state, data, id)) return true;
          if (p.inJail && p.jailTurns === 2 && p.jailCardDecks.length) return S.bail(state, data, p.jailCardDecks[0]);
          if (p.inJail && E.botShouldPayBail(state, data, p)) { S.bail(state, data, p.jailCardDecks[0] || null); return true; }
          return S.roll(state, data, [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)]);
        case "end": if (this.manage(state, data, id)) return true; return S.end(state, data);
        case "card": return S.acknowledge(state, data);
        case "purchase": return S.purchase(state, data, E.botPurchaseDecision(state, data, p, state.purchase.index, 0.5).buy);
        case "debt":
          E.raiseCash(state, data, p, state.queue[0].amount);
          if (p.cash >= state.queue[0].amount) S.process(state, data);
          else S.bankrupt(state, data);
          return true;
        case "mortgage": {
          const cost = E.unmortgageCost(data, state.queue[0].index);
          return S.mortgageChoice(state, data, p.cash - cost >= E.projectedRentExposure(state, data, p).recommendedReserve);
        }
        case "utility": return S.utilityRoll(state, data, [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)]);
        default: return false;
      }
    }
  };
  root.GAME_BOTS = B;
  if (common) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);
