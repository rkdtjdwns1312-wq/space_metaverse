import {playerEffectsView} from './rooms.js';
import {itemOf} from '../shared/config.js';
import {constellationOf} from '../shared/constellations.js';
import {practiceEffectRows} from './tutorial-journey.js';
import {abilityCancellationEntries} from './ability-cancellation.js';

const nameOrder = new Intl.Collator('ko', {numeric: true});
const ABILITY_STATUSES=new Set(['ability-seal','pair','sleep','item-block','cetus-praise','cetus-stomach','cetus-afterglow',
  'paralysis-low','paralysis-mid','paralysis-high','challenge-low','challenge-mid','challenge-high']);
const PRIVATE_ABILITY_STATUSES=new Set(['ability-seal','sleep','item-block','paralysis-low','paralysis-mid','paralysis-high']);
function abilitySourceId(player,e){
  const state=player.constellationAbilityState||{};
  if(e.statusId==='ability-seal')return state.abilitySeal?.sourceId;
  if(e.statusId==='sleep')return state.ariesSleep?.sourceId;
  if(e.statusId==='pair')return player.piscesPair?.sourceId;
  if(e.statusId?.startsWith('paralysis-'))return state.paralysis?.sourceId;
  if(e.statusId==='cetus-praise')return state.cetusPraise?.sourceId;
  if(e.statusId==='cetus-stomach')return state.cetusStomach?.sourceId;
  if(e.statusId==='cetus-afterglow')return state.cetusAfterglow?.sourceId;
  if(e.statusId?.startsWith('challenge-'))return state.leoChallenges?.find(row=>row.endsAt===e.until)?.sourceId;
  return null;
}

// 기둥 전용 목록: 공개 아이템 사용자는 표시하되, 비밀 아이템은 교사만 확인합니다.
// remainingUses는 추후 횟수형 아이템의 서버 잔여 횟수를 연결하는 선택 필드입니다.
export function templeItemRows(room,viewer,now=Date.now()) {
  const teacher=viewer.role==='teacher';
  return [...room.players.values()].flatMap(p=>{
    const cancellable=abilityCancellationEntries(p,now);
    return [
    ...practiceEffectRows(p,viewer,now).map(row=>({...row,category:'item'})),
    ...playerEffectsView(p,true,now).filter(e=>(e.itemId||ABILITY_STATUSES.has(e.statusId))&&
      (e.until===null||e.until>now)&&e.remainingUses!==0).map(e=>{
      const row={targetId:p.id,nickname:p.nickname,...e,category:e.itemId?'item':'ability'};
      if(row.category==='ability'){
        const index=cancellable.findIndex(entry=>entry.statusId===e.statusId&&entry.until===e.until);
        const cancellation=index>=0?cancellable.splice(index,1)[0]:null;
        if(teacher&&cancellation)row.abilityCancelKey=cancellation.key;
        const sourceId=cancellation?.sourceId||abilitySourceId(p,e);
        row.fromNickname=cancellation?.type==='block'?cancellation.record.fromNickname:e.statusId==='item-block'?(p.abilityState?.blocks||[]).find(block=>block.until===e.until)?.fromNickname:
          sourceId?room.players.get(sourceId)?.nickname:undefined;
        row.fromNickname||='알 수 없음';
        if(e.statusId==='ability-seal')row.description='뱀주인자리 고급 마비가 별자리 능력을 봉인했습니다.';
      }
      if(!teacher){
        delete row.markerId;delete row.fromId;delete row.note;
        if(PRIVATE_ABILITY_STATUSES.has(e.statusId))delete row.fromNickname;
        if(itemOf(e.itemId)?.secret)delete row.fromNickname;
      }
      return row;
    }),
    ...(p.abilityState?.markers||[]).map(marker=>({targetId:p.id,nickname:p.nickname,fromNickname:p.nickname,itemId:null,category:'ability',icon:'✦',
      label:'Lv'+(marker.level||2)+' '+(constellationOf(marker.constellationId)?.name||'별자리')+' 능력',
      description:marker.sourceDescription||constellationOf(marker.constellationId,marker.level||2)?.ability?.description||'',note:marker.note,until:null,
      ...(teacher?{abilityMarkerId:marker.id,abilityCancelKey:cancellable.find(entry=>entry.type==='marker'&&entry.record.id===marker.id)?.key,constellationId:marker.constellationId,abilityLevel:marker.level||2,abilityMultiplier:marker.multiplier||1}:{})}))
  ];}).sort((a,b)=>{
    // 비밀 사용자 정보 제거 후 정렬하여, 순서에서도 비밀 정보가 드러나지 않게 합니다.
    const title=row=>itemOf(row.itemId)?.name||row.label||'';
    return nameOrder.compare(title(a),title(b))
      || nameOrder.compare(a.fromNickname||'비공개',b.fromNickname||'비공개')
      || nameOrder.compare(a.nickname,b.nickname);
  });
}
