import { randomUUID } from 'node:crypto';
import { GameError } from './rooms.js';

const DEFAULT = () => ({
  report: { text: '', status: 'draft', version: 0, submittedAt: null },
  balance: 0, distribution: null, history: []
});

const fail = message => { throw new GameError(message); };
const isInt = n => Number.isInteger(n);
const isPlain = value => value === null || typeof value !== 'object' || Array.isArray(value) ||
  (Object.getPrototypeOf(value) === Object.prototype && !(value instanceof Map) && !(value instanceof Set));
const copy = value => {
  if (!isPlain(value)) fail('작업 자료가 손상되었어요.');
  if (value && typeof value === 'object') for (const v of Object.values(value)) copy(v);
  return structuredClone(value);
};
const textOf = value => typeof value === 'string' && value.length <= 4000;
const idOf = value => typeof value === 'string' && value.length > 0;
const cleanHistory = (history, now) => history.filter(row => now - row.at < 5 * 24 * 60 * 60 * 1000);

export function validateWork(raw, now = Date.now()) {
  if (raw === undefined) return DEFAULT();
  const value = copy(raw);
  if (!value || Array.isArray(value) || !value.report || typeof value.report !== 'object') fail('작업 보고서가 손상되었어요.');
  const r = value.report;
  if (!textOf(r.text) || !['draft', 'submitted'].includes(r.status) || !isInt(r.version) || r.version < 0 ||
      (r.status === 'draft' && r.submittedAt !== null) ||
      (r.status === 'submitted' && (!r.text.trim() || !isInt(r.submittedAt) || r.submittedAt < 0))) fail('작업 보고서가 올바르지 않아요.');
  if (!isInt(value.balance) || value.balance < 0 || value.balance > 9999) fail('부서 잔액이 올바르지 않아요.');
  if (value.distribution !== null) {
    const d = value.distribution;
    if (!d || !idOf(d.id) || !Array.isArray(d.allocations) || !Array.isArray(d.confirmedIds)) fail('분배 자료가 올바르지 않아요.');
    if (!d.allocations.length) fail('분배 자료가 올바르지 않아요.');
    const ids = new Set(); let total = 0;
    for (const a of d.allocations) {
      if (!a || !idOf(a.playerId) || ids.has(a.playerId) || !isInt(a.quantity) || a.quantity < 0 || a.quantity > 9999) fail('분배 수량이 올바르지 않아요.');
      ids.add(a.playerId); total += a.quantity;
    }
    if (total < 1 || total > value.balance) fail('분배 합계가 잔액을 벗어났어요.');
    const confirmed = new Set();
    for (const id of d.confirmedIds) {
      if (!idOf(id) || confirmed.has(id) || !ids.has(id)) fail('확인 자료가 올바르지 않아요.');
      confirmed.add(id);
    }
  }
  if (!Array.isArray(value.history)) fail('작업 기록이 손상되었어요.');
  const historyIds = new Set();
  for (const row of value.history) {
    if (!row || !idOf(row.id) || historyIds.has(row.id) || !isInt(row.at) || row.at < 0 || !Array.isArray(row.allocations)) fail('작업 기록이 올바르지 않아요.');
    historyIds.add(row.id); const allocationIds = new Set();
    for (const a of row.allocations) if (!a || !idOf(a.playerId) || allocationIds.has(a.playerId) || typeof a.nickname !== 'string' || !isInt(a.quantity) || a.quantity < 0 || a.quantity > 9999) fail('작업 기록이 올바르지 않아요.'); else allocationIds.add(a.playerId);
  }
  value.history = cleanHistory(value.history, now);
  return value;
}

const work = (planet, now) => { if (!planet || typeof planet !== 'object') fail('행성을 찾을 수 없어요.'); planet.work = validateWork(planet.work, now); return planet.work; };
const students = room => [...room.players.values()].filter(p => p && p.role !== 'teacher' && p.avatar?.departmentId);
const members = (room, planet) => students(room).filter(p => p.avatar.departmentId === planet.id);
const member = (room, planet, id) => members(room, planet).find(p => p.id === id);
const ensureVersion = (w, version) => { if (!isInt(version) || version !== w.report.version) fail('보고서가 이미 바뀌었어요.'); };

export function saveReport(planet, text, expectedVersion, submit = false, now = Date.now()) {
  const w = work(planet, now); ensureVersion(w, expectedVersion);
  if (!textOf(text)) fail('보고서 글자 수가 너무 많아요.');
  if (submit && (!text.trim() || w.report.status === 'submitted')) fail('제출할 수 없는 보고서예요.');
  if (!submit && w.report.status === 'submitted') fail('제출한 보고서는 고칠 수 없어요.');
  w.report = { text: text.trim(), status: submit ? 'submitted' : 'draft', version: w.report.version + 1, submittedAt: submit ? now : null };
  return copy(w.report);
}

