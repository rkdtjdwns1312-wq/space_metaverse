import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io } from 'socket.io-client';
import { createAvatar, VALLEY, VALLEY_ID } from '../shared/config.js';
import { CONSTELLATIONS,CONSTELLATION_TYPES,LEGACY_CONSTELLATIONS,constellationOf } from '../shared/constellations.js';
import { buyExperience, changeConstellation, evolutionInfo, evolveConstellation, growthInfo } from '../server/evolution.js';
import { createClassroomServer } from '../server/app.js';

const evolutionStar = VALLEY.objects.find(object => object.id === 'evolution-star');
const growthStar = VALLEY.objects.find(object => object.id === 'growth-star');
let serial = 0;
const player = (overrides = {}) => ({
  id: 'p' + (++serial), role: 'student', connected: true, mapId: VALLEY_ID,
  x: evolutionStar.x, y: evolutionStar.y, starShards: 0, avatar: createAvatar(), ...overrides
});
const room = (...players) => ({ players: new Map(players.map(value => [value.id, value])) });
const atGrowth = value => Object.assign(value, { x: growthStar.x, y: growthStar.y });

test('진화의 별은 계곡 왼쪽, 성장의 별은 오른쪽 끝에 서로 떨어져 배치된다', () => {
  assert.ok(evolutionStar.x < VALLEY.width / 4);
  assert.ok(growthStar.x > VALLEY.width * 3 / 4);
  assert.equal(evolutionStar.y, growthStar.y);
  assert.ok(evolutionStar.x - evolutionStar.radius > 16);
  assert.ok(growthStar.x + growthStar.radius < VALLEY.width - 16);
});

test('16 canonical constellations have unique ids and complete display metadata', () => {
  assert.equal(CONSTELLATIONS.length, 16);
  assert.equal(new Set(CONSTELLATIONS.map(value => value.id)).size, 16);
  for (const value of CONSTELLATIONS) assert.ok(value.id && value.name && value.color && value.icon);
  assert.deepEqual(new Set(CONSTELLATIONS.map(value=>value.type)),new Set(CONSTELLATION_TYPES));
  assert.deepEqual(Object.fromEntries(CONSTELLATION_TYPES.map(type=>[type,CONSTELLATIONS.filter(value=>value.type===type).map(value=>value.name)])),{
    '제작계':['쌍둥이자리','까마귀자리'],
    '생산계':['물병자리','염소자리','황소자리'],
    '수호계':['헤라클레스자리','천칭자리','고래자리','사자자리'],
    '공격계':['뱀주인자리','사수자리','왕관자리'],
    '특수계':['게자리','백조자리','양자리','물고기자리']
  });
  assert.equal(LEGACY_CONSTELLATIONS.length,5);
  assert.ok(LEGACY_CONSTELLATIONS.every(value=>constellationOf(value.id)?.legacy));
});

test('quota counts LV2 through transcendent students, including offline players', () => {
  const me = player();
  const low = player({ connected: false, avatar: { ...createAvatar(), level: 1, constellationId: 'aries' } });
  const level2 = player({ connected: false, avatar: { ...createAvatar(), level: 2, constellationId: 'aries' } });
  const level5 = player({ avatar: { ...createAvatar(), level: 5, form: 'transcendent', constellationId: 'aries' } });
  const info = evolutionInfo(room(me, low, level2, level5), me);
  const aries = info.options.find(value => value.id === 'aries');
  assert.equal(aries.count, 2);
  assert.equal(aries.available, false);
});

test('quota is isolated per room and teachers never occupy a slot', () => {
  const me = player();
  const teacher = player({ role: 'teacher', avatar: { ...createAvatar(), level: 5, constellationId: 'taurus' } });
  const otherRoomPlayers = [player({ avatar: { ...createAvatar(), level: 2, constellationId: 'taurus' } }), player({ avatar: { ...createAvatar(), level: 5, constellationId: 'taurus' } })];
  assert.equal(evolutionInfo(room(me, teacher), me).options.find(value => value.id === 'taurus').count, 0);
  assert.equal(evolutionInfo(room(me, ...otherRoomPlayers), me).options.find(value => value.id === 'taurus').count, 2);
});

test('two sequential first evolutions fill a constellation and the next request rechecks quota', () => {
  const first = player({ avatar: { ...createAvatar(), xp: 15 } });
  const second = player({ avatar: { ...createAvatar(), xp: 15 } });
  const third = player({ avatar: { ...createAvatar(), xp: 15 } });
  const classroom = room(first, second, third);
  evolveConstellation(classroom, first, { constellationId: 'gemini' });
  evolveConstellation(classroom, second, { constellationId: 'gemini' });
  const before = structuredClone(third.avatar);
  assert.throws(() => evolveConstellation(classroom, third, { constellationId: 'gemini' }), /이미 두 친구/);
  assert.deepEqual(third.avatar, before);
});

