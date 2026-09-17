import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { createClassroomServer } from '../server/app.js';
import { checkChatRate } from '../server/chat-rate.js';

const key = 'chat-rate-test-key-16';
const call = (socket, event, data = {}) => socket.timeout(3000).emitWithAck(event, data);

test('checkChatRate enforces cooldown, five per ten seconds, repeat normalization, and exact boundaries', () => {
  const send = (player, text, now) => {
    const recent = checkChatRate(player, text, now);
    player.lastChatAt = now;
    player.recentChats = recent;
    return recent;
  };
  const player = {};
  player.lastChatAt = -1500;
  player.recentChats = [];
  send(player, '첫 말', 0);
  assert.deepEqual(player.recentChats, [{ at: 0, text: '첫말' }]);
  assert.throws(() => checkChatRate(player, '다음', 1499), /천천히/);
  send(player, '다음', 1500);
  assert.deepEqual(player.recentChats, [{ at: 0, text: '첫말' }, { at: 1500, text: '다음' }]);

  const burst = {};
  burst.lastChatAt = -1500;
  for (let i = 0; i < 5; i++) send(burst, `말${i}`, i * 1500);
  assert.throws(() => checkChatRate(burst, '여섯', 7500), /10초/);
  send(burst, '여섯', 10000);
  assert.deepEqual(burst.recentChats.at(-1), { at: 10000, text: '여섯' });

  const repeat = {};
  repeat.lastChatAt = -1500;
  const first = send(repeat, '  Hello  World ', 0);
  assert.throws(() => checkChatRate(repeat, 'helloworld', 1500), /같은 말/);
  send(repeat, 'helloworld', 10000);
  assert.deepEqual(repeat.recentChats, [{ at: 10000, text: 'helloworld' }]);
  assert.equal(first[0].text, 'helloworld');
});

async function fixture(t) {
  const game = createClassroomServer({ teacherKey: key, studentHours: false });
  const address = await game.listen();
  const url = `http://127.0.0.1:${address.port}`;
  const sockets = [];
  t.after(async () => { for (const socket of sockets) socket.disconnect(); await game.close(); });
  const connect = async () => {
    const socket = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
    sockets.push(socket);
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    return socket;
  };
  return { game, connect };
}

test('real Socket.IO chat accepts 100 Korean characters and 100 emoji, rejects 101', async t => {
  const { connect, game } = await fixture(t);
  const teacher = await connect();
  const created = await call(teacher, 'room:create', { teacherKey: key, allowedNames: ['1'] });
  const student = await connect();
  await call(student, 'room:join', { code: created.room.code, nickname: '1' });
  assert.equal((await call(student, 'chat:send', { text: '가'.repeat(100) })).ok, true);
  const player = game.store.rooms.get(created.room.code).players.get((await call(student, 'chat:history')).messages[0].playerId);
  player.lastChatAt = 0;
  assert.equal((await call(student, 'chat:send', { text: '😀'.repeat(100) })).ok, true);
  player.lastChatAt = 0;
  assert.equal((await call(student, 'chat:send', { text: '나'.repeat(101) })).error, '채팅은 1~100자로 입력해주세요.');
});

test('real Socket.IO rate state survives channel changes and session resume', async t => {
  const { connect, game } = await fixture(t);
  const teacher = await connect();
  const created = await call(teacher, 'room:create', { teacherKey: key, allowedNames: ['1'] });
  const firstSocket = await connect();
  const joined = await call(firstSocket, 'room:join', { code: created.room.code, nickname: '1' });
  const player = game.store.rooms.get(created.room.code).players.get(joined.selfId);
  const messages = [];
  teacher.on('chat:message', message => messages.push(message));

  assert.equal((await call(firstSocket, 'chat:send', { channel: 'map', mapId: 'map-a', text: '같은 말' })).ok, true);
  player.lastChatAt = 0;
  assert.equal((await call(firstSocket, 'chat:send', { channel: 'direct', targetId: created.selfId, text: '같은말' })).error, '같은 말은 10초 뒤에 다시 보내주세요.');
  assert.equal((await call(firstSocket, 'chat:history')).messages.filter(m => m.text === '같은 말').length, 1);

  firstSocket.disconnect();
  const resumed = await connect();
  assert.equal((await call(resumed, 'session:resume', { token: joined.token })).selfId, joined.selfId);
  player.lastChatAt = 0;
  assert.equal((await call(resumed, 'chat:send', { channel: 'map', mapId: 'map-b', text: '같은말' })).error, '같은 말은 10초 뒤에 다시 보내주세요.');
  assert.equal(messages.filter(m => m.text === '같은 말').length, 1);
});
