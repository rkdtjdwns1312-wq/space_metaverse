import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClassroomServer} from '../server/app.js';
import {CONSTELLATIONS} from '../shared/constellations.js';
import {monstersOf} from '../server/monsters.js';
const game=createClassroomServer({teacherKey:'avatar-size-browser-key',studentHours:false}),{port}=await game.listen(),url='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const socket=io(url,{transports:['websocket'],reconnection:false});
const checks=[],errors=[];const check=t=>{checks.push(t);console.log(t);};await mkdir('.local',{recursive:true});
try{
 await new Promise((r,j)=>{socket.once('connect',r);socket.once('connect_error',j);});
 const created=await socket.timeout(5000).emitWithAck('room:create',{teacherKey:'avatar-size-browser-key',allowedNames:['별이']});
 const page=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#join-code').fill(created.room.code);await page.locator('#nickname').fill('별이');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=game.store.rooms.get(created.room.code),p=[...room.players.values()].find(p=>p.role==='student'),publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 await page.waitForFunction(()=>document.getElementById('world').dataset.selfSize==='32');check('LV1 소행성 기준크기32');
 for(const constellation of CONSTELLATIONS)for(const level of [2,3,4,5]){
  Object.assign(p.avatar,{constellationId:constellation.id,level});publish();
  const expected=[0,32,80,92,105.8,121.67][level];
  await page.waitForFunction(({expected,name})=>{const c=document.getElementById('world');return Math.abs(Number(c.dataset.selfSize)-expected)<.001&&c.dataset.selfLabelDetail.includes(name);},{expected,name:constellation.name});
  assert.ok(await page.locator('#world').evaluate(c=>Number(c.dataset.selfLabelY)>=Number(c.dataset.selfRenderY)+Number(c.dataset.selfSize)/2));
 }
 check('16종×4단계 크기80/92/105.8/121.67·이름표아래배치');
 const image=await page.evaluate(async()=>{const {constellationOf}=await import('/shared/constellations.js');const img=new Image();img.src=constellationOf('pisces',5).sprite;await img.decode();return img.naturalWidth;});assert.ok(image>0);
 await page.waitForTimeout(100);await page.screenshot({path:'.local/163-lv5-avatar.png'});
 const x=p.x;await page.locator('#world').focus();await page.keyboard.down('d');await page.waitForTimeout(250);await page.keyboard.up('d');assert.ok(p.x>x);check('큰아바타WASD이동유지');
 const m=monstersOf(room).get('star-crab');Object.assign(m,{hp:20,dx:0,dy:0,nextDirectionAt:Infinity,nextAttackAt:Infinity});
 Object.assign(p.avatar,{level:2,constellationId:'gemini'});Object.assign(p,{mapId:m.mapId,x:m.x-62,y:m.y+50,facing:{x:1,y:0}});publish();await page.locator('#minimap-title').filter({hasText:'별의 시작점 1'}).waitFor();await page.locator('#world').focus();await page.keyboard.press('q');
 await page.waitForFunction(()=>document.getElementById('world').dataset.lastAttackRadius==='36');assert.equal(m.hp,19);await page.screenshot({path:'.local/163-q-range.png'});check('기존42px밖50px거리명중·서버판정반경36과원형표시일치');
 await page.setViewportSize({width:390,height:844});Object.assign(p.avatar,{level:5});publish();await page.waitForFunction(()=>Math.abs(Number(document.getElementById('world').dataset.selfSize)-121.67)<.001);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'.local/163-large-mobile.png'});check('390px대형아바타·가로넘침없음');
 assert.deepEqual(errors,[]);await writeFile('.local/163-browser-result.json',JSON.stringify({checks,errors},null,2));
}finally{socket.disconnect();await browser.close();await game.close();}
