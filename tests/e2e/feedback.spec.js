const { test, expect } = require('@playwright/test');
test.beforeEach(async ({page}) => {
  page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
});
test.afterEach(async ({page})=>{expect(page.errors).toEqual([]);});
async function start(page) {
  await page.locator('#start-game').click();
  await page.evaluate(()=>{clearTimeout(timer);paused=true;state.current=0;state.phase='roll';render();saveGame();});
}
async function draw(page, id, escape = false) {
  return page.evaluate(({id,escape})=>{
    const index=D.mailCards.findIndex(c=>escape?c.effect.type==='escape':c.effect.type==='cash'&&c.effect.value>0);
    state.decks.mail.splice(state.decks.mail.indexOf(index),1);state.decks.mail.unshift(index);
    state.current=id;state.players[id].position=2;state.queue=[{type:'land',player:id,total:2},{type:'finish',player:id}];
    commit(()=>{S.process(state,D);return true;});
    return {name:state.players[id].name,ship:state.players[id].shipName,value:D.mailCards[index].effect.value};
  },{id,escape});
}
test('bot card modal names the pilot and waits for manual dismissal, including after resume',async({page})=>{
  await start(page);const actor=await draw(page,1);
  await expect(page.locator('#card-pilot')).toContainText(actor.name);
  await expect(page.locator('#card-pilot')).toContainText(actor.ship);
  await expect(page.locator('#card-pilot')).toContainText('PILOT 2 · BOT');
  await page.evaluate(()=>{paused=false;schedule();});
  await page.waitForTimeout(1300);
  expect(await page.evaluate(()=>state.players[1].cash)).toBe(1500);
  await expect(page.locator('#resolve-card')).toBeEnabled();
  await page.keyboard.press('Escape');await expect(page.locator('#card-modal')).toBeVisible();
  await page.reload();await page.locator('#resume-game').click();
  await expect(page.locator('#card-modal')).toBeVisible();
  await page.waitForTimeout(1100);
  expect(await page.evaluate(()=>state.phase)).toBe('card');
  await page.evaluate(()=>{paused=true;});await page.locator('#resolve-card').click();
  await expect(page.locator('#card-modal')).not.toBeVisible();
  expect(await page.evaluate(()=>[state.players[0].cash,state.players[1].cash])).toEqual([1500,1500+actor.value]);
});
test('human and bot escape cards are kept by the named pilot, not by the dismissing human',async({page})=>{
  await start(page);await draw(page,2,true);
  await expect(page.locator('#resolve-card')).toHaveText('KEEP CARD & DISMISS');
  await page.locator('#resolve-card').click();
  expect(await page.evaluate(()=>state.players.map(p=>p.jailCardDecks.length))).toEqual([0,0,1,0]);
  await draw(page,0,false);await expect(page.locator('#card-pilot')).toContainText('HUMAN · YOU');
  await expect(page.locator('#resolve-card')).toBeInViewport();
});
test('paid and received rent show the landlord, property and exact transfer once after landing',async({page})=>{
  await start(page);
  await page.evaluate(()=>{state.players[1].properties=[3];dice=()=>[1,2];render();});
  await page.locator('#roll-button').click();
  await expect(page.locator('#rent-notice')).toBeVisible();
  await expect(page.locator('#rent-title')).toHaveText('RENT PAID');
  await expect(page.locator('#rent-amount')).toHaveText('−4M ISK');
  const expected=await page.evaluate(()=>({name:state.players[1].name,property:D.spaces[3].name}));
  await expect(page.locator('#rent-route')).toContainText(`Capsuleer → ${expected.name}`);
  await expect(page.locator('#rent-property')).toHaveText(expected.property);
  await page.locator('#rent-dismiss').click();await page.evaluate(()=>{render();render();});
  await expect(page.locator('#rent-notice')).not.toBeVisible();
  await page.evaluate(()=>{state.current=2;state.phase='roll';state.players[0].properties=[1];state.players[2].position=1;commit(()=>{state.queue=[{type:'land',player:2,total:7},{type:'finish',player:2}];S.process(state,D);return true;});});
  await expect(page.locator('#rent-title')).toHaveText('RENT RECEIVED');
  await expect(page.locator('#rent-amount')).toHaveText('+2M ISK');
  await page.reload();await page.locator('#resume-game').click();
  await expect(page.locator('#rent-notice')).not.toBeVisible();
});
test('rent notification waits for debt settlement and is not triggered by card transfers',async({page})=>{
  await start(page);
  await page.evaluate(()=>{state.players[0].cash=0;state.players[0].properties=[3];state.players[1].properties=[1];state.players[0].position=1;commit(()=>{state.queue=[{type:'land',player:0,total:7},{type:'finish',player:0}];S.process(state,D);return true;});});
  await expect(page.locator('#rent-notice')).not.toBeVisible();await expect(page.locator('#settle-debt')).toBeDisabled();
  await page.locator('#auto-raise').click();await page.locator('#settle-debt').click();
  await expect(page.locator('#rent-notice')).toBeVisible();await page.locator('#rent-dismiss').click();
  await page.evaluate(()=>{commit(()=>{state.queue=[{type:'pay',player:1,to:0,amount:50,reason:'a card event'},{type:'finish',player:0}];S.process(state,D);return true;});});
  await expect(page.locator('#rent-notice')).not.toBeVisible();
});
test('Local preserves old human and bot actions, filters, pages, exports and survives reload',async({page})=>{
  await start(page);
  await page.evaluate(()=>{for(let i=0;i<230;i++)S.log(state,`${state.players[i%4].name} event ${i}`,state.players[i%4].color,{player:i%4});saveGame();render();});
  await expect(page.locator('#event-log .log-entry')).toHaveCount(100);
  await page.locator('#log-earlier').click();await expect(page.locator('#event-log')).toContainText('event 30');
  await page.locator('#log-search').fill('event 0');await expect(page.locator('#event-log')).toContainText('Capsuleer event 0');
  await page.locator('#log-filter').selectOption('bots');await expect(page.locator('#event-log .log-entry')).toHaveCount(0);
  await page.locator('#log-search').fill('');await expect(page.locator('#event-log')).not.toContainText('Capsuleer event');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#log-export').click()]);
  const text=require('node:fs').readFileSync(await download.path(),'utf8');expect(text).toContain('event 0');expect(text).toContain('event 229');
  await page.reload();await page.locator('#resume-game').click();await page.locator('#log-search').fill('event 0');
  await expect(page.locator('#event-log')).toContainText('event 0');
});
test('SFX use decoded local clips, persist independent volume and mute without touching music',async({page})=>{
  expect(await page.evaluate(()=>soundEffects.status.context)).toBe('locked');
  await start(page);
  const clipCount=await page.evaluate(()=>new Set(Object.values(EveSound.clips).map(([name])=>name)).size);
  await expect.poll(()=>page.evaluate(()=>soundEffects.status.decoded)).toBe(clipCount);
  expect(await page.evaluate(()=>soundEffects.play('jail'))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>soundEffects.status.played)).toBeGreaterThan(0);
  await page.locator('#sfx-volume').fill('22');
  await page.locator('#sound-toggle').click();
  expect(await page.evaluate(()=>soundEffects.status.active)).toBe(0);
  expect(await page.evaluate(()=>soundEffects.play('jail'))).toBe(false);
  await expect(page.locator('#music-frame')).not.toHaveAttribute('src');
  await page.reload();await expect(page.locator('#sound-toggle')).toHaveText('SFX OFF');
  await expect(page.locator('#sfx-volume')).toHaveValue('22');
  expect(await page.evaluate(()=>soundEffects.status.context)).toBe('locked');
});
test('missing audio never blocks a roll or card dismissal',async({page})=>{
  await page.route('**/assets/sounds/*.mp3',route=>route.abort());
  await start(page);await draw(page,0,false);
  await page.locator('#resolve-card').click();await expect(page.locator('#end-turn-button')).toBeEnabled();
  expect(await page.evaluate(()=>soundEffects.status.failed)).toBeGreaterThan(0);
});
test('a real animated roll plays short dice then one soft flight cue, never one per square',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  const requests=[];page.on('request',r=>{if(r.url().includes('/assets/sounds/'))requests.push(r.url());});
  await page.evaluate(()=>{
    window.audioStarts=[];
    const original=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){
      const samples=this.buffer.getChannelData(0);
      let peak=0,energy=0;for(const value of samples){peak=Math.max(peak,Math.abs(value));energy+=value*value;}
      window.audioStarts.push({duration:this.buffer.duration,started:performance.now(),peak,rms:Math.sqrt(energy/samples.length)});
      return original.apply(this,args);
    };
  });
  await start(page);
  await expect.poll(()=>page.evaluate(()=>soundEffects.status.decoded)).toBe(7);
  await page.evaluate(()=>{
    soundEffects.stop();window.audioStarts=[];window.audioKinds=[];
    const play=soundEffects.play;soundEffects.play=kind=>{window.audioKinds.push(kind);return play(kind);};
    dice=()=>[2,4];render();
  });
  await page.locator('#roll-button').click();
  await expect(page.locator('#claim-space')).toBeEnabled();
  const playback=await page.evaluate(()=>({kinds:window.audioKinds,starts:window.audioStarts,position:state.players[0].position}));
  expect(playback.position).toBe(6);expect(playback.kinds).toEqual(['roll','move']);expect(playback.starts).toHaveLength(2);
  expect(playback.starts[0].duration).toBeCloseTo(0.36,2);expect(playback.starts[1].duration).toBeCloseTo(1.05,2);
  expect(playback.starts[1].started-playback.starts[0].started).toBeGreaterThanOrEqual(playback.starts[0].duration*1000-20);
  for(const clip of playback.starts){expect(clip.peak).toBeLessThan(0.95);expect(clip.rms).toBeGreaterThan(0.005);}
  expect(requests.some(url=>url.endsWith('/dice-roll.mp3'))).toBe(true);
  expect(requests.some(url=>url.endsWith('/ship-thrust.mp3'))).toBe(true);
  expect(requests.some(url=>url.endsWith('/connecting.mp3'))).toBe(false);
});
test('Winning EVE shows the grass joke while retaining the playable jail controls',async({page})=>{
  await start(page);
  const corner=page.locator('.space[data-index="10"]');
  await expect(corner).toHaveAccessibleName('Winning EVE');await expect(corner).toContainText('TOUCH GRASS');
  await page.evaluate(()=>{S.jail(state,0);state.phase='roll';render();saveGame();});
  await expect(page.locator('#decision-box')).toContainText('You won EVE. Go touch grass.');
  await expect(page.locator('#active-pilot')).toContainText('Winning EVE');
  await page.locator('#pay-bail').click();
  expect(await page.evaluate(()=>[state.players[0].inJail,state.players[0].cash,state.gameOver])).toEqual([false,1450,false]);
  await expect(page.locator('#roll-button')).toBeEnabled();
});
test('new panels and card identity fit a narrow viewport and escape user-provided names',async({page})=>{
  await page.locator('#pilot-name').fill('<b>Capsuleer</b>');await start(page);await draw(page,0,false);
  await expect(page.locator('#card-pilot strong')).toHaveText('<b>Capsuleer</b>');
  await expect(page.locator('#card-pilot strong b')).toHaveCount(0);
  expect(await page.locator('#card-modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  await page.locator('#resolve-card').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
