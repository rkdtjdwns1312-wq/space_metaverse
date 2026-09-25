import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {ATTACK_VISUAL, attackGeometryOf} from '../shared/combat.js';
import {PLAZA_ID, RULES} from '../shared/config.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';

const key='area-combat-test-key';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function fixture(t, options={}){
  const game=createClassroomServer({studentHours:false,teacherKey:key,...options});
  const address=await game.listen();
  const url=`http://127.0.0.1:${address.port}`;
  const sockets=[];
  t.after(async()=>{for(const socket of sockets)socket.disconnect();await game.close();});
  const connect=async()=>{
    const socket=io(url,{transports:['websocket'],forceNew:true,reconnection:false});
    sockets.push(socket);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
    return socket;
  };
  const call=(socket,event,data={})=>socket.timeout(3000).emitWithAck(event,data);
  return {game,connect,call};
}

test('실제 소켓 공격은 겹친 몹 2마리와 학생 2명을 모두 맞히고 서버 대상만 사용한다',async t=>{
  const {game,connect,call}=await fixture(t);
  const teacher=await connect();
  const created=await call(teacher,'room:create',{teacherKey:key,title:'범위 전투',allowedNames:['1','2','3']});
  const a=await connect(),b=await connect(),c=await connect();
  const ja=await call(a,'room:join',{code:created.room.code,nickname:'1'});
  const jb=await call(b,'room:join',{code:created.room.code,nickname:'2'});
  const room=game.store.rooms.get(created.room.code);
  const attacker=room.players.get(ja.selfId);
  const jc=await call(c,'room:join',{code:created.room.code,nickname:'3'});
  const targetB=room.players.get(jb.selfId),targetC=room.players.get(jc.selfId);
  Object.assign(targetC,{mapId:'star-origin-1',x:462,y:400});targetC.avatar.level=2;
  for(const player of [attacker,targetB])Object.assign(player,{mapId:'star-origin-1',x:400,y:400}),player.avatar.level=2;
  targetB.x=462;targetB.y=400;
  attacker.facing={x:1,y:0};
  const monsters=[...monstersOf(room).values()].filter(m=>m.mapId==='star-origin-1').slice(0,2);
  monsters.forEach((monster,index)=>Object.assign(monster,{x:400+ATTACK_VISUAL.reach+index*10,y:400,hp:20,maxHp:20}));
  const forged=await call(a,'combat:attack',{power:99999,radius:99999,targets:[targetB.id],mapId:PLAZA_ID,dx:-1,dy:0});
  assert.equal(forged.ok,true);
  assert.deepEqual(forged.playerTargets.map(hit=>hit.targetId),[targetB.id,targetC.id]);
  assert.deepEqual(forged.targets.map(hit=>hit.monsterId),monsters.map(monster=>monster.id));
  assert.equal(ensureVitals(targetB).hp,9);assert.equal(ensureVitals(targetC).hp,9);
  assert.deepEqual(monsters.map(monster=>monster.hp),[19,19]);
  assert.equal(ensureVitals(attacker).hp,10);
});

test('범위 전투는 자신·다른 방·다른 맵·범위 밖·검은별·사망 학생을 제외하고 방어력을 적용한다',async t=>{
  const {game,connect,call}=await fixture(t);
  const teacher=await connect(), otherTeacher=await connect();
  const first=await call(teacher,'room:create',{teacherKey:key,title:'A',allowedNames:['1','2','3','4','5','6']});
  const second=await call(otherTeacher,'room:create',{teacherKey:key,title:'B',allowedNames:['1']});
  const sockets=await Promise.all([1,2,3,4,5,6].map(()=>connect()));
  const joins=await Promise.all(sockets.map((socket,index)=>call(socket,'room:join',{code:first.room.code,nickname:String(index+1)})));
  const room=game.store.rooms.get(first.room.code), attacker=room.players.get(joins[0].selfId);
  const players=joins.map(join=>room.players.get(join.selfId));
  players.forEach(player=>{player.mapId='star-origin-1';player.x=400;player.y=400;player.avatar.level=3;});
  players[1].x=400+attackGeometryOf(attacker).reach;players[1].avatar.constellationId='taurus';
  players[2].x=400+attackGeometryOf(attacker).reach+RULES.radius+attackGeometryOf(attacker).radius+1;
  players[3].avatar.blackStar=true;players[5].mapId=PLAZA_ID;
  ensureVitals(players[4]).hp=0;ensureVitals(players[4]).defeatedAt=Date.now();
  attacker.facing={x:1,y:0};
  const other=await connect();const joinedOther=await call(other,'room:join',{code:second.room.code,nickname:'1'});
  const otherPlayer=game.store.rooms.get(second.room.code).players.get(joinedOther.selfId);
  Object.assign(otherPlayer,{mapId:'star-origin-1',x:400+ATTACK_VISUAL.reach,y:400});
  const result=await call(sockets[0],'combat:attack');
  assert.deepEqual(result.playerTargets.map(hit=>hit.targetId),[players[1].id]);
  assert.equal(ensureVitals(players[1]).hp,18);
  assert.equal(ensureVitals(players[2]).hp,20);
  assert.equal(ensureVitals(players[3]).hp,20);
  assert.equal(ensureVitals(players[4]).hp,0);assert.equal(ensureVitals(players[5]).hp,20);
  assert.equal(ensureVitals(otherPlayer).hp,1);
});

