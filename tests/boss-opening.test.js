import test from 'node:test';
import assert from 'node:assert/strict';
import {nextBossRespawnAt,validateBossRespawns,validateSerenaState,validateDarkStarState,validateStarRecordState,needsTemporaryBossRespawnShortening,shortenTemporaryBossRespawns} from '../server/boss-lifecycle.js';
const at=s=>Date.parse(s+'+09:00');
test('보스는 처치 다음 한국 날짜의 07시: 새벽·07시·저녁·월말·연말·윤일',()=>{
 for(const [death,due] of [
  ['2026-10-28T00:00:00','2026-10-29T07:00:00'],
  ['2026-10-28T06:59:59','2026-10-29T07:00:00'],
  ['2026-10-28T07:00:00','2026-10-29T07:00:00'],
  ['2026-10-28T14:30:00','2026-10-29T07:00:00'],
  ['2026-10-28T23:59:59','2026-10-29T07:00:00'],
  ['2026-10-31T22:00:00','2026-11-01T07:00:00'],
  ['2026-12-31T14:00:00','2027-01-01T07:00:00'],
  ['2028-02-28T15:00:00','2028-02-29T07:00:00'],
 ])assert.equal(nextBossRespawnAt(at(death)),at(due),death);
});
test('기존 24시간 저장값은 같은 날짜 07시로 변환, 새 저장값은 반복 복원해도 유지',()=>{
 for(const hour of ['02','07','14','23']){
  const old=at(`2026-10-29T${hour}:30:00`),expected=at('2026-10-29T07:00:00');
  const timers=validateBossRespawns({'leoon-boss':old,'noksera-boss':old,'spirit-king-boss':old,'serena-boss':old});
  assert(Object.values(timers).every(t=>t===expected));assert.deepEqual(validateBossRespawns(timers),timers);
  const serena=validateSerenaState({state:'recovering',respawnAt:old,monsterId:null});
  assert.equal(serena.respawnAt,expected);assert.deepEqual(validateSerenaState(serena),serena);
 }
});
test('11월 1일 한국 시간에 처치한 모든 보스는 1시간 뒤 복원되고 자정 뒤 기존 규칙으로 돌아온다',()=>{
  for(const death of ['2026-11-01T00:00:00','2026-11-01T12:30:00','2026-11-01T23:59:59']){
    const now=at(death),due=now+3600000;
    assert.equal(nextBossRespawnAt(now),due);
    assert.equal(validateBossRespawns({'leoon-boss':due})['leoon-boss'],due);
    for(const validate of [validateSerenaState,validateDarkStarState,validateStarRecordState])
      assert.equal(validate({state:'recovering',respawnAt:due,monsterId:null}).respawnAt,due);
  }
  assert.equal(nextBossRespawnAt(at('2026-11-02T00:00:00')),at('2026-11-03T07:00:00'));
});
test('오늘 이미 쓰러진 일반 보스와 석상 보스의 대기도 1시간 이내로 당기고 저장 시각을 유지한다',()=>{
  const now=at('2026-11-01T10:00:00'),old=at('2026-11-02T07:00:00'),due=now+3600000;
  const ids=['noksera-boss','leoon-boss','spirit-king-boss','serena-boss','dark-star-boss','star-record-boss'];
  const room={bossRespawns:Object.fromEntries(ids.map(id=>[id,old])),monsters:new Map(ids.map(id=>[id,{hp:0,respawnAt:old}])),
    serena:{state:'recovering',respawnAt:old},darkStar:{state:'recovering',respawnAt:old},starRecord:{state:'recovering',respawnAt:old}};
  assert.equal(needsTemporaryBossRespawnShortening(room,now),true);
  assert.equal(shortenTemporaryBossRespawns(room,now),true);
  assert(ids.every(id=>room.bossRespawns[id]===due&&room.monsters.get(id).respawnAt===due));
  assert.equal(room.serena.respawnAt,due);assert.equal(room.darkStar.respawnAt,due);assert.equal(room.starRecord.respawnAt,due);
  assert.equal(needsTemporaryBossRespawnShortening(room,now+1000),false);
  assert.equal(shortenTemporaryBossRespawns(room,at('2026-11-02T00:00:00')),false);
});
test('만료 0은 음수가 되지 않고 손상된 시각은 거부한다',()=>{
 assert.equal(validateBossRespawns({'leoon-boss':0})['leoon-boss'],0);
 for(const bad of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER,1.5]){
  assert.throws(()=>nextBossRespawnAt(bad));
  assert.throws(()=>validateBossRespawns({'leoon-boss':bad}));
  assert.throws(()=>validateSerenaState({state:'recovering',respawnAt:bad,monsterId:null}));
 }
});
