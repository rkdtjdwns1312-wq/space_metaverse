import {MONSTER_SPAWNS,monsterType,MONSTER_HP,MONSTER_COMBAT,MONSTER_LEVEL_STATS} from '../shared/monsters.js';
import {ATTACK_VISUAL,attackGeometryOf} from '../shared/combat.js';
import {RULES,mapOf} from '../shared/config.js';
import {ensureVitals} from './vitals.js';
import {constellationOf} from '../shared/constellations.js';
import {damagePlayersInArea} from './area-combat.js';
import {addEnergyDrop,addRecipeDrop} from './energy-drops.js';
import {isParadise,onParadiseFloor} from '../shared/paradise-floor.js';
import {onOriginFloor} from '../shared/origin-floor.js';
import {SERENA} from '../shared/serena.js';
import {monsterRespawnMs,finishBossDefeat} from './boss-lifecycle.js';
import {bossVictoryCredits} from './serena-progress.js';


export const MONSTER_RULES=Object.freeze({walkMs:2000,restMs:2000,directionMs:2000,speed:36,radius:24,respawnMs:10000,hitRadius:18,attackMs:1000,mapExitHealCount:3});
const randomPatrolOffset=random=>Math.floor(Math.max(0,Math.min(.999999999,random()))*(MONSTER_RULES.walkMs+MONSTER_RULES.restMs));
const spawns=[[260,280],[600,260],[920,300],[360,590],[830,590]];
const largeSpawns=[[430.56,256.94],[597.22,256.94],[763.89,256.94],[291.67,312.5],[902.78,312.5]];
const sunSpawns=[[-330,-110],[0,-170],[330,-110],[-240,140],[240,140]];
export const monstersMayOverlap=mapId=>mapId==='star-origin-1'||mapId==='star-origin-2';
// 일반 몬스터는 단계별 10/15/20초, 보스는 영구 저장한 24시간 뒤 복원합니다.
export function monstersOf(room,now=Date.now(),phaseRandom=Math.random){
  const create=(spawn,i)=>{
    const type=monsterType(spawn.typeId);
    const map=mapOf(type.mapId,room.planets?.values?.()||[]);
    const [baseX,baseY]=(({1:1,2:2,3:4,4:5}[type.level]||1)>=4?largeSpawns:spawns)[i%5];
    const [sx,sy]=sunSpawns[i%5];
    const statue=type.id===SERENA.typeId?map.objects.find(o=>o.id===SERENA.statueId):null;
    const x=statue?statue.x:type.boss?map.width/2:isParadise(map.id)?map.width/2+sx:baseX*map.width/1200,y=statue?statue.y:type.boss?map.height/2:isParadise(map.id)?map.height/2+sy:baseY*map.height/900;
    // 낙원도 공통 레벨 규칙을 따릅니다: 1단계×1, 2단계×2, 3단계×4, 4단계×5.
    // 별의 시작점 3 몬스터는 기존 그림과 충돌 반경을 함께 절반으로 줄입니다.
    const multiplier={1:1,2:2,3:4,4:5}[type.level]||1;
    const radius=type.radius??MONSTER_RULES.radius*(type.boss?8:multiplier);
    const patrolPhaseOffset=randomPatrolOffset(phaseRandom),patrolStartedAt=now+patrolPhaseOffset;
    const respawnAt=room.bossRespawns?.[spawn.id]>now?room.bossRespawns[spawn.id]:null;
    return [spawn.id,{id:spawn.id,typeId:type.id,mapId:type.mapId,x,y,radius,
      hp:respawnAt?0:type.hp??MONSTER_HP[type.mapId],maxHp:type.hp??MONSTER_HP[type.mapId],respawnAt,spawnX:x,spawnY:y,
      targetId:null,attackers:new Map(),contributors:new Map(),attackOrder:0,mapExitCount:0,nextAttackAt:0,dx:0,dy:0,facingX:1,moving:false,
      patrolStartedAt,patrolPhaseOffset,patrolCycle:-1,nextDirectionAt:patrolStartedAt,lastMoveAt:now}];
  };
  if(!room.monsters)room.monsters=new Map(MONSTER_SPAWNS.map(create));
  // 수동 소환 상태만 복구합니다. 휴면/24시간 회복 중에는 자동 생성하지 않습니다.
  if(room.serena?.state==='active'&&!room.monsters.has(SERENA.monsterId)){
    const [id,m]=create({id:SERENA.monsterId,typeId:SERENA.typeId},0);
    m.hp=m.maxHp;m.respawnAt=null;room.monsters.set(id,m);
  }
  return room.monsters;
}
export function monsterViews(room,now=Date.now()){
  return [...monstersOf(room,now).values()].map(m=>({id:m.id,typeId:m.typeId,mapId:m.mapId,x:m.x,y:m.y,radius:m.radius,
    facingX:m.facingX||1,moving:!!m.moving,hp:m.hp,maxHp:m.maxHp,alive:m.hp>0,busy:false,targetId:m.targetId,
    ...(m.pendingAttack&&m.hp>0?{warning:{x:m.pendingAttack.x,y:m.pendingAttack.y,radius:m.pendingAttack.radius,startsAt:m.pendingAttack.startsAt,endsAt:m.pendingAttack.endsAt}}:{}),
    poisoned:!!m.combatPoison,sleeping:(m.sleepUntil||0)>now,stunned:(m.stunUntil||0)>now,cursed:[...(m.capricornCurses?.values()||[])].some(c=>c.endsAt>now),attackPower:monsterType(m.typeId)?.power??MONSTER_COMBAT[m.mapId].power}));
}
// 한 번에 범위 안의 모든 몬스터를 맞힙니다. 방향·범위·피해량은 서버가 정합니다.
export function monstersInAttackArea(room,player,now=Date.now()){
  const facing=player.facing||{x:0,y:1},geometry=attackGeometryOf(player);
  const hx=player.x+facing.x*geometry.reach,hy=player.y+facing.y*geometry.reach;
  return [...monstersOf(room,now).values()].filter(m=>{
    const dx=m.x-player.x,dy=m.y-player.y;
    return m.hp>0&&m.mapId===player.mapId&&dx*facing.x+dy*facing.y>0&&
      Math.hypot(m.x-hx,m.y-hy)<=m.radius+geometry.radius;
  }).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
}
export function strikeMonsters(room,player,power,now=Date.now()){
  return monstersInAttackArea(room,player,now).map(target=>damageMonster(room,target,player,power,now));
}
// Q와 스킬 모두 이 경로를 거쳐 기여도·추격·드랍을 한 번만 처리합니다.
export function damageMonster(room,target,player,power,now=Date.now(),{energyRoll,recipeRoll,bossRoll,ignoreSleep=false,fixedDamage=null,silent=false,retaliateTeacher=false}={}){
  if(target.hp<=0||power<0||!Number.isFinite(power))return null;
  const raw=(target.sleepUntil||0)>now&&!ignoreSleep?power*2:power;
  const type=monsterType(target.typeId),level=type?.level??target.level;
  const defense=type?.defense??MONSTER_LEVEL_STATS[level]?.defense??MONSTER_COMBAT[target.mapId]?.defense??0;
  const dealt=fixedDamage??Math.max(1,Math.round(raw)-defense);
  // 지난 공격자가 떠난 전투를 먼저 정리한 뒤 새 공격 피해를 적용합니다.
  selectMonsterTarget(room,target);
  // 남은 HP를 넘는 과잉 피해로 마지막 공격자가 소유권을 빼앗지 않도록 실제 감소량만 합산합니다.
  target.contributors??=new Map();
  target.contributors.set(player.id,(target.contributors.get(player.id)||0)+Math.min(dealt,target.hp));
  target.hp=Math.max(0,target.hp-dealt);
  if(!silent){room.damageNumbers??=[];room.damageNumbers.push({targetId:target.id,targetKind:'monster',mapId:target.mapId,x:target.x,y:target.y,damage:dealt});
    if(room.damageNumbers.length>200)room.damageNumbers.shift();}
  if(target.hp===0){
    if(type?.boss){
      if(room.persistBossDefeats){
        room.pendingBossDeaths??=new Map();
        room.pendingBossDeaths.set(target.id,{at:now,contributors:[...target.contributors],credits:bossVictoryCredits(room,target,target.contributors)});
      }else finishBossDefeat(room,target,target.contributors,now,{energyRoll,recipeRoll,bossRoll});
    }else{
      addRecipeDrop(room,target,target.contributors,now,recipeRoll);
      addEnergyDrop(room,target,target.contributors,now,energyRoll);
    }
    target.respawnAt=now+monsterRespawnMs(type);target.targetId=null;target.pendingAttack=null;target.attackers.clear();target.teacherRetaliation?.clear();target.contributors.clear();target.mapExitCount=0;
  }
  else{
    if(!target.attackers.size)target.nextAttackAt=Math.max(target.nextAttackAt,now+150);
    // Only the regular teacher's E opts this particular monster into retaliation.
    if(retaliateTeacher&&player.role==='teacher'&&!player.avatar?.teacherPreview)(target.teacherRetaliation??=new Set()).add(player.id);
    if(player.role!=='teacher'||target.teacherRetaliation?.has(player.id))target.attackers.set(player.id,++target.attackOrder);
    selectMonsterTarget(room,target);
  }
  return {monsterId:target.id,damage:dealt,hp:target.hp,maxHp:target.maxHp,defeated:target.hp===0};
}
// 이전 서버 테스트/연동의 단수 응답 호환. 실제 적용은 항상 모든 대상입니다.
export const strikeMonster=(...args)=>strikeMonsters(...args)[0]||null;
// 같은 순위 안에서는 마지막 공격자가 우선. 공격하지 않은 학생은 후보가 되지 않습니다.
export function selectMonsterTarget(room,monster){
  const candidates=[],hadAttackers=monster.attackers.size>0;
  for(const [id,order] of monster.attackers){
    const player=room.players?.get(id);
    // 현재 공격자 목록에서 맵을 실제로 떠난 사람만 한 번 집계합니다.
    // 목록에서 제거하므로 다음 틱에 중복 집계하거나 단순 재입장을 집계하지 않습니다.
    if(player&&player.mapId!==monster.mapId)monster.mapExitCount=(monster.mapExitCount||0)+1;
    if(!player||!player.connected||player.away||(player.role==='teacher'&&(player.avatar?.teacherPreview||!monster.teacherRetaliation?.has(id)))||player.avatar?.blackStar||player.mapId!==monster.mapId||!(ensureVitals(player)?.hp>0)){
      monster.attackers.delete(id);monster.teacherRetaliation?.delete(id);continue;
    }
    const type=player.role==='teacher'?null:constellationOf(player.avatar.constellationId,player.avatar.level)?.type;
    candidates.push({player,order,priority:type==='수호계'?0:type==='특수계'?1:2});
  }
  candidates.sort((a,b)=>a.priority-b.priority||b.order-a.order);
  const selected=candidates[0]?.player||null;
  if(monster.hp>0&&((hadAttackers&&!selected)||monster.mapExitCount>=MONSTER_RULES.mapExitHealCount)){
    monster.hp=monster.maxHp;monster.mapExitCount=0;monster.contributors?.clear();
    // 3회 이탈 후에도 남은 학생은 계속 추적하며 공격 간격은 유지합니다.
    if(!selected)monster.nextAttackAt=0;
  }
  monster.targetId=selected?.id||null;return selected;
}
export function moveMonsters(room,now=Date.now(),random=Math.random){
  const monsters=monstersOf(room,now);
  const hits=[];
  const cycleMs=MONSTER_RULES.walkMs+MONSTER_RULES.restMs;
  for(const m of monsters.values()){
    if(m.hp<=0){
      if(m.typeId===SERENA.typeId||room.pendingBossDeaths?.has(m.id))continue;
      if(now<m.respawnAt)continue;
      if(!monstersMayOverlap(m.mapId)&&[...monsters.values()].some(o=>o!==m&&o.hp>0&&o.mapId===m.mapId&&Math.hypot(m.spawnX-o.x,m.spawnY-o.y)<m.radius+o.radius+10))continue;
      const patrolPhaseOffset=randomPatrolOffset(random),patrolStartedAt=now+patrolPhaseOffset;
      Object.assign(m,{hp:m.maxHp,respawnAt:null,targetId:null,pendingAttack:null,attackers:new Map(),teacherRetaliation:new Set(),contributors:new Map(),attackOrder:0,mapExitCount:0,nextAttackAt:0,x:m.spawnX,y:m.spawnY,lastMoveAt:now,patrolStartedAt,patrolPhaseOffset,patrolCycle:-1,nextDirectionAt:patrolStartedAt});
    }
    const dt=Math.max(0,Math.min(100,now-m.lastMoveAt))/1000;m.lastMoveAt=now;
    const type=monsterType(m.typeId),rule=type.combat??MONSTER_COMBAT[m.mapId],factor=rule.speedFactor;
    const previousTarget=m.targetId,target=selectMonsterTarget(room,m);
    if(previousTarget&&!target){m.patrolPhaseOffset=randomPatrolOffset(random);m.patrolStartedAt=now+m.patrolPhaseOffset;m.patrolCycle=-1;m.nextDirectionAt=m.patrolStartedAt;}
    if((m.sleepUntil||0)>now||(m.stunUntil||0)>now){m.pendingAttack=null;m.moving=false;continue;}
    if(m.pendingAttack){
      m.moving=false;
      if(now>=m.pendingAttack.endsAt){
        const warning=m.pendingAttack;m.pendingAttack=null;
        const results=damagePlayersInArea(room,{mapId:m.mapId,x:warning.x,y:warning.y,radius:warning.radius,excludeTeachers:true,teacherTargetIds:m.teacherRetaliation,sourceMonsterId:m.id},rule.power,now);
        m.nextAttackAt=now+rule.attackMs;
        const visual={monsterId:m.id,mapId:m.mapId,x:m.x,y:m.y,dx:warning.dx,dy:warning.dy,reach:warning.reach,durationMs:800,
          warningX:warning.x,warningY:warning.y,warningRadius:warning.radius};
        if(!results.length)hits.push({...visual,attackOnly:true});
        for(const result of results)hits.push({...visual,...result});
        if(results.some(result=>result.defeated))selectMonsterTarget(room,m);
      }
      continue;
    }
    const reach=m.radius+(ATTACK_VISUAL.reach-RULES.radius);
    let distance=Infinity;
    let resting=false;
    if(target){
      const dx=target.x-m.x,dy=target.y-m.y;distance=Math.hypot(dx,dy);
      if(distance>0){m.dx=dx/distance;m.dy=dy/distance;}
    }else{
      // 레벨별 속도와 무관하게 실제 2초 이동/2초 휴식. 추격은 이 주기를 건너뜁니다.
      const elapsed=now-(m.patrolStartedAt??now),cycle=Math.floor(Math.max(0,elapsed)/cycleMs);
      resting=elapsed<0||elapsed%cycleMs>=MONSTER_RULES.walkMs;
      if(!resting&&cycle!==m.patrolCycle&&now>=m.nextDirectionAt){
        const angle=random()*Math.PI*2;m.dx=Math.cos(angle);m.dy=Math.sin(angle);
        m.patrolCycle=cycle;m.nextDirectionAt=m.patrolStartedAt+(cycle+1)*cycleMs;
      }
    }
    const travel=target?Math.min(MONSTER_RULES.speed*factor*dt,Math.max(0,distance-(m.radius+RULES.radius+8))):resting?0:MONSTER_RULES.speed*factor*dt;
    const x=m.x+m.dx*travel,y=m.y+m.dy*travel;
    // 문 주변은 비워 둡니다. 1·2구역은 겹침 허용, 3구역만 서로 간격을 둡니다.
    const map=mapOf(m.mapId,room.planets?.values?.()||[]);
    const blocked=!onParadiseFloor(map,x,y,m.radius)||(m.typeId===SERENA.typeId&&!onOriginFloor(map,x,y,m.radius))||x<Math.max(120,m.radius)||x>map.width-Math.max(120,m.radius)||y<Math.max(190,m.radius)||y>map.height-Math.max(190,m.radius)||(!monstersMayOverlap(m.mapId)&&[...monsters.values()].some(o=>o!==m&&o.hp>0&&o.mapId===m.mapId&&Math.hypot(x-o.x,y-o.y)<m.radius+o.radius+10));
    m.moving=!blocked&&travel>0.01;
    if(Math.abs(m.dx)>0.05)m.facingX=m.dx<0?-1:1;
    if(blocked){if(!target){m.dx=-m.dx;m.dy=-m.dy;}}else{m.x=x;m.y=y;}
    if(target&&now>=m.nextAttackAt){
      const dx=target.x-m.x,dy=target.y-m.y,distance=Math.hypot(dx,dy);
      // 초근접에서도 몸을 뚫고 지나가거나 후방을 원격 공격하지 않도록 몸 앞 근접 거리만 판정합니다.
      if(distance<=reach+RULES.radius+MONSTER_RULES.hitRadius){
        if(distance>0){m.dx=dx/distance;m.dy=dy/distance;}
        const attackReach=Math.min(reach,distance);
        if(rule.warningMs){
          m.pendingAttack={x:target.x,y:target.y,radius:rule.warningRadius,dx:m.dx,dy:m.dy,reach:attackReach,startsAt:now,endsAt:now+rule.warningMs};
          m.moving=false;continue;
        }
        const results=damagePlayersInArea(room,{mapId:m.mapId,x:m.x+m.dx*attackReach,y:m.y+m.dy*attackReach,radius:MONSTER_RULES.hitRadius,excludeTeachers:true,teacherTargetIds:m.teacherRetaliation,sourceMonsterId:m.id},rule.power,now);
        if(results.length){m.nextAttackAt=now+(rule.attackMs??MONSTER_RULES.attackMs/factor);
          for(const result of results)hits.push({monsterId:m.id,mapId:m.mapId,x:m.x,y:m.y,dx:m.dx,dy:m.dy,reach:attackReach,durationMs:ATTACK_VISUAL.durationMs,...result});
          if(results.some(result=>result.defeated))selectMonsterTarget(room,m);
        }
      }
    }
  }
  return hits;
}
