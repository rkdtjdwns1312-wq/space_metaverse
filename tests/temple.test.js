import test from 'node:test';
import assert from 'node:assert/strict';
import { koreaDay, weekStart, validateTemple, saveDaily, readDaily, recordReward, weeklyRewards } from '../server/temple.js';
const ts = s => Date.parse(`${s}Z`);
test('한국 날짜와 주 시작은 일요일에서 월요일로 넘어간다', () => {
  assert.equal(koreaDay(ts('2026-09-13T14:59:00')), '2026-09-13');
  assert.equal(koreaDay(ts('2026-09-13T15:00:00')), '2026-09-14');
  assert.equal(weekStart(ts('2026-09-13T14:59:00')), '2026-09-07');
  assert.equal(weekStart(ts('2026-09-13T15:00:00')), '2026-09-14');
});
test('daily 기록은 자정 기준 교체되고 30개를 보존한다', () => {
  const room = {};
  saveDaily(room, 'notice', '  첫 줄\r\n둘째  ', ts('2026-09-14T00:00:00'));
  assert.deepEqual(readDaily(room, 'notice', ts('2026-09-14T23:00:00')), { date: '2026-09-15', text: '' });
  saveDaily(room, 'notice', ' 새 내용 ', ts('2026-09-14T01:00:00'));
  assert.equal(room.temple.notices.length, 1); assert.equal(room.temple.notices[0].text, '새 내용');
  for (let i = 0; i < 31; i++) saveDaily(room, 'timetable', String(i), ts(`2026-08-${String(i + 1).padStart(2, '0')}T00:00:00`));
  assert.equal(room.temple.timetables.length, 30);
});
test('실제 지급량만 주별 누적되고 다음 주는 0이다', () => {
  const room = { players: [{ id: 'a', nickname: '학생', role: 'student' }] };
  recordReward(room, 'a', 5, ts('2026-09-14T01:00:00')); recordReward(room, 'a', 0, ts('2026-09-14T01:00:00')); recordReward(room, 'a', -2, ts('2026-09-14T01:00:00'));
  assert.equal(weeklyRewards(room, ts('2026-09-14T02:00:00')).rows[0].total, 5);
  assert.equal(weeklyRewards(room, ts('2026-09-21T02:00:00')).rows[0].total, 0);
});
test('없는 기존 값은 복원하고 잘못된 기록은 거부한다', () => {
  assert.deepEqual(validateTemple(undefined), { notices: [], timetables: [], weeks: [] });
  assert.throws(() => validateTemple({ notices: [{ date: '2026-01-01', text: 'a' }, { date: '2026-01-01', text: 'b' }], timetables: [], weeks: [] }));
  assert.throws(() => validateTemple({ notices: [], timetables: [], weeks: [{ week: '2026-01-06', totals: [{ playerId: 'a', total: -1 }] }] }));
  assert.throws(() => recordReward({ players: [] }, 'a', 1.5));
});
test('학생 닉네임 변경은 ID를 유지하고 교사는 제외한다', () => {
  const room = { players: [{ id: 'b', nickname: '나 2', role: 'student' }, { id: 'a', nickname: '가 10', role: 'student' }, { id: 't', nickname: '교사', role: 'teacher' }] };
  recordReward(room, 'a', 3); room.players[1].nickname = '다 1';
  assert.deepEqual(weeklyRewards(room).rows, [{ playerId: 'b', nickname: '나 2', total: 0 }, { playerId: 'a', nickname: '다 1', total: 3 }]);
});
