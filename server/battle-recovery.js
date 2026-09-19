import {ensureVitals} from './vitals.js';
import {spawnInside} from './world.js';
import {PLAZA_ID,BLACK_HOLE_ID} from '../shared/config.js';
export const RECOVERY_MS=3000;
export function recoverDefeated(room,now){
  const recovered=[];
  for(const p of room.players.values()){
    const state=p.battleVitals;
    if(!p.connected||p.away||!state||state.hp>0||state.defeatedAt===null||now-state.defeatedAt<RECOVERY_MS)continue;
    const mapId=p.avatar.blackStar?BLACK_HOLE_ID:PLAZA_ID,pos=spawnInside(room,mapId);
    p.battleVitals=null;ensureVitals(p);Object.assign(p,pos,{mapId,input:{x:0,y:0,at:0}});recovered.push(p);
  }
  return recovered;
}
