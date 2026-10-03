import {MAP} from '../shared/config.js';
import {ITEM_USE,SHOP,SHARDS,itemOf,PLAZA_ID,BLACK_HOLE_ID} from '../shared/config.js';
import {STAR_CARD_CATALOG,goldItemIdOf} from '../shared/star-cards.js';
import {ensure} from './rooms.js';
import {hasMoonProtectionFrom,addCardMarker,hasCardStatus,hasItemImmunity} from './item-cards.js';
import {activeItemBlocks} from './constellation-abilities.js';
import {collectSunTax,hasLv2ItemBlock} from './lv2-item-effects.js';
import {arrivePosition} from './world.js';
import {holdingWeek,holdingUsed,validateHoldingState} from '../shared/holding-abilities.js';
import {alignRewardMonday,nextRewardMonday} from '../shared/weekly-reward-time.js';

const DAY=86400000,WEEK=7*DAY,BLACK_HOLE_COOLDOWN=2*WEEK,MAX_RECEIPTS=600;
const count=(p,id)=>p.inventory?.find(e=>e.id===id)?.quantity||0;
const level=p=>p.role==='teacher'?ITEM_USE.teacherLevel:p.avatar.level;
const date=n=>Number.isSafeInteger(n)&&n>=0;
const state=p=>{if(!p.lv4State||!Object.hasOwn(p.lv4State,'stacks'))p.lv4State=validateLv4State(p.lv4State);return p.lv4State;};
const living=m=>m.until===null||m.until>Date.now();
export function validateLv4State(value){
  if(value===undefined)return {stacks:0,nextStackAt:null,claimIds:[],receipts:[],priorityUntil:null,blackHoleReadyAt:null};
  let {stacks,nextStackAt,claimIds,receipts,priorityUntil,blackHoleReadyAt=null,betelgeuseDay}=value||{};
  // 이전에는 비활성 상태였던 자동 보상 설정을 새 스택 형식으로 안전하게 읽습니다.
  if(value&&!Object.hasOwn(value,'stacks')){
    const {rewardMode,nextRewardAt}=value;
    if(![null,'shards','card'].includes(rewardMode)||(nextRewardAt!==null&&!date(nextRewardAt)))throw Error('LV4 아이템 저장 데이터가 올바르지 않습니다.');
    stacks=0;claimIds=[];nextStackAt=nextRewardAt===null?null:Math.max(0,nextRewardAt-(rewardMode==='card'?WEEK:0));
  }
  if(!date(stacks)||(nextStackAt!==null&&!date(nextStackAt))||!Array.isArray(claimIds)||claimIds.length>MAX_RECEIPTS||
    claimIds.some(id=>typeof id!=='string'||id.length<1||id.length>80)||new Set(claimIds).size!==claimIds.length||
    (priorityUntil!==null&&!date(priorityUntil))||(blackHoleReadyAt!==null&&!date(blackHoleReadyAt))||
    (betelgeuseDay!==undefined&&(typeof betelgeuseDay!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(betelgeuseDay)))||!Array.isArray(receipts)||receipts.length>MAX_RECEIPTS||
    receipts.some(r=>!r||typeof r.key!=='string'||r.key.length>220||!date(r.at)))throw Error('LV4 아이템 저장 데이터가 올바르지 않습니다.');
  return {stacks,nextStackAt,claimIds:[...claimIds],priorityUntil,blackHoleReadyAt,receipts:structuredClone(receipts),...(betelgeuseDay===undefined?{}:{betelgeuseDay})};
}
function eligible(p,now){return level(p)>=4&&!p.avatar.blackStar&&!hasCardStatus(p,'little-sun-card',now)&&!hasLv2ItemBlock(p,now)&&!activeItemBlocks(p,now).length;}
function give(p,id,quantity){const owned=p.inventory.find(e=>e.id===id);ensure((owned?.quantity||0)+quantity<=SHOP.maxStack&&(owned||p.inventory.length<SHOP.maxKinds),'보상 아이템을 받을 가방 공간이 부족해요.');if(owned)owned.quantity+=quantity;else p.inventory.push({id,quantity});}
function marker(p,card,actor,until,note,now,uses){
  return Object.assign(addCardMarker(p,card,actor,until,note),{at:now,fromLevel:level(actor),...(uses===undefined?{}:{remainingUses:uses})});
}
// 재화·아이템·대상 상태를 모두 미리 계산한 뒤 한 번에 반영합니다. 외부 저장 실패는 store.transact가 복구합니다.
function draftOf(room){return {...room,players:new Map([...room.players].map(([id,p])=>[id,structuredClone(p)])),planets:new Map([...room.planets].map(([id,p])=>[id,structuredClone(p)]))};}
function commit(room,draft){for(const [id,p] of draft.players)Object.assign(room.players.get(id),p);for(const [id,p] of draft.planets)Object.assign(room.planets.get(id),p);}

