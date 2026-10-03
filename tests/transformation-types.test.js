import test from 'node:test';
import assert from 'node:assert/strict';
import {transformationBonus,transformationProfile,transformedSkill,TRANSFORMATION_TYPES} from '../shared/transformation.js';
import {attackPowerOf,defensePowerOf} from '../shared/combat.js';
import {vitalsOf} from '../shared/vitals.js';
import {startTransformation,expireTransformation} from '../server/transformation.js';

const types=[
  {type:'생산계',id:'aquarius',attack:1,defense:1,hp:10,mp:0,cooldown:.5,amount:1},
  {type:'제작계',id:'gemini',attack:2,defense:0,hp:20,mp:20,cooldown:1,amount:1},
  {type:'공격계',id:'sagittarius',attack:3,defense:-1,hp:10,mp:10,cooldown:1,amount:1},
  {type:'수호계',id:'hercules',attack:1,defense:1,hp:60,mp:0,cooldown:1,amount:1},
  {type:'특수계',id:'cancer',attack:1,defense:0,hp:20,mp:0,cooldown:1,amount:2}
];
const player=(id,extra={})=>({connected:true,role:'student',avatar:{level:5,constellationId:id},...extra});

test('5개 계열의 변신 프로필과 LV5 공격·방어·HP/MP 최대치 보정',()=>{
  for(const item of types){
    const p=player(item.id),profile=transformationProfile(p);
    assert.equal(TRANSFORMATION_TYPES[item.type],profile);
    assert.deepEqual([profile.attackBonus,profile.defenseBonus,profile.hpBonus,profile.mpBonus,profile.skillCooldownFactor,profile.skillAmountFactor],
      [item.attack,item.defense,item.hp,item.mp,item.cooldown,item.amount]);
    const baseAttack=attackPowerOf(5,item.id,p),baseDefense=defensePowerOf(5,item.id,p);
    const baseVitals=vitalsOf(5,p);
    p.transformation={active:true};
    assert.equal(attackPowerOf(5,item.id,p),Math.max(1,baseAttack+item.attack));
    assert.equal(defensePowerOf(5,item.id,p),Math.max(0,baseDefense+item.defense));
    assert.deepEqual([vitalsOf(5,p).hp.max,vitalsOf(5,p).mp.max],[baseVitals.hp.max+item.hp,baseVitals.mp.max+item.mp]);
  }
});

test('각 계열 변신은 스킬 쿨타임·수치량만 프로필대로 조정한다',()=>{
  const spec={cooldownMs:12000,multiplier:1.5,healingAmount:20,effectAmount:4,mana:7,hits:3,durationMs:8000,range:250};
  for(const item of types){
    const p=player(item.id,{transformation:{active:true}}),changed=transformedSkill(p,spec);
    assert.equal(changed.cooldownMs,12000*item.cooldown);
    assert.deepEqual([changed.multiplier,changed.healingAmount,changed.effectAmount],[1.5*item.amount,20*item.amount,4*item.amount]);
    for(const key of ['mana','hits','durationMs','range'])assert.equal(changed[key],spec[key]);
    assert.deepEqual(spec,{cooldownMs:12000,multiplier:1.5,healingAmount:20,effectAmount:4,mana:7,hits:3,durationMs:8000,range:250});
  }
});

test('교사와 비활성·비LV5 캐릭터에는 변신 보정이 적용되지 않는다',()=>{
  const student=player('cancer',{transformation:{active:true}}),teacher=player('cancer',{role:'teacher',transformation:{active:true}});
  const inactive=player('cancer'),low=player('cancer',{transformation:{active:true},avatar:{level:4,constellationId:'cancer'}});
  for(const p of [teacher,inactive,low]){
    assert.equal(transformationBonus(p).attackBonus,0);
    assert.deepEqual(transformedSkill(p,{cooldownMs:10000,multiplier:2,healingAmount:4,effectAmount:3}),
      {cooldownMs:10000,multiplier:2,healingAmount:4,effectAmount:3});
  }
  assert.equal(transformationBonus(student).skillAmountFactor,2);
});

test('특수계의 2배 효과량은 마나·기본 쿨타임·타격 수를 유지한다',()=>{
  const p=player('cancer'),original={cooldownMs:10000,mana:9,hits:4,multiplier:2,healingAmount:6,effectAmount:3};
  startTransformation(p,500);
  const adjusted=transformedSkill(p,original);
  assert.deepEqual(adjusted,{cooldownMs:10000,mana:9,hits:4,multiplier:4,healingAmount:12,effectAmount:6});
  assert.equal(p.transformation.cooldownUntil,300500);
  assert.deepEqual(original,{cooldownMs:10000,mana:9,hits:4,multiplier:2,healingAmount:6,effectAmount:3});
  expireTransformation(p,30500);
  assert.deepEqual(transformedSkill(p,original),original);
});
