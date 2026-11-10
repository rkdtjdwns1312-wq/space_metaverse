import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {monstersOf} from '../server/monsters.js';
import {beginSerenaSkill,tickSerenaSkills} from '../server/serena-skills.js';
import {SERENA} from '../shared/serena.js';
import {ensureVitals} from '../server/vitals.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
let now=Date.now();const key='isolated-serena-yellow-clock',game=createClassroomServer({teacherKey:key,studentHours:false,teacherManagedAccounts:false,clock:()=>now}),{port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})}),socket=io(url,{transports:['websocket'],reconnection:false});mkdirSync('.local',{recursive:true});
try{
 await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
 const created=await socket.timeout(5000).emitWithAck('room:create',{teacherKey:key,title:'노란별 검사',allowedNames:['노란별검사']});assert(created.ok);
 const room=game.store.rooms.get(created.room.code),page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await page.locator('#student-tab').click();await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill('노란별검사');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 for(let i=0;i<14&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');
 const p=[...room.players.values()].find(p=>p.role==='student');p.avatar.level=5;p.accountKind='master';chargeHuntingStation(p,'math',now);ensureVitals(p).hp=500;
 room.serena={state:'active',monsterId:SERENA.monsterId,respawnAt:null};const boss=monstersOf(room,now).get(SERENA.monsterId);
 Object.assign(p,{mapId:boss.mapId,x:boss.x+300,y:boss.y+180,input:{x:0,y:0,at:0}});
 const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p,now));
 now=Date.now();assert(beginSerenaSkill(room,boss,'yellow',now));boss.stunUntil=now+60000;const startsAt=now;publish();
 await page.waitForFunction(()=>document.querySelector('#world').dataset.serenaMarkCount==='1');
 now=startsAt+2100;tickSerenaSkills(room,boss,now);publish();await page.waitForFunction(()=>document.querySelector('#world').dataset.serenaWarningCount==='1');
 await page.evaluate(()=>{const proto=CanvasRenderingContext2D.prototype,fillText=proto.fillText;proto.fillText=function(text,...args){if(this.canvas.id==='world'){if(text==='!')window.yellowWarningDraws++;if(/^\d+초$/.test(text))window.yellowMarkDraws++;}return fillText.call(this,text,...args);};});
 const initial={x:p.x,y:p.y},samples=[];
 for(const offset of [60000,-60000,0]){
  await page.evaluate(offset=>{window.yellowWarningDraws=window.yellowMarkDraws=0;window.realDateNow??=Date.now;Date.now=()=>window.realDateNow()+offset;},offset);publish();await page.waitForTimeout(180);
  samples.push(await page.evaluate(()=>({marks:document.querySelector('#world').dataset.serenaMarkCount,warnings:document.querySelector('#world').dataset.serenaWarningCount,warningDraws:window.yellowWarningDraws,markDraws:window.yellowMarkDraws})));
 }
 console.log('CLOCK_SAMPLES',JSON.stringify(samples));assert(samples.every(s=>s.marks==='1'&&s.warnings==='1'&&s.warningDraws>0&&s.markDraws>0),'clock skew must not hide lethal warnings');
 await page.screenshot({path:'.local/serena-yellow-warning.png'});
 p.x+=220;now=startsAt+4100;const avoided=tickSerenaSkills(room,boss,now);assert.equal(avoided.length,0);assert.equal(ensureVitals(p).hp,500);assert.equal(boss.serenaSkills.bursts[0].x,initial.x);assert.equal(boss.serenaSkills.warnings[0].x,p.x);publish();
 await page.waitForTimeout(160);await page.screenshot({path:'.local/serena-yellow-avoided.png'});
 now=startsAt+6100;const hits=tickSerenaSkills(room,boss,now);assert.equal(hits.length,1);assert.equal(hits[0].damage,500);assert.equal(ensureVitals(p).hp,0);publish();
 assert.deepEqual(errors,[]);console.log('PASS yellow: real world mark/warning under +/-60s clock skew, fixed old position explosion avoided, next stationary warning instant defeat; no JS errors');
}finally{socket.disconnect();await browser.close();await game.close();}
