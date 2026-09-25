import {randomUUID} from 'node:crypto';
import {ensure,GameError} from './rooms.js';
import {itemOf,TRADE,SHOP,SHARDS} from '../shared/config.js';
import {inMarket,MARKET_TRADE_TTL} from '../shared/market.js';

const empty=()=>({shards:0,energy:0,items:[]});
const hasAssets=(p,s)=>p.starShards>=s.shards&&(p.cosmicEnergy??0)>=s.energy
  &&s.items.every(i=>(p.inventory.find(e=>e.id===i.id)?.quantity??0)>=i.quantity);
const party=(t,id)=>t&&(t.fromId===id||t.toId===id);
const offered=s=>s.shards>0||s.energy>0||s.items.length>0;
function side(value){
  const message='거래 내용을 확인해주세요.';
  ensure(value&&typeof value==='object'&&!Array.isArray(value),message);
  ensure(Number.isSafeInteger(value.shards)&&value.shards>=0&&value.shards<=TRADE.maxShards,message);
  ensure(Number.isSafeInteger(value.energy)&&value.energy>=0,message);
  ensure(Array.isArray(value.items)&&value.items.length<=TRADE.maxItemKinds,message);
  const seen=new Set();
  const items=value.items.map(i=>{
    ensure(i&&itemOf(i.id)&&!seen.has(i.id)&&Number.isInteger(i.quantity)&&i.quantity>0&&i.quantity<=SHOP.maxStack,message);
    seen.add(i.id);return {id:i.id,quantity:i.quantity};
  });
  return {shards:value.shards,energy:value.energy,items};
}
function exchangedBag(p,give,receive){
  const bag=new Map(p.inventory.map(i=>[i.id,i.quantity]));
  for(const i of give){const left=bag.get(i.id)-i.quantity;left?bag.set(i.id,left):bag.delete(i.id);}
  for(const i of receive){
    const quantity=(bag.get(i.id)||0)+i.quantity;
    ensure(quantity<=Math.min(SHOP.maxStack,itemOf(i.id)?.maxOwned||SHOP.maxStack),'가방이 가득 차서 거래할 수 없어요.');
    bag.set(i.id,quantity);
  }
  ensure(bag.size<=SHOP.maxKinds,'가방이 가득 차서 거래할 수 없어요.');
  return [...bag].map(([id,quantity])=>({id,quantity}));
}
function log(room,t,result,now){
  room.tradeLog.push({id:t.id,at:now,fromId:t.fromId,toId:t.toId,fromNickname:t.fromNickname,toNickname:t.toNickname,
    give:structuredClone(t.give),want:structuredClone(t.want),result});
  if(room.tradeLog.length>100)room.tradeLog.splice(0,room.tradeLog.length-100);
}
export function pruneMarketTrades(room,now,notify){
  let changed=false;
  for(const t of room.trades.values()){
    if(now-t.at<MARKET_TRADE_TTL&&inMarket(room.players.get(t.fromId))&&inMarket(room.players.get(t.toId)))continue;
    room.trades.delete(t.id);changed=true;
    for(const id of [t.fromId,t.toId]){const p=room.players.get(id);if(p?.connected)notify(room,p,'별 시장을 벗어났거나 연결/대기 시간이 끝나 거래가 취소되었어요.');}
  }
  return changed;
}
export function registerMarketTrades({action,socket,roster,whisper,clock}){
  const session=()=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');return s;};
  const own=data=>{const s=session(),t=s.room.trades.get(data.tradeId);ensure(party(t,s.player.id),'내 거래가 아니에요.');return {...s,t};};
  const present=(room,t)=>ensure(inMarket(room.players.get(t.fromId))&&inMarket(room.players.get(t.toId))&&clock()-t.at<MARKET_TRADE_TTL,'두 친구 모두 별 시장 안에 있어야 해요.');
  action('trade:propose',data=>{
    const {room,player:p}=session();ensure(p.role==='student','선생님은 거래하지 않아요.');
    ensure(data.give===undefined&&data.want===undefined,'먼저 거래를 요청하고 각자 물건을 올려주세요.');
    const target=room.players.get(data.targetId);
    ensure(target&&target.role==='student'&&target.id!==p.id,'친구를 찾지 못했어요.');
    ensure(target.connected,'그 친구는 지금 없어요.');
    ensure(inMarket(p)&&inMarket(target),'두 친구 모두 별 시장 안에 있어야 해요.');
    ensure(![...room.trades.values()].some(t=>party(t,p.id)||party(t,target.id)),'진행 중인 거래가 있어요. 먼저 끝내주세요.');
    ensure((p.tradeBlocks?.get(target.id)||0)<=clock(),'그 친구가 거절했어요. 5분 뒤에 다시 제안할 수 있어요.');
    ensure(room.trades.size<TRADE.maxPending,'기다리는 거래가 너무 많아요.');
    const t={id:randomUUID(),fromId:p.id,toId:target.id,fromNickname:p.nickname,toNickname:target.nickname,
      give:empty(),want:empty(),status:'proposed',revision:0,confirmed:[],at:clock()};
    room.trades.set(t.id,t);roster(room);whisper(room,target,p.nickname+' 친구가 별 시장에서 거래를 요청했어요.');return {tradeId:t.id};
  });
  action('trade:respond',data=>{
    const {room,player:p}=session(),t=room.trades.get(data.tradeId);
    ensure(t&&t.toId===p.id&&t.status==='proposed','내가 받은 제안이 아니에요.');
    ensure(typeof data.accept==='boolean','입력 내용을 확인해주세요.');
    const from=room.players.get(t.fromId);
    if(!data.accept){room.trades.delete(t.id);if(from){(from.tradeBlocks??=new Map()).set(p.id,clock()+TRADE.declineBlockMs);whisper(room,from,p.nickname+' 친구가 거래를 거절했어요.');}}
    else{present(room,t);t.status='negotiating';}
    roster(room);return {};
  });
  action('trade:offer',data=>{
    const {room,player:p,t}=own(data);present(room,t);
    ensure(t.status==='negotiating','친구의 거래 요청 수락을 기다려주세요.');
    ensure(data.revision===t.revision,'거래 내용이 바뀌었어요. 다시 확인해주세요.');
    const value=side(data.offer);ensure(hasAssets(p,value),'주려는 것을 충분히 가지고 있지 않아요.');
    t[t.fromId===p.id?'give':'want']=value;t.revision++;t.confirmed=[];roster(room);return {revision:t.revision};
  });
  action('trade:confirm',data=>{
    const {room,player:p,t}=own(data);present(room,t);
    ensure(t.status==='negotiating','친구의 거래 요청 수락을 기다려주세요.');
    ensure(data.revision===t.revision,'거래 내용이 바뀌었어요. 다시 확인해주세요.');
    ensure(offered(t.give)||offered(t.want),'교환할 물건이나 재화를 올려주세요.');
    if(!t.confirmed.includes(p.id))t.confirmed.push(p.id);
    if(t.confirmed.length<2){roster(room);return {completed:false};}
    const a=room.players.get(t.fromId),b=room.players.get(t.toId);
    // 모든 계산을 끝낸 뒤 두 가방/재화를 함께 교체합니다. 외부 transaction이 저장 실패 시 되돌립니다.
    let bagA,bagB,shardsA,shardsB,energyA,energyB;
    try{
      ensure(hasAssets(a,t.give)&&hasAssets(b,t.want),'가진 것이 바뀌어서 거래할 수 없어요.');
      shardsA=a.starShards-t.give.shards+t.want.shards;shardsB=b.starShards-t.want.shards+t.give.shards;
      energyA=(a.cosmicEnergy??0)-t.give.energy+t.want.energy;energyB=(b.cosmicEnergy??0)-t.want.energy+t.give.energy;
      ensure(shardsA<=SHARDS.max&&shardsB<=SHARDS.max,'별 파편이 넘쳐서 거래할 수 없어요.');
      ensure(Number.isSafeInteger(energyA)&&Number.isSafeInteger(energyB),'우주에너지가 넘쳐서 거래할 수 없어요.');
      bagA=exchangedBag(a,t.give.items,t.want.items);bagB=exchangedBag(b,t.want.items,t.give.items);
    }catch(e){
      if(!(e instanceof GameError))throw e;
      room.trades.delete(t.id);log(room,t,'failed',clock());roster(room);
      whisper(room,a,e.message);whisper(room,b,e.message);e.commitOnError=true;throw e;
    }
    a.inventory=bagA;b.inventory=bagB;a.starShards=shardsA;b.starShards=shardsB;a.cosmicEnergy=energyA;b.cosmicEnergy=energyB;
    room.trades.delete(t.id);log(room,t,'completed',clock());roster(room);
    whisper(room,a,'거래가 완료되었어요. 가방을 확인해보세요.');whisper(room,b,'거래가 완료되었어요. 가방을 확인해보세요.');return {completed:true};
  });
  action('trade:cancel',data=>{
    const {room,player:p,t}=own(data);room.trades.delete(t.id);
    const other=room.players.get(t.fromId===p.id?t.toId:t.fromId);if(other)whisper(room,other,p.nickname+' 친구가 거래를 취소했어요.');roster(room);return {};
  });
  action('trade:history',()=>{
    const {room,player}=session();ensure(player.role==='teacher','선생님만 할 수 있어요.');ensure(inMarket(player),'별 시장 안에서 확인해주세요.');
    return {entries:structuredClone(room.tradeLog.slice(-100).reverse())};
  },false);
  for(const name of ['trade:approve','trade:reject'])action(name,()=>{throw new GameError('별 시장에서 두 친구가 직접 수락하는 방식으로 바뀌었어요.');},false);
}
