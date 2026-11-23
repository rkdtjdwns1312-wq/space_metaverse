import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
mkdirSync('.local',{recursive:true});
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {STREET} from '../shared/config.js';
import {freshJourney} from '../server/tutorial-journey.js';
const key='isolated-wallet-selection',game=createClassroomServer({teacherKey:key,studentHours:false,dataDir:null});let browser,t;
try{
 const {port}=await game.listen(),url='http://127.0.0.1:'+port;t=io(url,{transports:['websocket']});await new Promise(r=>t.once('connect',r));
 const made=await t.timeout(3000).emitWithAck('room:create',{teacherKey:key,allowedNames:['검사학생']});assert(made.ok);
 browser=await chromium.launch({headless:true,channel:'msedge'});const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#student-tab').click();await page.locator('#join-code').fill(made.room.code);await page.locator('#nickname').fill('검사학생');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 for(let i=0;i<12&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');
 const room=game.store.rooms.get(made.room.code),p=[...room.players.values()].find(p=>p.role==='student');p.cosmicEnergy=1234567;p.journey={...freshJourney(),stage:6,claimedAt:Array(5).fill(0),goals:[],practiceUntil:0};
 const send=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p,Date.now()));
 async function approach(kind){const o=STREET.objects.find(o=>o.kind===kind);Object.assign(p,{mapId:STREET.id,x:o.x,y:o.y+(o.radius||30)+20,input:{x:0,y:0,at:0}});send();await page.waitForFunction(id=>document.querySelector('#interact-prompt')?.dataset.objectId===id,o.id);}
 const bounds=async s=>page.locator(s).boundingBox();
 for(const [w,h] of [[390,844],[320,568],[1280,900]]){
  await page.setViewportSize({width:w,height:h});
  for(const kind of ['cozy-room','cozy-garden']){
   await approach(kind);await page.locator('#interact-prompt').click();await page.locator('#cozy-energy-wallet .currency-amount').filter({hasText:'1,234,567'}).waitFor();
   const chip=page.locator('#cozy-energy-wallet .currency-chip[data-currency=cosmicEnergy]');assert.equal(await chip.evaluate(e=>getComputedStyle(e).display),'flex');
   const r=await chip.locator('img,.currency-label,.currency-amount').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));assert(Math.max(...r.map(b=>b.y+b.h/2))-Math.min(...r.map(b=>b.y+b.h/2))<2,'one currency row');
   const c=await bounds('.cozy-dialog .dialog-pinned-close'),v=await chip.boundingBox();assert(v.x>=0&&v.x+v.width<=w);assert(!(v.x<c.x+c.width&&v.x+v.width>c.x&&v.y<c.y+c.height&&v.y+v.height>c.y),'wallet/close separated');
   assert(await page.locator('.cozy-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:'.local/cozy-wallet-'+kind+'-'+w+'.png'});await page.locator('.cozy-dialog .dialog-pinned-close').click();
  }
 }
 await page.setViewportSize({width:1024,height:768});assert.equal(await page.locator('#classroom-clock').evaluate(e=>getComputedStyle(e).userSelect),'none','wide touch tablet');await page.setViewportSize({width:390,height:844});await approach('shop');
 for(const s of ['#classroom-clock','#hunting-time','#minimap-toggle','#interact-prompt','#touch-attack','#touch-skill']){
  assert.equal(await page.locator(s).evaluate(e=>getComputedStyle(e).userSelect),'none',s);
  await page.evaluate(()=>getSelection().removeAllRanges());const b=await bounds(s);await page.mouse.move(b.x+4,b.y+b.height/2);await page.mouse.down();await page.mouse.move(250,180,{steps:12});await page.mouse.up();assert.equal(await page.evaluate(()=>getSelection().toString()),'',s+' drag must not select HUD');
 }
 await page.locator('#interact-prompt').click();assert(await page.locator('#shop-dialog').isVisible());await page.locator('#shop-dialog .dialog-pinned-close').click();
 await page.locator('#chat-window-toggle').click();await page.locator('#chat-input').fill('글쓰기 선택 확인');await page.locator('#chat-input').selectText();assert.equal(await page.locator('#chat-input').evaluate(e=>getComputedStyle(e).userSelect),'text');assert.equal(await page.locator('#chat-input').evaluate(e=>e.selectionEnd-e.selectionStart),'글쓰기 선택 확인'.length);
 assert.deepEqual(errors,[]);console.log('PASS room/garden wallet same-row icon/name/amount, no close overlap, 320/390/1280; game HUD and interaction mouse-drag selection blocked; chat editing preserved; browser errors0');
}finally{await browser?.close();t?.disconnect();await game.close();}
