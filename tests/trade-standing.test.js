const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../engine'),S=require('../session'),D=require('../data'),Standing=require('../trade-standing');
function setup(){const s=S.create(D,[{name:'Human'},...D.botProfiles],()=>.4);s.players[0].properties=[16,18];s.players[0].cash=3000;s.players[1].properties=[19];return s;}
function contract(cash){return {from:0,to:1,give:{cash,properties:[],cards:[]},take:{cash:0,properties:[19],cards:[]}};}
test('coarse contract standing uses the evaluator without revealing its verdict or reasoning',()=>{
  const s=setup(),before=JSON.stringify(s);
  const scores=[100,200,500,1000,2500].map(cash=>{const v=E.evaluateTrade(s,D,contract(cash),1),a=Standing.appraisal(v);assert.ok([-10,-5,0,5,10].includes(a.score));assert.equal(a.accept,undefined);assert.equal(a.hint,undefined);assert.equal(a.verdict,undefined);return a.score;});
  assert.deepEqual(scores,[...scores].sort((a,b)=>a-b));assert.equal(JSON.stringify(s),before);
  assert.ok(Standing.appraisal(E.evaluateTrade(s,D,contract(200),1)).score<=0);
  assert.ok(Standing.appraisal(E.evaluateTrade(s,D,contract(2500),1)).score>0);
});
test('wallet constraints cool the reaction without explaining why',()=>{
  const s=setup();s.players[1].cash=5;s.players[0].properties=[1];s.players[1].properties=[];
  const t={from:0,to:1,give:{cash:0,properties:[1],cards:[]},take:{cash:0,properties:[],cards:[]}};
  const v=E.evaluateTrade(s,D,t,1),a=Standing.appraisal(v);
  assert.ok(v.gain>=v.premium);assert.equal(a.score,0);assert.equal(a.reaction,'DIPLOMATIC CHANNEL OPEN');assert.equal(a.hint,undefined);
});
test('invalid contracts have no appraisal and rounding cannot imply the acceptance threshold',()=>{
  const s=setup();assert.equal(Standing.appraisal(E.evaluateTrade(s,D,contract(99999),1)).valid,false);
  const a=Standing.appraisal({valid:true,accept:false,gain:14.99,premium:15,liquidityOK:true,transferSolvent:true});
  assert.equal(a.score,0);assert.equal(a.label,'NEUTRAL');
});
