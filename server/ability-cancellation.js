import {createHash} from 'node:crypto';
import {GameError} from './pin-auth.js';
import {clearPiscesPair} from './party.js';
import {escapeCetus} from './cetus-weekly.js';

// 현재 기록 전체에 묶인 키로 오래된 화면이 새 효과를 해제하지 않게 합니다.
export function abilityCancellationEntries(player,now=Date.now()){
  const entries=[],state=player.constellationAbilityState||{};
  const add=(type,statusId,record,until,sourceId)=>{
    if(!record||until!==null&&!(until>now))return;
    const key=createHash('sha256').update(JSON.stringify([player.id,type,record])).digest('hex');
    entries.push({key,type,statusId,record,until,sourceId});
  };
  for(const block of player.abilityState?.blocks||[])add('block',block.sourceId==='aries'?'sleep':'item-block',block,block.until,block.fromId);
  add('pair','pair',player.piscesPair,player.piscesPair?.endsAt,player.piscesPair?.sourceId);
  const fields={ariesSleep:'sleep',paralysis:state.paralysis?.level===2?'paralysis-mid':state.paralysis?.level===3?'paralysis-low':'paralysis-high',
    abilitySeal:'ability-seal',cetusPraise:'cetus-praise',cetusStomach:'cetus-stomach',cetusAfterglow:'cetus-afterglow'};
  for(const [field,statusId] of Object.entries(fields))add(field,statusId,state[field],state[field]?.endsAt,state[field]?.sourceId);
  for(const challenge of state.leoChallenges||[])if(!challenge.rewarded)add('challenge',challenge.level===2?'challenge-low':challenge.level===3?'challenge-mid':'challenge-high',challenge,challenge.endsAt,challenge.sourceId);
  for(const marker of player.abilityState?.markers||[])add('marker',null,marker,null,player.id);
  return entries;
}

export function cancelAbilityEffect(room,teacher,targetId,key,now=Date.now()){
  if(teacher?.role!=='teacher'||room.players.get(teacher.id)!==teacher)throw new GameError('선생님만 별 능력을 해제할 수 있어요.');
  const target=typeof targetId==='string'?room.players.get(targetId):null;
  const entry=target&&typeof key==='string'&&abilityCancellationEntries(target,now).find(e=>e.key===key);
  if(!entry)throw new GameError('효과가 이미 끝났거나 바뀌었어요. 새로 보기를 눌러주세요.');
  if(entry.type==='marker')target.abilityState.markers=target.abilityState.markers.filter(r=>r!==entry.record);
  else if(entry.type==='block')target.abilityState.blocks=target.abilityState.blocks.filter(r=>r!==entry.record);
  else if(entry.type==='pair')clearPiscesPair(room,target.id);
  else if(entry.type==='cetusStomach')escapeCetus(room,target,now);
  else if(entry.type==='challenge')target.constellationAbilityState.leoChallenges=target.constellationAbilityState.leoChallenges.filter(r=>r!==entry.record);
  else{
    target.constellationAbilityState[entry.type]=null;
    if(entry.type==='paralysis'&&entry.record.level===4&&target.constellationAbilityState.abilitySeal?.sourceId===entry.sourceId)
      target.constellationAbilityState.abilitySeal=null;
  }
  return {targetId:target.id};
}
