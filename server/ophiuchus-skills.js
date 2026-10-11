import {randomUUID} from 'node:crypto';
import {skillDamage,skillDamageFactor} from '../shared/skill-damage.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf,attackGeometryOf} from '../shared/combat.js';
import {ophiuchusSkillOf,ophiuchusAreaAt} from '../shared/ophiuchus-skills.js';
import {mapOf} from '../shared/config.js';
import {onPlazaFloor} from '../shared/plaza-layout.js';
import {onValleyFloor} from '../shared/valley-layout.js';
import {onParadiseFloor} from '../shared/paradise-floor.js';
import {monstersOf,damageMonster} from './monsters.js';
import {launchProjectiles} from './projectiles.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {ensure} from './rooms.js';

const eligible=p=>p?.connected&&!p.away&&!p.avatar?.blackStar&&ensureVitals(p)?.hp>0;
export const ophiuchusCooldowns=p=>({0:p.ophiuchusCooldownUntil||0});

// 장비·공격력은 시전 스냅샷을 유지하지만 퇴장·사망·별자리/레벨/초월 전환은 취소합니다.
function sourceFor(room,cast,now){
  const p=room.players.get(cast.playerId);
  return !cast.cancelled&&eligible(p)&&p.mapId===cast.mapId&&p.avatar.constellationId==='ophiuchus'&&
    p.avatar.level===cast.level&&!!p.transformation?.active===cast.transformed&&
    (!cast.transformed||(p.transformation?.endsAt===cast.transformationEndsAt&&
      (!Number.isFinite(cast.transformationEndsAt)||now<cast.transformationEndsAt)))?p:null;
}
function touches(cast,monster,now){
  const area=ophiuchusAreaAt(cast,now-cast.at),radius=monster.radius||0;
  return area.rx>0&&area.ry>0&&
    ((monster.x-area.x)/(area.rx+radius))**2+((monster.y-area.y)/(area.ry+radius))**2<=1;
}

export function castOphiuchus(room,player,now,{basic=false}={}){
  ensure(player?.avatar?.constellationId==='ophiuchus'&&player.avatar.level>=2,'LV2 뱀주인자리부터 사용할 수 있어요.');
  ensure(eligible(player),'지금은 스킬을 사용할 수 없어요.');
  const size=avatarSizeOf(player),facing=player.facing||{x:0,y:1};
  const length=Math.hypot(facing.x,facing.y)||1,dx=facing.x/length,dy=facing.y/length;
  const spec=ophiuchusSkillOf(player),vitals=ensureVitals(player);
  const power=attackPowerOf(player.avatar.level,'ophiuchus',player);
  if(basic){
    const base={x:player.x,y:player.y,dx,dy,size,range:size*4,width:size*.13,power,
      basic:true,kind:'ophiuchus-attack',vfxId:'attack',originOffset:attackGeometryOf(player).originOffset,durationMs:650};
    const projectiles=launchProjectiles(room,player,base,now);
    return {ready:true,target:null,targets:[],playerTargets:[],vitals:playerVitals(player),
      hit:{...base,playerId:player.id,mapId:player.mapId,projectiles}};
  }
  ensure(now>=(player.ophiuchusCooldownUntil||0),'뱀 스킬을 다시 쓰려면 조금 기다려주세요.');
  ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
  const map=mapOf(player.mapId,room.planets?.values()||[]),{x,y}=player;
  ensure(x>=0&&y>=0&&x<=map.width&&y<=map.height&&onPlazaFloor(map,x,y)&&onValleyFloor(map,x,y)&&onParadiseFloor(map,x,y),'독구름을 펼칠 수 있는 바닥에 서 주세요.');
  const factor=skillDamageFactor(player);
  const cast={id:randomUUID(),playerId:player.id,mapId:player.mapId,level:player.avatar.level,
    transformed:!!player.transformation?.active,transformationEndsAt:player.transformation?.endsAt,
    kind:'ophiuchus-zone',stage:spec.stage,vfxId:`skill-lv${spec.stage}`,x,y:y+size*spec.centerOffset,
    size,rx:size*spec.radiusWidths,ry:size*spec.radiusWidths*spec.verticalRatio,at:now,durationMs:spec.durationMs,
    poisonMs:spec.poisonMs,directPower:skillDamage(power*spec.directMultiplier*spec.effectAmount,factor),
    poisonPower:skillDamage(power*spec.effectAmount,factor),hitIds:new Set()};
  vitals.mp-=spec.mana;player.ophiuchusCooldownUntil=now+spec.cooldownMs;
  room.ophiuchusVenoms??=[];room.ophiuchusVenoms.push(cast);
  return {ready:true,targets:[],playerTargets:[],vitals:playerVitals(player),cooldowns:ophiuchusCooldowns(player),serverNow:now};
}

