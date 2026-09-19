import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClassroomServer} from '../server/app.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {PLAZA_ID} from '../shared/config.js';
const key='retaliation-ui-test-key',game=createClassroomServer({teacherKey:key,studentHours:false}),{port}=await game.listen(),url='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),sockets=[],checks=[],errors=[];
const call=(s,event,data={})=>s.timeout(5000).emitWithAck(event,data),check=t=>{checks.push(t);console.log('Battle '+checks.length+': '+t);};
const connect=async()=>{const s=io(url,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;};
await mkdir('.local',{recursive:true});
try{
 const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:key,title:'반격 시험',allowedNames:['공격자','수호친구','특수친구']});assert.ok(created.ok);
 const page=await browser.newPage({viewport:{width:1280,height:900},hasTouch:true});page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#join-code').fill(created.room.code);await page.locator('#nickname').fill('공격자');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=game.store.rooms.get(created.room.code),p=[...room.players.values()].find(p=>p.nickname==='공격자'),publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p)),m=monstersOf(room).get('rabbit');
 Object.assign(m,{x:600,y:400,dx:0,dy:0,nextDirectionAt:Date.now()+60000});Object.assign(p,{mapId:m.mapId,x:538,y:400,facing:{x:1,y:0}});Object.assign(p.avatar,{level:2,constellationId:'gemini',form:'constellation'});publish();
 await page.locator('.vitals-hp .vitals-label').filter({hasText:'HP 10/10'}).waitFor();await page.waitForTimeout(1200);assert.equal(ensureVitals(p).hp,10);assert.equal(m.targetId,null);check('공격 전 가까운 학생에게 선공하지 않음');
 await page.locator('#dock-avatar').click();assert.equal(await page.locator('#self-defense-power').textContent(),'방어력 · 0');await page.keyboard.press('Escape');
 await page.locator('#world').focus();await page.keyboard.press('q');await page.waitForFunction(()=>document.getElementById('world').dataset.lastMonsterDamage==='2');
 await page.waitForFunction(()=>document.querySelector('.vitals-hp .vitals-label').textContent!=='HP 10/10');assert.ok(ensureVitals(p).hp<=8);assert.equal(m.targetId,p.id);check('Q 후 추적·반격2·실시간 HP 감소·방어력0 표시');
 await page.keyboard.down('ArrowLeft');await page.waitForTimeout(300);await page.keyboard.up('ArrowLeft');await page.waitForTimeout(100);
 const mx=m.x,hp=ensureVitals(p).hp;await page.waitForTimeout(350);assert.ok(m.x<mx);assert.equal(ensureVitals(p).hp,hp);check('도망간 방향으로 추격·근접 밖에서는 피해 없음');
 const guardian=await connect(),special=await connect(),gj=await call(guardian,'room:join',{code:room.code,nickname:'수호친구'}),sj=await call(special,'room:join',{code:room.code,nickname:'특수친구'});
 const gp=room.players.get(gj.selfId),sp=room.players.get(sj.selfId);
 for(const [who,id] of [[gp,'leo'],[sp,'aries']]){Object.assign(who,{mapId:m.mapId,x:m.x-62,y:m.y,facing:{x:1,y:0}});Object.assign(who.avatar,{level:2,constellationId:id});}
 assert.ok((await call(guardian,'combat:attack')).target);assert.equal(m.targetId,gp.id);
 assert.ok((await call(special,'combat:attack')).target);assert.equal(m.targetId,gp.id);
 guardian.disconnect();await page.waitForTimeout(150);assert.equal(m.targetId,sp.id);
 sp.mapId=PLAZA_ID;await page.waitForTimeout(150);assert.equal(m.targetId,p.id);assert.ok(m.hp<m.maxHp);check('실제 소켓 공격자 수호→특수→나머지 우선순위·연결/맵 이탈 재선택');
 // 이미 한 번 떠난 특수계가 다시 공격하고 이탈하면 두 번째·세 번째로 집계합니다.
 for(let n=2;n<=3;n++){
   await page.waitForTimeout(460);Object.assign(sp,{mapId:m.mapId,x:m.x-62,y:m.y,facing:{x:1,y:0}});
   assert.ok((await call(special,'combat:attack')).target);sp.mapId=PLAZA_ID;await page.waitForTimeout(100);
   assert.equal(m.mapExitCount,n===3?0:n);assert.equal(m.targetId,p.id);
   assert.equal(m.hp===m.maxHp,n===3);
 }
 check('공격자 맵 이탈3회 전회복·누적 초기화·남은 공격자 계속 추적');
 // 시험 HP를1로 준비한 후 실제 몬스터 공격으로 쓰러짐과 회복을 끝까지 검증합니다.
 Object.assign(m,{x:p.x+62,y:p.y,nextAttackAt:Date.now(),lastMoveAt:Date.now()});ensureVitals(p).hp=1;publish();
 await page.locator('.vitals-hp .vitals-label').filter({hasText:'HP 0/10'}).waitFor();const still={x:p.x,y:p.y},monsterHp=m.hp;
 assert.equal(m.hp,m.maxHp);assert.equal(m.targetId,null);assert.equal(m.attackers.size,0);check('마지막 공격자 쓰러짐과 동시에 몬스터 전회복');
 await page.locator('#world').focus();await page.keyboard.down('ArrowRight');await page.waitForTimeout(150);await page.keyboard.up('ArrowRight');await page.keyboard.press('q');
 assert.equal(p.x,still.x);assert.equal(p.y,still.y);assert.equal(m.hp,monsterHp);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.local/battle-defeated-mobile.png'});check('체력0 이동·공격 중단·모바일 HP0 표시');
 await page.locator('#minimap-title').filter({hasText:'별의 기원'}).waitFor();await page.locator('.vitals-hp .vitals-label').filter({hasText:'HP 10/10'}).waitFor();assert.equal(p.mapId,PLAZA_ID);assert.equal(p.starShards,0);check('3초 뒤 광장 복귀·HP/MP 회복·재화 무차감');
 // 같은 레벨에서 계열에 따른 실제 서버 표시를 비교합니다.
 p.avatar.level=5;
 for(const [id,defense] of [['gemini',2],['aquarius',2],['sagittarius',3],['aries',3],['leo',4]]){
   p.avatar.constellationId=id;publish();await page.locator('#dock-avatar').click();await page.waitForFunction(n=>document.getElementById('self-defense-power').textContent==='방어력 · '+n,defense);await page.keyboard.press('Escape');
 }
 await page.locator('.vitals-hp .vitals-label').filter({hasText:'HP 40/40'}).waitFor();check('LV5초월체 HP40·제작/생산2·공격/특수3·수호4 방어 표시');
 assert.deepEqual(errors,[]);await writeFile('.local/retaliation-result.json',JSON.stringify({checks,errors},null,2));
}finally{sockets.forEach(s=>s.disconnect());await browser.close();await game.close();}
