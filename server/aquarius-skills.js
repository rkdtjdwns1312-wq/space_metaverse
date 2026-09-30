import {randomUUID} from 'node:crypto';
import {aquariusSkillOf} from '../shared/aquarius-skills.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf,attackGeometryOf} from '../shared/combat.js';
import {mapOf} from '../shared/config.js';
import {onPlazaFloor} from '../shared/plaza-layout.js';
import {onValleyFloor} from '../shared/valley-layout.js';
import {onParadiseFloor} from '../shared/paradise-floor.js';
import {launchProjectiles} from './projectiles.js';
import {monstersOf,damageMonster} from './monsters.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {ensure} from './rooms.js';

const valid=p=>p?.connected&&!p.away&&!p.avatar?.blackStar&&ensureVitals(p)?.hp>0;
export const aquariusCooldowns=p=>({0:p.aquariusCooldownUntil||0});
export const inAquariusArea=(cast,p)=>((p.x-cast.x)/cast.rx)**2+((p.y-cast.y)/cast.ry)**2<=1;
export function castAquarius(room,player,now,{basic=false}={}){
  ensure(player.avatar.constellationId==='aquarius'&&player.avatar.level>=2,'LV2 물병자리부터 사용할 수 있어요.');
  ensure(valid(player),'지금은 스킬을 사용할 수 없어요.');
  const spec=aquariusSkillOf(player),size=avatarSizeOf(player),vitals=ensureVitals(player);
  const direction=player.facing||{x:0,y:1},length=Math.hypot(direction.x,direction.y)||1,dx=direction.x/length,dy=direction.y/length;
  const power=attackPowerOf(player.avatar.level,'aquarius',player);
  if(basic){
    const base={x:player.x,y:player.y,dx,dy,size,range:size*4,width:size*.13,power,basic:true,kind:'aquarius-attack',vfxId:'attack',originOffset:attackGeometryOf(player).originOffset,durationMs:650};
    const projectiles=launchProjectiles(room,player,base,now);
    return {ready:true,target:null,targets:[],playerTargets:[],vitals:playerVitals(player),hit:{...base,playerId:player.id,mapId:player.mapId,projectiles}};
  }
  ensure(now>=(player.aquariusCooldownUntil||0),'스킬을 다시 쓰려면 조금 기다려주세요.');
  ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
  const x=player.x+dx*size*spec.summonWidths,y=player.y+dy*size*spec.summonWidths,map=mapOf(player.mapId,room.planets?.values()||[]);
  ensure(x>=0&&y>=0&&x<=map.width&&y<=map.height&&onPlazaFloor(map,x,y)&&onValleyFloor(map,x,y)&&onParadiseFloor(map,x,y),'물병을 소환할 수 있는 바닥을 바라봐 주세요.');
  const cast={id:randomUUID(),playerId:player.id,mapId:player.mapId,constellationId:'aquarius',level:player.avatar.level,
    kind:'aquarius-fountain',vfxId:`skill-lv${spec.stage}`,x,y,dx,dy,size,rx:size*spec.radiusWidths,ry:size*spec.radiusWidths*spec.verticalRatio,
    at:now,durationMs:spec.durationMs,tick:0,power:Math.round(power*spec.multiplier),healCap:spec.healingAmount,healRatio:spec.effectAmount,healBudgets:new Map()};
  vitals.mp-=spec.mana;player.aquariusCooldownUntil=now+spec.cooldownMs;
  room.aquariusCasts??=new Map();room.aquariusCasts.set(cast.id,cast);
  return {ready:true,vitals:playerVitals(player),cooldowns:aquariusCooldowns(player),serverNow:now};
}
export function aquariusViews(room,mapId,now){
  return [...(room.aquariusCasts?.values()||[])].filter(c=>c.mapId===mapId&&now<c.at+c.durationMs).map(c=>{
    const {id,playerId,kind,vfxId,x,y,rx,ry,size,durationMs}=c;
    return {id,playerId,mapId,kind,vfxId,x,y,rx,ry,size,durationMs,elapsedMs:Math.max(0,now-c.at)};
  });
}
export function advanceAquarius(room,now){
  const results=[];
  for(const [id,cast] of room.aquariusCasts||[]){
    const player=room.players.get(cast.playerId);
    if(!valid(player)||player.mapId!==cast.mapId||player.avatar.constellationId!=='aquarius'||player.avatar.level!==cast.level){room.aquariusCasts.delete(id);continue;}
    // 누적 총량의 차이를 사용해 작은 공격력도 5회 반올림으로 부풀지 않습니다.
    while(cast.tick<5&&now>=cast.at+(cast.tick+1)*1000){
      const tick=++cast.tick,amount=total=>Math.floor(total*tick/5)-Math.floor(total*(tick-1)/5),targets=[],healed=[];
      const damage=amount(cast.power);
      if(damage>0)for(const monster of monstersOf(room).values())if(monster.hp>0&&monster.mapId===cast.mapId&&inAquariusArea(cast,monster)){
        const hit=damageMonster(room,monster,player,damage,cast.at+tick*1000);if(hit)targets.push(hit);
      }
      for(const target of room.players.values())if(valid(target)&&target.mapId===cast.mapId&&inAquariusArea(cast,target)){
        const state=playerVitals(target),value=ensureVitals(target);
        if(!cast.healBudgets.has(target.id))cast.healBudgets.set(target.id,Math.floor(Math.min(state.hp.max*cast.healRatio,cast.healCap)));
        const gain=Math.min(state.hp.max-value.hp,amount(cast.healBudgets.get(target.id)));
        if(gain>0){value.hp+=gain;healed.push({playerId:target.id,amount:gain,vitals:playerVitals(target)});}
      }
      results.push({mapId:cast.mapId,targets,healed});
    }
    if(cast.tick===5)room.aquariusCasts.delete(id);
  }
  return results;
}
