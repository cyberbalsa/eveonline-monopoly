/* Pure game rules shared by the browser and the Node test suite. */
(function exposeEngine(root) {
  const groupCache = new WeakMap();
  const engine = {
    log(state, text, color = "#93aab3", details = {}) {
      if (!Array.isArray(state?.log)) return;
      const player = details.player ?? state.players.findIndex((p) => text.startsWith(`${p.name} `));
      state.log.push({ ...details, id: (state.log.at(-1)?.id || state.log.length) + 1,
        time: Date.now(), round: state.turn, player: player >= 0 ? player : null,
        kind: details.kind || "action", text, color });
    },
    getOwner(state, spaceIndex) {
      return state.players.find((player) => player.properties.includes(spaceIndex)) || null;
    },

    propertyCount(player, type, data) {
      return player.properties.filter((index) => data.spaces[index].type === type).length;
    },

    groupSpaces(group, data) {
      if (!groupCache.has(data)) groupCache.set(data, new Map());
      const cache = groupCache.get(data);
      if (!cache.has(group)) cache.set(group, data.spaces.map((space, index) => ({ ...space, index })).filter((space) => space.group === group));
      return cache.get(group);
    },

    ownsGroup(player, group, data) {
      const spaces = group ? this.groupSpaces(group, data) : [];
      return spaces.length > 0 && spaces.every((space) => player.properties.includes(space.index));
    },

    calculateRent(state, data, spaceIndex, rollTotal = 7) {
      const owner = this.getOwner(state, spaceIndex);
      const space = data.spaces[spaceIndex];
      if (!owner || owner.mortgaged?.[spaceIndex]) return 0;
      if (space.type === "transit") return 25 * (2 ** Math.max(0, this.propertyCount(owner, "transit", data) - 1));
      if (space.type === "utility") return rollTotal * (this.propertyCount(owner, "utility", data) === 2 ? 10 : 4);
      const upgrades = owner.upgrades[spaceIndex] || 0;
      if (upgrades === 0 && this.ownsGroup(owner, space.group, data)) return space.rent[0] * 2;
      return space.rent[upgrades];
    },

    diceProbability(distance) {
      if (distance < 2 || distance > 12) return 0;
      return (6 - Math.abs(7 - distance)) / 36;
    },

    projectedRentExposure(state, data, player) {
      let expected = 0;
      let worst = 0;
      for (let distance = 2; distance <= 12; distance += 1) {
        const index = (player.position + distance) % data.spaces.length;
        const owner = this.getOwner(state, index);
        if (!owner || owner === player) continue;
        const rent = this.calculateRent(state, data, index, distance);
        expected += rent * this.diceProbability(distance);
        worst = Math.max(worst, rent);
      }
      return {
        expected,
        worst,
        recommendedReserve: Math.ceil(Math.max(140, expected * 2.2 + worst * 0.65) / 10) * 10
      };
    },

    buySpace(state, data, player, spaceIndex) {
      const space = data.spaces[spaceIndex];
      if (!space?.price || this.getOwner(state, spaceIndex) || player.cash < space.price || player.bankrupt) return false;
      return this.buySpaceAtPrice(state, data, player, spaceIndex, space.price);
    },

    buySpaceAtPrice(state, data, player, spaceIndex, price) {
      const space = data.spaces[spaceIndex];
      if (!space?.price || this.getOwner(state, spaceIndex) || player.cash < price || player.bankrupt || !Number.isFinite(price) || price < 0) return false;
      player.cash -= price;
      player.properties.push(spaceIndex);
      return true;
    },

    canUpgrade(state, data, player, spaceIndex) {
      const space = data.spaces[spaceIndex];
      const count = player.upgrades[spaceIndex] || 0;
      const group = space?.group ? this.groupSpaces(space.group, data) : [];
      const levels = group.map((item) => player.upgrades[item.index] || 0);
      const bank = state.bank || { houses: 32, hotels: 12 };
      return space?.type === "property"
        && this.ownsGroup(player, space.group, data)
        && !group.some((item) => player.mortgaged?.[item.index])
        && count < data.maxUpgrades
        && count === Math.min(...levels)
        && (count < 4 ? bank.houses > 0 : bank.hotels > 0)
        && player.cash >= space.buildCost
        && !player.bankrupt;
    },

    upgrade(state, data, player, spaceIndex) {
      if (!this.canUpgrade(state, data, player, spaceIndex)) return false;
      const level = player.upgrades[spaceIndex] || 0;
      const bank = state.bank ||= { houses: 32, hotels: 12 };
      player.cash -= data.spaces[spaceIndex].buildCost;
      if (level < 4) bank.houses -= 1;
      else {
        bank.hotels -= 1;
        bank.houses += 4;
      }
      player.upgrades[spaceIndex] = level + 1;
      return true;
    },

    canSellBuilding(state, data, player, spaceIndex) {
      const space = data.spaces[spaceIndex];
      const level = player.upgrades[spaceIndex] || 0;
      if (player.bankrupt || !player.properties.includes(spaceIndex) || space?.type !== "property" || level === 0) return false;
      const levels = this.groupSpaces(space.group, data).map((item) => player.upgrades[item.index] || 0);
      if (level !== Math.max(...levels)) return false;
      return level !== 5 || (state.bank?.houses ?? 32) >= 4;
    },

    sellBuilding(state, data, player, spaceIndex) {
      if (!this.canSellBuilding(state, data, player, spaceIndex)) return false;
      const bank = state.bank ||= { houses: 32, hotels: 12 };
      const level = player.upgrades[spaceIndex];
      player.cash += data.spaces[spaceIndex].buildCost / 2;
      if (level === 5) {
        bank.hotels += 1;
        bank.houses -= 4;
      } else {
        bank.houses += 1;
      }
      player.upgrades[spaceIndex] = level - 1;
      this.log(state, `${player.name} sold ${level === 5 ? "a Keepstar tier (four Astrahus remain)" : "an Astrahus"} in ${data.spaces[spaceIndex].name} for ${data.spaces[spaceIndex].buildCost / 2}M.`, player.color, { kind: "sale" });
      return true;
    },

    canMortgage(state, data, player, spaceIndex) {
      const space = data.spaces[spaceIndex];
      if (player.bankrupt || !space?.price || !player.properties.includes(spaceIndex) || player.mortgaged?.[spaceIndex]) return false;
      if (!space.group) return true;
      return this.groupSpaces(space.group, data).every((item) => (player.upgrades[item.index] || 0) === 0);
    },

    mortgage(state, data, player, spaceIndex) {
      if (!this.canMortgage(state, data, player, spaceIndex)) return false;
      player.mortgaged ||= {};
      player.mortgaged[spaceIndex] = true;
      player.cash += data.spaces[spaceIndex].price / 2;
      this.log(state, `${player.name} mortgaged ${data.spaces[spaceIndex].name} for ${data.spaces[spaceIndex].price / 2}M.`, player.color, { kind: "mortgage" });
      return true;
    },

    unmortgageCost(data, spaceIndex) {
      return data.spaces[spaceIndex].price / 2 + data.spaces[spaceIndex].price / 20;
    },

    unmortgage(data, player, spaceIndex, state) {
      const cost = this.unmortgageCost(data, spaceIndex);
      if (player.bankrupt || !player.properties.includes(spaceIndex) || !player.mortgaged?.[spaceIndex] || player.cash < cost) return false;
      player.cash -= cost;
      delete player.mortgaged[spaceIndex];
      this.log(state, `${player.name} redeemed ${data.spaces[spaceIndex].name} for ${cost}M.`, player.color, { kind: "mortgage" });
      return true;
    },

    raiseCash(state, data, player, amountNeeded) {
      const actions = [];
      // Preserve developed rent engines by mortgaging isolated deeds first.
      for (const index of player.properties.filter((i) => this.canMortgage(state, data, player, i) && !this.ownsGroup(player, data.spaces[i].group, data)).sort((a,b) => (data.spaces[a].type === "utility" ? -1 : 0) - (data.spaces[b].type === "utility" ? -1 : 0) || data.spaces[a].price - data.spaces[b].price)) {
        if (player.cash >= amountNeeded) break;
        this.mortgage(state, data, player, index);
        actions.push({ type: "mortgage", index });
      }
      let guard = 0;
      while (player.cash < amountNeeded && guard < 100) {
        guard += 1;
        const sellable = player.properties
          .filter((index) => this.canSellBuilding(state, data, player, index))
          .sort((a, b) => {
            const aLevel = player.upgrades[a] || 0;
            const bLevel = player.upgrades[b] || 0;
            const aLoss = data.spaces[a].rent[aLevel] - data.spaces[a].rent[aLevel - 1];
            const bLoss = data.spaces[b].rent[bLevel] - data.spaces[b].rent[bLevel - 1];
            return aLoss - bLoss;
          });
        if (!sellable.length) {
          const group = player.properties.map((index) => data.spaces[index].group).find((group) => group && this.groupSpaces(group, data).some((space) => player.upgrades[space.index]));
          if (group) { this.sellGroup(state, data, player, group); actions.push({ type: "sellGroup", index: this.groupSpaces(group, data)[0].index }); continue; }
          break;
        }
        const index = sellable[0];
        this.sellBuilding(state, data, player, index);
        actions.push({ type: "sellBuilding", index });
      }
      const mortgageable = player.properties
        .filter((index) => this.canMortgage(state, data, player, index))
        .sort((a, b) => {
          const aGroup = data.spaces[a].group && this.ownsGroup(player, data.spaces[a].group, data) ? 1 : 0;
          const bGroup = data.spaces[b].group && this.ownsGroup(player, data.spaces[b].group, data) ? 1 : 0;
          return aGroup - bGroup || data.spaces[a].price - data.spaces[b].price;
        });
      for (const index of mortgageable) {
        if (player.cash >= amountNeeded) break;
        this.mortgage(state, data, player, index);
        actions.push({ type: "mortgage", index });
      }
      return { covered: player.cash >= amountNeeded, actions };
    },

    nextPlayerIndex(state) {
      if (state.players.every((player) => player.bankrupt)) return -1;
      let next = state.current;
      do next = (next + 1) % state.players.length;
      while (state.players[next].bankrupt);
      return next;
    },

    sellGroup(state, data, player, group) {
      if (player.bankrupt || !this.ownsGroup(player, group, data)) return false;
      const spaces = this.groupSpaces(group, data);
      if (!spaces.some((space) => player.upgrades[space.index])) return false;
      const oldCash = player.cash;
      for (const space of spaces) {
        const level = player.upgrades[space.index] || 0;
        player.cash += level * space.buildCost / 2;
        if (level === 5) state.bank.hotels++;
        else state.bank.houses += level;
        delete player.upgrades[space.index];
      }
      this.log(state, `${player.name} sold all buildings in ${data.groups[group].name} for ${player.cash - oldCash}M.`, player.color, { kind: "sale" });
      return true;
    },

    liquidationValue(data, player) {
      return player.cash + player.properties.reduce((total, index) => total + (player.mortgaged?.[index] ? 0 : data.spaces[index].price / 2) + (player.upgrades[index] || 0) * (data.spaces[index].buildCost || 0) / 2, 0);
    },

    tradeable(data, player, index) {
      const space = data.spaces[index];
      return !player.bankrupt && player.properties.includes(index) && (!space.group || this.groupSpaces(space.group, data).every((s) => !player.upgrades[s.index]));
    },

    validateTrade(state, data, trade) {
      const a = state.players[trade.from], b = state.players[trade.to];
      if (!a || !b || a === b || a.bankrupt || b.bankrupt) return false;
      for (const [player, side] of [[a, trade.give], [b, trade.take]]) {
        if (!side || !Number.isFinite(side.cash) || side.cash < 0 || side.cash > player.cash || !Array.isArray(side.properties) || !Array.isArray(side.cards)) return false;
        if (new Set(side.properties).size !== side.properties.length || new Set(side.cards).size !== side.cards.length) return false;
        if (!side.properties.every((index) => this.tradeable(data, player, index)) || !side.cards.every((deck) => player.jailCardDecks.includes(deck))) return false;
      }
      return trade.give.cash + trade.take.cash + trade.give.properties.length + trade.take.properties.length + trade.give.cards.length + trade.take.cards.length > 0;
    },

    executeTrade(state, data, trade) {
      if (!this.validateTrade(state, data, trade)) return false;
      const a = state.players[trade.from], b = state.players[trade.to];
      const transfers = [];
      a.cash += trade.take.cash - trade.give.cash;
      b.cash += trade.give.cash - trade.take.cash;
      for (const [source, target, side] of [[a, b, trade.give], [b, a, trade.take]]) {
        for (const index of side.properties) {
          source.properties.splice(source.properties.indexOf(index), 1);
          target.properties.push(index);
          if (source.mortgaged[index]) {
            target.mortgaged[index] = true;
            delete source.mortgaged[index];
            transfers.push({ player: state.players.indexOf(target), index });
          }
        }
        for (const deck of side.cards) {
          source.jailCardDecks.splice(source.jailCardDecks.indexOf(deck), 1);
          target.jailCardDecks.push(deck);
        }
      }
      return transfers;
    },

    portfolioValue(state, data, player) {
      let value = player.cash + player.jailCardDecks.length * 35;
      for (const index of player.properties) {
        const space = data.spaces[index];
        const count = space.group ? this.groupSpaces(space.group, data).filter((s) => player.properties.includes(s.index)).length : this.propertyCount(player, space.type, data);
        const traffic = { brown: 0.8, cyan: 1.1, magenta: 1.2, orange: 1.5, red: 1.25, yellow: 1.05, green: 0.85, blue: 0.95 }[space.group] || 1;
        value += space.price * (space.type === "utility" ? 0.65 : 0.95) + (count - 1) * (space.type === "transit" ? 90 : 35);
        if (space.group && this.ownsGroup(player, space.group, data)) value += traffic * (space.rent[3] * 1.35 - space.buildCost);
        if (player.mortgaged[index]) value -= this.unmortgageCost(data, index);
        value += (player.upgrades[index] || 0) * (space.buildCost || 0) * 0.7;
      }
      return value;
    },

    evaluateTrade(state, data, trade, botIndex) {
      if (!this.validateTrade(state, data, trade)) return { accept: false, valid: false, gain: -Infinity, reason: "Invalid terms" };
      const otherIndex = trade.from === botIndex ? trade.to : trade.from;
      const before = this.portfolioValue(state, data, state.players[botIndex]);
      const otherBefore = this.portfolioValue(state, data, state.players[otherIndex]);
      const copy = { ...state, players: structuredClone(state.players) };
      const transfers = this.executeTrade(copy, data, trade);
      for (const item of transfers) copy.players[item.player].cash -= data.spaces[item.index].price * 0.05;
      const bot = copy.players[botIndex];
      const gain = this.portfolioValue(copy, data, bot) - before;
      const rivalGain = this.portfolioValue(copy, data, copy.players[otherIndex]) - otherBefore;
      const reserve = this.projectedRentExposure(copy, data, bot).recommendedReserve;
      const danger = Object.keys(data.groups).some((group) => !this.ownsGroup(state.players[otherIndex], group, data) && this.ownsGroup(copy.players[otherIndex], group, data));
      const premium = danger ? Math.max(70, rivalGain * 0.65) : 15;
      const minimumReserve = Math.min(150, reserve), liquidityOK = bot.cash >= minimumReserve, transferSolvent = copy.players.every((p) => p.cash >= 0);
      const accept = gain >= premium && liquidityOK && transferSolvent;
      return { accept, valid: true, gain, premium, rivalGain, danger, cashAfter: bot.cash, minimumReserve, liquidityOK, transferSolvent, reason: accept ? "The numbers work. Contract accepted." : danger ? "You get a monopoly. Pay for it." : gain < premium ? "That contract favors you. Try again." : "I need liquid ISK for the next rent bill." };
    },

    botPurchaseDecision(state, data, player, spaceIndex, randomValue = Math.random()) {
      const space = data.spaces[spaceIndex];
      if (!space?.price || this.getOwner(state, spaceIndex) || player.cash < space.price) return { buy: false, reason: "unavailable", score: 0 };
      const profile = player.strategy || {};
      const group = space.group ? this.groupSpaces(space.group, data) : [];
      const ownedInGroup = group.filter((item) => player.properties.includes(item.index)).length;
      const completesGroup = group.length > 0 && ownedInGroup === group.length - 1;
      const blocksOpponent = group.length > 0 && state.players.some((other) => other !== player && group.filter((item) => other.properties.includes(item.index)).length === group.length - 1);
      const networkCount = ["transit", "utility"].includes(space.type) ? this.propertyCount(player, space.type, data) : 0;
      const cashAfter = player.cash - space.price;
      const exposure = this.projectedRentExposure(state, data, player);
      const reserve = Math.max(profile.reserve ?? 220, exposure.recommendedReserve);
      const traffic = { brown: 0.92, cyan: 0.98, magenta: 1.06, orange: 1.24, red: 1.16, yellow: 1.08, green: 0.96, blue: 0.9 }[space.group] || 1;

      let score = profile.baseBuy ?? 0.64;
      score += ((space.rent?.[0] || 12) / space.price) * traffic;
      score += ownedInGroup * 0.21;
      score += networkCount * 0.15;
      if (profile.preferredGroups?.includes(space.group)) score += 0.1;
      if (profile.preferredTypes?.includes(space.type)) score += 0.16;
      if (completesGroup) score += 0.62;
      if (blocksOpponent) score += profile.denial ?? 0.28;
      if (cashAfter < reserve) score -= completesGroup || blocksOpponent ? 0.18 : 0.48;
      if (cashAfter < exposure.worst * 0.45) score -= 0.32;
      score += (randomValue - 0.5) * (profile.variance ?? 0.08);

      return {
        buy: score >= (profile.buyThreshold ?? 0.6),
        score,
        reason: completesGroup ? "completes group" : blocksOpponent ? "blocks rival" : networkCount ? "extends network" : cashAfter < reserve ? "protects rent reserve" : "portfolio value",
        reserve
      };
    },

    botAuctionBid(state, data, player, spaceIndex) {
      const space = data.spaces[spaceIndex];
      const decision = this.botPurchaseDecision(state, data, player, spaceIndex, 0.5);
      if (!space?.price || player.bankrupt) return 0;
      const exposure = this.projectedRentExposure(state, data, player);
      const group = space.group ? this.groupSpaces(space.group, data) : [];
      const owned = group.filter((item) => player.properties.includes(item.index)).length;
      const completes = group.length > 0 && owned === group.length - 1;
      const strategicMultiplier = completes ? 1.75 : Math.max(0.78, Math.min(1.28, decision.score + 0.22));
      const cashCap = Math.max(0, player.cash - Math.max(100, exposure.recommendedReserve * 0.7));
      return Math.floor(Math.min(space.price * strategicMultiplier, cashCap) / 10) * 10;
    },

    botUpgradeChoice(state, data, player, randomValue = Math.random()) {
      const profile = player.strategy || {};
      const reserve = Math.max(profile.upgradeReserve ?? 400, this.projectedRentExposure(state, data, player).recommendedReserve);
      if (player.cash < reserve) return null;
      if (randomValue > (profile.upgradeBias ?? 0.45)) return null;
      const candidates = player.properties.filter((index) => this.canUpgrade(state, data, player, index) && player.cash - data.spaces[index].buildCost >= reserve);
      if (!candidates.length) return null;
      candidates.sort((a, b) => {
        const aLevel = player.upgrades[a] || 0;
        const bLevel = player.upgrades[b] || 0;
        if (aLevel !== bLevel) return aLevel - bLevel;
        return data.spaces[b].rent[aLevel + 1] - data.spaces[a].rent[bLevel + 1];
      });
      // Three houses capture the largest rent jump. Hold four to starve the bank;
      // avoid handing a rival four houses through a premature hotel conversion.
      const favored = candidates.filter((index) => (player.upgrades[index] || 0) < 3);
      if (favored.length) return favored[0];
      const houses = candidates.filter((index) => (player.upgrades[index] || 0) < 4);
      if (houses.length) return houses[0];
      if (state.bank.houses < 6 && state.players.some((p) => p !== player && Object.keys(data.groups).some((g) => this.ownsGroup(p, g, data)))) return null;
      return candidates[0];
    },

    botShouldPayBail(state, data, player) {
      const unclaimed = data.spaces.filter((space, index) => space.price && !this.getOwner(state, index)).length;
      const exposure = this.projectedRentExposure(state, data, player);
      return unclaimed > 8 && player.cash - 50 >= exposure.recommendedReserve;
    }
  };

  root.GAME_ENGINE = engine;
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
})(typeof globalThis !== "undefined" ? globalThis : this);
