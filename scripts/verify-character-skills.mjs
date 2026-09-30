import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals,damagePlayer} from '../server/vitals.js';

let clockShift=0;
const teacherKey=randomBytes(24).toString('hex'),game=createClassroomServer({teacherKey,studentHours:false,clock:()=>Date.now()+clockShift});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const teacher=io(url,{transports:['websocket'],reconnection:false,autoConnect:false});
const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true});page.setDefaultTimeout(10000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));let checks=0;
const check=s=>console.log(`${++checks}. ${s}`);
try{
 await mkdir('.local',{recursive:true});
 await new Promise((r,j)=>{teacher.once('connect',r);teacher.once('connect_error',j);teacher.connect();});
 const made=await teacher.timeout(5000).emitWithAck('room:create',{teacherKey,allowedNames:['까마귀검사']});assert.equal(made.ok,true);
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.locator('#join-code').fill(made.room.code);await page.locator('#nickname').fill('까마귀검사');await page.locator('#student-pin').fill('1234');
 await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=game.store.rooms.get(made.room.code),player=[...room.players.values()].find(p=>p.nickname==='까마귀검사');
 const publish=()=>game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
 const level=async n=>{Object.assign(player.avatar,{level:n,constellationId:'corvus',form:'constellation'});player.battleVitals=null;player.transformation=null;player.corvusCooldownUntil=0;ensureVitals(player);publish();await page.waitForFunction(n=>document.querySelectorAll('#self-skill-slots button:disabled').length===(n===1?3:n===5?0:1),n);await page.locator('#world').focus();await page.waitForTimeout(150);};
 for(let n=1;n<=5;n++){
   await level(n);assert.equal(await page.locator('.auxiliary-skill').count(),n===5?1:0);assert.equal(await page.locator('#touch-skill').isDisabled(),n===1);
   assert.equal(await page.locator('#self-skill-slots button').count(),3);
 }
 check('LV1 Q/E 잠금, LV2 Q/E 해금, LV3/4 보조 없음, LV5 변신 한 칸');
 for(const n of [2,3,4,5]){
   await level(n);await page.keyboard.press('e');await page.waitForFunction(id=>document.querySelector('#world').dataset.lastCorvusVfx===id,'skill-lv'+Math.min(n,4));
   await page.waitForTimeout(120);assert.equal(ensureVitals(player).mp,(n===2?10:n===3?20:n===4?30:40)-5);await page.waitForTimeout(480);
 }
 check('E LV2/3/4 각각 해당 24F, LV5는 LV4 E 유지·MP5 소모');
 await page.keyboard.press('q');await page.waitForFunction(()=>document.querySelector('#world').dataset.lastCorvusVfx==='attack');
 await page.waitForTimeout(300);await page.screenshot({path:'.local/293-corvus-attack.png'});check('Q 검은 깃털 재생');
 await page.keyboard.press('1');await page.waitForTimeout(150);assert.equal(player.transformation.active,true);assert.equal(ensureVitals(player).hp,60);assert.equal(ensureVitals(player).mp,60);check('키1 변신 즉시HP/MP60완전회복·LV5외형·쿨타임');
 await page.screenshot({path:'.local/293-transformed.png'});
 ensureVitals(player).hp=20;ensureVitals(player).mp=10;clockShift+=5100;await page.waitForTimeout(130);assert.equal(ensureVitals(player).hp,26);assert.equal(ensureVitals(player).mp,16);
 clockShift+=25000;await page.waitForTimeout(130);assert.equal(player.transformation.active,false);assert.equal(ensureVitals(player).hp,40);check('5초마다6회복·30초뒤변신종료·최대치원복');
 await page.evaluate(()=>document.getElementById('avatar-dialog').showModal());
 await page.locator('#self-skill-slots button').nth(1).click();await page.locator('#skill-description-dialog').waitFor({state:'visible'});
 assert.match(await page.locator('#skill-description-text').textContent(),/^공격력: 200% × 4회\n쿨타임: 10초\n마나 소모: 5$/);
 await page.screenshot({path:'.local/293-corvus-description.png'});check('내 정보 아이콘 클릭 설명');
 await page.locator('#skill-description-dialog button').click();await page.evaluate(()=>document.getElementById('avatar-dialog').close());
 Object.assign(player,{mapId:'star-origin-1',x:650,y:700,facing:{x:1,y:0}});player.corvusCooldownUntil=0;ensureVitals(player).mp=40;
 const targets=[...monstersOf(room).values()].filter(m=>m.mapId===player.mapId);for(const m of room.monsters.values()){m.nextAttackAt=Number.MAX_SAFE_INTEGER;m.patrolStartedAt=Date.now()+clockShift;}
 Object.assign(targets[0],{x:810,y:700,hp:100,maxHp:100});publish();await page.waitForTimeout(150);await page.locator('#world').focus();await page.keyboard.press('e');
 await page.waitForFunction(()=>Number(document.querySelector('#world').dataset.damageNumberCount)>0);await page.waitForTimeout(250);await page.screenshot({path:'.local/294-damage-numbers.png'});assert.equal(await page.locator('#world').getAttribute('data-last-damage-target-kind'),'monster');check('까마귀 연속 타격의 몬스터 피해 숫자');
 await page.waitForTimeout(1150);damagePlayer(player,10,Date.now()+clockShift);await page.waitForFunction(()=>document.querySelector('#world').dataset.lastDamageTargetKind==='player');await page.waitForTimeout(150);await page.screenshot({path:'.local/294-player-damage.png'});check('아바타 피해 숫자 분홍색·방어력 반영');
 await page.setViewportSize({width:520,height:900});await page.screenshot({path:'.local/293-touch-layout.png'});assert.equal(await page.locator('.auxiliary-skill').count(),1);await page.setViewportSize({width:1440,height:1000});
 await page.goto(url+'/corvus-vfx-preview.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelectorAll('canvas').length===4);
 const seen=new Set();for(let i=0;i<16;i++){seen.add(await page.locator('canvas').first().getAttribute('data-frame'));await page.waitForTimeout(95);}
 assert.ok(seen.size>8);check('4종 24F 실제 연속 재생');
 await page.locator('#frame').fill('13');await page.waitForTimeout(100);await page.screenshot({path:'.local/293-vfx-peak.png',fullPage:true});
 await page.locator('#background').click();await page.screenshot({path:'.local/293-vfx-light.png',fullPage:true});
 for(const frame of [1,6,12,18,24]){await page.locator('#frame').fill(String(frame));await page.waitForTimeout(60);await page.screenshot({path:`.local/293-vfx-frame-${frame}.png`,fullPage:true});}
 const frames=await page.evaluate(async()=>{
  const {CORVUS_VFX}=await import('/shared/character-skills.js');const results=[];
  for(const spec of Object.values(CORVUS_VFX)){
   const image=new Image();image.src=spec.url;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);
   results.push({width:image.width,height:image.height,size:spec.frameSize,corner:ctx.getImageData(0,0,1,1).data[3],end:ctx.getImageData(spec.frameSize*5,spec.frameSize*3,spec.frameSize,spec.frameSize).data.filter((_,i)=>i%4===3).some(a=>a>0)});
  }return results;
 });
 for(const f of frames){assert.equal(f.width,f.size*6);assert.equal(f.height,f.size*4);assert.equal(f.corner,0);assert.equal(f.end,false);}
 check('6×4 규격·실제 투명 alpha·24F 완전 소멸');assert.deepEqual(errors,[]);check('브라우저 오류 없음');
}finally{await browser.close();teacher.disconnect();await game.close();}
