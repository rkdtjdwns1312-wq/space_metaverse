import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf} from '../shared/combat.js';
import {herculesSkillOf} from '../shared/hercules-skills.js';
import {monstersOf,damageMonster} from './monsters.js';
import {damagePlayersInArea} from './area-combat.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {ensure} from './rooms.js';

export const herculesCooldowns=p=>({0:p.herculesCooldownUntil||0});
export function castHercules(room,player,now,{basic=false}={}){
  ensure(player?.avatar?.constellationId==='hercules'&&player.avatar.level>=2,'LV2 헤라클레스자리부터 사용할 수 있어요.');
  ensure(player.connected&&!player.away&&!player.avatar.blackStar&&ensureVitals(player).hp>0,'지금은 스킬을 사용할 수 없어요.');
  const size=avatarSizeOf(player),power=attackPowerOf(player.avatar.level,'hercules',player);
  if(basic){
    const facing=player.facing||{x:0,y:1},length=Math.hypot(facing.x,facing.y)||1,dx=facing.x/length,dy=facing.y/length;
    const x=player.x+dx*size*.75,y=player.y+dy*size*.75,radius=size*.48;
    const targets=[...monstersOf(room,now).values()].filter(m=>m.hp>0&&m.mapId===player.mapId&&Math.hypot(m.x-x,m.y-y)<=m.radius+radius)
      .map(m=>damageMonster(room,m,player,power,now)).filter(Boolean);
    const playerTargets=damagePlayersInArea(room,{mapId:player.mapId,x,y,radius,sourceId:player.id},power,now);
    return {ready:true,targets,playerTargets,vitals:playerVitals(player),hit:{playerId:player.id,mapId:player.mapId,x:player.x,y:player.y,
      dx,dy,reach:size*.75,radius,kind:'hercules-attack',vfxId:'attack',durationMs:550,size}};
  }
  const spec=herculesSkillOf(player),vitals=ensureVitals(player);
  ensure(now>=(player.herculesCooldownUntil||0),'방패 스킬을 다시 쓰려면 조금 기다려주세요.');
  ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
  vitals.mp-=spec.mana;player.herculesCooldownUntil=now+spec.cooldownMs;
  player.herculesShield={at:now,endsAt:now+spec.durationMs,hp:vitals.hp,maxHp:vitals.hp,absorbed:0,
    stage:spec.stage,size,power:Math.round(power*spec.multiplier)};
  return {ready:true,vitals:playerVitals(player),cooldowns:herculesCooldowns(player),serverNow:now};
}
export function herculesShieldViews(room,mapId,now){
  return [...room.players.values()].filter(p=>p.mapId===mapId&&p.herculesShield?.endsAt>now&&p.herculesShield.hp>0)
    .map(p=>({playerId:p.id,mapId,stage:p.herculesShield.stage,size:p.herculesShield.size,
      hp:p.herculesShield.hp,maxHp:p.herculesShield.maxHp,elapsedMs:now-p.herculesShield.at,
      durationMs:p.herculesShield.endsAt-p.herculesShield.at}));
}
export function advanceHerculesShields(room,now){
  const events=[];
  for(const player of room.players.values()){
    const shield=player.herculesShield;if(!shield)continue;
    if(shield.hp>0&&shield.endsAt>now&&player.connected&&player.mapId&&player.avatar.constellationId==='hercules')continue;
    player.herculesShield=null;
    if(!player.connected||player.away||player.avatar.constellationId!=='hercules'||ensureVitals(player).hp<=0)continue;
    const power=shield.absorbed+shield.power,radius=shield.size*2;
    const targets=[...monstersOf(room,now).values()].filter(m=>m.hp>0&&m.mapId===player.mapId&&Math.hypot(m.x-player.x,m.y-player.y)<=m.radius+radius)
      .map(m=>damageMonster(room,m,player,power,now)).filter(Boolean);
    const playerTargets=damagePlayersInArea(room,{mapId:player.mapId,x:player.x,y:player.y,radius,sourceId:player.id},power,now);
    events.push({playerId:player.id,mapId:player.mapId,x:player.x,y:player.y,radius,stage:shield.stage,size:shield.size,targets,playerTargets});
  }
  return events;
}
