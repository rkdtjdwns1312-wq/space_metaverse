import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWork, saveReport, awardReport, proposeDistribution, confirmDistribution, reconcileMembership, cancelDistribution } from '../server/department-work.js';
import { GameError } from '../server/rooms.js';

const make = () => {
  const a = { id: 'a', nickname: '가', role: 'student', starShards: 0, avatar: { departmentId: 'p' } };
  const b = { id: 'b', nickname: '나', role: 'student', starShards: 0, avatar: { departmentId: 'p' } };
  const t = { id: 't', nickname: '선생님', role: 'teacher', starShards: 0, avatar: {} };
  return { room: { players: new Map([['a', a], ['b', b], ['t', t]]) }, planet: { id: 'p' }, a, b, t };
};

test('missing work gets an independent valid default and malformed Map is rejected', () => {
  const one = validateWork(), two = validateWork(); one.report.text = 'x';
  assert.equal(two.report.text, '');
  assert.throws(() => validateWork({ report: new Map() }), /손상|올바르지/);
});

test('validator enforces submitted fields, distribution shape, history uniqueness, and exact expiry', () => {
  const base = { report: { text: 'x', status: 'draft', version: 0, submittedAt: null }, balance: 5, distribution: null, history: [] };
  assert.throws(() => validateWork({ ...base, report: { ...base.report, status: 'submitted', submittedAt: null } }), GameError);
  assert.throws(() => validateWork({ ...base, distribution: { id: 'd', allocations: [{ playerId: 'a', quantity: 0 }], confirmedIds: [] } }), GameError);
  assert.throws(() => validateWork({ ...base, distribution: { id: 'd', allocations: [{ playerId: 'a', quantity: 5 }], confirmedIds: ['b'] } }), GameError);
  assert.throws(() => validateWork({ ...base, history: [{ id: 'h', at: 1, allocations: [] }, { id: 'h', at: 2, allocations: [] }] }), GameError);
  const kept = validateWork({ ...base, history: [{ id: 'edge', at: 0, allocations: [] }] }, 5 * 86400000);
  assert.equal(kept.history.length, 0);
  const { planet } = make(); saveReport(planet, '  trimmed  ', 0, false); assert.equal(planet.work.report.text, 'trimmed');
});

test('save, stale version, submit lock, and award clears the report', () => {
  const { planet } = make();
  saveReport(planet, '부서 실적', 0, false, 10);
  assert.throws(() => saveReport(planet, '늦은 수정', 0), /바뀌었어요/);
  saveReport(planet, '부서 실적', 1, true, 20);
  assert.throws(() => saveReport(planet, '수정', 2), /고칠 수/);
  awardReport(planet, 10, 2, 30);
  assert.deepEqual(planet.work.report, { text: '', status: 'draft', version: 3, submittedAt: null });
  assert.equal(planet.work.balance, 10);
});

test('teacher cannot propose, zero allocations are allowed, every member confirms, and duplicate confirmation pays once', () => {
  const { room, planet, a, b, t } = make(); planet.work = validateWork(); planet.work.balance = 10;
  assert.throws(() => proposeDistribution(room, planet, t.id, []), /학생/);
  const d = proposeDistribution(room, planet, a.id, [{ playerId: a.id, quantity: 0 }, { playerId: b.id, quantity: 10 }], 100);
  assert.deepEqual(confirmDistribution(room, planet, a.id, d.id, 101), { completed: false });
  assert.deepEqual(confirmDistribution(room, planet, a.id, d.id, 102), { completed: false });
  const done = confirmDistribution(room, planet, b.id, d.id, 103);
  assert.equal(done.completed, true); assert.equal(a.starShards, 0); assert.equal(b.starShards, 10); assert.equal(planet.work.balance, 0);
  assert.throws(() => confirmDistribution(room, planet, b.id, d.id), /찾을 수/);
});

test('last confirmation rechecks balance and leaves everyone unchanged on failure', () => {
  const { room, planet, a, b } = make(); planet.work = validateWork(); planet.work.balance = 10;
  const d = proposeDistribution(room, planet, a.id, [{ playerId: a.id, quantity: 5 }, { playerId: b.id, quantity: 5 }]);
  a.starShards = 9995; b.starShards = 0; planet.work.balance = 9;
  assert.throws(() => confirmDistribution(room, planet, a.id, d.id), /잔액|한도/);
  assert.equal(a.starShards, 9995); assert.equal(b.starShards, 0); assert.equal(planet.work.balance, 9); assert.ok(planet.work.distribution);
});

test('membership join or leave cancels pending distribution, funds remain, and history boundary is five days', () => {
  const { room, planet, a, b, t } = make(); const now = Date.now(); planet.work = validateWork({ balance: 10, distribution: null, history: [{ id: 'old', at: now - 5 * 86400000 + 1000, allocations: [] }], report: { text: '', status: 'draft', version: 0, submittedAt: null } }, now);
  const d = proposeDistribution(room, planet, a.id, [{ playerId: a.id, quantity: 5 }, { playerId: b.id, quantity: 5 }]);
  b.avatar.departmentId = null; reconcileMembership(room, planet); assert.equal(planet.work.distribution, null); assert.equal(planet.work.balance, 10);
  b.avatar.departmentId = 'p'; proposeDistribution(room, planet, a.id, [{ playerId: a.id, quantity: 5 }, { playerId: b.id, quantity: 5 }]);
  cancelDistribution(room, planet, t.id); assert.equal(planet.work.distribution, null); assert.equal(planet.work.history.length, 1);
  assert.equal(d.allocations.length, 2);
});
