import {SPIRIT_SUMMON,SPIRIT_ORB,SPIRIT_BLUE_STAR} from '../shared/boss-skills.js';
import {onParadiseFloor} from '../shared/paradise-floor.js';
import {playersInArea,reflectLibraDamage} from './area-combat.js';
import {damagePlayer} from './vitals.js';
import {monsterType} from '../shared/monsters.js';
import {clearSpiritBlueStars,summonSpiritBlueStars} from './spirit-blue-stars.js';

const TAU=Math.PI*2;
const guardianType=monsterType('star-guardian'),guardianRadius=guardianType.radius;

export function clearSpiritKingEffects(room,bossId){
  for(const [id,monster] of room.monsters||[])if(monster.summonerId===bossId)room.monsters.delete(id);
  room.spiritOrbs=room.spiritOrbs?.filter(orb=>orb.bossId!==bossId)||[];
  clearSpiritBlueStars(room,bossId);
}

function summonGuardians(room,boss,now,map){
  const existing=[...room.monsters.values()].filter(m=>m.summonerId===boss.id&&m.hp>0);
  let created=0;
  for(let i=0;i<SPIRIT_SUMMON.count*4&&existing.length+created<SPIRIT_SUMMON.count;i++){
    const angle=TAU*(i% (SPIRIT_SUMMON.count*2))/(SPIRIT_SUMMON.count*2);
    const offset=boss.radius+guardianRadius+32;
    const ring=offset+Math.floor(i/(SPIRIT_SUMMON.count*2))*(guardianRadius*2+12);
    const x=boss.x+Math.cos(angle)*ring,y=boss.y+Math.sin(angle)*ring;
    if(!onParadiseFloor(map,x,y,guardianRadius))continue;
    if([...room.monsters.values()].some(m=>m.hp>0&&m.mapId===boss.mapId&&Math.hypot(x-m.x,y-m.y)<guardianRadius+m.radius+10))continue;
    room.spiritGuardianSequence=(room.spiritGuardianSequence||0)+1;
    const id=`${boss.id}-guardian-${room.spiritGuardianSequence}`;
    const targetEntries=[...boss.attackers];
    room.monsters.set(id,{id,typeId:'star-guardian',mapId:boss.mapId,x,y,radius:guardianRadius,
      hp:guardianType.hp,maxHp:guardianType.hp,respawnAt:null,spawnX:x,spawnY:y,summonerId:boss.id,
      mp:0,maxMp:0,targetId:boss.targetId,attackers:new Map(targetEntries),contributors:new Map(),
      meleePresence:new Map(),attackOrder:boss.attackOrder||targetEntries.length,mapExitCount:0,nextAttackAt:now+1000,
      dx:0,dy:0,facingX:boss.facingX||1,moving:false,
      patrolStartedAt:now,patrolPhaseOffset:0,patrolCycle:-1,nextDirectionAt:now,lastMoveAt:now});
    created++;
  }
  return created||false;
}

export function trySpiritKingSkills(room,boss,target,now,random,map){
  if(!target||boss.hp<=0)return false;
  const skills=[
    {rule:SPIRIT_SUMMON,ready:'summonReadyAt',decision:'summonDecisionAt',cast:()=>summonGuardians(room,boss,now,map)},
    {rule:SPIRIT_ORB,ready:'orbReadyAt',decision:'orbDecisionAt',cast:()=>{
      room.spiritOrbs??=[];
      const angle=Math.atan2(target.y-boss.y,target.x-boss.x);
      room.spiritOrbSequence=(room.spiritOrbSequence||0)+1;
      room.spiritOrbs.push({id:`${boss.id}-orb-${room.spiritOrbSequence}`,bossId:boss.id,mapId:boss.mapId,
        x:boss.x,y:boss.y,radius:SPIRIT_ORB.radius,dx:Math.cos(angle),dy:Math.sin(angle),
        startsAt:now,endsAt:now+SPIRIT_ORB.durationMs,lastMoveAt:now,lastHitAt:new Map(),power:boss.power||30});
    }},
    {rule:SPIRIT_BLUE_STAR,ready:'blueStarReadyAt',decision:'blueStarDecisionAt',cast:()=>summonSpiritBlueStars(room,boss,now,map,random)}
  ];
  for(const {rule,ready,decision,cast} of skills){
    if(now<(boss[ready]||0)||now<(boss[decision]??now)||boss.mp<rule.mana)continue;
    boss[decision]=now+rule.decisionMs;
    const roll=random();
    if(!Number.isFinite(roll)||roll<0||roll>=rule.chance)continue;
    const castResult=cast();
    if(castResult===false){boss[decision]=now+rule.decisionMs;continue;}
    boss.mp-=rule.mana;boss[ready]=now+rule.cooldownMs;
    return true;
  }
  return false;
}

export function tickSpiritOrbs(room,now,mapFor){
  const hits=[];
  room.spiritOrbs=(room.spiritOrbs||[]).filter(orb=>{
    const boss=room.monsters?.get(orb.bossId);
    if(!boss||boss.hp<=0||now>=orb.endsAt)return false;
    const map=mapFor(orb.mapId),dt=Math.max(0,Math.min(100,now-orb.lastMoveAt))/1000;
    orb.lastMoveAt=now;
    const step=SPIRIT_ORB.speed*dt;
    const canOccupy=(x,y)=>x>=Math.max(120,orb.radius)&&x<=map.width-Math.max(120,orb.radius)&&
      y>=Math.max(190,orb.radius)&&y<=map.height-Math.max(190,orb.radius)&&onParadiseFloor(map,x,y,orb.radius);
    const nextX=orb.x+orb.dx*step,nextY=orb.y+orb.dy*step;
    if(!canOccupy(nextX,nextY)){
      const flipX=!canOccupy(nextX,orb.y),flipY=!canOccupy(orb.x,nextY);
      if(flipX)orb.dx*=-1;
      if(flipY)orb.dy*=-1;
      // At a curved edge both axis probes can be inside while their diagonal is outside.
      if(!flipX&&!flipY){orb.dx*=-1;orb.dy*=-1;}
    }
    const x=orb.x+orb.dx*step,y=orb.y+orb.dy*step;
    if(canOccupy(x,y)){orb.x=x;orb.y=y;}
    const players=playersInArea(room,{mapId:orb.mapId,x:orb.x,y:orb.y,radius:orb.radius,
      excludeTeachers:true,teacherTargetIds:boss.teacherRetaliation});
    for(const player of players){
      if(now-(orb.lastHitAt.get(player.id)??-Infinity)<SPIRIT_ORB.hitIntervalMs)continue;
      const result=damagePlayer(player,orb.power*SPIRIT_ORB.damageMultiplier,now,{room});
      if(!result)continue;
      if(result.reflectedDamage)reflectLibraDamage(room,player,{sourceMonsterId:boss.id},result.reflectedDamage,now);
      orb.lastHitAt.set(player.id,now);
      hits.push({monsterId:boss.id,mapId:orb.mapId,x:orb.x,y:orb.y,dx:orb.dx,dy:orb.dy,reach:orb.radius,
        skillKind:SPIRIT_ORB.kind,durationMs:450,targetId:player.id,...result,noEffect:true});
    }
    return true;
  });
  return hits;
}

export function spiritOrbViews(room,mapId,now){
  return (room.spiritOrbs||[]).filter(orb=>orb.mapId===mapId&&now<orb.endsAt&&room.monsters?.get(orb.bossId)?.hp>0)
    .map(({id,mapId,x,y,radius,startsAt,endsAt})=>({id,mapId,x,y,radius,startsAt,endsAt}));
}
