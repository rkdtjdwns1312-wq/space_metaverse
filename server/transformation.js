import {ensureVitals} from './vitals.js';
import {TRANSFORMATION} from '../shared/character-skills.js';
import {ensure} from './rooms.js';

// 클라이언트가 레벨/지속시간을 보내도 사용하지 않습니다. 서버 설정이 기준입니다.
export function startTransformation(player,now,config=TRANSFORMATION){
  ensure(player.connected&&!player.away&&!player.avatar.blackStar,'지금은 변신할 수 없어요.');
  ensure(player.avatar.level===5&&player.role!=='teacher','LV5부터 변신할 수 있어요.');
  ensure(config.ready,'변신 시간·쿨타임·상승 능력치를 정하는 중이에요.');
  ensure(ensureVitals(player)?.hp>0,'체력을 회복하는 중이에요.');
  ensure(!player.transformation?.active,'이미 변신 중이에요.');
  ensure(now>=(player.transformation?.cooldownUntil||0),'변신을 다시 사용하려면 조금 기다려주세요.');
  player.transformation={active:true,endsAt:now+config.durationMs,cooldownUntil:now+config.cooldownMs,constellationId:player.avatar.constellationId,nextRegenAt:now+config.regenMs};
  const vitals=ensureVitals(player);vitals.hp=config.maxVitals;vitals.mp=config.maxVitals;
  return {...player.transformation};
}
export function expireTransformation(player,now){
  const state=player.transformation;
  if(!state?.active)return false;
  let changed=false;
  const vitals=ensureVitals(player);
  if(vitals.hp>0&&player.connected&&!player.away){
    while(state.nextRegenAt<=Math.min(now,state.endsAt)){
      vitals.hp=Math.min(TRANSFORMATION.maxVitals,vitals.hp+TRANSFORMATION.maxVitals*TRANSFORMATION.regenRatio);
      vitals.mp=Math.min(TRANSFORMATION.maxVitals,vitals.mp+TRANSFORMATION.maxVitals*TRANSFORMATION.regenRatio);
      state.nextRegenAt+=TRANSFORMATION.regenMs;changed=true;
    }
  }
  if(now>=state.endsAt||!player.connected||player.away||player.avatar.level!==5||player.avatar.blackStar||
    player.avatar.constellationId!==state.constellationId||player.battleVitals?.hp===0){state.active=false;ensureVitals(player);return true;}
  return changed;
}
