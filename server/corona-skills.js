import {skillDamage,skillDamageFactor} from '../shared/skill-damage.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf} from '../shared/combat.js';
import {coronaSkillOf} from '../shared/corona-skills.js';
import {monstersOf,damageMonster} from './monsters.js';
import {damagePlayersInArea} from './area-combat.js';
import {launchProjectiles} from './projectiles.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {ensure} from './rooms.js';

export const coronaCooldowns=p=>({0:p.coronaCooldownUntil||0});

export function castCorona(room,player,now,{basic=false}={}){
  ensure(player?.avatar?.constellationId==='corona-borealis'&&player.avatar.level>=2,'LV2 왕관자리부터 사용할 수 있어요.');
  ensure(player.connected&&!player.away&&!player.avatar.blackStar&&ensureVitals(player).hp>0,'지금은 스킬을 사용할 수 없어요.');
  const size=avatarSizeOf(player),power=attackPowerOf(player.avatar.level,'corona-borealis',player,now);
  if(basic){
    const facing=player.facing||{x:0,y:1},length=Math.hypot(facing.x,facing.y)||1,dx=facing.x/length,dy=facing.y/length;
    const aura=player.coronaAura?.remaining>0&&player.coronaAura.mapId===player.mapId?player.coronaAura:null;
    const spec=aura?coronaSkillOf(player):null;
    const reach=size*(aura?spec.enhancedReachWidths:.75),width=size*(aura?.44:.48);
    const hit=attack=>aura?skillDamage(attack*spec.enhancedMultiplier,aura.skillDamageFactor):attack;
    const hitPower=hit(power),playerPower=attackPowerOf(player.avatar.level,'corona-borealis',player,now,true);
    const targets=[...monstersOf(room,now).values()].filter(m=>{
      if(m.hp<=0||m.mapId!==player.mapId)return false;
      const vx=m.x-player.x,vy=m.y-player.y,along=vx*dx+vy*dy;
      return along>=-m.radius&&along<=reach+m.radius&&Math.abs(vx*dy-vy*dx)<=width+m.radius;
    }).map(m=>damageMonster(room,m,player,hitPower,now)).filter(Boolean);
    const playerTargets=damagePlayersInArea(room,{mapId:player.mapId,x:player.x+dx*reach,y:player.y+dy*reach,
      radius:width,sourceId:player.id,basic:true},hit(playerPower),now);
    let projectiles=[];
    if(aura){
      if(targets.length)aura.successfulHits++;
      aura.remaining--;
      if(aura.remaining===0){
        player.coronaAura=null;
        const finale=attack=>skillDamage(attack*aura.successfulHits*spec.finaleMultiplier,aura.skillDamageFactor);
        projectiles=launchProjectiles(room,player,{x:player.x,y:player.y,dx,dy,size,
          range:size*spec.finaleRangeWidths,width:size*.255,power:finale(power),playerPower:finale(playerPower),basic:false,piercing:true,
          kind:'corona-finale',vfxId:'attack',originOffset:size/2,durationMs:650,
          visualScale:spec.finaleVisualScale},now);
      }
    }
    return {ready:true,targets,playerTargets,falls:[],projectiles,vitals:playerVitals(player),hit:{playerId:player.id,mapId:player.mapId,
      x:player.x,y:player.y,dx,dy,reach,radius:width,kind:'corona-attack',vfxId:'attack',durationMs:500,size}};
  }
  const spec=coronaSkillOf(player),vitals=ensureVitals(player);
  ensure(now>=(player.coronaCooldownUntil||0),'왕관 스킬을 다시 쓰려면 조금 기다려주세요.');
  ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
  vitals.mp-=spec.mana;player.coronaCooldownUntil=now+spec.cooldownMs;
  player.coronaAura={at:now,stage:spec.stage,size,skillDamageFactor:skillDamageFactor(player),
    mapId:player.mapId,remaining:spec.charges,successfulHits:0};
  return {ready:true,vitals:playerVitals(player),cooldowns:coronaCooldowns(player),serverNow:now};
}
export function coronaAuraViews(room,mapId,now){
  return [...room.players.values()].filter(p=>p.mapId===mapId&&p.coronaAura?.remaining>0)
    .map(p=>({playerId:p.id,mapId,stage:p.coronaAura.stage,size:p.coronaAura.size,
      elapsedMs:now-p.coronaAura.at,remaining:p.coronaAura.remaining,successfulHits:p.coronaAura.successfulHits}));
}
export function advanceCorona(room){
  for(const player of room.players.values()){
    const aura=player.coronaAura;
    if(aura&&(!player.connected||player.away||player.avatar?.blackStar||player.mapId!==aura.mapId||
      player.avatar?.constellationId!=='corona-borealis'||ensureVitals(player).hp<=0))player.coronaAura=null;
  }
  return {hits:[],finals:[],healed:[]};
}
