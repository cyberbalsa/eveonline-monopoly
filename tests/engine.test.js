const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const data = require("../data.js");
const engine = require("../engine.js");

function player(overrides = {}) {
  return {
    name: "Test Pilot",
    cash: 1500,
    position: 0,
    properties: [],
    upgrades: {},
    mortgaged: {},
    jailCardDecks: [],
    bankrupt: false,
    ...overrides
  };
}

function game(players = [player()]) {
  return { players, current: 0, bank: { houses: 32, hotels: 12 } };
}

test("board keeps the complete 40-space layout", () => {
  assert.equal(data.spaces.length, 40);
  assert.equal(data.spaces.filter((space) => space.type === "property").length, 22);
  assert.equal(data.spaces.filter((space) => space.type === "transit").length, 4);
  assert.equal(data.spaces.filter((space) => space.type === "utility").length, 2);
  assert.equal(data.spaces.filter((space) => space.type === "tax").length, 2);
  assert.equal(data.spaces.filter((space) => space.type === "card").length, 6);
  const nonCards = data.spaces.filter((space) => space.type !== "card");
  assert.equal(new Set(nonCards.map((space) => space.name)).size, nonCards.length);
  assert.deepEqual(new Set(data.spaces.filter((space) => space.type === "card").map((space) => space.name)), new Set(["Militia Orders", "Local Comms"]));
});

test("every property group is complete with four houses and a hotel", () => {
  Object.keys(data.groups).forEach((group) => {
    const spaces = engine.groupSpaces(group, data);
    assert.ok(spaces.length >= 2 && spaces.length <= 3, group);
    spaces.forEach((space) => {
      assert.equal(space.rent.length, 6, space.name);
      assert.ok(space.rent.every((rent, index) => index === 0 || rent > space.rent[index - 1]), space.name);
    });
  });
});

test("a full region group doubles open-space rent", () => {
  const owner = player({ properties: [1, 3] });
  const state = game([owner, player()]);
  assert.equal(engine.calculateRent(state, data, 1), data.spaces[1].rent[0] * 2);
});

test("citadels replace doubled rent with their tier rent", () => {
  const owner = player({ properties: [1, 3], upgrades: { 1: 2 } });
  const state = game([owner, player()]);
  assert.equal(engine.calculateRent(state, data, 1), data.spaces[1].rent[2]);
});

test("jump-bridge rent doubles across the four-link network", () => {
  const owner = player({ properties: [5, 15, 25, 35] });
  const state = game([owner, player()]);
  assert.equal(engine.calculateRent(state, data, 5), 200);
});

test("utility rent uses four or ten times the roll", () => {
  const oneUtility = player({ properties: [12] });
  assert.equal(engine.calculateRent(game([oneUtility]), data, 12, 9), 36);
  oneUtility.properties.push(28);
  assert.equal(engine.calculateRent(game([oneUtility]), data, 12, 9), 90);
});

test("buying a claim transfers cash and prevents a second owner", () => {
  const first = player();
  const second = player();
  const state = game([first, second]);
  assert.equal(engine.buySpace(state, data, first, 1), true);
  assert.equal(first.cash, 1440);
  assert.deepEqual(first.properties, [1]);
  assert.equal(engine.buySpace(state, data, second, 1), false);
});

test("citadel upgrades require the full group, cash, and room below the cap", () => {
  const pilot = player({ properties: [1] });
  const state = game([pilot]);
  assert.equal(engine.upgrade(state, data, pilot, 1), false);
  pilot.properties.push(3);
  assert.equal(engine.upgrade(state, data, pilot, 1), true);
  assert.equal(pilot.upgrades[1], 1);
  assert.equal(pilot.cash, 1450);
  assert.equal(engine.upgrade(state, data, pilot, 1), false, "must build evenly");
  for (let level = 1; level <= 5; level++) {
    if (level > 1) assert.equal(engine.upgrade(state, data, pilot, 1), true);
    assert.equal(engine.upgrade(state, data, pilot, 3), true);
  }
  assert.equal(engine.upgrade(state, data, pilot, 1), false);
  assert.deepEqual(state.bank, { houses: 32, hotels: 10 });
});

