import test from 'node:test';
import assert from 'node:assert/strict';
import {nokseraSkillPose} from '../client/noksera-skill.js';
import {nokseraMoonPhase} from '../client/noksera-moon.js';
import {nokseraMoonTimeline} from '../shared/boss-skills.js';

test('뿔 예고3초와발사 복귀는 한 동작이며 지난 경고보다 발사 이벤트 우선',()=>{
  const m={warning:{kind:'noksera-horn-burst',startsAt:1000,endsAt:4000}};
  assert.equal(nokseraSkillPose(m,0,null,1000),0);assert.equal(nokseraSkillPose(m,0,null,2000),4);
  assert.equal(nokseraSkillPose(m,0,null,3999),7);assert.equal(nokseraSkillPose(m,0,null,4000),null);
  assert.equal(nokseraSkillPose(m,1400,{skillKind:'noksera-horn-burst',startedAt:1000},3999),3.5);
  assert.equal(nokseraSkillPose({warning:null},1800,{skillKind:'noksera-horn-burst',startedAt:1000},4000),null);
});
test('달 표시와 반사구간 경계:2초소환+7초차오름+6초보름+7초그믐',()=>{
  const m={moonCast:{startsAt:1000,endsAt:3000},moonAura:nokseraMoonTimeline(1000)};
  assert.equal(nokseraMoonPhase(m,1000).alpha,0);assert.equal(nokseraMoonPhase(m,2000).descent,.5);
  assert.equal(nokseraMoonPhase(m,2999).forming,true);delete m.moonCast;
  assert.equal(nokseraMoonPhase(m,3000).forming,false);assert.equal(nokseraMoonPhase(m,9999).full,false);
  assert.equal(nokseraMoonPhase(m,10000).full,true);assert.equal(nokseraMoonPhase(m,15999).full,true);
  assert.equal(nokseraMoonPhase(m,16000).full,false);assert.equal(nokseraMoonPhase(m,16000).waning,true);
  assert(nokseraMoonPhase(m,22999).fraction<.061);assert.equal(nokseraMoonPhase(m,23000),null);
  assert.equal(nokseraMoonPhase({moonAura:null},1000),null);
});
