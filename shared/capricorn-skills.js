import {transformedSkill} from './transformation.js';
export const CAPRICORN_VFX=Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[
  id,Object.freeze({id,url:`/assets/skills/capricorn/${id}.png`,iconUrl:`/assets/skills/capricorn/${id}-icon.png`,columns:6,rows:4,frames:24,frameSize:256})
])));
export const CAPRICORN_NAMES=Object.freeze({attack:'빛의 뿔 돌진',2:'수호의 뿔',3:'별빛의 가호',4:'천상의 수호'});
export function capricornSkillOf(player){
  const stage=Math.max(2,Math.min(4,player?.avatar?.level||2));
  return transformedSkill(player,{level:2,stage,mana:({2:10,3:15,4:20})[stage],
    durationMs:({2:10000,3:15000,4:20000})[stage],
    cooldownMs:({2:20000,3:30000,4:40000})[stage],radiusWidths:3,curseTickMs:2000,healTickMs:5000});
}