test('constellation change preserves level, xp, form, equipment, and department metadata', () => {
  const me = player({ avatar: { ...createAvatar(), level: 4, xp: 17, constellationId: 'orion', departmentId: 'science', equipment: { pet: 'comet' } } });
  const before = structuredClone(me.avatar);
  changeConstellation(room(me), me, { constellationId: 'corvus' });
  assert.deepEqual(me.avatar, { ...before, form: 'constellation', constellationId: 'corvus' });
  assert.throws(() => changeConstellation(room(me), me, { constellationId: 'lyra' }), /현재 선택할 수 있는/);
  assert.throws(() => changeConstellation(room(player()), player(), { constellationId: 'aries' }), /LV1/);
});

test('manual evolution rejects missing xp, resets xp, advances one step, and keeps lineage', () => {
  const me = player({ avatar: { ...createAvatar(), level: 3, xp: 24, constellationId: 'cygnus' } });
  const classroom = room(me);
  const before = structuredClone(me.avatar);
  assert.throws(() => evolveConstellation(classroom, me, { constellationId: 'cygnus' }), /1 더 필요/);
  assert.deepEqual(me.avatar, before);
  me.avatar.xp = 25;
  evolveConstellation(classroom, me, { constellationId: 'cygnus' });
  assert.equal(me.avatar.level, 4);
  assert.equal(me.avatar.xp, 0);
  assert.equal(me.avatar.form, 'constellation');
  assert.equal(me.avatar.constellationId, 'cygnus');
});

test('level four becomes transcendent at level five and cannot evolve again', () => {
  const me = player({ avatar: { ...createAvatar(), level: 4, xp: 30, constellationId: 'ursa-major' } });
  const classroom = room(me);
  evolveConstellation(classroom, me, {});
  assert.deepEqual({ level: me.avatar.level, xp: me.avatar.xp, form: me.avatar.form, constellationId: me.avatar.constellationId },
    { level: 5, xp: 0, form: 'transcendent', constellationId: 'ursa-major' });
  assert.throws(() => evolveConstellation(classroom, me, {}), /최고 단계/);
});

test('server functions require a student on the correct map and near the matching star', () => {
  const teacher = player({ role: 'teacher' });
  assert.throws(() => evolutionInfo(room(teacher), teacher), /학생만/);
  const awayMap = player({ mapId: 'space-plaza' });
  assert.throws(() => evolutionInfo(room(awayMap), awayMap), /은하수계곡/);
  const far = player({ x: 0, y: 0 });
  assert.throws(() => evolutionInfo(room(far), far), /가까이/);
  const growthOnly = atGrowth(player());
  assert.doesNotThrow(() => growthInfo(room(growthOnly), growthOnly));
  assert.throws(() => evolutionInfo(room(growthOnly), growthOnly), /가까이/);
});

test('experience purchase uses exact balance and caps at the current threshold without evolving', () => {
  const me = atGrowth(player({ starShards: 15 }));
  const classroom = room(me);
  const result = buyExperience(classroom, me, { amount: 15, xp: 999, price: 0 });
  assert.equal(me.starShards, 0);
  assert.equal(me.avatar.level, 1);
  assert.equal(me.avatar.xp, 15);
  assert.equal(result.maxBuy, 0);
  assert.equal(result.canBuy, false);
});

test('purchase rejects overbuy, zero, negative, fraction, and insufficient balance without mutation', () => {
  const me = atGrowth(player({ starShards: 4, avatar: { ...createAvatar(), xp: 10 } }));
  const classroom = room(me);
  for (const amount of [5, 0, -1, 1.5]) {
    const before = structuredClone(me);
    assert.throws(() => buyExperience(classroom, me, { amount }), /최대 4|1 이상의 정수/);
    assert.deepEqual(me, before);
  }
});

test('transcendent avatars and players on another map cannot buy experience', () => {
  const top = atGrowth(player({ starShards: 50, avatar: { ...createAvatar(), level: 5, form: 'transcendent' } }));
  assert.equal(growthInfo(room(top), top).maxBuy, 0);
  assert.throws(() => buyExperience(room(top), top, { amount: 1 }), /초월체/);
  const elsewhere = player({ mapId: 'space-plaza', starShards: 5 });
  assert.throws(() => buyExperience(room(elsewhere), elsewhere, { amount: 1 }), /은하수계곡/);
});

