import {skillDamage,skillDamageFactor} from '../shared/skill-damage.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf,attackGeometryOf} from '../shared/combat.js';
import {libraSkillOf} from '../shared/libra-skills.js';
import {launchProjectiles} from './projectiles.js';
import {ensureVitals,playerVitals,libraProtectors} from './vitals.js';
import {ensure} from './rooms.js';
import {monstersOf,damageMonster} from './monsters.js';

export const libraCooldowns=p=>({0:p.libraCooldownUntil||0});
export function castLibra(room,player,now,{basic=false}={}){
  ensure(player?.avatar?.constellationId==='libra'&&player.avatar.level>=2,'LV2 천칭자리부터 사용할 수 있어요.');
  ensure(player.connected&&!player.away&&!player.avatar.blackStar&&ensureVitals(player).hp>0,'지금은 스킬을 사용할 수 없어요.');
  const size=avatarSizeOf(player);
  if(basic){
    const facing=player.facing||{x:0,y:1},length=Math.hypot(facing.x,facing.y)||1;
    const base={x:player.x,y:player.y,dx:facing.x/length,dy:facing.y/length,size,range:size*4,
      width:size*.13,power:attackPowerOf(player.avatar.level,'libra',player),basic:true,kind:'libra-attack',vfxId:'attack',
      originOffset:attackGeometryOf(player).originOffset,durationMs:650};
    const projectiles=launchProjectiles(room,player,base,now);
    return {ready:true,targets:[],playerTargets:[],vitals:playerVitals(player),hit:{...base,playerId:player.id,mapId:player.mapId,projectiles}};
  }
  const spec=libraSkillOf(player),vitals=ensureVitals(player);
  ensure(now>=(player.libraCooldownUntil||0),'천칭 스킬을 다시 쓰려면 조금 기다려주세요.');
  ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
  vitals.mp-=spec.mana;player.libraCooldownUntil=now+spec.cooldownMs;
  player.libraAura={at:now,endsAt:now+spec.durationMs,nextPulseAt:now+1000,stage:spec.stage,size,skillDamageFactor:skillDamageFactor(player),radius:size*spec.radiusWidths,multiplier:spec.multiplier,mapId:player.mapId};
  advanceLibraAuras(room,now);
  return {ready:true,vitals:playerVitals(player),cooldowns:libraCooldowns(player),serverNow:now};
}
export function libraAuraViews(room,mapId,now){
  return [...room.players.values()].filter(p=>p.mapId===mapId&&libraProtectors(room,p,now).includes(p))
    .map(p=>({playerId:p.id,mapId,stage:p.libraAura.stage,size:p.libraAura.size,radius:p.libraAura.radius,
      elapsedMs:now-p.libraAura.at,durationMs:p.libraAura.endsAt-p.libraAura.at}));
}
export function advanceLibraAuras(room,now){
  let changed=false;
  for(const p of room.players.values()){
    if(p.libraBuff){changed=true;}p.libraBuff=null;
    const aura=p.libraAura;if(!aura)continue;
    if(!p.connected||p.away||p.avatar?.blackStar||p.avatar?.constellationId!=='libra'||p.mapId!==aura.mapId||!(ensureVitals(p)?.hp>0)){
      p.libraAura=null;changed=true;continue;
    }
    // 첫 피해는 1초 뒤, 마지막 피해는 종료 시각에 한 번. 같은 틱을 반복해도 중복하지 않습니다.
    while(aura.nextPulseAt<=now&&aura.nextPulseAt<=aura.endsAt){
      const at=aura.nextPulseAt;aura.nextPulseAt+=1000;
      const power=skillDamage(attackPowerOf(p.avatar.level,'libra',p)*aura.multiplier,aura.skillDamageFactor);
      const targets=[...monstersOf(room,at).values()].filter(m=>m.hp>0&&m.mapId===p.mapId&&
        Math.hypot(m.x-p.x,m.y-(p.y+aura.size*.22))<=aura.radius+m.radius);
      for(const monster of targets){if(!(ensureVitals(p)?.hp>0))break;const hit=damageMonster(room,monster,p,power,at);if(hit)(room.libraHits??=[]).push({mapId:p.mapId,playerId:p.id,...hit});}
      if(!(ensureVitals(p)?.hp>0))break;
    }
    if(aura.endsAt<=now||!(ensureVitals(p)?.hp>0)){p.libraAura=null;changed=true;}
  }
  return changed;
}
