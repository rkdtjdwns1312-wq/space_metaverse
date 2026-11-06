import test from 'node:test';
import assert from 'node:assert/strict';
import {attackPowerOf} from '../shared/combat.js';
import {DARK_STAR_SKILLS} from '../shared/dark-star-skills.js';
import {monstersOf,moveMonsters} from '../server/monsters.js';
import {advanceSigilProjectiles,resolveSigilHit,SIGIL_SHOT_INTERVAL_MS} from '../server/sigil-projectiles.js';
import {advanceProjectiles} from '../server/projectiles.js';
import {combatEnemies,damageTargets} from '../server/sagittarius-skills.js';
import {ensureVitals} from '../server/vitals.js';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {huntingCycle,HUNTING_STATION_MS} from '../shared/hunting-time.js';

const START=1000;

for(const role of ['student','teacher'])test(`인장 실제 명중 ${role}: 피해·기여·추적과 반격을 등록한다`,()=>{
 const {room,p}=fixture();p.role=role;
 const template=[...monstersOf({...room,monsters:undefined},START).values()].find(m=>m.mapId===p.mapId);
 const monster={...template,id:'target',x:700,y:450,hp:10000,maxHp:10000,radius:24,lastMoveAt:START,
  attackers:new Map(),contributors:new Map(),teacherRetaliation:new Set()};room.monsters.set(monster.id,monster);
 p.sigilNextShotAt=START;assert.equal(advanceSigilProjectiles(room,START).length,1);
 const hit=advanceProjectiles(room,START+1000,combatEnemies,resolveSigilHit)[0].targets[0];
 assert.ok(hit.damage>0);assert.equal(monster.targetId,p.id);assert.equal(monster.contributors.get(p.id),hit.damage);assert(monster.attackers.has(p.id));
 const x=monster.x;moveMonsters(room,START+1100,()=>.99);assert(monster.x<x);
 p.x=monster.x-50;p.y=monster.y;const hp=ensureVitals(p).hp;
 const reply=moveMonsters(room,START+2000,()=>.99);assert(reply.some(h=>h.targetId===p.id));assert(ensureVitals(p).hp<hp);
});

test('고스트 교사의 인장 명중은 고스트를 추적하지 않는다',()=>{
 const {room,p}=fixture();p.role='teacher';p.avatar.teacherPreview=true;
 const monster=[...monstersOf({...room,monsters:undefined},START).values()].find(m=>m.mapId===p.mapId);room.monsters.set(monster.id,monster);
 const hit=resolveSigilHit(room,p,[{kind:'monster',entity:monster}],1,START);assert.equal(hit.targets.length,1);assert.equal(monster.targetId,null);
});
function fixture(){
  const p={id:'sigil',role:'student',connected:true,away:false,mapId:'star-origin-1',x:500,y:450,
    facing:{x:1,y:0},avatar:{level:5,constellationId:'aquarius'},equipmentSlots:['primordial-star-sigil',null,null]};
  const friend={id:'friend',role:'student',connected:true,away:false,mapId:p.mapId,x:560,y:450,
    avatar:{level:4,constellationId:'aquarius'},equipmentSlots:[null,null,null]};
  const room={players:new Map([[p.id,p],[friend.id,friend]]),planets:new Map(),monsters:new Map()};
  return {p,friend,room};
}
test('검은별 인장은 몬스터가 없을 때 발동하지 않고, 등장한 적에게만 5초 간격으로 원본 구체를 발사한다',()=>{
  const {p,friend,room}=fixture();
  assert.deepEqual(advanceSigilProjectiles(room,START),[]);
  assert.equal(p.sigilNextShotAt,START+SIGIL_SHOT_INTERVAL_MS);
  assert.deepEqual(advanceSigilProjectiles(room,START+SIGIL_SHOT_INTERVAL_MS),[]);
  assert.equal(p.sigilNextShotAt,START+SIGIL_SHOT_INTERVAL_MS);
  const template=[...monstersOf({...room,monsters:undefined},START).values()].find(m=>m.mapId===p.mapId);
  const monster={...template,id:'target',x:650,y:450,hp:1000,maxHp:1000,radius:20,
    attackers:new Map(),contributors:new Map()};
  room.monsters.set(monster.id,monster);
  const friendHp=ensureVitals(friend).hp;
  const launched=advanceSigilProjectiles(room,START+SIGIL_SHOT_INTERVAL_MS+1);
  assert.equal(launched.length,1);
  assert.equal(room.projectiles[0].power,attackPowerOf(5,'aquarius',p)*2.5);
  assert.equal(room.projectiles[0].width,DARK_STAR_SKILLS.basic.radius);
  assert.equal(room.projectiles[0].durationMs,DARK_STAR_SKILLS.basic.durationMs);
  assert.deepEqual(advanceSigilProjectiles(room,START+SIGIL_SHOT_INTERVAL_MS+2),[]);
  const hits=advanceProjectiles(room,START+SIGIL_SHOT_INTERVAL_MS+1001,combatEnemies,damageTargets);
  assert.equal(hits[0].targets[0].monsterId,monster.id);
  assert.equal(hits[0].targets[0].damage,Math.round(room.projectiles[0]?.power??attackPowerOf(5,'aquarius',p)*2.5));
  assert.equal(ensureVitals(friend).hp,friendHp);
  assert.equal(room.projectiles.length,0);
  assert.deepEqual(advanceSigilProjectiles(room,p.sigilNextShotAt-1),[]);
  assert.equal(advanceSigilProjectiles(room,p.sigilNextShotAt).length,1);
  p.equipmentSlots=[null,null,null];
  const cancelled=advanceProjectiles(room,p.sigilNextShotAt+1,combatEnemies,damageTargets);
  assert.equal(cancelled[0].targets.length,0);
  assert.equal(room.projectiles.length,0);
});

