import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {attackSagittarius,castSagittarius,advanceSagittarius,sagittariusViews} from '../server/sagittarius-skills.js';
import {ensureVitals} from '../server/vitals.js';
import {attackPowerOf,defensePowerOf} from '../shared/combat.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {monstersOf} from '../server/monsters.js';
import {toRecord} from '../server/persistent-rooms.js';

const now=100000;
function setup(level=5){
  const player={id:'archer',connected:true,role:'student',mapId:'star-origin-1',x:500,y:500,facing:{x:1,y:0},avatar:{level,constellationId:'sagittarius'}};
  const room={players:new Map([[player.id,player]]),planets:new Map()};
  const monster=[...monstersOf(room,now).values()][0];room.monsters=new Map([[monster.id,monster]]);
  Object.assign(monster,{x:700,y:500,hp:1000,maxHp:1000,radius:24});
  return {room,player,monster,power:attackPowerOf(level,'sagittarius'),size:avatarSizeOf(player)};
}
test('Q 빛의 화살은 현재 공격력100%·MP0·가로3배, MP가 0이어도 공격',()=>{
  const {room,player,monster,power,size}=setup(2);ensureVitals(player).mp=0;
  const hit=attackSagittarius(room,player,now);
  assert.equal(monster.hp,1000-power);assert.equal(ensureVitals(player).mp,0);
  assert.equal(hit.effects[0].range,size*3);assert.equal(hit.effects[0].basic,true);
  assert.equal(player.sagittariusCooldowns,undefined);
});
test('유성화살은 +5가 아닌 300%, 가로5배·MP5·쿨타임5초',()=>{
  const {room,player,monster,power,size}=setup(3);
  const hit=castSagittarius(room,player,0,now);assert.equal(monster.hp,1000-power*3);
  assert.equal(hit.effects[0].range,size*5);assert.equal(ensureVitals(player).mp,15);
  assert.throws(()=>castSagittarius(room,player,0,now+4999),/1초/);assert.equal(ensureVitals(player).mp,15);
  castSagittarius(room,player,0,now+5000);assert.equal(ensureVitals(player).mp,10);
});
test('LV·종류·슬롯·MP·사망·검은별 검증 실패 시 소모 없음',()=>{
  for(const level of [1,2,3,4]){
    const {room,player}=setup(level);const before=ensureVitals(player).mp;
    assert.throws(()=>castSagittarius(room,player,Math.max(0,level-2),now),/LV/);assert.equal(ensureVitals(player).mp,before);
  }
  const {room,player}=setup();
  for(const slot of [-1,3,4,'1','attack',{},NaN])assert.throws(()=>castSagittarius(room,player,slot,now));
  ensureVitals(player).mp=4;assert.throws(()=>castSagittarius(room,player,0,now),/마나/);
  assert.equal(ensureVitals(player).mp,4);assert.equal(player.sagittariusCooldowns,undefined);
  player.avatar.blackStar=true;assert.throws(()=>castSagittarius(room,player,0,now));
  player.avatar.blackStar=false;ensureVitals(player).hp=0;assert.throws(()=>castSagittarius(room,player,0,now));
});
test('화살 방향/사거리, 겹친 몬스터·학생 모두 명중, 자기·뒤·다른맵·면역 제외',()=>{
  const {room,player,monster,power,size}=setup(3);
  const twin={...monster,id:'second',attackers:new Map(),contributors:new Map()};room.monsters.set(twin.id,twin);
  const behind={...monster,id:'behind',x:400,attackers:new Map(),contributors:new Map()};room.monsters.set(behind.id,behind);
  const far={...monster,id:'far',x:500+size*5+24+size*.13+1,attackers:new Map(),contributors:new Map()};room.monsters.set(far.id,far);
  const peer={...player,id:'friend',x:700,avatar:{level:5,constellationId:'taurus'}};
  room.players.set(peer.id,peer);room.players.set('immune',{...peer,id:'immune',avatar:{...peer.avatar,blackStar:true}});
  room.players.set('other',{...peer,id:'other',mapId:'star-origin-2'});
  const hit=castSagittarius(room,player,0,now);
  assert.deepEqual(hit.targets.map(t=>t.monsterId),[monster.id,twin.id]);assert.deepEqual(hit.playerTargets.map(t=>t.targetId),['friend']);
  assert.equal(hit.playerTargets[0].damage,Math.max(1,power*3-defensePowerOf(5,'taurus',peer)));
  assert.equal(ensureVitals(player).hp,20);assert.equal(far.hp,1000);assert.equal(behind.hp,1000);
});
test('사냥꾼 1초마다 10회100%, 종료 피해 없음, 쿨15초',()=>{
  const {room,player,monster,power,size}=setup(4);
  castSagittarius(room,player,1,now);assert.equal(ensureVitals(player).mp,20);
  assert.equal(advanceSagittarius(room,now+999).length,0);
  const events=[];for(let i=1;i<=10;i++)events.push(...advanceSagittarius(room,now+1000*i));
  assert.equal(events.filter(e=>e.kind==='hunter-hit').length,10);assert.equal(events.at(-1).kind,'hunter-fade');assert.deepEqual(events.at(-1).targets,[]);
  assert.equal(monster.hp,1000-power*10);assert.equal(room.sagittariusCasts.size,0);
  assert.equal(advanceSagittarius(room,now+11000).length,0);
  assert.throws(()=>castSagittarius(room,player,1,now+14999));
  castSagittarius(room,player,1,now+15000);
  assert.equal([...room.sagittariusCasts.values()][0].radius,size);
});
test('사냥꾼은 가장 가까운 적을 추적하고 처치/맵이탈 후 다른 적을 고른다',()=>{
  const {room,player,monster}=setup(4);
  const other={...monster,id:'next',x:1000,attackers:new Map(),contributors:new Map()};room.monsters.set(other.id,other);
  castSagittarius(room,player,1,now);const cast=[...room.sagittariusCasts.values()][0];assert.equal(cast.targetId,monster.id);
  advanceSagittarius(room,now+100);assert.ok(cast.x>player.x);
  monster.hp=0;advanceSagittarius(room,now+2000);assert.equal(cast.targetId,'next');assert.ok(other.hp<1000);
});
test('궁극기는 전방 가장 가까운 몬스터·면적5배, 5회200%+큰화살1000%, MP20·쿨60초',()=>{
  const {room,player,monster,power,size}=setup();
  const behind={...monster,id:'behind',x:450,attackers:new Map(),contributors:new Map()};room.monsters.set(behind.id,behind);
  castSagittarius(room,player,2,now);assert.equal(ensureVitals(player).mp,20);
  const cast=[...room.sagittariusCasts.values()][0];assert.equal(cast.x,monster.x);assert.equal(cast.radius,size/2*Math.sqrt(5));
  assert.equal(advanceSagittarius(room,now+999).length,0);
  const events=[];for(let i=1;i<=5;i++)events.push(...advanceSagittarius(room,now+i*1000));
  assert.deepEqual(events.filter(e=>e.kind==='rain-hit').map(e=>e.pulseIndex),[1,2,3,4,5]);assert.equal(events.filter(e=>e.kind==='great-arrow').length,1);
  assert.equal(monster.hp,1000-power*20);assert.equal(behind.hp,1000);
  assert.throws(()=>castSagittarius(room,player,2,now+59999));castSagittarius(room,player,2,now+60000);
});
test('지대는 이동한 목표를 따라가지 않고 범위 내 여러 대상을 매초 새로 판정',()=>{
  const {room,player,monster,power}=setup();castSagittarius(room,player,2,now);monster.x=1200;
  advanceSagittarius(room,now+1000);assert.equal(monster.hp,1000);
  monster.x=700;advanceSagittarius(room,now+2000);assert.equal(monster.hp,1000-power*2);
});
test('전방 몬스터 없을 때 궁극기 MP·쿨 미소모, 다른맵 상태는 노출 안 함',()=>{
  const {room,player,monster}=setup();monster.x=400;
  assert.throws(()=>castSagittarius(room,player,2,now),/바라보는/);assert.equal(ensureVitals(player).mp,40);
  assert.equal(player.sagittariusCooldowns,undefined);monster.x=700;castSagittarius(room,player,2,now);
  assert.equal(sagittariusViews(room,'star-origin-1',now).length,1);assert.equal(sagittariusViews(room,'star-origin-2',now).length,0);
});
test('시전자 사망·맵변경·접속종료·별자리변경 때 남은 지속피해 즉시 취소',()=>{
  for(const change of [p=>ensureVitals(p).hp=0,p=>p.mapId='star-origin-2',p=>p.connected=false,p=>p.avatar.constellationId='leo']){
    const {room,player,monster}=setup();castSagittarius(room,player,2,now);change(player);
    assert.deepEqual(advanceSagittarius(room,now+5000),[]);assert.equal(monster.hp,1000);assert.equal(room.sagittariusCasts.size,0);
  }
});
test('처치 후 같은 틱의 폭발이 중복 드랍을 만들지 않고 실제 피해만 기여도 반영',()=>{
  const {room,player,monster}=setup();monster.hp=1;monster.maxHp=1;
  castSagittarius(room,player,2,now);advanceSagittarius(room,now+5000);
  assert.equal(monster.hp,0);assert.equal(monster.respawnAt,now+11000);
  assert.ok((room.energyDrops?.size||0)<=1);assert.equal(room.sagittariusCasts.size,0);
});
test('실제 소켓 위조 수치 무시·동일맵에만 효과·저장 데이터에서 전투 제외',async t=>{
  let time=now;const game=createClassroomServer({teacherKey:'sagittarius-test-only',studentHours:false,clock:()=>time});const {port}=await game.listen();
  const sockets=[];t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});
  const connect=async()=>{const s=io(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;};
  const call=(s,e,d={})=>s.timeout(3000).emitWithAck(e,d);
  const teacher=await connect(),student=await connect(),peer=await connect();
  const made=await call(teacher,'room:create',{teacherKey:'sagittarius-test-only',allowedNames:['1','2']});
  const joined=await call(student,'room:join',{code:made.room.code,nickname:'1'});await call(peer,'room:join',{code:made.room.code,nickname:'2'});
  const room=game.store.rooms.get(made.room.code),player=room.players.get(joined.selfId);
  player.avatar.level=3;player.avatar.constellationId='sagittarius';player.mapId='star-origin-1';player.x=500;player.y=500;player.facing={x:1,y:0};
  const monster=[...monstersOf(room).values()][0];monster.x=700;monster.y=500;
  let leaks=0;peer.on('sagittarius:effect',()=>leaks++);
  const result=await call(student,'combat:skill',{slot:0,power:999999,mana:0,range:999999,dx:-1});
  assert.equal(result.ok,true);assert.equal(result.targets.find(t=>t.monsterId===monster.id).damage,attackPowerOf(3,'sagittarius')*3);
  assert.equal(result.vitals.mp.current,15);assert.equal(result.effects[0].dx,1);
  assert.equal((await call(student,'combat:skill',{slot:3})).ok,false);
  ensureVitals(player).mp=0;
  const q=await call(student,'combat:attack',{power:99999});assert.equal(q.ok,true);
  assert.equal(q.effects[0].slot,'attack');assert.equal(q.vitals.mp.current,0);
  assert.equal((await call(student,'combat:attack')).ok,false);
  time+=999;assert.equal((await call(student,'combat:attack')).ok,false);
  time+=1;assert.equal((await call(student,'combat:attack')).ok,true);
  assert.equal((await call(student,'combat:skill',{slot:0})).ok,false);
  await new Promise(r=>setTimeout(r,150));assert.equal(leaks,0);
  const saved=JSON.stringify(toRecord(room));assert.ok(!saved.includes('sagittariusCooldowns'));assert.ok(!saved.includes('battleVitals'));assert.ok(!saved.includes('sagittariusCasts'));
});
