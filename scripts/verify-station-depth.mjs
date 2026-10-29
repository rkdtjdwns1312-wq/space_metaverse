import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {STREET} from '../shared/config.js';
import {STREET_PARK,STREET_LAYOUT} from '../shared/street-layout.js';
const key='isolated-station-depth',game=createClassroomServer({teacherKey:key,studentHours:false}),errors=[];
const {port}=await game.listen(),browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
mkdirSync('.local/station-depth',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+port);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 for(let n=0;n<12&&await page.locator('dialog[open]').count();n++)await page.keyboard.press('Escape');
 const room=game.store.rooms.get(await page.locator('#room-code').textContent()),p=[...room.players.values()].find(p=>p.role==='teacher');
 const move=async(x,y)=>{Object.assign(p,{mapId:STREET.id,x,y,input:{x:0,y:0,at:0}});game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));await page.waitForTimeout(450);};
 const stations=STREET.objects.filter(o=>o.kind.endsWith('-station'));
 for(const o of stations){
  await move(o.x,o.y-150);await page.waitForFunction(()=>document.querySelector('#world').dataset.artStatus==='ready');
  await page.screenshot({path:'.local/station-depth/'+o.id+'-behind.png'});
  await move(o.x,o.y+155);await page.screenshot({path:'.local/station-depth/'+o.id+'-front.png'});
 }
 await move(STREET_LAYOUT.northArrival.x,STREET_LAYOUT.northArrival.y);await page.screenshot({path:'.local/station-depth/gate.png'});
 await move(STREET_LAYOUT.northGate.x,STREET_LAYOUT.northGate.y+35);await page.locator('#touch-interact').click();await page.waitForTimeout(450);assert.equal(p.mapId,'sleeping-stars-1');
 const {mapOf}=await import('../shared/config.js');const returnGate=mapOf(p.mapId).objects.find(o=>o.kind==='gate'&&o.target===STREET.id);
 Object.assign(p,{x:returnGate.x,y:returnGate.y-35});game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));await page.waitForTimeout(450);await page.locator('#touch-interact').click();await page.waitForTimeout(450);assert.equal(p.mapId,STREET.id);assert(Math.hypot(p.x-STREET_LAYOUT.northArrival.x,p.y-STREET_LAYOUT.northArrival.y)<100);
 await page.setViewportSize({width:390,height:844});await move(STREET_LAYOUT.northArrival.x,STREET_LAYOUT.northArrival.y);await page.screenshot({path:'.local/station-depth/mobile-gate.png'});
 await page.setViewportSize({width:1280,height:900});await move(650,1500);await page.screenshot({path:'.local/station-depth/cozy-layout.png'});
 for(const o of STREET.objects.filter(o=>o.kind.startsWith('cozy-'))){await move(o.x,o.y+(o.kind==='cozy-garden'?70:100));await page.locator('#touch-interact').click();await page.locator('dialog[open]').waitFor({state:'visible'});assert.equal(await page.locator('.cozy-dialog[open] [data-title]').innerText(),({'cozy-pet':'별빛 아기 돌보기','cozy-room':'나만의 별방','cozy-garden':'우주 꽃밭'})[o.kind]);await page.locator('.cozy-panel button').first().waitFor({state:'visible'});await page.keyboard.press('Escape');if(o.kind==='cozy-garden')await page.screenshot({path:'.local/station-depth/garden.png'});}
 assert.deepEqual(errors,[]);console.log('PASS five stations front/back actual render, science/culture upper gate round trip, mobile entrance, JS errors 0');
}finally{await browser.close();await game.close();}
