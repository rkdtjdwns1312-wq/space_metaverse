// Q 기본 공격과 E/1/2 스킬을 분리합니다. 수치와 해금은 서버가 최종 검증합니다.
const define=ability=>Object.freeze({...ability,iconUrl:'/assets/skills/sagittarius/'+ability.icon+'.svg'});
export const SAGITTARIUS_ATTACK=define({slot:'attack',key:'Q',level:2,name:'빛의 화살',icon:'light-arrow',mana:0,cooldownMs:1000,rangeWidths:3,
  description:'최근 이동한 방향으로 빛의 화살을 쏩니다. 사거리: 캐릭터 가로 크기의 3배 · 피해: 현재 공격력의 100% · 마나 소모 없음 · 1초에 한 번 공격'});
export const SAGITTARIUS_SKILLS=Object.freeze([
  {slot:0,key:'E',level:3,name:'유성화살',icon:'meteor-arrow',mana:5,cooldownMs:5000,rangeWidths:5,
    description:'최근 이동한 방향으로 유성화살을 쏩니다. 사거리: 캐릭터 가로 크기의 5배 · 피해: 현재 공격력의 300% · 마나 5 · 쿨타임 5초'},
  {slot:1,key:'1',level:4,name:'추적의 사냥꾼',icon:'hunter',mana:10,cooldownMs:15000,durationMs:10000,intervalMs:1000,
    description:'가장 가까운 적을 쫓는 꼬마 별여우를 10초 동안 소환합니다. 1초마다 현재 공격력의 100%로 총 10번 공격한 뒤 사라집니다. 마나 10 · 쿨타임 15초'},
  {slot:2,key:'2',level:5,name:'천궁의 사냥',icon:'celestial-hunt',mana:20,cooldownMs:60000,durationMs:5000,intervalMs:1000,
    description:'바라보는 방향의 가장 가까운 몬스터 위치에 캐릭터 면적의 5배인 원형 지대를 만듭니다. 1초마다 200% 화살이 총 5번 떨어지고 마지막 큰 화살이 1000% 피해를 줍니다. 마나 20 · 쿨타임 60초'},
].map(define));
export const SAGITTARIUS_ABILITIES=Object.freeze([SAGITTARIUS_ATTACK,...SAGITTARIUS_SKILLS]);
export const isSagittarius=player=>player?.avatar?.constellationId==='sagittarius';
export const sagittariusSkill=slot=>Number.isInteger(slot)?SAGITTARIUS_SKILLS[slot]||null:null;
