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
  return value;
}
export function playerVitals(player){
  const value=ensureVitals(player),limits=vitalsOf(player?.avatar?.level,player);if(!value)return null;
  return {hp:{current:value.hp,max:limits.hp.max},mp:{current:value.mp,max:limits.mp.max},defeated:value.hp===0};
}
export const isDefeated=player=>ensureVitals(player)?.hp===0;
export function damagePlayer(player,power,now){
  const value=ensureVitals(player);if(!value||value.hp<=0)return null;
  const damage=damageAfterDefense(power,defensePowerOf(player.avatar.level,player.avatar.constellationId,player));
  value.hp=Math.max(0,value.hp-damage);
  if(value.hp===0){value.defeatedAt=now;player.input={x:0,y:0,at:0};}
  return {damage,vitals:playerVitals(player),defeated:value.hp===0};
}
