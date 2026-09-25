import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarSizeOf } from '../shared/avatar-size.js';
import { ATTACK_VISUAL } from '../shared/combat.js';
import { monstersOf, strikeMonster, MONSTER_RULES } from '../server/monsters.js';

const student = (overrides = {}) => ({
  id: 'student', role: 'student', connected: true, mapId: 'star-origin-1',
  x: 100, y: 100, facing: { x: 1, y: 0 },
  avatar: { level: 2, constellationId: 'aries' }, ...overrides
});

test('학생 LV1~LV5 아바타 가로·세로 크기와 교사 크기를 고정한다', () => {
  assert.deepEqual([1, 2, 3, 4].map(level => avatarSizeOf({ role: 'student', avatar: { level } })),
    [32, 128, 153.6, 184.32]);
  assert.ok(Math.abs(avatarSizeOf({ role: 'student', avatar: { level: 5 } }) - 221.184) < 1e-12);
  assert.equal(avatarSizeOf({ role: 'teacher', avatar: { level: 6 } }), 96);
  assert.ok(Math.abs(avatarSizeOf({ role: 'student', avatar: { level: 5 } }) - 221.184) < 1e-12);
});

test('Q 공격은 36px 새 범위만 사용하고 뒤쪽·다른 맵을 제외하고 범위 안 몬스터를 모두 맞힌다', () => {
  assert.deepEqual(ATTACK_VISUAL, { cooldownMs: 1000, durationMs: 340, reach: 62, hitRadius: 36 });
  assert.equal(MONSTER_RULES.hitRadius, 18);

  const room = { players: new Map() };
  const monsters = monstersOf(room, 0);
  const rabbit = monsters.get('star-crab');
  const squirrel = monsters.get('water-star');
  for (const monster of monsters.values()) {
    if (monster !== rabbit && monster !== squirrel) monster.hp = 0;
  }
  const before = { rabbit: rabbit.hp, squirrel: squirrel.hp, rules: { ...MONSTER_RULES } };
  const p = student({ id: 'hunter', x: rabbit.x - 62, y: rabbit.y });
  room.players.set(p.id, p);

  // 중심과 공격 끝점의 거리가 50px: 기존 18px 판정은 빗나가고 새 36px 판정은 명중한다.
  rabbit.x = p.x + 62;
  rabbit.y = p.y + 50;
  assert.equal(strikeMonster(room, p, 3, 0).monsterId, 'star-crab');
  assert.equal(rabbit.hp, before.rabbit - 3);

  // 새 판정 반경 밖(61px)은 빗나간다.
  rabbit.hp = before.rabbit;
  rabbit.y = p.y + 61;
  assert.equal(strikeMonster(room, p, 3, 1), null);
  assert.equal(rabbit.hp, before.rabbit);

  // 공격자 뒤쪽은 거리와 무관하게 후보가 아니다.
  rabbit.y = p.y;
  rabbit.x = p.x - 62;
  assert.equal(strikeMonster(room, p, 3, 2), null);
  assert.equal(rabbit.hp, before.rabbit);

  // 다른 맵의 몬스터는 좌표가 같아도 맞지 않는다.
  rabbit.x = p.x + 62;
  rabbit.y = p.y;
  p.mapId = 'star-origin-2';
  assert.equal(strikeMonster(room, p, 3, 3), null);
  assert.equal(rabbit.hp, before.rabbit);
  p.mapId = rabbit.mapId;

  // 같은 공격에서 겹친 두 후보 모두 피해를 받는다.
  squirrel.x = p.x + 62;
  squirrel.y = p.y;
  const result = strikeMonster(room, p, 3, 4);
  assert.equal(result.monsterId, 'star-crab');
  assert.equal(rabbit.hp, before.rabbit - 3);
  assert.equal(squirrel.hp, before.squirrel - 3);
  assert.deepEqual({ rabbit: rabbit.hp, squirrel: squirrel.hp, rules: { ...MONSTER_RULES } },
    { rabbit: before.rabbit - 3, squirrel: before.squirrel - 3, rules: before.rules });
});
