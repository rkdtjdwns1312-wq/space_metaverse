import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf} from '../shared/combat.js';
import {leoSkillOf} from '../shared/leo-skills.js';
import {monstersOf,damageMonster} from './monsters.js';
import {damagePlayersInArea} from './area-combat.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {ensure} from './rooms.js';

export const leoCooldowns=p=>({0:p.leoCooldownUntil||0});
export function castLeo(room,player,now,{basic=false}={}){
  ensure(player?.avatar?.constellationId==='leo'&&player.avatar.level>=2,'LV2 사자자리부터 사용할 수 있어요.');
  ensure(player.connected&&!player.away&&!player.avatar.blackStar&&ensureVitals(player).hp>0,'지금은 스킬을 사용할 수 없어요.');
  const size=avatarSizeOf(player),power=attackPowerOf(player.avatar.level,'leo',player);
  if(basic){
    const direction=player.facing||{x:0,y:1},length=Math.hypot(direction.x,direction.y)||1,dx=direction.x/length,dy=direction.y/length;
    const x=player.x+dx*size*.74,y=player.y+dy*size*.74,radius=size*.46;
    const targets=[...monstersOf(room,now).values()].filter(m=>m.hp>0&&m.mapId===player.mapId&&Math.hypot(m.x-x,m.y-y)<=m.radius+radius)
      .map(m=>damageMonster(room,m,player,power,now)).filter(Boolean);
    const playerTargets=damagePlayersInArea(room,{mapId:player.mapId,x,y,radius,sourceId:player.id},power,now);
    return {ready:true,targets,playerTargets,vitals:playerVitals(player),hit:{playerId:player.id,mapId:player.mapId,x:player.x,y:player.y,
      dx,dy,reach:size*.74,radius,kind:'leo-attack',vfxId:'attack',durationMs:500,size}};
  }
  const spec=leoSkillOf(player),vitals=ensureVitals(player);
  ensure(now>=(player.leoCooldownUntil||0),'사자의 포효를 다시 쓰려면 조금 기다려주세요.');
  ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
  vitals.mp-=spec.mana;player.leoCooldownUntil=now+spec.cooldownMs;
  // 폭 4배인 타원: 가로 반축 2배, 세로 반축 1배.
  const rx=size*2,ry=size,inside=(x,y,r=0)=>((x-player.x)/(rx+r))**2+((y-player.y)/(ry+r))**2<=1;
  const targets=[...monstersOf(room,now).values()].filter(m=>m.hp>0&&m.mapId===player.mapId&&inside(m.x,m.y,m.radius))
    .map(m=>damageMonster(room,m,player,Math.round(power*spec.multiplier),now)).filter(Boolean);
  const buffed=[];
  for(const ally of room.players.values())if(ally.connected&&!ally.away&&ally.mapId===player.mapId&&
    ensureVitals(ally).hp>0&&inside(ally.x,ally.y)){
    if(!ally.leoCourage||ally.leoCourage.endsAt<=now||ally.leoCourage.bonus<spec.attackBonus)
      ally.leoCourage={bonus:spec.attackBonus,endsAt:now+spec.durationMs,stage:spec.stage};
    else ally.leoCourage.endsAt=Math.max(ally.leoCourage.endsAt,now+spec.durationMs);
    buffed.push(ally.id);
  }
  return {ready:true,targets,buffed,vitals:playerVitals(player),cooldowns:leoCooldowns(player),serverNow:now,
    visual:{playerId:player.id,mapId:player.mapId,x:player.x,y:player.y,stage:spec.stage,size,rx,ry,durationMs:1000}};
}
export function advanceLeoCourage(room,now){let changed=false;
  for(const player of room.players.values())if(player.leoCourage&&player.leoCourage.endsAt<=now){player.leoCourage=null;changed=true;}
  return changed;
}
