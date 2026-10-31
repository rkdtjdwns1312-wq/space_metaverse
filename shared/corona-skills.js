import {transformedSkill} from './transformation.js';

export const CORONA_VFX=Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[
  id,Object.freeze({id,url:`/assets/skills/corona-borealis/${id}.png`,iconUrl:`/assets/skills/corona-borealis/${id}-icon.png`,columns:6,rows:4,frames:24,frameSize:256})
])));
export const CORONA_NAMES=Object.freeze({attack:'붉은 검의 잔상',2:'왕관의 가호',3:'왕의 권위',4:'천상의 왕관'});
export function coronaSkillOf(player){
  const stage=Math.max(2,Math.min(4,player?.avatar?.level||2));
  return transformedSkill(player,{level:2,stage,mana:5,cooldownMs:10000,charges:5,
    enhancedMultiplier:({2:2,3:2.5,4:3})[stage],finaleMultiplier:({2:1,3:1.5,4:2})[stage],
    finaleRangeWidths:4,enhancedReachWidths:2,finaleVisualScale:3});
}
