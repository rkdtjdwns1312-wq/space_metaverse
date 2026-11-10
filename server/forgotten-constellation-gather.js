import {randomUUID} from 'node:crypto';
import {FORGOTTEN_CONSTELLATION as spec,forgottenConstellationMap} from '../shared/forgotten-constellation.js';
import {mapOf,interactionDistance,interactionReach} from '../shared/config.js';
import {onOriginFloor} from '../shared/origin-floor.js';
import {avatarPositionIsClear} from '../shared/avatar-boundary.js';
import {vulnerable} from './forgotten-constellation-links.js';
import {damagePlayer,ensureVitals,playerVitals} from './vitals.js';
import {monsterType} from '../shared/monsters.js';
import {GameError} from './pin-auth.js';
import {playerVisibleTo} from './teacher-ghost.js';

export const CONSTELLATION_GATHER=Object.freeze({mana:20,cooldownMs:60000,durationMs:20000,lifeMs:5000,
  total:15,radius:16,decisionMs:3000,chance:.45});
const rule=CONSTELLATION_GATHER;
const take=(pool,random)=>pool.splice(Math.max(0,Math.min(pool.length-1,Math.floor(random()*pool.length))),1)[0];

function schedule(room,boss,now,random){
  const map=forgottenConstellationMap(mapOf(boss.mapId),{state:'active'});
  const points=[],largest={role:'student',avatar:{level:5},transformation:{active:true}};
  // Discrete sites guarantee distinct stars and keep the whole sprite clear of
  // the floor edge, gates, and live monster bodies even for a large avatar.
  for(let dy=-480;dy<=480;dy+=120)for(let dx=-720;dx<=720;dx+=120){
    const x=map.width/2+dx,y=map.height/2+dy;
    if(onOriginFloor(map,x,y,80)&&avatarPositionIsClear(map,x,y,largest,room.monsters.values()))points.push({x,y});
  }
  if(points.length<rule.total)return null;
  const gaps=Array.from({length:rule.total-1},(_,i)=>i+1),longGaps=new Set();
  // Fit all 15 spawns plus the final full 5s lifetime within the 20s cast.
  const extras=Math.min(1,Math.floor(random()*2));
  for(let i=0;i<extras;i++)longGaps.add(take(gaps,random));
  let appearsAt=now;
  return Array.from({length:rule.total},(_,i)=>{
    if(i>0)appearsAt+=longGaps.has(i)?2000:1000;
    return {...take(points,random),id:i+1,radius:rule.radius,appearsAt,expiresAt:appearsAt+rule.lifeMs,resolved:false};
  });
}

export function tryConstellationGather(room,boss,now,random=Math.random){
  if(boss.typeId!==spec.typeId||boss.mapId!==spec.mapId||boss.hp<=0||boss.links||boss.names||boss.gather||boss.pendingAttack||
     boss.mp<rule.mana||now<(boss.gatherReadyAt||0)||now<(boss.gatherDecisionAt||0))return false;
  boss.gatherDecisionAt=now+rule.decisionMs;
  if(![...room.players.values()].some(p=>vulnerable(p,boss))||random()>=rule.chance)return false;
  const stars=schedule(room,boss,now,random);
  if(!stars)return false;
  boss.gather={id:randomUUID(),startsAt:now,endsAt:now+rule.durationMs,stars,counts:new Map()};
  boss.gatherReadyAt=now+rule.cooldownMs;boss.mp-=rule.mana;boss.moving=false;
  return true;
}

export function constellationGatherView(boss,now){
  const cast=boss.gather;
  if(!cast||boss.hp<=0||boss.mapId!==spec.mapId||now>=cast.endsAt)return null;
  const stars=cast.stars.filter(s=>!s.resolved&&s.appearsAt<=now&&now<s.expiresAt)
    .map(({id,x,y,radius,appearsAt,expiresAt})=>({id,x,y,radius,appearsAt,expiresAt}));
  return {id:cast.id,startsAt:cast.startsAt,endsAt:cast.endsAt,serverNow:now,stars,counts:Object.fromEntries(cast.counts)};
}

// Full room snapshots include monsters on other maps. Keep this puzzle local,
// and never reveal a hidden teacher through a count attached to their ID.
export function visibleGatherMonsters(room,monsters,viewer){
  const index=monsters.findIndex(m=>m.constellationGather);
  if(index<0)return monsters;
  const boss=monsters[index],{constellationGather,...rest}=boss;
  let visible=rest;
  if(boss.mapId===viewer?.mapId){
    const entries=Object.entries(constellationGather.counts);
    const filtered=entries.filter(([id])=>playerVisibleTo(room.players.get(id),viewer));
    if(filtered.length===entries.length)return monsters;
    visible={...rest,constellationGather:{...constellationGather,counts:Object.fromEntries(filtered)}};
  }
  const copy=monsters.slice();copy[index]=visible;return copy;
}

function hitInfo(boss,p,skillKind,result){
  return {monsterId:boss.id,targetId:p.id,mapId:boss.mapId,x:p.x,y:p.y,skillKind,durationMs:450,noEffect:true,...result};
}

export function tickConstellationGather(room,boss,now){
  const cast=boss.gather,hits=[];
  if(!cast)return hits;
  if(boss.hp<=0||boss.mapId!==spec.mapId){boss.gather=null;return hits;}
  boss.moving=false;
  for(const star of cast.stars){
    if(star.resolved||now<star.expiresAt)continue;
    star.resolved=true;
    for(const player of room.players.values()){
      if(!vulnerable(player,boss))continue;
      hits.push(hitInfo(boss,player,'forgotten-gather-expire',
        damagePlayer(player,monsterType(spec.typeId).power,now,{room})));
    }
  }
  if(now>=cast.endsAt)boss.gather=null;
  return hits;
}

export function collectConstellationGather(room,player,data,now,onHit=()=>{}){
  const boss=room.monsters?.get(spec.monsterId),cast=boss?.gather;
  if(!cast||cast.id!==data.castId||!vulnerable(player,boss))throw new GameError('지금은 이 별을 모을 수 없어요.');
  // Settle expired stars and the pattern deadline before accepting a pickup.
  for(const hit of tickConstellationGather(room,boss,now))onHit(hit);
  const star=cast.stars.find(s=>s.id===data.starId);
  if(!boss.gather||!vulnerable(player,boss)||!star||star.resolved||now<star.appearsAt||now>=star.expiresAt)
    throw new GameError('지금은 이 별을 모을 수 없어요.');
  if(interactionDistance(player,star)>interactionReach(star))throw new GameError('하얀 별 가까이에서 조사해주세요.');
  star.resolved=true;
  const count=(cast.counts.get(player.id)||0)+1;
  cast.counts.set(player.id,count);
  const vitals=ensureVitals(player),maxHp=playerVitals(player).hp.max,healed=maxHp-vitals.hp;
  vitals.hp=maxHp;
  return {count,healed,vitals:playerVitals(player),message:'하얀 별을 모아 체력을 100% 회복했어요.'};
}
