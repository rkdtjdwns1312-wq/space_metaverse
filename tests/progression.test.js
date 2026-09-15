import test from 'node:test';
import assert from 'node:assert/strict';
import { evolveAvatar, gainExperience } from '../server/progression.js';

const avatar = (overrides = {}) => ({
  form: 'asteroid', level: 1, xp: 0, constellationId: 'orion',
  equipment: { pet: 'comet', mount: 'moon', decoration: 'ring' }, departmentId: 'science', ...overrides
});

test('each threshold is capped until an explicit one-step evolution', () => {
  const thresholds = [15, 20, 25, 30, 40];
  let current = avatar();
  for (let i = 0; i < thresholds.length; i += 1) {
    current = gainExperience(current, thresholds[i] + 999);
    assert.equal(current.level, i + 1);
    assert.equal(current.xp, thresholds[i]);
    current = evolveAvatar(current);
    assert.equal(current.level, i + 2);
    assert.equal(current.xp, 0);
  }
  assert.equal(current.form, 'transcendent');
});

test('large experience never crosses the current level threshold', () => {
  const result = gainExperience(avatar(), 42);
  assert.equal(result.level, 1);
  assert.equal(result.xp, 15);
});

test('130 experience still waits for the first manual evolution', () => {
  const result = gainExperience(avatar(), 130);
  assert.equal(result.level, 1);
  assert.equal(result.xp, 15);
  assert.equal(result.form, 'asteroid');
});

test('further experience at terminal level stays capped', () => {
  const result = gainExperience(avatar({ level: 6, xp: 0, form: 'asteroid' }), 999);
  assert.equal(result.level, 6);
  assert.equal(result.xp, 0);
  assert.equal(result.form, 'transcendent');
});

test('invalid input rejects atomically', () => {
  const original = avatar({ xp: 4 });
  const before = structuredClone(original);
  for (const [value, amount] of [[{ ...original, level: 0 }, 1], [{ ...original, xp: -1 }, 1], [original, -1], [original, Number.MAX_SAFE_INTEGER + 1]]) {
    assert.throws(() => gainExperience(value, amount), TypeError);
  }
  assert.deepEqual(original, before);
  assert.throws(() => evolveAvatar(original), /enough experience/);
});

test('constellation, equipment, and department metadata are preserved', () => {
  const source = avatar();
  const result = gainExperience(source, 15);
  assert.deepEqual(result.constellationId, source.constellationId);
  assert.deepEqual(result.equipment, source.equipment);
  assert.equal(result.departmentId, source.departmentId);
  assert.notEqual(result.equipment, source.equipment);
  assert.deepEqual(source, avatar());
});

test('manual evolution changes one level, resets xp, and preserves metadata', () => {
  const source = avatar({ level: 4, xp: 30 });
  const result = evolveAvatar(source);
  assert.equal(result.level, 5);
  assert.equal(result.xp, 0);
  assert.equal(result.form, 'constellation');
  assert.equal(result.constellationId, 'orion');
  assert.deepEqual(result.equipment, source.equipment);
  assert.notEqual(result.equipment, source.equipment);
  assert.deepEqual(source, avatar({ level: 4, xp: 30 }));
});

test('level five evolves to the terminal transcendent form', () => {
  const result = evolveAvatar(avatar({ level: 5, xp: 40 }));
  assert.equal(result.level, 6);
  assert.equal(result.xp, 0);
  assert.equal(result.form, 'transcendent');
  assert.throws(() => evolveAvatar(result), /already transcendent/);
});
