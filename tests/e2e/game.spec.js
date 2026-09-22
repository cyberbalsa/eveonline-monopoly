const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (error) => page.errors.push(error.message));
  page.on("response", (response) => { if (response.url().startsWith("http://127.0.0.1") && response.status() >= 400) page.errors.push(`${response.status()} ${response.url()}`); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
});
test.afterEach(async ({ page }) => { expect(page.errors).toEqual([]); });
async function start(page) {
  await page.locator("#start-game").click();
  await page.evaluate(() => { clearTimeout(timer); paused = true; state.current = 0; state.phase = "roll"; render(); saveGame(); });
}

test("chooses one of eight hulls and starts with four ships and classic supply", async ({ page }) => {
  await expect(page.locator(".space")).toHaveCount(40);
  await expect(page.locator(".ship-choice")).toHaveCount(8);
  await page.locator('.ship-choice:has-text("Ishtar")').click();
  await page.locator("#pilot-name").fill("Definitely Human");
  await start(page);
  await expect(page.locator("#active-pilot h3")).toHaveText("1 Definitely Human");
  await expect(page.locator("#active-pilot img")).toHaveAttribute("src", "assets/ishtar.png");
  await expect(page.locator(".ship-token")).toHaveCount(4);
  await expect(page.locator("#bank-supply")).toContainText("32 ASTRAHUS");
  await expect.poll(() => page.locator(".ship-token img").evaluateAll((images) => images.every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
});

test("militia selection draws distinct names and saved opponents never reroll", async ({ page }) => {
  await page.locator('[name="militia"][value="galmil"]').check();
  await page.locator('#pilot-name').fill('Templis CALSF');
  await start(page);
  const original = await page.evaluate(() => state.players.map(p => ({ name:p.name, faction:p.faction, identity:p.botIdentityId })));
  expect(original[0].faction).toBe('galmil');
  expect(original.filter(p => p.faction === 'calmil')).toHaveLength(2);
  expect(original.filter(p => p.faction === 'galmil')).toHaveLength(2);
  expect(new Set(original.map(p => p.name)).size).toBe(4);
  expect(new Set(original.slice(1).map(p => p.identity)).size).toBe(3);
  await expect(page.locator('#roster')).toContainText('GALMIL');
  // Resuming must ignore both fresh randomness and forged bot display metadata.
  await page.evaluate(() => {
    state.players[1].name = '<b>forged name</b>';
    state.players[1].ship = 'https://invalid.example/ship.png';
    saveGame();
  });
  await page.reload();
  await page.evaluate(() => { Math.random = () => 0.99; });
  await page.locator('#resume-game').click();
  expect(await page.evaluate(() => state.players.map(p => ({ name:p.name, faction:p.faction, identity:p.botIdentityId })))).toEqual(original);
  expect(await page.evaluate(() => state.players[1].ship)).toBe('assets/drake.png');
  await expect(page.locator('#roster b')).toHaveCount(0);
});

test("new campaigns choose from the full name pool instead of retaining fixed opponents", async ({ page }) => {
  await page.evaluate(() => { Math.random = () => 0.01; });
  await start(page);
  const first = await page.evaluate(() => state.players.slice(1).map(p => p.botIdentityId));
  await page.evaluate(() => { resetGame(); Math.random = () => 0.99; });
  await start(page);
  const second = await page.evaluate(() => state.players.slice(1).map(p => p.botIdentityId));
  expect(first).not.toEqual(second);
  expect(await page.evaluate(() => state.players.slice(1).every(p => GAME_ROSTER.find(p.botIdentityId)?.name === p.name))).toBe(true);
});

test("purchase after doubles blocks the turn and survives reload without reroll", async ({ page }) => {
  await start(page);
  await page.evaluate(() => { dice = () => [3,3]; });
  await page.locator("#roll-button").click();
  await expect(page.locator("#claim-space")).toBeVisible();
  await expect(page.locator("#roll-button")).toBeDisabled();
  await expect(page.locator("#end-turn-button")).toBeDisabled();
  await page.reload(); await page.locator("#resume-game").click();
  await expect(page.locator("#claim-space")).toBeVisible();
  expect(await page.evaluate(() => [state.players[0].position,state.doublesRun])).toEqual([6,1]);
  await page.locator("#claim-space").click();
  await expect(page.locator("#roll-button")).toBeEnabled();
  expect(await page.evaluate(() => state.players[0].cash)).toBe(1400);
});

test("Escape card has source context, cannot be dismissed, is held then used for free", async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const index = D.mailCards.findIndex((c) => c.effect.type === "escape");
    state.decks.mail.splice(state.decks.mail.indexOf(index),1);
    state.card = {player:0,deck:"mail",index}; state.phase="card";
    state.queue=[{type:"finish",player:0}]; saveGame(); render();
  });
  await expect(page.locator("#drawn-card")).toContainText("Instawarp bookmark");
  await expect(page.locator("#drawn-card")).toContainText("Reship Bay");
  await expect(page.locator(".card-source")).toHaveAttribute("href","research.html#card-reship");
  await page.keyboard.press("Escape"); await expect(page.locator("#card-modal")).toBeVisible();
  await page.reload(); await page.locator("#resume-game").click();
  await expect(page.locator("#card-modal")).toBeVisible();
  await page.locator("#resolve-card").click();
  expect(await page.evaluate(() => state.players[0].jailCardDecks)).toEqual(["mail"]);
  await page.evaluate(() => { S.jail(state,0); state.phase="roll"; render(); });
  await page.locator("#use-mail-card").click();
  expect(await page.evaluate(() => [state.players[0].inJail,state.players[0].cash,state.decks.mail.length])).toEqual([false,1500,16]);
  await expect(page.locator("#roll-button")).toBeEnabled();
});

