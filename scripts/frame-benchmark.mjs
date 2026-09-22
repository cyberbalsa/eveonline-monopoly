// Browser frame pacing, not a claim about every player's GPU. Start static
// servers first; pass the current URL and optionally the previous-build URL.
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const current = process.argv[2] || 'http://127.0.0.1:8080';
const previous = process.argv[3];
const browser = await chromium.launch({headless:true});
const results = [];
for (const [build,url] of [['current',current],...(previous ? [['previous',previous]] : [])]) {
  for (const [layout,width,height] of [['desktop',1440,1000],['mobile-layout',390,844]]) {
    const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'no-preference'});
    const errors = []; page.on('pageerror',error => errors.push(error.message));
    await page.goto(url); await page.locator('#start-game').click();
    await page.evaluate(() => {paused=true;clearTimeout(timer);state.current=0;state.phase='roll';audioEnabled=false;});
    for (const heavy of [false,true]) {
      await page.evaluate(heavy => {
        state.players.forEach((p,i) => {p.position=[1,13,24,35][i];p.properties=[];p.upgrades={};p.mortgaged={};});
        state.bank={houses:32,hotels:12};
        if (heavy) {
          Object.keys(D.groups).forEach((group,g) => D.spaces.forEach((s,i) => {
            if (s.group !== group) return;
            const p=state.players[g%4];p.properties.push(i);
            const count=['cyan','magenta','orange','red'].includes(group) ? 5 : ['brown','yellow','green'].includes(group) ? 4 : 0;
            p.upgrades[i]=count;
            if(count===5)state.bank.hotels--;else state.bank.houses-=count;
          }));
        }
        render(); window.scrollTo(0,0);
      },heavy);
      if (build === 'current') await page.waitForFunction(() => [...document.querySelectorAll('.model-slot')].every(e=>e.dataset.modelState === 'ready'),null,{timeout:30000});
      await page.waitForTimeout(500);
      for (const moving of [false,true]) {
        const sample = await page.evaluate(async ({moving,build}) => {
          const intervals=[],updates=[];
          let running=true,last=0,frame=0;
          function tick(time) {if(last)intervals.push(time-last);last=time;if(running)frame=requestAnimationFrame(tick);}
          frame=requestAnimationFrame(tick);
          if(moving) (async()=>{while(running){const t=performance.now();await animateAction(()=>{state.players[0].position=(state.players[0].position+8)%40;state.lastRoll=[4,4];return true;});updates.push(performance.now()-t);}})();
          const initialFrames = window.EveModels?.metrics.frames || 0;
          const begun=performance.now(); await new Promise(resolve=>setTimeout(resolve,3500));
          const elapsed=performance.now()-begun;running=false;cancelAnimationFrame(frame);
          const sorted=intervals.slice().sort((a,b)=>a-b), percentile=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))] || 0;
          const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2');
          const info=gl?.getExtension('WEBGL_debug_renderer_info');
          return {fps:Number((intervals.length*1000/elapsed).toFixed(1)),p50Ms:Number(percentile(.5).toFixed(2)),p95Ms:Number(percentile(.95).toFixed(2)),maxMs:Number(Math.max(...intervals).toFixed(2)),over34ms:intervals.filter(n=>n>34).length,samples:intervals.length,modelFps:build==='current'?Number(((EveModels.metrics.frames-initialFrames)*1000/elapsed).toFixed(1)):null,modelDrawCpuMs:window.EveModels?.metrics.drawMs || null,gpu:info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unavailable'};
        },{moving,build});
        results.push({build,layout,scene:heavy?'32 houses + 12 hotels':'four ships',activity:moving?'movement + camera':'idle',...sample});
        console.log(JSON.stringify(results.at(-1)));
        await page.waitForFunction(()=>!busy,null,{timeout:10000});
      }
    }
    if(errors.length)throw new Error(errors.join('\n'));
    await page.close();
  }
}
await browser.close();
await writeFile('tests/frame-benchmark-results.json',JSON.stringify({recorded:new Date().toISOString(),environment:'Headless Chromium; mobile is viewport emulation, not physical phone hardware. rAF frame pacing includes browser rendering; CPU draw time is the last submitted draw, including any one-time cache rebuild, and excludes asynchronous GPU execution. Model rendering is intentionally capped at 30 Hz during movement and sleeps at rest; camera animation uses requestAnimationFrame. The previous mobile layout cropped the board instead of fitting it, so that comparison involves different visible content.',results},null,2)+'\n');
