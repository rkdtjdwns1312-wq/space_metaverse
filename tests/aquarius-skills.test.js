import test from 'node:test';
import assert from 'node:assert/strict';
import {castAquarius,advanceAquarius,aquariusViews,inAquariusArea} from '../server/aquarius-skills.js';
import {aquariusSkillOf,aquariusFrameAt} from '../shared/aquarius-skills.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf} from '../shared/combat.js';
import {advanceProjectiles} from '../server/projectiles.js';
import {combatEnemies,damageTargets} from '../server/sagittarius-skills.js';

function setup(level=4){
  const p={id:'water',connected:true,role:'student',mapId:'star-origin-1',x:500,y:460,facing:{x:1,y:0},avatar:{level,constellationId:'aquarius'}};
  const room={players:new Map([[p.id,p]]),planets:new Map()};
  const monster=[...monstersOf(room).values()][0];Object.assign(monster,{x:p.x+avatarSizeOf(p)*3,y:p.y,hp:1000,maxHp:1000});room.monsters=new Map([[monster.id,monster]]);
  const ally={...p,id:'friend',x:monster.x,avatar:{level:5,constellationId:'hercules'},transformation:{active:true}};
  room.players.set(ally.id,ally);ensureVitals(ally).hp=1;
  return {room,p,monster,ally};
}
for(const level of [2,3,4,5])test(`물병 LV${level}: 5초 총 피해·회복 상한·MP10·20초 쿨타임`,()=>{
  const {room,p,monster,ally}=setup(level),stage=Math.min(4,level),spec=aquariusSkillOf(p),mp=ensureVitals(p).mp;
  castAquarius(room,p,1000);assert.equal(ensureVitals(p).mp,mp-10);
  const [view]=aquariusViews(room,p.mapId,1000);
  assert.equal(view.x,p.x+avatarSizeOf(p)*3);assert.equal(view.rx/view.ry,2);
  assert.ok(Math.abs(view.rx-avatarSizeOf(p)*(stage+1)/2*.8)<1e-9);assert.deepEqual(aquariusViews(room,'other',1000),[]);
  assert.equal('power'in view,false);assert.equal(monster.hp,1000);
  assert.deepEqual(advanceAquarius(room,1999),[]);
  for(let second=1;second<=5;second++)advanceAquarius(room,1000+second*1000);
  assert.equal(monster.hp,1000-Math.round(attackPowerOf(level,'aquarius',p)*spec.multiplier));
  assert.equal(ensureVitals(ally).hp,1+spec.healingAmount);
  assert.equal(room.aquariusCasts.size,0);assert.deepEqual(advanceAquarius(room,9000),[]);
  assert.throws(()=>castAquarius(room,p,20999),/기다려/);
  ensureVitals(p).mp=10;castAquarius(room,p,21000);
});
test('회복은 대상 최대HP50%, 죽은 학생 부활·PvP 피해 없음, 범위 이탈시 중단',()=>{
  const {room,p,monster,ally}=setup(4);ally.avatar={level:2,constellationId:'leo'};ally.transformation=null;ensureVitals(ally).hp=1;
  const dead={...ally,id:'dead',avatar:{...ally.avatar},battleVitals:undefined};ensureVitals(dead).hp=0;room.players.set(dead.id,dead);
  castAquarius(room,p,0);advanceAquarius(room,1000);assert.equal(ensureVitals(ally).hp,4);
  ally.x=0;advanceAquarius(room,2000);assert.equal(ensureVitals(ally).hp,4);
  ally.x=monster.x;advanceAquarius(room,5000);assert.equal(ensureVitals(ally).hp,13);assert.equal(ensureVitals(dead).hp,0);
});
test('시전자 사망·맵변경·접속종료·별자리변경은 지대를 취소',()=>{
  for(const change of [p=>p.mapId='other',p=>p.connected=false,p=>ensureVitals(p).hp=0,p=>p.avatar.constellationId='leo']){
    const {room,p,monster}=setup();castAquarius(room,p,1000);change(p);assert.deepEqual(advanceAquarius(room,2000),[]);assert.equal(room.aquariusCasts.size,0);assert.equal(monster.hp,1000);
  }
});
test('MP부족·LV1·바닥밖 소환은 차감/쿨타임 없이 거부',()=>{
  const {room,p}=setup();ensureVitals(p).mp=9;assert.throws(()=>castAquarius(room,p,1000),/마나/);assert.equal(p.aquariusCooldownUntil,undefined);
  ensureVitals(p).mp=10;p.x=0;p.facing={x:-1,y:0};assert.throws(()=>castAquarius(room,p,1000),/바닥/);assert.equal(ensureVitals(p).mp,10);
  p.avatar.level=1;assert.throws(()=>castAquarius(room,p,1000),/LV2/);
});
test('Q는 가로4배·무마나·현재공격력, 첫몬스터에 멈춰 뒤쪽은 무피해',()=>{
  const {room,p,monster}=setup();room.players.delete('friend');monster.x=650;
  const behind={...monster,id:'far',x:800,attackers:new Map(),contributors:new Map()};room.monsters.set('far',behind);ensureVitals(p).mp=0;
  const result=castAquarius(room,p,1000,{basic:true});assert.equal(result.hit.range,avatarSizeOf(p)*4);
  advanceProjectiles(room,1700,combatEnemies,damageTargets);
  assert.equal(monster.hp,1000-attackPowerOf(4,'aquarius',p));assert.equal(behind.hp,1000);assert.equal(ensureVitals(p).mp,0);
});
test('타원 범위는 가로가 넓고 맵분리·현재 위치 판정',()=>{
  const {room,p,monster,ally}=setup();castAquarius(room,p,0);const c=[...room.aquariusCasts.values()][0];
  assert.ok(inAquariusArea(c,{x:c.x+c.rx*.9,y:c.y}));assert.ok(!inAquariusArea(c,{x:c.x,y:c.y+c.rx*.9}));
  monster.mapId='other';ally.mapId='other';advanceAquarius(room,5000);assert.equal(monster.hp,1000);assert.equal(ensureVitals(ally).hp,1);
});
test('물병 타원 테두리에 걸친 몬스터는 맞고 완전히 벗어난 몬스터는 맞지 않는다',()=>{
  const {room,p,monster}=setup();castAquarius(room,p,0);const c=[...room.aquariusCasts.values()][0];
  monster.x=c.x+c.rx+monster.radius-.01;monster.y=c.y;
  advanceAquarius(room,1000);assert.ok(monster.hp<1000);
  monster.hp=1000;monster.x=c.x+c.rx+monster.radius+.01;
  advanceAquarius(room,2000);assert.equal(monster.hp,1000);
});
test('24F는 발동6·중간12 반복·소멸6, 5초 범위의 마지막 프레임까지 재생',()=>{
  assert.equal(aquariusFrameAt(0),0);assert.equal(aquariusFrameAt(499),5);assert.equal(aquariusFrameAt(500),6);
  assert.equal(aquariusFrameAt(1500),6);assert.equal(aquariusFrameAt(4499),17);assert.equal(aquariusFrameAt(4500),18);assert.equal(aquariusFrameAt(4999),23);
});
