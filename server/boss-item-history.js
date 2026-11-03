import {bossItemEvidence} from '../shared/boss-item-evidence.js';
import {validateSerenaProgress} from './serena-progress.js';

function remember(player,evidence){
  if(player?.role!=='student'||!evidence.length)return;
  const progress=validateSerenaProgress(player.serenaProgress,player.avatar,player.role);
  const additions=evidence.filter(id=>!progress.bossKills.includes(id));
  if(additions.length){progress.bossKills.push(...new Set(additions));player.serenaProgress=progress;}
}

// Completed exchanges prove ownership on both sides; proposals, failed trades,
// learned recipes and another person's nickname never do.
export function restoreBossItemHistory(room){
  for(const player of room.players.values())remember(player,bossItemEvidence(player));
  for(const trade of room.tradeLog||[]){
    if(trade?.result!=='completed')continue;
    const evidence=bossItemEvidence({inventory:[...(Array.isArray(trade.give?.items)?trade.give.items:[]),...(Array.isArray(trade.want?.items)?trade.want.items:[])]});
    for(const id of [trade.fromId,trade.toId])remember(room.players.get(id),evidence);
  }
}

export function captureBossItemHistory(rooms){
  return new Map([...rooms].map(([code,room])=>[code,new Map([...room.players].map(([id,p])=>[id,bossItemEvidence(p)]))]));
}

// Run inside the save transaction after the authorized mutation. Remember both
// consumed and received items, but touch only changed owners: an action in one
// classroom must not dirty every open classroom's save candidate.
export function commitBossItemHistory(rooms,before){
  for(const [code,room] of rooms)for(const [id,player] of room.players){
    const previous=before.get(code)?.get(id)||[],current=bossItemEvidence(player);
    if(JSON.stringify(previous)!==JSON.stringify(current))remember(player,[...previous,...current]);
  }
}
