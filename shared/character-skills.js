import {TRANSFORMATION,transformationDescription,transformedSkill} from './transformation.js';
export {TRANSFORMATION} from './transformation.js';
import {SAGITTARIUS_ATTACK,SAGITTARIUS_SKILLS} from './sagittarius-skills.js';
import {constellationOf} from './constellations.js';
import {AQUARIUS_VFX,AQUARIUS_NAMES,aquariusSkillOf} from './aquarius-skills.js';
import {WATER_VFX,WATER_NAMES,waterSkillOf,isWaterConstellation} from './water-skills.js';

// 레벨(입장/아이템 권한)과 현재 외형을 분리합니다. LV5는 평소 LV4 모습입니다.
export function appearanceLevelOf(player){
  const level=player?.avatar?.level||1;
  return player?.role!=='teacher'&&level===5&&!player.transformation?.active?4:level;
}
export const skillStageOf=player=>Math.max(2,Math.min(4,player?.avatar?.level||2));
// 변신 수치는 서버와 설명 UI가 공유합니다. 레벨 권한은 그대로 유지합니다.

export const CORVUS_VFX=Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[id,Object.freeze({
  id,url:`/assets/skills/corvus/${id}.png`,iconUrl:`/assets/skills/corvus/${id}-icon.png`,
  columns:6,rows:4,frames:24,frameSize:id==='attack'?256:512,fps:24,durationMs:1000,anchor:{x:.5,y:.5}
})])));
const corvusNames={2:'어둠의 깃털',3:'그림자의 날개',4:'심연의 군황'};
export function characterAbilities(player){
  const level=skillStageOf(player),id=player?.avatar?.constellationId;
  const attack={slot:'attack',key:'Q',level:2,name:'일반 공격',iconUrl:'',ready:true,description:'최근 이동한 방향으로 현재 공격력만큼 공격합니다. 마나 소모 없이 1초에 한 번 사용할 수 있어요.'};
  const skill={slot:'skill',key:'E',level:2,name:`일반 스킬 LV${level}`,iconUrl:'',ready:false,
    description:'공격력: 준비 중\n쿨타임: 준비 중\n마나 소모: 준비 중'};
  if(id==='sagittarius'){
    const spec=transformedSkill(player,{...SAGITTARIUS_SKILLS[0],multiplier:3});
    Object.assign(attack,SAGITTARIUS_ATTACK);
    Object.assign(skill,SAGITTARIUS_SKILLS[0],{slot:'skill',level:2,ready:true,name:`유성화살 LV${level}`,
      description:`공격력: 현재 공격력의 ${spec.multiplier*100}%\n쿨타임: ${spec.cooldownMs/1000}초\n마나 소모: ${spec.mana}`});
  }
  if(id==='corvus'){
    const spec=corvusSkillOf(player);
    Object.assign(attack,{name:'검은 깃털 투사체',iconUrl:CORVUS_VFX.attack.iconUrl});
    Object.assign(skill,{name:corvusNames[level],iconUrl:CORVUS_VFX[`skill-lv${level}`].iconUrl,
      ready:true,description:`공격력: ${spec.multiplier*100}% × ${spec.hits}회\n쿨타임: ${spec.cooldownMs/1000}초\n마나 소모: ${spec.mana}`});
  }
  if(id==='aquarius'){
    const spec=aquariusSkillOf(player);
    Object.assign(attack,{name:'물방울 투사체',iconUrl:AQUARIUS_VFX.attack.iconUrl,description:'바라보는 방향으로 가로 크기의 4배까지 물방울을 날려요. 마나 소모 없이 현재 공격력만큼, 1초에 한 번 공격하며 첫 몬스터에서 멈춰요.'});
    Object.assign(skill,{name:AQUARIUS_NAMES[level],iconUrl:AQUARIUS_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 5초 총 ${spec.multiplier*100}% · 범위 안 친구 체력 ${spec.effectAmount*100}% 회복(최대 ${spec.healingAmount})\n쿨타임: ${spec.cooldownMs/1000}초\n마나 소모: ${spec.mana}`});
  }
  if(isWaterConstellation(player)){
    const spec=waterSkillOf(player),names=WATER_NAMES[id];
    Object.assign(attack,{name:names.attack,iconUrl:WATER_VFX[id].attack.iconUrl,
      description:id==='cetus'?'바라보는 방향 앞에 파도를 일으켜 가로 크기의 2배까지 공격해요. 마나 소모 없이 1초에 한 번 사용해요.':
        `바라보는 방향으로 가로 크기의 4배까지 ${id==='cancer'?'물방울':'별빛 물고기'}를 날려요. 마나 소모 없이 1초에 한 번 사용해요.`});
    const damage=id==='cancer'?`10초 동안 Q ${spec.multiplier*100}% · 폭 4배 · 관통 · 친구 회복`:
      id==='cetus'?`10초 동안 방어력 +${spec.defenseBonus} · 주변 최대 3마리/초 공격`:
        `현재 공격력의 ${spec.multiplier*100}% × ${spec.hits}회 · 관통`;
    Object.assign(skill,{name:names[level],iconUrl:WATER_VFX[id][`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: ${damage}\n쿨타임: ${spec.cooldownMs/1000}초\n마나 소모: ${spec.mana}`});
  }
  const transform={slot:'transform',key:'1',level:5,name:'LV5 변신',ready:TRANSFORMATION.ready,
    iconUrl:constellationOf(id,5)?.sprite||'',description:transformationDescription(player)};
  return [attack,skill,transform];
}

export function corvusSkillOf(player){const stage=skillStageOf(player);return transformedSkill(player,{level:2,stage,mana:5,cooldownMs:10000,rangeWidths:5,hits:stage,multiplier:stage===2?1:stage===3?1.5:2});}
