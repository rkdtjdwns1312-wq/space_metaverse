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

 Object.assign(player,{mapId:'star-origin-1',x:500,y:450,facing:{x:1,y:0}});Object.assign(player.avatar,{level:4,constellationId:'corvus'});ensureVitals(player);
 const template=[...monstersOf(room).values()][0];
 const near={...template,id:'near',x:700,y:450,hp:1000,maxHp:1000,radius:20,patrolStartedAt:Date.now()+100000,nextAttackAt:Infinity,attackers:new Map(),contributors:new Map()};
 const far={...near,id:'far',x:840,attackers:new Map(),contributors:new Map()};room.monsters=new Map([[near.id,near],[far.id,far]]);
 publish();await page.waitForTimeout(400);await page.locator('#world').focus();
 await page.keyboard.press('q');await page.waitForFunction(()=>Number(document.querySelector('#world').dataset.projectileCount)>0);
 const start=Number(await page.locator('#world').getAttribute('data-projectile-x'));assert.ok(start>=player.x&&start<player.x+130);
 await page.waitForTimeout(80);const moved=Number(await page.locator('#world').getAttribute('data-projectile-x'));assert.ok(moved>start);
 await page.screenshot({path:'.local/295-q-flight.png'});
 await page.waitForFunction(()=>document.querySelector('#world').dataset.lastProjectileStop!==undefined);
 assert.ok(near.hp<1000);assert.equal(far.hp,1000);assert.ok(Number(await page.locator('#world').getAttribute('data-last-projectile-stop'))<200);
 check('실제 Q가 아바타에서 출발·이동하고 첫 몬스터에서 종료, 뒤 몬스터 무피해');
 const nearHp=near.hp,farHp=far.hp;await page.keyboard.press('e');await page.waitForTimeout(300);await page.screenshot({path:'.local/295-e-flight.png'});
 await page.waitForTimeout(1050);assert.equal(nearHp-near.hp,16);assert.equal(farHp-far.hp,16);assert.equal(room.projectiles.length,0);
 check('E 관통 깃털4개가 가까운/먼 몬스터에 각각4회 타격');
 await page.evaluate(()=>document.getElementById('avatar-dialog').showModal());await page.locator('#self-skill-slots button').nth(1).click();
 assert.equal(await page.locator('#skill-description-text').textContent(),'공격력: 200% × 4회\n쿨타임: 10초\n마나 소모: 5');
 assert.equal(await page.locator('#skill-description-text').evaluate(e=>getComputedStyle(e).whiteSpace),'pre-line');
 await page.screenshot({path:'.local/295-description.png'});check('설명창 세 줄만 표시');assert.deepEqual(errors,[]);check('브라우저 오류 없음');
}finally{await browser.close();teacher.disconnect();await game.close();}
