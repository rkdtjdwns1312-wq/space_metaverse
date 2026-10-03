import {transformedSkill} from './transformation.js';

export const HERCULES_VFX=Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[
  id,Object.freeze({id,url:`/assets/skills/hercules/${id}.png`,iconUrl:`/assets/skills/hercules/${id}-icon.png`,columns:6,rows:4,frames:24,frameSize:256})
])));
export const HERCULES_NAMES=Object.freeze({attack:'빛의 몽둥이 타격',2:'수호의 방패',3:'불굴의 수호',4:'천신의 수호'});
export function herculesSkillOf(player){
  const stage=Math.max(2,Math.min(4,player?.avatar?.level||2));
  return transformedSkill(player,{level:2,stage,mana:5,cooldownMs:15000,durationMs:5000,rangeWidths:2,
    multiplier:stage-1});
}