test("turn rotation skips biomassed pilots", () => {
  const state = game([player(), player({ bankrupt: true }), player(), player({ bankrupt: true })]);
  assert.equal(engine.nextPlayerIndex(state), 2);
  state.current = 2;
  assert.equal(engine.nextPlayerIndex(state), 0);
});

test("ruthless bot doctrines buy sound claims and preserve distinct priorities", () => {
  const yieldBot = player({ ...data.botProfiles[0], properties: [] });
  const landlord = player({ ...data.botProfiles[1], properties: [] });
  const logistics = player({ ...data.botProfiles[2], properties: [] });
  const state = game([yieldBot, landlord, logistics]);
  assert.equal(engine.botPurchaseDecision(state, data, yieldBot, 26, 0.5).buy, true, "yield bot wants Dronelands");
  assert.equal(engine.botPurchaseDecision(state, data, landlord, 39, 0.5).buy, true, "income strategy values premium systems");
  assert.equal(engine.botPurchaseDecision(state, data, logistics, 39, 0.5).buy, true, "hard bots do not ignore sound purchases");
  assert.equal(engine.botPurchaseDecision(state, data, logistics, 5, 0.5).buy, true, "logistics bot wants jump bridges");
  assert.ok(engine.botAuctionBid(state, data, landlord, 39) > engine.botAuctionBid(state, data, logistics, 39), "set breaker values premium group control more");
  assert.ok(engine.botAuctionBid(state, data, logistics, 5) > engine.botAuctionBid(state, data, yieldBot, 5), "network baron values jump bridges more");
});

test("dice odds form a complete distribution", () => {
  const total = Array.from({ length: 11 }, (_, index) => engine.diceProbability(index + 2)).reduce((sum, chance) => sum + chance, 0);
  assert.ok(Math.abs(total - 1) < 1e-12);
});

test("bots reserve cash against visible rent inside one roll", () => {
  const bot = player({ position: 0 });
  const rival = player({ properties: [6, 8, 9], upgrades: { 6: 3 } });
  const exposure = engine.projectedRentExposure(game([bot, rival]), data, bot);
  assert.equal(exposure.worst, data.spaces[6].rent[3]);
  assert.ok(exposure.expected > 0);
  assert.ok(exposure.recommendedReserve > 140);
});

test("auction bids never spend the bot's modeled safety reserve", () => {
  const bot = player({ ...data.botProfiles[1], cash: 500 });
  const rival = player({ properties: [6, 8, 9], upgrades: { 6: 3 } });
  const state = game([bot, rival]);
  const exposure = engine.projectedRentExposure(state, data, bot);
  const bid = engine.botAuctionBid(state, data, bot, 1);
  assert.ok(bid <= Math.max(0, bot.cash - exposure.recommendedReserve * 0.7));
});

test("bots leave Reship Bay early while claims remain and camp after the board sells", () => {
  const bot = player({ cash: 1500, position: 10 });
  const state = game([bot]);
  assert.equal(engine.botShouldPayBail(state, data, bot), true);
  bot.properties = data.spaces.map((space, index) => space.price ? index : null).filter((index) => index !== null);
  assert.equal(engine.botShouldPayBail(state, data, bot), false);
});

test("bot upgrades build the weakest region first", () => {
  const bot = player({
    ...data.botProfiles[1],
    cash: 1200,
    properties: [1, 3],
    upgrades: { 1: 2, 3: 0 }
  });
  const choice = engine.botUpgradeChoice(game([bot]), data, bot, 0);
  assert.equal(choice, 3);
});

test("card effects use only implemented rule types", () => {
  const implemented = new Set(["cash", "collectAll", "payAll", "move", "back", "jail", "nearestTransit", "nearestUtility", "classicRepairs", "escape"]);
  [...data.mailCards, ...data.localCards].forEach((card) => assert.ok(implemented.has(card.effect.type), card.title));
});

test("every local asset referenced by HTML, data, and ship selection exists", () => {
  const source = [
    fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"),
    fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8"),
    fs.readFileSync(path.join(__dirname, "..", "data.js"), "utf8")
  ].join("\n");
  const assets = [...source.matchAll(/assets\/[a-z0-9-]+\.(?:png|svg)/g)].map((match) => match[0]);
  assert.ok(assets.length > 10);
  new Set(assets).forEach((asset) => assert.ok(fs.existsSync(path.join(__dirname, "..", asset)), asset));
});
