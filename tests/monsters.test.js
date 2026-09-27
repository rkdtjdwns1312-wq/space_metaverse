import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {MONSTER_TYPES,MONSTER_SPAWNS,MONSTER_HP,MONSTER_COMBAT} from '../shared/monsters.js';
import {ENERGY_DROPS} from '../shared/energy-drops.js';
import {LV2_MONSTER_ART,lv2MonsterPose} from '../client/lv2-monster-art.js';
import {mapOf} from '../shared/config.js';
import {monstersOf,monsterViews,moveMonsters,MONSTER_RULES} from '../server/monsters.js';
import {createClassroomServer} from '../server/app.js';

test('세 맵별 5마리·첫 맵 두 종류·방별 독립된 몬스터 상태',()=>{
  const a={},b={};assert.equal(monstersOf(a).size,15);
  assert.equal(new Set(MONSTER_TYPES.map(m=>m.shape)).size,9);
  for(const map of ['star-origin-1','star-origin-2','star-origin-3'])assert.equal(monsterViews(a).filter(m=>m.mapId===map).length,5);
  const second=monsterViews(a).filter(m=>m.mapId==='star-origin-2');
  assert.deepEqual(second.filter(m=>m.typeId==='star-scorpion').map(m=>m.id),['star-scorpion-1','star-scorpion-2','star-scorpion-3']);
  assert.deepEqual(second.filter(m=>m.typeId==='chameleon-star').map(m=>m.id),['chameleon-star-1','chameleon-star-2']);
  assert.equal(new Set(MONSTER_SPAWNS.map(m=>m.id)).size,15);
  for(const m of second)assert.notEqual(m.id,m.typeId,'개체 id와 종류 id는 분리되어야 합니다.');
  const one=monstersOf(a).get('star-crab'),two=monstersOf(b).get('star-crab');one.x=999;
  assert.notEqual(one.x,two.x);
});

test('두 번째 맵의 새 몬스터 설정과 체력·공격·속도·보상 규칙을 유지한다',()=>{
  const scorpion=MONSTER_TYPES.find(m=>m.id==='star-scorpion'),chameleon=MONSTER_TYPES.find(m=>m.id==='chameleon-star');
  assert.deepEqual([scorpion.name,scorpion.mapId,scorpion.level,scorpion.shape,scorpion.color],['Lv2 별전갈','star-origin-2',2,'star-scorpion','#a875d8']);
  assert.deepEqual([chameleon.name,chameleon.mapId,chameleon.level,chameleon.shape,chameleon.color],['Lv2 카멜레별','star-origin-2',2,'chameleon-star','#b8e6a1']);
  assert.equal(MONSTER_HP['star-origin-2'],40);assert.deepEqual(MONSTER_COMBAT['star-origin-2'],{power:3,speedFactor:1.3});
  assert.deepEqual(ENERGY_DROPS.rewards[2],[6,10]);
  for(const t of [scorpion,chameleon])assert.ok(LV2_MONSTER_ART[t.shape],'실제 그림 렌더러와 종류 연결');
  const list=monsterViews({});assert.ok(list.filter(m=>m.mapId==='star-origin-2').every(m=>m.hp===40&&m.attackPower===3));
});

test('LV2 공격 자세는 서버 이벤트 동안만 전환되고 종료 시 대기로 돌아간다',()=>{
  const attack={startedAt:1000,durationMs:600};
  assert.equal(lv2MonsterPose(5000,null).active,false);
  assert.equal(lv2MonsterPose(999,attack).active,false);
  assert.equal(lv2MonsterPose(1120,attack).frame,1);
  assert.equal(lv2MonsterPose(1330,attack).frame,2);
  assert.equal(lv2MonsterPose(1490,attack).frame,3);
  assert.equal(lv2MonsterPose(1600,attack).frame,0);
});

test('별의 시작점 단계별 몬스터 크기는 1단계 기준 1·2·4배다',()=>{
  const list=monsterViews({});
  for(const [level,radius] of [[1,24],[2,48],[3,96]]) {
    const matches=list.filter(m=>MONSTER_TYPES.find(t=>t.id===m.typeId)?.level===level);
    assert.equal(matches.length,5);assert.ok(matches.every(m=>m.radius===radius));
  }
});

test('3단계 대형 몬스터는 생성 직후 겹치지 않고 산책한다',()=>{
  const room={};monstersOf(room,0);const before=monsterViews(room).filter(m=>m.radius===96).map(m=>({...m}));
  for(const m of before) for(const other of before) if(other!==m)
    assert.ok(Math.hypot(m.x-other.x,m.y-other.y)>=m.radius+other.radius+10);
  moveMonsters(room,0,()=>0);moveMonsters(room,50,()=>0);
  const after=monsterViews(room).filter(m=>m.radius===96);
  assert.ok(after.some((m,i)=>m.x!==before[i].x||m.y!==before[i].y));
});

test('산책은 1초에 한 번 방향을 선택하고 사이에는 일정한 속도로 움직인다',()=>{
  const room={};room.monsters=new Map([...monstersOf(room,0)].filter(([,m])=>m.mapId==='star-origin-1'));let calls=0;
  const random=()=>{calls++;return calls<=5?0:.25;};
  moveMonsters(room,0,random);const m=monstersOf(room).get('star-crab'),start=m.x;
  for(let now=50;now<=950;now+=50)moveMonsters(room,now,random);
  assert.equal(calls,5);assert.ok(Math.abs(m.x-start-MONSTER_RULES.speed*.95)<1e-6);
  moveMonsters(room,1000,random);assert.equal(calls,10);assert.ok(m.dy>.99);
});

