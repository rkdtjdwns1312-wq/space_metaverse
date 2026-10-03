import test from 'node:test';
import assert from 'node:assert/strict';
import {appearanceLevelOf,characterAbilities,CORVUS_VFX,TRANSFORMATION} from '../shared/character-skills.js';
import {ensureVitals,playerVitals} from '../server/vitals.js';
import {attackPowerOf,defensePowerOf} from '../shared/combat.js';
import {startTransformation,expireTransformation} from '../server/transformation.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {transformationBonus,transformedSkill} from '../shared/transformation.js';

const player=level=>({connected:true,role:'student',mapId:'plaza',avatar:{level,constellationId:'corvus'}});
test('Q/E는 LV2 해금, 일반 스킬은 2/3/4 강화 후 고정, 변신만 LV5 해금',()=>{
  for(let level=1;level<=5;level++){
    const specs=characterAbilities(player(level));
    assert.deepEqual(specs.map(s=>[s.key,s.level]),[['Q',2],['E',2],['1',5]]);
    assert.equal(specs[1].name,{1:'어둠의 깃털',2:'어둠의 깃털',3:'그림자의 날개',4:'심연의 군황',5:'심연의 군황'}[level]);
  }
  assert.equal(characterAbilities({...player(2),avatar:{level:2,constellationId:'sagittarius'}})[1].level,2);
});
test('일반 스킬 설명은 공격력·쿨타임·마나 소모 세 줄만 표시',()=>{
  const expected={
    corvus:{2:['공격력: 100% × 2회','쿨타임: 10초','마나 소모: 5'],3:['공격력: 150% × 3회','쿨타임: 10초','마나 소모: 5'],4:['공격력: 200% × 4회','쿨타임: 10초','마나 소모: 5']},
    sagittarius:['공격력: 현재 공격력의 300%','쿨타임: 5초','마나 소모: 5'],
  };
  for(const [level,lines] of Object.entries(expected.corvus)){
    const description=characterAbilities(player(Number(level)))[1].description;
    assert.deepEqual(description.split('\n'),lines);
  }
  const sagitt=characterAbilities({...player(2),avatar:{level:2,constellationId:'sagittarius'}})[1];
  assert.deepEqual(sagitt.description.split('\n'),expected.sagittarius);
  assert.equal(sagitt.name,'유성화살 LV2');
  const unknown=characterAbilities({...player(2),avatar:{level:2,constellationId:'unreleased'}})[1];
  assert.deepEqual(unknown.description.split('\n'),['공격력: 준비 중','쿨타임: 준비 중','마나 소모: 준비 중']);
});
test('LV5 권한을 그대로 보존하면서 LV4 외형/크기, 실제 변신 때만 LV5 외형',()=>{
  const p=player(5);assert.equal(appearanceLevelOf(p),4);assert.equal(p.avatar.level,5);
  assert.equal(avatarSizeOf(p),avatarSizeOf(player(4)));
  p.transformation={active:true};assert.equal(appearanceLevelOf(p),5);assert.ok(avatarSizeOf(p)>avatarSizeOf(player(4)));
  assert.equal(appearanceLevelOf({...p,role:'teacher',avatar:{level:6}}),6);
});
test('변신 낮은레벨/검은별/자리비움은 차단',()=>{
  for(const p of [player(4),{...player(5),away:true},{...player(5),avatar:{level:5,blackStar:true}}])assert.throws(()=>startTransformation(p,1000));
});
test('변신 30초·쿨300초·제작계전회복60/60·공+2방0·추가 회복 없음·맵이동 유지·종료 원복',()=>{
  const p=player(5),beforeAttack=attackPowerOf(5,'corvus',p),beforeDefense=defensePowerOf(5,'corvus',p);
  ensureVitals(p).mp=0;ensureVitals(p).hp=1;startTransformation(p,100);
  assert.deepEqual(playerVitals(p),{hp:{current:60,max:60},mp:{current:60,max:60},defeated:false});
  assert.equal(attackPowerOf(5,'corvus',p),beforeAttack+2);assert.equal(defensePowerOf(5,'corvus',p),beforeDefense);
  ensureVitals(p).hp=20;ensureVitals(p).mp=10;
  assert.equal(expireTransformation(p,5099),false);assert.equal(expireTransformation(p,5100),false);assert.equal(ensureVitals(p).hp,20);assert.equal(ensureVitals(p).mp,10);
  p.mapId='other';assert.equal(expireTransformation(p,5101),false);assert.equal(p.transformation.active,true);
  expireTransformation(p,30100);assert.equal(p.transformation.active,false);assert.equal(playerVitals(p).hp.max,40);assert.equal(ensureVitals(p).hp,20);
  assert.equal(appearanceLevelOf(p),4);assert.throws(()=>startTransformation(p,300099),/기다려/);
  startTransformation(p,300100);ensureVitals(p).hp=0;assert.equal(expireTransformation(p,300101),true);assert.equal(ensureVitals(p).hp,0);
  assert.equal(TRANSFORMATION.cooldownMs,300000);
});
test('변신 종료 후 수치 헬퍼는 모두 기본 상태로 복원된다',()=>{
  const p=player(5);p.avatar.constellationId='sagittarius';
  const baseAttack=attackPowerOf(5,'sagittarius',p),baseDefense=defensePowerOf(5,'sagittarius',p);
  startTransformation(p,100);assert.equal(attackPowerOf(5,'sagittarius',p),baseAttack+3);
  assert.equal(defensePowerOf(5,'sagittarius',p),baseDefense-1);
  assert.equal(expireTransformation(p,30100),true);
  assert.equal(transformationBonus(p).attackBonus,0);assert.equal(transformationBonus(p).hpBonus,0);
  assert.equal(attackPowerOf(5,'sagittarius',p),baseAttack);assert.equal(defensePowerOf(5,'sagittarius',p),baseDefense);
  assert.equal(transformedSkill(p,{cooldownMs:10000,multiplier:2,healingAmount:5,effectAmount:3}).cooldownMs,10000);
});
test('VFX 등록은 4종×24F, 정사각256/512·중심50%·6×4',()=>{
  assert.equal(Object.keys(CORVUS_VFX).length,4);
  for(const spec of Object.values(CORVUS_VFX)){
    assert.equal(spec.frames,24);assert.equal(spec.columns*spec.rows,24);
    assert.deepEqual(spec.anchor,{x:.5,y:.5});assert.equal(spec.frameSize,spec.id==='attack'?256:512);
  }
});
