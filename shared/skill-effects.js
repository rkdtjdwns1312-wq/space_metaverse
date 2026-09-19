import {CONSTELLATIONS} from './constellations.js';

// 시각 연출 전용 목록입니다. 피해·회복·상태·MP 같은 게임 규칙은 넣지 않습니다.
// 이후 스킬 규칙에서 effectId를 참조하거나 이 정의/렌더러만 교체할 수 있습니다.
const THEMES=Object.freeze({
  gemini:['쌍둥이 별의 공명','#ffe49b','#b7a5ff','twins'],
  corvus:['은하 깃털','#bca9ff','#a9e5ff','feathers'],
  aquarius:['별빛 물결','#87dfff','#d4b7ff','water'],
  capricorn:['산호빛 뿔','#a9eed4','#ffe1ba','spiral'],
  taurus:['황금 뿔의 궤적','#ffd993','#ffbca4','horns'],
  hercules:['거인의 별방패','#acbfff','#ffe5aa','shield'],
  libra:['균형의 빛','#d9b6ff','#ffe6b0','scales'],
  cetus:['은하 고래의 노래','#94d8ff','#e0c5ff','whale'],
  leo:['햇살 포효','#ffd17d','#ffb5c0','roar'],
  ophiuchus:['비취 별뱀','#ace7b7','#d4afff','serpent'],
  sagittarius:['유성 화살','#b4d6ff','#ffdc9d','arrow'],
  'corona-borealis':['왕관의 광휘','#ffe5a0','#edbfff','crown'],
  cancer:['달빛 집게','#9fe6ea','#ffc3d6','claws'],
  cygnus:['백조의 별날개','#e5edff','#c5bbff','wings'],
  aries:['꿈빛 구름','#f6c5eb','#d2cbff','dream'],
  pisces:['쌍물고기의 춤','#9ae7e4','#f6bcdf','fish']
});
const STAGES=Object.freeze([
  {level:2,durationMs:850,extent:110,particleCount:8,layers:1},
  {level:3,durationMs:1000,extent:135,particleCount:13,layers:2},
  {level:4,durationMs:1150,extent:160,particleCount:20,layers:3},
  {level:5,durationMs:1350,extent:185,particleCount:28,layers:4}
]);
export const SKILL_EFFECTS=Object.freeze(CONSTELLATIONS.flatMap((c,index)=>STAGES.map(stage=>{
  const [name,color,accent,motif]=THEMES[c.id];
  return Object.freeze({...stage,id:c.id+'-lv'+stage.level,constellationId:c.id,constellationName:c.name,
    name,color,accent,motif,seed:index+1});
})));
const BY_ID=new Map(SKILL_EFFECTS.map(effect=>[effect.id,effect]));
export const skillEffectOf=(constellationId,level)=>Number.isInteger(level)?BY_ID.get(constellationId+'-lv'+level)||null:null;
export const skillEffectById=id=>BY_ID.get(id)||null;
