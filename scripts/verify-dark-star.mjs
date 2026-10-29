import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {mapOf} from '../shared/config.js';
import {DARK_STAR} from '../shared/dark-star.js';
const key='isolated-dark-star',game=createClassroomServer({teacherKey:key,studentHours:false}),errors=[];
const {port}=await game.listen(),browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});mkdirSync('.local/dark-star',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+port);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 for(let n=0;n<12&&await page.locator('dialog[open]').count();n++)await page.keyboard.press('Escape');
 const room=game.store.rooms.get(await page.locator('#room-code').textContent()),p=[...room.players.values()].find(p=>p.role==='teacher'),statue=mapOf(DARK_STAR.mapId).objects.find(o=>o.id===DARK_STAR.statueId);
 const move=async(x,y)=>{Object.assign(p,{mapId:DARK_STAR.mapId,x,y,input:{x:0,y:0,at:0}});game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));await page.waitForTimeout(500);};
 await move(statue.x,statue.y+110);await page.waitForFunction(()=>document.querySelector('#world').dataset.artStatus==='ready');assert(!room.monsters?.has(DARK_STAR.monsterId));
 await page.screenshot({path:'.local/dark-star/statue.png'});await page.locator('#touch-interact').click();await page.locator('#dark-star-dialog[open]').waitFor();assert.equal(await page.locator('#dark-star-message').innerText(),'소환합니까?');await page.locator('#dark-star-dialog [data-cancel]').click();assert(!room.monsters?.has(DARK_STAR.monsterId));
 await page.locator('#touch-interact').click();await page.locator('#dark-star-dialog [data-summon]').click();await page.locator('#dark-star-dialog').waitFor({state:'hidden'});await page.waitForTimeout(1000);
 const boss=room.monsters.get(DARK_STAR.monsterId);assert(boss?.hp===10000);assert.equal(room.darkStar.state,'active');assert.equal(await page.locator('#touch-interact').isEnabled(),false);
 await move(boss.x-230,boss.y);await page.screenshot({path:'.local/dark-star/boss-desktop.png'});
 await page.setViewportSize({width:390,height:844});await move(boss.x,boss.y);await page.screenshot({path:'.local/dark-star/boss-mobile.png'});
 const art=await page.evaluate(async()=>{const {drawDarkStar,preloadDarkStarArt}=await import('/dark-star-art.js');await preloadDarkStarArt();const c=document.createElement('canvas');c.width=500;c.height=500;const ctx=c.getContext('2d'),m={shape:'dark-star',x:250,y:300,radius:150};const capture=t=>{ctx.clearRect(0,0,500,500);drawDarkStar(ctx,m,t);return c.toDataURL();};return {a:capture(0),b:capture(700)};});assert.notEqual(art.a,art.b,'floating movement');
 await page.emulateMedia({reducedMotion:'reduce'});const quiet=await page.evaluate(async()=>{const {drawDarkStar}=await import('/dark-star-art.js');const c=document.createElement('canvas');c.width=500;c.height=500;const ctx=c.getContext('2d'),m={shape:'dark-star',x:250,y:300,radius:150};const capture=t=>{ctx.clearRect(0,0,500,500);drawDarkStar(ctx,m,t);return c.toDataURL();};return capture(0)===capture(700);});assert(quiet);
 const gem=await page.evaluate(async()=>{const img=new Image();img.src='/assets/items/black-gem.webp';await img.decode();return img.naturalWidth;});assert.equal(gem,320);assert.deepEqual(errors,[]);console.log('PASS dormant statue, cancel, confirmed summon, 10000 HP, live statue removal, PC/mobile, floating/reduced motion, final gem decode, errors0');
}finally{await browser.close();await game.close();}
