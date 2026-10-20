export const CONSTELLATION_WEEK_MS=7*86400000;
const KST=9*3600000;
export function constellationWeekStart(now=Date.now()){
  const date=new Date(now+KST);
  return Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()-date.getUTCDay())-KST;
}
const rewards=Object.freeze({
  aquarius:Object.freeze({2:1,3:2,4:4,5:6}),
  capricorn:Object.freeze({2:Object.freeze([0,1,1,1,1,2]),3:Object.freeze([0,0,2,2,4,4]),4:Object.freeze([2,2,4,4,6,6]),5:Object.freeze([3,3,6,6,9,9])}),
  taurus:Object.freeze({2:Object.freeze([3,-1,3,-1,3,-1]),3:Object.freeze([6,-2,6,-2,6,-2]),4:Object.freeze([9,-3,9,-3,9,-3]),5:Object.freeze([12,-3,12,-3,12,-3])})
});
export function weeklyAbilityFor(id,level){
  if(id==='libra'&&level>=2&&level<=5&&Number.isInteger(level))return {
    configured:true,available:true,dice:level>=3,manualXp:level===2,rollCount:level===3?2:level===4?4:level===5?3:0,
    card:level>=4,maxReward:level===3?5:0,minBalance:0,
    description:level===2?'선생님이 확인한 주차에 따라 경험치를 받아요. 1주차 0, 2~3주차 1, 4~5주차 2예요.':
      level===3?'주사위 2개를 굴려 눈의 차이만큼 별 파편을 받아요.':
      `주사위를 ${level===4?4:3}번 굴려 같은 눈이 하나라도 있으면 뽑기 카드 1장, 모두 다르면 별 카드 1장을 받아요.`};
  if(id==='hercules'&&Number.isInteger(level)&&level>=2&&level<=5)return {configured:true,available:true,passive:true,warningLimit:level>=4?2:1,blackLimit:level===5?1:0,
    description:level===2?'부서 경고를 새로 받을 때, 매주 1회 그 경고 1회를 무효로 해요.':level===3?'부서 경고를 받을 때 별 파편 3개를 받아요. 매주 1회 자동 적용돼요.':level===4?'부서 경고를 받을 때 별 파편 3개를 받아요. 매주 2회 자동 적용돼요.':'부서 경고를 받을 때 별 파편 4개를 받아요(매주 2회). 검은별이 되면 별 파편 8개를 별도로 받아요(매주 1회).'};
  if(id==='gemini'&&Number.isInteger(level)&&level>=2&&level<=5){const budget={2:2,3:4,4:8,5:12}[level];return {configured:true,available:true,dice:false,copy:true,budget,maxReward:0,minBalance:0,
    description:`현재 가진 아이템 중 별 파편 가치 ${budget}개 이하인 아이템 1개를 복사해요. 원본은 사라지지 않아요. 조합 아이템 가치는 재료 가치 합과 조합비 1개예요.`};}
  if(id==='corvus'&&Number.isInteger(level)&&level>=2&&level<=5)return {configured:true,available:true,dice:true,craft:true,maxReward:0,minBalance:0,
    description:`주사위 ${level===2?'눈의 절반(소수점 버림)':level===3?'눈':`눈의 ${level===4?2:3}배`}만큼의 별 파편 가치 이하 아이템 1개를 만들어요. 조합 아이템 가치는 재료 가치 합과 조합비 1개예요.`};
  const reward=rewards[id]?.[level];
  if(!Number.isInteger(level)||reward===undefined)return {configured:false,available:false,description:'이 별자리의 능력은 준비 중이에요.'};
  const dice=Array.isArray(reward),description=id==='aquarius'?`별 파편 ${reward}개를 받아요.`:
    id==='taurus'?`주사위가 홀수이면 별 파편 ${reward[0]}개를 받고, 짝수이면 ${-reward[1]}개를 잃어요.`:
    level===2?'주사위 1 → 별 파편 0개\n2~5 → 1개\n6 → 2개':`주사위 1~2 → 별 파편 ${reward[0]}개\n3~4 → ${reward[2]}개\n5~6 → ${reward[4]}개`;
  return {configured:true,available:true,dice,rewards:dice?reward:null,reward:dice?null:reward,
    maxReward:dice?Math.max(...reward):reward,minBalance:dice?Math.max(0,-Math.min(...reward)):0,
    description};
}
export const corvusBudget=(level,roll)=>level===2?Math.floor(roll/2):roll*({3:1,4:2,5:3}[level]??0);
