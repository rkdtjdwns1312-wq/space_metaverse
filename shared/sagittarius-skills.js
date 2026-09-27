// 설명과 해금/소모량은 화면과 서버가 공유하지만 실제 판정은 서버에서만 합니다.
export const SAGITTARIUS_SKILLS=Object.freeze([
  {slot:0,key:'E',level:2,name:'빛의 화살',icon:'light-arrow',mana:1,cooldownMs:0,rangeWidths:3,
    description:'최근 이동한 방향으로 빛의 화살을 쏩니다. 사거리: 캐릭터 가로 크기의 3배 · 피해: 현재 공격력 +1 · 마나 1 · 쿨타임 없음'},
  {slot:1,key:'1',level:3,name:'유성화살',icon:'meteor-arrow',mana:5,cooldownMs:5000,rangeWidths:5,
    description:'최근 이동한 방향으로 유성화살을 쏩니다. 사거리: 캐릭터 가로 크기의 5배 · 피해: 현재 공격력의 300% · 마나 5 · 쿨타임 5초'},
  {slot:2,key:'2',level:4,name:'추적의 사냥꾼',icon:'hunter',mana:10,cooldownMs:20000,durationMs:10000,intervalMs:2000,
    description:'가장 가까운 적을 쫓는 사냥꾼을 10초 동안 소환합니다. 2초마다 현재 공격력의 100%로 총 5번 공격한 후 200% 피해로 폭발합니다. 폭발 반경: 캐릭터 가로 크기의 1배 · 마나 10 · 쿨타임 20초'},
  {slot:3,key:'3',level:5,name:'천궁의 사냥',icon:'celestial-hunt',mana:20,cooldownMs:60000,durationMs:5000,intervalMs:1000,
    description:'바라보는 방향의 가장 가까운 몬스터 위치에 캐릭터 면적의 5배인 원형 지대를 만듭니다. 5초 동안 매초 현재 공격력의 200% 피해를 주고 마지막에 500% 피해로 폭발합니다. 마나 20 · 쿨타임 60초'},
].map(skill=>Object.freeze({...skill,iconUrl:'/assets/skills/sagittarius/'+skill.icon+'.svg'})));
export const isSagittarius=player=>player?.avatar?.constellationId==='sagittarius';
export const sagittariusSkill=slot=>Number.isInteger(slot)?SAGITTARIUS_SKILLS[slot]||null:null;
