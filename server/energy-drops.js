import {randomInt,randomUUID} from 'node:crypto';
import {ENERGY_DROPS} from '../shared/energy-drops.js';
import {monsterType} from '../shared/monsters.js';
import {ensure} from './rooms.js';
import {isDefeated} from './vitals.js';

// 바닥 드랍은 전투처럼 임시 상태입니다. 습득할 때만 잔액과 함께 원자적으로 저장합니다.
export function pruneEnergyDrops(room,now=Date.now()){
  let changed=false;
  for(const [id,drop] of room.energyDrops||[])if(drop.expiresAt<=now){room.energyDrops.delete(id);changed=true;}
  return changed;
}
// 파티 서비스가 생기면 서버의 room.parties(Map)에 {memberIds:[...]}를 등록합니다.
// 현재는 등록 기능이 없으므로 항상 최대 피해자 단독 소유입니다. 클라이언트 입력은 받지 않습니다.
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
  const bounds=ENERGY_DROPS.rewards[monsterType(monster.typeId)?.level];
  if(!bounds)return null;
  const ids=rewardRecipients(room,monster,contributions);
  if(!ids.length)return null;
  const total=roll(bounds[0],bounds[1]+1);
  if(total===0)return null;
  pruneEnergyDrops(room,now);room.energyDrops??=new Map();
  // 몬스터 15마리/재생성10초/유효5분보다 넉넉한 상한입니다.
  if(room.energyDrops.size>=ENERGY_DROPS.maxPerRoom)return null;
  const base=Math.floor(total/ids.length),remainder=total%ids.length;
  const shares=new Map(ids.map((id,i)=>[id,base+(i<remainder?1:0)]).filter(([,amount])=>amount>0));
  const drop={id:randomUUID(),mapId:monster.mapId,x:monster.x,y:monster.y,total,shares,expiresAt:now+ENERGY_DROPS.lifetimeMs};
  room.energyDrops.set(drop.id,drop);return drop;
}
export function energyDropViews(room,now=Date.now()){
  return [...(room.energyDrops?.values()||[])].filter(d=>d.expiresAt>now).map(d=>({
    id:d.id,mapId:d.mapId,x:d.x,y:d.y,radius:ENERGY_DROPS.radius,expiresAt:d.expiresAt,
    shares:[...d.shares].map(([playerId,amount])=>({playerId,amount}))
  }));
}
export function collectEnergyDrop(room,player,id,now=Date.now()){
  ensure(room.players.get(player?.id)===player&&player.connected&&!player.away,'먼저 교실에 입장해주세요.');
  ensure(!isDefeated(player)&&!player.avatar?.blackStar,'지금은 우주에너지를 주울 수 없어요.');
  const drop=room.energyDrops?.get(id);
  ensure(drop&&drop.expiresAt>now,'이미 주웠거나 사라진 우주에너지예요.');
  ensure(player.mapId===drop.mapId&&Math.hypot(player.x-drop.x,player.y-drop.y)<=ENERGY_DROPS.pickupDistance,'우주에너지 가까이 가주세요.');
  const amount=drop.shares.get(player.id);
  ensure(Number.isSafeInteger(amount)&&amount>0,'내 몫의 우주에너지가 아니거나 이미 주웠어요.');
  const before=player.cosmicEnergy??0;
  ensure(Number.isSafeInteger(before)&&before>=0&&Number.isSafeInteger(before+amount),'우주에너지를 더 담을 수 없어요.');
  player.cosmicEnergy=before+amount;drop.shares.delete(player.id);
  if(!drop.shares.size)room.energyDrops.delete(drop.id);
  return {amount,cosmicEnergy:player.cosmicEnergy};
}
