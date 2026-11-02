import {attackPowerOf,attackGeometryOf} from '../shared/combat.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {usesTeacherCombat,TEACHER_SKILL} from '../shared/teacher-avatar.js';
import {monstersOf,damageMonster} from './monsters.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {launchProjectiles} from './projectiles.js';
import {ensure} from './rooms.js';

export const usesTeacherSkill=usesTeacherCombat;
export const teacherCooldowns=player=>({0:player.teacherCooldownUntil||0});
const active=player=>player?.connected&&!player.away&&!player.avatar?.blackStar&&ensureVitals(player)?.hp>0;
function requireTeacher(player){
 ensure(usesTeacherCombat(player),'일반 선생님 캐릭터 전용 스킬이에요.');
 ensure(active(player),'지금은 공격할 수 없어요.');
}
// The common Q boundary owns the existing one-second attack cooldown.
export function castTeacherAttack(room,player,now){
 requireTeacher(player);
 const size=avatarSizeOf(player),direction=player.facing||{x:0,y:1},length=Math.hypot(direction.x,direction.y)||1;
 const base={x:player.x,y:player.y,dx:direction.x/length,dy:direction.y/length,size,range:size*5,width:10,
  power:attackPowerOf(player.avatar.level,player.avatar.constellationId,player),basic:true,kind:'teacher-star',originOffset:attackGeometryOf(player).originOffset,durationMs:650};
 const projectiles=launchProjectiles(room,player,base,now,1);
 return {ready:true,target:null,targets:[],playerTargets:[],vitals:playerVitals(player),hit:{...base,playerId:player.id,mapId:player.mapId,projectiles}};
}
export function castTeacherSkill(room,player,now){
 requireTeacher(player);
 const vitals=ensureVitals(player),power=attackPowerOf(player.avatar.level,player.avatar.constellationId,player);
 ensure(now>=(player.teacherCooldownUntil||0),'스킬을 다시 쓰려면 조금 기다려주세요.');
 ensure(vitals.mp>=TEACHER_SKILL.mana,'마나가 부족해요.');
 vitals.mp-=TEACHER_SKILL.mana;player.teacherCooldownUntil=now+TEACHER_SKILL.cooldownMs;
 // Heal living, active characters (including the caster) without reviving anyone.
 const playerTargets=[];
 for(const target of room.players.values())if(target.mapId===player.mapId&&target.connected&&!target.away&&ensureVitals(target)?.hp>0){
  const value=ensureVitals(target),amount=Math.min(power,playerVitals(target).hp.max-value.hp);
  value.hp+=amount;playerTargets.push({targetId:target.id,healed:amount,vitals:playerVitals(target)});
 }
 // Keep defense, boss reflection, contribution, death/drop persistence and E retaliation intact.
 const targets=[...monstersOf(room,now).values()].filter(m=>m.mapId===player.mapId&&m.hp>0&&m.typeId!=='dark-star-card')
  .map(m=>damageMonster(room,m,player,power,now,{retaliateTeacher:true})).filter(Boolean);
 return {ready:true,cooldownMs:TEACHER_SKILL.cooldownMs,cooldowns:teacherCooldowns(player),serverNow:now,vitals:playerVitals(player),targets,playerTargets};
}
