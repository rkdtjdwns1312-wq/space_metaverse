import {JOURNEY_STEPS,JOURNEY_ITEM_IDS,JOURNEY_VERSION,JOURNEY_PRACTICE_MS,JOURNEY_EQUIP_MESSAGE} from '../shared/tutorial-journey.js';
import {ensure} from './rooms.js';
import {isDefeated} from './vitals.js';

export const freshJourney=()=>({version:JOURNEY_VERSION,stage:1,goals:[],claimedAt:[],practiceUntil:0});
const timestamp=n=>Number.isSafeInteger(n)&&n>=0&&n<=8640000000000000;
export function validateJourney(value){
  if(value===undefined)return freshJourney();
  if(!value||value.version!==JOURNEY_VERSION||!Number.isInteger(value.stage)||value.stage<1||value.stage>6||
    !Array.isArray(value.goals)||new Set(value.goals).size!==value.goals.length||
    !Array.isArray(value.claimedAt)||value.claimedAt.length!==value.stage-1||value.claimedAt.some(at=>!timestamp(at)))throw Error('Invalid tutorial journey');
  const step=JOURNEY_STEPS[value.stage-1],goals=value.goals;
  if(goals.some(id=>!step?.goals.some(goal=>goal.id===id))||
    step?.ordered&&goals.some((id,i)=>id!==step.goals[i]?.id)||
    goals.includes('department-menu')&&!goals.includes('department')||
    goals.includes('effects-seen')&&!goals.includes('practice-used'))throw Error('Invalid tutorial goals');
  const practiceUntil=value.practiceUntil??0;
  if(!timestamp(practiceUntil)||practiceUntil>0&&(value.stage!==4||!goals.includes('practice-used')))throw Error('Invalid tutorial practice effect');
  return {version:JOURNEY_VERSION,stage:value.stage,goals:[...goals],claimedAt:[...value.claimedAt],practiceUntil};
}
const stateOf=p=>p.journey||freshJourney();
export const journeyComplete=p=>stateOf(p).stage===6;
export const journeyView=p=>validateJourney(p.journey);
export function practiceItems(p){return p.role==='student'&&stateOf(p).stage===4?Object.values(JOURNEY_ITEM_IDS).map(id=>({id,quantity:1})):[];}
export function journeyMissions(p){
  const journey=stateOf(p);
  return JOURNEY_STEPS.filter(step=>step.stage<=journey.stage).map(step=>({id:'first-journey-'+step.stage,kind:'tutorial',stage:step.stage,
    title:step.title,description:step.description,rewardShards:1,
    status:step.stage<journey.stage?'claimed':step.goals.every(goal=>journey.goals.includes(goal.id))?'ready':'active',
    claimedAt:journey.claimedAt[step.stage-1]??null}));
}
export function requireJourneyStudent(p){ensure(p?.role==='student'&&p.connected&&!p.away,'접속 중인 학생만 첫 여행을 진행할 수 있어요.');}
export function journeyGoal(p,id){
  if(p?.role!=='student')return false;
  const journey=stateOf(p),step=JOURNEY_STEPS[journey.stage-1],goal=step?.goals.find(g=>g.id===id);
  if(!goal||journey.goals.includes(id)||goal.requires?.some(prior=>!journey.goals.includes(prior))||
    step.ordered&&step.goals[journey.goals.length]?.id!==id)return false;
  p.journey??=freshJourney();p.journey.goals.push(id);return true;
}
export function observeJourney(p,id){
  requireJourneyStudent(p);const journey=stateOf(p),goal=JOURNEY_STEPS[journey.stage-1]?.goals.find(g=>g.id===id);
  ensure(goal?.source==='ui','현재 단계에서 화면으로 확인할 목표가 아니에요.');
  ensure(!goal.requires?.some(prior=>!journey.goals.includes(prior)),'먼저 부서행성 광장을 방문해 주세요.');
  return journeyGoal(p,id);
}
export function journeyPillar(p,objectId,now){
  if(p?.role!=='student'||!p.connected||p.away)return false;
  const journey=stateOf(p);
  if(journey.stage===1)return journeyGoal(p,objectId);
  if(journey.stage===4&&objectId==='pillar-effects'&&journey.practiceUntil>now&&journey.goals.includes('practice-used'))return journeyGoal(p,'effects-seen');
  return false;
}
// Called only after the server has resolved collision-limited movement. No client coordinates are accepted.
export function journeyTickGoals(p){
  if(p?.role!=='student'||!p.connected||p.away||isDefeated(p))return [];
  const journey=stateOf(p),step=JOURNEY_STEPS[journey.stage-1];if(!step)return [];
  if(journey.stage===1)return p.journeyMoved&&!journey.goals.includes('moved')?['moved']:[];
  const eligible=step.ordered?[step.goals[journey.goals.length]]:step.goals;
  return eligible.filter(goal=>goal?.source==='zone'&&!journey.goals.includes(goal.id)&&p.mapId===goal.mapId&&
    ((p.x-goal.x)/goal.rx)**2+((p.y-goal.y)/goal.ry)**2<=1).map(goal=>goal.id);
}
export function usePractice(p,now){
  requireJourneyStudent(p);ensure(stateOf(p).stage===4,'가방 연습 단계에서만 사용할 수 있어요.');
  ensure(timestamp(now+JOURNEY_PRACTICE_MS),'현재 시각을 확인할 수 없어요.');
  journeyGoal(p,'practice-used');p.journey.practiceUntil=now+JOURNEY_PRACTICE_MS;
  return {message:'연습용 별빛을 사용했어요. 1분 안에 사용 중인 아이템 기둥을 살펴보세요. 다시 사용할 수 있어요.',until:p.journey.practiceUntil};
}
export function equipPractice(p){
  requireJourneyStudent(p);ensure(stateOf(p).stage===4,'가방 연습 단계에서만 사용할 수 있어요.');
  journeyGoal(p,'practice-equipped');return {message:JOURNEY_EQUIP_MESSAGE};
}
export function claimJourney(p,id,now){
  requireJourneyStudent(p);const journey=stateOf(p),step=JOURNEY_STEPS[journey.stage-1];
  ensure(step&&id==='first-journey-'+step.stage,'이미 받은 보상이거나 아직 열리지 않은 미션이에요.');
  ensure(step.goals.every(goal=>journey.goals.includes(goal.id)),'아직 첫 여행 목표를 모두 마치지 않았어요.');
  ensure(timestamp(now),'완료 시각을 기록할 수 없어요.');
  p.journey={version:JOURNEY_VERSION,stage:journey.stage+1,goals:[],claimedAt:[...journey.claimedAt,now],practiceUntil:0};
  delete p.journeyMoved;
  return {completed:p.journey.stage===6};
}
export function practiceEffectRows(p,viewer,now){
  const journey=stateOf(p);
  if(viewer.id!==p.id||p.role!=='student'||journey.stage!==4||!(journey.practiceUntil>now))return [];
  return [{targetId:p.id,nickname:p.nickname,fromNickname:p.nickname,itemId:JOURNEY_ITEM_IDS.consumable,
    label:'연습용 별빛',icon:'✦',description:'튜토리얼 연습용 표시 · 재화와 능력치는 바뀌지 않아요.',until:journey.practiceUntil}];
}