test('공격 쿨다운은 중복을 막고 스킬은 같은 서버 대상 목록만 알리며 HP를 바꾸지 않는다',async t=>{
  const {game,connect,call}=await fixture(t);
  const teacher=await connect(),a=await connect(),b=await connect();
  const created=await call(teacher,'room:create',{teacherKey:key,title:'스킬',allowedNames:['1','2']});
  const ja=await call(a,'room:join',{code:created.room.code,nickname:'1'}),jb=await call(b,'room:join',{code:created.room.code,nickname:'2'});
  const room=game.store.rooms.get(created.room.code),attacker=room.players.get(ja.selfId),target=room.players.get(jb.selfId);
  [attacker,target].forEach(player=>{
    Object.assign(player,{mapId:'star-origin-1',x:500,y:500});
    player.avatar.level=2;
  });
  target.x=500+ATTACK_VISUAL.reach;attacker.facing={x:1,y:0};
  const before=ensureVitals(target).hp;
  const first=await call(a,'combat:attack');
  assert.equal(first.ok,true);
  assert.equal((await call(a,'combat:attack')).ok,false);
  await wait(1010);
  const event=new Promise(resolve=>b.once('combat:hit',resolve));
  const skill=await call(a,'combat:skill',{radius:99999,targetIds:['forged'],power:99999});
  assert.equal(skill.ok,true);
  assert.equal(ensureVitals(target).hp,before-1);
  assert.deepEqual(skill.ready,false);
  const hit=await event;assert.equal(hit.kind,'skill');assert.deepEqual(hit.playerTargetIds,[target.id]);
  assert.equal((await call(a,'combat:skill',{targets:['forged']})).ok,false);
});

