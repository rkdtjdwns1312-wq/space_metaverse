// Q 기본 공격과 E/1/2 스킬을 분리합니다. 수치와 해금은 서버가 최종 검증합니다.
import {transformedSkill} from './transformation.js';
const define=ability=>Object.freeze({...ability,iconUrl:ability.iconUrl||'/assets/skills/sagittarius/'+ability.icon+'.svg'});
export const SAGITTARIUS_VFX=Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[
  id,Object.freeze({id,url:`/assets/skills/sagittarius/${id}.png`,iconUrl:`/assets/skills/sagittarius/${id}-icon.png`,
    columns:6,rows:4,frames:24,frameSize:256,anchor:{x:.5,y:.5}})
])));
export const SAGITTARIUS_NAMES=Object.freeze({2:'별빛 화살',3:'유성의 화살',4:'천궁의 화살'});
export const SAGITTARIUS_ATTACK=define({slot:'attack',key:'Q',level:2,name:'빛의 화살',iconUrl:SAGITTARIUS_VFX.attack.iconUrl,mana:0,cooldownMs:1000,rangeWidths:6,
  description:'최근 이동한 방향으로 빛의 화살을 쏩니다. 사거리: 캐릭터 가로 크기의 6배 · 피해: 현재 공격력의 100% · 마나 소모 없음 · 1초에 한 번 공격'});
export const SAGITTARIUS_SKILLS=Object.freeze([
  {slot:0,key:'E',level:2,name:'별빛 화살',iconUrl:SAGITTARIUS_VFX['skill-lv2'].iconUrl,mana:2,cooldownMs:5000,rangeWidths:6,
    description:'최근 이동한 방향으로 큰 관통 화살을 쏩니다. 사거리: 캐릭터 가로 크기의 6배 · 마나 2'},
  {slot:1,key:'1',level:4,name:'추적의 사냥꾼',icon:'hunter',mana:10,cooldownMs:15000,durationMs:10000,intervalMs:1000,
    description:'가장 가까운 적을 쫓는 꼬마 별여우를 10초 동안 소환합니다. 1초마다 현재 공격력의 100%로 총 10번 공격한 뒤 사라집니다. 마나 10 · 쿨타임 15초'},
  {slot:2,key:'2',level:5,name:'천궁의 사냥',icon:'celestial-hunt',mana:20,cooldownMs:60000,durationMs:5000,intervalMs:1000,
    description:'바라보는 방향의 가장 가까운 몬스터 위치에 캐릭터 면적의 5배인 원형 지대를 만듭니다. 1초마다 200% 화살이 총 5번 떨어지고 마지막 큰 화살이 1000% 피해를 줍니다. 마나 20 · 쿨타임 60초'},
].map(define));
export const SAGITTARIUS_ABILITIES=Object.freeze([SAGITTARIUS_ATTACK,...SAGITTARIUS_SKILLS]);
export const isSagittarius=player=>player?.avatar?.constellationId==='sagittarius';
export const sagittariusSkill=slot=>Number.isInteger(slot)?SAGITTARIUS_SKILLS[slot]||null:null;
export function sagittariusSkillOf(player){
  const stage=Math.max(2,Math.min(4,player?.avatar?.level||2));
  return transformedSkill(player,{...SAGITTARIUS_SKILLS[0],stage,name:SAGITTARIUS_NAMES[stage],
    iconUrl:SAGITTARIUS_VFX[`skill-lv${stage}`].iconUrl,
    multiplier:stage===2?5:stage===3?4:5,cooldownMs:stage===2?5000:stage===3?4000:3000});
}