test("all 32 cards render their joke, instructions and source without horizontal clipping", async ({ page }) => {
  await start(page);
  const cards = await page.evaluate(() => ["mail", "local"].flatMap((deck) =>
    S.deck(D, deck).map((card, index) => ({ ...card, deck, index }))));
  for (const card of cards) {
    await page.evaluate(({ deck, index }) => {
      state.card = { player: 0, deck, index }; state.phase = "card"; render();
    }, card);
    await expect(page.locator("#drawn-card h2")).toHaveText(card.title);
    await expect(page.locator("#drawn-card p")).toHaveText(card.body);
    await expect(page.locator(".card-source")).toHaveAttribute("href", card.source);
    expect(await page.locator("#drawn-card").evaluate((e) => e.scrollWidth <= e.clientWidth + 1), card.title).toBe(true);
    await page.locator("#resolve-card").scrollIntoViewIfNeeded();
    await expect(page.locator("#resolve-card")).toBeInViewport();
  }
  await page.goto("/research.html#cards");
  await expect(page.locator("#cards h2")).toHaveText("All 32 cards and their references");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("declined deed opens public auction and human can win with a valid bid", async ({ page }) => {
  await start(page);
  await page.evaluate(() => { state.purchase={player:0,index:1};state.phase="purchase";state.queue=[{type:"finish",player:0}];render(); });
  await page.locator("#pass-space").click();
  await expect(page.locator("#auction-modal")).toBeVisible();
  await page.keyboard.press("Escape"); await expect(page.locator("#auction-modal")).toBeVisible();
  await page.locator("#bid-amount").fill("300"); await page.locator("#submit-bid").click();
  await expect(page.locator("#auction-modal")).not.toBeVisible();
  expect(await page.evaluate(() => [state.players[0].properties,state.players[0].cash])).toEqual([[1],1200]);
  await expect(page.locator("#end-turn-button")).toBeEnabled();
});

test("asset controls enforce even construction and let humans cover debt with mortgages", async ({ page }) => {
  await start(page);
  await page.evaluate(() => { state.players[0].properties=[1,3];render(); });
  await page.locator("#finance-button").click(); await page.locator('[data-asset="1"]').click();
  await page.locator("#upgrade-property").click();
  await expect(page.locator("#upgrade-property")).toBeDisabled();
  await expect(page.locator("#mortgage-property")).toBeDisabled();
  await page.locator("#sell-building").click();
  await page.locator('[data-close="property-modal"]').click(); await page.locator('[data-close="finance-modal"]').click();
  await page.evaluate(() => {state.players[0].cash=0;state.queue=[{type:"pay",player:0,to:1,amount:50,reason:"rent"},{type:"finish",player:0}];S.process(state,D);render();});
  await expect(page.locator("#bankrupt-button")).toBeDisabled();
  await page.locator("#auto-raise").click(); await page.locator("#settle-debt").click();
  expect(await page.evaluate(() => [state.players[0].cash,state.players[1].cash])).toEqual([10,1550]);
});

test("trade interface rejects a cheap monopoly and completes an acceptable contract", async ({ page }) => {
  await start(page);
  await page.evaluate(() => {state.players[0].properties=[16,18];state.players[0].cash=3000;state.players[1].properties=[19];render();});
  await page.locator("#trade-button").click();
  await page.locator('[name="take-property"][value="19"]').check();
  await page.locator('[name="give-cash"]').fill("200"); await page.locator("#submit-trade").click();
  await expect(page.locator("#trade-feedback")).toContainText("Contract declined");
  await page.locator('[name="give-cash"]').fill("2500"); await page.locator("#submit-trade").click();
  await expect(page.locator("#trade-modal")).not.toBeVisible();
  expect(await page.evaluate(() => state.players[0].properties)).toContain(19);
});

test("reset during animation cannot mutate a new campaign", async ({ page }) => {
  await start(page); await page.emulateMedia({reducedMotion:"no-preference"});
  await page.evaluate(() => { dice=()=>[3,4]; }); await page.locator("#roll-button").click();
  page.once("dialog",(dialog)=>dialog.accept()); await page.locator("#new-game-button").click();
  await expect(page.locator("#launch-modal")).toBeVisible(); await start(page);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => [state.players[0].position,state.players[0].cash,busy])).toEqual([0,1500,false]);
});

