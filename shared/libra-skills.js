import {sustainedSkill} from './skill-duration.js';

export const LIBRA_VFX=Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[
  id,Object.freeze({id,url:`/assets/skills/libra/${id}.png`,iconUrl:['skill-lv2','skill-lv3'].includes(id)?`/assets/skills/libra/source/scale-${id.slice(6)}-clean.png`:`/assets/skills/libra/${id}-icon.png`,columns:6,rows:4,frames:24,frameSize:256})
])));
export const LIBRA_NAMES=Object.freeze({attack:'빛의 균형구',2:'균형의 영역',3:'정의의 심판',4:'천평의 심판'});
export function libraSkillOf(player){
  const stage=Math.max(2,Math.min(4,player?.avatar?.level||2));
  return sustainedSkill(player,{level:2,stage,mana:5,cooldownMs:20000,durationMs:10000,
    radiusWidths:6,multiplier:(Math.max(2,Math.min(5,player?.avatar?.level||2))-1)*.5});
}
