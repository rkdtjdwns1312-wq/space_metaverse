import {skillDamage} from '../shared/skill-damage.js';
import {vitalsOf} from '../shared/vitals.js';
import {defensePowerOf,damageAfterDefense} from '../shared/combat.js';

// 전투 HP/MP는 서버 실행 상태로 보관합니다. 스냅샷을 읽거나 재접속해도 회복되지 않습니다.
// 서버를 다시 시작하면 초기화하며, 재화/아이템의 영구 저장 형식은 변경하지 않습니다.
export function ensureVitals(player){
  const limits=vitalsOf(player?.avatar?.level,player);if(!limits)return null;
  let value=player.battleVitals;
  if(!value||value.level!==player.avatar.level||value.role!==player.role){
    value=player.battleVitals={level:player.avatar.level,role:player.role,hp:limits.hp.max,mp:limits.mp.max,defeatedAt:null};
  }
  value.hp=Math.min(value.hp,limits.hp.max);value.mp=Math.min(value.mp,limits.mp.max);
  return value;
}
export function playerVitals(player){
  const value=ensureVitals(player),limits=vitalsOf(player?.avatar?.level,player);if(!value)return null;
  return {hp:{current:value.hp,max:limits.hp.max},mp:{current:value.mp,max:limits.mp.max},defeated:value.hp===0};
}
export const isDefeated=player=>ensureVitals(player)?.hp===0;
// 기존 지원 스킬처럼 파티와 무관하게 같은 방/맵의 활동 중인 동료를 보호합니다.
// 매 타격 시 위치와 상태를 확인해 틱 사이 이동/만료에도 보호가 남지 않습니다.
export function libraProtectors(room,player,now){
  const valid=p=>p?.connected&&!p.away&&!p.avatar?.blackStar&&ensureVitals(p)?.hp>0;
  if(!valid(player))return [];
  return [...(room?.players.values()||[player])].filter(c=>{
    const aura=c.libraAura;
    return aura?.endsAt>now&&valid(c)&&c.mapId===player.mapId&&aura.mapId===c.mapId&&
      (c===player||Math.hypot(c.x-player.x,c.y+aura.size*.22-player.y)<=aura.radius);
  });
}
export function damagePlayer(player,power,now,{room=null,skipLibra=false,fixedDamage=null,silent=false}={}){
  const value=ensureVitals(player);if(!value||value.hp<=0)return null;
  if(fixedDamage===null&&(player.taurusImmuneUntil||0)>now)return {damage:0,vitals:playerVitals(player),defeated:false,immune:true};
  const damage=fixedDamage??damageAfterDefense(power,defensePowerOf(player.avatar.level,player.avatar.constellationId,player));
  if(fixedDamage===null&&!skipLibra){
    const protectors=libraProtectors(room,player,now);
    // 겹친 영역은 합산하지 않고 시전 당시 저장된 가장 높은 배율로 한 번만 반사합니다.
    if(protectors.length)return {damage:0,reflectedDamage:skillDamage(damage,Math.max(...protectors.map(c=>c.libraAura.skillDamageFactor??1))),vitals:playerVitals(player),defeated:false};
  }
  let remaining=damage;
  if(fixedDamage===null&&player.herculesShield&&player.herculesShield.endsAt>now&&player.herculesShield.hp>0){
    const absorbed=Math.min(remaining,player.herculesShield.hp);
    player.herculesShield.hp-=absorbed;player.herculesShield.absorbed+=absorbed;remaining-=absorbed;
    if(player.herculesShield.hp===0)player.herculesShield.endsAt=now;
  }
  value.hp=Math.max(0,value.hp-remaining);
  let revived=false;
  if(value.hp===0&&player.capricornBlessing?.endsAt>now){
    const limits=vitalsOf(player.avatar.level,player);
    value.hp=Math.max(1,Math.round(limits.hp.max*.3));
    value.mp=Math.max(1,Math.round(limits.mp.max*.3));
    player.capricornBlessing=null;revived=true;
  }
  if(remaining>0&&!silent){player.damageNumbers??=[];player.damageNumbers.push({targetId:player.id,targetKind:'player',mapId:player.mapId,x:player.x,y:player.y,damage:remaining});}
  if(player.damageNumbers?.length>40)player.damageNumbers.shift();
  if(value.hp===0){value.defeatedAt=now;player.input={x:0,y:0,at:0};}
  return {damage:remaining,absorbed:damage-remaining,vitals:playerVitals(player),defeated:value.hp===0,revived};
}
