import {randomUUID} from 'node:crypto';
import {WARNING_RULES,BLACK_HOLE_ID,PLAZA_ID} from '../shared/config.js';
import {ensure} from './rooms.js';
import {spawnInside,arrivePosition} from './world.js';

export function validateWarnings(value){
  if(value===undefined)return {threshold:WARNING_RULES.defaultThreshold,entries:[]};
  if(!value||!Number.isInteger(value.threshold)||value.threshold<WARNING_RULES.minThreshold||value.threshold>WARNING_RULES.maxThreshold||
    !Array.isArray(value.entries)||value.entries.length>WARNING_RULES.maxEntries||value.entries.some(e=>
      !e||typeof e.id!=='string'||typeof e.targetId!=='string'||typeof e.actorId!=='string'||
      typeof e.reason!=='string'||!e.reason.trim()||e.reason.length>WARNING_RULES.maxReasonLength||
      !Number.isSafeInteger(e.at)||e.at<0||typeof e.active!=='boolean'))
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
export function clearWarningsFromPlanet(room,planet,target){
  let cleared=0;
  for(const entry of planet.warnings?.entries||[])if(entry.active&&entry.targetId===target.id){entry.active=false;cleared++;}
  let released=false;
  if(cleared&&target.avatar.blackStar?.planetId===planet.id){
    target.avatar.blackStar=null;released=true;
    if(target.mapId===BLACK_HOLE_ID)Object.assign(target,arrivePosition(room,PLAZA_ID,{x:1560,y:560}),{mapId:PLAZA_ID,input:{x:0,y:0,at:0}});
  }
  return {cleared,released};
}
export function clearOneWarningFromPlanet(room,planet,target){
  const entry=[...(planet.warnings?.entries||[])].reverse().find(value=>value.active&&value.targetId===target.id);
  if(!entry)return {cleared:0,released:false};
  entry.active=false;
  let released=false;
  if(target.avatar.blackStar?.planetId===planet.id&&warningCount(planet,target.id)<planet.warnings.threshold){
    target.avatar.blackStar=null;released=true;
    if(target.mapId===BLACK_HOLE_ID)Object.assign(target,arrivePosition(room,PLAZA_ID,{x:1560,y:560}),{mapId:PLAZA_ID,input:{x:0,y:0,at:0}});
  }
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
  ensure(planet.warnings.entries.length<WARNING_RULES.maxEntries,'경고 기록이 가득 찼어요. 선생님께 알려주세요.');
  const entry={id:randomUUID(),targetId:target.id,actorId:actor.id,reason:reason.trim(),at:now,active:true};
  planet.warnings.entries.push(entry);
  const count=warningCount(planet,target.id),blackStar=count>=planet.warnings.threshold;
  if(blackStar){
    target.avatar.blackStar={planetId:planet.id,at:now};
    Object.assign(target,spawnInside(room,BLACK_HOLE_ID),{mapId:BLACK_HOLE_ID,input:{x:0,y:0,at:0}});
  }
  return {entry,count,threshold:planet.warnings.threshold,blackStar};
}
export function clearBlackStar(room,target){
  ensure(target&&target.role==='student'&&target.avatar.blackStar,'검은별 상태인 학생을 골라주세요.');
  for(const planet of room.planets.values())for(const entry of planet.warnings?.entries||[])if(entry.targetId===target.id)entry.active=false;
  target.avatar.blackStar=null;
  if(target.mapId===BLACK_HOLE_ID)Object.assign(target,arrivePosition(room,PLAZA_ID,{x:1560,y:560}),{mapId:PLAZA_ID,input:{x:0,y:0,at:0}});
}
export function blackStarList(room){
  return [...room.players.values()].filter(p=>p.role==='student'&&p.avatar.blackStar).map(p=>({id:p.id,nickname:p.nickname,
    planetId:p.avatar.blackStar.planetId,planetName:room.planets.get(p.avatar.blackStar.planetId)?.name||'없어진 부서',at:p.avatar.blackStar.at}));
}
