import {randomUUID} from 'node:crypto';
import {ensureVitals} from './vitals.js';

// 실제 이동 구간과 원형 피격 범위의 교차를 검사합니다. 낮은 tick에서도 적을 건너뛰지 않습니다.
function contact(cast,target,end){
  const vx=target.entity.x-cast.x,vy=target.entity.y-cast.y;
  const along=vx*cast.dx+vy*cast.dy,r=target.radius+cast.width;
  if(along<0)return null;
  const perpendicular2=Math.max(0,vx*vx+vy*vy-along*along);
  if(perpendicular2>r*r)return null;
  const half=Math.sqrt(r*r-perpendicular2),entry=Math.max(cast.distance,along-half,0);
  return along+half>=cast.distance&&entry<=end?entry:null;
}
export function projectileView(cast,now){
  const {id,playerId,mapId,x,y,dx,dy,range,durationMs,at,basic,kind,vfxId,size,originOffset,slot,visualScale,visible}=cast;
  return {id,playerId,mapId,x,y,dx,dy,range,durationMs,basic,kind,vfxId,size,originOffset,slot,visualScale,visible,elapsedMs:now-at,projectile:true};
}
export function launchProjectiles(room,player,base,now,count=1){
  room.projectiles??=[];
  const launched=Array.from({length:count},(_,i)=>({...base,id:randomUUID(),playerId:player.id,mapId:player.mapId,visible:base.kind==='pisces-skill'?i===0:true,
    constellationId:player.avatar.constellationId,level:player.avatar.level,at:now+i*120,distance:0,seen:new Set()}));
  room.projectiles.push(...launched);return launched.map(c=>projectileView(c,now));
}
export function projectileViews(room,mapId,now){return (room.projectiles||[]).filter(c=>c.mapId===mapId).map(c=>projectileView(c,now));}
export function advanceProjectiles(room,now,enemies,damage){
  const results=[],keep=[];
  for(const cast of room.projectiles||[]){
    const player=room.players.get(cast.playerId);
    const valid=player?.connected&&!player.away&&!player.avatar.blackStar&&player.mapId===cast.mapId&&
      player.avatar.constellationId===cast.constellationId&&player.avatar.level===cast.level&&ensureVitals(player).hp>0;
    if(!valid){results.push({mapId:cast.mapId,end:{id:cast.id,mapId:cast.mapId,distance:cast.distance},targets:[],playerTargets:[]});continue;}
    if(now<cast.at){keep.push(cast);continue;}
    // 물고기 스킬도 캐릭터 앞에서 사거리 끝까지 계속 전진합니다.
    // 높이만 클라이언트에서 포물선으로 보정하고 피해 경로는 이 선분과 일치합니다.
    const elapsed=Math.max(0,now-cast.at);
    const end=Math.min(cast.range,elapsed/cast.durationMs*cast.range);
    const contacts=enemies(room,player).filter(t=>!cast.seen.has(`${t.kind}:${t.entity.id}`))
      .map(t=>({target:t,distance:contact(cast,t,end)})).filter(t=>t.distance!==null).sort((a,b)=>a.distance-b.distance);
    // Q는 첫 몬스터에서 소멸. 같은 위치에 겹친 몬스터들은 기존 범위 규칙대로 함께 맞습니다.
    // 학생 PvP는 유지하지만 몬스터에 막힌 뒤쪽에는 피해를 주지 않습니다.
    const stop=cast.basic&&!cast.piercing?contacts.find(t=>t.target.kind==='monster')?.distance:undefined;
    const selected=contacts.filter(t=>stop===undefined||t.distance<=stop+.001).map(t=>t.target);
    for(const t of selected)cast.seen.add(`${t.kind}:${t.entity.id}`);
    const hit=damage(room,player,selected,cast.power,now,cast);
    cast.distance=stop??end;
    const finished=stop!==undefined||end>=cast.range;
    if(selected.length||finished)results.push({mapId:cast.mapId,...hit,...(finished?{end:{id:cast.id,mapId:cast.mapId,distance:cast.distance}}:{})});
    if(!finished)keep.push(cast);
  }
  room.projectiles=keep;return results;
}
