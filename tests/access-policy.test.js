import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { studentHoursFromEnv } from '../server/access-hours.js';
import { createClassroomServer } from '../server/app.js';

const key = 'access-policy-test-private-key';

function call(socket, event, data = {}) {
  return new Promise((resolve, reject) => {
    socket.timeout(1500).emit(event, data, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

async function connect(port) {
  const socket = io(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}

function kst(hour, minute = 0) {
  return Date.parse(`2026-09-20T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`);
}

test('STUDENT_HOURS parser defaults to enabled, accepts trimmed case-insensitive booleans, and rejects other values', () => {
  assert.equal(studentHoursFromEnv(undefined), true);
  assert.equal(studentHoursFromEnv(''), true);
  assert.equal(studentHoursFromEnv('  TRUE '), true);
  assert.equal(studentHoursFromEnv(' false '), false);
  assert.throws(() => studentHoursFromEnv('yes'), /STUDENT_HOURS/);
  assert.throws(() => studentHoursFromEnv('0'), /STUDENT_HOURS/);
});

test('studentHours=false keeps an entered student connected, reconnectable, and able to chat across 21:00', async t => {
  let now = kst(20, 59);
  const game = createClassroomServer({ teacherKey: key, studentHours: false, clock: () => now });
  const address = await game.listen();
  const sockets = [];
  t.after(async () => {
    for (const socket of sockets) socket.disconnect();
    await game.close();
  });

  const teacher = await connect(address.port);
  sockets.push(teacher);
  const created = await call(teacher, 'room:create', { teacherKey: key, title: '시간 제한 테스트', allowedNames: ['1', '2'] });
  assert.equal(created.ok, true, created.error);
  assert.equal((await call(teacher, 'chat:setEnabled', { enabled: true })).ok, true);

  const student = await connect(address.port);
  sockets.push(student);
  const joined = await call(student, 'room:join', { code: created.room.code, nickname: '1' });
  assert.equal(joined.ok, true, joined.error);
  const token = joined.token;

  student.disconnect();
  await new Promise(resolve => setTimeout(resolve, 30));
  now = kst(21);
  await new Promise(resolve => setTimeout(resolve, 100));

  const resumed = await connect(address.port);
  sockets.push(resumed);
  const reconnected = await call(resumed, 'session:resume', { token });
  assert.equal(reconnected.ok, true, reconnected.error);
  assert.equal((await call(resumed, 'chat:send', { text: '21시 이후에도 접속' })).ok, true);

  now = kst(0, 30);
  const afterMidnight = await connect(address.port);
  sockets.push(afterMidnight);
  const joinedAfterMidnight = await call(afterMidnight, 'room:join', { code: created.room.code, nickname: '2' });
  assert.equal(joinedAfterMidnight.ok, true, joinedAfterMidnight.error);
});

test('studentHours=true rejects a student attempting to enter at night', async t => {
  let now = kst(20, 59);
  const game = createClassroomServer({ teacherKey: key, studentHours: true, clock: () => now });
  const address = await game.listen();
  const sockets = [];
  t.after(async () => {
    for (const socket of sockets) socket.disconnect();
    await game.close();
  });

  const teacher = await connect(address.port);
  sockets.push(teacher);
  const created = await call(teacher, 'room:create', { teacherKey: key, title: '야간 입장 거부', allowedNames: ['1'] });
  assert.equal(created.ok, true, created.error);
  now = kst(21);
  const student = await connect(address.port);
  sockets.push(student);
  const denied = await call(student, 'room:join', { code: created.room.code, nickname: '1' });
  assert.equal(denied.ok, false);
  assert.match(denied.error, /오후 9시|입장/);
});

test('public-config reports the selected student-hours policy', async t => {
  const dataDir = await mkdtemp(join(tmpdir(), 'access-policy-'));
  const game = createClassroomServer({ teacherKey: key, studentHours: false, dataDir });
  const address = await game.listen();
  t.after(() => game.close());
  const response = await fetch(`http://127.0.0.1:${address.port}/api/public-config`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { managedAccounts: true, studentHours: false });
});
