import {transformedSkill} from './transformation.js';

export const GEMINI_VFX=Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[
  id,Object.freeze({id,url:`/assets/skills/gemini/${id}.png`,iconUrl:`/assets/skills/gemini/${id}-icon.png`,
    columns:6,rows:4,frames:24,frameSize:256,anchor:{x:.5,y:.5}})
])));
export const GEMINI_NAMES=Object.freeze({attack:'작은 별 투사체',2:'쌍별의 궤도',3:'쌍별의 공명',4:'쌍별의 천상곡'});
export function geminiSkillOf(player){
  const stage=Math.max(2,Math.min(4,player?.avatar?.level||2));
  return transformedSkill(player,{level:2,stage,mana:5,cooldownMs:8000,rangeWidths:4,
    hits:2,multiplier:(stage-1)*2,effectAmount:1});
}
