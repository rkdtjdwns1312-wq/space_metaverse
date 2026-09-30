import {SAGITTARIUS_ATTACK,SAGITTARIUS_SKILLS} from './sagittarius-skills.js';
import {constellationOf} from './constellations.js';

// 레벨(입장/아이템 권한)과 현재 외형을 분리합니다. LV5는 평소 LV4 모습입니다.
export function appearanceLevelOf(player){
  const level=player?.avatar?.level||1;
  return player?.role!=='teacher'&&level===5&&!player.transformation?.active?4:level;
}
export const skillStageOf=player=>Math.max(2,Math.min(4,player?.avatar?.level||2));
// 변신 수치는 서버와 설명 UI가 공유합니다. 레벨 권한은 그대로 유지합니다.
export const TRANSFORMATION=Object.freeze({ready:true,durationMs:30000,cooldownMs:300000,maxVitals:50,attackBonus:3,defenseBonus:-1,regenMs:5000,regenRatio:.1});
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
    Object.assign(attack,SAGITTARIUS_ATTACK);
    Object.assign(skill,SAGITTARIUS_SKILLS[0],{slot:'skill',level:2,ready:true,name:`유성화살 LV${level}`,
      description:`공격력: 현재 공격력의 ${SAGITTARIUS_SKILLS[0].damagePercent||300}%\n쿨타임: ${SAGITTARIUS_SKILLS[0].cooldownMs/1000}초\n마나 소모: ${SAGITTARIUS_SKILLS[0].mana}`});
  }
  if(id==='corvus'){
    Object.assign(attack,{name:'검은 깃털 투사체',iconUrl:CORVUS_VFX.attack.iconUrl});
    Object.assign(skill,{name:corvusNames[level],iconUrl:CORVUS_VFX[`skill-lv${level}`].iconUrl,
      ready:true,description:`공격력: ${level===2?100:level===3?150:200}% × ${level===2?2:level===3?3:4}회\n쿨타임: 10초\n마나 소모: 5`});
  }
  const transform={slot:'transform',key:'1',level:5,name:'LV5 변신',ready:TRANSFORMATION.ready,
    iconUrl:constellationOf(id,5)?.sprite||'',description:'30초 동안 LV5 모습으로 변신해요. 마나 소모 없음 · 쿨타임 300초. 체력·마나를 50/50으로 완전히 회복하고, 공격력 +3 · 방어력 -1(최소 0). 5초마다 체력·마나를 각각 5 회복해요. 종료 시 원래 최대치로 돌아가며 현재치는 그 최대치까지만 유지해요.'};
  return [attack,skill,transform];
}

export function corvusSkillOf(player){const stage=skillStageOf(player);return {level:2,stage,mana:5,cooldownMs:10000,rangeWidths:5,hits:stage,multiplier:stage===2?1:stage===3?1.5:2};}
