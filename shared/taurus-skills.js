import {transformedSkill} from './transformation.js';

export const TAURUS_VFX=Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[
  id,Object.freeze({id,url:`/assets/skills/taurus/${id}.png`,iconUrl:`/assets/skills/taurus/${id}-icon.png`,columns:6,rows:4,frames:24,frameSize:256})
])));
export const TAURUS_NAMES=Object.freeze({attack:'황금 코인 투척',2:'황소의 질주',3:'별의 황소',4:'천황의 질주'});
export const TAURUS_DASH_MS=2000;
// 기존 2260ms 동안 몸 너비5.25배를 가던 속도는 유지하고 지속시간만 줄입니다.
const DASH_WIDTHS_PER_MS=5.25/2260;
export function taurusSkillOf(player){
  const stage=Math.max(2,Math.min(4,player?.avatar?.level||2));
  return transformedSkill(player,{level:2,stage,mana:3,cooldownMs:({2:5000,3:4000,4:3000})[stage],rangeWidths:DASH_WIDTHS_PER_MS*TAURUS_DASH_MS,
    multiplier:({2:4,3:6,4:8})[stage],stunMs:1000,immuneAfterMs:1000,durationMs:TAURUS_DASH_MS});
}
