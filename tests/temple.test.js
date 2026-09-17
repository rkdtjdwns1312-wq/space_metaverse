import test from 'node:test';
import assert from 'node:assert/strict';
import { koreaDay, weekStart, validateTemple, validateSchedule, saveDaily, saveNotice, readDaily, readTimetable, saveTimetable, markAssignmentDone, recentAssignments, recordReward, weeklyRewards } from '../server/temple.js';
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
  assert.deepEqual(readDaily(room, 'notice', ts('2026-09-14T23:00:00')), { date: '2026-09-15', text: '',taskLines:[] });
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
  assert.deepEqual(validateTemple(undefined), { notices: [], timetables: [], weeks: [],schedule:Array.from({length:6},()=>Array(5).fill('')),assignments:[] });
  assert.throws(() => validateTemple({ notices: [{ date: '2026-01-01', text: 'a' }, { date: '2026-01-01', text: 'b' }], timetables: [], weeks: [] }));
  assert.throws(() => validateTemple({ notices: [], timetables: [], weeks: [{ week: '2026-01-06', totals: [{ playerId: 'a', total: -1 }] }] }));
  assert.throws(() => recordReward({ players: [] }, 'a', 1.5));
});
test('주간 시간표는 월~금 1~6교시 과목 칸을 저장하고 잘못된 크기와 긴 과목을 거부한다',()=>{
  const room={},cells=Array.from({length:6},()=>Array(5).fill(''));
  cells[0][0]='국어';cells[5][4]='체육';
  assert.deepEqual(saveTimetable(room,cells).cells,cells);
  assert.deepEqual(readTimetable(room).cells,cells);
  assert.throws(()=>validateSchedule(Array.from({length:5},()=>Array(5).fill(''))),/schedule/);
  cells[2][1]='가'.repeat(21);assert.throws(()=>saveTimetable(room,cells),/schedule/);
  assert.equal(readTimetable(room).cells[0][0],'국어');
});
test('알림장 줄별 과제 표시와 최근 3주 완료 학생 이름순 목록',()=>{
  const room={players:new Map([['a',{id:'a',nickname:'다희'}],['b',{id:'b',nickname:'가은'}]])};
  const now=ts('2026-09-17T00:00:00'),notice=saveNotice(room,'물 준비\n수학 숙제\n책 읽기',[1,2],now);
  assert.equal(notice.taskLines.length,2);
  assert.throws(()=>saveNotice(room,'알림\n',[1,1],now),/task lines/);
  const assignment=room.temple.assignments.find(a=>a.text==='수학 숙제');
  markAssignmentDone(room,assignment.id,'a');markAssignmentDone(room,assignment.id,'b');
  const weeks=recentAssignments(room,now).weeks;
  assert.equal(weeks.length,3);assert.deepEqual(weeks.map(w=>w.week),['2026-09-14','2026-09-07','2026-08-31']);
  assert.deepEqual(weeks[0].assignments.find(a=>a.id===assignment.id).completed,['가은','다희']);
  assert.equal(weeks[1].assignments.length,0);
});
test('최근 3주 밖의 과제 기록은 정리하되 개인 미완료 과제 참조는 보존한다',()=>{
  const old=ts('2026-01-05T00:00:00'),now=ts('2026-09-17T00:00:00');
  const student={id:'a',nickname:'가람',tasks:[]},room={players:new Map([['a',student]])};
  const first=saveNotice(room,'오래된 과제',[0],old).taskLines[0].assignmentId;
  student.tasks.push({assignmentId:first});
  const original=room.temple.assignments[0];
  for(let i=1;i<1000;i++)room.temple.assignments.push({...original,id:'old-'+i});
  const saved=saveNotice(room,'새 과제',[0],now);
  assert.equal(saved.taskLines.length,1);
  assert.equal(room.temple.assignments.length,2);
  assert.ok(room.temple.assignments.some(a=>a.id===first));
  assert.ok(room.temple.assignments.some(a=>a.id===saved.taskLines[0].assignmentId));
  assert.deepEqual(room.temple.notices.find(n=>n.date==='2026-01-05').taskLines,[{lineIndex:0,assignmentId:first}]);
});
test('학생 닉네임 변경은 ID를 유지하고 교사는 제외한다', () => {
  const room = { players: [{ id: 'b', nickname: '나 2', role: 'student' }, { id: 'a', nickname: '가 10', role: 'student' }, { id: 't', nickname: '교사', role: 'teacher' }] };
  recordReward(room, 'a', 3); room.players[1].nickname = '다 1';
  assert.deepEqual(weeklyRewards(room).rows, [{ playerId: 'b', nickname: '나 2', total: 0 }, { playerId: 'a', nickname: '다 1', total: 3 }]);
});
