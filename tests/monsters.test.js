import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {MONSTER_TYPES} from '../shared/monsters.js';
import {monstersOf,monsterViews,moveMonsters,MONSTER_RULES} from '../server/monsters.js';
import {createClassroomServer} from '../server/app.js';

test('세 맵별 5종·서로 다른 형태·방별 독립된 몬스터 상태',()=>{
  const a={},b={};assert.equal(monstersOf(a).size,15);
  assert.equal(new Set(MONSTER_TYPES.map(m=>m.shape)).size,15);
  for(const map of ['star-origin-1','star-origin-2','star-origin-3'])assert.equal(monsterViews(a).filter(m=>m.mapId===map).length,5);
  const one=monstersOf(a).get('rabbit'),two=monstersOf(b).get('rabbit');one.x=999;
  assert.notEqual(one.x,two.x);
});

test('산책은 1초에 한 번 방향을 선택하고 사이에는 일정한 속도로 움직인다',()=>{
  const room={};monstersOf(room,0);let calls=0;
  const random=()=>{calls++;return calls<=15?0:.25;};
  moveMonsters(room,0,random);const m=monstersOf(room).get('rabbit'),start=m.x;
  for(let now=50;now<=950;now+=50)moveMonsters(room,now,random);
  assert.equal(calls,15);assert.ok(Math.abs(m.x-start-MONSTER_RULES.speed*.95)<1e-6);
  moveMonsters(room,1000,random);assert.equal(calls,30);assert.ok(m.dy>.99);
});

test('몬스터는 맵 경계와 문 주변을 벗어나지 않고 같은 위치에 뭉치지 않는다',()=>{
  const room={};monstersOf(room,0);
  for(let now=0;now<60000;now+=50)moveMonsters(room,now,()=>.125);
  const list=monsterViews(room);
  for(const m of list){assert.ok(m.x>=120&&m.x<=1080&&m.y>=190&&m.y<=710);
    for(const other of list)if(other!==m&&other.mapId===m.mapId)assert.ok(Math.hypot(m.x-other.x,m.y-other.y)>=58-1e-6);
  }
});

test('실제 소켓 정보 요청은 방·지도·근접을 검사하고 사냥 및 보상을 허용하지 않는다',async t=>{
  const game=createClassroomServer({teacherKey:'monster-test-only-private',studentHours:false}),address=await game.listen(),sockets=[];
  const connect=async()=>{const s=io('http://127.0.0.1:'+address.port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;};
  t.after(async()=>{for(const s of sockets)s.disconnect();await game.close();});
  const call=(s,event,data={})=>s.timeout(2000).emitWithAck(event,data),teacher=await connect(),stranger=await connect();
  assert.equal((await call(stranger,'monster:info',{monsterId:'rabbit'})).ok,false);
  const r=await call(teacher,'room:create',{teacherKey:'monster-test-only-private',allowedNames:['1']}),student=await connect();
  const j=await call(student,'room:join',{code:r.room.code,nickname:'1'});assert.ok(j.ok);
  const room=game.store.rooms.get(r.room.code),p=room.players.get(j.selfId),m=monstersOf(room).get('rabbit');
  assert.equal((await call(student,'monster:info',{monsterId:m.id})).ok,false);
  Object.assign(p,{mapId:m.mapId,x:1100,y:700});assert.equal((await call(student,'monster:info',{monsterId:m.id})).ok,false);
  Object.assign(p,{x:m.x+35,y:m.y});const info=await call(student,'monster:info',{monsterId:m.id,xp:999,level:6});
  assert.ok(info.ok);assert.equal(info.huntingEnabled,false);assert.equal(info.monster.name,'토끼자리');
  const before=structuredClone(p.avatar);await assert.rejects(student.timeout(250).emitWithAck('monster:hunt',{monsterId:m.id,xp:999}));assert.deepEqual(p.avatar,before);
  const otherTeacher=await connect(),other=await call(otherTeacher,'room:create',{teacherKey:'monster-test-only-private',allowedNames:['2']});
  const packet=await new Promise(resolve=>otherTeacher.once('world:monsters',resolve));
  assert.equal(packet.monsters.length,15);assert.equal(game.store.rooms.get(other.room.code).monsters.get(m.id).x<300,true);
});
