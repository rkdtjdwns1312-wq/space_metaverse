import {MAP} from '../shared/config.js';
import {randomUUID} from 'node:crypto';
import {WARNING_RULES,BLACK_HOLE_ID,PLAZA_ID} from '../shared/config.js';
import {ensure} from './rooms.js';
import {spawnInside,arrivePosition} from './world.js';
import {applyHerculesWeekly} from './constellation-weekly-abilities.js';
import {activePiscesPair} from './party.js';

export function validateWarnings(value){
  if(value===undefined)return {threshold:WARNING_RULES.defaultThreshold,entries:[]};
  if(!value||!Number.isInteger(value.threshold)||value.threshold<WARNING_RULES.minThreshold||value.threshold>WARNING_RULES.maxThreshold||
    !Array.isArray(value.entries)||value.entries.length>WARNING_RULES.maxEntries||value.entries.some(e=>
      !e||typeof e.id!=='string'||typeof e.targetId!=='string'||typeof e.actorId!=='string'||
      typeof e.reason!=='string'||!e.reason.trim()||e.reason.length>WARNING_RULES.maxReasonLength||
      !Number.isSafeInteger(e.at)||e.at<0||typeof e.active!=='boolean'||(e.sourceWarningId!==undefined&&(typeof e.sourceWarningId!=='string'||!e.sourceWarningId))))
    throw new Error('교실 경고 저장 데이터가 올바르지 않습니다.');
  return structuredClone(value);
}
export function validateBlackStar(value,planetIds){
  if(value===undefined||value===null)return null;
  if(!value||typeof value.planetId!=='string'||!planetIds.has(value.planetId)||!Number.isSafeInteger(value.at)||value.at<0)
    throw new Error('검은별 저장 데이터가 올바르지 않습니다.');
  return {planetId:value.planetId,at:value.at};
}
export function warningCount(planet,targetId){
  return (planet.warnings?.entries||[]).filter(e=>e.active&&e.targetId===targetId).length;
}
function releaseIfBelow(room,planet,target){
  if(!target||target.avatar.blackStar?.planetId!==planet.id||warningCount(planet,target.id)>=planet.warnings.threshold)return false;
  target.avatar.blackStar=null;
  if(target.mapId===BLACK_HOLE_ID)Object.assign(target,arrivePosition(room,PLAZA_ID,{x:MAP.objects.find(o=>o.kind==='black-hole').x,y:MAP.objects.find(o=>o.kind==='black-hole').y+228},target),{mapId:PLAZA_ID,input:{x:0,y:0,at:0}});
  return true;
}
function clearLinked(room,planet,entry){
  if(!entry.id)return;
  for(const linked of planet.warnings.entries)if(linked.active&&linked.sourceWarningId===entry.id){linked.active=false;releaseIfBelow(room,planet,room.players.get(linked.targetId));}
}
export function clearWarningsFromPlanet(room,planet,target){
  let cleared=0;
  for(const entry of planet.warnings?.entries||[])if(entry.active&&entry.targetId===target.id){entry.active=false;cleared++;clearLinked(room,planet,entry);}
  const released=cleared?releaseIfBelow(room,planet,target):false;
  return {cleared,released};
}
export function clearOneWarningFromPlanet(room,planet,target){
  const entry=[...(planet.warnings?.entries||[])].reverse().find(value=>value.active&&value.targetId===target.id);
  if(!entry)return {cleared:0,released:false};
  entry.active=false;
  clearLinked(room,planet,entry);
  const released=releaseIfBelow(room,planet,target);
  return {cleared:1,released};
}
export function warningView(room,planet){
  const warnings=planet.warnings||validateWarnings();
  return {planetId:planet.id,planetName:planet.name,threshold:warnings.threshold,
    students:[...room.players.values()].filter(p=>p.role==='student').map(p=>({id:p.id,nickname:p.nickname,count:warningCount(planet,p.id),blackStar:!!p.avatar.blackStar})),
    entries:warnings.entries.slice(-30).map(e=>({id:e.id,targetId:e.targetId,targetName:room.players.get(e.targetId)?.nickname||'없는 학생',
      actorId:e.actorId,actorName:room.players.get(e.actorId)?.nickname||'없는 학생',reason:e.reason,at:e.at,active:e.active}))};
}
export function issueWarning(room,planet,actor,target,reason,now=Date.now()){
  ensure(target&&target.role==='student'&&target.id!==actor.id,'경고를 받을 다른 친구를 골라주세요.');
  ensure(!target.avatar.blackStar,'이미 검은별 상태인 친구예요.');
  ensure(typeof reason==='string'&&reason.trim().length>0&&reason.trim().length<=WARNING_RULES.maxReasonLength,'경고 이유를 1~120자로 적어주세요.');
  planet.warnings??=validateWarnings();
  const pair=activePiscesPair(target,now),mirrorTarget=pair&&(pair.level===3||pair.level===4)&&pair.sourceId===pair.partnerId?room.players.get(pair.partnerId):null;
  const canMirror=mirrorTarget?.role==='student'&&!mirrorTarget.avatar.blackStar;
  ensure(planet.warnings.entries.length+(canMirror?2:1)<=WARNING_RULES.maxEntries,'경고 기록이 가득 찼어요. 선생님께 알려주세요.');
  const entry={id:randomUUID(),targetId:target.id,actorId:actor.id,reason:reason.trim(),at:now,active:true};
  const ability=applyHerculesWeekly(target,'warning',now);
  if(ability?.negated)entry.active=false;
  planet.warnings.entries.push(entry);
  const count=warningCount(planet,target.id),blackStar=!ability?.negated&&count>=planet.warnings.threshold;
  let blackAbility=null;
  if(blackStar){
    target.avatar.blackStar={planetId:planet.id,at:now};
    blackAbility=applyHerculesWeekly(target,'black',now);
    Object.assign(target,spawnInside(room,BLACK_HOLE_ID,target),{mapId:BLACK_HOLE_ID,input:{x:0,y:0,at:0}});
  }
  let mirrored=null;
  if(entry.active&&canMirror){
    const linked={id:randomUUID(),targetId:mirrorTarget.id,actorId:actor.id,reason:reason.trim(),at:now,active:true,sourceWarningId:entry.id};
    const linkedAbility=applyHerculesWeekly(mirrorTarget,'warning',now);
    if(linkedAbility?.negated)linked.active=false;
    planet.warnings.entries.push(linked);
    const linkedCount=warningCount(planet,mirrorTarget.id),linkedBlack=!linkedAbility?.negated&&linkedCount>=planet.warnings.threshold;
    if(linkedBlack){mirrorTarget.avatar.blackStar={planetId:planet.id,at:now};applyHerculesWeekly(mirrorTarget,'black',now);Object.assign(mirrorTarget,spawnInside(room,BLACK_HOLE_ID,mirrorTarget),{mapId:BLACK_HOLE_ID,input:{x:0,y:0,at:0}});}
    mirrored={targetId:mirrorTarget.id,count:linkedCount,blackStar:linkedBlack,active:linked.active};
  }
  return {entry,count,threshold:planet.warnings.threshold,blackStar,ability,blackAbility,mirrored,message:ability?.message||blackAbility?.message||null};
}
export function clearBlackStar(room,target){
  ensure(target&&target.role==='student'&&target.avatar.blackStar,'검은별 상태인 학생을 골라주세요.');
  for(const planet of room.planets.values())for(const entry of planet.warnings?.entries||[])if(entry.active&&entry.targetId===target.id){entry.active=false;clearLinked(room,planet,entry);}
  target.avatar.blackStar=null;
  if(target.mapId===BLACK_HOLE_ID)Object.assign(target,arrivePosition(room,PLAZA_ID,{x:MAP.objects.find(o=>o.kind==='black-hole').x,y:MAP.objects.find(o=>o.kind==='black-hole').y+228},target),{mapId:PLAZA_ID,input:{x:0,y:0,at:0}});
}
export function blackStarList(room){
  return [...room.players.values()].filter(p=>p.role==='student'&&p.avatar.blackStar).map(p=>({id:p.id,nickname:p.nickname,
    planetId:p.avatar.blackStar.planetId,planetName:room.planets.get(p.avatar.blackStar.planetId)?.name||'없어진 부서',at:p.avatar.blackStar.at}));
}

