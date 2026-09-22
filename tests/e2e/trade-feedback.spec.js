const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.locator('#start-game').click();await page.evaluate(()=>{paused=true;clearTimeout(timer);state.current=0;state.phase='roll';render();});});
test.afterEach(async({page})=>{expect(page.errors).toEqual([]);});
async function offer(page){return page.evaluate(()=>{
  state.players[0].properties=[1];state.players[1].properties=[6];state.players[1].mortgaged[6]=true;
  const index=D.mailCards.findIndex(c=>c.effect.type==='escape');state.decks.mail.splice(state.decks.mail.indexOf(index),1);state.players[1].jailCardDecks=['mail'];
  state.offer={returnPhase:'roll',trade:{from:1,to:0,give:{cash:500,properties:[6],cards:['mail']},take:{cash:0,properties:[1],cards:[]}}};state.phase='offer';saveGame();render();
  return {name:state.players[1].name,give:D.spaces[1].name,take:D.spaces[6].name};
});}
test('bot trade opens centered modal with correct sides and remains pending through reload',async({page})=>{
  const data=await offer(page);const modal=page.locator('#trade-offer-modal');
  await expect(modal).toBeVisible();await expect(page.locator('#offer-pilot')).toContainText(data.name);
  await expect(page.locator('.offer-receive')).toContainText('500M');await expect(page.locator('.offer-receive')).toContainText(data.take);await expect(page.locator('.offer-receive')).toContainText('MORTGAGED');await expect(page.locator('.offer-receive')).toContainText('Instawarp bookmark');
  await expect(page.locator('.offer-give')).toContainText(data.give);
  expect(await modal.evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs((r.left+r.right)/2-innerWidth/2)<3&&Math.abs((r.top+r.bottom)/2-innerHeight/2)<3;})).toBe(true);
  await page.keyboard.press('Escape');await expect(modal).toBeVisible();
  await page.evaluate(()=>{paused=false;schedule();});await page.waitForTimeout(1100);expect(await page.evaluate(()=>state.phase)).toBe('offer');
  await page.reload();await page.locator('#resume-game').click();await expect(modal).toBeVisible();
  await page.evaluate(()=>{paused=true;});await page.locator('#decline-offer').click();await expect(modal).not.toBeVisible();
  expect(await page.evaluate(()=>state.players[0].properties)).toEqual([1]);
  expect(await page.evaluate(()=>state.log.at(-1).text)).toContain('declined');
});
test('accepting a bot modal transfers assets to the right pilot and opens the mortgage decision',async({page})=>{
  await offer(page);await page.locator('#accept-offer').click();
  await expect(page.locator('#trade-offer-modal')).not.toBeVisible();
  expect(await page.evaluate(()=>({cash:state.players[0].cash,props:state.players[0].properties,cards:state.players[0].jailCardDecks}))).toEqual({cash:2000,props:[6],cards:['mail']});
  await expect(page.locator('#inherit-keep')).toBeVisible();await page.locator('#inherit-keep').click();
  expect(await page.evaluate(()=>state.players[0].cash)).toBe(1995);
});
test('EVE standing changes live but keeps the bot reasoning and final verdict private',async({page})=>{
  await page.evaluate(()=>{state.players[0].properties=[16,18];state.players[0].cash=3000;state.players[1].properties=[19];render();});
  await page.locator('#trade-button').click();await expect(page.locator('#standing-label')).toHaveText('NO APPRAISAL');await expect(page.locator('#submit-trade')).toBeDisabled();
  const before=await page.evaluate(()=>JSON.stringify(state.players));
  await page.locator('[name="take-property"][value="19"]').check();await page.locator('[name="give-cash"]').fill('200');
  await expect(page.locator('#trade-standing')).not.toContainText(/premium|reserve|WILL ACCEPT|WILL DECLINE|valuation/);
  const bad=Number(await page.locator('#standing-meter').getAttribute('aria-valuenow'));
  await page.locator('[name="give-cash"]').fill('2500');await expect(page.locator('#standing-verdict')).toContainText('BLUE RESPONSE');await expect(page.locator('#standing-label')).toContainText('BLUE');
  expect(Number(await page.locator('#standing-meter').getAttribute('aria-valuenow'))).toBeGreaterThan(bad);
  expect(await page.evaluate(()=>JSON.stringify(state.players))).toBe(before);
  expect(await page.locator('#trade-modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  await page.locator('#submit-trade').click();await expect(page.locator('#trade-modal')).not.toBeVisible();
  expect(await page.evaluate(()=>state.players[0].properties)).toContain(19);
});
test('appraisal resets on counterparty change and updates for held cards without submitting',async({page})=>{
  await page.evaluate(()=>{const i=D.mailCards.findIndex(c=>c.effect.type==='escape');state.decks.mail.splice(state.decks.mail.indexOf(i),1);state.players[0].jailCardDecks=['mail'];render();});
  await page.locator('#trade-button').click();await page.locator('[name="give-card"]').check();await expect(page.locator('#standing-verdict')).toContainText('BLUE RESPONSE');
  await page.locator('#trade-partner').selectOption('2');await expect(page.locator('#standing-label')).toHaveText('NO APPRAISAL');
  await page.locator('[name="give-cash"]').fill('99999');await expect(page.locator('#standing-verdict')).toContainText('AWAITING TERMS');await expect(page.locator('#submit-trade')).toBeDisabled();
});
