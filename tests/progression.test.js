import test from 'node:test';
import assert from 'node:assert/strict';
import { gainExperience } from '../server/progression.js';

const avatar = (overrides = {}) => ({
  form: 'asteroid', level: 1, xp: 0, constellationId: 'orion',
  equipment: { pet: 'comet', mount: 'moon', decoration: 'ring' }, departmentId: 'science', ...overrides
});

test('exactly reaching each of the five thresholds levels up once', () => {
  const thresholds = [15, 20, 25, 30, 40];
  let current = avatar();
  for (let i = 0; i < thresholds.length; i += 1) {
    current = gainExperience(current, thresholds[i]);
    assert.equal(current.level, i + 2);
    assert.equal(current.xp, 0);
  }
  assert.equal(current.form, 'transcendent');
});

test('multiple levels carry remainder forward', () => {
  const result = gainExperience(avatar(), 42);
  assert.equal(result.level, 3);
  assert.equal(result.xp, 7);
});

test('130 total experience reaches terminal transcendent level', () => {
  const result = gainExperience(avatar(), 130);
  assert.equal(result.level, 6);
  assert.equal(result.xp, 0);
  assert.equal(result.form, 'transcendent');
});

test('further experience at terminal level stays capped', () => {
  const result = gainExperience(avatar({ level: 6, xp: 0, form: 'asteroid' }), 999);
  assert.equal(result.level, 6);
  assert.equal(result.xp, 0);
  assert.equal(result.form, 'transcendent');
});

test('invalid input and overflow reject atomically', () => {
  const original = avatar({ xp: 4 });
  const before = structuredClone(original);
  for (const [value, amount] of [[{ ...original, level: 0 }, 1], [{ ...original, xp: -1 }, 1], [original, -1], [original, Number.MAX_SAFE_INTEGER + 1]]) {
    assert.throws(() => gainExperience(value, amount), TypeError);
  }
  assert.deepEqual(original, before);
  assert.throws(() => gainExperience(original, Number.MAX_SAFE_INTEGER - 3), /safe integer range/);
  assert.deepEqual(original, before);
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