export function syncLv4Holdings(p,now=Date.now()){
  ensure(date(now)&&now<=Number.MAX_SAFE_INTEGER-WEEK,'적립 시각을 확인해주세요.');
  const s=state(p),before=s.nextStackAt,beforeStacks=s.stacks;
  if(!count(p,'supercluster-card'))s.nextStackAt=null;
  else if(s.nextStackAt===null)s.nextStackAt=nextRewardMonday(now);
  else {s.nextStackAt=alignRewardMonday(s.nextStackAt);if(s.nextStackAt<=now){
    const weeks=Math.floor((now-s.nextStackAt)/WEEK)+1;
    s.stacks+=Math.min(weeks*count(p,'supercluster-card'),Number.MAX_SAFE_INTEGER-s.stacks);s.nextStackAt+=weeks*WEEK;
  }}
  return before!==s.nextStackAt||beforeStacks!==s.stacks;
}
export function lv4ItemsDue(room,now=Date.now()){
  return [...room.players.values()].some(p=>count(p,'supercluster-card')?
    p.lv4State?.nextStackAt==null||p.lv4State.nextStackAt!==alignRewardMonday(p.lv4State.nextStackAt)||p.lv4State.nextStackAt<=now:p.lv4State?.nextStackAt!=null);
}
export function settleLv4Items(room,now=Date.now()){
  let changed=false;for(const p of room.players.values())changed=syncLv4Holdings(p,now)||changed;return changed;
}
const holdingView=p=>({stacks:state(p).stacks,nextAt:state(p).nextStackAt});

