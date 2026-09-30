// 아이템을 소모하는 사용과 분리된, 학생별 주간 보유능력 기록입니다.
export const HOLDING_ITEM_IDS=Object.freeze(['galaxy-card','galaxy-cluster-card','supernova-alpha-card','supernova-beta-card','rabbit-princess-card','comet-card','alien-creature-card','supercluster-card','alien-queen-card']);
export const HOLDING_ITEMS=Object.freeze(HOLDING_ITEM_IDS.map(itemId=>Object.freeze({id:itemId,itemId,
  choice:itemId==='comet-card'?'planet':itemId==='supercluster-card'?'reward':null,
  duration:['supernova-alpha-card','supernova-beta-card','alien-creature-card'].includes(itemId)?'week':null,
  teacherConfirmation:itemId==='alien-queen-card'})));
export const holdingWeek=now=>{
  const d=new Date(now+9*3600000);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
  return d.toISOString().slice(0,10);
};
export const holdingUsed=(player,itemId,now=Date.now())=>player.holdingState?.usedWeeks?.[itemId]===holdingWeek(now);
export function validateHoldingState(value){
  if(value===undefined)return {usedWeeks:{},supernovaActiveId:null,queenReadyWeek:null};
  const bad=()=>{throw Error('보유능력 저장 데이터가 올바르지 않습니다.');};
  const week=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00+09:00'))&&holdingWeek(Date.parse(s+'T00:00:00+09:00'))===s;
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['usedWeeks','supernovaActiveId','queenReadyWeek'].includes(k)))bad();
  const {usedWeeks,supernovaActiveId,queenReadyWeek}=value;
  if(!usedWeeks||typeof usedWeeks!=='object'||Array.isArray(usedWeeks)||Object.entries(usedWeeks).some(([id,w])=>!HOLDING_ITEM_IDS.includes(id)||!week(w))||
    ![null,'supernova-alpha-card','supernova-beta-card'].includes(supernovaActiveId)||(supernovaActiveId&&!usedWeeks[supernovaActiveId])||
    (queenReadyWeek!==null&&!week(queenReadyWeek)))bad();
  return {usedWeeks:{...usedWeeks},supernovaActiveId,queenReadyWeek};
}
