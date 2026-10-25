import {RULES} from '../shared/config.js';
import {LEOON_ROAR,LEOON_CHARGE} from '../shared/boss-skills.js';
import {playersInArea,reflectLibraDamage} from './area-combat.js';
import {damagePlayer,ensureVitals} from './vitals.js';

const TAU=Math.PI*2;
export function leoonRoarAreas(room,monster,target,map,random=Math.random){
  const radius=monster.radius*LEOON_ROAR.areaRadiusFactor,range=monster.radius*LEOON_ROAR.rangeFactor;
  const eligible=player=>player?.connected&&!player.away&&!player.avatar?.blackStar&&player.mapId===monster.mapId&&
    (player.role!=='teacher'||(!player.avatar?.teacherPreview&&monster.teacherRetaliation?.has(player.id)))&&ensureVitals(player)?.hp>0;
  const attackers=[...monster.attackers].sort((a,b)=>b[1]-a[1]).map(([id])=>room.players.get(id));
  const selected=[target,...attackers].filter((player,index,list)=>eligible(player)&&list.findIndex(other=>other?.id===player.id)===index).slice(0,LEOON_ROAR.targetAreas);
  const areas=selected.map(player=>({x:player.x,y:player.y,radius}));
  for(let i=0;i<LEOON_ROAR.randomAreas;i++){
    let picked=null;
    for(let attempt=0;attempt<24;attempt++){
      const angle=TAU*random(),distance=range*Math.sqrt(Math.max(0,Math.min(1,random())));
      const x=monster.x+Math.cos(angle)*distance,y=monster.y+Math.sin(angle)*distance;
      if(map.onFloor(x,y,radius*.5)&&areas.every(area=>Math.hypot(area.x-x,area.y-y)>=radius*1.3)){picked={x,y,radius};break;}
    }
    if(!picked){
      const angle=TAU*(i+.5)/LEOON_ROAR.randomAreas,distance=monster.radius*1.8;
      const x=monster.x+Math.cos(angle)*distance,y=monster.y+Math.sin(angle)*distance;
      picked=map.onFloor(x,y,radius*.5)?{x,y,radius}:{x:monster.x,y:monster.y,radius};
    }
    areas.push(picked);
  }
  return areas;
}
export function beginLeoonRoar(monster,now,power){
  monster.mp-=LEOON_ROAR.mana;monster.roarReadyAt=now+LEOON_ROAR.cooldownMs;
  monster.leoonSkill={kind:LEOON_ROAR.kind,mapId:monster.mapId,stage:'glow',startsAt:now,stageEndsAt:now+LEOON_ROAR.glowMs,
    endsAt:now+LEOON_ROAR.glowMs+LEOON_ROAR.warningMs,areas:[],power};
  monster.moving=false;
}
export function beginLeoonCharge(monster,now,power){
  monster.mp-=LEOON_CHARGE.mana;monster.chargeReadyAt=now+LEOON_CHARGE.cooldownMs;
  monster.leoonSkill={kind:LEOON_CHARGE.kind,mapId:monster.mapId,stage:'stomp',startsAt:now,stageEndsAt:now+LEOON_CHARGE.stompMs,
    repeat:0,fromX:monster.x,fromY:monster.y,toX:monster.x,toY:monster.y,power};
  monster.moving=false;
}
function hitPlayers(room,monster,candidates,power,now,visual){
  const hits=[];
  for(const player of candidates){
    const result=damagePlayer(player,power,now,{room});
    if(!result)continue;
    if(result.reflectedDamage)reflectLibraDamage(room,player,{sourceMonsterId:monster.id},result.reflectedDamage,now);
    hits.push({...visual,targetId:player.id,...result,noEffect:true});
  }
  return hits;
}
function roarHits(room,monster,now){
  const skill=monster.leoonSkill,seen=new Set(),hits=[];
  for(const [areaIndex,area] of skill.areas.entries()){
    const visual={monsterId:monster.id,mapId:monster.mapId,x:area.x,y:area.y,dx:0,dy:-1,reach:0,
      skillKind:LEOON_ROAR.kind,areaIndex,durationMs:LEOON_ROAR.durationMs};
    hits.push({...visual,attackOnly:true});
    const candidates=playersInArea(room,{...area,mapId:monster.mapId,excludeTeachers:true,teacherTargetIds:monster.teacherRetaliation})
      .filter(player=>!seen.has(player.id));
    for(const player of candidates)seen.add(player.id);
    hits.push(...hitPlayers(room,monster,candidates,skill.power*LEOON_ROAR.damageMultiplier,now,visual));
  }
  return hits;
}
function chargeEnd(monster,target,map){
  const dx=target.x-monster.x,dy=target.y-monster.y,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length;
  const max=monster.radius*LEOON_CHARGE.distanceFactor,step=Math.min(24,monster.radius*.15);
  let distance=0;
  for(let candidate=step;candidate<=max+step/2;candidate+=step){
    const traveled=Math.min(max,candidate),x=monster.x+ux*traveled,y=monster.y+uy*traveled;
    if(x<Math.max(120,monster.radius)||x>map.width-Math.max(120,monster.radius)||
      y<Math.max(190,monster.radius)||y>map.height-Math.max(190,monster.radius)||
      !map.onFloor(x,y,monster.radius))break;
    distance=traveled;
  }
  return {fromX:monster.x,fromY:monster.y,toX:monster.x+ux*distance,toY:monster.y+uy*distance,dx:ux,dy:uy,
    halfWidth:monster.radius*LEOON_CHARGE.halfWidthFactor};
}
function chargeHits(room,monster,skill,now){
  const visual={monsterId:monster.id,mapId:monster.mapId,x:skill.fromX,y:skill.fromY,dx:skill.dx,dy:skill.dy,
    reach:Math.hypot(skill.toX-skill.fromX,skill.toY-skill.fromY),halfWidth:skill.halfWidth,
    skillKind:LEOON_CHARGE.kind,durationMs:LEOON_CHARGE.durationMs,repeat:skill.repeat};
  const candidates=[];
  for(const player of room.players.values()){
    if(!player.connected||player.away||player.avatar?.blackStar||player.mapId!==monster.mapId||
      (player.role==='teacher'&&(player.avatar?.teacherPreview||!monster.teacherRetaliation?.has(player.id)))||ensureVitals(player)?.hp<=0)continue;
    const ax=skill.toX-skill.fromX,ay=skill.toY-skill.fromY,denom=ax*ax+ay*ay;
    const ratio=denom?Math.max(0,Math.min(1,((player.x-skill.fromX)*ax+(player.y-skill.fromY)*ay)/denom)):0;
    const x=skill.fromX+ax*ratio,y=skill.fromY+ay*ratio;
    if(Math.hypot(player.x-x,player.y-y)<=skill.halfWidth+RULES.radius)candidates.push(player);
  }
  return [{...visual,attackOnly:true},...hitPlayers(room,monster,candidates,skill.power*LEOON_CHARGE.damageMultiplier,now,visual)];
}
export function tickLeoonSkill(room,monster,target,now,map,random=Math.random){
  const skill=monster.leoonSkill;if(!skill)return null;
  if(!target||monster.hp<=0||skill.mapId!==monster.mapId||(monster.sleepUntil||0)>skill.startsAt||(monster.stunUntil||0)>skill.startsAt){
    monster.leoonSkill=null;monster.moving=false;return [];
  }
  if(skill.kind===LEOON_ROAR.kind){
    monster.moving=false;
    if(skill.stage==='glow'&&now>=skill.stageEndsAt){skill.stage='warning';skill.stageEndsAt=skill.endsAt;
      skill.areas=leoonRoarAreas(room,monster,target,map,random);}
    if(now<skill.endsAt)return [];
    const hits=roarHits(room,monster,now);monster.leoonSkill=null;monster.nextAttackAt=now+1000;return hits;
  }
  if(skill.stage==='stomp'&&now>=skill.stageEndsAt){
    Object.assign(skill,{...chargeEnd(monster,target,map),stage:'warning',stageEndsAt:now+LEOON_CHARGE.warningMs});
    if(Math.abs(skill.dx)>.05)monster.facingX=skill.dx<0?-1:1;
  }else if(skill.stage==='warning'&&now>=skill.stageEndsAt){
    skill.stage='dash';skill.stageStartedAt=now;skill.stageEndsAt=now+LEOON_CHARGE.dashMs;
  }else if(skill.stage==='dash'&&now>=skill.stageEndsAt){
    monster.x=skill.toX;monster.y=skill.toY;monster.moving=false;
    const hits=chargeHits(room,monster,skill,now);
    if(skill.repeat+1>=LEOON_CHARGE.repeats){monster.leoonSkill=null;monster.nextAttackAt=now+1000;}
    else Object.assign(skill,{stage:'stomp',startsAt:now,stageEndsAt:now+LEOON_CHARGE.stompMs,repeat:skill.repeat+1});
    return hits;
  }
  if(skill.stage==='dash'){
    const progress=Math.max(0,Math.min(1,(now-skill.stageStartedAt)/LEOON_CHARGE.dashMs));
    monster.x=skill.fromX+(skill.toX-skill.fromX)*progress;
    monster.y=skill.fromY+(skill.toY-skill.fromY)*progress;monster.moving=true;
  }else monster.moving=false;
  return [];
}