async function serverFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'evolution-persistence-'));
  const game = createClassroomServer({
    teacherKey: 'evolution-tests-private-teacher-key', dataDir: directory,
    studentHours: false, unattended: false, teacherManagedAccounts: false
  });
  const address = await game.listen(), sockets = [];
  const connect = async () => {
    const socket = io('http://127.0.0.1:' + address.port, { transports: ['websocket'], forceNew: true, reconnection: false });
    sockets.push(socket);
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    return socket;
  };
  const call = (socket, event, data = {}) => socket.timeout(5000).emitWithAck(event, data);
  const teacher = await connect();
  const created = await call(teacher, 'room:create', {
    teacherKey: 'evolution-tests-private-teacher-key', title: '진화 검사', allowedNames: ['1'], seedPlanets: false
  });
  assert.equal(created.ok, true, created.error);
  const student = await connect();
  const joined = await call(student, 'room:join', { code: created.room.code, nickname: '1', pin: '1234' });
  assert.equal(joined.ok, true, joined.error);
  t.after(async () => { for (const socket of sockets) socket.disconnect(); await game.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  return { game, teacher, student, call, code: created.room.code, playerId: joined.selfId };
}

test('actual socket actions cap purchase and allow a confirmed first evolution', async t => {
  const fixture = await serverFixture(t);
  let classroom = fixture.game.store.rooms.get(fixture.code), me = classroom.players.get(fixture.playerId);
  assert.equal((await fixture.call(fixture.teacher, 'shards:give', { playerId: me.id, amount: 15 })).ok, true);
  Object.assign(me, { mapId: VALLEY_ID, x: growthStar.x, y: growthStar.y });
  const info = await fixture.call(fixture.student, 'growth:info');
  assert.deepEqual({ ok: info.ok, maxBuy: info.maxBuy, starShards: info.starShards }, { ok: true, maxBuy: 15, starShards: 15 });
  const denied = await fixture.call(fixture.student, 'growth:buy', { amount: 16, xp: 999, price: 0 });
  assert.equal(denied.ok, false); assert.match(denied.error, /최대 15/);
  assert.deepEqual({ xp: me.avatar.xp, level: me.avatar.level, balance: me.starShards }, { xp: 0, level: 1, balance: 15 });
  const bought = await fixture.call(fixture.student, 'growth:buy', { amount: 15, xp: 999, price: 0 });
  assert.deepEqual({ ok: bought.ok, xp: bought.avatar.xp, level: bought.avatar.level, balance: bought.starShards, maxBuy: bought.maxBuy },
    { ok: true, xp: 15, level: 1, balance: 0, maxBuy: 0 });
  classroom = fixture.game.store.rooms.get(fixture.code); me = classroom.players.get(fixture.playerId);
  Object.assign(me, { mapId: VALLEY_ID, x: evolutionStar.x, y: evolutionStar.y });
  const evolved = await fixture.call(fixture.student, 'evolution:evolve', { constellationId: 'aries', xp: 999 });
  assert.deepEqual({ ok: evolved.ok, level: evolved.avatar.level, xp: evolved.avatar.xp, constellationId: evolved.avatar.constellationId },
    { ok: true, level: 2, xp: 0, constellationId: 'aries' });
});

test('persistent socket transaction rolls back both shards and xp when saving fails', async t => {
  const fixture = await serverFixture(t);
  let classroom = fixture.game.store.rooms.get(fixture.code), me = classroom.players.get(fixture.playerId);
  assert.equal((await fixture.call(fixture.teacher, 'shards:give', { playerId: me.id, amount: 5 })).ok, true);
  Object.assign(me, { mapId: VALLEY_ID, x: growthStar.x, y: growthStar.y });
  const realSave = fixture.game.store.files.save.bind(fixture.game.store.files);
  fixture.game.store.files.save = () => { throw new Error('simulated evolution disk full'); };
  try {
    const result = await fixture.call(fixture.student, 'growth:buy', { amount: 5 });
    assert.equal(result.ok, false); assert.match(result.error, /저장하지 못했어요/);
  } finally { fixture.game.store.files.save = realSave; }
  classroom = fixture.game.store.rooms.get(fixture.code); me = classroom.players.get(fixture.playerId);
  assert.deepEqual({ xp: me.avatar.xp, level: me.avatar.level, balance: me.starShards }, { xp: 0, level: 1, balance: 5 });
  const retried = await fixture.call(fixture.student, 'growth:buy', { amount: 5 });
  assert.equal(retried.ok, true, retried.error);
  assert.deepEqual({ xp: retried.avatar.xp, balance: retried.starShards }, { xp: 5, balance: 0 });
});
