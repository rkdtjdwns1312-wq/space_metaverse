import {randomUUID} from 'node:crypto';
import {ensureVitals} from './vitals.js';
import {swanProjectilePoint} from '../shared/swan-skills.js';
import {piscesPortalGeometry} from '../shared/pisces-portals.js';

// 실제 이동 구간과 원형 피격 범위의 교차를 검사합니다. 낮은 tick에서도 적을 건너뛰지 않습니다.
function contact(cast,target,end){
  const vx=target.entity.x-cast.x,vy=target.entity.y-cast.y;
  // 그려진 투사체의 가장자리 바깥까지 작은 판정 여백을 둡니다.
  const padding=target.kind==='monster'?Math.min(20,Math.max(4,(cast.size||0)*(cast.visualScale||1)*.08)):0;
  const along=vx*cast.dx+vy*cast.dy,r=target.radius+cast.width+padding;
  if(cast.piscesPortal){
    // 포탈은 앞뒤를 잘라내므로 몸통의 세로 반폭을 사거리 앞뒤에 더하지 않습니다.
    const g=piscesPortalGeometry(cast),edge=target.radius+padding;
    if(along+edge<g.start||along-edge>g.end)return null;
    const across=Math.abs(vx*cast.dy-vy*cast.dx);
    if(across>r)return null;
    const entry=Math.max(cast.distance,g.start,along-edge);
    return along+edge>=cast.distance&&entry<=end?entry:null;
  }
  if(cast.kind==='cygnus-attack'&&cast.swanLane){
    for(let distance=cast.distance;distance<=end+6;distance+=6){
      const d=Math.min(end,distance),point=swanProjectilePoint(cast,d/cast.range);
      if(Math.hypot(point.x-target.entity.x,point.y-target.entity.y)<=r)return d;
      if(d===end)break;
    }
    return null;
  }
  if(cast.kind==='pisces-skill'&&cast.fishLane){
    for(let distance=cast.distance;distance<=end+6;distance+=6){
      const d=Math.min(end,distance),p=d/cast.range;
      const lateral=cast.fishLane*cast.size*.22*Math.sin(Math.PI*p);
      const x=cast.x+cast.dx*d-cast.dy*lateral,y=cast.y+cast.dy*d+cast.dx*lateral;
      if(Math.hypot(x-target.entity.x,y-target.entity.y)<=r)return d;
      if(d===end)break;
    }
    return null;
  }
  if(along<0)return null;
  const perpendicular2=Math.max(0,vx*vx+vy*vy-along*along);
  if(perpendicular2>r*r)return null;
  const half=Math.sqrt(r*r-perpendicular2),entry=Math.max(cast.distance,along-half,0);
  return along+half>=cast.distance&&entry<=end?entry:null;
}
export function projectileView(cast,now){
  const {id,playerId,mapId,x,y,dx,dy,range,durationMs,at,basic,kind,vfxId,size,originOffset,slot,visualScale,visible,swanLane,fishLane,fishStage,level,piscesPortal,fishIndex}=cast;
  return {id,playerId,mapId,x,y,dx,dy,range,durationMs,basic,kind,vfxId,size,originOffset,slot,visualScale,visible,swanLane,fishLane,fishStage,level,piscesPortal,fishIndex,elapsedMs:now-at,projectile:true};
}
export function launchProjectiles(room,player,base,now,count=1){
  room.projectiles??=[];
  const launched=Array.from({length:count},(_,i)=>({...base,id:randomUUID(),playerId:player.id,mapId:player.mapId,visible:base.piscesPortal||base.kind!=='pisces-skill'||i===0,
    constellationId:player.avatar.constellationId,level:player.avatar.level,at:now+i*120,distance:base.piscesPortal?piscesPortalGeometry(base).start:0,seen:new Set()}));
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
    // 입구에서 나온 머리의 실제 전진 구간과 피해 판정을 맞춥니다.
    const elapsed=Math.max(0,now-cast.at);
    const end=cast.piscesPortal?piscesPortalGeometry(cast,elapsed/cast.durationMs).nose:Math.min(cast.range,elapsed/cast.durationMs*cast.range);
    const contacts=enemies(room,player).filter(t=>t.entity.typeId!=='dark-star-card'&&!cast.seen.has(`${t.kind}:${t.entity.id}`)&&!(cast.basic&&!cast.healing&&cast.kind!=='corona-finale'&&player.role==='student'&&t.kind==='player'&&t.entity.role==='student'))
      .map(t=>({target:t,distance:contact(cast,t,end)})).filter(t=>t.distance!==null).sort((a,b)=>a.distance-b.distance);
    // Q는 첫 몬스터에서 소멸. 같은 위치에 겹친 몬스터들은 기존 범위 규칙대로 함께 맞습니다.
    // 학생 기본 공격은 친구를 통과하며, E 스킬과 강화 Q의 회복 효과는 유지합니다.
    const stop=cast.basic&&!cast.piercing?contacts.find(t=>t.target.kind==='monster')?.distance:undefined;
    const selected=contacts.filter(t=>stop===undefined||t.distance<=stop+.001).map(t=>t.target);
    for(const t of selected)cast.seen.add(`${t.kind}:${t.entity.id}`);
    const hit=damage(room,player,selected,cast.power,now,cast);
    cast.distance=stop??end;
    const finished=stop!==undefined||(cast.piscesPortal?elapsed>=cast.durationMs:end>=cast.range);
    if(selected.length||finished)results.push({mapId:cast.mapId,...hit,...(finished?{end:{id:cast.id,mapId:cast.mapId,distance:cast.distance}}:{})});
    if(!finished)keep.push(cast);
  }
  room.projectiles=keep;return results;
}
