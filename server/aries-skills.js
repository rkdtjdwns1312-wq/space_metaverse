import {randomUUID} from 'node:crypto';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf,attackGeometryOf} from '../shared/combat.js';
import {ariesSkillOf} from '../shared/aries-skills.js';
import {launchProjectiles} from './projectiles.js';
import {monstersOf,damageMonster} from './monsters.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {ensure} from './rooms.js';

const eligible=p=>p?.connected&&!p.away&&!p.avatar?.blackStar&&ensureVitals(p).hp>0;
export const ariesCooldowns=p=>({0:p.ariesCooldownUntil||0});

export function castAries(room,player,now,{basic=false}={}){
  ensure(player?.avatar?.constellationId==='aries'&&player.avatar.level>=2,'LV2 양자리부터 사용할 수 있어요.');
  ensure(eligible(player),'지금은 스킬을 사용할 수 없어요.');
  const spec=ariesSkillOf(player),vitals=ensureVitals(player),size=avatarSizeOf(player);
  const power=attackPowerOf(player.avatar.level,'aries',player);
  if(basic){
    const facing=player.facing||{x:0,y:1},length=Math.hypot(facing.x,facing.y)||1;
    const base={x:player.x,y:player.y,dx:facing.x/length,dy:facing.y/length,size,
      range:size*4,width:size*.13,power,basic:true,kind:'aries-attack',vfxId:'attack',
      originOffset:attackGeometryOf(player).originOffset,durationMs:650};
    const projectiles=launchProjectiles(room,player,base,now);
    return {ready:true,target:null,targets:[],playerTargets:[],vitals:playerVitals(player),
      hit:{...base,playerId:player.id,mapId:player.mapId,projectiles}};
  }
  ensure(now>=(player.ariesCooldownUntil||0),'양털구름 스킬을 다시 쓰려면 조금 기다려주세요.');
  ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
  const targets=[...monstersOf(room,now).values()].filter(m=>m.hp>0&&m.mapId===player.mapId)
    .sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))
    .slice(0,spec.maxTargets);
  ensure(targets.length>0,'이 맵에는 잠재울 몬스터가 없어요.');
  vitals.mp-=spec.mana;player.ariesCooldownUntil=now+spec.cooldownMs;
  room.ariesClouds??=new Map();
  for(const monster of targets){
    const cloud={id:randomUUID(),playerId:player.id,mapId:player.mapId,monsterId:monster.id,
      x:player.x,y:player.y-size*.55,at:now,endsAt:now+spec.durationMs,
      stage:spec.stage,size:size*spec.cloudScale,power:Math.round(power*spec.finishMultiplier*spec.effectAmount)};
    room.ariesClouds.set(cloud.id,cloud);
    monster.sleepUntil=Math.max(monster.sleepUntil||0,cloud.endsAt);
  }
  return {ready:true,targetIds:targets.map(m=>m.id),vitals:playerVitals(player),
    cooldowns:ariesCooldowns(player),serverNow:now};
}

export function ariesCloudViews(room,mapId,now){
  return [...room.ariesClouds?.values()||[]].filter(cloud=>cloud.mapId===mapId&&cloud.endsAt>now)
    .map(cloud=>{const monster=monstersOf(room,now).get(cloud.monsterId);return monster?.hp>0?{
      ...cloud,targetX:monster.x,targetY:monster.y-monster.radius*.9,
      elapsedMs:now-cloud.at,durationMs:cloud.endsAt-cloud.at
    }:null;}).filter(Boolean);
}

export function advanceAriesClouds(room,now){
  const hits=[];if(!room.ariesClouds)return hits;
  for(const [id,cloud] of room.ariesClouds){
    const monster=monstersOf(room,now).get(cloud.monsterId);
    if(!monster||monster.hp<=0||monster.mapId!==cloud.mapId){room.ariesClouds.delete(id);continue;}
    if(now<cloud.endsAt)continue;
    room.ariesClouds.delete(id);
    const player=room.players.get(cloud.playerId);
    if(player){const hit=damageMonster(room,monster,player,cloud.power,now,{ignoreSleep:true});
      if(hit)hits.push({mapId:cloud.mapId,...hit});}
  }
  return hits;
}
