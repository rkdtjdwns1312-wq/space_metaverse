import {attackGeometryOf,SKILL_COOLDOWN_MS} from '../shared/combat.js';
import {playersInArea} from './area-combat.js';
import {monstersInAttackArea,damageMonster} from './monsters.js';
import {damagePlayer} from './vitals.js';
import {ensure} from './rooms.js';

export const usesTeacherSkill=player=>player.role==='teacher'&&!player.avatar.teacherPreview;
// Uses the normal target geometry and death/aggro/reward path, without attack VFX.
export function castTeacherSkill(room,player,now){
 ensure(usesTeacherSkill(player),'일반 선생님 캐릭터 전용 스킬이에요.');
 ensure(now-(player.teacherSkillAt??-Infinity)>=SKILL_COOLDOWN_MS,'스킬을 조금 천천히 사용해주세요.');
 player.teacherSkillAt=now;
 const direction=player.facing||{x:0,y:1},geometry=attackGeometryOf(player),options={fixedDamage:1,silent:true};
 const targets=monstersInAttackArea(room,player,now).map(m=>damageMonster(room,m,player,1,now,{...options,retaliateTeacher:true})).filter(Boolean);
 const playerTargets=playersInArea(room,{mapId:player.mapId,x:player.x+direction.x*geometry.reach,y:player.y+direction.y*geometry.reach,radius:geometry.radius,sourceId:player.id})
  .map(p=>({targetId:p.id,...damagePlayer(p,1,now,options)}));
 return {ready:true,cooldownMs:SKILL_COOLDOWN_MS,targets,playerTargets};
}
