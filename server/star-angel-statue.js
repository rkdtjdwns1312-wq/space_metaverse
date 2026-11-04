import {STREET,STREET_ID} from '../shared/config.js';
import {GameError} from './pin-auth.js';
import {isNear} from './world.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {STAR_GUARDIAN_MS} from './shelter-fountain.js';

export const ANGEL_RECOVERY_MS=10000;
const ID='star-angel-recovery';
export function blessAtStarAngel(player,now=Date.now()){
 const statue=STREET.objects.find(o=>o.kind==='star-angel-statue');
 if(!player?.connected||player.away||player.mapId!==STREET_ID||!isNear(player,statue))throw new GameError('아기별 천사 석상 가까이에서 상호작용해 주세요.');
 if(!ensureVitals(player)?.hp)throw new GameError('쓰러진 동안에는 석상을 사용할 수 없어요.');
 const existing=player.effects?.find(e=>e.itemId===ID&&e.until>now);
 const nextTickAt=existing?.nextTickAt>now?existing.nextTickAt:now+ANGEL_RECOVERY_MS;
 player.effects=(player.effects||[]).filter(e=>e.itemId!==ID);
 player.effects.push({itemId:ID,statusId:ID,icon:'✧',label:'아기별 천사의 축복',style:'blessing',until:now+STAR_GUARDIAN_MS,nextTickAt});
 return {message:'아기별 천사의 축복을 받았어요! 5분 동안 10초마다 체력 1·마나 1을 추가로 회복해요.',until:now+STAR_GUARDIAN_MS};
}
export function advanceStarAngelRecovery(room,now){
 const updates=[];
 for(const p of room.players.values()){
  const effect=p.effects?.find(e=>e.itemId===ID);if(!effect)continue;
  const value=ensureVitals(p);
  if(!p.connected||p.away||!value||value.hp<=0){effect.nextTickAt=now+ANGEL_RECOVERY_MS;continue;}
  const through=Math.min(now,effect.until);if(effect.nextTickAt>through)continue;
  const periods=Math.floor((through-effect.nextTickAt)/ANGEL_RECOVERY_MS)+1;
  effect.nextTickAt+=periods*ANGEL_RECOVERY_MS;
  const limits=playerVitals(p),beforeHp=value.hp,beforeMp=value.mp;
  value.hp=Math.min(limits.hp.max,value.hp+periods);value.mp=Math.min(limits.mp.max,value.mp+periods);
  if(value.hp!==beforeHp||value.mp!==beforeMp)updates.push({playerId:p.id,vitals:playerVitals(p)});
 }
 return updates;
}