test("bot turn runs automatically and pauses for a human auction response", async ({ page }) => {
  await start(page);
  await page.evaluate(() => {state.current=1;state.phase="purchase";state.purchase={player:1,index:39};state.players[1].cash=0;state.queue=[{type:"finish",player:1}];paused=false;render();schedule();});
  await expect(page.locator("#auction-modal")).toBeVisible();
  await expect(page.locator("#roll-button")).toBeDisabled();
  await page.locator("#auction-pass").click();
  await expect(page.locator("#auction-modal")).not.toBeVisible();
  expect(await page.evaluate(() => E.getOwner(state,39)?.isBot)).toBe(true);
});

test("human can decline a last-building contest and review a bot trade offer", async ({page}) => {
  await start(page);
  await page.evaluate(()=>{state.players[0].properties=[1,3];state.players[1].properties=[6,8,9];state.bank.houses=1;S.build(state,D,1,6);render();});
  await expect(page.locator("#pass-building")).toBeVisible();await page.locator("#pass-building").click();
  expect(await page.evaluate(()=>state.players[1].cash)).toBe(1450);
  await page.evaluate(()=>{state.offer={returnPhase:"roll",trade:{from:1,to:0,give:{cash:500,properties:[],cards:[]},take:{cash:0,properties:[1],cards:[]}}};state.phase="offer";render();});
  await page.locator("#accept-offer").click();
  expect(await page.evaluate(()=>[state.players[0].cash,state.players[1].properties.includes(1)])).toEqual([2000,true]);
});

