import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {FORGOTTEN_CONSTELLATION as spec} from '../shared/forgotten-constellation.js';
import {monstersOf} from '../server/monsters.js';
import {tryConstellationGather,tickConstellationGather} from '../server/forgotten-constellation-gather.js';
import {ensureVitals,playerVitals} from '../server/vitals.js';
import {chargeHuntingStation} from '../server/hunting-time.js';

let now=Date.now();
const key='isolated-constellation-gather',game=createClassroomServer({teacherKey:key,studentHours:false,clock:()=>now}),{port}=await game.listen();
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']}),dir='.local/forgotten-constellation';mkdirSync(dir,{recursive:true});
try{
 const teacher=await browser.newPage(),pc=await browser.newPage({viewport:{width:1280,height:900},hasTouch:true}),mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[],failedRequests=[];
 for(const page of [pc,mobile])await page.addInitScript(()=>{
  const proto=CanvasRenderingContext2D.prototype,fill=proto.fill,fillText=proto.fillText;window.gatherStarFrames=0;window.gatherHudText=[];
  proto.fill=function(){if(this.canvas.id==='world'&&this.fillStyle==='#fffdf8')window.gatherStarFrames++;return fill.apply(this,arguments);};
  proto.fillText=function(value,x,y){if(this.canvas.id==='world'&&typeof value==='string'&&(value==='별의 힘을 모아'||/^\d+초$/.test(value)||value==='별자리의 기원'))window.gatherHudText.push({value,x,y});return fillText.apply(this,arguments);};
 });
 for(const page of [pc,mobile]){page.on('pageerror',error=>errors.push(error.message));page.on('requestfailed',request=>failedRequests.push([request.url(),request.failure()?.errorText]));}
 await teacher.goto('http://127.0.0.1:'+port);await teacher.locator('#connection.is-connected').waitFor({state:'attached'});await teacher.locator('#teacher-tab').evaluate(button=>button.click());await teacher.locator('#teacher-key').waitFor({state:'visible'});await teacher.locator('#teacher-key').fill(key);await fillNewClass(teacher,['별모으기PC','별모으기모바일']);await teacher.locator('#teacher-form .submit').click();await teacher.waitForTimeout(700);if(await teacher.locator('#lobby').isVisible())console.log('CREATE_DEBUG',await teacher.locator('#form-message').textContent(),await teacher.locator('#teacher-form').evaluate(form=>({valid:form.checkValidity(),message:form.validationMessage,rows:[...form.querySelectorAll('input')].map(i=>[i.id,i.value,i.validity.valid])})));await teacher.locator('#lobby').waitFor({state:'hidden'});
 const code=await teacher.locator('#room-code').textContent();
 const join=async(page,nickname)=>{await page.goto('http://127.0.0.1:'+port);await page.locator('#connection.is-connected').waitFor({state:'attached'});await page.locator('#student-tab').click();await page.locator('#join-code').fill(code);await page.locator('#nickname').fill(nickname);await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});for(let i=0;i<14&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');};
 await join(pc,'별모으기PC');await join(mobile,'별모으기모바일');
 const room=game.store.rooms.get(code),p=[...room.players.values()].find(player=>player.nickname==='별모으기PC'),q=[...room.players.values()].find(player=>player.nickname==='별모으기모바일');
 assert(p&&q);room.forgottenConstellation={state:'active',monsterId:spec.monsterId,respawnAt:null};
 const boss=monstersOf(room,now).get(spec.monsterId);boss.pendingAttack=null;boss.mp=100;
 chargeHuntingStation(p,'math',now);chargeHuntingStation(q,'math',now);
 p.avatar.level=5;q.avatar.level=5;
 Object.assign(p,{mapId:spec.mapId,x:boss.x,y:boss.y});Object.assign(q,{mapId:spec.mapId,x:boss.x+70,y:boss.y});
 const sync=async(player)=>{const snapshot=game.store.snapshot(room,player,now);const socket=game.io.to(player.socketId);socket.emit('room:state',snapshot);socket.emit('world:positions',{mapId:spec.mapId,positionTime:now,positions:snapshot.players.filter(value=>value.mapId===spec.mapId).map(value=>[value.id,value.x,value.y,value.facingX]),monsters:snapshot.monsters});};
 await pc.bringToFront();await sync(p);await pc.waitForFunction(()=>document.querySelector('#world').dataset.artStatus==='ready');
 await mobile.bringToFront();await sync(q);await mobile.waitForFunction(()=>document.querySelector('#world').dataset.artStatus==='ready');
 const clearOverlay=async page=>{if(await page.locator('#minimap-toggle').isVisible())await page.locator('#minimap-toggle').click();if(await page.locator('#journey-hide').isVisible())await page.locator('#journey-hide').evaluate(button=>button.click());await page.locator('#new-mission-notice').evaluate(element=>element.hidden=true);};
 assert(tryConstellationGather(room,boss,now,()=>0));const cast=boss.gather,first=cast.stars[0];assert.equal(first.appearsAt,now);assert.equal(cast.stars.length,15);
 const at=async(page,player,star)=>{Object.assign(player,{mapId:spec.mapId,x:star.x,y:star.y,input:{x:0,y:0,at:0}});await sync(player);await page.waitForFunction(()=>document.querySelector('#world').dataset.artStatus==='ready');try{await page.waitForFunction(()=>document.querySelector('#interact-object').textContent==='별 모으기'&&!document.querySelector('#interact-prompt').hidden,null,{timeout:7000});}catch(error){console.log('PICKUP_DEBUG',await page.evaluate(()=>({prompt:document.querySelector('#interact-object').textContent,hidden:document.querySelector('#interact-prompt').hidden,world:document.querySelector('#world').dataset,caption:document.querySelector('#map-caption').textContent})));throw error;}};
 await pc.bringToFront();
 await at(pc,p,first);try{await pc.waitForFunction(()=>{const c=document.querySelector('#world');return c.dataset.forgottenGatherSeconds==='20'&&c.dataset.forgottenGatherPickupCount==='1'&&window.gatherStarFrames>0&&window.gatherHudText.some(x=>x.value==='별의 힘을 모아')&&window.gatherHudText.some(x=>x.value==='20초')&&window.gatherHudText.some(x=>x.value==='별자리의 기원');},null,{timeout:7000});}catch(error){console.log('HUD_DEBUG',await pc.evaluate(()=>({world:document.querySelector('#world').dataset,head:window.gatherHudText,stars:window.gatherStarFrames})));throw error;}
 const hud=await pc.evaluate(()=>{const values=window.gatherHudText;return {title:values.find(x=>x.value==='별의 힘을 모아'),timer:values.find(x=>x.value==='20초'),boss:values.find(x=>x.value==='별자리의 기원')};});assert(hud.title.y<hud.boss.y&&hud.timer.y<hud.boss.y,'skill title and countdown are above the boss title');
 ensureVitals(p).hp=1;
 await pc.locator('#world').focus();await pc.keyboard.press('f');await pc.waitForFunction(()=>document.querySelector('#world').dataset.forgottenGatherSelfCount==='1');assert.equal(cast.counts.get(p.id),1);assert.equal(ensureVitals(p).hp,playerVitals(p).hp.max);
 ensureVitals(q).hp=1;now=cast.startsAt+1000;const second=cast.stars[1];assert.equal(second.appearsAt,now);Object.assign(p,{x:second.x+65,y:second.y});await mobile.bringToFront();await mobile.setViewportSize({width:390,height:844});await at(mobile,q,second);await mobile.locator('#touch-interact').tap();
 await mobile.waitForFunction(()=>document.querySelector('#world').dataset.forgottenGatherSelfCount==='1'&&document.querySelector('#world').dataset.forgottenGatherRowCount==='2');assert.equal(cast.counts.get(p.id),cast.counts.get(q.id));assert.equal(ensureVitals(q).hp,playerVitals(q).hp.max);
 Object.assign(p,{x:q.x+65,y:q.y});await sync(p);await sync(q);await pc.waitForTimeout(300);await mobile.waitForTimeout(300);
 await pc.bringToFront();await clearOverlay(pc);await pc.waitForFunction(()=>document.querySelector('#world').dataset.artStatus==='ready');await pc.waitForTimeout(300);await pc.screenshot({path:dir+'/gather-desktop.png'});await mobile.bringToFront();await clearOverlay(mobile);await mobile.waitForFunction(()=>document.querySelector('#world').dataset.artStatus==='ready');await mobile.waitForTimeout(300);await mobile.screenshot({path:dir+'/gather-mobile.png'});
 assert.equal(cast.stars.filter(star=>!star.resolved&&star.expiresAt>now).length,13);
 for(const star of cast.stars)star.resolved=true;
 now=cast.endsAt;tickConstellationGather(room,boss,now);await sync(p);await sync(q);
 await pc.bringToFront();await pc.waitForFunction(()=>document.querySelector('#world').dataset.forgottenGatherSeconds==='0'&&document.querySelector('#world').dataset.forgottenGatherPickupCount==='0'&&document.querySelector('#world').dataset.forgottenGatherRowCount==='0');
 await mobile.bringToFront();await mobile.waitForFunction(()=>document.querySelector('#world').dataset.forgottenGatherSeconds==='0'&&document.querySelector('#world').dataset.forgottenGatherPickupCount==='0'&&document.querySelector('#world').dataset.forgottenGatherRowCount==='0');
 assert.equal(boss.gather,null);assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);
 console.log('PASS real desktop F pickup, mobile touch pickup, full HP restoration for both collectors, collection rows above both players, 15 total pickups, first star at t0, five second star lifetime, server 20s title/countdown, screenshots, expiration disappearance');
}finally{await browser.close();await game.close();}