test('몬스터는 맵 경계와 문 주변을 지키고 3구역에서는 뭉치지 않는다',()=>{
  const room={};monstersOf(room,0);
  for(let now=0;now<60000;now+=50)moveMonsters(room,now,()=>.125);
  const list=monsterViews(room);
  for(const m of list){const map=mapOf(m.mapId);assert.ok(m.x>=Math.max(120,m.radius)&&m.x<=map.width-Math.max(120,m.radius)&&m.y>=Math.max(190,m.radius)&&m.y<=map.height-Math.max(190,m.radius));
    for(const other of list)if(other!==m&&m.mapId==='star-origin-3'&&other.mapId===m.mapId)assert.ok(Math.hypot(m.x-other.x,m.y-other.y)>=58-1e-6);
  }
});

test('폐지된 몬스터 정보·사냥 요청은 근접 여부와 무관하게 실행하지 않는다',async t=>{
  const game=createClassroomServer({teacherKey:'monster-test-only-private',studentHours:false}),address=await game.listen(),sockets=[];
  const connect=async()=>{const s=io('http://127.0.0.1:'+address.port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;};
  t.after(async()=>{for(const s of sockets)s.disconnect();await game.close();});
  const call=(s,event,data={})=>s.timeout(2000).emitWithAck(event,data),teacher=await connect(),stranger=await connect();
  assert.equal((await call(stranger,'monster:info',{monsterId:'star-crab'})).ok,false);
  const r=await call(teacher,'room:create',{teacherKey:'monster-test-only-private',allowedNames:['1']}),student=await connect();
  const j=await call(student,'room:join',{code:r.room.code,nickname:'1'});assert.ok(j.ok);
  const room=game.store.rooms.get(r.room.code),p=room.players.get(j.selfId),m=monstersOf(room).get('star-crab');
  assert.equal((await call(student,'monster:info',{monsterId:m.id})).ok,false);
  Object.assign(p,{mapId:m.mapId,x:1100,y:700});assert.equal((await call(student,'monster:info',{monsterId:m.id})).ok,false);
  Object.assign(p,{x:m.x+35,y:m.y});const info=await call(student,'monster:info',{monsterId:m.id,xp:999,level:6});
  assert.equal(info.ok,false);assert.match(info.error,/Q 공격키/);
  const before=structuredClone(p.avatar);await assert.rejects(student.timeout(250).emitWithAck('monster:hunt',{monsterId:m.id,xp:999}));assert.deepEqual(p.avatar,before);
  const otherTeacher=await connect(),other=await call(otherTeacher,'room:create',{teacherKey:'monster-test-only-private',allowedNames:['2']});
  const packet=await new Promise(resolve=>otherTeacher.once('world:positions',resolve));
  assert.equal(packet.monsters.length,15);assert.equal(game.store.rooms.get(other.room.code).monsters.get(m.id).x<300,true);
});

test('아바타 이동 중에도 같은 위치 패킷에 각 몬스터의 새 좌표가 함께 온다',async t=>{
  const game=createClassroomServer({teacherKey:'monster-motion-test-private',studentHours:false}),address=await game.listen(),sockets=[];
  const connect=async()=>{const s=io('http://127.0.0.1:'+address.port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;};
  t.after(async()=>{for(const s of sockets)s.disconnect();await game.close();});
  const call=(s,event,data={})=>s.timeout(2000).emitWithAck(event,data);
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:'monster-motion-test-private',allowedNames:['1']});
  const student=await connect(),joined=await call(student,'room:join',{code:created.room.code,nickname:'1'});
  const room=game.store.rooms.get(created.room.code),player=room.players.get(joined.selfId);
  Object.assign(player,{mapId:'star-origin-1',x:600,y:450});
  const packets=[];student.on('world:positions',packet=>packets.push(packet));
  const input=setInterval(()=>student.emit('player:input',{x:1,y:0}),80);
  try{
    await new Promise((resolve,reject)=>{
      let check;
      const deadline=setTimeout(()=>{clearInterval(check);reject(new Error('동시 이동 패킷을 받지 못했어요.'));},2000);
      check=setInterval(()=>{if(packets.length>=8){clearInterval(check);clearTimeout(deadline);resolve();}},20);
    });
  }finally{clearInterval(input);student.emit('player:input',{x:0,y:0});}
  const avatarXs=packets.flatMap(packet=>packet.positions.filter(([id])=>id===joined.selfId).map(([,x])=>x));
  const monsterPoints=packets.map(packet=>packet.monsters?.find(monster=>monster.id==='star-crab'));
  assert.ok(avatarXs.length>=2&&Math.max(...avatarXs)-Math.min(...avatarXs)>1,'아바타가 움직여야 합니다.');
  assert.ok(monsterPoints.every(monster=>Number.isFinite(monster?.x)&&Number.isFinite(monster?.y))&&monsterPoints.some((monster,index)=>index>0&&Math.hypot(monster.x-monsterPoints[index-1].x,monster.y-monsterPoints[index-1].y)>.1),'아바타 이동 중 몬스터 좌표도 갱신되어야 합니다.');
});
