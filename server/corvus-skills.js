import {corvusSkillOf} from '../shared/character-skills.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf,attackGeometryOf} from '../shared/combat.js';
import {launchProjectiles} from './projectiles.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {ensure} from './rooms.js';

export const corvusCooldowns=player=>({0:player.corvusCooldownUntil||0});
export function castCorvus(room,player,now,{basic=false}={}){
  ensure(player.avatar.constellationId==='corvus'&&player.avatar.level>=2,'LV2 까마귀자리부터 사용할 수 있어요.');
  ensure(player.connected&&!player.away&&!player.avatar.blackStar&&ensureVitals(player).hp>0,'지금은 공격할 수 없어요.');
  const spec=corvusSkillOf(player),vitals=ensureVitals(player);
  if(!basic){
    ensure(now>=(player.corvusCooldownUntil||0),'스킬은 10초마다 사용할 수 있어요.');
    ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
  }
  const size=avatarSizeOf(player),direction=player.facing||{x:0,y:1},length=Math.hypot(direction.x,direction.y)||1;
  const cast={playerId:player.id,mapId:player.mapId,constellationId:'corvus',level:player.avatar.level,x:player.x,y:player.y,
    dx:direction.x/length,dy:direction.y/length,range:size*5,width:size*.13,
    power:Math.round(attackPowerOf(player.avatar.level,'corvus',player)*(basic?1:spec.multiplier)),
    basic,kind:basic?'corvus-attack':'skill',vfxId:basic?'attack':`skill-lv${spec.stage}`,size,originOffset:attackGeometryOf(player).originOffset,durationMs:basic?650:900};
  const damage={targets:[],playerTargets:[]};
  if(!basic){
    vitals.mp-=spec.mana;player.corvusCooldownUntil=now+spec.cooldownMs;

  }
  const projectiles=launchProjectiles(room,player,cast,now,basic?1:spec.hits);
  return {ready:true,...damage,target:damage.targets[0]||null,vitals:playerVitals(player),cooldowns:corvusCooldowns(player),serverNow:now,
    hit:{projectiles,kind:basic?'corvus-attack':'skill',vfxId:basic?'attack':`skill-lv${spec.stage}`,playerId:player.id,mapId:player.mapId,
      x:player.x,y:player.y,dx:cast.dx,dy:cast.dy,durationMs:1000,range:cast.range,power:cast.power,...attackGeometryOf(player)}};
}
