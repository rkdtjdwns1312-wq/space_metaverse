import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarLabel } from '../shared/avatar-label.js';
import { CONSTELLATIONS, LEGACY_CONSTELLATIONS } from '../shared/constellations.js';

test('avatarLabel keeps the login nickname and labels all 16 constellations from LV2 through LV5', () => {
  for (const constellation of CONSTELLATIONS) {
    for (const level of [2, 3, 4, 5]) {
      const detail = `LV${level} ${constellation.name}` + (level === 5 ? ' · 초월체' : '');
      assert.deepEqual(avatarLabel({ nickname: '별이 · 나', avatar: { level, constellationId: constellation.id } }), {
        name: '별이 · 나', detail
      });
    }
  }
});

test('avatarLabel labels LV1 as an asteroid and LV5 as the transcendent form', () => {
  assert.deepEqual(avatarLabel({ nickname: '첫별', avatar: { level: 1, constellationId: 'gemini' } }), {
    name: '첫별', detail: 'LV1 소행성'
  });
  assert.deepEqual(avatarLabel({ nickname: '마지막별', avatar: { level: 5, constellationId: 'gemini' } }), {
    name: '마지막별', detail: 'LV5 쌍둥이자리 · 초월체'
  });
});

test('avatarLabel handles empty constellation IDs and legacy constellations', () => {
  assert.deepEqual(avatarLabel({ nickname: '빈별', avatar: { level: 3, constellationId: '' } }), {
    name: '빈별', detail: 'LV3 소행성'
  });
  for (const constellation of LEGACY_CONSTELLATIONS) {
    assert.deepEqual(avatarLabel({ nickname: '옛별', avatar: { level: 2, constellationId: constellation.id } }), {
      name: '옛별', detail: `LV2 ${constellation.name}`
    });
  }
});

test('avatarLabel keeps teacher and legacy player names intact', () => {
  assert.deepEqual(avatarLabel({ role: 'teacher', nickname: '담임 · 나', avatar: { level: 5 } }), {
    name: '선생님', detail: 'LV6 별의수호자'
  });
  assert.deepEqual(avatarLabel({ nickname: 42, avatar: { level: 1 } }), {
    name: '42', detail: 'LV1 소행성'
  });
});
