import test from 'node:test';
import assert from 'node:assert/strict';
import {nextBossRespawnAt,validateBossRespawns,validateSerenaState} from '../server/boss-lifecycle.js';
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
test('만료 0은 음수가 되지 않고 손상된 시각은 거부한다',()=>{
 assert.equal(validateBossRespawns({'leoon-boss':0})['leoon-boss'],0);
 for(const bad of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER,1.5]){
  assert.throws(()=>nextBossRespawnAt(bad));
  assert.throws(()=>validateBossRespawns({'leoon-boss':bad}));
  assert.throws(()=>validateSerenaState({state:'recovering',respawnAt:bad,monsterId:null}));
 }
});
