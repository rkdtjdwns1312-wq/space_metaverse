import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {MONSTER_TYPES,MONSTER_SPAWNS,MONSTER_HP,MONSTER_COMBAT} from '../shared/monsters.js';
import {ENERGY_DROPS} from '../shared/energy-drops.js';
import {LV2_MONSTER_ART,lv2MonsterPose} from '../client/lv2-monster-art.js';
import {mapOf} from '../shared/config.js';
import {monstersOf,monsterViews,moveMonsters,strikeMonster,MONSTER_RULES} from '../server/monsters.js';
import {createClassroomServer} from '../server/app.js';
import {onParadiseFloor} from '../shared/paradise-floor.js';

function singleMonster(id){
  const room={};monstersOf(room,0,()=>0);const monster=room.monsters.get(id);
  const map=mapOf(monster.mapId);Object.assign(monster,{x:map.width/2,y:map.height/2,spawnX:map.width/2,spawnY:map.height/2});
  room.monsters=new Map([[id,monster]]);return {room,monster};
}

test('각 맵 5마리·별의기원3 3용이+2사조·방별 독립 몬스터 상태',()=>{
  const a={},b={};assert.equal(monstersOf(a).size,43);
  assert.equal(new Set(MONSTER_TYPES.map(m=>m.shape)).size,14);
  for(const map of ['star-origin-1','star-origin-2','star-origin-3','moon-garden','sun-paradise','sun-paradise-2','moon-paradise-1','moon-paradise-2'])
    assert.equal(monsterViews(a).filter(m=>m.mapId===map).length,5);
  const second=monsterViews(a).filter(m=>m.mapId==='star-origin-2');
  assert.deepEqual(second.filter(m=>m.typeId==='star-scorpion').map(m=>m.id),['star-scorpion-1','star-scorpion-2','star-scorpion-3']);
  assert.deepEqual(second.filter(m=>m.typeId==='chameleon-star').map(m=>m.id),['chameleon-star-1','chameleon-star-2']);
  assert.equal(new Set(MONSTER_SPAWNS.map(m=>m.id)).size,43);
  assert.deepEqual(MONSTER_TYPES.filter(m=>m.mapId==='sun-paradise').map(m=>[m.id,m.level]),[['warm-star',3]]);
  assert.deepEqual(MONSTER_TYPES.filter(m=>m.mapId==='sun-paradise-2').map(m=>[m.id,m.level]),[['grown-warm-star',4]]);
  const origin3=monsterViews(a).filter(m=>m.mapId==='star-origin-3');
  assert.deepEqual(origin3.filter(m=>m.typeId==='star-dragon').map(m=>m.id),['star-dragon-1','star-dragon-2','star-dragon-3']);
  assert.deepEqual(origin3.filter(m=>m.typeId==='star-phoenix').map(m=>m.id),['star-phoenix-1','star-phoenix-2']);
  assert.deepEqual(MONSTER_TYPES.filter(m=>m.mapId==='moon-paradise-1').map(m=>[m.id,m.level]),[['cool-star',3]]);
  assert.deepEqual(MONSTER_TYPES.filter(m=>m.mapId==='moon-paradise-2').map(m=>[m.id,m.level]),[['grown-cool-star',4]]);
  for(const m of second)assert.notEqual(m.id,m.typeId,'개체 id와 종류 id는 분리되어야 합니다.');
  const one=monstersOf(a).get('star-crab'),two=monstersOf(b).get('star-crab');one.x=999;
  assert.notEqual(one.x,two.x);
});

test('두 번째 맵의 새 몬스터 설정과 체력·공격·속도·보상 규칙을 유지한다',()=>{
  const scorpion=MONSTER_TYPES.find(m=>m.id==='star-scorpion'),chameleon=MONSTER_TYPES.find(m=>m.id==='chameleon-star');
  assert.deepEqual([scorpion.name,scorpion.mapId,scorpion.level,scorpion.shape,scorpion.color],['Lv2 별전갈','star-origin-2',2,'star-scorpion','#a875d8']);
  assert.deepEqual([chameleon.name,chameleon.mapId,chameleon.level,chameleon.shape,chameleon.color],['Lv2 카멜레별','star-origin-2',2,'chameleon-star','#b8e6a1']);
  assert.equal(MONSTER_HP['star-origin-2'],100);assert.deepEqual(MONSTER_COMBAT['star-origin-2'],{power:6,defense:1,speedFactor:1.3});
  assert.deepEqual(ENERGY_DROPS.rewards[2],[6,10]);
  for(const t of [scorpion,chameleon])assert.ok(LV2_MONSTER_ART[t.shape],'실제 그림 렌더러와 종류 연결');
  const list=monsterViews({});assert.ok(list.filter(m=>m.mapId==='star-origin-2').every(m=>m.hp===100&&m.attackPower===6));
});

