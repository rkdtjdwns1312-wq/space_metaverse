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

 for(const [id,type,hp,mp,attack,defense] of [['aquarius','생산계',50,40,4,3],['corvus','제작계',60,60,5,2],['sagittarius','공격계',50,50,8,1],['hercules','수호계',100,40,3,5],['aries','특수계',60,40,5,3]]){
  player.transformation=null;player.battleVitals=null;Object.assign(player.avatar,{level:5,constellationId:id});ensureVitals(player);publish();
  await page.waitForTimeout(150);await page.locator('#world').focus();await page.keyboard.press('1');await page.waitForTimeout(150);
  assert.equal(player.transformation.active,true);assert.equal(ensureVitals(player).hp,hp);assert.equal(ensureVitals(player).mp,mp);
  const publicPlayer=game.store.snapshot(room,player).players.find(p=>p.id===player.id);assert.equal(publicPlayer.combat.attackPower,attack);assert.equal(publicPlayer.combat.defensePower,defense);assert.equal(publicPlayer.vitals.hp.max,hp);assert.equal(publicPlayer.vitals.mp.max,mp);
  await page.evaluate(()=>document.getElementById('avatar-dialog').showModal());await page.locator('#self-skill-slots button').nth(2).click();
  const text=await page.locator('#skill-description-text').textContent();assert.ok(text.includes('30초'));assert.ok(text.includes('300초'));assert.ok(text.includes('최대 체력 +'+(hp-40)));assert.ok(text.includes('최대 마나 +'+(mp-40)));
  if(type==='생산계')assert.ok(text.includes('쿨타임 50% 감소'));if(type==='특수계')assert.ok(text.includes('피해·회복·효과량 2배(마나 소모·쿨타임 유지)'));
  await page.screenshot({path:'.local/296-transform-'+id+'.png'});await page.locator('#skill-description-dialog button').click();await page.evaluate(()=>document.getElementById('avatar-dialog').close());
  ensureVitals(player).hp=10;ensureVitals(player).mp=10;clockShift+=5100;await page.waitForTimeout(120);assert.equal(ensureVitals(player).hp,10+hp/10);assert.equal(ensureVitals(player).mp,10+mp/10);
  clockShift+=25000;await page.waitForTimeout(120);assert.equal(player.transformation.active,false);const restored=game.store.snapshot(room,player).players.find(p=>p.id===player.id);assert.equal(restored.vitals.hp.max,40);assert.equal(restored.vitals.mp.max,40);
  check(type+' 변신 실제 수치·설명·10%회복·종료 확인');
 }
 assert.deepEqual(errors,[]);check('브라우저 오류 없음');
}finally{await browser.close();teacher.disconnect();await game.close();}
