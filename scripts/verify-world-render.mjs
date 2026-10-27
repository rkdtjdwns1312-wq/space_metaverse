import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createClassroomServer} from '../server/app.js';

// Isolated synthetic room; no real classroom credentials or saved data.
const game=createClassroomServer({teacherKey:'local-render-verification',studentHours:false});
const address=await game.listen();
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[],checks=[],out='.local/world-render';mkdirSync(out,{recursive:true});
async function scene(page){
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/render-test',route=>route.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><body class="joined" style="margin:0;background:#252c4d"><canvas id="test" style="width:1200px;height:760px"></canvas></body>'}));
  await page.goto(`http://127.0.0.1:${address.port}/render-test`);
  await page.evaluate(async()=>{
    performance.setResourceTimingBufferSize(5000);
    const {createWorld}=await import('/world.js'),{MAP,STREET}=await import('/shared/config.js');
    window.frameTimes=[];const raf=window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame=fn=>raf(t=>{const start=performance.now();fn(t);frameTimes.push(performance.now()-start);});
    window.world=createWorld(document.querySelector('canvas'));
    window.room={players:Array.from({length:35},(_,i)=>({id:'p'+i,role:'student',nickname:'검사'+i,mapId:i?MAP.id:STREET.id,x:i?MAP.spawn.x+i*3:900,y:i?MAP.spawn.y:1690,avatar:{level:1},effects:[]})),planets:[],monsters:[]};
    world.setRoom(room,'p0');
  });
}
try{
  const page=await browser.newPage({viewport:{width:1200,height:760}});
  let release;const held=new Promise(resolve=>{release=resolve;});
  await page.route('**/assets/maps/starlight-street.png',async route=>{await held;await route.continue();});
  await scene(page);
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.artStatus==='loading');
  assert.equal(await page.locator('canvas').getAttribute('data-self-render-x'),null);
  checks.push('Delayed artwork shows explicit loading before world drawing, not primitive placeholders');
  release();await page.waitForFunction(()=>document.querySelector('canvas').dataset.artStatus==='ready');
  await page.screenshot({path:out+'/park.png'});
  checks.push('Real street art decoded and world resumes');
  const firstLoad=await page.evaluate(()=>{const entries=performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/'));return {count:entries.length,bytes:entries.reduce((sum,e)=>sum+e.encodedBodySize,0),paths:entries.map(e=>new URL(e.name).pathname)};});
  assert(!firstLoad.paths.some(path=>/origin-starlight|paradise-sun|paradise-moon|plaza-sanctuary|milky-valley|star-goddess/.test(path)));
  checks.push('Cold street entry does not request unused plaza, valley, origin or paradise artwork');
  const aim=await page.evaluate(()=>{
    const me=world.screenPoint({kind:'player',id:'p0',...room.players[0]});
    return {left:world.aimAt({clientX:me.x-80,clientY:me.y+40}),right:world.aimAt({clientX:me.x+80,clientY:me.y-40}),invalid:world.aimAt({clientX:NaN,clientY:0})};
  });
  assert.equal(aim.left.facingX,-1);assert(aim.left.dx<0&&aim.left.dy>0);
  assert.equal(aim.right.facingX,1);assert(aim.right.dx>0&&aim.right.dy<0);assert.equal(aim.invalid,null);
  assert(Math.abs(Math.hypot(aim.left.dx,aim.left.dy)-1)<1e-6);checks.push('Mouse aim uses rendered camera/self, normalized vector and both facing directions');
  await page.evaluate(()=>{room.players[0].x=900;room.players[0].y=530;world.setRoom(room,'p0');});
  await page.waitForTimeout(300);await page.screenshot({path:out+'/stations.png'});
  await page.evaluate(()=>world.setOverview(true));await page.waitForTimeout(100);await page.screenshot({path:out+'/overview.png'});
  const cache=await page.evaluate(async()=>{
    const {STATIC_MAPS}=await import('/shared/config.js'),{drawParadise,drawStarOrigin,sceneryCacheStats}=await import('/scenery.js'),{prepareMapArt}=await import('/map-art-ready.js');
    const maps=Object.values(STATIC_MAPS).filter(m=>m.theme?.includes('paradise')||m.theme==='star-origin');
    await Promise.all(maps.map(m=>prepareMapArt(m).promise));
    const c=document.createElement('canvas').getContext('2d');
    for(const map of maps)(map.theme==='star-origin'?drawStarOrigin:drawParadise)(c,map,0);
    return {...sceneryCacheStats(),visited:maps.length,unboundedBytes:maps.reduce((sum,m)=>sum+Math.floor(m.width)*Math.floor(m.height)*4,0)};
  });
  assert(cache.visited>2);assert.equal(cache.entries,2);assert(cache.bytes<cache.unboundedBytes);checks.push('All visited scenery maps preserve art with only two full background surfaces retained');
  await page.evaluate(()=>{world.setOverview(false);frameTimes.length=0;});await page.waitForTimeout(1600);
  const timing=await page.evaluate(()=>{const times=frameTimes.slice(-80).sort((a,b)=>a-b);return {frames:times.length,mean:times.reduce((a,b)=>a+b,0)/times.length,p95:times[Math.floor(times.length*.95)]};});
  const assets=await page.evaluate(()=>{const entries=performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/'));return {count:entries.length,bytes:entries.reduce((sum,e)=>sum+e.encodedBodySize,0),largest:entries.toSorted((a,b)=>b.encodedBodySize-a.encodedBodySize).slice(0,5).map(e=>({path:new URL(e.name).pathname,bytes:e.encodedBodySize}))};});
  const failed=await browser.newPage({viewport:{width:1200,height:760}});
  await failed.route('**/assets/maps/starlight-street.png',route=>route.abort());await scene(failed);
  await failed.waitForFunction(()=>document.querySelector('canvas').dataset.artStatus==='error');
  await failed.screenshot({path:out+'/asset-error.png'});checks.push('Failed image is visibly reported and leaves the world usable');
  const families=[];
  for(const [id,broken] of [['space-plaza','plaza-sanctuary.png'],['star-street','starlight-street.png'],['milky-valley','milky-valley-sky.png'],['star-origin-4','origin-starlight.png'],['moon-garden','paradise-moon.png'],['black-hole','black-hole-interior.png'],['whale-stomach','cetus-belly-interior.png'],['test-interior','board.png']]){
    for(const fail of [false,true]){
      const probe=await browser.newPage();probe.on('pageerror',error=>errors.push(error.message));
      await probe.route('**/art-test',route=>route.fulfill({contentType:'text/html',body:'<canvas></canvas>'}));
      if(fail)await probe.route('**/'+broken,route=>route.abort());
      await probe.goto(`http://127.0.0.1:${address.port}/art-test`);
      const result=await probe.evaluate(async id=>{
        const {STATIC_MAPS}=await import('/shared/config.js'),{prepareMapArt}=await import('/map-art-ready.js');
        const before=performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/')).length;
        const state=prepareMapArt(STATIC_MAPS[id]||{id,objects:[]});await state.promise;
        return {before,status:state.status,failed:state.failed};
      },id);
      assert.equal(result.before,0,`No import-time artwork requests (${id})`);
      assert.equal(result.status,fail?'error':'ready',`${id} ${fail?'failed':'decoded'}`);
      families.push({id,fail,...result});await probe.close();
    }
  }
  checks.push('All eight map artwork families decode successfully, start no unused import-time requests, and report missing art explicitly');
  assert.deepEqual(errors,[]);
  const report={checks,firstLoad,cache,timing,assets,families,errors};writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await game.close();}
