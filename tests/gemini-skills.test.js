import test from 'node:test';
import assert from 'node:assert/strict';
import {castGemini} from '../server/gemini-skills.js';
import {advanceProjectiles} from '../server/projectiles.js';
import {combatEnemies,damageTargets} from '../server/sagittarius-skills.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {attackPowerOf} from '../shared/combat.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {GEMINI_VFX,GEMINI_NAMES,geminiSkillOf} from '../shared/gemini-skills.js';

function setup(level=4){
  const player={id:'twins',role:'student',connected:true,away:false,mapId:'star-origin-1',x:500,y:450,
    facing:{x:1,y:0},avatar:{level,constellationId:'gemini'}};
  const room={players:new Map([[player.id,player]]),planets:new Map()};
  const size=avatarSizeOf(player),base=[...monstersOf(room).values()][0];
  const monster=(id,step)=>({...base,id,x:player.x+size*step,y:player.y,hp:1000,maxHp:1000,
    radius:20,attackers:new Map(),contributors:new Map()});
  const near=monster('near',1.5),far=monster('far',3);
  room.monsters=new Map([[near.id,near],[far.id,far]]);
  return {room,player,size,near,far};
}

test('쌍둥이자리 Q는 가로4배를 날고 첫 몬스터에서 멈춘다',()=>{
  const {room,player,size,near,far}=setup(),now=Date.now();
  const result=castGemini(room,player,now,{basic:true});
  assert.equal(result.hit.range,size*4);assert.equal(result.hit.projectiles.length,1);
  assert.equal(room.projectiles[0].piercing,false);
  advanceProjectiles(room,now+700,combatEnemies,damageTargets);
  assert.equal(near.hp,1000-attackPowerOf(4,'gemini',player));assert.equal(far.hp,1000);
});

test('E는 LV2/3/4에서 각각 200/400/600% 두 번 명중하고 모두 관통한다',()=>{
  for(const level of [2,3,4,5]){
    const {room,player,size,near,far}=setup(level),now=Date.now(),mp=ensureVitals(player).mp;
    const spec=geminiSkillOf(player),power=attackPowerOf(level,'gemini',player);
    const result=castGemini(room,player,now);
    assert.equal(mp-ensureVitals(player).mp,5);
    assert.equal(result.hit.range,size*4);
    assert.equal(result.hit.projectiles.length,2);
    assert.ok(room.projectiles.every(p=>p.piercing&&p.vfxId===`skill-lv${Math.min(level,4)}`));
    advanceProjectiles(room,now+1030,combatEnemies,damageTargets);
    const expected=1000-power*spec.multiplier*2;
    assert.equal(near.hp,expected);assert.equal(far.hp,expected);
    assert.equal(result.cooldowns[0],now+8000);
  }
});

test('마나 부족·LV1·쿨타임·사망 시 스킬 소비 없이 거부한다',()=>{
  const {room,player}=setup(),now=Date.now();
  player.avatar.level=1;assert.throws(()=>castGemini(room,player,now),/LV2/);
  player.avatar.level=4;ensureVitals(player).mp=4;
  assert.throws(()=>castGemini(room,player,now),/마나/);
  assert.equal(player.geminiCooldownUntil,undefined);
  ensureVitals(player).mp=30;castGemini(room,player,now);
  assert.throws(()=>castGemini(room,player,now+7999),/기다려/);
  assert.equal(castGemini(room,player,now+8000).ready,true);
  ensureVitals(player).hp=0;assert.throws(()=>castGemini(room,player,now+16000),/지금/);
});

test('공격·LV2·LV3·LV4의 투명 24F 시트를 모두 등록한다',()=>{
  assert.deepEqual(Object.keys(GEMINI_VFX),['attack','skill-lv2','skill-lv3','skill-lv4']);
  assert.ok(Object.values(GEMINI_VFX).every(spec=>spec.frames===24&&spec.frameSize===256));
  assert.equal(GEMINI_NAMES[4],'쌍별의 천상곡');
});
