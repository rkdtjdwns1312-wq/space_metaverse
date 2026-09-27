import {randomUUID} from 'node:crypto';
import {isSagittarius,sagittariusSkill} from '../shared/sagittarius-skills.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf} from '../shared/combat.js';
import {RULES} from '../shared/config.js';
import {monstersOf,damageMonster} from './monsters.js';
import {ensureVitals,playerVitals,damagePlayer} from './vitals.js';
import {ensure} from './rooms.js';

// 실행 중 전투 정보만 room/player에 보관합니다. 영구 저장 허용 목록에는 넣지 않습니다.
const valid=p=>p?.connected&&!p.away&&!p.avatar?.blackStar&&ensureVitals(p)?.hp>0;
function enemies(room,player){
  return [...monstersOf(room).values()].filter(m=>m.hp>0&&m.mapId===player.mapId).map(m=>({entity:m,kind:'monster',radius:m.radius}))
    .concat([...room.players.values()].filter(p=>p.id!==player.id&&p.mapId===player.mapId&&valid(p)).map(p=>({entity:p,kind:'player',radius:RULES.radius})));
}
function nearest(list,x,y){return list.sort((a,b)=>Math.hypot(a.entity.x-x,a.entity.y-y)-Math.hypot(b.entity.x-x,b.entity.y-y))[0];}
function damage(room,player,list,power,now){
  const targets=[],playerTargets=[];
  for(const target of list){
    if(target.kind==='monster'){const hit=damageMonster(room,target.entity,player,power,now);if(hit)targets.push(hit);}
    else{const hit=damagePlayer(target.entity,power,now);if(hit)playerTargets.push({targetId:target.entity.id,...hit});}
  }
  return {targets,playerTargets};
}
const inCircle=(list,x,y,r)=>list.filter(t=>Math.hypot(t.entity.x-x,t.entity.y-y)<=r+t.radius);
export function skillCooldowns(player){return {...player.sagittariusCooldowns};}
export function castSagittarius(room,player,slot,now=Date.now()){
  const skill=sagittariusSkill(slot);
  ensure(isSagittarius(player)&&skill,'사용할 수 없는 스킬이에요.');
  ensure(valid(player),'지금은 스킬을 사용할 수 없어요.');
  ensure(player.avatar.level>=skill.level,`LV${skill.level}부터 사용할 수 있어요.`);
  const until=player.sagittariusCooldowns?.[slot]||0;
  ensure(now>=until,`스킬을 다시 쓰려면 ${Math.ceil((until-now)/1000)}초 기다려주세요.`);
  const vitals=ensureVitals(player);ensure(vitals.mp>=skill.mana,'마나가 부족해요.');
  const size=avatarSizeOf(player),direction=player.facing||{x:0,y:1};
  const length=Math.hypot(direction.x,direction.y)||1,dx=direction.x/length,dy=direction.y/length;
  const list=enemies(room,player),power=attackPowerOf(player.avatar.level,player.avatar.constellationId,player);
  let target;
  if(slot===2)target=nearest(list,player.x,player.y);
  if(slot===3)target=nearest(list.filter(t=>t.kind==='monster'&&(t.entity.x-player.x)*dx+(t.entity.y-player.y)*dy>0),player.x,player.y);
  if(slot>=2)ensure(target,slot===3?'바라보는 방향에 몬스터가 없어요.':'이 맵에 공격할 대상이 없어요.');
  // 모든 조건 통과 뒤에만 MP와 재사용 시간을 차감/설정합니다.
  vitals.mp-=skill.mana;
  player.sagittariusCooldowns??={};player.sagittariusCooldowns[slot]=now+skill.cooldownMs;
  const base={id:randomUUID(),playerId:player.id,mapId:player.mapId,slot,dx,dy,size,x:player.x,y:player.y,at:now};
  let result={targets:[],playerTargets:[]},effects=[];
  if(slot<2){
    const range=size*skill.rangeWidths,width=size*.13;
    // 끝점을 포함한 선분 판정. 겹쳐 있는 모든 대상에게 한 번씩 피해를 줍니다.
    const line=list.filter(t=>{
      const vx=t.entity.x-player.x,vy=t.entity.y-player.y,along=vx*dx+vy*dy;
      if(along<0)return false;
      const projection=Math.max(0,Math.min(range,along));
      return Math.hypot(vx-dx*projection,vy-dy*projection)<=t.radius+width;
    });
    result=damage(room,player,line,slot===0?power+1:power*3,now);
    effects=[{...base,kind:'arrow',range,durationMs:slot===0?360:600}];
  }else{
    room.sagittariusCasts??=new Map();
    const cast={...base,kind:slot===2?'hunter':'rain',x:slot===2?player.x+dx*size/2:target.entity.x,y:slot===2?player.y+dy*size/2:target.entity.y,lastMoveAt:now,
      radius:slot===2?size:size/2*Math.sqrt(5),power,level:player.avatar.level,
      nextAt:now+skill.intervalMs,endsAt:now+skill.durationMs,targetId:target.entity.id,targetKind:target.kind};
    room.sagittariusCasts.set(cast.id,cast);
  }
  return {ready:true,...result,effects,vitals:playerVitals(player),cooldowns:skillCooldowns(player),serverNow:now};
}
export function advanceSagittarius(room,now=Date.now()){
  const results=[];
  for(const [id,cast] of room.sagittariusCasts||[]){
    const player=room.players.get(cast.playerId),skill=sagittariusSkill(cast.slot);
    if(!valid(player)||player.mapId!==cast.mapId||!isSagittarius(player)||player.avatar.level!==cast.level){room.sagittariusCasts.delete(id);continue;}
    const list=enemies(room,player);
    if(cast.slot===2){
      const target=nearest(list,cast.x,cast.y);
      if(target){
        const vx=target.entity.x-cast.x,vy=target.entity.y-cast.y,distance=Math.hypot(vx,vy);
        const travel=Math.min(distance,Math.max(0,now-cast.lastMoveAt)/1000*cast.size*5);
        if(distance){cast.x+=vx/distance*travel;cast.y+=vy/distance*travel;cast.dx=vx/distance;cast.dy=vy/distance;}
        cast.targetId=target.entity.id;cast.targetKind=target.kind;
      }
      cast.lastMoveAt=now;
    }
    // fake clock·일시 지연에도 5회만 발생하며 마지막 타격 뒤 딱 한 번 폭발합니다.
    while(now>=cast.nextAt&&cast.nextAt<=cast.endsAt){
      const current=enemies(room,player);
      const selected=cast.slot===2?current.filter(t=>t.entity.id===cast.targetId&&t.kind===cast.targetKind):inCircle(current,cast.x,cast.y,cast.radius);
      const hit=damage(room,player,selected,cast.power*(cast.slot===2?1:2),cast.nextAt);
      results.push({...cast,...hit,kind:cast.slot===2?'hunter-hit':'rain-hit',durationMs:450});
      cast.nextAt+=skill.intervalMs;
    }
    if(now>=cast.endsAt){
      const hit=damage(room,player,inCircle(enemies(room,player),cast.x,cast.y,cast.radius),cast.power*(cast.slot===2?2:5),now);
      results.push({...cast,...hit,kind:'explosion',durationMs:700});room.sagittariusCasts.delete(id);
    }
  }
  return results;
}
export function sagittariusViews(room,mapId,now=Date.now()){
  return [...(room.sagittariusCasts?.values()||[])].filter(c=>c.mapId===mapId&&c.endsAt>now).map(c=>({
    id:c.id,playerId:c.playerId,mapId:c.mapId,slot:c.slot,kind:c.kind,x:c.x,y:c.y,dx:c.dx,dy:c.dy,
    size:c.size,radius:c.radius,remainingMs:Math.max(0,c.endsAt-now)}));
}
