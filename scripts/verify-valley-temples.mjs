// 임시 교실에서 다리를 실제 키보드로 걸어 진화·구매를 확인합니다.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClassroomServer} from '../server/app.js';
import {MAP,VALLEY,PLAZA_ID,VALLEY_ID,RULES} from '../shared/config.js';
import {onValleyFloor} from '../shared/valley-layout.js';
const key='valley-temple-browser-private',game=createClassroomServer({teacherKey:key,studentHours:false});
const url='http://127.0.0.1:'+(await game.listen()).port;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const socket=io(url,{transports:['websocket'],reconnection:false});
const errors=[],checks=[],check=text=>{checks.push(text);console.log(text);};
await mkdir('.local',{recursive:true});
try{
 await new Promise((r,j)=>{socket.once('connect',r);socket.once('connect_error',j);});
 const created=await socket.timeout(5000).emitWithAck('room:create',{teacherKey:key,allowedNames:['검증별']});assert.ok(created.ok);
 const page=await browser.newPage({viewport:{width:1440,height:960}});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#join-code').fill(created.room.code);await page.locator('#nickname').fill('검증별');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=game.store.rooms.get(created.room.code),p=[...room.players.values()].find(p=>p.role==='student');
 const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 const gate=MAP.objects.find(o=>o.id==='gate-valley');Object.assign(p,{mapId:PLAZA_ID,x:gate.x,y:gate.y-60,starShards:10});Object.assign(p.avatar,{level:2,constellationId:'gemini',xp:19});publish();
 await page.waitForTimeout(200);await page.locator('#world').focus();await page.keyboard.press('f');
 await page.waitForFunction(()=>document.querySelector('#map-caption').textContent.includes('은하수'));
 assert.equal(p.mapId,VALLEY_ID);assert.ok(onValleyFloor(VALLEY,p.x,p.y,RULES.radius));check('광장 아래 문으로 은하수계곡 입구에 안전하게 도착');
 async function walk(x,y){
   await page.locator('#world').focus();const held=new Set(),start=Date.now();
   try{while(Math.hypot(p.x-x,p.y-y)>19&&Date.now()-start<12000){
     const dx=x-p.x,dy=y-p.y,want=new Set();if(Math.abs(dx)>8)want.add(dx>0?'ArrowRight':'ArrowLeft');if(Math.abs(dy)>8)want.add(dy>0?'ArrowDown':'ArrowUp');
     for(const k of held)if(!want.has(k)){await page.keyboard.up(k);held.delete(k);}for(const k of want)if(!held.has(k)){await page.keyboard.down(k);held.add(k);}
     await page.waitForTimeout(40);assert.ok(onValleyFloor(VALLEY,p.x,p.y,RULES.radius),'걷는 중 바닥 경계 준수');
   }assert.ok(Math.hypot(p.x-x,p.y-y)<20,'실제 키보드 도착 '+JSON.stringify({x:p.x,y:p.y,target:[x,y]}));}
   finally{for(const k of held)await page.keyboard.up(k);}
 }
 await walk(1200,420);await page.screenshot({path:'.local/263-valley-entrance.png'});
 // 대각선 방향을 계속 누르지 않고 직선 다리의 중심선을 촘촘히 따라갑니다.
 async function bridge(from,to){for(let n=1;n<=12;n++)await walk(from.x+(to.x-from.x)*n/12,from.y+(to.y-from.y)*n/12);}
 await bridge({x:1200,y:420},{x:1750,y:726});await walk(1750,920);await walk(1920,920);await walk(1920,885);
 await page.screenshot({path:'.local/263-growth-temple.png'});await page.keyboard.press('f');await page.locator('#growth-dialog').waitFor({state:'visible'});
 await page.locator('#growth-amount').fill('1');await page.locator('#growth-buy').click();await page.waitForFunction(()=>document.querySelector('#growth-info').textContent.includes('20'));
 assert.equal(p.avatar.xp,20);assert.equal(p.starShards,9);check('오른쪽 다리 실제 보행·성장의 별에서 1파편=1XP 구매');
 await page.locator('#growth-close').click();await walk(1920,920);await walk(1750,920);await walk(1750,726);await bridge({x:1750,y:726},{x:1200,y:420});
 await bridge({x:1200,y:420},{x:650,y:726});await walk(650,920);await walk(480,920);await walk(480,885);
 await page.screenshot({path:'.local/263-evolution-temple.png'});await page.keyboard.press('f');await page.locator('#evolution-dialog').waitFor({state:'visible'});
 await page.locator('#evolution-evolve').click();await page.locator('#evolution-yes').click();
 await page.waitForFunction(()=>document.querySelector('#evolution-summary').textContent.includes('LV3'));
 assert.equal(p.avatar.level,3);assert.equal(p.avatar.xp,0);check('왼쪽 다리 실제 보행·진화 확인 후 LV3/XP0');
 await page.locator('#evolution-header-close').click();await walk(480,920);await walk(650,920);await walk(650,726);await bridge({x:650,y:726},{x:1200,y:420});await walk(1200,150);await page.keyboard.press('f');
 await page.waitForFunction(()=>document.querySelector('#map-caption').textContent.includes('별의 기원'));assert.equal(p.mapId,PLAZA_ID);check('두 신전에서 입구 다리로 되돌아와 광장 복귀');
 await page.setViewportSize({width:390,height:844});Object.assign(p,{mapId:VALLEY_ID,x:1200,y:420});publish();await page.waitForTimeout(200);await page.screenshot({path:'.local/263-valley-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);check('390px 화면 넘침 없음');
 assert.deepEqual(errors,[]);await writeFile('.local/263-valley-result.json',JSON.stringify({checks,errors},null,2));
}finally{socket.disconnect();await browser.close();await game.close();}
