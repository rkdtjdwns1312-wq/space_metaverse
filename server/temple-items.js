import {playerEffectsView} from './rooms.js';
import {itemOf} from '../shared/config.js';
import {constellationOf} from '../shared/constellations.js';

const nameOrder = new Intl.Collator('ko', {numeric: true});

// 기둥 전용 목록: 공개 아이템 사용자는 표시하되, 비밀 아이템은 교사만 확인합니다.
// remainingUses는 추후 횟수형 아이템의 서버 잔여 횟수를 연결하는 선택 필드입니다.
export function templeItemRows(room,viewer,now=Date.now()) {
  const teacher=viewer.role==='teacher';
  return [...room.players.values()].flatMap(p=>[
    ...playerEffectsView(p,true,now).filter(e=>(e.until===null||e.until>now)&&e.remainingUses!==0).map(e=>{
      const row={targetId:p.id,nickname:p.nickname,...e};
      if(!teacher){
        delete row.markerId;delete row.fromId;delete row.note;
        if(itemOf(e.itemId)?.secret)delete row.fromNickname;
      }
      return row;
    }),
    ...(p.abilityState?.markers||[]).map(marker=>({targetId:p.id,nickname:p.nickname,fromNickname:p.nickname,itemId:null,icon:'✦',
      label:'Lv'+(marker.level||2)+' '+(constellationOf(marker.constellationId)?.name||'별자리')+' 능력',
      description:constellationOf(marker.constellationId,marker.level||2)?.ability?.description||'',note:marker.note,until:null,
      ...(teacher?{abilityMarkerId:marker.id,constellationId:marker.constellationId,abilityLevel:marker.level||2}:{})}))
  ]).sort((a,b)=>{
    // 비밀 사용자 정보 제거 후 정렬하여, 순서에서도 비밀 정보가 드러나지 않게 합니다.
    const title=row=>itemOf(row.itemId)?.name||row.label||'';
    return nameOrder.compare(title(a),title(b))
      || nameOrder.compare(a.fromNickname||'비공개',b.fromNickname||'비공개')
      || nameOrder.compare(a.nickname,b.nickname);
  });
}
