import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf} from '../shared/combat.js';
import {vitalsOf} from '../shared/vitals.js';
import {capricornSkillOf} from '../shared/capricorn-skills.js';
import {monstersOf,damageMonster} from './monsters.js';
import {damagePlayersInArea} from './area-combat.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {ensure} from './rooms.js';

export const capricornCooldowns=p=>({0:p.capricornCooldownUntil||0});
export function castCapricorn(room,player,now,{basic=false}={}){
  ensure(player?.avatar?.constellationId==='capricorn'&&player.avatar.level>=2,'LV2 염소자리부터 사용할 수 있어요.');
  ensure(player.connected&&!player.away&&!player.avatar.blackStar&&ensureVitals(player).hp>0,'지금은 스킬을 사용할 수 없어요.');
  const size=avatarSizeOf(player),power=attackPowerOf(player.avatar.level,'capricorn',player);
  if(basic){
    const direction=player.facing||{x:0,y:1},length=Math.hypot(direction.x,direction.y)||1,dx=direction.x/length,dy=direction.y/length;
    const x=player.x+dx*size*.75,y=player.y+dy*size*.75,radius=size*.43;
    const targets=[...monstersOf(room,now).values()].filter(m=>m.hp>0&&m.mapId===player.mapId&&Math.hypot(m.x-x,m.y-y)<=m.radius+radius)
      .map(m=>damageMonster(room,m,player,power,now)).filter(Boolean);
    const playerTargets=damagePlayersInArea(room,{mapId:player.mapId,x,y,radius,sourceId:player.id},power,now);
    return {ready:true,targets,playerTargets,vitals:playerVitals(player),hit:{playerId:player.id,mapId:player.mapId,x:player.x,y:player.y,
      dx,dy,reach:size*.75,radius,kind:'capricorn-attack',vfxId:'attack',durationMs:500,size}};
  }
  const spec=capricornSkillOf(player),vitals=ensureVitals(player);
  ensure(now>=(player.capricornCooldownUntil||0),'염소의 뿔 스킬을 다시 쓰려면 조금 기다려주세요.');
  ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
  vitals.mp-=spec.mana;player.capricornCooldownUntil=now+spec.cooldownMs;
  const recipients=[...room.players.values()].filter(p=>p.connected&&!p.away&&p.mapId===player.mapId&&
    ensureVitals(p)?.hp>0&&Math.hypot(p.x-player.x,p.y-player.y)<=size*spec.radiusWidths);
  for(const target of recipients){
    const current=target.capricornBlessing;
    if(!current||current.endsAt<now+spec.durationMs)target.capricornBlessing={ownerId:player.id,at:now,endsAt:now+spec.durationMs,
      nextHealAt:now+spec.healTickMs,stage:spec.stage};
  }
  const cursed=[];
  if(recipients.every(p=>p.id===player.id)){
    const nearest=[...monstersOf(room,now).values()].filter(m=>m.hp>0&&m.mapId===player.mapId)
      .sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y)).slice(0,2);
    for(const monster of nearest){monster.capricornCurses??=new Map();
      monster.capricornCurses.set(player.id,{ownerId:player.id,endsAt:now+spec.durationMs,nextTickAt:now+spec.curseTickMs,power});
      cursed.push(monster.id);}
  }
  return {ready:true,recipientIds:recipients.map(p=>p.id),cursed,vitals:playerVitals(player),
    cooldowns:capricornCooldowns(player),serverNow:now};
}
export function capricornBlessingViews(room,mapId,now){
  return [...room.players.values()].filter(p=>p.mapId===mapId&&p.capricornBlessing?.endsAt>now)
    .map(p=>({playerId:p.id,mapId,stage:p.capricornBlessing.stage,remainingMs:p.capricornBlessing.endsAt-now,
      elapsedMs:now-p.capricornBlessing.at,durationMs:p.capricornBlessing.endsAt-p.capricornBlessing.at}));
}
export function advanceCapricorn(room,now){
  const healed=[],hits=[];
  for(const player of room.players.values()){
    const blessing=player.capricornBlessing;if(!blessing)continue;
    if(blessing.endsAt<now){player.capricornBlessing=null;continue;}
    if(ensureVitals(player).hp<=0)continue;
    while(blessing.nextHealAt<=now&&blessing.nextHealAt<=blessing.endsAt){
      const vitals=ensureVitals(player),limits=vitalsOf(player.avatar.level,player);
      vitals.hp=Math.min(limits.hp.max,vitals.hp+Math.round(limits.hp.max*.1));
      vitals.mp=Math.min(limits.mp.max,vitals.mp+Math.round(limits.mp.max*.1));
      blessing.nextHealAt+=5000;healed.push({playerId:player.id,vitals:playerVitals(player),mapId:player.mapId});
    }
    if(blessing.endsAt<=now)player.capricornBlessing=null;
  }
  for(const monster of monstersOf(room,now).values()){
    if(!monster.capricornCurses)continue;
    for(const [ownerId,curse] of monster.capricornCurses){
      if(monster.hp<=0||curse.endsAt<now){monster.capricornCurses.delete(ownerId);continue;}
      const owner=room.players.get(ownerId);
      while(curse.nextTickAt<=now&&curse.nextTickAt<=curse.endsAt&&monster.hp>0){
        curse.nextTickAt+=2000;
        if(owner?.connected&&owner.mapId===monster.mapId){const hit=damageMonster(room,monster,owner,curse.power,now);
          if(hit)hits.push({mapId:monster.mapId,...hit});}
      }
      if(curse.endsAt<=now)monster.capricornCurses.delete(ownerId);
    }
  }
  return {healed,hits};
}
