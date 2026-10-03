import test from 'node:test';
import assert from 'node:assert/strict';
import {castAries,advanceAriesClouds,ariesCloudViews} from '../server/aries-skills.js';
import {advanceProjectiles} from '../server/projectiles.js';
import {combatEnemies,damageTargets} from '../server/sagittarius-skills.js';
import {monstersOf,damageMonster,moveMonsters,monsterViews} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {attackPowerOf} from '../shared/combat.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {ARIES_VFX,ARIES_NAMES,ariesSkillOf,ariesFrameAt} from '../shared/aries-skills.js';

function setup(level=4){
  const player={id:'ram',role:'student',connected:true,away:false,mapId:'star-origin-1',x:500,y:450,
    facing:{x:1,y:0},avatar:{level,constellationId:'aries'}};
  const room={players:new Map([[player.id,player]]),planets:new Map()};
  const size=avatarSizeOf(player),base=[...monstersOf(room).values()][0];
  const monster=(id,step)=>({...base,id,x:player.x+size*step,y:player.y,hp:1000,maxHp:1000,
    radius:20,attackers:new Map(),contributors:new Map()});
  const targets=[1.5,2.5,3.5,4.5].map((step,i)=>monster('monster-'+i,step));
  room.monsters=new Map(targets.map(m=>[m.id,m]));
  return {room,player,size,targets};
}

test('양털뭉치 Q는 가로4배에서 첫 몬스터에 멈춘다',()=>{
  const {room,player,size,targets}=setup(),now=Date.now();
  const shot=castAries(room,player,now,{basic:true});
  assert.equal(shot.hit.range,size*4);assert.equal(room.projectiles.length,1);
  advanceProjectiles(room,now+700,combatEnemies,damageTargets);
  assert.equal(targets[0].hp,1000-attackPowerOf(4,'aries',player));
  assert.equal(targets[1].hp,1000);
});

test('E는 가까운 최대3마리를 잠재워 5초 정지·피해 2배 후 LV별 200/400/600% 종료 피해',()=>{
  for(const level of [2,3,4,5]){
    const {room,player,size,targets}=setup(level),now=Date.now(),mp=ensureVitals(player).mp;
    const power=attackPowerOf(level,'aries',player),spec=ariesSkillOf(player);
    const result=castAries(room,player,now);
    assert.equal(mp-ensureVitals(player).mp,10);
    assert.deepEqual(result.targetIds,targets.slice(0,3).map(m=>m.id));
    assert.equal(ariesCloudViews(room,player.mapId,now).length,3);
    assert.equal(ariesCloudViews(room,player.mapId,now)[0].size,size*spec.cloudScale);
    assert.equal(monsterViews(room,now)[0].sleeping,true);
    const x=targets[0].x;moveMonsters(room,now+1000,()=>.2);
    assert.equal(targets[0].x,x);assert.equal(targets[0].moving,false);
    const hit=damageMonster(room,targets[0],player,power,now+1000);
    assert.equal(hit.damage,power*2);
    assert.equal(advanceAriesClouds(room,now+4999).length,0);
    const ends=advanceAriesClouds(room,now+5000);
    assert.equal(ends.length,3);
    assert.equal(ends[0].damage,power*spec.finishMultiplier);
    assert.equal(targets[0].hp,1000-power*2-power*spec.finishMultiplier);
    assert.equal(targets[3].hp,1000);
    assert.equal(monsterViews(room,now+5000)[0].sleeping,false);
  }
});

test('대상 없음·마나 부족·쿨타임·LV1·사망은 소비 없이 거부한다',()=>{
  const {room,player}=setup(),now=Date.now();
  player.avatar.level=1;assert.throws(()=>castAries(room,player,now),/LV2/);
  player.avatar.level=4;ensureVitals(player).mp=9;
  assert.throws(()=>castAries(room,player,now),/마나/);
  assert.equal(player.ariesCooldownUntil,undefined);
  ensureVitals(player).mp=30;room.monsters=new Map();
  assert.throws(()=>castAries(room,player,now),/몬스터/);
  assert.equal(ensureVitals(player).mp,30);
  const restored=setup().room.monsters;room.monsters=restored;
  castAries(room,player,now);assert.throws(()=>castAries(room,player,now+19999),/기다려/);
  assert.equal(castAries(room,player,now+20000).ready,true);
  ensureVitals(player).hp=0;assert.throws(()=>castAries(room,player,now+40000),/지금/);
});

test('공격·LV2·LV3·LV4의 24F 시트와 구름 유지 프레임',()=>{
  assert.deepEqual(Object.keys(ARIES_VFX),['attack','skill-lv2','skill-lv3','skill-lv4']);
  assert.ok(Object.values(ARIES_VFX).every(spec=>spec.frames===24&&spec.frameSize===256));
  assert.equal(ARIES_NAMES[4],'영원의 꿈');
  assert.equal(ariesFrameAt(0),0);assert.equal(ariesFrameAt(600),6);
  assert.equal(ariesFrameAt(4500),18);assert.equal(ariesFrameAt(4999),23);
});
