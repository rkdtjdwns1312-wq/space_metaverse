import { constellationOf } from './constellations.js';
import { PROGRESSION } from './config.js';
import {isTeacher,TEACHER_AVATAR} from './teacher-avatar.js';

export function avatarLabel(player) {
  const name = String(player?.nickname ?? '');
  if (isTeacher(player)) return { name: TEACHER_AVATAR.nickname, detail: 'LV6 '+TEACHER_AVATAR.name };

  const avatar = player?.avatar ?? {};
  const level = Number.isInteger(avatar.level) ? Math.min(PROGRESSION.maxLevel,avatar.level) : 1;
  if (level < 2) return { name, detail: 'LV1 소행성' };
  const constellation = constellationOf(avatar.constellationId, level);
  return { name, detail: 'LV' + level + ' ' + (constellation?.name || '소행성') +
    (level >= PROGRESSION.transcendentLevel ? ' · 초월체' : '') };
}
