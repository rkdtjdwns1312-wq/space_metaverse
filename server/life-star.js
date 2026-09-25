import {MAP,PLAZA_ID} from '../shared/config.js';
import {ensure} from './rooms.js';
import {isNear} from './world.js';
import {ensureVitals,playerVitals} from './vitals.js';

export const LIFE_RECOVERY_MS=10_000;
const STEPS=10;
export function startLifeRecovery(player,now){
  const star=MAP.objects.find(o=>o.kind==='life-star');
  ensure(player?.connected&&!player.away,'먼저 교실에 입장해주세요.');
  ensure(player.mapId===PLAZA_ID&&isNear(player,star),'생명의별 가까이에서 조사해주세요.');
  const value=ensureVitals(player),limits=playerVitals(player);
  ensure(value&&value.hp>0,'체력을 회복하는 중이에요. 잠시 기다려주세요.');
  // 반복 상호작용은 회복 시간을 줄이거나 다시 시작하지 않습니다.
  if(value.lifeRecovery)return {message:'생명의별이 체력과 마나를 회복하고 있어요.'};
  if(value.hp===limits.hp.max&&value.mp===limits.mp.max)return {message:'체력과 마나가 이미 가득해요.'};
  value.lifeRecovery={startedAt:now,step:0};
  return {message:'생명의별이 10초 동안 체력과 마나를 회복해요.'};
}

// HP/MP처럼 회복 중 상태도 일시적인 전투 정보입니다. 재화 저장과 분리합니다.
// 1초마다 남은 회복량을 남은 횟수로 나누므로 정수이며 10초째에 가득 찹니다.
export function advanceLifeRecovery(room,now){
  const updates=[];
  for(const player of room.players.values()){
    const value=player.battleVitals,recovery=value?.lifeRecovery;
    if(!recovery)continue;
    if(!player.connected||player.away||value.hp<=0||ensureVitals(player)!==value){delete value.lifeRecovery;continue;}
    const step=Math.min(STEPS,Math.floor((now-recovery.startedAt)/(LIFE_RECOVERY_MS/STEPS)));
    if(step<=recovery.step)continue;
    const limits=playerVitals(player),fraction=(step-recovery.step)/(STEPS-recovery.step);
    value.hp=Math.min(limits.hp.max,value.hp+Math.floor((limits.hp.max-value.hp)*fraction));
    value.mp=Math.min(limits.mp.max,value.mp+Math.floor((limits.mp.max-value.mp)*fraction));
    recovery.step=step;
    const complete=step===STEPS;
    if(complete)delete value.lifeRecovery;
    updates.push({playerId:player.id,vitals:playerVitals(player),complete});
  }
  return updates;
}
