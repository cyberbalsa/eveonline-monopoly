// Reproducible policy comparison; no wall-clock or turn-limit rule in the game.
const D = require("../data"), E = require("../engine"), S = require("../session"), B = require("../bots");
const games = Number(process.argv[2] || 48);
const seedBase = Number(process.argv[3] || 7919);
if (!Number.isInteger(games) || games < 1 || games > 1000) throw new Error("Supply 1–1000 games");
if (!Number.isInteger(seedBase) || seedBase < 0) throw new Error("Supply a nonnegative integer seed");
const results = { games, hardWins: 0, baselineWins: 0, horizonDraws: 0, actions: 0 };
function rng(seed) { return () => ((seed = (Math.imul(1664525,seed)+1013904223) >>> 0) / 4294967296); }
function baseline(s, random) {
  const id=B.actor(s),p=s.players[id];
  if(s.phase==="purchase") return S.purchase(s,D,p.cash-D.spaces[s.purchase.index].price>=200);
  if(["roll","end"].includes(s.phase)) {
    const redeem=p.properties.find(i=>p.mortgaged[i]&&p.cash-E.unmortgageCost(D,i)>=200);
    if(redeem!==undefined)return E.unmortgage(D,p,redeem);
    const build=p.properties.find(i=>(p.upgrades[i]||0)<3&&E.canUpgrade(s,D,p,i)&&p.cash-D.spaces[i].buildCost>=200);
    if(build!==undefined)return S.build(s,D,id,build);
    if(s.phase==="end")return S.end(s,D);
    if(p.inJail&&p.jailCardDecks.length)return S.bail(s,D,p.jailCardDecks[0]);
    if(p.inJail&&p.cash>=250)return S.bail(s,D);
    return S.roll(s,D,[1+Math.floor(random()*6),1+Math.floor(random()*6)]);
  }
  return B.step(s,D,random);
}
for(let n=0;n<games;n++) {
  const hard=n%4,random=rng(seedBase+n);
  const s=S.create(D,Array.from({length:4},(_,i)=>({...D.botProfiles[n%3],name:i===hard?"Hard":"Baseline",isBot:true})),random);
  for(let action=0;action<8000&&!s.gameOver;action++) {
    results.actions++;
    if(s.phase==="auction") {
      const a=s.auction;
      const caps=s.players.map((p,id)=>{
        const index=a.building?a.targets[id]:a.index;
        const cap=p.bankrupt||index===undefined?0:id===hard?B.bidCap(s,D,id):Math.max(0,Math.min(p.cash-200,a.building?D.spaces[index].buildCost:D.spaces[index].price));
        return {id,cap};
      }).sort((a,b)=>b.cap-a.cap||a.id-b.id);
      const rival=caps.find(x=>x.id!==a.leader&&x.cap>=Math.max(10,a.bid+1));
      if(rival)S.bid(s,D,rival.id,Math.min(rival.cap,Math.max(10,a.bid+1,(caps.find(x=>x.id!==rival.id)?.cap||0)+1)));
      else S.finishAuction(s,D);
    } else {
      const moved=B.actor(s)===hard?B.step(s,D,random):baseline(s,random);
      if(!moved)throw new Error(`Stalled in ${s.phase} at seed ${seedBase+n}`);
    }
  }
  if(!s.gameOver)results.horizonDraws++;
  else if(!s.players[hard].bankrupt)results.hardWins++;
  else results.baselineWins++;
}
console.log(JSON.stringify({...results,hardWinRate:results.hardWins/games,referenceChance:0.25,seeds:`${seedBase}–${seedBase+games-1}`,description:"One hard policy vs three buy-at-200-reserve/build-to-three policies. Seats and hard doctrines rotate. Common legal-action and trade-acceptance rules. Unfinished games are draws, not wins."},null,2));
