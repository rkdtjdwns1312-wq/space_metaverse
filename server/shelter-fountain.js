import {STREET,STREET_ID} from '../shared/config.js';
import {ensure} from './rooms.js';
import {isNear} from './world.js';
import {ensureVitals,playerVitals} from './vitals.js';

export const STAR_GUARDIAN_MS=5*60*1000;
const EFFECT_ID='shelter-star-guardian';

export function blessAtShelterFountain(player,now=Date.now()){
  const fountain=STREET.objects.find(object=>object.id==='shelter-fountain');
  ensure(player?.connected&&!player.away&&player.mapId===STREET_ID&&isNear(player,fountain),'별의 수호 분수대에 가까이 가주세요.');
  const old=ensureVitals(player),wasActive=(player.effects||[]).some(effect=>effect.itemId===EFFECT_ID&&effect.until>now);
  ensure(old?.hp>0,'쓰러진 동안에는 분수대를 사용할 수 없어요. 잠시 뒤 다시 시도해 주세요.');
  const before={hp:old.hp,mp:old.mp},beforeLimits=playerVitals(player);
  player.effects=(player.effects||[]).filter(effect=>effect.itemId!==EFFECT_ID);
  player.effects.push({itemId:EFFECT_ID,statusId:'star-guardian',maxPercent:.1,icon:'✦',label:'별의 수호',style:'blessing',until:now+STAR_GUARDIAN_MS});
  const value=ensureVitals(player),limits=playerVitals(player);
  if(!wasActive){value.hp=Math.min(limits.hp.max,before.hp+(limits.hp.max-beforeLimits.hp.max));value.mp=Math.min(limits.mp.max,before.mp+(limits.mp.max-beforeLimits.mp.max));}
  return {message:'별의 수호를 받았어요! 5분 동안 최대 체력과 최대 마나가 10% 늘어나요.',until:now+STAR_GUARDIAN_MS,vitals:playerVitals(player)};
}