test('별용이·별사조와 태양·달 별 몬스터의 단계별 능력치·보상 범위가 맞다',()=>{
  const expected={
    'star-origin-1':{level:1,hp:50,power:3,defense:0,speedFactor:1,reward:[0,2]},
    'star-origin-2':{level:2,hp:100,power:6,defense:1,speedFactor:1.3,reward:[6,10]},
    'star-origin-3':{level:3,hp:300,power:10,defense:2,speedFactor:1.3*1.3,reward:[24,40]},
    'moon-garden':{level:2,hp:100,power:6,defense:1,speedFactor:1.3,reward:[6,10]},
    'sun-paradise':{level:3,hp:300,power:10,defense:2,speedFactor:1.3,reward:[24,40]},
    'sun-paradise-2':{level:4,hp:1000,power:15,defense:4,speedFactor:1.3*1.3,reward:[60,100]},
    'moon-paradise-1':{level:3,hp:300,power:10,defense:2,speedFactor:1.3,reward:[24,40]},
    'moon-paradise-2':{level:4,hp:1000,power:15,defense:4,speedFactor:1.3*1.3,reward:[60,100]}
  };
  for(const [mapId,values] of Object.entries(expected)){
    assert.equal(MONSTER_HP[mapId],values.hp);
    assert.deepEqual(MONSTER_COMBAT[mapId],{power:values.power,defense:values.defense,speedFactor:values.speedFactor});
    assert.deepEqual(ENERGY_DROPS.rewards[values.level],values.reward);
    assert.ok(MONSTER_TYPES.filter(type=>type.mapId===mapId).every(type=>type.level===values.level));
  }
  assert.deepEqual(MONSTER_TYPES.filter(type=>type.id==='warm-star'||type.id==='grown-warm-star').map(({id,mapId,level})=>[id,mapId,level]),[
    ['warm-star','sun-paradise',3],['grown-warm-star','sun-paradise-2',4]
  ]);
  assert.deepEqual(MONSTER_TYPES.filter(type=>type.id==='cool-star'||type.id==='grown-cool-star').map(({id,mapId,level})=>[id,mapId,level]),[
    ['cool-star','moon-paradise-1',3],['grown-cool-star','moon-paradise-2',4]
  ]);
  assert.deepEqual(MONSTER_TYPES.filter(type=>type.mapId==='star-origin-3').map(({id,level})=>[id,level]),[['star-dragon',3],['star-phoenix',3]]);
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
    const matches=list.filter(m=>m.mapId.startsWith('star-origin-')&&MONSTER_TYPES.find(t=>t.id===m.typeId)?.level===level);
    assert.equal(matches.length,5);assert.ok(matches.every(m=>m.radius===radius));
  }
});
test('낙원 몬스터도 Lv2→3→4 순서로 충돌 크기와 그림 크기가 커진다',()=>{
  const views=monsterViews({}),radius=id=>views.find(monster=>monster.typeId===id).radius;
  assert.equal(radius('baby-energy-star'),48);
  for(const id of ['warm-star','cool-star'])assert.equal(radius(id),96);
  for(const id of ['grown-warm-star','grown-cool-star'])assert.equal(radius(id),120);
  assert.equal(radius('noksera'),192);assert.equal(radius('leoon'),192);
});

test('3단계 대형 몬스터는 생성 직후 겹치지 않고 산책한다',()=>{
  const room={};monstersOf(room,0,()=>0);const before=monsterViews(room).filter(m=>m.mapId==='star-origin-3'&&m.radius===96).map(m=>({...m}));
  for(const m of before) for(const other of before) if(other!==m)
    assert.ok(Math.hypot(m.x-other.x,m.y-other.y)>=m.radius+other.radius+10);
  moveMonsters(room,0,()=>0);moveMonsters(room,50,()=>0);
  const after=monsterViews(room).filter(m=>m.mapId==='star-origin-3'&&m.radius===96);
  assert.ok(after.some((m,i)=>m.x!==before[i].x||m.y!==before[i].y));
});

