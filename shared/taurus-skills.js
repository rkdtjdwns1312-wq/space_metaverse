import {transformedSkill} from './transformation.js';

export const TAURUS_VFX=Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[
  id,Object.freeze({id,url:`/assets/skills/taurus/${id}.png`,iconUrl:`/assets/skills/taurus/${id}-icon.png`,columns:6,rows:4,frames:24,frameSize:256})
])));
export const TAURUS_NAMES=Object.freeze({attack:'황금 코인 투척',2:'황소의 질주',3:'별의 황소',4:'천황의 질주'});
export const TAURUS_DASH_MS=420;
export function taurusSkillOf(player){
  const stage=Math.max(2,Math.min(4,player?.avatar?.level||2));
  return transformedSkill(player,{level:2,stage,mana:3,cooldownMs:({2:4000,3:3000,4:2000})[stage],rangeWidths:3.5,
    multiplier:({2:4,3:6,4:8})[stage],stunMs:1000,immuneAfterMs:1000,durationMs:TAURUS_DASH_MS});
}
