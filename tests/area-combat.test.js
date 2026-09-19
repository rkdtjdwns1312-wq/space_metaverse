import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {ATTACK_VISUAL} from '../shared/combat.js';
import {PLAZA_ID, RULES} from '../shared/config.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';

const key='area-combat-test-key';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function fixture(t){
  const game=createClassroomServer({studentHours:false,teacherKey:key});
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
  players[1].x=400+ATTACK_VISUAL.reach;players[1].avatar.constellationId='taurus';
  players[2].x=400+ATTACK_VISUAL.reach+RULES.radius+ATTACK_VISUAL.hitRadius+1;
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
