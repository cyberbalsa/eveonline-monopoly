const {test,expect} = require('@playwright/test');
test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/'); await page.locator('#start-game').click();
  await page.evaluate(()=>{clearTimeout(timer);paused=true;state.current=0;state.phase='roll';audioEnabled=false;render();});
});

test('board fits portrait, landscape and resized desktop viewports without scrolling sideways', async ({page,isMobile}) => {
  const sizes=isMobile ? [[320,568],[390,844],[844,390],[412,915]] : [[320,568],[390,844],[844,390],[1366,768],[1920,1080]];
  for(const [width,height]of sizes) {
    await page.setViewportSize({width,height});
    await page.locator('#camera-fit').click();
    await expect.poll(()=>page.evaluate(()=>{
      const b=document.querySelector('#board').getBoundingClientRect(),v=document.querySelector('#board-viewport').getBoundingClientRect();
      return b.left>=v.left-1&&b.right<=v.right+1&&b.top>=v.top-1&&b.bottom<=v.bottom+1&&document.documentElement.scrollWidth<=innerWidth+1;
    })).toBe(true);
  }
});
test('ships have real meshes, unique numbered markers, and a matching locate control', async ({page}) => {
  await expect.poll(()=>page.locator('.ship-token .model-slot[data-model-state="ready"]').count()).toBe(4);
  await expect.poll(async()=>Number(await page.locator('#model-canvas').getAttribute('data-rendered-views'))).toBeGreaterThanOrEqual(4);
  expect(await page.locator('.pawn-number').allTextContents()).toEqual(['1','2','3','4']);
  const before=await page.evaluate(()=>JSON.stringify(state));
  await page.locator('#roster [data-locate="2"]').click();
  await expect(page.locator('#camera-caption')).toContainText(await page.evaluate(()=>state.players[2].name));
  expect(await page.evaluate(()=>boardCamera.snapshot.zoom)).toBeGreaterThan(1);
  expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
  await page.locator('#camera-fit').click();
  await expect(page.locator('#camera-zoom')).toHaveText('100%');
});
test('ships in corners and adjacent spaces never cover each other',async({page})=>{
  for(const positions of [[0,1,2,39],[0,0,1,39],[10,9,10,11],[20,19,20,21],[30,29,30,31],[6,6,6,6]]) {
    await page.evaluate(positions=>{state.players.forEach((p,i)=>p.position=positions[i]);render();},positions);
    const overlaps=await page.locator('.ship-token').evaluateAll(tokens=>{
      const rects=tokens.map(t=>({x:parseFloat(t.style.left),y:parseFloat(t.style.top),w:t.offsetWidth,h:t.offsetHeight}));
      return rects.some((a,i)=>rects.some((b,j)=>j>i&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y));
    });
    expect(overlaps,positions.join(',')).toBe(false);
  }
});
test('Astrahus and Keepstar use meshes and show the exact building count', async ({page}) => {
  await page.evaluate(()=>{state.players[0].properties=[1,3];state.players[0].upgrades={1:4,3:4};render();});
  await expect(page.locator('.structure-model[data-model="astrahus"]')).toHaveCount(2);
  await expect(page.locator('.space[data-index="1"] .building-count')).toHaveText('4 A');
  await expect.poll(()=>page.locator('.structure-model[data-model-state="ready"]').count()).toBe(2);
  await page.evaluate(()=>{state.players[0].upgrades={1:5,3:5};render();});
  await expect(page.locator('.structure-model[data-model="keepstar"]')).toHaveCount(2);
  await expect(page.locator('.space[data-index="1"] .building-count')).toHaveText('1 K');
  await expect.poll(()=>page.locator('.structure-model[data-model-state="ready"]').count()).toBe(2);
});
test('both decks remain face down; only a drawn card reveals its contents', async ({page}) => {
  await expect(page.locator('.deck-back')).toHaveCount(2);
  await expect(page.locator('.deck-back')).not.toContainText(['Wrong hull, right enthusiasm','The plex despawned']);
  await expect(page.locator('#drawn-card')).toBeEmpty();
  await page.evaluate(()=>{state.card={player:0,deck:'mail',index:2};state.phase='card';state.queue=[{type:'finish',player:0}];render();});
  await expect(page.locator('#drawn-card')).toContainText('Wrong hull, right enthusiasm');
  await page.locator('#resolve-card').click();
  await expect(page.locator('#drawn-card')).toBeEmpty();
  await expect(page.locator('#card-modal')).not.toBeVisible();
});
test('movement zoom follows the ship, lands correctly, then returns to overview', async ({page}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{dice=()=>[3,3];});
  await page.locator('#roll-button').click();
  await expect.poll(()=>page.evaluate(()=>boardCamera.snapshot.zoom)).toBeGreaterThan(1);
  await expect(page.locator('#claim-space')).toBeVisible({timeout:10000});
  await expect(page.locator('#camera-zoom')).toHaveText('100%');
  await expect(page.locator('.ship-token[data-player="0"]')).toHaveAttribute('data-position','6');
  expect(await page.evaluate(()=>[state.players[0].position,state.doublesRun])).toEqual([6,1]);
});
test('manual Fit interrupts camera follow without interrupting the move', async ({page}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{dice=()=>[3,3];});
  await page.locator('#roll-button').click();
  await expect.poll(()=>page.evaluate(()=>boardCamera.snapshot.zoom)).toBeGreaterThan(1);
  await page.locator('#camera-fit').click();
  await expect(page.locator('#claim-space')).toBeVisible({timeout:10000});
  await expect(page.locator('#camera-zoom')).toHaveText('100%');
  expect(await page.evaluate(()=>state.players[0].position)).toBe(6);
});
test('follow can be disabled and reduced motion never forces a camera zoom', async ({page}) => {
  await page.locator('#camera-follow').click();
  await expect(page.locator('#camera-follow')).toHaveAttribute('aria-pressed','false');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{dice=()=>[1,2];});
  await page.locator('#roll-button').click(); await expect(page.locator('#claim-space')).toBeVisible();
  await expect(page.locator('#camera-zoom')).toHaveText('100%');
  await page.locator('#camera-follow').click(); await page.emulateMedia({reducedMotion:'reduce'});
  expect(await page.evaluate(()=>boardCamera.canFollow)).toBe(false);
});
test('loss of WebGL exposes readable image pawns and leaves the game playable', async ({page}) => {
  await expect.poll(()=>page.locator('.ship-token .model-slot[data-model-state="ready"]').count()).toBe(4);
  await page.evaluate(()=>document.querySelector('#model-canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(page.locator('#model-status')).toHaveAttribute('data-state','fallback');
  await expect(page.locator('.ship-token[data-player="0"] img')).toBeVisible();
  await expect(page.locator('#roll-button')).toBeEnabled();
});
test('model rendering sleeps behind dialogs and when the board is off-screen', async ({page}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await expect.poll(()=>page.evaluate(()=>window.EveModels?.metrics.frames || 0)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'INTEL',exact:true}).click();
  const pausedAt=await page.evaluate(()=>EveModels.metrics.frames);
  await page.waitForTimeout(250);
  expect(await page.evaluate(()=>EveModels.metrics.frames)).toBe(pausedAt);
  await page.locator('[data-close="intel-modal"]').click();
  await page.evaluate(()=>{document.body.style.minHeight='3500px';window.scrollTo(0,2500);});
  await page.waitForTimeout(120);
  const offscreen=await page.evaluate(()=>EveModels.metrics.frames);
  await page.waitForTimeout(250);
  expect(await page.evaluate(()=>EveModels.metrics.frames)).toBe(offscreen);
});
