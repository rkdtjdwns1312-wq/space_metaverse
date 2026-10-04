import {ensureVitals,playerVitals} from './vitals.js';
import {equipmentBonus} from '../shared/equipment.js';

export const PASSIVE_RECOVERY_MS=10_000;
export const PASSIVE_RECOVERY_RATIO=.1;
export const PASSIVE_MANA_RECOVERY=2;

// 위치나 경험치처럼 저장하지 않는 전투 상태입니다. 서버 시간이 회복량을 결정합니다.
// 접속이 끊기거나 쓰러진 동안의 회복을 쌓아 두지 않습니다.
export function advancePassiveRecovery(room,now){
  const updates=[];
  for(const player of room.players.values()){
    const value=ensureVitals(player);
    if(!value)continue;
    if(!player.connected||player.away||value.hp<=0){delete value.nextPassiveRecoveryAt;continue;}
    if(value.nextPassiveRecoveryAt==null){value.nextPassiveRecoveryAt=now+PASSIVE_RECOVERY_MS;continue;}
    if(now<value.nextPassiveRecoveryAt)continue;
    const periods=Math.floor((now-value.nextPassiveRecoveryAt)/PASSIVE_RECOVERY_MS)+1;
    value.nextPassiveRecoveryAt+=periods*PASSIVE_RECOVERY_MS;
    const limits=playerVitals(player),beforeHp=value.hp,beforeMp=value.mp;
    // LV1 최대치 1도 10초 뒤 회복할 수 있도록 최소 1로 올림합니다.
    const ratio=PASSIVE_RECOVERY_RATIO+equipmentBonus(player).regen;
    value.hp=Math.min(limits.hp.max,value.hp+periods*Math.ceil(limits.hp.max*ratio));
    value.mp=Math.min(limits.mp.max,value.mp+periods*PASSIVE_MANA_RECOVERY);
    if(value.hp!==beforeHp||value.mp!==beforeMp)updates.push({playerId:player.id,vitals:playerVitals(player)});
  }
  return updates;
}
