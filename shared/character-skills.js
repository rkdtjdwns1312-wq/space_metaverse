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
import {skillDamageFactor} from './skill-damage.js';
import {SKILL_COOLDOWN_MS} from './combat.js';

// 레벨(입장/아이템 권한)과 현재 외형을 분리합니다. LV5는 평소 LV4 모습입니다.
export function appearanceLevelOf(player){
  const level=player?.avatar?.level||1;
  return level===5&&!player.transformation?.active?4:level;
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
  const attack={slot:'attack',key:'Q',level:2,name:'일반 공격',iconUrl:'',ready:true,description:'가까이 있는 대상을 공격해 피해를 줍니다.'};
  const skill={slot:'skill',key:'E',level:2,name:`일반 스킬 LV${level}`,iconUrl:'',ready:false,
    description:'공격력: 준비 중\n특수효과: 준비 중\n쿨타임: 준비 중\n마나소모: 준비 중'};
  if(id==='sagittarius'){
    const spec=sagittariusSkillOf(player);
    Object.assign(attack,SAGITTARIUS_ATTACK,{description:'별빛 화살을 쏘아 멀리 있는 대상에게 피해를 줍니다.'});
    Object.assign(skill,spec,{slot:'skill',level:2,ready:true,name:`${spec.name} LV${level}`,
      description:`공격력: 현재 공격력의 ${spec.multiplier*100}%\n특수효과: 관통 화살\n쿨타임: ${spec.cooldownMs/1000}초\n마나소모: ${spec.mana}`});
  }
  if(id==='corvus'){
    const spec=corvusSkillOf(player);
    Object.assign(attack,{name:'검은 깃털 투사체',iconUrl:CORVUS_VFX.attack.iconUrl,description:'검은 깃털을 날려 멀리 있는 대상에게 피해를 줍니다.'});
    Object.assign(skill,{name:corvusNames[level],iconUrl:CORVUS_VFX[`skill-lv${level}`].iconUrl,
      ready:true,description:`공격력: 현재 공격력의 ${spec.multiplier*100}% × ${spec.hits}회\n특수효과: 없음\n쿨타임: ${spec.cooldownMs/1000}초\n마나소모: ${spec.mana}`});
  }
  if(id==='aquarius'){
    const spec=aquariusSkillOf(player);
    Object.assign(attack,{name:'물방울 투사체',iconUrl:AQUARIUS_VFX.attack.iconUrl,description:'물의 기운을 쏘아 멀리 있는 대상에게 피해를 줍니다.'});
    Object.assign(skill,{name:AQUARIUS_NAMES[level],iconUrl:AQUARIUS_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 5초 기준 현재 공격력의 ${spec.multiplier*100}% (1초마다 적용)\n특수효과: 범위 안 아군 체력 5초간 ${spec.effectAmount*100}% 회복(최대 ${spec.healingAmount}, 1초마다 적용)\n쿨타임: ${spec.cooldownMs/1000}초\n마나소모: ${spec.mana}`});
  }
  if(isWaterConstellation(player)){
    const spec=waterSkillOf(player),names=WATER_NAMES[id];
    Object.assign(attack,{name:names.attack,iconUrl:WATER_VFX[id].attack.iconUrl,
      description:id==='cetus'?'파도를 일으켜 가까이 있는 대상에게 피해를 줍니다.':
        `물의 기운을 쏘아 멀리 있는 대상에게 피해를 줍니다.`});
    const damage=id==='cancer'?'직접 피해 없음':
      id==='cetus'?`주변 최대 ${spec.maxTargets}마리에게 초당 현재 공격력의 100%`:
        `현재 공격력의 ${spec.multiplier*100}% × ${spec.hits}회`;
    const effect=id==='cancer'?`${spec.durationMs/1000}초 동안 Q 물방울 강화(${spec.multiplier*100}% 피해·폭 3배·관통), 닿은 아군을 자신의 현재 공격력 100%만큼 회복`:
      id==='cetus'?`${spec.durationMs/1000}초 동안 방어력 +${spec.defenseBonus}`:'관통';
    Object.assign(skill,{name:names[level],iconUrl:WATER_VFX[id][`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: ${damage}\n특수효과: ${effect}\n쿨타임: ${spec.cooldownMs/1000}초\n마나소모: ${spec.mana}`});
  }
  if(id==='cygnus'){
    const spec=swanSkillOf(player);
    Object.assign(attack,{name:SWAN_NAMES.attack,iconUrl:SWAN_VFX.attack.iconUrl,
      description:'빛의 깃털을 날려 멀리 있는 대상에게 피해를 줍니다.'});
    Object.assign(skill,{name:SWAN_NAMES[level],iconUrl:SWAN_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 직접 피해 없음\n특수효과: ${spec.durationMs/1000}초 동안 Q마다 빛의 깃털 ${spec.feathers}개 발사 · 최대 10회\n쿨타임: 종료 후 ${spec.cooldownMs/1000}초\n마나소모: ${spec.mana}`});
  }
  if(id==='ophiuchus'){
    const spec=ophiuchusSkillOf(player);
    Object.assign(attack,{name:OPHIUCHUS_NAMES.attack,iconUrl:OPHIUCHUS_VFX.attack.iconUrl,
      description:'검은 수정 파편을 날려 멀리 있는 대상에게 피해를 줍니다.'});
    Object.assign(skill,{name:OPHIUCHUS_NAMES[level],iconUrl:OPHIUCHUS_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 지대에 처음 닿은 몬스터에게 ${spec.directMultiplier*spec.effectAmount*100}% 피해\n특수효과: 중독 ${spec.stage-1}단계 상태 부여 · 초당 공격력 ${spec.effectAmount*100}% 피해\n쿨타임: ${spec.cooldownMs/1000}초\n마나소모: ${spec.mana}`});
  }
  if(id==='gemini'){
    const spec=geminiSkillOf(player);
    Object.assign(attack,{name:GEMINI_NAMES.attack,iconUrl:GEMINI_VFX.attack.iconUrl,
      description:'쌍둥이 별을 날려 멀리 있는 대상에게 피해를 줍니다.'});
    Object.assign(skill,{name:GEMINI_NAMES[level],iconUrl:GEMINI_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 현재 공격력의 ${spec.multiplier*spec.effectAmount*100}% × ${spec.hits}회\n특수효과: 관통\n쿨타임: ${spec.cooldownMs/1000}초\n마나소모: ${spec.mana}`});
  }
  if(id==='aries'){
    const spec=ariesSkillOf(player);
    Object.assign(attack,{name:ARIES_NAMES.attack,iconUrl:ARIES_VFX.attack.iconUrl,
      description:'양털뭉치를 던져 멀리 있는 대상에게 피해를 줍니다.'});
    Object.assign(skill,{name:ARIES_NAMES[level],iconUrl:ARIES_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 수면 종료 시 현재 공격력의 ${spec.finishMultiplier*100*spec.effectAmount}%\n특수효과: 몬스터 최대 ${spec.maxTargets}마리, ${spec.durationMs/1000}초 수면 · 받는 피해 100% 증가\n쿨타임: ${spec.cooldownMs/1000}초\n마나소모: ${spec.mana}`});
  }
  if(id==='taurus'){
    const spec=taurusSkillOf(player);
    Object.assign(attack,{name:TAURUS_NAMES.attack,iconUrl:TAURUS_VFX.attack.iconUrl,
      description:'황금 코인을 던져 멀리 있는 대상에게 피해를 줍니다.'});
    Object.assign(skill,{name:TAURUS_NAMES[level],iconUrl:TAURUS_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 현재 공격력의 ${spec.multiplier*100}%\n특수효과: ${spec.durationMs/1000}초간 돌진 · 부딪힌 몬스터 1초 기절 · 돌진 중과 종료 후 1초 피해 면역\n쿨타임: ${spec.cooldownMs/1000}초\n마나소모: ${spec.mana}`});
  }
  if(id==='hercules'){
    const spec=herculesSkillOf(player);
    Object.assign(attack,{name:HERCULES_NAMES.attack,iconUrl:HERCULES_VFX.attack.iconUrl,
      description:'빛의 몽둥이로 가까이 있는 대상을 타격해 피해를 줍니다.'});
    Object.assign(skill,{name:HERCULES_NAMES[level],iconUrl:HERCULES_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 방패가 막은 피해 + 현재 공격력의 ${spec.multiplier*100}%\n특수효과: ${spec.durationMs/1000}초 방패 · 지속 종료 또는 파괴 시 주변 폭발\n쿨타임: ${spec.cooldownMs/1000}초\n마나소모: ${spec.mana}`});
  }
  if(id==='libra'){
    const spec=libraSkillOf(player);
    Object.assign(attack,{name:LIBRA_NAMES.attack,iconUrl:LIBRA_VFX.attack.iconUrl,
      description:'빛의 균형구를 날려 멀리 있는 대상에게 피해를 줍니다.'});
    Object.assign(skill,{name:LIBRA_NAMES[level],iconUrl:LIBRA_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 직접 피해 없음\n특수효과: ${spec.durationMs/1000}초간 자신과 범위 안 아군 공격력 +${spec.attackBonus} · 자신과 범위 안 아군이 받을 피해를 공격자에게 반사(중복 없음)\n쿨타임: ${spec.cooldownMs/1000}초\n마나소모: ${spec.mana}`});
  }
  if(id==='corona-borealis'){
    const spec=coronaSkillOf(player);
    Object.assign(attack,{name:CORONA_NAMES.attack,iconUrl:CORONA_VFX.attack.iconUrl,
      description:'검의 환영을 소환하여 가까이 있는 대상에게 피해를 줍니다.'});
    Object.assign(skill,{name:CORONA_NAMES[level],iconUrl:CORONA_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 직접 피해 없음\n특수효과: ${spec.durationMs/1000}초간 Q 사거리 2배 · Q 명중마다 현재 공격력의 100% 추가 피해 · 지속 중 Q·낙검이 몬스터에게 피해를 줄 때마다 자신의 체력 ${spec.hitHealing} 회복 · 종료 시 명중 횟수 × 현재 공격력의 100% 붉은 검기\n쿨타임: ${spec.cooldownMs/1000}초\n마나소모: ${spec.mana}`});
  }
  if(id==='capricorn'){
    const spec=capricornSkillOf(player);
    Object.assign(attack,{name:CAPRICORN_NAMES.attack,iconUrl:CAPRICORN_VFX.attack.iconUrl,
      description:'빛의 뿔로 가까이 있는 대상을 들이받아 피해를 줍니다.'});
    Object.assign(skill,{name:CAPRICORN_NAMES[level],iconUrl:CAPRICORN_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 직접 피해 없음\n특수효과: 최대 2명의 동료에게 ${spec.durationMs/1000}초 축복 · 자신에게도 적용 · 5초마다 체력·마나 10% 회복 · 사망 시 30% 부활 · 동료가 없으면 최대 2마리 저주(2초마다 공격력의 100% 피해), 쿨타임과 마나 절반을 돌려받음\n쿨타임: ${spec.cooldownMs/1000}초\n마나소모: ${spec.mana}`});
  }
  if(id==='leo'){
    const spec=leoSkillOf(player);
    Object.assign(attack,{name:LEO_NAMES.attack,iconUrl:LEO_VFX.attack.iconUrl,
      description:'황금 갈퀴로 가까이 있는 대상을 할퀴어 피해를 줍니다.'});
    Object.assign(skill,{name:LEO_NAMES[level],iconUrl:LEO_VFX[`skill-lv${level}`].iconUrl,ready:true,
      description:`공격력: 포효 범위에 현재 공격력의 ${spec.multiplier*100}%\n특수효과: 아군 ${spec.durationMs/1000}초간 공격력 +${spec.attackBonus}(중복 없음)\n쿨타임: ${spec.cooldownMs/1000}초\n마나소모: ${spec.mana}`});
  }
  const damageFactor=skillDamageFactor(player);
  if(skill.ready&&damageFactor>1&&!['cancer','cygnus'].includes(id)){
    const source={libra:'반사',capricorn:'저주','corona-borealis':'낙검·종료 검기'}[id]||'스킬';
    skill.description=skill.description.replace('\n',` · 장비 ${source} 피해 ×${Number(damageFactor.toFixed(2))}\n`);
  }
  const transform={slot:'transform',key:'1',level:5,name:'별자리초월',ready:TRANSFORMATION.ready,
    iconUrl:constellationOf(id,5)?.sprite||'',description:transformationDescription(player)};
  if(player?.role==='teacher'&&!player.avatar?.teacherPreview)Object.assign(skill,{name:'교사용 확인 공격',ready:true,iconUrl:'',
    description:`공격력: 피해 1\n특수효과: 없음\n쿨타임: ${SKILL_COOLDOWN_MS/1000}초\n마나소모: 0`});
  return [attack,skill,transform];
}

export function corvusSkillOf(player){const stage=skillStageOf(player);return transformedSkill(player,{level:2,stage,mana:5,cooldownMs:10000,rangeWidths:5,hits:stage,multiplier:stage===2?1:stage===3?1.5:2});}
