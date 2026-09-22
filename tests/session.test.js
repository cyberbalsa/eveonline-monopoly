const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../data");
const E = require("../engine");
const S = require("../session");
const B = require("../bots");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
function rng(seed = 123) { return () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296); }
function game() {
  const s = S.create(D, [{ name: "Human", isBot: false }, ...D.botProfiles.map((p) => ({ ...p, isBot: true }))], rng());
  s.current = 0; return s;
}
function hold(s, id, deck) {
  const index = S.deck(D, deck).findIndex((c) => c.effect.type === "escape");
  s.decks[deck].splice(s.decks[deck].indexOf(index), 1);
  s.players[id].jailCardDecks.push(deck);
}
function forceCard(s, deck, find) {
  const index = S.deck(D, deck).findIndex(find);
  s.decks[deck].splice(s.decks[deck].indexOf(index), 1);
  s.card = { player: 0, deck, index }; s.phase = "card";
  s.queue = [{ type: "finish", player: 0 }];
  return index;
}
function land(s, position, special) {
  s.players[0].position = position;
  s.queue = [{ type: "land", player: 0, total: 7, special }, { type: "finish", player: 0 }];
  S.process(s, D);
}
test("classic prices, taxes, build costs, rents and deck mechanics are fixed", () => {
  assert.deepEqual(D.spaces.filter((s) => s.price).map((s) => s.price), [60,60,200,100,100,120,140,150,140,160,200,180,180,200,220,220,240,200,260,260,150,280,300,300,320,200,350,400]);
  assert.equal(D.spaces[4].amount, 200); assert.equal(D.spaces[38].amount, 100);
  assert.deepEqual(D.spaces[39].rent, [50,200,600,1400,1700,2000]);
  assert.deepEqual(D.spaces[24].rent, [20,100,300,750,925,1100]);
  assert.deepEqual(D.spaces.filter((s) => s.group).map((s) => s.buildCost), [50,50,50,50,50,100,100,100,100,100,100,150,150,150,150,150,150,200,200,200,200,200]);
  assert.equal(D.mailCards.length, 16); assert.equal(D.localCards.length, 16);
  assert.deepEqual(D.mailCards.filter((c) => c.effect.type === "cash").map((c) => c.effect.value).sort((a,b)=>a-b), [-100,-50,-50,10,20,25,50,100,100,100,200]);
  assert.deepEqual(D.localCards.filter((c) => c.effect.type === "cash").map((c) => c.effect.value).sort((a,b)=>a-b), [-15,50,150]);
  assert.deepEqual(D.localCards.filter((c) => c.effect.type === "move").map((c) => c.effect.index).sort((a,b)=>a-b), [0,5,11,24,39]);
  assert.equal(D.localCards.filter((c) => c.effect.type === "nearestTransit").length, 2);
});
test("all 32 meme cards link to existing, uniquely identified research notes", () => {
  const research = readFileSync(join(__dirname, "../research.html"), "utf8");
  const ids = [...research.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, "research anchors must be unique");
  for (const card of [...D.mailCards, ...D.localCards]) {
    assert.ok(card.title && card.body, "every card needs a title and readable instructions");
    assert.match(card.source, /^research\.html#[a-z0-9-]+$/);
    assert.ok(ids.includes(card.source.split("#")[1]), `missing source notes for ${card.title}`);
  }
});
test("salary pays once on passing or landing on Undock, Freeport pays nothing", () => {
  const s = game(); s.players[0].position = 39;
  S.roll(s, D, [1, 2]); assert.equal(s.players[0].cash, 1700); assert.equal(s.phase, "card");
  const t = game(); t.players[0].position = 36;
  S.roll(t, D, [1, 3]); assert.equal(t.players[0].cash, 1700); assert.equal(t.phase, "end");
  land(t, 20); assert.equal(t.players[0].cash, 1700);
});
test("a purchase decision blocks another roll and end-turn, including after doubles", () => {
  const s = game(); S.roll(s, D, [3,3]);
  assert.equal(s.phase, "purchase"); assert.equal(S.end(s,D), false); assert.equal(S.roll(s,D,[2,3]), false);
  S.purchase(s,D,true); assert.equal(s.phase,"roll"); assert.equal(s.doublesRun,1);
});
test("three doubles send directly to the RMT ban without movement or salary", () => {
  const s = game(); s.doublesRun = 2; s.players[0].position = 39;
  S.roll(s,D,[6,6]); assert.equal(s.players[0].position,10); assert.equal(s.players[0].cash,1500); assert.equal(s.phase,"end"); assert.equal(s.players[0].inJail,true);
});
test("Go to Jail ends doubles, visiting does not imprison", () => {
  const s = game(); s.again = true; land(s,30);
  assert.equal(s.phase,"end"); assert.equal(s.players[0].position,10);
  const t = game(); land(t,10); assert.equal(t.players[0].inJail,false);
});
test("jail doubles move without an extra roll; third failure charges 50 before moving", () => {
  const s = game(); S.jail(s,0); S.roll(s,D,[4,4]);
  S.purchase(s,D,true); assert.equal(s.phase,"end"); assert.equal(s.players[0].cash,1320);
  const t = game(); S.jail(t,0); t.players[0].jailTurns=2; S.roll(t,D,[2,3]);
  assert.equal(t.players[0].cash,1450); assert.equal(t.players[0].position,15); assert.equal(t.players[0].inJail,false);
});
test("both streamer cards are held, tradable, usable before rolling, and return to their own deck", () => {
  for (const deck of ["mail","local"]) {
    const s = game(), index = forceCard(s,deck,c=>c.effect.type==="escape");
    assert.match(S.deck(D,deck)[index].title,/Streamer/i);
    S.acknowledge(s,D); assert.deepEqual(s.players[0].jailCardDecks,[deck]); assert.equal(s.decks[deck].length,15);
    S.jail(s,0); s.phase="roll"; assert.equal(S.bail(s,D,deck),true);
    assert.equal(s.players[0].cash,1500); assert.equal(s.players[0].inJail,false); assert.equal(s.decks[deck].at(-1),index); assert.equal(s.phase,"roll"); assert.ok(S.validate(s,D));
  }
});
test("nearest bridge doubles rent and a nearest utility card uses fresh dice at 10x", () => {
  const s=game(); s.players[0].position=7; s.players[1].properties=[15];
  forceCard(s,"local",c=>c.effect.type==="nearestTransit"); S.acknowledge(s,D);
  assert.equal(s.players[0].cash,1450); assert.equal(s.players[1].cash,1550);
  const t=game(); t.players[0].position=7; t.players[1].properties=[12];
  forceCard(t,"local",c=>c.effect.type==="nearestUtility"); S.acknowledge(t,D);
  assert.equal(t.phase,"utility"); assert.equal(t.players[0].cash,1500);
  S.utilityRoll(t,D,[3,4]); assert.equal(t.players[0].cash,1430); assert.equal(t.players[0].position,12);
});
test("ordinary utility rent follows C1009 fresh-roll rule, mortgaged utility charges zero", () => {
  const s=game(); s.players[1].properties=[12]; land(s,12); assert.equal(s.phase,"utility");
  S.utilityRoll(s,D,[2,3]); assert.equal(s.players[0].cash,1480);
  s.players[1].mortgaged[12]=true; land(s,12); assert.equal(s.phase,"end"); assert.equal(s.players[0].cash,1480);
});
test("back three resolves a second card and pays no salary", () => {
  const s=game(); s.players[0].position=36;
  forceCard(s,"local",c=>c.effect.type==="back"); S.acknowledge(s,D);
  assert.equal(s.phase,"card"); assert.equal(s.card.deck,"mail"); assert.equal(s.players[0].position,33); assert.equal(s.players[0].cash,1500);
});
test("repairs count a hotel once, not as five houses", () => {
  const s=game(); s.players[0].properties=[1,3,6,8,9]; s.players[0].upgrades={1:5,3:5,6:2,8:2,9:2}; s.bank={houses:26,hotels:10};
  forceCard(s,"mail",c=>c.effect.type==="classicRepairs"); S.acknowledge(s,D);
  assert.equal(s.players[0].cash,1030); assert.ok(S.validate(s,D));
});
test("auctions admit the declining buyer, require valid money, allow 1M increments", () => {
  const s=game(); land(s,1); S.purchase(s,D,false);
  assert.equal(s.phase,"auction"); assert.equal(S.bid(s,D,0,9),false); assert.equal(S.bid(s,D,0,NaN),false);
  assert.equal(S.bid(s,D,0,10),true); assert.equal(S.bid(s,D,1,11),true); assert.equal(S.bid(s,D,0,12),true);
  S.finishAuction(s,D); assert.deepEqual(s.players[0].properties,[1]); assert.equal(s.players[0].cash,1488);
});
test("unbid property remains with Bank", () => {
  const s=game(); S.auction(s,D,1); S.finishAuction(s,D); assert.equal(E.getOwner(s,1),null);
});
test("finite supply and even selling are enforced; hotel conversion returns four houses", () => {
  const s=game(), p=s.players[0]; p.properties=[1,3]; p.upgrades={1:4,3:4}; s.bank.houses=24;
  E.upgrade(s,D,p,1); assert.deepEqual(s.bank,{houses:28,hotels:11});
  assert.equal(E.sellBuilding(s,D,p,3),false);
  E.sellBuilding(s,D,p,1); assert.deepEqual(s.bank,{houses:24,hotels:12}); assert.equal(p.cash,1475);
  s.bank.houses=0; assert.equal(E.canUpgrade(s,D,p,1),true,"hotel available with existing houses");
  p.upgrades={1:3,3:3}; assert.equal(E.canUpgrade(s,D,p,1),false,"no house substitutes");
});
test("last house is auctioned when multiple players can build", () => {
  const s=game(); s.players[0].properties=[1,3]; s.players[1].properties=[6,8,9]; s.bank.houses=1;
  S.build(s,D,0,1); assert.equal(s.phase,"auction"); assert.equal(s.auction.building,"houses");
  S.bid(s,D,1,11,6); S.finishAuction(s,D); assert.equal(s.players[1].upgrades[6],1); assert.equal(s.players[1].cash,1489); assert.equal(s.bank.houses,0); assert.equal(s.phase,"roll");
});
test("an uncontested last house costs its printed price; human may contest a bot request", () => {
  const s=game(); s.players[0].properties=[1,3];s.bank.houses=1;
  S.build(s,D,0,1);assert.equal(s.phase,"roll");assert.equal(s.players[0].cash,1450);
  const t=game();t.players[0].properties=[1,3];t.players[1].properties=[6,8,9];t.bank.houses=1;
  S.build(t,D,1,6);assert.equal(t.phase,"buildingOffer");
  S.buildingResponse(t,D,false);assert.equal(t.players[1].cash,1450);assert.equal(t.phase,"roll");
});
test("a mortgage can be redeemed with the exact half-unit balance", () => {
  const s=game(),p=s.players[0];p.properties=[37];p.mortgaged[37]=true;p.cash=192.5;
  assert.equal(E.unmortgage(D,p,37),true);assert.equal(p.cash,0);
});
test("voluntary bail insolvency does not leave an eliminated human with a roll prompt", () => {
  const s=game();S.jail(s,0);s.players[0].cash=0;S.bail(s,D);S.bankrupt(s,D);assert.equal(s.phase,"end");
});
test("mortgages block building, stop rent, preserve set bonuses elsewhere and cost 10% to redeem", () => {
  const s=game(), p=s.players[0]; p.properties=[37,39];
  E.mortgage(s,D,p,37); assert.equal(p.cash,1675); assert.equal(E.calculateRent(s,D,37),0); assert.equal(E.calculateRent(s,D,39),100);
  assert.equal(E.canUpgrade(s,D,p,39),false); E.unmortgage(D,p,37); assert.equal(p.cash,1482.5);
  E.upgrade(s,D,p,37); assert.equal(E.canMortgage(s,D,p,39),false);
});
test("debt lets the human choose assets; bankruptcy cannot discard a payable debt", () => {
  const s=game(), p=s.players[0]; p.cash=0; p.properties=[1,3];
  s.queue=[{type:"pay",player:0,to:1,amount:50,reason:"rent"},{type:"finish",player:0}]; S.process(s,D);
  assert.equal(s.phase,"debt"); assert.equal(S.bankrupt(s,D),false); assert.equal(p.properties.length,2);
  E.mortgage(s,D,p,1); E.mortgage(s,D,p,3); S.process(s,D);
  assert.equal(p.cash,10); assert.equal(s.players[1].cash,1550); assert.equal(s.phase,"end");
});
test("bankruptcy to a pilot transfers cards and mortgages and asks recipient about interest", () => {
  const s=game(); s.players[0].cash=0; s.players[0].properties=[1]; hold(s,0,"mail");
  s.queue=[{type:"pay",player:0,to:1,amount:1000,reason:"rent"},{type:"finish",player:0}]; S.process(s,D); S.bankrupt(s,D);
  assert.equal(s.players[0].bankrupt,true); assert.deepEqual(s.players[1].properties,[1]); assert.deepEqual(s.players[1].jailCardDecks,["mail"]); assert.equal(s.phase,"mortgage");
  S.mortgageChoice(s,D,false); assert.equal(s.players[1].cash,1527); assert.equal(s.players[1].mortgaged[1],true); assert.ok(S.validate(s,D));
});
test("bankruptcy to Bank cancels mortgages, returns cards, auctions deeds", () => {
  const s=game(); s.players[0].cash=0; s.players[0].properties=[1]; hold(s,0,"local");
  s.queue=[{type:"pay",player:0,to:null,amount:1000,reason:"tax"},{type:"finish",player:0}]; S.process(s,D); S.bankrupt(s,D);
  assert.equal(s.phase,"auction"); assert.equal(s.decks.local.length,16); assert.equal(E.getOwner(s,1),null);
  S.bid(s,D,1,10); S.finishAuction(s,D); assert.equal(s.players[1].mortgaged[1],undefined); assert.ok(S.validate(s,D));
});
test("trades exchange money, properties and held cards atomically; built groups cannot trade", () => {
  const s=game(); s.players[0].properties=[1,3]; s.players[1].properties=[6]; hold(s,0,"mail");
  const trade={from:0,to:1,give:{cash:50,properties:[1],cards:["mail"]},take:{cash:0,properties:[6],cards:[]}};
  assert.equal(S.trade(s,D,trade),true); assert.equal(s.players[0].cash,1450); assert.deepEqual(s.players[0].properties,[3,6]); assert.deepEqual(s.players[1].jailCardDecks,["mail"]);
  const t=game(); t.players[0].properties=[1,3]; E.upgrade(t,D,t.players[0],1);
  assert.equal(E.tradeable(D,t.players[0],3),false);
  trade.give.cash=Infinity; assert.equal(E.validateTrade(s,D,trade),false);
});
test("mortgaged trade recipient can redeem immediately without paying interest twice", () => {
  const s=game(); s.players[0].properties=[1]; E.mortgage(s,D,s.players[0],1);
  S.trade(s,D,{from:0,to:1,give:{cash:0,properties:[1],cards:[]},take:{cash:50,properties:[],cards:[]}});
  assert.equal(s.phase,"mortgage"); S.mortgageChoice(s,D,true);
  assert.equal(s.players[1].cash,1417); assert.equal(s.players[1].mortgaged[1],undefined); assert.equal(s.phase,"roll");
});
test("hard bots refuse a cheap deal completing the human monopoly", () => {
  const s=game(); s.players[0].properties=[16,18]; s.players[1].properties=[19];
  const trade={from:0,to:1,give:{cash:200,properties:[],cards:[]},take:{cash:0,properties:[19],cards:[]}};
  assert.equal(E.evaluateTrade(s,D,trade,1).accept,false);
  s.players[0].cash=3000; trade.give.cash=2500;
  assert.equal(E.evaluateTrade(s,D,trade,1).accept,true);
});
test("bot bargaining finds a mutually acceptable set-completion contract", () => {
  const s=game();s.players[0].isBot=true;s.players[1].properties=[16,18];s.players[1].cash=3000;s.players[2].properties=[19];
  const proposal=B.proposal(s,D,1);assert.ok(proposal);assert.equal(E.evaluateTrade(s,D,proposal,1).accept,true);assert.equal(E.evaluateTrade(s,D,proposal,2).accept,true);
  S.trade(s,D,proposal);assert.equal(E.ownsGroup(s.players[1],"orange",D),true);
});
test("liquidation mortgages an isolated deed before breaking developed income", () => {
  const s=game(),p=s.players[0];p.cash=0;p.properties=[1,3,12];p.upgrades={1:3,3:3};s.bank.houses=26;
  E.raiseCash(s,D,p,50);assert.equal(p.mortgaged[12],true);assert.equal(p.upgrades[1],3);assert.equal(p.upgrades[3],3);
});
test("corrupt pending decisions and corrupt game-over saves are rejected", () => {
  const s=game();s.phase="purchase";s.purchase={player:99,index:1};assert.equal(S.validate(s,D),false);
  const t=game();t.phase="over";t.gameOver=true;assert.equal(S.validate(t,D),false);
});
test("saving a pending card, doubles or auction does not reroll or lose its continuation", () => {
  const s=game(); S.roll(s,D,[1,1]); assert.equal(s.phase,"card");
  let loaded=JSON.parse(JSON.stringify(s)); assert.ok(S.validate(loaded,D)); assert.equal(loaded.doublesRun,1); assert.deepEqual(loaded.queue,s.queue);
  S.acknowledge(loaded,D); if(loaded.phase==="purchase")S.purchase(loaded,D,false);
  S.auction(loaded,D,39); S.bid(loaded,D,0,10); loaded=JSON.parse(JSON.stringify(loaded));
  assert.ok(S.validate(loaded,D)); assert.equal(loaded.auction.bid,10);
  loaded.bank.houses++; assert.equal(S.validate(loaded,D),false);
});
test("seeded full campaigns preserve ownership, money, deck and building invariants", () => {
  let completed=0;
  for(let seed=1;seed<=24;seed++) {
    const random=rng(seed), s=S.create(D,[...D.botProfiles,D.botProfiles[0]].map((p,i)=>({...p,name:`Bot ${i}`,isBot:true})),random);
    for(let n=0;n<12000&&!s.gameOver;n++) {
      if(s.phase==="auction") { if(!B.auctionRound(s,D))S.finishAuction(s,D); }
      else assert.equal(B.step(s,D,random),true,`stalled seed ${seed} at ${s.phase}`);
      assert.ok(S.validate(s,D),`invalid seed ${seed} at ${s.phase}`);
    }
    if(s.gameOver) {completed++; assert.equal(s.players.filter(p=>!p.bankrupt).length,1);}
  }
  assert.ok(completed>=20,`${completed}/24 games completed inside test horizon`);
});
