import test from 'node:test';
import assert from 'node:assert/strict';
import {monstersOf,moveMonsters,damageMonster,MONSTER_RULES} from '../server/monsters.js';
import {mapOf,RULES} from '../shared/config.js';
import {onParadiseFloor} from '../shared/paradise-floor.js';
import {ensureVitals} from '../server/vitals.js';
import {advanceCapricorn} from '../server/capricorn-skills.js';

const START=1000;
function fixture(id='star-crab'){
  const room={players:new Map(),planets:new Map()},monster=monstersOf(room,START,()=>0).get(id),map=mapOf(monster.mapId);
  room.monsters=new Map([[monster.id,monster]]);
  const gate=map.objects.find(o=>o.kind==='gate'&&o.y<map.height/2);
  const player={id:'archer',role:'student',connected:true,mapId:map.id,x:gate.x,y:gate.y-30,avatar:{level:5,constellationId:'sagittarius'}};
  assert.ok(onParadiseFloor(map,player.x,player.y,RULES.radius),'문 뒤 학생 위치는 실제 바닥 안이다');
  Object.assign(monster,{x:gate.x,y:Math.max(190,monster.radius),lastMoveAt:START});
  assert.ok(onParadiseFloor(map,monster.x,monster.y,monster.radius),'몬스터 정지 위치는 실제 바닥 안이다');
  room.players.set(player.id,player);damageMonster(room,monster,player,10,START);
  const damagedHp=monster.hp;
  const tick=(from,to)=>{for(let at=from;at<=to;at+=100)moveMonsters(room,at,()=>.99);};
  return {room,monster,player,map,damagedHp,tick};
}

test('실제 문 뒤 학생에게 3초 연속 못 가면 HP·기여도·추적 초기화, 보상 없이 재공격 가능',()=>{
  const {room,monster,player,damagedHp,tick}=fixture();
  tick(START+100,START+2900);assert.equal(monster.hp,damagedHp);assert.equal(monster.targetId,player.id);
  assert.equal(monster.moving,false);
  tick(START+3000,START+3000);
  assert.equal(monster.hp,monster.maxHp);assert.equal(monster.targetId,null);assert.equal(monster.attackers.size,0);
  assert.equal(monster.contributors.size,0);assert.equal(monster.nextAttackAt,0);assert.equal(monster.respawnAt,null);
  assert.equal(room.energyDrops?.size||0,0);assert.equal(room.pendingBossDeaths?.size||0,0);
  player.y=350;damageMonster(room,monster,player,10,START+3100);const y=monster.y;
  moveMonsters(room,START+3200,()=>.99);assert.equal(monster.targetId,player.id);assert.ok(monster.y>y);
  assert.equal(monster.hp,damagedHp);assert.equal(monster.contributors.get(player.id),10);
});

test('문에서 잠깐 막혔다가 이동하면 누적을 지우고, 다시 막혀도 새 3초를 기다린다',()=>{
  const {room,monster,player,damagedHp,tick}=fixture();
  tick(START+100,START+2000);player.y=350;tick(START+2100,START+2100);
  assert.equal(monster.blockedChase,null);assert.equal(monster.hp,damagedHp);
  player.y=66;monster.y=190;
  tick(START+2200,START+5000);assert.equal(monster.hp,damagedHp);
  tick(START+5100,START+5100);assert.equal(monster.hp,monster.maxHp);
});

test('계속 맞거나 저주 피해를 받아도 막힘 시간은 유지하고 초기화 뒤 남은 독/저주는 취소',()=>{
  const {room,monster,player}=fixture();
  monster.capricornCurses=new Map([[player.id,{ownerId:player.id,endsAt:START+10000,nextTickAt:START+1000,power:1}]]);
  monster.combatPoison={mapId:monster.mapId,candidates:new Map(),nextTickAt:START+4000};
  for(let at=START+100;at<=START+3000;at+=100){
    if(at%500===0)damageMonster(room,monster,player,1,at);
    advanceCapricorn(room,at);moveMonsters(room,at,()=>.99);
  }
  assert.equal(monster.hp,monster.maxHp);assert.equal(monster.targetId,null);
  assert.equal(monster.combatPoison,null);assert.equal(monster.capricornCurses.size,0);
  advanceCapricorn(room,START+10000);assert.equal(monster.hp,monster.maxHp);assert.equal(monster.targetId,null);
});

for(const status of ['sleepUntil','stunUntil','pendingAttack'])test(`${status} 정지는 문 막힘으로 세지 않고 이전 누적도 끊는다`,()=>{
  const {room,monster,damagedHp,tick}=fixture();
  tick(START+100,START+2000);
  if(status==='pendingAttack')monster.pendingAttack={x:700,y:800,radius:10,startsAt:START+2000,endsAt:START+6000,dx:0,dy:1,reach:0};
  else monster[status]=START+6000;
  tick(START+2100,START+5900);assert.equal(monster.hp,damagedHp);assert.equal(monster.blockedChase,null);
  tick(START+6000,START+7000);assert.equal(monster.hp,damagedHp);
});

test('문 근처라도 근접 공격이 닿으면 초기화하지 않고 정상 공격한다',()=>{
  const {room,monster,player,damagedHp,tick}=fixture();player.y=monster.y-60;
  for(let at=START+100;at<=START+5000;at+=100){ensureVitals(player).hp=40;moveMonsters(room,at,()=>.99);}
  assert.equal(monster.hp,damagedHp);assert.equal(monster.targetId,player.id);assert.equal(monster.blockedChase,null);
  assert.ok(monster.nextAttackAt>START);
});

test('추적 대상 변경과 긴 서버 시간 점프는 이전 막힘 시간을 재사용하지 않는다',()=>{
  const {room,monster,player,damagedHp,tick}=fixture();tick(START+100,START+2000);
  const other={...structuredClone(player),id:'other'};room.players.set(other.id,other);damageMonster(room,monster,other,1,START+2000);
  tick(START+2100,START+2100);assert.equal(monster.blockedChase.elapsedMs,100);
  moveMonsters(room,START+60000,()=>.99);assert.equal(monster.hp,damagedHp-1);assert.equal(monster.blockedChase.elapsedMs,200);
  assert.equal(MONSTER_RULES.blockedChaseMs,3000);
});

test('몬스터끼리의 몸 충돌은 문 뒤 지형 막힘 회복을 일으키지 않는다',()=>{
  const room={players:new Map(),planets:new Map()},monster=monstersOf(room,START,()=>0).get('star-dragon-1'),map=mapOf(monster.mapId);
  Object.assign(monster,{x:map.width/2,y:map.height/2});
  const blocker={...structuredClone(monster),id:'blocker',x:monster.x+monster.radius*2+10,stunUntil:START+10000};
  room.monsters=new Map([[monster.id,monster],[blocker.id,blocker]]);
  const player={id:'archer',role:'student',connected:true,mapId:map.id,x:blocker.x+150,y:monster.y,avatar:{level:5,constellationId:'sagittarius'}};
  room.players.set(player.id,player);damageMonster(room,monster,player,10,START);const hp=monster.hp;
  for(let at=START+100;at<=START+5000;at+=100)moveMonsters(room,at,()=>.99);
  assert.equal(monster.hp,hp);assert.equal(monster.targetId,player.id);assert.equal(monster.blockedChase,null);assert.equal(monster.moving,false);
});
