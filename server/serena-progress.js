const REQUIRED=['leoon','noksera'];
export function validateSerenaProgress(value,avatar,role='student'){
  if(value===undefined)return {highestLevel:role==='student'?Math.min(5,Math.max(1,avatar?.level||1)):1,bossKills:[]};
  if(!value||!Number.isInteger(value.highestLevel)||value.highestLevel<1||value.highestLevel>5||
    !Array.isArray(value.bossKills)||value.bossKills.some(id=>!REQUIRED.includes(id))||new Set(value.bossKills).size!==value.bossKills.length)
    throw new Error('세레나 자격 저장 데이터가 올바르지 않습니다.');
  return {highestLevel:Math.max(value.highestLevel,role==='student'?Math.min(5,avatar?.level||1):1),bossKills:[...value.bossKills]};
}
export function recordSerenaLevel(player){
  const progress=validateSerenaProgress(player.serenaProgress,player.avatar,player.role);
  progress.highestLevel=Math.max(progress.highestLevel,Math.min(5,player.avatar?.level||1));
  player.serenaProgress=progress;
}
export function serenaEligibility(player){
  const progress=validateSerenaProgress(player.serenaProgress,player.avatar,player.role);
  return {reachedLv5:progress.highestLevel>=5,defeatedLeoon:progress.bossKills.includes('leoon'),defeatedNoksera:progress.bossKills.includes('noksera')};
}
export const serenaEligible=player=>Object.values(serenaEligibility(player)).every(Boolean);
export function bossVictoryCredits(room,monster,contributors){
  return [...contributors].filter(([id,damage])=>{
    const p=room.players?.get(id);return damage>0&&p?.connected&&!p.away&&p.mapId===monster.mapId;
  }).map(([id])=>{const p=room.players.get(id);return {id,highestLevel:validateSerenaProgress(p.serenaProgress,p.avatar,p.role).highestLevel};});
}
export function recordBossVictory(room,monster,contributors,credits=bossVictoryCredits(room,monster,contributors)){
  if(!REQUIRED.includes(monster.typeId))return;
  for(const {id,highestLevel} of credits){
    const p=room.players?.get(id);
    // 보상 파티 분배와 별개: 처치 순간 같은 맵에서 접속 중인 실제 피해 기여자만 인정.
    if(!p)continue;
    p.serenaProgress=validateSerenaProgress(p.serenaProgress,p.avatar,p.role);
    p.serenaProgress.highestLevel=Math.max(p.serenaProgress.highestLevel,highestLevel);
    if(!p.serenaProgress.bossKills.includes(monster.typeId))p.serenaProgress.bossKills.push(monster.typeId);
  }
}
