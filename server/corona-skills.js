import {randomUUID} from 'node:crypto';
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
  const size=avatarSizeOf(player),power=attackPowerOf(player.avatar.level,'corona-borealis',player);
  if(basic){
    const facing=player.facing||{x:0,y:1},length=Math.hypot(facing.x,facing.y)||1,dx=facing.x/length,dy=facing.y/length;
    const active=player.coronaAura?.endsAt>now&&player.coronaAura.mapId===player.mapId;
    const reach=size*(active?2:.75),width=size*(active?.44:.48);
    const targets=[...monstersOf(room,now).values()].filter(m=>{
      if(m.hp<=0||m.mapId!==player.mapId)return false;
      const vx=m.x-player.x,vy=m.y-player.y,along=vx*dx+vy*dy;
      return along>=-m.radius&&along<=reach+m.radius&&Math.abs(vx*dy-vy*dx)<=width+m.radius;
    }).map(m=>damageMonster(room,m,player,power,now)).filter(Boolean);
    const playerTargets=damagePlayersInArea(room,{mapId:player.mapId,x:player.x+dx*reach,y:player.y+dy*reach,
      radius:width,sourceId:player.id},power,now);
    const falls=[];
    if(active&&targets.length){
      player.coronaAura.successfulHits++;
      room.coronaFalls??=new Map();
      for(const target of targets){
        const m=monstersOf(room,now).get(target.monsterId);if(!m||m.hp<=0)continue;
        const fall={id:randomUUID(),playerId:player.id,monsterId:m.id,mapId:m.mapId,x:m.x,y:m.y-m.radius,
          at:now,dueAt:now+300,power,stage:player.coronaAura.stage,size};
        room.coronaFalls.set(fall.id,fall);falls.push(fall);
      }
    }
    return {ready:true,targets,playerTargets,falls,vitals:playerVitals(player),hit:{playerId:player.id,mapId:player.mapId,
      x:player.x,y:player.y,dx,dy,reach,radius:width,kind:'corona-attack',vfxId:'attack',durationMs:500,size}};
  }
  const spec=coronaSkillOf(player),vitals=ensureVitals(player);
  ensure(now>=(player.coronaCooldownUntil||0),'왕관 스킬을 다시 쓰려면 조금 기다려주세요.');
  ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
  vitals.mp-=spec.mana;player.coronaCooldownUntil=now+spec.cooldownMs;
  player.coronaAura={at:now,endsAt:now+spec.durationMs,stage:spec.stage,size,mapId:player.mapId,successfulHits:0};
  return {ready:true,vitals:playerVitals(player),cooldowns:coronaCooldowns(player),serverNow:now};
}
export function coronaAuraViews(room,mapId,now){
  return [...room.players.values()].filter(p=>p.mapId===mapId&&p.coronaAura?.endsAt>now)
    .map(p=>({playerId:p.id,mapId,stage:p.coronaAura.stage,size:p.coronaAura.size,
      elapsedMs:now-p.coronaAura.at,durationMs:p.coronaAura.endsAt-p.coronaAura.at,successfulHits:p.coronaAura.successfulHits}));
}
export function advanceCorona(room,now){
  const hits=[],finals=[];
  for(const [id,fall] of room.coronaFalls||[]){
    if(fall.dueAt>now)continue;room.coronaFalls.delete(id);
    const player=room.players.get(fall.playerId),monster=monstersOf(room,now).get(fall.monsterId);
    if(player?.connected&&player.mapId===fall.mapId&&monster?.hp>0){const hit=damageMonster(room,monster,player,fall.power,now);
      if(hit)hits.push({mapId:fall.mapId,...hit});}
  }
  for(const player of room.players.values()){
    const aura=player.coronaAura;if(!aura||aura.endsAt>now)continue;player.coronaAura=null;
    if(!player.connected||player.away||player.mapId!==aura.mapId||player.avatar.constellationId!=='corona-borealis'||ensureVitals(player).hp<=0||!aura.successfulHits)continue;
    const target=[...monstersOf(room,now).values()].filter(m=>m.hp>0&&m.mapId===player.mapId)
      .map(m=>({monster:m,distance:Math.hypot(m.x-player.x,m.y-player.y)}))
      .filter(candidate=>candidate.distance<=aura.size*4).sort((a,b)=>a.distance-b.distance)[0];
    if(!target)continue;
    const dx=(target.monster.x-player.x)/(target.distance||1),dy=(target.monster.y-player.y)/(target.distance||1);
    const base={x:player.x,y:player.y,dx,dy,size:aura.size,range:aura.size*4,width:aura.size*.17,
      power:attackPowerOf(player.avatar.level,'corona-borealis',player)*aura.successfulHits,basic:true,
      kind:'corona-finale',vfxId:'attack',originOffset:aura.size/2,durationMs:650,visualScale:2};
    const projectiles=launchProjectiles(room,player,base,now);
    finals.push({playerId:player.id,mapId:player.mapId,projectiles,successfulHits:aura.successfulHits});
  }
  return {hits,finals};
}
