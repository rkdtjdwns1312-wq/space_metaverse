export const GARDEN_RULES=Object.freeze({seedTargets:[{x:20,y:50},{x:50,y:50},{x:80,y:50}],minimumSpacing:22,
  seedCycleMs:6000,seedZoneRadius:10,sunlightStages:[4,5,6,7,8],sunlightCount:30,sunlightStageMs:10000,
  inputGapMs:150,waterTargetMs:3500,waterMaxMs:12000});
export const GARDEN_ARROWS=['up','right','down','left'];
export function seedHandX(startedAt,now){
  const phase=((Math.max(0,now-startedAt)%GARDEN_RULES.seedCycleMs)/GARDEN_RULES.seedCycleMs)*2;
  return Math.round((phase<=1?phase:2-phase)*100);
}
export function sunlightStageAt(hitCount){
  let start=0;
  for(let i=0;i<GARDEN_RULES.sunlightStages.length;i++){
    const end=start+GARDEN_RULES.sunlightStages[i];
    if(hitCount<end)return {index:i,start,end,length:GARDEN_RULES.sunlightStages[i]};
    start=end;
  }
  return null;
}
export function gardenGrade(score){const n=Number.isFinite(score)?score:0;return n>=90?{name:'아주 좋음',multiplier:1}:n>=75?{name:'좋음',multiplier:.85}:n>=55?{name:'보통',multiplier:.7}:n>=30?{name:'나쁨',multiplier:.5}:{name:'아주 나쁨',multiplier:.3};}