test("research and 3D board controls work on desktop and mobile", async ({ page }, testInfo) => {
  await start(page);
  await page.locator("#view-toggle").click(); await expect(page.locator("#board")).toHaveClass(/tactical-3d/);
  await page.getByRole("button",{name:"INTEL",exact:true}).click();
  await expect(page.locator("#intel-modal")).toContainText("C1009");
  await expect(page.locator('#intel-modal a[href="research.html#opponents"]')).toBeVisible();
  await page.locator('[data-close="intel-modal"]').click();
  if(testInfo.project.name.includes("mobile")) {
    const sizes=await page.locator(".board-scroll").evaluate((e)=>[e.scrollWidth,e.clientWidth]); expect(sizes[0]).toBeLessThanOrEqual(sizes[1]+1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  await page.goto("/research.html#opponents"); await expect(page.locator("#opponents")).toContainText("48");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test("project-subpath hosting resolves code and images without root-relative URLs", async ({page}) => {
  await page.route("**/eveonline-monopoly/**",async(route)=>{
    const url=route.request().url().replace("/eveonline-monopoly/","/");
    const response=await route.fetch({url}); await route.fulfill({response});
  });
  await page.goto("/eveonline-monopoly/"); await start(page);
  await expect(page.locator(".space")).toHaveCount(40);
  await expect.poll(()=>page.locator(".ship-token img").evaluateAll((images)=>images.every((i)=>i.complete&&i.naturalWidth>0))).toBe(true);
  await expect.poll(()=>page.locator('.ship-token .model-slot[data-model-state="ready"]').count()).toBe(4);
});

test("jukebox loads on demand, never autoplays, hides while playing, and pauses on close", async ({page}) => {
  // Exercise our integration without making CI depend on a CDN or streaming audio.
  await page.addInitScript(() => {
    window.Webamp = class {
      static browserIsSupported() { return true; }
      constructor(options) { this.options=options; this.status="STOPPED"; }
      setVolume(volume) { this.volume=volume; }
      onClose(fn) { this.closeHandler=fn; }
      onMinimize(fn) { this.minimizeHandler=fn; }
      async renderInto(node) {
        const play=document.createElement("button"); play.textContent="Play";
        play.onclick=()=>{this.status="PLAYING";}; node.append(play);
      }
      getMediaStatus() { return this.status; }
      getPlaylistTracks() { return this.options.initialTracks; }
      pause() { this.status="PAUSED"; }
      reopen() { this.reopened=true; }
    };
  });
  await start(page);
  await expect(page.locator("#music-frame")).not.toHaveAttribute("src", /.+/);
  await page.locator("#music-toggle").click();
  const frame=page.frameLocator("#music-frame");
  await expect(frame.getByRole("button",{name:"Play",exact:true})).toBeVisible();
  const player=page.frames().find(f=>f.url().includes("jukebox.html"));
  expect(await player.evaluate(()=>[eveJukebox.getMediaStatus(),eveJukebox.getPlaylistTracks().length,eveJukebox.volume])).toEqual(["STOPPED",14,35]);
  await frame.getByRole("button",{name:"Play",exact:true}).click();
  await expect(page.locator("#music-toggle")).toHaveText("MUSIC ON");
  await page.locator("#music-hide").click();
  await expect(page.locator("#music-panel")).toBeHidden();
  expect(await player.evaluate(()=>eveJukebox.getMediaStatus())).toBe("PLAYING");
  await page.locator("#music-toggle").click();
  await page.locator("#music-close").click();
  await expect.poll(()=>player.evaluate(()=>eveJukebox.getMediaStatus())).toBe("PAUSED");
  await expect(page.locator("#music-toggle")).toHaveText("JUKEBOX");
  await page.locator("#music-toggle").click();
  expect(await player.evaluate(()=>eveJukebox.getMediaStatus())).toBe("PAUSED");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test("unavailable Webamp shows retry and Archive fallback without breaking the game", async ({page}) => {
  await page.route("https://cdn.jsdelivr.net/npm/webamp@*/**",route=>route.abort());
  await start(page);
  await page.locator("#music-toggle").click();
  const frame=page.frameLocator("#music-frame");
  await expect(frame.locator("#player-status")).toContainText("couldn't load");
  await expect(frame.locator("#player-retry")).toBeVisible();
  await expect(frame.getByRole("link")).toHaveAttribute("href","https://archive.org/details/eve-online-soundtrack/");
  await page.locator("#music-close").click();
  await expect(page.locator("#roll-button")).toBeEnabled();
});