for (const [role,level,size,power,radius] of [
  ['student',2,80,1,36], ['student',3,92,2,41.4], ['student',4,105.8,3,47.61],
  ['student',5,121.67,4,54.7515], ['teacher',6,96,99999,43.2]
]) test(`${role} LV${level}: 소켓 Q/E 크기별 사거리·반경·대각선 시작점·경계 판정·위조 무시`,async t=>{
  // In-memory room and a fixed clock keep movement/retaliation from changing boundary fixtures.
  const now=Date.now();
  const {game,connect,call}=await fixture(t,{clock:()=>now});
  const teacher=await connect();
  const created=await call(teacher,'room:create',{teacherKey:key,allowedNames:['1','2','3']});
  assert.equal(created.ok,true,created.error);
  const sockets=await Promise.all([1,2,3].map(()=>connect()));
  const joins=await Promise.all(sockets.map((socket,i)=>call(socket,'room:join',{code:created.room.code,nickname:String(i+1)})));
  for(const joined of joins)assert.equal(joined.ok,true,joined.error);
  const room=game.store.rooms.get(created.room.code);
  const attacker=room.players.get(role==='teacher'?created.selfId:joins[0].selfId);
  const actor=role==='teacher'?teacher:sockets[0];
  const targets=joins.slice(1).map(join=>room.players.get(join.selfId));
  Object.assign(attacker,{mapId:'star-origin-1',x:600,y:500,facing:{x:.6,y:.8}});
  Object.assign(attacker.avatar,{level,constellationId:'aries'});
  const reach=62*size/80,originOffset=size/2;
  const center={x:600+.6*reach,y:500+.8*reach};
  targets.forEach((p,i)=>{
    Object.assign(p,{mapId:attacker.mapId,x:center.x+radius+RULES.radius+(i===0?-.01:.01),y:center.y});
    Object.assign(p.avatar,{level:5,constellationId:'aries'});
  });
  const monsters=[...monstersOf(room,now).values()].filter(m=>m.mapId===attacker.mapId).slice(0,2);
  room.monsters=new Map(monsters.map(m=>[m.id,m]));
  monsters.forEach((m,i)=>Object.assign(m,{
    x:center.x+radius+m.radius+(i===0?-.01:.01),y:center.y,hp:20,maxHp:20,
    dx:0,dy:0,lastMoveAt:now,nextDirectionAt:Infinity,nextAttackAt:Infinity
  }));
  const before=targets.map(p=>ensureVitals(p).hp),mp=ensureVitals(attacker).mp;
  const spoof={reach:99999,radius:99999,originOffset:99999,power:0,cooldownMs:0,
    role:'teacher',level:6,x:0,y:0,dx:-1,dy:0,facing:{x:-1,y:0},mapId:PLAZA_ID,
    playerId:targets[1].id,targets:[targets[1].id,monsters[1].id],targetIds:[targets[1].id]};
  const nextHit=()=>once(actor,'combat:hit',{signal:AbortSignal.timeout(3000)});
  const checkGeometry=hit=>{
    assert.equal(hit.playerId,attacker.id);
    assert.equal(hit.mapId,attacker.mapId);
    assert.deepEqual([hit.x,hit.y,hit.dx,hit.dy],[600,500,.6,.8]);
    assert.ok(Math.abs(hit.reach-reach)<1e-10);
    assert.ok(Math.abs(hit.radius-radius)<1e-10);
    assert.ok(Math.abs(hit.originOffset-originOffset)<1e-10);
    // The event supplies the client with the body-edge launch point, not the target center.
    assert.ok(Math.abs(hit.x+hit.dx*hit.originOffset-(600+.6*originOffset))<1e-10);
    assert.ok(Math.abs(hit.y+hit.dy*hit.originOffset-(500+.8*originOffset))<1e-10);
    assert.notEqual(hit.originOffset,hit.reach);
  };
  const skillEvent=nextHit();
  const skill=await call(actor,'combat:skill',spoof);
  assert.equal(skill.ok,true,skill.error);assert.equal(skill.ready,false);
  const [skillHit]=await skillEvent;
  checkGeometry(skillHit);assert.equal(skillHit.kind,'skill');
  assert.deepEqual(skillHit.playerTargetIds,[targets[0].id]);
  assert.deepEqual(skillHit.monsterTargetIds,[monsters[0].id]);
  assert.deepEqual(targets.map(p=>ensureVitals(p).hp),before);
  assert.deepEqual(monsters.map(m=>m.hp),[20,20]);
  assert.equal(ensureVitals(attacker).mp,mp);
  assert.equal((await call(actor,'combat:skill',spoof)).ok,false);

  const attackEvent=nextHit();
  const attack=await call(actor,'combat:attack',spoof);
  assert.equal(attack.ok,true,attack.error);
  const [attackHit]=await attackEvent;checkGeometry(attackHit);
  assert.equal(attackHit.power,power);assert.equal(attackHit.durationMs,340);
  assert.deepEqual(attack.playerTargets.map(p=>p.targetId),[targets[0].id]);
  assert.deepEqual(attack.targets.map(m=>m.monsterId),[monsters[0].id]);
  assert.equal(attack.playerTargets[0].damage,Math.max(1,power-3));
  assert.equal(attack.targets[0].damage,power);
  assert.equal(ensureVitals(targets[0]).hp,Math.max(0,before[0]-Math.max(1,power-3)));
  assert.equal(ensureVitals(targets[1]).hp,before[1]);
  assert.equal(monsters[0].hp,Math.max(0,20-power));assert.equal(monsters[1].hp,20);
  assert.equal((await call(actor,'combat:attack',spoof)).ok,false);
});