export function ophiuchusViews(room,mapId,now){
  return (room.ophiuchusVenoms||[]).filter(c=>c.mapId===mapId&&now>=c.at&&now<c.at+c.durationMs&&sourceFor(room,c,now)).map(c=>{
    const {id,playerId,kind,stage,vfxId,x,y,rx,ry,size,durationMs}=c;
    return {id,playerId,mapId,kind,stage,vfxId,x,y,rx,ry,size,durationMs,elapsedMs:now-c.at};
  });
}

// 독은 하나의 틱 시계를 공유합니다. 피해량 > 단계 > 시전자 ID > 지대 ID 순으로 한 후보만 적용합니다.
const stronger=(a,b)=>b.cast.poisonPower-a.cast.poisonPower||b.cast.stage-a.cast.stage||
  a.cast.playerId.localeCompare(b.cast.playerId)||a.cast.id.localeCompare(b.cast.id);
function settlePoison(room,monster,now,activeIds){
  const poison=monster.combatPoison,events=[];let changed=false;
  if(!poison)return {events,changed};
  if(monster.hp<=0||monster.mapId!==poison.mapId||!(poison.candidates instanceof Map)){
    monster.combatPoison=null;return {events,changed:true};
  }
  for(const [id,candidate] of poison.candidates){
    const cast=candidate.cast;
    if(!sourceFor(room,cast,now)||!cast.finished&&!activeIds.has(id)){
      poison.candidates.delete(id);changed=true;
    }
  }
  const candidates=[...poison.candidates.values()].sort(stronger);
  const expiresAt=Math.max(0,...candidates.map(c=>c.expiresAt));
  while(poison.nextTickAt<=now&&poison.nextTickAt<=expiresAt){
    const tick=poison.nextTickAt;
    const winner=candidates.find(c=>c.appliedAt<=tick&&c.expiresAt>=tick);
    if(winner){
      const hit=damageMonster(room,monster,room.players.get(winner.cast.playerId),winner.cast.poisonPower,tick);
      if(hit)events.push({mapId:poison.mapId,targets:[hit],playerTargets:[]});
    }
    poison.nextTickAt+=1000;
    if(monster.hp<=0)break;
  }
  for(const [id,candidate] of poison.candidates)if(candidate.expiresAt<=now){poison.candidates.delete(id);changed=true;}
  if(monster.hp<=0||!poison.candidates.size){monster.combatPoison=null;changed=true;}
  else poison.expiresAt=Math.max(...[...poison.candidates.values()].map(c=>c.expiresAt));
  return {events,changed};
}

export function advanceOphiuchusVenoms(room,now){
  room.ophiuchusVenoms=(room.ophiuchusVenoms||[]).filter(cast=>{
    if(!sourceFor(room,cast,now)){cast.cancelled=true;return false;}
    if(now>=cast.at+cast.durationMs){cast.finished=true;return false;}
    return true;
  });
  // 과거 독틱부터 정산합니다. 지금 접촉한 강한 독이 지연된 과거 틱까지 덮어쓰면 안 됩니다.
  const {events}=advanceOphiuchusPoison(room,now);
  for(const cast of room.ophiuchusVenoms){
    if(now<cast.at)continue;
    const player=room.players.get(cast.playerId),targets=[];
    for(const monster of monstersOf(room,now).values()){
      if(monster.hp<=0||monster.mapId!==cast.mapId||!touches(cast,monster,now))continue;
      if(!cast.hitIds.has(monster.id)){
        cast.hitIds.add(monster.id);
        const hit=damageMonster(room,monster,player,cast.directPower,now);if(hit)targets.push(hit);
      }
      if(monster.hp<=0){monster.combatPoison=null;continue;}
      // 최초 피해는 재진입해도 반복하지 않으며, 독 만료 시각만 마지막 확인 접촉에서 갱신합니다.
      const poison=monster.combatPoison??={mapId:cast.mapId,candidates:new Map(),stacks:1,nextTickAt:now+1000};
      const previous=poison.candidates.get(cast.id);
      poison.candidates.set(cast.id,{cast,appliedAt:previous?.appliedAt??now,expiresAt:now+cast.poisonMs});
      poison.expiresAt=Math.max(...[...poison.candidates.values()].map(c=>c.expiresAt));
    }
    if(targets.length)events.push({mapId:cast.mapId,targets,playerTargets:[]});
  }
  return events;
}

export function advanceOphiuchusPoison(room,now){
  const events=[];let changed=false;
  const activeIds=new Set((room.ophiuchusVenoms||[]).map(c=>c.id));
  for(const monster of room.monsters?.values()||[]){
    const result=settlePoison(room,monster,now,activeIds);
    events.push(...result.events);changed||=result.changed;
  }
  return {events,changed};
}