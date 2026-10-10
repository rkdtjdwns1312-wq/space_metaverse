import {randomInt,randomUUID} from 'node:crypto';
import {ENERGY_DROPS} from '../shared/energy-drops.js';
import {monsterType} from '../shared/monsters.js';
import {ensure} from './rooms.js';
import {isDefeated} from './vitals.js';
import {SHOP,itemOf} from '../shared/config.js';
import {recipeItemId} from '../shared/recipe-items.js';

// 바닥 드랍은 전투처럼 임시 상태입니다. 습득할 때만 잔액과 함께 원자적으로 저장합니다.
export function pruneEnergyDrops(room,now=Date.now()){
  let changed=false;
  for(const [id,drop] of room.energyDrops||[]){
    if(drop.expiresAt<=now){room.energyDrops.delete(id);changed=true;continue;}
    if(!drop.publicOpened&&drop.publicAt<=now){
      drop.publicOpened=true;drop.rollState=null;drop.partyRollEligible=null;
      room.lootRolls?.delete(id);changed=true;
    }
  }
  for(const [id,display] of room.lootRolls||[])if(display.expiresAt<=now)room.lootRolls.delete(id);
  return changed;
}
// 피해가 가장 큰 친구의 파티 중 같은 맵에 있는 멤버에게 보상을 나눕니다.
export function rewardRecipients(room,monster,contributions){
  const ranked=[...contributions].filter(([id,damage])=>room.players?.has(id)&&damage>0)
    .sort((a,b)=>b[1]-a[1]); // 안정 정렬: 피해가 같으면 최초 공격 참여 순서
  const leaderId=ranked[0]?.[0];if(!leaderId)return [];
  const party=[...(room.parties?.values()||[])].find(p=>Array.isArray(p.memberIds)&&p.memberIds.includes(leaderId));
  if(!party)return [leaderId];
  const members=[...new Set(party.memberIds)].filter(id=>{
    const player=room.players.get(id);
    return player?.connected&&!player.away&&player.mapId===monster.mapId;
  });
  return members.length?members:[leaderId];
}
export function addEnergyDrop(room,monster,contributions,now=Date.now(),roll=randomInt){
  const type=monsterType(monster.typeId),bounds=ENERGY_DROPS.rewards[type?.boss?type.id:type?.level];
  if(!bounds)return null;
  const ids=rewardRecipients(room,monster,contributions);
  if(!ids.length)return null;
  const total=roll(bounds[0],bounds[1]+1);
  if(total===0)return null;
  pruneEnergyDrops(room,now);room.energyDrops??=new Map();
  // 몬스터 15마리/재생성10초/유효1분보다 넉넉한 상한입니다.
  if(room.energyDrops.size>=ENERGY_DROPS.maxPerRoom&&!type?.boss)return null;
  const base=Math.floor(total/ids.length),remainder=total%ids.length;
  const shares=new Map(ids.map((id,i)=>[id,base+(i<remainder?1:0)]).filter(([,amount])=>amount>0));
  const drop={id:randomUUID(),mapId:monster.mapId,x:monster.x,y:monster.y,total,shares,
    publicAt:now+ENERGY_DROPS.publicAfterMs,expiresAt:now+ENERGY_DROPS.lifetimeMs};
  room.energyDrops.set(drop.id,drop);return drop;
}
const bossMaterial=Object.freeze({noksera:'noksera-horn',leoon:'leoon-claw'});
export function addBossDrops(room,monster,contributions,now=Date.now(),roll=randomInt){
  if(monster.typeId==='spirit-king'){
    const ids=rewardRecipients(room,monster,contributions);if(!ids.length)return [];
    pruneEnergyDrops(room,now);room.energyDrops??=new Map();
    const drops=[];
    const count=roll(1,3);
    for(const itemId of ['spirit-king-soul','gold-big-bang-card',...Array.from({length:count},()=> 'exploration-ticket')]){
      const drop={id:randomUUID(),kind:'item',itemId,mapId:monster.mapId,
        x:monster.x+(drops.length-1)*30,y:monster.y,total:1,
        shares:new Map(ids.map(playerId=>[playerId,1])),partyRollEligible:ids.length>1?[...ids]:null,
        publicAt:now+ENERGY_DROPS.publicAfterMs,expiresAt:now+ENERGY_DROPS.lifetimeMs};
      room.energyDrops.set(drop.id,drop);drops.push(drop);
    }
    return drops;
  }
  const itemId=bossMaterial[monster.typeId];
  if(!itemId)return [];
  const ids=rewardRecipients(room,monster,contributions);if(!ids.length)return [];
  const drops=[];
  const addItem=(id)=>{
    const drop={id:randomUUID(),kind:'item',itemId:id,mapId:monster.mapId,
      x:monster.x+22*(drops.length+1),y:monster.y,total:1,
      shares:new Map(ids.map(playerId=>[playerId,1])),partyRollEligible:ids.length>1?[...ids]:null,
      publicAt:now+ENERGY_DROPS.publicAfterMs,expiresAt:now+ENERGY_DROPS.lifetimeMs};
    room.energyDrops.set(drop.id,drop);drops.push(drop);
  };
  pruneEnergyDrops(room,now);room.energyDrops??=new Map();
  addItem(itemId);
  if(roll(0,100)===0){
    const lv4=SHOP.items.filter(item=>item.level===4&&item.mode==='lv4');
    if(lv4.length)addItem(lv4[roll(0,lv4.length)].id);
  }
  return drops;
}
// Called for every kill independently of its energy roll. No recipe exists for LV1.
// Only public output IDs are attached to the transient room; ingredients stay private.
export function addRecipeDrop(room,monster,contributions,now=Date.now(),roll=randomInt){
  const level=monsterType(monster.typeId)?.level??monster.level;
  const outputs=[...new Set(room.recipeDropOutputIds||[])].filter(id=>itemOf(id)?.level===level&&itemOf(recipeItemId(id)));
  if(!outputs.length)return null;
  const ids=rewardRecipients(room,monster,contributions);if(!ids.length)return null;
  const chance=roll(0,100);
  if(chance!==0)return null; // exactly one of the 100 equiprobable server outcomes
  const index=roll(0,outputs.length);
  if(!Number.isSafeInteger(index)||index<0||index>=outputs.length)return null;
  pruneEnergyDrops(room,now);room.energyDrops??=new Map();
  if(room.energyDrops.size>=ENERGY_DROPS.maxPerRoom)return null;
  const drop={id:randomUUID(),kind:'recipe',itemId:recipeItemId(outputs[index]),
    mapId:monster.mapId,x:monster.x,y:monster.y,total:1,shares:new Map(ids.map(playerId=>[playerId,1])),
    partyRollEligible:ids.length>1?[...ids]:null,
    publicAt:now+ENERGY_DROPS.publicAfterMs,expiresAt:now+ENERGY_DROPS.lifetimeMs};
  room.energyDrops.set(drop.id,drop);return drop;
}
export function energyDropViews(room,now=Date.now()){
  return [...(room.energyDrops?.values()||[])].filter(d=>d.expiresAt>now).map(d=>({
    id:d.id,mapId:d.mapId,x:d.x,y:d.y,radius:ENERGY_DROPS.radius,
    publicAt:d.publicAt,expiresAt:d.expiresAt,
    remaining:['recipe','item'].includes(d.kind)?1:[...d.shares.values()].reduce((sum,amount)=>sum+amount,0),
    shares:[...d.shares].map(([playerId,amount])=>({playerId,amount})),
    ...(['recipe','item'].includes(d.kind)?{kind:d.kind,itemId:d.itemId}:{})
  }));
}
function grantRolledItem(room,drop,winnerId){
  const winner=room.players.get(winnerId),item=itemOf(drop.itemId);
  if(!winner||!item)return false;
  const entry=winner.inventory.find(value=>value.id===drop.itemId);
  if((entry?.quantity||0)>=SHOP.maxStack||!entry&&winner.inventory.length>=SHOP.maxKinds){
    drop.shares=new Map([[winnerId,1]]);drop.partyRollEligible=null;return false;
  }
  if(entry)entry.quantity++;else winner.inventory.push({id:item.id,quantity:1});
  room.energyDrops.delete(drop.id);
  return true;
}
function rollLoot(room,drop,ids,round,now,roll){
  const rolls=ids.map(playerId=>({playerId,value:roll(1,7)}));
  const highest=Math.max(...rolls.map(r=>r.value));
  const tied=rolls.filter(r=>r.value===highest).map(r=>r.playerId);
  const winnerId=tied.length===1?tied[0]:null;
  drop.rollState=winnerId?null:{round,participantIds:tied};
  room.lootRolls??=new Map();
  const display={dropId:drop.id,itemId:drop.itemId,mapId:drop.mapId,round,rolls,
    tiedIds:winnerId?[]:tied,winnerId,awarded:winnerId?grantRolledItem(room,drop,winnerId):false,
    expiresAt:winnerId?now+5000:drop.expiresAt};
  room.lootRolls.set(drop.id,display);
  return {pendingRoll:true,roll:display};
}
export function rerollPartyLoot(room,player,dropId,now=Date.now(),roll=randomInt){
  const drop=room.energyDrops?.get(dropId);
  ensure(drop?.rollState?.participantIds.includes(player.id)&&drop.expiresAt>now&&now<drop.publicAt,'다시 주사위를 굴릴 대상이 아니에요.');
  const ids=drop.rollState.participantIds.filter(id=>room.players.get(id)?.connected&&room.players.get(id)?.mapId===drop.mapId);
  ensure(ids.length>0,'주사위를 굴릴 친구가 없어요.');
  return rollLoot(room,drop,ids,drop.rollState.round+1,now,roll);
}
export function collectEnergyDrop(room,player,id,now=Date.now(),roll=randomInt){
  ensure(room.players.get(player?.id)===player&&player.connected&&!player.away,'먼저 교실에 입장해주세요.');
  ensure(!isDefeated(player)&&!player.avatar?.blackStar,'지금은 우주에너지를 주울 수 없어요.');
  const drop=room.energyDrops?.get(id);
  ensure(drop&&drop.expiresAt>now,'이미 주웠거나 사라진 우주에너지예요.');
  ensure(player.mapId===drop.mapId&&Math.hypot(player.x-drop.x,player.y-drop.y)<=ENERGY_DROPS.pickupDistance,'우주에너지 가까이 가주세요.');
  const publicDrop=now>=drop.publicAt;
  const amount=publicDrop?['recipe','item'].includes(drop.kind)?1:[...drop.shares.values()].reduce((sum,value)=>sum+value,0):drop.shares.get(player.id);
  ensure(Number.isSafeInteger(amount)&&amount>0,'내 몫의 우주에너지가 아니거나 이미 주웠어요.');
  if(!publicDrop&&drop.partyRollEligible?.length>1){
    if(drop.rollState)return {pendingRoll:true,roll:room.lootRolls.get(drop.id)};
    const ids=drop.partyRollEligible.filter(id=>room.players.get(id)?.connected&&room.players.get(id)?.mapId===drop.mapId);
    if(ids.length>1)return rollLoot(room,drop,ids,1,now,roll);
    drop.shares=new Map([[ids[0]||player.id,1]]);drop.partyRollEligible=null;
    if(!drop.shares.has(player.id))return {pendingRoll:true,roll:{winnerId:ids[0]}};
  }
  if(drop.kind==='recipe'||drop.kind==='item'){
    const item=itemOf(drop.itemId),entry=player.inventory.find(value=>value.id===drop.itemId);
    ensure(item&&amount===1&&(drop.kind!=='recipe'||item.mode==='recipe'),'아이템을 확인해주세요.');
    ensure((entry?.quantity||0)<SHOP.maxStack,'아이템은 99개까지만 담을 수 있어요.');
    ensure(entry||player.inventory.length<SHOP.maxKinds,'가방이 가득 찼어요.');
    if(entry)entry.quantity++;else player.inventory.push({id:item.id,quantity:1});
    if(publicDrop){room.energyDrops.delete(drop.id);room.lootRolls?.delete(drop.id);}
    else{drop.shares.delete(player.id);if(!drop.shares.size)room.energyDrops.delete(drop.id);}
    return {kind:drop.kind,itemId:item.id,quantity:1,inventory:structuredClone(player.inventory)};
  }
  const before=player.cosmicEnergy??0;
  ensure(Number.isSafeInteger(before)&&before>=0&&Number.isSafeInteger(before+amount),'우주에너지를 더 담을 수 없어요.');
  player.cosmicEnergy=before+amount;
  if(publicDrop){room.energyDrops.delete(drop.id);room.lootRolls?.delete(drop.id);}
  else{drop.shares.delete(player.id);if(!drop.shares.size)room.energyDrops.delete(drop.id);}
  return {amount,cosmicEnergy:player.cosmicEnergy};
}
