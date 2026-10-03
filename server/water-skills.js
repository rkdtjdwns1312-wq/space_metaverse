import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf,attackGeometryOf} from '../shared/combat.js';
import {waterSkillOf,isWaterConstellation} from '../shared/water-skills.js';
import {launchProjectiles} from './projectiles.js';
import {damageTargets} from './sagittarius-skills.js';
import {monstersOf,damageMonster} from './monsters.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {ensure} from './rooms.js';

const valid=p=>p?.connected&&!p.away&&!p.avatar?.blackStar&&ensureVitals(p)?.hp>0;
export const waterCooldowns=p=>({0:p.waterCooldownUntil||0});
const active=(p,id,now)=>p?.waterAura?.kind===id&&p.waterAura.endsAt>now;

export function castWater(room,player,now,{basic=false}={}){
  ensure(isWaterConstellation(player)&&player.avatar.level>=2,'LV2 별자리부터 사용할 수 있어요.');
  ensure(valid(player),'지금은 스킬을 사용할 수 없어요.');
  const id=player.avatar.constellationId,spec=waterSkillOf(player),vitals=ensureVitals(player),size=avatarSizeOf(player);
  if(!basic){
    ensure(now>=(player.waterCooldownUntil||0),'스킬을 다시 쓰려면 조금 기다려주세요.');
    ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
    vitals.mp-=spec.mana;player.waterCooldownUntil=now+spec.cooldownMs;
    if(id==='cancer'||id==='cetus'){
      player.waterAura={kind:id,stage:spec.stage,at:now,endsAt:now+spec.durationMs,nextPulseAt:now+1000,
        mapId:player.mapId,defenseBonus:id==='cetus'?spec.defenseBonus:0};
      return {ready:true,vitals:playerVitals(player),cooldowns:waterCooldowns(player),serverNow:now};
    }
  }
  const facing=player.facing||{x:0,y:1},length=Math.hypot(facing.x,facing.y)||1,dx=facing.x/length,dy=facing.y/length;
  const boosted=id==='cancer'&&active(player,'cancer',now);
  const power=attackPowerOf(player.avatar.level,id,player);
  const visualScale=boosted?4:1;
  const base={x:player.x,y:player.y,dx,dy,size,range:size*spec.rangeWidths,
    width:size*(id==='cetus'?.28:.13)*visualScale,
    power:basic?Math.round(power*(boosted?spec.multiplier:1)):Math.round(power*spec.multiplier),
    basic,kind:`${id}-${basic?'attack':'skill'}`,vfxId:basic?'attack':`skill-lv${spec.stage}`,
    piercing:boosted||(!basic&&id==='pisces'),healing:boosted,visualScale,
    originOffset:attackGeometryOf(player).originOffset,durationMs:basic?650:900};
  // 물고기 네/두/한 마리의 타격은 서버에서 독립적으로 계산합니다.
  // 화면은 한 번의 군집 연출을 그려 중첩된 스프라이트가 번쩍이지 않게 합니다.
  const projectiles=launchProjectiles(room,player,base,now,basic?1:spec.hits);
  return {ready:true,target:null,targets:[],playerTargets:[],vitals:playerVitals(player),cooldowns:waterCooldowns(player),serverNow:now,
    hit:{...base,playerId:player.id,mapId:player.mapId,projectiles}};
}

// 기존 공통 투사체가 선택한 대상만 처리합니다. 게자리 강화 Q는 친구를
// 피해 없이 회복하며, 다른 별자리/일반 Q는 기존 학생 PvP 규칙을 따릅니다.
export function resolveWaterHit(room,player,selected,power,now,cast){
  if(!cast.healing)return damageTargets(room,player,selected,power,now);
  const targets=[],healed=[];
  for(const target of selected){
    if(target.kind==='monster'){
      const hit=damageMonster(room,target.entity,player,power,now);if(hit)targets.push(hit);
    }else{
      const friend=target.entity,value=ensureVitals(friend),before=value.hp;
      value.hp=Math.min(playerVitals(friend).hp.max,value.hp+power);
      if(value.hp>before)healed.push({targetId:friend.id,amount:value.hp-before,vitals:playerVitals(friend)});
    }
  }
  return {targets,playerTargets:[],healed};
}

export function waterAuraViews(room,mapId,now){
  return [...room.players.values()].filter(p=>p.mapId===mapId&&valid(p)&&active(p,p.avatar.constellationId,now))
    .map(p=>({playerId:p.id,mapId,kind:p.waterAura.kind,stage:p.waterAura.stage,
      elapsedMs:now-p.waterAura.at,durationMs:p.waterAura.endsAt-p.waterAura.at}));
}

export function advanceWaterAuras(room,now){
  const results=[];
  for(const player of room.players.values()){
    const aura=player.waterAura;if(!aura)continue;
    if(!valid(player)||player.avatar.constellationId!==aura.kind){player.waterAura=null;room.waterAuraChanged=true;continue;}
    aura.mapId=player.mapId;
    if(aura.kind!=='cetus'){
      if(now>=aura.endsAt){player.waterAura=null;room.waterAuraChanged=true;}
      continue;
    }
    const spec=waterSkillOf(player),size=avatarSizeOf(player);
    // E로 2배가 된 몸의 가로폭을 기준으로 400% 지름의 원형 범위입니다.
    const radius=size*2*spec.areaDiameterWidths/2;
    while(aura.nextPulseAt<=now&&aura.nextPulseAt<=aura.endsAt){
      const monsters=[...monstersOf(room).values()].filter(m=>m.hp>0&&m.mapId===player.mapId&&
        Math.hypot(m.x-player.x,m.y-player.y)<=radius+m.radius)
        .sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))
        .slice(0,spec.maxTargets);
      const power=attackPowerOf(player.avatar.level,'cetus',player),targets=[];
      for(const monster of monsters){const hit=damageMonster(room,monster,player,power,aura.nextPulseAt);if(hit)targets.push(hit);}
      results.push({mapId:player.mapId,playerId:player.id,targets,
        pulses:targets.map((t,i)=>({targetId:t.monsterId,direction:(Math.random()<.5?-1:1),index:i}))});
      aura.nextPulseAt+=1000;
    }
    if(now>=aura.endsAt){player.waterAura=null;room.waterAuraChanged=true;}
  }
  return results;
}