export function teacherWarningHistory(room,offset=0){
  const entries=[...room.planets.values()].flatMap(planet=>(planet.warnings?.entries||[]).map(entry=>({
    id:entry.id,planetName:planet.name,targetName:room.players.get(entry.targetId)?.nickname||'없는 학생',
    actorName:room.players.get(entry.actorId)?.nickname||'없는 학생',reason:entry.reason,at:entry.at,active:entry.active
  }))).sort((a,b)=>b.at-a.at||a.id.localeCompare(b.id));
  const pageSize=50;
  return {entries:entries.slice(offset,offset+pageSize),total:entries.length,
    nextOffset:offset+pageSize<entries.length?offset+pageSize:null};
}
export function deleteTeacherWarning(room,warningId){
  const planet=[...room.planets.values()].find(value=>value.warnings?.entries.some(entry=>entry.id===warningId));
  const entry=planet?.warnings.entries.find(value=>value.id===warningId);
  ensure(entry?.active,'삭제할 수 있는 경고를 찾지 못했어요.');
  entry.active=false;
  clearLinked(room,planet,entry);
  const target=room.players.get(entry.targetId);
  const released=releaseIfBelow(room,planet,target);
  return {target,released,remaining:target?warningCount(planet,target.id):0};
}

// 사수자리의 자기 경고 사냥은 물고기자리 짝에게 복사된 경고까지 지우지 않습니다.
export function clearOwnWarning(room,player,warningId){
  const planet=[...room.planets.values()].find(value=>value.warnings?.entries.some(entry=>entry.id===warningId&&entry.active&&entry.targetId===player.id));
  ensure(planet,'삭제할 수 있는 내 경고를 골라주세요.');
  const entry=planet.warnings.entries.find(value=>value.id===warningId);
  entry.active=false;
  releaseIfBelow(room,planet,player);
  return {planet,entry};
}
export function clearOwnDepartmentWarnings(room,player,planetId){
  const planet=room.planets.get(planetId);
  ensure(planet&&warningCount(planet,player.id)>0,'내 활성 경고가 있는 부서를 골라주세요.');
  let cleared=0;
  for(const entry of planet.warnings.entries)if(entry.active&&entry.targetId===player.id){entry.active=false;cleared++;}
  releaseIfBelow(room,planet,player);
  return {planet,cleared};
}
export function clearOwnBlackStar(room,player,at){
  const black=player.avatar.blackStar;
  ensure(black&&black.at===at,'내 검은별 상태가 바뀌었어요. 다시 확인해 주세요.');
  const planet=room.planets.get(black.planetId);
  let cleared=0;
  for(const entry of planet?.warnings?.entries||[])if(entry.active&&entry.targetId===player.id){entry.active=false;cleared++;}
  player.avatar.blackStar=null;
  if(player.mapId===BLACK_HOLE_ID)Object.assign(player,arrivePosition(room,PLAZA_ID,{x:MAP.objects.find(o=>o.kind==='black-hole').x,y:MAP.objects.find(o=>o.kind==='black-hole').y+228},player),{mapId:PLAZA_ID,input:{x:0,y:0,at:0}});
  return {planetId:black.planetId,cleared};
}

// 외부 행성 정보에는 횟수와 이름만 공개하고 경고 사유·작성자는 보내지 않습니다.
export function warningSummary(room,planet){
  return [...room.players.values()].filter(p=>p.role==='student').map(p=>({id:p.id,nickname:p.nickname,count:warningCount(planet,p.id),blackStar:p.avatar.blackStar?.planetId===planet.id})).filter(p=>p.count>0||p.blackStar);
}
