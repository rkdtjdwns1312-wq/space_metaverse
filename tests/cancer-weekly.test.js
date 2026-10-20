import test from 'node:test';
import assert from 'node:assert/strict';
import {inviteCancerDuel,respondCancerDuel} from '../server/cancer-weekly.js';
import {constellationAbilityStatus,validateConstellationAbilityState} from '../server/constellation-weekly-abilities.js';
import {constellationWeekStart} from '../shared/constellation-weekly-abilities.js';

const NOW=Date.UTC(2026,9,21,4);
function fixture(level){
  const source={id:'source',nickname:'달',role:'student',connected:true,away:false,starShards:10,
    avatar:{constellationId:'cancer',level},constellationAbilityState:undefined};
  const target={id:'target',nickname:'별',role:'student',connected:true,away:false,starShards:10,
    avatar:{constellationId:'taurus',level:2}};
  const room={players:new Map([[source.id,source],[target.id,target]]),cancerInvites:new Map()};
  return {room,source,target};
}
test('게자리 Lv2 가위바위보는 수락 뒤 정산하고, 비기면 이번 주 능력이 남는다',()=>{
  const {room,source,target}=fixture(2);
  let invite=inviteCancerDuel(room,source,target.id,'rock',NOW);
  const tie=respondCancerDuel(room,target,invite.id,true,'rock',NOW+1);
  assert.equal(tie.tie,true);assert.equal(source.starShards,10);assert.equal(constellationAbilityStatus(source,NOW+2).canUse,true);
  invite=inviteCancerDuel(room,source,target.id,'rock',NOW+3);
  const result=respondCancerDuel(room,target,invite.id,true,'paper',NOW+4);
  assert.equal(result.winnerId,target.id);assert.equal(source.starShards,11);assert.equal(target.starShards,11);
  assert.equal(source.constellationAbilityState.usedWeek,constellationWeekStart(NOW));
  assert.equal(constellationAbilityStatus(source,NOW+5).canUse,false);
  assert.equal(validateConstellationAbilityState(source.constellationAbilityState).lastResult.reward,1);
});
test('게자리 Lv3·5 신청자가 앞뒤·홀짝을 고르면 상대는 반대로 배정하고 위로 보상을 받는다',()=>{
  for(const [level,choice,roll,win] of [[3,'heads',2,2],[5,'odd',2,6]]){
    const {room,source,target}=fixture(level),invite=inviteCancerDuel(room,source,target.id,choice,NOW);
    const result=respondCancerDuel(room,target,invite.id,true,undefined,NOW+1,()=>roll);
    assert.equal(result.winnerId,target.id);assert.equal(result.deltaFrom,0);assert.equal(result.deltaTo,win);
    assert.equal(source.starShards,10);assert.equal(target.starShards,10+win);
    assert.notEqual(result.initiatorChoice,result.opponentChoice);
    assert.equal(validateConstellationAbilityState(source.constellationAbilityState).lastResult.reward,0);
  }
});
test('게자리 Lv4 주사위가 같으면 다시 굴리고 높은 눈이 이긴다',()=>{
  const {room,source,target}=fixture(4),invite=inviteCancerDuel(room,source,target.id,null,NOW);
  const dice=[3,3,5,2];let n=0;
  const result=respondCancerDuel(room,target,invite.id,true,undefined,NOW+1,()=>dice[n++]);
  assert.deepEqual(result.rolls,[5,2]);assert.equal(result.winnerId,source.id);
  assert.equal(source.starShards,14);assert.equal(target.starShards,8);
});
test('게자리 대결은 접속 친구의 수락·패배 비용을 요구하고 거절은 주간 사용을 소모하지 않는다',()=>{
  const {room,source,target}=fixture(5),invite=inviteCancerDuel(room,source,target.id,'odd',NOW);
  assert.throws(()=>respondCancerDuel(room,source,invite.id,true,undefined,NOW+1));
  assert.equal(respondCancerDuel(room,target,invite.id,false,undefined,NOW+2).accepted,false);
  assert.equal(constellationAbilityStatus(source,NOW+3).canUse,true);
  target.starShards=2;assert.throws(()=>inviteCancerDuel(room,source,target.id,'odd',NOW+4),/별 파편/);
  target.starShards=10;target.connected=false;assert.throws(()=>inviteCancerDuel(room,source,target.id,'odd',NOW+5),/접속/);
});