export function awardReport(planet, amount, expectedVersion, now = Date.now()) {
  const w = work(planet, now); ensureVersion(w, expectedVersion);
  if (!isInt(amount) || amount < 1 || amount > 999) fail('지급액은 1에서 999 사이여야 해요.');
  if (w.report.status !== 'submitted') fail('제출된 보고서만 지급할 수 있어요.');
  if (w.balance + amount > 9999) fail('부서 잔액 한도를 넘어요.');
  w.balance += amount; w.report = { text: '', status: 'draft', version: w.report.version + 1, submittedAt: null };
  return copy(w);
}

export function proposeDistribution(room, planet, actorId, allocations, now = Date.now()) {
  const w = work(planet, now); const all = members(room, planet); const actor = member(room, planet, actorId);
  if (!actor) fail('부서 소속 학생만 제안할 수 있어요.');
  if (w.distribution) fail('이미 진행 중인 분배가 있어요.');
  if (!Array.isArray(allocations) || allocations.length !== all.length) fail('모든 부서 학생의 분배를 적어야 해요.');
  const ids = new Set(), proposed = [];
  for (const a of allocations) {
    const p = member(room, planet, a?.playerId);
    if (!p || ids.has(a.playerId) || !isInt(a.quantity) || a.quantity < 0 || a.quantity > 9999) fail('분배 대상이나 수량이 올바르지 않아요.');
    ids.add(p.id); proposed.push({ playerId: p.id, quantity: a.quantity });
  }
  if (ids.size !== all.length || all.some(p => !ids.has(p.id))) fail('현재 부서 학생 전원을 포함해야 해요.');
  const total = proposed.reduce((n, a) => n + a.quantity, 0);
  if (total < 1 || total > w.balance) fail('분배 합계가 잔액을 벗어났어요.');
  for (const a of proposed) if (member(room, planet, a.playerId).starShards + a.quantity > 9999) fail('학생별 별조각 한도를 넘어요.');
  w.distribution = { id: randomUUID(), allocations: proposed, confirmedIds: [] };
  return copy(w.distribution);
}

export function confirmDistribution(room, planet, actorId, proposalId, now = Date.now()) {
  const w = work(planet, now), d = w.distribution, actor = member(room, planet, actorId);
  if (!actor) fail('부서 소속 학생만 확인할 수 있어요.');
  if (!d || d.id !== proposalId) fail('분배 제안을 찾을 수 없어요.');
  const all = members(room, planet), ids = new Set(d.allocations.map(a => a.playerId));
  if (ids.size !== all.length || all.some(p => !ids.has(p.id))) fail('부서 소속이 바뀌어 분배를 취소해야 해요.');
  if (d.confirmedIds.includes(actorId)) return { completed: false };
  const completing = d.confirmedIds.length + 1 === all.length;
  const total = d.allocations.reduce((n, a) => n + a.quantity, 0);
  if (completing && (total > w.balance || all.some(p => p.starShards + d.allocations.find(a => a.playerId === p.id).quantity > 9999))) fail('지급 직전에 잔액 또는 학생 한도가 바뀌었어요.');
  const result = d.allocations.map(a => ({ playerId: a.playerId, nickname: member(room, planet, a.playerId).nickname, quantity: a.quantity }));
  d.confirmedIds.push(actorId); if (!completing) return { completed: false };
  w.balance -= total; for (const a of result) member(room, planet, a.playerId).starShards += a.quantity;
  w.history.push({ id: d.id, at: now, allocations: result }); w.history = cleanHistory(w.history, now); w.distribution = null;
  return { completed: true, allocations: copy(result) };
}

export function reconcileMembership(room, planet, now = Date.now()) { if (!planet?.work?.distribution) return planet?.work; const w = work(planet, now); const ids = new Set(members(room, planet).map(p => p.id)); if (ids.size !== w.distribution.allocations.length || w.distribution.allocations.some(a => !ids.has(a.playerId))) w.distribution = null; return w; }
export function cancelDistribution(room, planet, actorId) { const w = work(planet, Date.now()); if (!room.players.get(actorId) || (room.players.get(actorId).role !== 'teacher' && !member(room, planet, actorId))) fail('부서 소속 학생이나 교사만 취소할 수 있어요.'); w.distribution = null; return copy(w); }
