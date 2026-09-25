import {ITEM_USE,SHOP,SHARDS,itemOf,PLAZA_ID,BLACK_HOLE_ID} from '../shared/config.js';
import {STAR_CARD_CATALOG,goldItemIdOf} from '../shared/star-cards.js';
import {ensure} from './rooms.js';
import {addCardMarker,hasCardStatus,hasItemImmunity} from './item-cards.js';
import {activeItemBlocks} from './constellation-abilities.js';
import {collectSunTax,hasLv2ItemBlock} from './lv2-item-effects.js';
import {arrivePosition} from './world.js';

const DAY=86400000,WEEK=7*DAY,MAX_RECEIPTS=600;
const count=(p,id)=>p.inventory?.find(e=>e.id===id)?.quantity||0;
const level=p=>p.role==='teacher'?ITEM_USE.teacherLevel:p.avatar.level;
const date=n=>Number.isSafeInteger(n)&&n>=0;
const state=p=>{if(!p.lv4State||!Object.hasOwn(p.lv4State,'stacks'))p.lv4State=validateLv4State(p.lv4State);return p.lv4State;};
const living=m=>m.until===null||m.until>Date.now();
export function validateLv4State(value){
  if(value===undefined)return {stacks:0,nextStackAt:null,claimIds:[],receipts:[],priorityUntil:null};
  let {stacks,nextStackAt,claimIds,receipts,priorityUntil}=value||{};
  // 이전에는 비활성 상태였던 자동 보상 설정을 새 스택 형식으로 안전하게 읽습니다.
  if(value&&!Object.hasOwn(value,'stacks')){
    const {rewardMode,nextRewardAt}=value;
    if(![null,'shards','card'].includes(rewardMode)||(nextRewardAt!==null&&!date(nextRewardAt)))throw Error('LV4 아이템 저장 데이터가 올바르지 않습니다.');
    stacks=0;claimIds=[];nextStackAt=nextRewardAt===null?null:Math.max(0,nextRewardAt-(rewardMode==='card'?WEEK:0));
  }
  if(!date(stacks)||(nextStackAt!==null&&!date(nextStackAt))||!Array.isArray(claimIds)||claimIds.length>MAX_RECEIPTS||
    claimIds.some(id=>typeof id!=='string'||id.length<1||id.length>80)||new Set(claimIds).size!==claimIds.length||
    (priorityUntil!==null&&!date(priorityUntil))||!Array.isArray(receipts)||receipts.length>MAX_RECEIPTS||
    receipts.some(r=>!r||typeof r.key!=='string'||r.key.length>220||!date(r.at)))throw Error('LV4 아이템 저장 데이터가 올바르지 않습니다.');
  return {stacks,nextStackAt,claimIds:[...claimIds],priorityUntil,receipts:structuredClone(receipts)};
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
  else if(s.nextStackAt===null)s.nextStackAt=now+WEEK;
  else if(s.nextStackAt<=now){
    const weeks=Math.floor((now-s.nextStackAt)/WEEK)+1;
    s.stacks+=Math.min(weeks,Number.MAX_SAFE_INTEGER-s.stacks);s.nextStackAt+=weeks*WEEK;
  }
  return before!==s.nextStackAt||beforeStacks!==s.stacks;
}
export function lv4ItemsDue(room,now=Date.now()){
  return [...room.players.values()].some(p=>count(p,'supercluster-card')?
    p.lv4State?.nextStackAt==null||p.lv4State.nextStackAt<=now:p.lv4State?.nextStackAt!=null);
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
  const cost=data.reward==='shards'?1:2;ensure(s.stacks>=cost,'보유 스택이 부족해요.');
  collectSunTax(draft,p,now);
  if(data.reward==='shards'){ensure(p.starShards<=SHARDS.max-4,'별 파편 잔액이 가득 찼어요.');p.starShards+=4;}
  else give(p,'star-card',1);
  s.stacks-=cost;s.claimIds.push(data.requestId);if(s.claimIds.length>MAX_RECEIPTS)s.claimIds.shift();
  const result={message:data.reward==='shards'?'1스택을 사용해 별 파편 4개를 받았어요.':'2스택을 사용해 별 카드 1장을 받았어요.',holding:holdingView(p)};
  commit(room,draft);return result;
}
function targets(room,actor,ids,min,max,now){
  ensure(Array.isArray(ids)&&ids.length>=min&&ids.length<=max&&new Set(ids).size===ids.length,'서로 다른 사용 대상을 골라주세요.');
  return ids.map(id=>{const p=room.players.get(id);ensure(p?.role==='student'&&p.connected&&!p.away,'접속 중인 학생 친구를 골라주세요.');
    ensure(level(p)<=level(actor),'나보다 레벨이 높은 친구에게는 쓸 수 없어요.');
    ensure(!hasCardStatus(p,'little-moon-card',now)&&!hasItemImmunity(p,now),'아이템 보호 중인 친구예요.');return p;});
}
export function blackHolePreview(room,actor,ids,now=Date.now()){
  ensure(Array.isArray(ids)&&ids.length===3&&new Set(ids).size===3&&ids.every(id=>room.planets.has(id)),'서로 다른 부서 행성 3개를 골라주세요.');
  const costs=[];
  for(const p of room.players.values())if(p.role==='student'){
    const warnings=ids.flatMap(id=>(room.planets.get(id).warnings?.entries||[]).filter(e=>e.active&&e.targetId===p.id));
    const black=!!p.avatar.blackStar&&ids.includes(p.avatar.blackStar.planetId),amount=warnings.length+(black?3:0);
    if(!amount)continue;
    ensure(level(p)<=level(actor),'대상 중 나보다 레벨이 높은 친구가 있어요.');
    ensure(!hasItemImmunity(p,now)&&!hasCardStatus(p,'little-moon-card',now),'대상 중 아이템 보호 중인 친구가 있어요.');
    ensure(p.starShards>=amount,p.nickname+' 친구의 별 파편이 부족해요.');costs.push({playerId:p.id,nickname:p.nickname,amount});
  }
  const total=costs.reduce((n,p)=>n+p.amount,0);ensure(total>0,'선택한 부서에 해제할 경고나 검은별이 없어요.');
  return {costs,total,durationDays:total/10};
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
    // 자세한 일렬 순서는 기록을 나누어 80자 저장 한도를 지킵니다.
    for(const [index,p] of people.entries())marker(p,card,user,null,`${index+1}번째 · 행성 역할/급식·책상·하교 순서 교사 확인`,now);
  }else if(card.id==='black-hole-card'){
    const preview=blackHolePreview(draft,user,data.planetIds,now);ids=preview.costs.map(c=>c.playerId);
    for(const c of preview.costs){const p=draft.players.get(c.playerId);p.starShards-=c.amount;
      for(const id of data.planetIds)for(const e of draft.planets.get(id).warnings?.entries||[])if(e.targetId===p.id)e.active=false;
      if(p.avatar.blackStar&&data.planetIds.includes(p.avatar.blackStar.planetId)){p.avatar.blackStar=null;if(p.mapId===BLACK_HOLE_ID)Object.assign(p,arrivePosition(draft,PLAZA_ID,{x:1560,y:560}),{mapId:PLAZA_ID,input:{x:0,y:0,at:0}});}
    }
    marker(user,card,user,now+Math.round(preview.total*DAY/10),'다른 아이템의 대상이 되지 않음 · 소멸 '+preview.total+'파편',now);
    message=`경고와 검은별을 해제하고 ${preview.total}파편을 소멸시켰어요. 아이템 보호 ${preview.durationDays}일.`;
  }else if(card.id==='nebula-card')marker(user,card,user,null,'실제 1m×1m 땅·침입 여부 교사 확인',now);
  else if(card.id==='betelgeuse-card')marker(user,card,user,null,'행성탐험3회 · 이동 칸수/부정효과 무시 교사 확인',now,3);
  else if(card.id==='alien-queen-card')marker(user,card,user,null,'일기·독서록 완전 면제 · 실제 수업 적용 교사 확인',now);
  else if(card.id==='total-eclipse-card'){
    const people=targets(draft,user,data.targetIds,1,30,now);ensure(people.every(p=>p.id!==user.id),'다른 친구를 골라주세요.');ids=people.map(p=>p.id);
    for(const p of people){const old=(p.cardMarkers||[]).find(m=>m.itemId===card.id&&m.until>now);ensure(!old||old.fromLevel<=level(user),'더 높은 레벨의 개기 일식이 적용 중이에요.');
      p.cardMarkers=(p.cardMarkers||[]).filter(m=>m.itemId!==card.id);marker(p,card,user,now+WEEK,'사용 금지 유지 · 아이템 1회마다 사용자에게 1파편 지불',now);}
    message='7일 동안 아이템 금지를 적용했어요. 1파편을 낼 때마다 한 번만 사용할 수 있어요.';
  }else if(card.id==='supercluster-card'){
    ensure(Array.isArray(data.cardIds)&&data.cardIds.length===2&&data.cardIds.every(id=>goldItemIdOf(id)),'받을 별 카드 2장을 골라주세요.');
    for(const id of data.cardIds)give(user,goldItemIdOf(id),1);message='선택한 별 카드 2장을 인벤토리에 지급했어요.';
  }else ensure(false,'그런 LV4 카드가 없어요.');
  user.inventory.find(e=>e.id===card.id).quantity--;user.inventory=user.inventory.filter(e=>e.quantity>0);user.lastItemUseAt=now;syncLv4Holdings(user,now);
  commit(room,draft);return {message,targetIds:ids};
}
export function lv4Info(room,p){return {useFeeText:hasCardStatus(p,'total-eclipse-card')?'개기 일식 금지 상태: 아이템을 한 번 사용할 때 별 파편 1개를 내요. 금지 상태는 계속 유지돼요.':'',players:[...room.players.values()].filter(q=>q.role==='student'&&q.connected&&!q.away).map(q=>({id:q.id,nickname:q.nickname,level:q.avatar.level})),
  planets:[...room.planets.values()].map(q=>({id:q.id,name:q.name})),cards:STAR_CARD_CATALOG.map(c=>({id:c.id,name:c.name})),holding:holdingView(p),teacher:p.role==='teacher'};}
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
    ensure(count(p,'alien-queen-card')>0&&eligible(p,now),'LV4 에일리언 퀸 보유 능력을 사용할 수 있는 학생이 아니에요.');ensure(p.starShards<SHARDS.max,'별 파편 잔액이 가득 찼어요.');p.starShards++;message='작성 확인 완료. 별 파편 1개를 지급했어요.';
  }else if(data.action==='nebula-tax'){
    ensure(m?.itemId==='nebula-card','사용 중인 성운 기록을 찾지 못했어요.');const target=draft.players.get(data.targetId);
    ensure(target?.role==='student'&&target!==p,'징수할 다른 학생을 골라주세요.');
    ensure(level(target)<=(m.fromLevel||level(p)),'카드 사용자보다 레벨이 높은 친구에게는 쓸 수 없어요.');
    ensure(!hasItemImmunity(target,now)&&!hasCardStatus(target,'little-moon-card',now),'아이템 보호 중인 친구예요.');
    ensure(target.starShards>=1&&p.starShards<SHARDS.max,'별 파편을 옮길 잔액 여유가 부족해요.');target.starShards--;p.starShards++;message='침입 확인 완료. 별 파편 1개를 옮겼어요.';
  }else if(data.action==='exploration'){
    ensure(m?.itemId==='betelgeuse-card'&&m.remainingUses>0,'남은 탐험 기회가 없어요.');ensure(Number.isInteger(data.steps)&&data.steps>=1&&data.steps<=99,'이동한 칸 수는 1~99로 적어주세요.');
    m.remainingUses--;s.priorityUntil=Math.max(now,s.priorityUntil||0)+data.steps*WEEK;
    m.note=`탐험 남음 ${m.remainingUses}회 · 우선권 ${new Date(s.priorityUntil).toISOString().slice(0,10)}까지`;
    if(m.remainingUses===0){delete m.remainingUses;m.until=s.priorityUntil;}
    message='탐험을 확인했어요. 급식·자리 우선권 기간을 기록했어요.';
  }else ensure(false,'확인할 활동을 골라주세요.');
  s.receipts.push({key,at:now});commit(room,draft);return {message};
}
