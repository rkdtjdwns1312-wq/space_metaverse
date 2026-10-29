import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {STREET} from '../shared/config.js';
import {STREET_PARK,STREET_LAYOUT} from '../shared/street-layout.js';
const key='isolated-fountain-depth',game=createClassroomServer({teacherKey:key,studentHours:false}),errors=[];
const {port}=await game.listen(),browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
mkdirSync('.local/fountain-bridge',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+port);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 for(let n=0;n<12&&await page.locator('dialog[open]').count();n++)await page.keyboard.press('Escape');
 const room=game.store.rooms.get(await page.locator('#room-code').textContent()),p=[...room.players.values()].find(p=>p.role==='teacher');
 const move=async(x,y)=>{Object.assign(p,{mapId:STREET.id,x,y,input:{x:0,y:0,at:0}});game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));await page.waitForTimeout(450);};
 const f=STREET_PARK.fountain;
 await move(f.x,f.y-f.ry-75);await page.evaluate(async()=>{await(await import('/street-art.js')).preloadStreetArt();});await page.waitForFunction(()=>document.querySelector('#world').dataset.artStatus==='ready');
 await page.screenshot({path:'.local/fountain-bridge/behind.png'});
 await move(f.x,f.y+f.ry+75);await page.screenshot({path:'.local/fountain-bridge/front.png'});
 await move(STREET_LAYOUT.northArrival.x,STREET_LAYOUT.northArrival.y);await page.screenshot({path:'.local/fountain-bridge/gate.png'});
 await move(STREET_LAYOUT.northGate.x,STREET_LAYOUT.northGate.y+35);await page.locator('#touch-interact').click();await page.waitForTimeout(400);assert.equal(p.mapId,'sleeping-stars-1');
 const frames=await page.evaluate(async()=>{const {drawStreetFountain}=await import('/street-art.js');const c=document.createElement('canvas');c.width=600;c.height=400;const ctx=c.getContext('2d');const frame=(time,reduced)=>{ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,600,400);ctx.translate(-550,-1440);drawStreetFountain(ctx,time,reduced);return c.toDataURL();};return {a:frame(0,false),b:frame(150,false),r1:frame(0,true),r2:frame(750,true)};});assert.notEqual(frames.a,frames.b);assert.equal(frames.r1,frames.r2);
 await page.setViewportSize({width:390,height:844});await move(f.x,f.y+f.ry+75);await page.screenshot({path:'.local/fountain-bridge/mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS fountain front/back actual render, northern gate travel, 8-frame water changes/reduced-motion freeze, desktop/mobile; JS errors 0');
}finally{await browser.close();await game.close();}
