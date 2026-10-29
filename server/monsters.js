import {MONSTER_SPAWNS,monsterType,MONSTER_HP,MONSTER_COMBAT,MONSTER_LEVEL_STATS} from '../shared/monsters.js';
import {ATTACK_VISUAL,attackGeometryOf} from '../shared/combat.js';
import {RULES,mapOf} from '../shared/config.js';
import {ensureVitals,damagePlayer} from './vitals.js';
import {constellationOf} from '../shared/constellations.js';
import {damagePlayersInArea,playersInArea} from './area-combat.js';
import {addEnergyDrop,addRecipeDrop} from './energy-drops.js';
import {isParadise,onParadiseFloor} from '../shared/paradise-floor.js';
import {onOriginFloor} from '../shared/origin-floor.js';
import {DARK_STAR} from '../shared/dark-star.js';
import {SERENA} from '../shared/serena.js';
import {monsterRespawnMs,finishBossDefeat} from './boss-lifecycle.js';
import {bossVictoryCredits} from './serena-progress.js';
import {BOSS_MANA,NOKSERA_HORN_BURST,nokseraHornRadius,NOKSERA_MOON_PHASE,nokseraMoonTimeline,nokseraFullMoon,LEOON_ROAR,LEOON_CHARGE} from '../shared/boss-skills.js';
import {beginLeoonRoar,beginLeoonCharge,tickLeoonSkill} from './leoon-boss-skills.js';
import {clearSpiritKingEffects,trySpiritKingSkills,tickSpiritOrbs} from './spirit-king-skills.js';
import {tickSpiritBlueStars} from './spirit-blue-stars.js';
import {clearSerenaSkills,trySerenaSkills,tickSerenaSkills,serenaSkillViews} from './serena-skills.js';


