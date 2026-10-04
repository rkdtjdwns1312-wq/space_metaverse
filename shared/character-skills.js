import {TRANSFORMATION,transformationDescription,transformedSkill} from './transformation.js';
export {TRANSFORMATION} from './transformation.js';
import {SAGITTARIUS_ATTACK,sagittariusSkillOf} from './sagittarius-skills.js';
import {constellationOf} from './constellations.js';
import {AQUARIUS_VFX,AQUARIUS_NAMES,aquariusSkillOf} from './aquarius-skills.js';
import {WATER_VFX,WATER_NAMES,waterSkillOf,isWaterConstellation} from './water-skills.js';
import {SWAN_VFX,SWAN_NAMES,swanSkillOf} from './swan-skills.js';
import {OPHIUCHUS_VFX,OPHIUCHUS_NAMES,ophiuchusSkillOf} from './ophiuchus-skills.js';
import {GEMINI_VFX,GEMINI_NAMES,geminiSkillOf} from './gemini-skills.js';
import {ARIES_VFX,ARIES_NAMES,ariesSkillOf} from './aries-skills.js';
import {TAURUS_VFX,TAURUS_NAMES,taurusSkillOf} from './taurus-skills.js';
import {HERCULES_VFX,HERCULES_NAMES,herculesSkillOf} from './hercules-skills.js';
import {LIBRA_VFX,LIBRA_NAMES,libraSkillOf} from './libra-skills.js';
import {CORONA_VFX,CORONA_NAMES,coronaSkillOf} from './corona-skills.js';
import {CAPRICORN_VFX,CAPRICORN_NAMES,capricornSkillOf} from './capricorn-skills.js';
import {LEO_VFX,LEO_NAMES,leoSkillOf} from './leo-skills.js';

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
    const spec=sagittariusSkillOf(player);
    Object.assign(attack,SAGITTARIUS_ATTACK);
    Object.assign(skill,spec,{slot:'skill',level:2,ready:true,name:`${spec.name} LV${level}`,
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
    const damage=id==='cancer'?`10초 동안 Q ${spec.multiplier*100}% · 폭 3배 · 관통 · 친구 회복`:
      id==='cetus'?`10초 동안 방어력 +${spec.defenseBonus} · 주변 최대 3마리/초 공격`:
        `현재 공격력의 ${spec.multiplier*100}% × ${spec.hits}회 · 관통`;
    Object.assign(skill,{name:names[level],iconUrl:WATER_VFX[id][`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: ${damage}\n쿨타임: ${spec.cooldownMs/1000}초\n마나 소모: ${spec.mana}`});
  }
  if(id==='cygnus'){
    const spec=swanSkillOf(player);
    Object.assign(attack,{name:SWAN_NAMES.attack,iconUrl:SWAN_VFX.attack.iconUrl,
      description:`가로 크기의 4배까지 빛의 깃털을 날려요. 첫 몬스터에 닿으면 멈춰요. 날개 사용 중에는 한 번에 ${spec.feathers}개를 날려요.`});
    Object.assign(skill,{name:SWAN_NAMES[level],iconUrl:SWAN_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 빛의 깃털 ${spec.feathers}개 · 날개 ${spec.wingPairs}쌍 · 일반 공격 10회 또는 최대 20초\n쿨타임: 종료 후 10초\n마나 소모: ${spec.mana}`});
  }
  if(id==='ophiuchus'){
    const spec=ophiuchusSkillOf(player);
    Object.assign(attack,{name:OPHIUCHUS_NAMES.attack,iconUrl:OPHIUCHUS_VFX.attack.iconUrl,
      description:'가로 크기의 4배까지 검은 수정 파편을 날려요. 첫 몬스터에 닿으면 멈춰요.'});
    Object.assign(skill,{name:OPHIUCHUS_NAMES[level],iconUrl:OPHIUCHUS_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: ${spec.directMultiplier*spec.effectAmount*100}% 직접 피해 · 초당 ${spec.effectAmount*100}% 중독 피해(${spec.poisonMs/1000}초)\n쿨타임: ${spec.cooldownMs/1000}초\n마나 소모: ${spec.mana}`});
  }
  if(id==='gemini'){
    const spec=geminiSkillOf(player);
    Object.assign(attack,{name:GEMINI_NAMES.attack,iconUrl:GEMINI_VFX.attack.iconUrl,
      description:'가로 크기의 4배까지 작은 쌍둥이 별을 날려요. 첫 몬스터에서 멈추며, 마나 없이 1초에 한 번 사용해요.'});
    Object.assign(skill,{name:GEMINI_NAMES[level],iconUrl:GEMINI_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 현재 공격력의 ${spec.multiplier*spec.effectAmount*100}% × ${spec.hits}회 · 관통\n쿨타임: ${spec.cooldownMs/1000}초\n마나 소모: ${spec.mana}`});
  }
  if(id==='aries'){
    const spec=ariesSkillOf(player);
    Object.assign(attack,{name:ARIES_NAMES.attack,iconUrl:ARIES_VFX.attack.iconUrl,
      description:'가로 크기의 4배까지 작은 양털뭉치를 날려요. 첫 몬스터에서 멈추며, 마나 없이 1초에 한 번 사용해요.'});
    Object.assign(skill,{name:ARIES_NAMES[level],iconUrl:ARIES_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 몬스터 최대 3마리 수면 5초 · 받는 피해 100% 증가 · 끝에 ${spec.finishMultiplier*100}% 피해\n쿨타임: ${spec.cooldownMs/1000}초\n마나 소모: ${spec.mana}`});
  }
  if(id==='taurus'){
    const spec=taurusSkillOf(player);
    Object.assign(attack,{name:TAURUS_NAMES.attack,iconUrl:TAURUS_VFX.attack.iconUrl,
      description:'가로 크기의 4배까지 황금 코인을 날려요. 첫 몬스터에서 멈춰요.'});
    Object.assign(skill,{name:TAURUS_NAMES[level],iconUrl:TAURUS_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 현재 공격력의 ${spec.multiplier*100}% · 부딪힌 몬스터 1초 기절 · 돌진 중과 종료 후 1초 피해 면역\n쿨타임: ${spec.cooldownMs/1000}초\n마나 소모: ${spec.mana}`});
  }
  if(id==='hercules'){
    const spec=herculesSkillOf(player);
    Object.assign(attack,{name:HERCULES_NAMES.attack,iconUrl:HERCULES_VFX.attack.iconUrl,
      description:'빛의 몽둥이로 바로 앞을 타격해요. 마나 없이 1초에 한 번 사용해요.'});
    Object.assign(skill,{name:HERCULES_NAMES[level],iconUrl:HERCULES_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 방패가 막은 피해 + 현재 공격력의 ${spec.multiplier*100}% · 5초 뒤 또는 방패 파괴 시 주변 폭발\n쿨타임: ${spec.cooldownMs/1000}초\n마나 소모: ${spec.mana}`});
  }
  if(id==='libra'){
    const spec=libraSkillOf(player);
    Object.assign(attack,{name:LIBRA_NAMES.attack,iconUrl:LIBRA_VFX.attack.iconUrl,
      description:'가로 크기의 4배까지 빛의 균형구를 날려요. 첫 몬스터에서 멈춰요.'});
    Object.assign(skill,{name:LIBRA_NAMES[level],iconUrl:LIBRA_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 5초간 자신과 주변 친구 +${spec.attackBonus} · 자신이 받을 피해를 공격자에게 반사\n쿨타임: ${spec.cooldownMs/1000}초\n마나 소모: ${spec.mana}`});
  }
  if(id==='corona-borealis'){
    const spec=coronaSkillOf(player);
    Object.assign(attack,{name:CORONA_NAMES.attack,iconUrl:CORONA_VFX.attack.iconUrl,
      description:'바로 앞을 붉은 검으로 벱니다. 왕관 사용 중에는 가로 크기 2배까지 베고 명중 때 붉은 칼이 추가로 떨어집니다.'});
    Object.assign(skill,{name:CORONA_NAMES[level],iconUrl:CORONA_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 명중할 때마다 100% 추가 피해 · 종료 시 명중한 공격 횟수 × 100% 붉은 검기\n쿨타임: ${spec.cooldownMs/1000}초\n마나 소모: ${spec.mana}`});
  }
  if(id==='capricorn'){
    const spec=capricornSkillOf(player);
    Object.assign(attack,{name:CAPRICORN_NAMES.attack,iconUrl:CAPRICORN_VFX.attack.iconUrl,
      description:'빛의 뿔로 바로 앞을 들이받아요. 마나 없이 1초에 한 번 사용해요.'});
    Object.assign(skill,{name:CAPRICORN_NAMES[level],iconUrl:CAPRICORN_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: ${spec.durationMs/1000}초 축복 · 5초마다 체력·마나 10% 회복 · 치명타 시 30%로 부활 · 동료가 없으면 최대 2마리 저주\n쿨타임: ${spec.cooldownMs/1000}초\n마나 소모: ${spec.mana}`});
  }
  if(id==='leo'){
    const spec=leoSkillOf(player);
    Object.assign(attack,{name:LEO_NAMES.attack,iconUrl:LEO_VFX.attack.iconUrl,
      description:'황금 갈퀴로 바로 앞을 할퀴어요. 마나 없이 1초에 한 번 사용해요.'});
    Object.assign(skill,{name:LEO_NAMES[level],iconUrl:LEO_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 포효 범위에 현재 공격력의 ${spec.multiplier*100}% · 아군 10초간 공격력 +${spec.attackBonus}(중복 없음)\n쿨타임: ${spec.cooldownMs/1000}초\n마나 소모: ${spec.mana}`});
  }
  const transform={slot:'transform',key:'1',level:5,name:'LV5 변신',ready:TRANSFORMATION.ready,
    iconUrl:constellationOf(id,5)?.sprite||'',description:transformationDescription(player)};
  return [attack,skill,transform];
}

export function corvusSkillOf(player){const stage=skillStageOf(player);return transformedSkill(player,{level:2,stage,mana:5,cooldownMs:10000,rangeWidths:5,hits:stage,multiplier:stage===2?1:stage===3?1.5:2});}