// 보유 카드는 소모하지 않습니다. 스택 차감과 보상/사용료 이전은 한 저장 작업으로 묶습니다.
export function useLv4Holding(room,actor,data={},now=Date.now()){
  ensure(room.players.get(actor?.id)===actor&&actor.connected&&!actor.away,'먼저 교실에 입장해주세요.');
  ensure(count(actor,'supercluster-card')>0,'초은하단을 보유해야 사용할 수 있어요.');
  ensure(eligible(actor,now),'LV4부터 아이템을 사용할 수 있는 상태에서 보유효과를 쓸 수 있어요.');
  ensure(['shards','card'].includes(data.reward),'받을 보상을 골라주세요.');
  ensure(typeof data.requestId==='string'&&data.requestId.length>=1&&data.requestId.length<=80,'사용 요청을 확인해주세요.');
  const draft=draftOf(room),p=draft.players.get(actor.id);syncLv4Holdings(p,now);const s=state(p);
  if(s.claimIds.includes(data.requestId)){commit(room,draft);return {message:'이미 처리한 보유효과 요청이에요. 보상은 한 번만 지급했어요.',holding:holdingView(p)};}
  ensure(!holdingUsed(p,'supercluster-card',now),'이번 주에 이미 보유능력을 사용했어요.');
  const cost=data.reward==='shards'?1:2;ensure(s.stacks>=cost,'은하수의 기운이 부족해요.');
  collectSunTax(draft,p,now);
  if(data.reward==='shards'){ensure(p.starShards<=SHARDS.max-4,'별 파편 잔액이 가득 찼어요.');p.starShards+=4;}
  else give(p,'star-card',1);
  s.stacks-=cost;s.claimIds.push(data.requestId);if(s.claimIds.length>MAX_RECEIPTS)s.claimIds.shift();
  p.holdingState=validateHoldingState(p.holdingState);p.holdingState.usedWeeks['supercluster-card']=holdingWeek(now);
  const result={message:data.reward==='shards'?'은하수의 기운 1을 사용해 별 파편 4개를 받았어요.':'은하수의 기운 2를 사용해 별 카드 1장을 받았어요.',holding:holdingView(p)};
  commit(room,draft);return result;
}
function targets(room,actor,ids,min,max,now){
  ensure(Array.isArray(ids)&&ids.length>=min&&ids.length<=max&&new Set(ids).size===ids.length,'서로 다른 사용 대상을 골라주세요.');
  return ids.map(id=>{const p=room.players.get(id);ensure(p?.role==='student','같은 교실의 학생 친구를 골라주세요.');
    ensure(level(p)<=level(actor),'나보다 레벨이 높은 친구에게는 쓸 수 없어요.');
    ensure(!hasMoonProtectionFrom(p,actor,now)&&!hasItemImmunity(p,now),'아이템 보호 중인 친구예요.');return p;});
}
export function blackHolePreview(room,actor,ids,now=Date.now()){
  ensure(now>=(validateLv4State(actor.lv4State).blackHoleReadyAt||0),'블랙홀을 다시 사용하려면 2주를 기다려주세요.');
  ensure(Array.isArray(ids)&&ids.length===3&&new Set(ids).size===3&&ids.every(id=>room.planets.has(id)),'서로 다른 부서 행성 3개를 골라주세요.');
  const costs=[];
  for(const p of room.players.values())if(p.role==='student'){
    const warnings=ids.flatMap(id=>(room.planets.get(id).warnings?.entries||[]).filter(e=>e.active&&e.targetId===p.id));
    const black=!!p.avatar.blackStar&&ids.includes(p.avatar.blackStar.planetId),amount=warnings.length+(black?2:0);
    if(!amount)continue;
    ensure(level(p)<=level(actor),'대상 중 나보다 레벨이 높은 친구가 있어요.');
    ensure(!hasItemImmunity(p,now)&&!hasMoonProtectionFrom(p,actor,now),'대상 중 아이템 보호 중인 친구가 있어요.');
    ensure(p.starShards>=amount,p.nickname+' 친구의 별 파편이 부족해요.');costs.push({playerId:p.id,nickname:p.nickname,amount});
  }
  const total=costs.reduce((n,p)=>n+p.amount,0);ensure(total>0,'선택한 부서에 해제할 경고나 검은별이 없어요.');
  const selfCost=costs.find(cost=>cost.playerId===actor.id)?.amount||0;
  ensure(actor.role==='teacher'||actor.starShards+total-selfCost<=SHARDS.max,'받을 별 파편을 담을 잔액 여유가 부족해요.');
  return {costs,total,readyAt:now+BLACK_HOLE_COOLDOWN};
}
export function useLv4Item(room,actor,card,data={},now=Date.now()){
  ensure(room.players.get(actor?.id)===actor&&actor.connected&&!actor.away,'먼저 교실에 입장해주세요.');
  ensure(card?.mode==='lv4'&&count(actor,card.id)>0,'가방에 그 물건이 없어요.');
  ensure(level(actor)>=4,'캐릭터의 lv보다 높은 아이템으로 사용할 수 없습니다');
  ensure(eligible(actor,now),'지금은 아이템을 사용할 수 없어요.');
  ensure(now-(actor.lastItemUseAt??-Infinity)>=ITEM_USE.cooldownMs,'아이템을 조금 천천히 사용해주세요.');
  const draft=draftOf(room),user=draft.players.get(actor.id);collectSunTax(draft,user,now);settleLv4Items(draft,now);
  let ids=[actor.id],message='사용 내용을 기록했어요. 실제 활동은 선생님이 확인해요.';
  if(card.id==='solar-system-card'){
    const people=targets(draft,user,data.targetIds,7,7,now);ensure(people.every(p=>p.id!==user.id),'다른 친구 7명을 골라주세요.');ids=people.map(p=>p.id);
    for(const p of people)give(p,'asteroid-card',1);
    const record=marker(user,card,user,null,'급식 순서 영구 변경 · 7명 · 교사 확인 대기',now);
    record.lunchOrderIds=ids;
    message='친구 7명에게 소행성을 지급했어요. 급식 순서는 선생님이 확인해요.';
  }else if(card.id==='black-hole-card'){
    const preview=blackHolePreview(draft,user,data.planetIds,now);ids=preview.costs.map(c=>c.playerId);
    for(const c of preview.costs){const p=draft.players.get(c.playerId);p.starShards-=c.amount;
      for(const id of data.planetIds)for(const e of draft.planets.get(id).warnings?.entries||[])if(e.targetId===p.id)e.active=false;
      if(p.avatar.blackStar&&data.planetIds.includes(p.avatar.blackStar.planetId)){p.avatar.blackStar=null;if(p.mapId===BLACK_HOLE_ID)Object.assign(p,arrivePosition(draft,PLAZA_ID,{x:MAP.objects.find(o=>o.kind==='black-hole').x,y:MAP.objects.find(o=>o.kind==='black-hole').y+228}),{mapId:PLAZA_ID,input:{x:0,y:0,at:0}});}
    }
    user.starShards+=preview.total;state(user).blackHoleReadyAt=preview.readyAt;
    message=`경고와 검은별을 해제하고 별 파편 ${preview.total}개를 받았어요. 2주 뒤 다시 사용할 수 있어요.`;
  }else if(card.id==='nebula-card'){
    const people=targets(draft,user,data.targetIds,3,3,now);
    ensure(people.every(p=>p.id!==user.id),'나를 제외한 친구 3명을 골라주세요.');
    ids=[user.id,...people.map(p=>p.id)];
    const record=marker(user,card,user,null,'교실 자리 영구 변경 · 친구 3명 · 교사 확인 대기',now);
    record.seatTargetIds=people.map(p=>p.id);
    message='네 명의 자리 변경을 요청했어요. 선생님이 서로 완전히 떨어지지 않게 배치해요.';
  }
  else if(card.id==='betelgeuse-card'){
    give(user,'exploration-ticket',3);state(user).betelgeuseDay=new Date(now+9*3600000).toISOString().slice(0,10);
    message='탐사권 3장을 받았어요. 오늘 모은 기운만큼 급식 우선 기간이 늘어나요.';
  }
  else if(card.id==='alien-queen-card')marker(user,card,user,null,'일기·독서록 완전 면제 · 실제 수업 적용 교사 확인',now);
  else if(card.id==='total-eclipse-card'){
    const people=[...draft.players.values()].filter(p=>p.role==='student'&&(p.id===user.id||(!hasMoonProtectionFrom(p,user,now)&&!hasItemImmunity(p,now))));ids=people.map(p=>p.id);
    for(const p of people){const old=(p.cardMarkers||[]).find(m=>m.itemId===card.id&&m.until>now);ensure(!old||old.fromLevel<=level(user),'더 높은 레벨의 개기 일식이 적용 중이에요.');
      p.cardMarkers=(p.cardMarkers||[]).filter(m=>m.itemId!==card.id);marker(p,card,user,now+WEEK,'사용 금지 유지 · 아이템 1회마다 사용자에게 1파편 지불',now);}
    message=`교실 학생 ${people.length}명에게 1주일 개기 일식 상태를 적용했어요. 아이템 1회 사용 때마다 별 파편 1개를 받아요.`;
  }else if(card.id==='supercluster-card'){
    ensure(Array.isArray(data.cardIds)&&data.cardIds.length===2&&data.cardIds.every(id=>goldItemIdOf(id)),'받을 별 카드 2장을 골라주세요.');
    for(const id of data.cardIds)give(user,goldItemIdOf(id),1);message='선택한 별 카드 2장을 인벤토리에 지급했어요.';
  }else ensure(false,'그런 LV4 카드가 없어요.');
  user.inventory.find(e=>e.id===card.id).quantity--;user.inventory=user.inventory.filter(e=>e.quantity>0);user.lastItemUseAt=now;syncLv4Holdings(user,now);
  commit(room,draft);return {message,targetIds:ids};
}
export function lv4Info(room,p){return {useFeeText:(p.cardMarkers||[]).some(m=>m.itemId==='total-eclipse-card'&&m.until>Date.now()&&m.fromId!==p.id)?'현재 개기 일식 상태입니다. 별 1개를 지급 후 사용하시겠습니까?':'',players:[...room.players.values()].filter(q=>q.role==='student').map(q=>({id:q.id,nickname:q.nickname,level:q.avatar.level,connected:!!q.connected&&!q.away})),
  planets:[...room.planets.values()].map(q=>({id:q.id,name:q.name})),cards:STAR_CARD_CATALOG.map(c=>({id:c.id,name:c.name})),holding:holdingView(p),blackHoleReadyAt:state(p).blackHoleReadyAt,teacher:p.role==='teacher'};}