export const MONSTER_RULES=Object.freeze({walkMs:2000,restMs:2000,directionMs:2000,speed:36,radius:24,respawnMs:10000,hitRadius:18,attackMs:1000,bossMeleeDwellMs:2000,mapExitHealCount:3,blockedChaseMs:3000});
const delayedMeleeBoss=type=>type?.id==='noksera'||type?.id==='leoon';
function bossMeleeEligible(room,monster,now,x,y){
  const present=playersInArea(room,{mapId:monster.mapId,x,y,radius:MONSTER_RULES.hitRadius,excludeTeachers:true,teacherTargetIds:monster.teacherRetaliation});
  const since=monster.meleePresence??=new Map(),ids=new Set(present.map(player=>player.id));
  for(const id of since.keys())if(!ids.has(id))since.delete(id);
  for(const id of ids)if(!since.has(id))since.set(id,now);
  return new Set([...since].filter(([,enteredAt])=>now-enteredAt>=MONSTER_RULES.bossMeleeDwellMs).map(([id])=>id));
}
const randomPatrolOffset=random=>Math.floor(Math.max(0,Math.min(.999999999,random()))*(MONSTER_RULES.walkMs+MONSTER_RULES.restMs));
const spawns=[[260,280],[600,260],[920,300],[360,590],[830,590]];
const largeSpawns=[[430.56,256.94],[597.22,256.94],[763.89,256.94],[291.67,312.5],[902.78,312.5]];
const sunSpawns=[[-330,-110],[0,-170],[330,-110],[-240,140],[240,140]];
export const monstersMayOverlap=mapId=>mapId==='star-origin-1'||mapId==='star-origin-2';
// 일반 몬스터는 단계별 10/15/20초, 보스는 처치 다음 날 한국 시간 07시에 복원합니다.
export function monstersOf(room,now=Date.now(),phaseRandom=Math.random){
  const create=(spawn,i)=>{
    const type=monsterType(spawn.typeId);
    const map=mapOf(type.mapId,room.planets?.values?.()||[]);
    const [baseX,baseY]=(({1:1,2:2,3:4,4:5}[type.level]||1)>=4?largeSpawns:spawns)[i%5];
    const [sx,sy]=sunSpawns[i%5];
    const manualBoss=[SERENA,DARK_STAR].find(boss=>boss.typeId===type.id);
    const statue=manualBoss?map.objects.find(o=>o.id===manualBoss.statueId):null;
    let x=statue?statue.x:type.boss?map.width/2:isParadise(map.id)?map.width/2+sx:baseX*map.width/1200,y=statue?statue.y:type.boss?map.height/2:isParadise(map.id)?map.height/2+sy:baseY*map.height/900;
    // 낙원도 공통 레벨 규칙을 따릅니다: 1단계×1, 2단계×2, 3단계×4, 4단계×5.
    // 별의 시작점 3 몬스터는 기존 그림과 충돌 반경을 함께 절반으로 줄입니다.
    const multiplier={1:1,2:2,3:4,4:5}[type.level]||1;
    const radius=type.radius??MONSTER_RULES.radius*(type.boss?8:multiplier);
    if(/^star-origin-[123]$/.test(map.id)&&!onOriginFloor(map,x,y,radius)){
      const startX=x,startY=y;
      for(let part=.05;part<=1;part+=.05){
        const candidateX=startX+(map.width/2-startX)*part,candidateY=startY+(map.height/2-startY)*part;
        if(onOriginFloor(map,candidateX,candidateY,radius)){x=candidateX;y=candidateY;break;}
      }
    }
    const patrolPhaseOffset=randomPatrolOffset(phaseRandom),patrolStartedAt=now+patrolPhaseOffset;
    const respawnAt=room.bossRespawns?.[spawn.id]>now?room.bossRespawns[spawn.id]:null;
    return [spawn.id,{id:spawn.id,typeId:type.id,mapId:type.mapId,x,y,radius,
      hp:respawnAt?0:type.hp??MONSTER_HP[type.mapId],maxHp:type.hp??MONSTER_HP[type.mapId],respawnAt,spawnX:x,spawnY:y,
      mp:type.boss?BOSS_MANA.max:0,maxMp:type.boss?BOSS_MANA.max:0,nextManaRegenAt:now+BOSS_MANA.regenMs,hornReadyAt:0,hornDecisionAt:now+NOKSERA_HORN_BURST.decisionMs,
      moonReadyAt:0,moonDecisionAt:now+NOKSERA_MOON_PHASE.decisionMs,
      roarReadyAt:0,roarDecisionAt:now+LEOON_ROAR.decisionMs,chargeReadyAt:0,chargeDecisionAt:now+LEOON_CHARGE.decisionMs,leoonSkill:null,
      summonReadyAt:0,summonDecisionAt:now+2000,orbReadyAt:0,orbDecisionAt:now+2000,blueStarReadyAt:0,blueStarDecisionAt:now+2000,
      serenaDecisionAt:now+2000,
      targetId:null,attackers:new Map(),contributors:new Map(),meleePresence:new Map(),attackOrder:0,mapExitCount:0,nextAttackAt:0,dx:0,dy:0,facingX:1,moving:false,
      patrolStartedAt,patrolPhaseOffset,patrolCycle:-1,nextDirectionAt:patrolStartedAt,lastMoveAt:now}];
  };
  if(!room.monsters)room.monsters=new Map(MONSTER_SPAWNS.map(create));
  // 수동 소환 상태만 복구합니다. 휴면/다음 날 07시 대기 중에는 자동 생성하지 않습니다.
  if(room.serena?.state==='active'&&!room.monsters.has(SERENA.monsterId)){
    const [id,m]=create({id:SERENA.monsterId,typeId:SERENA.typeId},0);
    m.hp=m.maxHp;m.respawnAt=null;room.monsters.set(id,m);
  }
  if(room.darkStar?.state==='active'&&!room.monsters.has(DARK_STAR.monsterId)){
    const [id,m]=create({id:DARK_STAR.monsterId,typeId:DARK_STAR.typeId},0);
    m.hp=m.maxHp;m.respawnAt=null;room.monsters.set(id,m);
  }
  return room.monsters;
}
export function monsterViews(room,now=Date.now()){
  return [...monstersOf(room,now).values()].map(m=>({id:m.id,typeId:m.typeId,mapId:m.mapId,x:m.x,y:m.y,radius:m.radius,
    facingX:m.facingX||1,moving:!!m.moving,hp:m.hp,maxHp:m.maxHp,mp:m.mp??0,maxMp:m.maxMp??0,alive:m.hp>0,busy:false,targetId:m.targetId,
    ...(m.pendingAttack&&m.hp>0?{warning:{...(m.pendingAttack.kind?{kind:m.pendingAttack.kind}:{}),x:m.pendingAttack.x,y:m.pendingAttack.y,radius:m.pendingAttack.radius,startsAt:m.pendingAttack.startsAt,endsAt:m.pendingAttack.endsAt}}:{}),
    ...(m.hp>0&&m.moonCast?.mapId===m.mapId&&m.moonCast.endsAt>now?{moonCast:{...m.moonCast}}:{}),
    ...(m.hp>0&&m.moonAura?.mapId===m.mapId&&m.moonAura.endsAt>now?{moonAura:{...m.moonAura}}:{}),
    ...(m.hp>0&&m.leoonSkill?.mapId===m.mapId?{leoonSkill:{...m.leoonSkill}}:{}),
    ...(m.typeId==='serena'?{serenaSkillEffects:serenaSkillViews(room,m,now)}:{}),
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
export function damageMonster(room,target,player,power,now=Date.now(),{energyRoll,recipeRoll,bossRoll,ignoreSleep=false,fixedDamage=null,silent=false,retaliateTeacher=false,reflected=false}={}){
  if(target.hp<=0||power<0||!Number.isFinite(power))return null;
  const raw=(target.sleepUntil||0)>now&&!ignoreSleep?power*2:power;
  const type=monsterType(target.typeId),level=type?.level??target.level;
  const defense=type?.defense??MONSTER_LEVEL_STATS[level]?.defense??MONSTER_COMBAT[target.mapId]?.defense??0;
  const dealt=fixedDamage??Math.max(1,Math.round(raw)-defense);
  // 지난 공격자가 떠난 전투를 먼저 정리한 뒤 새 공격 피해를 적용합니다.
  selectMonsterTarget(room,target);
  if(nokseraFullMoon(target,now)){
    // 보름은 피해를 대체합니다. 기여도/HP/드랍에는 피해를 기록하지 않습니다.
    registerMonsterAttacker(room,target,player,now,retaliateTeacher);
    const amount=Math.max(0,dealt);
    const eligible=!reflected&&amount>0&&player.connected&&!player.away&&player.mapId===target.mapId;
    // 노크 방어 후 예정 피해 전체를 반환합니다. 공격자 방어는 재계산하지 않고
    // 면역·방패·부활은 유지하며, 천칭만 건너뛰어 반사 연쇄를 차단합니다.
    const hit=eligible?damagePlayer(player,amount,now,{skipDefense:true,skipLibra:true}):null;
    if(hit)(room.reflectedVitals??=[]).push({playerId:player.id,vitals:hit.vitals});
    return {monsterId:target.id,damage:0,reflectedDamage:hit?.damage??0,hp:target.hp,maxHp:target.maxHp,defeated:false};
  }
  // 남은 HP를 넘는 과잉 피해로 마지막 공격자가 소유권을 빼앗지 않도록 실제 감소량만 합산합니다.
  target.contributors??=new Map();
  target.contributors.set(player.id,(target.contributors.get(player.id)||0)+Math.min(dealt,target.hp));
  target.hp=Math.max(0,target.hp-dealt);
  if(!silent){room.damageNumbers??=[];room.damageNumbers.push({targetId:target.id,targetKind:'monster',mapId:target.mapId,x:target.x,y:target.y,damage:dealt});
    if(room.damageNumbers.length>200)room.damageNumbers.shift();}
  if(target.hp===0){
    if(target.typeId==='serena')clearSerenaSkills(target);
    if(target.typeId==='spirit-king')clearSpiritKingEffects(room,target.id);
    if(type?.boss){
      if(room.persistBossDefeats){
        room.pendingBossDeaths??=new Map();
        room.pendingBossDeaths.set(target.id,{at:now,contributors:[...target.contributors],credits:bossVictoryCredits(room,target,target.contributors)});
      }else finishBossDefeat(room,target,target.contributors,now,{energyRoll,recipeRoll,bossRoll});
    }else if(!target.summonerId){
      addRecipeDrop(room,target,target.contributors,now,recipeRoll);
      addEnergyDrop(room,target,target.contributors,now,energyRoll);
    }
    target.respawnAt=now+(target.summonerId?600:monsterRespawnMs(type,now));target.targetId=null;target.pendingAttack=null;target.moonCast=null;target.moonAura=null;target.leoonSkill=null;target.attackers.clear();target.teacherRetaliation?.clear();target.contributors.clear();target.meleePresence?.clear();target.mapExitCount=0;
  }
  else{
    registerMonsterAttacker(room,target,player,now,retaliateTeacher);
  }
  return {monsterId:target.id,damage:dealt,hp:target.hp,maxHp:target.maxHp,defeated:target.hp===0};
}
function registerMonsterAttacker(room,target,player,now,retaliateTeacher){
  if(!target.attackers.size)target.nextAttackAt=Math.max(target.nextAttackAt,now+150);
  // Only the regular teacher's E opts this particular monster into retaliation.
  if(retaliateTeacher&&player.role==='teacher'&&!player.avatar?.teacherPreview)(target.teacherRetaliation??=new Set()).add(player.id);
  if(player.role!=='teacher'||target.teacherRetaliation?.has(player.id))target.attackers.set(player.id,++target.attackOrder);
  selectMonsterTarget(room,target);
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
  if(!Number.isFinite(now))return [];
  const monsters=monstersOf(room,now);
  const mapFor=mapId=>mapOf(mapId,room.planets?.values?.()||[]);
  const hits=[...tickSpiritOrbs(room,now,mapFor),...tickSpiritBlueStars(room,now,mapFor)];
  const cycleMs=MONSTER_RULES.walkMs+MONSTER_RULES.restMs;
  for(const m of monsters.values()){
    // 이번 틱에도 실제 추적 이동이 지형에 막힐 때만 누적합니다. 시전/수면/정지는 연속 막힘이 아닙니다.
    const previousBlockedChase=m.blockedChase;m.blockedChase=null;
    if(m.hp<=0){
      if(m.typeId==='serena')clearSerenaSkills(m);
      m.pendingAttack=null;m.moonCast=null;m.moonAura=null;m.leoonSkill=null;m.meleePresence?.clear();m.moving=false;
      if(m.summonerId){if(now>=m.respawnAt)monsters.delete(m.id);continue;}
      if(m.typeId===SERENA.typeId||m.typeId===DARK_STAR.typeId||room.pendingBossDeaths?.has(m.id))continue;
      if(now<m.respawnAt)continue;
      if(!monstersMayOverlap(m.mapId)&&[...monsters.values()].some(o=>o!==m&&o.hp>0&&o.mapId===m.mapId&&Math.hypot(m.spawnX-o.x,m.spawnY-o.y)<m.radius+o.radius+10))continue;
      const patrolPhaseOffset=randomPatrolOffset(random),patrolStartedAt=now+patrolPhaseOffset;
      Object.assign(m,{hp:m.maxHp,respawnAt:null,targetId:null,pendingAttack:null,leoonSkill:null,attackers:new Map(),teacherRetaliation:new Set(),contributors:new Map(),meleePresence:new Map(),attackOrder:0,mapExitCount:0,nextAttackAt:0,x:m.spawnX,y:m.spawnY,lastMoveAt:now,patrolStartedAt,patrolPhaseOffset,patrolCycle:-1,nextDirectionAt:patrolStartedAt});
      if(monsterType(m.typeId)?.boss)Object.assign(m,{mp:BOSS_MANA.max,maxMp:BOSS_MANA.max,nextManaRegenAt:now+BOSS_MANA.regenMs,hornReadyAt:0,hornDecisionAt:now+NOKSERA_HORN_BURST.decisionMs,moonReadyAt:0,moonDecisionAt:now+NOKSERA_MOON_PHASE.decisionMs,roarReadyAt:0,roarDecisionAt:now+LEOON_ROAR.decisionMs,chargeReadyAt:0,chargeDecisionAt:now+LEOON_CHARGE.decisionMs,summonReadyAt:0,summonDecisionAt:now+2000,orbReadyAt:0,orbDecisionAt:now+2000,blueStarReadyAt:0,blueStarDecisionAt:now+2000});
    }
    const dt=Math.max(0,Math.min(100,now-m.lastMoveAt))/1000;m.lastMoveAt=now;
    const type=monsterType(m.typeId),rule=type?.combat??MONSTER_COMBAT[m.mapId];
    if(type?.id==='serena'){
      hits.push(...tickSerenaSkills(room,m,now));
      if(m.hp<=0){m.moving=false;continue;}
    }
    if(!type||!rule||mapOf(m.mapId,room.planets?.values?.()||[]).id!==m.mapId){m.pendingAttack=null;m.moonCast=null;m.moonAura=null;m.leoonSkill=null;m.moving=false;continue;}
    if(m.moonAura&&(now>=m.moonAura.endsAt||m.moonAura.mapId!==m.mapId))m.moonAura=null;
    const factor=rule.speedFactor;
    if(type.boss)regenerateBossMana(m,now);
    const previousTarget=m.targetId,target=selectMonsterTarget(room,m);
    if(delayedMeleeBoss(type)&&(!target||m.pendingAttack||m.moonCast||m.leoonSkill||(m.sleepUntil||0)>now||(m.stunUntil||0)>now))m.meleePresence?.clear();
    if(previousTarget&&!target){m.patrolPhaseOffset=randomPatrolOffset(random);m.patrolStartedAt=now+m.patrolPhaseOffset;m.patrolCycle=-1;m.nextDirectionAt=m.patrolStartedAt;}
    if((m.sleepUntil||0)>now||(m.stunUntil||0)>now){m.pendingAttack=null;if(m.moonCast)m.moonAura=null;m.moonCast=null;m.leoonSkill=null;m.moving=false;continue;}
    if(m.leoonSkill){
      const map=mapOf(m.mapId,room.planets?.values?.()||[]);
      const results=tickLeoonSkill(room,m,target,now,{width:map.width,height:map.height,onFloor:(x,y,radius)=>onParadiseFloor(map,x,y,radius)},random);
      hits.push(...results);
      if(results.some(result=>result.defeated))selectMonsterTarget(room,m);
      continue;
    }
    if(m.moonCast){
      const cast=m.moonCast;m.moving=false;
      if(!target||cast.mapId!==m.mapId||(m.sleepUntil||0)>cast.startsAt||(m.stunUntil||0)>cast.startsAt){m.moonCast=null;m.moonAura=null;continue;}
      if(now<cast.endsAt)continue;
      const aura={...nokseraMoonTimeline(cast.startsAt),mapId:cast.mapId};
      m.moonCast=null;m.moonAura=now<aura.endsAt?aura:null;
      // 준비 종료 후 이 틱부터 기존 이동/일반공격을 재개합니다.
    }
    const horn=m.pendingAttack?.kind===NOKSERA_HORN_BURST.kind;
    if(horn&&(!target||m.mapId!==m.pendingAttack.mapId||mapOf(m.mapId,room.planets?.values?.()||[]).id!==m.mapId||
      (m.sleepUntil||0)>m.pendingAttack.startsAt||(m.stunUntil||0)>m.pendingAttack.startsAt)){
      m.pendingAttack=null;m.moving=false;continue;
    }
    if(m.pendingAttack){
      m.moving=false;
      if(now>=m.pendingAttack.endsAt){
        const warning=m.pendingAttack;m.pendingAttack=null;
        const results=damagePlayersInArea(room,{mapId:m.mapId,x:warning.x,y:warning.y,radius:warning.radius,excludeTeachers:true,teacherTargetIds:m.teacherRetaliation,sourceMonsterId:m.id},horn?warning.power:rule.power,now);
        m.nextAttackAt=now+MONSTER_RULES.attackMs;
        const visual={monsterId:m.id,mapId:m.mapId,x:horn?warning.x:m.x,y:horn?warning.y:m.y,dx:warning.dx,dy:warning.dy,reach:warning.reach,durationMs:horn?NOKSERA_HORN_BURST.durationMs:800,
          ...(horn?{skillKind:warning.kind}:{}),
          warningX:warning.x,warningY:warning.y,warningRadius:warning.radius};
        if(!results.length)hits.push({...visual,attackOnly:true});
        for(const result of results)hits.push({...visual,...result});
        if(results.some(result=>result.defeated))selectMonsterTarget(room,m);
      }
      continue;
    }
    if(type.id==='noksera'&&target&&now>=(m.hornReadyAt||0)&&now>=(m.hornDecisionAt??now)&&m.mp>=NOKSERA_HORN_BURST.mana&&
      Math.hypot(target.x-m.x,target.y-m.y)<=nokseraHornRadius(m)){
      // 판정 실패는 평타/추적을 막지 않습니다. 틱 수나 시간 점프만큼 난수를 반복하지 않습니다.
      m.hornDecisionAt=now+NOKSERA_HORN_BURST.decisionMs;
      const roll=random();
      if(Number.isFinite(roll)&&roll>=0&&roll<NOKSERA_HORN_BURST.chance){
      const dx=target.x-m.x,dy=target.y-m.y,distance=Math.hypot(dx,dy);
      if(distance>0){m.dx=dx/distance;m.dy=dy/distance;if(Math.abs(m.dx)>.05)m.facingX=m.dx<0?-1:1;}
      m.mp-=NOKSERA_HORN_BURST.mana;m.hornReadyAt=now+NOKSERA_HORN_BURST.cooldownMs;
      m.pendingAttack={kind:NOKSERA_HORN_BURST.kind,mapId:m.mapId,x:m.x,y:m.y,radius:nokseraHornRadius(m),
        startsAt:now,endsAt:now+NOKSERA_HORN_BURST.warningMs,dx:m.dx,dy:m.dy,reach:0,power:(type.power??rule.power)*NOKSERA_HORN_BURST.damageMultiplier};
      m.moving=false;continue;
      }
    }
    if(type.id==='noksera'&&target&&!m.moonAura&&now>=(m.moonReadyAt||0)&&now>=(m.moonDecisionAt??now)&&m.mp>=NOKSERA_MOON_PHASE.mana&&
      Math.hypot(target.x-m.x,target.y-m.y)<=nokseraHornRadius(m)){
      m.moonDecisionAt=now+NOKSERA_MOON_PHASE.decisionMs;
      const roll=random();
      if(Number.isFinite(roll)&&roll>=0&&roll<NOKSERA_MOON_PHASE.chance){
        m.mp-=NOKSERA_MOON_PHASE.mana;m.moonReadyAt=now+NOKSERA_MOON_PHASE.cooldownMs;
        m.moonCast={kind:NOKSERA_MOON_PHASE.kind,mapId:m.mapId,startsAt:now,endsAt:now+NOKSERA_MOON_PHASE.castMs};
        m.moonAura={...nokseraMoonTimeline(now),mapId:m.mapId};
        m.moving=false;continue;
      }
    }
    if(type.id==='leoon'&&target){
      const distance=Math.hypot(target.x-m.x,target.y-m.y),power=type.power??rule.power;
      if(now>=(m.chargeReadyAt||0)&&now>=(m.chargeDecisionAt??now)&&m.mp>=LEOON_CHARGE.mana&&distance<=m.radius*4.5){
        m.chargeDecisionAt=now+LEOON_CHARGE.decisionMs;
        const roll=random();
        if(Number.isFinite(roll)&&roll>=0&&roll<LEOON_CHARGE.chance){beginLeoonCharge(m,now,power);continue;}
      }
      if(now>=(m.roarReadyAt||0)&&now>=(m.roarDecisionAt??now)&&m.mp>=LEOON_ROAR.mana&&distance<=m.radius*LEOON_ROAR.rangeFactor){
        m.roarDecisionAt=now+LEOON_ROAR.decisionMs;
        const roll=random();
        if(Number.isFinite(roll)&&roll>=0&&roll<LEOON_ROAR.chance){beginLeoonRoar(m,now,power);continue;}
      }
    }
    if(type.id==='spirit-king'&&target&&trySpiritKingSkills(room,m,target,now,random,mapOf(m.mapId,room.planets?.values?.()||[]))){m.moving=false;continue;}
    if(type.id==='serena'&&target&&now>=(m.serenaDecisionAt||0)&&trySerenaSkills(room,m,target,now,random)){m.moving=false;continue;}
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
    let x=m.x+m.dx*travel,y=m.y+m.dy*travel;
    // 문 주변은 비워 둡니다. 1·2구역은 겹침 허용, 3구역만 서로 간격을 둡니다.
    const map=mapOf(m.mapId,room.planets?.values?.()||[]);
    const spiritGroup=type.id==='spirit-king'||!!m.summonerId;
    const terrainBlockedAt=(x,y)=>!onParadiseFloor(map,x,y,m.radius)||([SERENA.typeId,DARK_STAR.typeId].includes(m.typeId)&&!onOriginFloor(map,x,y,m.radius))||x<Math.max(120,m.radius)||x>map.width-Math.max(120,m.radius)||y<Math.max(190,m.radius)||y>map.height-Math.max(190,m.radius);
    const terrainBlocked=terrainBlockedAt(x,y);
    const blockedAt=(x,y)=>terrainBlockedAt(x,y)||(!monstersMayOverlap(m.mapId)&&[...monsters.values()].some(o=>{
      if(o===m||o.hp<=0||o.mapId!==m.mapId)return false;
      const next=Math.hypot(x-o.x,y-o.y),current=Math.hypot(m.x-o.x,m.y-o.y),gap=m.radius+o.radius+10;
      // A guardian spawned near an edge may already overlap. Permit only steps
      // that separate existing overlap, never steps farther into another body.
      return next<gap&&!(spiritGroup&&current<gap&&next>current+1e-6);
    }));
    let blocked=blockedAt(x,y);
    if(blocked&&spiritGroup&&travel>0){
      const angle=Math.atan2(m.dy,m.dx),side=m.avoidanceSide||1;
      // The king and his guards can otherwise queue forever behind each other.
      // Try short sideways steps with the same floor, body and speed limits.
      for(const turn of [30,60,90,120,150].flatMap(a=>[a*side,-a*side])){
        const direction=angle+turn*Math.PI/180,nx=m.x+Math.cos(direction)*travel,ny=m.y+Math.sin(direction)*travel;
        if(blockedAt(nx,ny))continue;
        x=nx;y=ny;m.avoidanceSide=Math.sign(turn);blocked=false;break;
      }
    }
    // 문/다리 뒤의 공격자에게 닿지 못한 채 3초 연속 지형에 막히면 전투를 초기화합니다.
    // 몸끼리 부딪히거나 우회에 성공한 경우, 이미 근접 공격 가능한 거리는 제외합니다.
    if(target&&blocked&&terrainBlocked&&travel>0&&distance>reach+RULES.radius+MONSTER_RULES.hitRadius){
      const elapsedMs=(previousBlockedChase?.targetId===target.id?previousBlockedChase.elapsedMs:0)+dt*1000;
      m.blockedChase={targetId:target.id,elapsedMs};
      if(elapsedMs>=MONSTER_RULES.blockedChaseMs){
        m.hp=m.maxHp;m.attackers.clear();m.teacherRetaliation?.clear();m.contributors?.clear();m.meleePresence?.clear();
        // 지난 전투의 독/저주 틱만으로 곧바로 다시 추적하지 않게 제거합니다. 새 공격은 정상 등록됩니다.
        m.combatPoison=null;m.capricornCurses?.clear();
        m.targetId=null;m.nextAttackAt=0;m.mapExitCount=0;m.blockedChase=null;m.moving=false;
        m.patrolPhaseOffset=randomPatrolOffset(random);m.patrolStartedAt=now+m.patrolPhaseOffset;m.patrolCycle=-1;m.nextDirectionAt=m.patrolStartedAt;
        continue;
      }
    }
    m.moving=!blocked&&travel>0.01;
    if(Math.abs(m.dx)>0.05)m.facingX=m.dx<0?-1:1;
    if(blocked){if(!target){m.dx=-m.dx;m.dy=-m.dy;}}else{m.x=x;m.y=y;}
    if(target){
      const dx=target.x-m.x,dy=target.y-m.y,distance=Math.hypot(dx,dy);
      // 초근접에서도 몸을 뚫고 지나가거나 후방을 원격 공격하지 않도록 몸 앞 근접 거리만 판정합니다.
      if(distance<=reach+RULES.radius+MONSTER_RULES.hitRadius){
        if(distance>0){m.dx=dx/distance;m.dy=dy/distance;}
        const attackReach=Math.min(reach,distance);
        const hitX=m.x+m.dx*attackReach,hitY=m.y+m.dy*attackReach;
        const eligibleIds=delayedMeleeBoss(type)?bossMeleeEligible(room,m,now,hitX,hitY):null;
        if(now<m.nextAttackAt||(eligibleIds&&!eligibleIds.has(target.id)))continue;
        if(rule.warningMs){
          m.pendingAttack={x:target.x,y:target.y,radius:rule.warningRadius,dx:m.dx,dy:m.dy,reach:attackReach,startsAt:now,endsAt:now+rule.warningMs};
          m.moving=false;continue;
        }
        const results=damagePlayersInArea(room,{mapId:m.mapId,x:hitX,y:hitY,radius:MONSTER_RULES.hitRadius,excludeTeachers:true,teacherTargetIds:m.teacherRetaliation,eligibleIds,sourceMonsterId:m.id},rule.power,now);
        if(results.length){m.nextAttackAt=now+MONSTER_RULES.attackMs;
          for(const result of results)hits.push({monsterId:m.id,mapId:m.mapId,x:m.x,y:m.y,dx:m.dx,dy:m.dy,reach:attackReach,durationMs:ATTACK_VISUAL.durationMs,...result});
          if(results.some(result=>result.defeated))selectMonsterTarget(room,m);
        }
      }else if(delayedMeleeBoss(type))m.meleePresence?.clear();
    }
  }
  return hits;
}

function regenerateBossMana(monster,now){
  monster.maxMp=BOSS_MANA.max;
  monster.mp=Math.max(0,Math.min(BOSS_MANA.max,Number.isFinite(monster.mp)?monster.mp:BOSS_MANA.max));
  if(!Number.isFinite(monster.nextManaRegenAt))monster.nextManaRegenAt=now+BOSS_MANA.regenMs;
  if(now<monster.nextManaRegenAt)return;
  const amount=BOSS_MANA.max*BOSS_MANA.regenFraction,elapsed=now-monster.nextManaRegenAt;
  // 긴 시간 점프도 반복 루프 없이 계산하며 최대치까지만 회복합니다. 역행한 시각은 무시합니다.
  const periods=Math.min(Math.ceil(BOSS_MANA.max/amount),Math.floor(elapsed/BOSS_MANA.regenMs)+1);
  monster.mp=Math.min(BOSS_MANA.max,monster.mp+periods*amount);
  monster.nextManaRegenAt=now+BOSS_MANA.regenMs-elapsed%BOSS_MANA.regenMs;
}