test('실제 서버 틱은 몬스터가 나타난 뒤 인장 탄환을 같은 맵 플레이어에게 전송한다',async t=>{
  let now=1_000_000;const key='sigil-projectile-test',game=createClassroomServer({teacherKey:key,studentHours:false,clock:()=>now});
  const {port}=await game.listen(),sockets=[];
  t.after(async()=>{sockets.forEach(socket=>socket.disconnect());await game.close();});
  const connect=async()=>{
    const socket=io(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false});sockets.push(socket);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;
  };
  const call=(socket,event,data={})=>socket.timeout(3000).emitWithAck(event,data);
  const teacher=await connect(),student=await connect(),created=await call(teacher,'room:create',{teacherKey:key,allowedNames:['인장검사']}),
    joined=await call(student,'room:join',{code:created.room.code,nickname:'인장검사'}),room=game.store.rooms.get(created.room.code),
    player=room.players.get(joined.selfId);
  Object.assign(player,{mapId:'star-origin-1',x:500,y:450,equipmentSlots:['primordial-star-sigil',null,null],
    huntingTime:{cycle:huntingCycle(now),remainingMs:HUNTING_STATION_MS,chargedStations:['math']}});
  Object.assign(player.avatar,{level:5,constellationId:'aquarius'});
  room.monsters=new Map();
  await new Promise(resolve=>setTimeout(resolve,120));
  assert.equal(player.mapId,'star-origin-1');
  now+=SIGIL_SHOT_INTERVAL_MS;
  await new Promise(resolve=>setTimeout(resolve,120));
  assert.equal(room.projectiles?.length||0,0);
  assert.equal(player.sigilNextShotAt,now);
  const template=[...monstersOf({...room,monsters:undefined},now).values()].find(m=>m.mapId===player.mapId);
  room.monsters.set('socket-target',{...template,id:'socket-target',x:650,y:450,hp:1000,maxHp:1000});
  const shown=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('인장 탄환 전송 없음')),2000);
    student.on('world:positions',state=>{
      const shot=state.projectiles?.find(projectile=>projectile.kind==='sigil-black-star');
      if(shot){clearTimeout(timeout);resolve(shot);}
    });
  });
  now++;
  const shot=await shown;
  assert.equal(shot.mapId,player.mapId);
  assert.equal(shot.size,DARK_STAR_SKILLS.basic.radius*2);
  now+=1000;await new Promise(resolve=>setTimeout(resolve,150));
  const monster=room.monsters.get('socket-target');assert.equal(monster.targetId,player.id);assert(monster.contributors.get(player.id)>0);
  const teacherPlayer=room.players.get(created.selfId);
  player.mapId='space-plaza';Object.assign(teacherPlayer,{mapId:'star-origin-1',x:500,y:450,equipmentSlots:['primordial-star-sigil',null,null],sigilNextShotAt:now});
  Object.assign(monster,{x:650,y:450,hp:10000,maxHp:10000});
  await new Promise(resolve=>setTimeout(resolve,150));now+=1000;await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(monster.targetId,teacherPlayer.id);assert(monster.teacherRetaliation.has(teacherPlayer.id));assert(monster.contributors.get(teacherPlayer.id)>0);
});

test('enhanced sigil snapshots its damage and remains valid in flight',()=>{
 const {p,room}=fixture();p.equipmentSlots=['primordial-star-sigil+9',null,null];
 const template=[...monstersOf({...room,monsters:undefined},START).values()].find(m=>m.mapId===p.mapId);
 const monster={...template,id:'enhanced-target',x:650,y:450,hp:10000,maxHp:10000,radius:20,attackers:new Map(),contributors:new Map()};room.monsters.set(monster.id,monster);
 p.sigilNextShotAt=START;assert.equal(advanceSigilProjectiles(room,START).length,1);
 assert.equal(room.projectiles[0].power,attackPowerOf(5,'aquarius',p)*11.5);assert.equal(p.sigilNextShotAt,START+5000);
 const hits=advanceProjectiles(room,START+1000,combatEnemies,resolveSigilHit);assert.equal(hits[0].targets[0].monsterId,monster.id);assert.equal(monster.targetId,p.id);
});
