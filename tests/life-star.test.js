import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP,PLAZA_ID} from '../shared/config.js';
import {ensureVitals,damagePlayer} from '../server/vitals.js';
import {startLifeRecovery,advanceLifeRecovery} from '../server/life-star.js';
import {createClassroomServer} from '../server/app.js';
import {io} from 'socket.io-client';

const star=MAP.objects.find(o=>o.kind==='life-star');
function fixture(){
  const player={id:'p',connected:true,role:'student',avatar:{level:5},mapId:PLAZA_ID,x:star.x,y:star.y};
  Object.assign(ensureVitals(player),{hp:10,mp:0});
  return {player,room:{players:new Map([[player.id,player]])}};
}
test('생명의별은 광장 정중앙의 작은 통과 가능한 흰 별이다',()=>{
  assert.deepEqual([star.x,star.y],[MAP.templeCenter.x,MAP.templeCenter.y-16]);
  assert.equal(star.name,'생명의별');assert.equal(star.color,'#ffffff');assert.equal(star.passable,true);
});
test('서버 시간 10초에 걸쳐 HP/MP 회복, 5초는 절반, 10초 직전은 미완료',()=>{
  const {player,room}=fixture();startLifeRecovery(player,1000);
  assert.deepEqual(advanceLifeRecovery(room,1999),[]);
  assert.deepEqual([player.battleVitals.hp,player.battleVitals.mp],[10,0]);
  advanceLifeRecovery(room,6000);assert.deepEqual([player.battleVitals.hp,player.battleVitals.mp],[25,20]);
  advanceLifeRecovery(room,10999);assert.ok(player.battleVitals.hp<40&&player.battleVitals.mp<40);
  assert.equal(advanceLifeRecovery(room,11000)[0].complete,true);
  assert.deepEqual([player.battleVitals.hp,player.battleVitals.mp],[40,40]);
  assert.equal(player.battleVitals.lifeRecovery,undefined);assert.deepEqual(advanceLifeRecovery(room,12000),[]);
});
test('원거리·다른 맵·접속 해제·사망 중의 시작 거부, 반복 요청 중첩 없음',()=>{
  const {player}=fixture();player.x=star.x+1000;assert.throws(()=>startLifeRecovery(player,0),/가까이/);
  player.x=star.x;player.mapId='star-street';assert.throws(()=>startLifeRecovery(player,0),/가까이/);
  player.mapId=PLAZA_ID;player.connected=false;assert.throws(()=>startLifeRecovery(player,0),/입장/);
  player.connected=true;player.battleVitals.hp=0;assert.throws(()=>startLifeRecovery(player,0),/회복/);
  player.battleVitals.hp=10;startLifeRecovery(player,100);startLifeRecovery(player,5000);
  assert.equal(player.battleVitals.lifeRecovery.startedAt,100);
});
test('회복은 개인별이고 걸으며 계속되며, 추가 피해에도 정해진 끝에 최대치 회복',()=>{
  const {player,room}=fixture(),other=fixture().player;other.id='q';room.players.set('q',other);
  startLifeRecovery(player,0);advanceLifeRecovery(room,5000);
  player.x+=200;damagePlayer(player,10,6000);advanceLifeRecovery(room,10000);
  assert.deepEqual([player.battleVitals.hp,player.battleVitals.mp],[40,40]);assert.equal(other.battleVitals.hp,10);
});
for(const reason of ['disconnect','death','evolution'])test(`회복 중 ${reason}이면 이전 회복 취소`,()=>{
  const {player,room}=fixture();startLifeRecovery(player,0);
  if(reason==='disconnect')player.connected=false;
  if(reason==='death')player.battleVitals.hp=0;
  if(reason==='evolution')player.avatar.level=4;
  assert.deepEqual(advanceLifeRecovery(room,5000),[]);
  assert.equal(player.battleVitals.lifeRecovery,undefined);
});
test('실제 소켓은 인증과 거리를 검증하고 위조 회복량/대상을 무시한다',async t=>{
  let now=1000;const game=createClassroomServer({teacherKey:'life-star-test-key',studentHours:false,clock:()=>now});
  const address=await game.listen(),socket=io(`http://127.0.0.1:${address.port}`,{transports:['websocket'],reconnection:false});
  t.after(async()=>{socket.disconnect();await game.close();});
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  const call=(event,data={})=>socket.timeout(3000).emitWithAck(event,data);
  assert.equal((await call('life-star:recover')).ok,false);
  const created=await call('room:create',{teacherKey:'life-star-test-key',title:'생명의별',allowedNames:['1']});
  const room=game.store.rooms.get(created.room.code),player=room.players.get(created.selfId);
  Object.assign(player,{x:10,y:10});assert.equal((await call('life-star:recover')).ok,false);
  Object.assign(player,{x:star.x,y:star.y});const value=ensureVitals(player);value.hp=1;value.mp=0;
  assert.equal((await call('life-star:recover',{hp:99999999,mp:99999999,duration:0,playerId:'fake'})).ok,true);
  assert.deepEqual([value.hp,value.mp],[1,0]);
  const done=new Promise(resolve=>socket.once('life-star:complete',resolve));now+=10000;
  await Promise.race([done,new Promise((_,reject)=>setTimeout(()=>reject(Error('회복 완료 이벤트 없음')),2000))]);
  assert.deepEqual([value.hp,value.mp],[99999,40]);
});
