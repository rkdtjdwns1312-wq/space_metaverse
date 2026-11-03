// Isolated synthetic classroom; never connects to production or reads student data.
// node scripts/benchmark-low-end.mjs [source-root] [label] [auto|normal|low] [single-map]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {fillNewClass} from './class-setup.mjs';
const root=path.resolve(process.argv[2]||'.'),label=process.argv[3]||'current',quality=process.argv[4]||'normal';
assert(/^[a-z0-9-]+$/.test(label));
const sceneIds=process.argv[5]?[process.argv[5]]:['space-plaza','star-street','sleeping-stars-4'];
assert(sceneIds.every(id=>['space-plaza','star-street','sleeping-stars-4'].includes(id)));
const load=p=>import(pathToFileURL(path.join(root,p)).href);
const {createClassroomServer}=await load('server/app.js'),{mapOf}=await load('shared/config.js'),{monstersOf}=await load('server/monsters.js');
const {chargeHuntingStation}=await load('server/hunting-time.js');
let now=Date.now();
const key='isolated-performance-only',game=createClassroomServer({teacherKey:key,studentHours:false,teacherManagedAccounts:false,clock:()=>now});
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
const results=[],errors=[];fs.mkdirSync('.local/performance',{recursive:true});
try{
 const {port}=await game.listen(),page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:2});
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({quality})=>{
  localStorage.setItem('woozooclass-render-quality-v1',quality);
  const original=requestAnimationFrame,proto=CanvasRenderingContext2D.prototype;
  let calls=0;
  for(const name of ['drawImage','fill','stroke','fillRect','fillText','strokeText']){const method=proto[name];proto[name]=function(...args){if(this.canvas.id==='world')calls++;return method.apply(this,args);};}
  window.__renderSamples=[];window.__measure=false;
  window.requestAnimationFrame=callback=>original.call(window,time=>{const before=calls,start=performance.now();callback(time);if(window.__measure&&calls>before&&window.__renderSamples.length<2000)window.__renderSamples.push({ms:performance.now()-start,calls:calls-before,time});});
 },{quality});
 await page.goto('http://127.0.0.1:'+port);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);
 await fillNewClass(page,['검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 for(let i=0;i<12&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');
 const room=game.store.rooms.get(await page.locator('#room-code').textContent()),teacher=[...room.players.values()].find(p=>p.role==='teacher');
 const ids=['taurus','leo','aquarius','capricorn','gemini','corvus','libra','hercules','cancer','pisces','cygnus','aries','sagittarius','ophiuchus','corona-borealis','cetus'];
 const pupils=Array.from({length:35},(_,i)=>{const p=game.store.add(room,'검사'+(i+1),'student','perf-'+i);Object.assign(p.avatar,{level:4,constellationId:ids[i%ids.length]});chargeHuntingStation(p,'math',now);return p;});
 const session=await page.context().newCDPSession(page);await session.send('Performance.enable');
 await session.send('Emulation.setCPUThrottlingRate',{rate:4});
 for(const mapId of sceneIds){
  now=Date.now();const map=mapOf(mapId),center={x:map.width/2,y:map.height/2};
  Object.assign(teacher,{mapId,...center,input:{x:0,y:0,at:0}});
  pupils.forEach((p,i)=>Object.assign(p,{mapId,x:center.x+(i%7-3)*95,y:center.y+(Math.floor(i/7)-2)*90,input:{x:0,y:0,at:0}}));
  if(mapId==='sleeping-stars-4')room.truthCreator={state:'active',respawnAt:null,monsterId:'truth-creator-boss'};
  for(const m of monstersOf(room,now).values()){m.sleepUntil=now+1000000;m.mp=0;}
  game.io.to(teacher.socketId).emit('room:state',game.store.snapshot(room,teacher,now));
  await page.waitForFunction(name=>document.querySelector('#minimap-title').textContent===name,map.name);
  const artStatus=await page.evaluate(async mapId=>{const {prepareMapArt}=await import('/map-art-ready.js'),{mapOf}=await import('/shared/config.js');const state=prepareMapArt(mapOf(mapId));await state.promise;return state.status;},mapId);
  assert.equal(artStatus,'ready','current map art has decoded');
  await page.waitForFunction(()=>document.querySelector('#world').dataset.artStatus==='ready');
  await page.waitForTimeout(2500);
  await page.evaluate(()=>{window.__renderSamples=[];window.__measure=true;});
  const start=performance.now();await page.waitForTimeout(5000);const elapsed=performance.now()-start;
  const data=await page.evaluate(()=>{window.__measure=false;const c=document.querySelector('#world');return {samples:window.__renderSamples,canvas:[c.width,c.height],mode:c.dataset.renderQuality||'legacy',dpr:c.dataset.renderDpr||devicePixelRatio};});
  assert(data.samples.length>5,'world rendered frames');assert.equal(pupils.filter(p=>p.mapId===mapId).length,35,'all synthetic students remain in the measured map');const sorted=data.samples.map(s=>s.ms).sort((a,b)=>a-b),metrics=(await session.send('Performance.getMetrics')).metrics;
  const row={mapId,avatars:36,cpuThrottle:4,quality,canvas:data.canvas,activeQuality:data.mode,frames:data.samples.length,renderFps:+(data.samples.length/elapsed*1000).toFixed(1),meanRenderMs:+(sorted.reduce((a,b)=>a+b,0)/sorted.length).toFixed(2),p95RenderMs:+sorted[Math.floor(sorted.length*.95)].toFixed(2),drawCallsPerFrame:Math.round(data.samples.reduce((a,b)=>a+b.calls,0)/data.samples.length),renderCallbackMsPerSecond:+(sorted.reduce((a,b)=>a+b,0)/elapsed*1000).toFixed(1),heapMB:+(metrics.find(m=>m.name==='JSHeapUsedSize').value/1048576).toFixed(1)};
  results.push(row);console.log(JSON.stringify(row));await page.screenshot({path:'.local/performance/'+label+'-'+mapId+'.png'});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('.local/performance/'+label+'.json',JSON.stringify({label,root,quality,notes:'Headless Edge, synthetic 35 students+teacher, CPU4x, DPR2. Render timing instrumentation shared across baseline/current; not a guarantee for real school devices.',results,errors},null,2));
}finally{await browser.close();await game.close();}
