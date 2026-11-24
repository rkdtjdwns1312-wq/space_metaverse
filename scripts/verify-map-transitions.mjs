import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';

const out='.local/map-transitions';mkdirSync(out,{recursive:true});
const game=createClassroomServer({teacherKey:'isolated-transition-check',studentHours:false});
const {port}=await game.listen();
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const results=[],errors=[];
try{
  for(const enabled of [false,true,'recovery'])for(const [from,to] of [['space-plaza','star-street'],['star-street','star-station'],['star-station','sleeping-stars-1'],['space-plaza','black-hole'],['star-street','star-playground']]){
    if(enabled==='recovery'&&!['star-street','black-hole','star-playground'].includes(to))continue;
    const context=await browser.newContext({viewport:{width:1200,height:760}}),page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    if(!enabled)await page.route('**/map-transition-preload.js',route=>route.fulfill({contentType:'text/javascript',body:'export const createMapTransitionPreload=()=>({update(){},cancel(){}});'}));
    // Identical controlled image latency for both paths; this is a loading
    // regression scenario, not a claim about students' internet speed.
    let offline=enabled==='recovery',failedRequests=0,failedPath;
    await page.route('**/assets/**',async route=>{
      const path=new URL(route.request().url()).pathname,needle=to==='black-hole'?'black-hole-interior.png':to==='star-playground'?'/assets/arcade/':'starlight-street.png';
      if(offline&&path.includes(needle)&&(!failedPath||path===failedPath)){failedPath=path;failedRequests++;await route.abort();return;}
      await new Promise(r=>setTimeout(r,400));await route.continue();
    });
    await page.route('**/transition-test',route=>route.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><body class="joined" style="margin:0"><div id="constellation-links-hint" hidden></div><canvas style="width:1200px;height:760px"></canvas>'}));
    await page.goto(`http://127.0.0.1:${port}/transition-test`);
    await page.evaluate(async({from,to})=>{
      performance.setResourceTimingBufferSize(5000);
      const {createWorld}=await import('/world.js'),{mapOf}=await import('/shared/config.js');
      window.mapOf=mapOf;window.world=createWorld(document.querySelector('canvas'));world.setQuality('high');
      const map=mapOf(from),gate=map.objects.find(o=>['gate','black-hole'].includes(o.kind)&&o.target===to);
      if(!gate)throw Error('Missing test route '+from+' to '+to);
      window.room={players:[{id:'test',role:'teacher',connected:true,mapId:from,x:gate.x,y:gate.y,avatar:{level:5},effects:[]}],monsters:[],planets:[]};
      window.setMap=id=>{const map=mapOf(id);Object.assign(room.players[0],{mapId:id,...map.spawn});world.setRoom(room,'test');};
      world.setRoom(room,'test');
    },{from,to});
    await page.waitForFunction(()=>document.querySelector('canvas').dataset.artStatus==='ready');
    await page.waitForTimeout(1800);
    if(enabled==='recovery'){
      await page.waitForFunction(async to=>{const {prepareMapArt}=await import('/map-art-ready.js');return prepareMapArt(mapOf(to),[],{speculative:true}).status==='error';},to);
      assert.equal(failedRequests,3,'background retries exhausted before recovery');offline=false;
    }
    const before=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/')).length);
    const elapsed=await page.evaluate(async to=>{
      const start=performance.now();setMap(to);
      await new Promise(resolve=>{const frame=()=>{if(document.querySelector('canvas').dataset.artStatus==='ready'&&performance.now()>start+30)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);});
      return performance.now()-start;
    },to);
    assert.equal(await page.evaluate(()=>world.currentMapId()),to);
    await page.waitForTimeout(150);
    const after=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/')).length);
    if(enabled)await page.screenshot({path:`${out}/${to}.png`});
    if(enabled==='recovery')assert.equal(await page.evaluate(async to=>{const {prepareMapArt}=await import('/map-art-ready.js');return prepareMapArt(mapOf(to)).status;},to),'ready');
    results.push({prefetch:enabled,from,to,imageDelayMs:400,transitionMs:Math.round(elapsed),assetsBefore:before,assetsAfter:after,failedRequests});
    await context.close();
  }
  assert.deepEqual(errors,[]);
  for(const result of results.filter(r=>r.prefetch===true)){
    const baseline=results.find(r=>!r.prefetch&&r.to===result.to);
    assert(result.transitionMs<baseline.transitionMs,JSON.stringify({baseline,result}));
  }
  writeFileSync(out+'/results.json',JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close();await game.close();}
