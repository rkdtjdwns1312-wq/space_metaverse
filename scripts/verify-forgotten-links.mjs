import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {FORGOTTEN_CONSTELLATION as spec} from '../shared/forgotten-constellation.js';
import {monstersOf,moveMonsters,damageMonster} from '../server/monsters.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {ensureVitals} from '../server/vitals.js';

let now=Date.now();
const key='isolated-classroom-link-pattern',game=createClassroomServer({teacherKey:key,studentHours:false,clock:()=>now}),{port}=await game.listen();
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']}),dir='.local/forgotten-constellation';mkdirSync(dir,{recursive:true});
try{
 const teacher=await browser.newPage(),ctx=await browser.newContext({viewport:{width:1280,height:900},hasTouch:true}),page=await ctx.newPage(),errors=[];
 await page.addInitScript(()=>{
  const proto=CanvasRenderingContext2D.prototype,scale=proto.scale,fill=proto.fill;
  window.homingStarFrames=0;
  proto.scale=function(x,y){this.testStarScale=x===y?x:0;return scale.apply(this,arguments);};
  proto.fill=function(){if(this.canvas.id==='world'&&this.fillStyle==='#fff0af'&&this.testStarScale>16.7&&this.testStarScale<19.3)window.homingStarFrames++;return fill.apply(this,arguments);};
 });
 page.on('pageerror',e=>errors.push(e.message));
 await teacher.goto('http://127.0.0.1:'+port);await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);await fillNewClass(teacher,['별검사']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
 const code=await teacher.locator('#room-code').textContent();await page.goto('http://127.0.0.1:'+port);await page.locator('#student-tab').click();await page.locator('#join-code').fill(code);await page.locator('#nickname').fill('별검사');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 for(let i=0;i<14&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');
 const room=game.store.rooms.get(code),p=[...room.players.values()].find(p=>p.role==='student');chargeHuntingStation(p,'math',now);p.taurusImmuneUntil=now+120000;
 room.forgottenConstellation={state:'active',monsterId:spec.monsterId,respawnAt:null};
 const boss=monstersOf(room,now).get(spec.monsterId);Object.assign(p,{mapId:spec.mapId,x:boss.x-150,y:boss.y});
 damageMonster(room,boss,p,1,now);now+=200;moveMonsters(room,now,()=>.12);
 const cast=boss.links;assert(cast);const hint=page.locator('#constellation-links-hint');
 const at=async number=>{
  const star=cast.stars[number-1];Object.assign(p,{x:star.x,y:star.y,input:{x:0,y:0,at:0}});
  game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p,now));
  await page.waitForFunction(n=>document.querySelector('#interact-object').textContent==='점 '+n+'개 별 조사하기'&&!document.querySelector('#interact-prompt').hidden,number);
 };
 await at(4);await hint.waitFor();await page.locator('#world').focus();await page.keyboard.press('f');await page.waitForTimeout(120);assert.equal(cast.linked,0);
 for(const n of [1,2]){await at(n);await page.locator('#world').focus();await page.keyboard.press('f');await page.waitForFunction(n=>document.querySelector('#constellation-links-hint').textContent.includes(n+'/5'),n);}
 now+=3000;
 await page.waitForFunction(()=>window.homingStarFrames>0);assert(boss.homing.shot&&boss.links);
 now+=450;await page.waitForTimeout(170);
 await page.screenshot({path:dir+'/homing-star-desktop.png'});
 now+=1550;await page.waitForFunction(()=>document.querySelector('#constellation-links-hint').textContent.includes('15초'));
 await page.locator('#map-overview').click();await page.locator('#map-area-view').click();await page.screenshot({path:dir+'/links-overview.png'});
 await page.setViewportSize({width:390,height:844});await at(3);await page.locator('#touch-interact').tap();await page.waitForFunction(()=>document.querySelector('#constellation-links-hint').textContent.includes('3/5'));
 await page.screenshot({path:dir+'/links-mobile.png'});
 const quiet=await page.evaluate(async()=>{
  const {drawConstellationPoint,drawQuietStar}=await import('/forgotten-links-art.js');
  const c=document.createElement('canvas');c.width=100;c.height=100;const ctx=c.getContext('2d',{willReadFrequently:true});
  const spotPatterns=[[[0,0]],[[-1,-1],[1,1]],[[-1,-1],[0,0],[1,1]],[[-1,-1],[1,-1],[-1,1],[1,1]],[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]]];
  const probes=[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]];
  for(const [i,spots] of spotPatterns.entries()){
   ctx.clearRect(0,0,100,100);drawConstellationPoint(ctx,{x:50,y:50,number:i+1},0,30);
   for(const [x,y] of probes){
    const [r,g,b]=ctx.getImageData(Math.round(50+x*8.1),Math.round(50+y*8.1),1,1).data;
    if((r<64&&g<64&&b<64)!==spots.some(([a,b])=>a===x&&b===y))return false;
   }
  }
  ctx.clearRect(0,0,100,100);drawQuietStar(ctx,50,50,18);const one=c.toDataURL();ctx.clearRect(0,0,100,100);drawQuietStar(ctx,50,50,18);
  return one===c.toDataURL()&&!performance.getEntriesByType('resource').some(e=>/forgotten-(homing-star|pattern-star)\.webp/.test(e.name));
 });assert(quiet,'actual pip counts and steady low-motion vector effect');
 for(const n of [4,5]){await at(n);await page.locator('#touch-interact').tap();if(n===4)await page.waitForFunction(()=>document.querySelector('#constellation-links-hint').textContent.includes('4/5'));}
 await hint.waitFor({state:'hidden'});assert.equal(boss.links,null);assert(ensureVitals(p).hp>0);
 // Start another real cast and let the server clock cross the deadline.
 now=cast.endsAt+20000;boss.pendingAttack=null;boss.linksDecisionAt=0;moveMonsters(room,now,()=>.1);assert(boss.links);
 await hint.waitFor();now=boss.links.endsAt;await hint.waitFor({state:'hidden'});assert.equal(ensureVitals(p).hp,0);
 assert.deepEqual(errors,[]);console.log('PASS actual AI, wrong answer retained, PC F, mobile touch, 5→0 completion, actual quiet homing attack during puzzle, all five pip patterns, partial lines in map overview & mobile, countdown 15s and server timeout defeat');
}finally{await browser.close();await game.close();}
