import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarSizeOf } from '../shared/avatar-size.js';
import { ATTACK_VISUAL, attackGeometryOf } from '../shared/combat.js';
import { monstersOf, monstersInAttackArea, strikeMonster, MONSTER_RULES } from '../server/monsters.js';
import { playersInArea } from '../server/area-combat.js';
import { RULES } from '../shared/config.js';

const student = (overrides = {}) => ({
  id: 'student', role: 'student', connected: true, mapId: 'star-origin-1',
  x: 100, y: 100, facing: { x: 1, y: 0 },
  avatar: { level: 2, constellationId: 'aries' }, ...overrides
});

test('학생 LV1~LV5 아바타 가로·세로 크기와 교사 크기를 고정한다', () => {
  for (const [level, size] of [[1, 32], [2, 80], [3, 92], [4, 105.8], [5, 121.67]]) {
    assert.ok(Math.abs(avatarSizeOf(student({ avatar: { level } })) - size) < 1e-12);
  }
  assert.equal(avatarSizeOf({ role: 'teacher', avatar: { level: 6 } }), 96);
  assert.ok(Math.abs(avatarSizeOf(student({ avatar: { level: 6 } })) - 121.67) < 1e-12);
});

test('크기 비례 사거리·타격 반경·몸 가장자리 스킬 시작점은 위조 수치를 무시한다', () => {
  for (const [role, level, reach, originOffset, radius] of [
    ['student', 1, 24.8, 16, 14.4], ['student', 2, 62, 40, 36], ['student', 3, 71.3, 46, 41.4],
    ['student', 4, 81.995, 52.9, 47.61], ['student', 5, 94.29425, 60.835, 54.7515], ['teacher', 6, 74.4, 48, 43.2]
  ]) {
    const p = student({ role, avatar: { level }, reach: 99999, radius: 99999, originOffset: 99999 });
    const geometry = attackGeometryOf(p);
    assert.deepEqual(Object.keys(geometry).sort(), ['originOffset', 'radius', 'reach']);
    assert.ok(Math.abs(geometry.reach - reach) < 1e-12);
    assert.ok(Math.abs(geometry.originOffset - originOffset) < 1e-12);
    assert.ok(Math.abs(geometry.radius - radius) < 1e-12);
  }
});

test('LV2 Q 공격은 36px 범위를 사용하고 뒤쪽·다른 맵을 제외하고 범위 안 몬스터를 모두 맞힌다', () => {
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

for (const [role,level] of [['student',2],['student',3],['student',4],['student',5],['teacher',6]])
test(`${role} LV${level}: 몬스터와 학생은 몸 반경을 더한 정확한 경계까지 맞고 0.01px 밖은 빗나간다`, () => {
  const attacker=student({role,avatar:{level}}),target=student({id:'target'});
  const {reach,radius}=attackGeometryOf(attacker);
  // Put the attack center at zero to avoid cancellation rounding at the exact boundary.
  Object.assign(attacker,{x:-reach,y:0});
  const room={players:new Map([[attacker.id,attacker],[target.id,target]])};
  const monster=monstersOf(room,0).get('star-crab');
  room.monsters=new Map([[monster.id,monster]]);
  const area={mapId:attacker.mapId,x:0,y:0,radius,sourceId:attacker.id};
  for(const [delta,hit] of [[-.01,true],[0,true],[.01,false]]){
    Object.assign(target,{x:radius+RULES.radius+delta,y:area.y});
    Object.assign(monster,{x:radius+monster.radius+delta,y:area.y});
    assert.equal(playersInArea(room,area).includes(target),hit,`student delta=${delta}`);
    assert.equal(monstersInAttackArea(room,attacker,0).includes(monster),hit,`monster delta=${delta}`);
  }
});