test('모든 레벨은 2초 걷고 2초 쉬며 속도 배율만 다르다',()=>{
  for(const id of ['star-crab','star-scorpion-1','star-dragon-1','warm-star-1','grown-warm-star-1','cool-star-1','grown-cool-star-1']){
    const {room,monster:m}=singleMonster(id),factor=MONSTER_COMBAT[m.mapId].speedFactor;
    let calls=0;const random=()=>++calls===1?0:.25;
    moveMonsters(room,0,random);const start={x:m.x,y:m.y};
    for(let now=50;now<=1950;now+=50)moveMonsters(room,now,random);
    assert.equal(m.moving,true,id+' 이동 구간');
    assert.ok(Math.abs(m.x-start.x-MONSTER_RULES.speed*factor*1.95)<1e-6,id+' 레벨 속도 배율');
    assert.ok(Math.abs(m.y-start.y)<1e-6);
    moveMonsters(room,2000,random);const rest={x:m.x,y:m.y};
    assert.equal(m.moving,false,id+' 2초 휴식 시작');
    for(let now=2050;now<=3950;now+=50)moveMonsters(room,now,random);
    assert.equal(m.moving,false,id+' 휴식 유지');
    assert.deepEqual({x:m.x,y:m.y},rest,id+' 휴식 중 위치 유지');
    assert.equal(calls,1,id+' 휴식 중 방향 유지');
    moveMonsters(room,4000,random);
    assert.equal(m.moving,true,id+' 다음 이동 구간');
    assert.equal(calls,2,id+' 다음 4초 주기에만 방향 재선택');
    assert.ok(Math.abs(m.x-rest.x)<1e-6);
    assert.ok(Math.abs(m.y-rest.y-MONSTER_RULES.speed*factor*.05)<1e-6);
  }
});

test('같은 맵 몬스터는 개체별 무작위 phase로 첫 산책 시작 시각이 서로 다르다',()=>{
  const room={},offsets=[.05,.3,.55,.8,.1];let index=0;
  monstersOf(room,1000,()=>offsets[index++]??((index%19)/20));
  const firstFive=['star-crab','water-star','star-crab-2','water-star-2','star-crab-3'].map(id=>room.monsters.get(id));
  assert.equal(index,MONSTER_SPAWNS.length,'각 스폰이 독립적인 초기 phase 표본을 받는다');
  assert.equal(new Set(firstFive.map(monster=>monster.patrolPhaseOffset)).size,firstFive.length);
  for(const monster of firstFive)assert.ok(monster.patrolPhaseOffset>=0&&monster.patrolPhaseOffset<MONSTER_RULES.walkMs+MONSTER_RULES.restMs);
  moveMonsters(room,1450,()=>.25);
  assert.deepEqual(firstFive.map(monster=>monster.moving),[true,false,false,false,true],
    '같은 1450ms 시각에도 일부는 걷기 시작하고 나머지는 첫 걷기를 기다린다');
  const firstWalkStarts=firstFive.map(monster=>monster.patrolStartedAt);
  assert.equal(new Set(firstWalkStarts).size,firstFive.length,'각 개체의 첫 걷기 시작 시각이 겹치지 않는다');
});

test('산책 방향은 전방향 각도를 따르고 좌우 바라보기도 맞춘다',()=>{
  for(let octant=0;octant<8;octant++){
    const {room,monster:m}=singleMonster('star-crab'),angle=octant*Math.PI/4,start={x:m.x,y:m.y};
    moveMonsters(room,0,()=>angle/(Math.PI*2));moveMonsters(room,50,()=>0);
    const distance=MONSTER_RULES.speed*.05;
    assert.ok(Math.abs(m.x-start.x-Math.cos(angle)*distance)<1e-6,`각도 ${octant}: x`);
    assert.ok(Math.abs(m.y-start.y-Math.sin(angle)*distance)<1e-6,`각도 ${octant}: y`);
    assert.ok(Math.abs(m.dx-Math.cos(angle))<1e-6,`각도 ${octant}: dx`);
    assert.ok(Math.abs(m.dy-Math.sin(angle))<1e-6,`각도 ${octant}: dy`);
    assert.equal(m.facingX,Math.cos(angle)<-.05?-1:1,`각도 ${octant}: facingX`);
  }
});

test('휴식 중 공격받으면 몬스터가 바로 공격자를 추격한다',()=>{
  const {room,monster:m}=singleMonster('star-crab');
  room.players=new Map();
  moveMonsters(room,0,()=>0);
  for(let now=50;now<=2000;now+=50)moveMonsters(room,now,()=>0);
  assert.equal(m.moving,false);
  const p={id:'attacker',role:'student',connected:true,away:false,mapId:m.mapId,avatar:{level:1,xp:0,constellationId:null},facing:{x:1,y:0}};
  Object.assign(p,{x:m.x-62,y:m.y});room.players.set(p.id,p);
  assert.ok(strikeMonster(room,p,1,2000),'공격이 정상 등록되어야 합니다.');
  const start=m.x;moveMonsters(room,2050,()=>.5);
  assert.equal(m.targetId,p.id);assert.equal(m.moving,true);assert.ok(m.x<start,'휴식 주기를 기다리지 않고 공격자를 향해 움직입니다.');
});

