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
  if(id==='cancer'&&Number.isInteger(level)&&level>=2&&level<=5){
    const win={2:1,3:2,4:4,5:6}[level],loss={2:0,3:1,4:2,5:3}[level];
    return {configured:true,available:true,cancerDuel:true,win,loss,maxReward:win,minBalance:0,
      description:level===2?'접속 중인 친구와 가위바위보를 해요. 이기면 별 파편 1개를 받고, 내가 지면 위로 보상으로 1개를 받아요. 친구가 지면 별 파편은 변하지 않아요.':
        level===3?'접속 중인 친구와 동전 앞뒤를 맞혀요. 이기면 별 파편 2개, 지면 1개를 잃어요. 내가 지면 위로 보상 1개를 따로 받아요.':
        level===4?'접속 중인 친구와 주사위 눈이 큰 사람을 겨뤄요. 같은 눈이면 다시 굴려요. 이기면 별 파편 4개, 지면 2개를 잃어요. 내가 지면 위로 보상 2개를 따로 받아요.':
        '접속 중인 친구와 홀짝을 맞혀요. 이기면 별 파편 6개, 지면 3개를 잃어요. 내가 지면 위로 보상 3개를 따로 받아요.'};
  }
  if(id==='aries'&&Number.isInteger(level)&&level>=2&&level<=5)return {
    configured:true,available:true,sleep:true,maxReward:0,minBalance:0,
    description:level===2?'친구 1명이 수락하면 함께 잠들어요. 다음 날 오전 8시에 깨어나 각각 별 파편 1개를 받아요. 잠든 동안에는 행동할 수 없어요.':
      level===3?'1~3일 중 잠잘 기간을 골라요. 깨어나는 날 잠든 일수만큼 별 파편을 받아요. 잠든 동안에는 행동할 수 없어요.':
      `같은 교실의 다른 학생 중 최대 ${level===4?6:10}명을 무작위로 하루 동안 재워요. 잠든 학생은 별 파편 1개를 내고 즉시 깨어날 수 있어요.`
  };
  if(id==='corona-borealis'&&Number.isInteger(level)&&level>=2&&level<=5)return {
    configured:true,available:true,corona:true,passive:level===5,maxReward:0,minBalance:0,
    description:level===2?'유효기간 1일의 왕관 전용 우주 식량 1개를 만들어요. 조합에는 쓸 수 없어요.':
      level===3?'같은 날 유효기간이 끝나는 왕관 전용 우주 식량과 우주복을 각각 1개 만들어요.':
      level===4?'두 효과 중 하나를 골라요. ① 다음 주 월요일까지 Lv1로 지내고 복귀할 때 별 파편 5개·경험치 5를 받아요. ② 기간제 우주 식량과 우주복 2개씩 받아요(5일 또는 이번 주 일요일 0시 중 먼저 오는 때 만료).':
      '항상 자리 바꾸기와 급식 자리 선택의 우선권이 있어요. 선생님이 현실 교실에서 확인해 주세요.'
  };
  if(id==='cygnus'&&Number.isInteger(level)&&level>=2&&level<=5)return level===2?
    {configured:true,available:true,compliment:true,uses:2,maxReward:1,minBalance:0,description:'친구 1명에게 칭찬하는 귓속말을 보내고 별 파편 1개를 받아요. 매주 2회 사용할 수 있어요.'}:
    level===3?{configured:true,available:true,campaign:true,maxReward:3,minBalance:0,description:'우리 반을 위한 캠페인 푯말 문구를 작성해요. 선생님이 확인하면 광장에 설치되고 별 파편 3개를 받아요.'}:
    {configured:true,available:true,swanDaily:true,maxReward:0,minBalance:0,description:level===4?
      '월~금 오후 3시(한국 시간)까지 그날 경고를 받지 않았다면 별 파편 1개를 자동으로 받아요. 매일 한 번 판정해요.':
      '월~목 오후 3시(한국 시간)까지 그날 경고를 받지 않았다면 별 파편 1개를 자동으로 받아요. 월~목 내내 경고가 없으면 금요일에 별 카드 1장을 별 파편 4개로 구매할 기회가 생겨요.'};
  if(id==='sagittarius'&&Number.isInteger(level)&&level>=2&&level<=5)return {
    configured:true,available:true,warningHunter:true,uses:level===3||level===5?2:1,maxReward:0,minBalance:0,
    description:level===2?'내가 받은 활성 부서 경고 1개를 골라 삭제해요. 매주 1회 사용할 수 있어요.':
      level===3?'내가 받은 활성 부서 경고를 1개씩 골라 삭제해요. 매주 2회 사용할 수 있어요.':
      level===4?'내 검은별 상태와 관련 경고를 해제해요. 매주 1회 사용할 수 있어요.':
      '내 검은별 상태를 최대 2회 해제하거나, 부서 하나를 골라 그 부서에서 내가 받은 활성 경고를 모두 삭제해요. 부서 경고 전체 삭제를 고르면 이번 주 능력이 끝나요.'};
  if(id==='pisces'&&Number.isInteger(level)&&level>=2&&level<=5){
    const days={2:1,3:2,4:3,5:5}[level];
    return {configured:true,available:true,pair:true,days,maxReward:0,minBalance:0,
      description:`친구 1명에게 ${days}일 동안 짝 상태를 신청해요. 친구는 거절할 수 있어요. 수락하면 기간 동안 함께 파티가 되고 책상·급식 자리도 함께해요.${level===3||level===4?' 짝 친구가 새로 받은 경고를 나도 받아요.':' 경고 공유 페널티는 없어요.'}`};
  }
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
