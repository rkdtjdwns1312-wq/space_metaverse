import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentBonus,equipmentAuraOf,equipmentOf} from '../shared/equipment.js';
import {transformedSkill,transformationCooldownMs,transformationDescription} from '../shared/transformation.js';
import {startTransformation} from '../server/transformation.js';
import {advancePassiveRecovery} from '../server/passive-recovery.js';
import {ensureVitals,playerVitals} from '../server/vitals.js';
import {characterAbilities} from '../shared/character-skills.js';
const make=()=>({id:'gem-test',role:'student',connected:true,away:false,avatar:{level:5,constellationId:'hercules'},equipmentSlots:['primordial-star-gem',null,null]});
test('시초 보석은 10초당 기존 자연회복에 HP10 MP5를 더하고 최대치를 넘지 않는다',()=>{
 const p=make(),room={players:new Map([[p.id,p]])},v=ensureVitals(p),max=playerVitals(p);v.hp=1;v.mp=0;
 advancePassiveRecovery(room,1000);advancePassiveRecovery(room,10999);assert.equal(v.hp,1);assert.equal(v.mp,0);
 advancePassiveRecovery(room,11000);assert.equal(v.hp,1+Math.ceil(max.hp.max*.1)+10);assert.equal(v.mp,7);
 p.equipmentSlots=[];advancePassiveRecovery(room,21000);assert.equal(v.mp,9);
 p.equipmentSlots=['primordial-star-gem'];advancePassiveRecovery(room,101000);assert.equal(v.hp,max.hp.max);assert.equal(v.mp,max.mp.max);
 assert.equal(equipmentOf('primordial-star-gem').craftOnly,true);
});
test('16종 일반 스킬은 절반·기본 공격은 유지하며 별자리초월은 60초가 된다',()=>{
 for(const id of ['aquarius','cancer','cetus','pisces','cygnus','ophiuchus','gemini','aries','sagittarius','taurus','hercules','libra','corona-borealis','capricorn','leo','corvus']){
  const p=make();p.avatar.constellationId=id;p.equipmentSlots=[];const base=characterAbilities(p);
  p.equipmentSlots=['primordial-star-gem'];const equipped=characterAbilities(p),seconds=ability=>Number(ability.description.match(/쿨타임:\s*(?:종료 후 )?([\d.]+)/)?.[1]);
  assert.ok(Number.isFinite(seconds(base[1])),id);assert.equal(seconds(equipped[1]),seconds(base[1])/2,id);assert.deepEqual(equipped[0],base[0]);assert.match(equipped[2].description,/쿨타임: 60초/);
 }
 const p=make(),state=startTransformation(p,1000);assert.equal(state.cooldownUntil,61000);assert.equal(state.endsAt,31000);
 p.equipmentSlots=[];assert.equal(p.transformation.cooldownUntil,61000);assert.equal(transformationCooldownMs(p),120000);assert.match(transformationDescription(p),/120초/);
 p.equipmentSlots=['primordial-star-gem','moon-earring','meteor-boots'];assert.equal(transformedSkill(p,{cooldownMs:10000}).cooldownMs,1000);assert.equal(transformationCooldownMs(p),60000);
});
test('장착 조합별 오라는 보유 아이템에 영향받지 않으며 세 가지로 결정된다',()=>{
 const p=make();assert.equal(equipmentAuraOf(p),'orange');p.equipmentSlots=['spirit-king-cloak'];assert.equal(equipmentAuraOf(p),'blue');
 p.equipmentSlots=['spirit-king-cloak','primordial-star-gem'];assert.equal(equipmentAuraOf(p),'rainbow');
 p.equipmentSlots=[];p.inventory=[{id:'spirit-king-cloak',quantity:1},{id:'primordial-star-gem',quantity:1}];assert.equal(equipmentAuraOf(p),null);assert.equal(equipmentBonus(p).allCooldownReduction,0);
});
