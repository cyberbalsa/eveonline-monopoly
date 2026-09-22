const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const D = require('../data'), E = require('../engine'), S = require('../session');
const Log = require('../activity-log'), Feedback = require('../game-feedback'), Sound = require('../sound-effects');
function game() {
  return S.create(D, [{ name:'Human',color:'#55d8e8',isBot:false }, ...D.botProfiles.map(p => ({...p,isBot:true}))], () => 0.6);
}
function land(s, id, index, special) { s.current=id;s.players[id].position=index;s.queue=[{type:'land',player:id,total:7,special},{type:'finish',player:id}];S.process(s,D); }
test('history retains every entry, stable IDs and metadata past the old 80-event cap', () => {
  const s = game(); s.log=[];
  for(let i=0;i<500;i++) S.log(s,`Human event ${i}`,s.players[0].color,{kind:'test',player:0});
  assert.equal(s.log.length,500); assert.equal(s.log[0].id,1); assert.equal(s.log[499].id,500);
  assert.equal(s.log[0].round,1); assert.equal(s.log[0].player,0); assert.ok(s.log[0].time > 0);
  assert.equal(S.validate(JSON.parse(JSON.stringify(s)),D),true);
});
test('rent events identify payer, landlord, property and actual amount in both directions', () => {
  const s=game();s.players[1].properties=[1];land(s,0,1);
  const event=s.log.find(e=>e.kind==='rent');
  assert.deepEqual([event.player,event.to,event.index,event.amount],[0,1,1,2]);
  assert.deepEqual(Feedback.rentNotice(event,s,D),{received:false,amount:2,from:'Human',to:s.players[1].name,property:D.spaces[1].name});
  s.players[0].properties=[3];land(s,2,3);
  assert.equal(Feedback.rentNotice(s.log.findLast(e=>e.kind==='rent'),s,D).received,true);
});
test('unpaid rent emits no receipt; debt settlement emits exactly one', () => {
  const s=game();s.players[0].cash=0;s.players[0].properties=[3];s.players[1].properties=[1];land(s,0,1);
  assert.equal(s.phase,'debt');assert.equal(s.log.filter(e=>e.kind==='rent').length,0);
  S.process(s,D);assert.equal(s.log.filter(e=>e.kind==='debt').length,1);
  E.raiseCash(s,D,s.players[0],2);S.process(s,D);S.process(s,D);
  assert.equal(s.log.filter(e=>e.kind==='rent').length,1);
  assert.ok(s.log.some(e=>e.text.includes('mortgaged')));
});
test('utilities and double bridge rent carry the settled value, not a base-rent guess', () => {
  const s=game();s.players[1].properties=[5,12];land(s,0,5,'transit');
  assert.equal(s.log.findLast(e=>e.kind==='rent').amount,50);
  land(s,0,12,'utility');S.utilityRoll(s,D,[6,5]);
  assert.equal(s.log.findLast(e=>e.kind==='rent').amount,110);
});
test('tax, card payments, bot-to-bot rent and mortgaged land produce no human rent popup', () => {
  const s=game();
  for(const entry of [{kind:'payment',player:0,to:1,amount:50,index:1},{kind:'payment',player:0,to:null,amount:200,index:4},{kind:'rent',player:1,to:2,amount:2,index:1}]) assert.equal(Feedback.rentNotice(entry,s,D),null);
  s.players[1].properties=[1];s.players[1].mortgaged[1]=true;land(s,0,1);
  assert.equal(s.log.filter(e=>e.kind==='rent').length,0);
});
test('liquidation, redemption and card income are in the same human/bot journal', () => {
  const s=game(),p=s.players[1];p.properties=[1,3];p.cash=100;
  E.upgrade(s,D,p,1);E.sellBuilding(s,D,p,1);E.mortgage(s,D,p,1);E.unmortgage(D,p,1,s);
  for(const word of ['sold','mortgaged','redeemed']) assert.ok(s.log.some(e=>e.player===1&&e.text.includes(word)));
  const index=D.mailCards.findIndex(c=>c.effect.type==='cash'&&c.effect.value>0);
  s.decks.mail.splice(s.decks.mail.indexOf(index),1);s.card={player:1,deck:'mail',index};s.phase='card';s.queue=[{type:'finish',player:1}];S.acknowledge(s,D);
  assert.ok(s.log.some(e=>e.kind==='income'&&e.player===1));
});
test('history search and export include older entries and preserve literal player text', () => {
  const s=game();s.log=[];S.log(s,'Human paid 20M',undefined,{player:0,to:1});S.log(s,'Bot collected rent',undefined,{player:1,to:0});S.log(s,'<script>not markup</script>',undefined,{player:2});
  assert.equal(Log.filter(s.log,s.players,'human').length,2);
  assert.equal(Log.filter(s.log,s.players,'bots').length,2);
  assert.equal(Log.filter(s.log,s.players,'all','PAID')[0].text,'Human paid 20M');
  assert.ok(Log.exportText(s).includes('<script>not markup</script>'));
});
test('sounds are small local MP3s with per-source provenance and verified checksums', () => {
  const manifest=require('../assets/sounds/provenance.json');let bytes=0;
  for(const asset of manifest.files){const data=readFileSync(require('node:path').join(__dirname,'..',asset.file));bytes+=data.length;assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256);assert.match(asset.originalSHA256,/^[a-f0-9]{64}$/);assert.ok(asset.duration<=4);assert.ok(manifest.sources[asset.source]?.terms);}
  assert.equal(manifest.sources.eve.owner,'CCP Games');assert.ok(bytes<200000);
  for(const [name] of Object.values(Sound.clips)) assert.ok(manifest.files.some(a=>a.file===`assets/sounds/${name}.mp3`));
});
test('roll and movement have dedicated short samples, leaving every other EVE cue unchanged', () => {
  const manifest=require('../assets/sounds/provenance.json');
  for(const [kind,source,maxDuration] of [['roll','casino',0.385],['move','scifi',1.1]]) {
    const [name,level]=Sound.clips[kind],asset=manifest.files.find(a=>a.file===`assets/sounds/${name}.mp3`);
    assert.equal(asset.source,source);assert.equal(manifest.sources[source].license,'CC0-1.0');
    assert.ok(asset.duration<=maxDuration);assert.ok(level>0&&level<=0.75);
    assert.ok(!Object.entries(Sound.clips).some(([key,[other]])=>key!==kind&&other===name));
  }
  const {roll,move,...unchanged}=Sound.clips;
  assert.deepEqual(unchanged,{
    card:['notification',0.65],income:['complete',0.55],purchase:['complete',0.45],build:['complete',0.5],
    trade:['notification',0.5],offer:['notification',0.55],bid:['interface',0.45],
    payment:['capacitor',0.5],debt:['capacitor',0.65],jail:['structure',0.65],bankruptcy:['structure',0.75]
  });
});
test('SFX settings tolerate missing/corrupt values and clamp volume', () => {
  assert.deepEqual(Sound.settings(null),{enabled:true,volume:.35});
  assert.equal(Sound.settings({volume:5}).volume,1);assert.equal(Sound.settings({volume:-1}).volume,0);
  assert.deepEqual(Sound.settings({enabled:false,volume:.2}),{enabled:false,volume:.2});
});