test('몬스터는 맵 경계와 문 주변을 지키고 3구역에서는 뭉치지 않는다',()=>{
  const room={};monstersOf(room,0,()=>0);
  const list=monsterViews(room);
  for(const m of list)if(m.mapId.startsWith('sun-paradise')||m.mapId.startsWith('moon-paradise')){
    const map=mapOf(m.mapId);assert.equal(onParadiseFloor(map,m.x,m.y,m.radius),true,`${m.id} 낙원 바닥 안 초기 배치`);
  }
  for(const m of list.filter(monster=>monster.mapId==='star-origin-3')){
    assert.equal(onParadiseFloor(mapOf(m.mapId),m.x,m.y,m.radius),true,`${m.id} 별의 시작점3 바닥 안 초기 배치`);
  }
  for(let now=0;now<60000;now+=50){
    moveMonsters(room,now,()=>.125);
    for(const m of monsterViews(room))if(m.mapId.startsWith('sun-paradise')){
      const map=mapOf(m.mapId);assert.equal(onParadiseFloor(map,m.x,m.y,m.radius),true,`${m.id} 낙원 바닥 안 ${now}ms`);
    }
  }
  const final=monsterViews(room);
  for(const m of final){const map=mapOf(m.mapId);assert.ok(m.x>=Math.max(120,m.radius)&&m.x<=map.width-Math.max(120,m.radius)&&m.y>=Math.max(190,m.radius)&&m.y<=map.height-Math.max(190,m.radius));
    for(const other of final)if(other!==m&&m.mapId==='star-origin-3'&&other.mapId===m.mapId)assert.ok(Math.hypot(m.x-other.x,m.y-other.y)>=58-1e-6);
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
  assert.equal(packet.monsters.length,43);assert.equal(game.store.rooms.get(other.room.code).monsters.get(m.id).x<300,true);
});

test('아바타 이동 중에도 같은 위치 패킷에 각 몬스터의 새 좌표가 함께 온다',async t=>{
  const game=createClassroomServer({teacherKey:'monster-motion-test-private',studentHours:false}),address=await game.listen(),sockets=[];
  const connect=async()=>{const s=io('http://127.0.0.1:'+address.port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;};
  t.after(async()=>{for(const s of sockets)s.disconnect();await game.close();});
  const call=(s,event,data={})=>s.timeout(2000).emitWithAck(event,data);
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:'monster-motion-test-private',allowedNames:['1']});
  const student=await connect(),joined=await call(student,'room:join',{code:created.room.code,nickname:'1'});
  const room=game.store.rooms.get(created.room.code),player=room.players.get(joined.selfId);
  room.monsters=undefined;monstersOf(room,Date.now(),()=>0);
  Object.assign(player,{mapId:'star-origin-1',x:600,y:450});
  const firstMonster=game.store.rooms.get(created.room.code).monsters.get('star-crab');
  Object.assign(firstMonster,{x:600,y:450,spawnX:600,spawnY:450,patrolStartedAt:Date.now(),patrolPhaseOffset:0,patrolCycle:-1,nextDirectionAt:Date.now()});
  for(const id of ['water-star','star-crab-2','water-star-2','star-crab-3']){
    const monster=game.store.rooms.get(created.room.code).monsters.get(id);monster.x+=220;
  }
  const packets=[];student.on('world:positions',packet=>packets.push(packet));student.emit('player:input',{x:1,y:0});
  await new Promise(resolve=>setTimeout(resolve,25));
  for(let i=0;i<8;i++)await new Promise(resolve=>setTimeout(resolve,80));
  const avatarXs=packets.flatMap(packet=>packet.positions.filter(([id])=>id===joined.selfId).map(([,x])=>x));
  const monsterPoints=packets.map(packet=>packet.monsters?.find(monster=>monster.id==='star-crab'));
  assert.ok(avatarXs.length>=2&&Math.max(...avatarXs)-Math.min(...avatarXs)>1,'아바타가 움직여야 합니다.');
  assert.ok(monsterPoints.every(monster=>Number.isFinite(monster?.x)&&Number.isFinite(monster?.y))&&monsterPoints.some((monster,index)=>index>0&&Math.hypot(monster.x-monsterPoints[index-1].x,monster.y-monsterPoints[index-1].y)>.1),'아바타 이동 중 몬스터 좌표도 갱신되어야 합니다.');
});