export function lv4TeacherInfo(room){return {students:[...room.players.values()].filter(p=>p.role==='student').map(p=>({id:p.id,nickname:p.nickname})),
  owners:[...room.players.values()].filter(p=>p.role==='student'&&count(p,'alien-queen-card')).map(p=>({id:p.id,nickname:p.nickname})),
  records:[...room.players.values()].flatMap(p=>(p.cardMarkers||[]).filter(m=>itemOf(m.itemId)?.mode==='lv4'&&living(m)).map(m=>({...m,playerId:p.id,nickname:p.nickname,name:itemOf(m.itemId).name})))};}
export function confirmLv4(room,teacher,data,now=Date.now()){
  ensure(room.players.get(teacher?.id)===teacher&&teacher.role==='teacher','선생님만 확인할 수 있어요.');
  const draft=draftOf(room),p=draft.players.get(data.playerId);ensure(p?.role==='student','학생을 골라주세요.');
  const s=state(p),reference=typeof data.reference==='string'?data.reference.trim():'';
  ensure(reference.length>0&&reference.length<=80,'실제 활동을 구분할 확인 기록을 1~80자로 적어주세요.');
  // 클라이언트가 무관한 markerId를 바꿔 같은 제출을 중복 보상받지 못하게 합니다.
  const key=[data.action,data.action==='queen-writing'?'':data.markerId||'',reference].join(':');
  ensure(!s.receipts.some(r=>r.key===key),'이미 확인한 활동이에요. 중복 지급하지 않아요.');
  ensure(s.receipts.length<MAX_RECEIPTS,'확인 기록이 가득 찼어요. 기록 정리가 필요해요.');
  const m=(p.cardMarkers||[]).find(m=>m.id===data.markerId&&(m.until===null||m.until>now));let message;
  if(data.action==='queen-writing'){
    ensure(count(p,'alien-queen-card')>0&&eligible(p,now),'LV4 에일리언 퀸 보유 능력을 사용할 수 있는 학생이 아니에요.');
    ensure(p.starShards<SHARDS.max,'별 파편 잔액이 가득 찼어요.');p.starShards++;
    message='작성 확인 완료. 별 파편 1개를 지급했어요.';
  }else if(data.action==='solar-lunch-order'){
    ensure(m?.itemId==='solar-system-card'&&m.lunchOrderIds?.length===7,'급식 순서 변경을 요청한 태양계 기록을 찾지 못했어요.');
    ensure(m.lunchOrderConfirmed!==true,'이미 급식 순서를 확인했어요.');
    ensure(m.lunchOrderIds.every(id=>draft.players.get(id)?.role==='student'),'급식 순서 대상이 교실에 모두 남아 있는지 확인해주세요.');
    m.lunchOrderConfirmed=true;m.note='급식 순서 영구 변경 · 7명 · 교사 확인 완료';
    message='지정한 일곱 명의 급식 순서를 확인했어요. 기록을 유지합니다.';
  }else if(data.action==='nebula-seating'){
    ensure(m?.itemId==='nebula-card'&&m.seatTargetIds?.length===3,'자리 변경을 요청한 성운 기록을 찾지 못했어요.');
    ensure(m.seatingConfirmed!==true,'이미 자리 변경을 확인했어요.');
    ensure(data.notSeparated===true,'네 친구가 완전히 떨어진 자리가 아닌지 확인해주세요.');
    ensure(m.seatTargetIds.every(id=>draft.players.get(id)?.role==='student'),'자리 변경 대상이 교실에 모두 남아 있는지 확인해주세요.');
    m.seatingConfirmed=true;m.note='교실 자리 영구 변경 · 친구 3명 · 교사 확인 완료';
    message='네 명의 자리를 확인했어요. 자리 변경 기록을 유지합니다.';
  }else ensure(false,'확인할 활동을 골라주세요.');
  s.receipts.push({key,at:now});commit(room,draft);return {message};
}
