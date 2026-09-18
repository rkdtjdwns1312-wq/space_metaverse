import test from 'node:test';
import assert from 'node:assert/strict';
import {formatClassroomTime} from '../client/classroom-clock.js';

test('메인 화면 시간은 한국 날짜와 오전·오후, 시:분을 표시한다',()=>{
  assert.equal(formatClassroomTime(new Date('2026-09-17T15:07:00Z')),'2026년 9월 18일 금요일 오전 12:07');
  assert.equal(formatClassroomTime(new Date('2026-09-18T03:05:00Z')),'2026년 9월 18일 금요일 오후 12:05');
});
