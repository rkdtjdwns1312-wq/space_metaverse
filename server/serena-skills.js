import {SERENA_SKILLS,serenaRedRadii} from '../shared/serena-skills.js';
import {RULES} from '../shared/config.js';
import {monsterType} from '../shared/monsters.js';
import {ensureVitals,damagePlayer,playerVitals} from './vitals.js';
import {damagePlayersInArea,reflectLibraDamage} from './area-combat.js';

const valid=(boss,p)=>p?.connected&&!p.away&&!p.avatar?.blackStar&&p.mapId===boss.mapId&&ensureVitals(p)?.hp>0&&
  !(p.role==='teacher'&&(p.avatar?.teacherPreview||!boss.teacherRetaliation?.has(p.id)));
const candidates=(room,boss)=>[...room.players.values()].filter(p=>valid(boss,p)&&(p.role==='teacher'||p.avatar?.level>=2));
const stateOf=boss=>boss.serenaSkills??={mapId:boss.mapId,sequence:0,marks:[],warnings:[],bursts:[],ready:{},nextDecisionAt:0,nextSkillIndex:0,busyUntil:0};
// 미처 처리하지 못한 경고도 다음 틱에서 폭발하므로 새 시전을 막습니다.
const hasPendingEffect=(state,now)=>state.marks.length>0||state.warnings.length>0||state.bursts.some(burst=>now<burst.endsAt);
function extendBusyUntil(state,until){
  state.busyUntil=Math.max(state.busyUntil,until);
  state.nextDecisionAt=Math.max(state.nextDecisionAt,state.busyUntil+SERENA_SKILLS.yellow.decisionMs);
}
const nextId=(boss,state)=>`${boss.id}-star-${++state.sequence}`;
const visual=(boss,kind,x,y)=>({monsterId:boss.id,mapId:boss.mapId,x,y,dx:0,dy:0,reach:0,skillKind:`serena-${kind}`,durationMs:450,noEffect:true});
export function clearSerenaSkills(boss){boss.serenaSkills=null;}

export function beginSerenaSkill(room,boss,kind,now,random=Math.random){
  const rule=SERENA_SKILLS[kind];
  if(!rule||boss.typeId!=='serena'||boss.hp<=0||!Number.isFinite(now)||(boss.sleepUntil||0)>now||(boss.stunUntil||0)>now)return false;
  const state=stateOf(boss);
  if(state.mapId!==boss.mapId){clearSerenaSkills(boss);return false;}
  if(now<(state.ready[kind]||0)||now<(state.busyUntil||0)||hasPendingEffect(state,now)||boss.mp<rule.mana)return false;
  const targets=candidates(room,boss);
  if(!targets.length)return false;
  // 부분 Fisher–Yates: 같은 캐릭터가 한 시전에 두 번 선택되지 않습니다.
  if(rule.maxTargets)for(let i=0;i<Math.min(rule.maxTargets,targets.length);i++){
    const roll=random(),j=i+Math.floor((Number.isFinite(roll)?Math.max(0,Math.min(.999999999,roll)):0)*(targets.length-i));
    [targets[i],targets[j]]=[targets[j],targets[i]];
  }
  for(const p of targets.slice(0,rule.maxTargets??targets.length))state.marks.push({
    id:nextId(boss,state),kind,playerId:p.id,startsAt:now,endsAt:now+rule.durationMs,nextTickAt:now+(rule.intervalMs||0),
    ...(kind==='black'?{remaining:rule.contacts,contacts:new Set()}:{}),...(kind==='red'?serenaRedRadii(p):{})
  });
  boss.mp-=rule.mana;state.ready[kind]=now+rule.cooldownMs;
  state.busyUntil=now+rule.durationMs+(kind==='yellow'?rule.warningMs+rule.burstMs:0);
  state.nextDecisionAt=state.busyUntil+rule.decisionMs;
  return true;
}

export function trySerenaSkills(room,boss,target,now,random=Math.random){
  if(!target||boss.typeId!=='serena'||boss.hp<=0)return false;
  const state=stateOf(boss);
  if(now<(state.busyUntil||0)||now<(state.nextDecisionAt||0)||hasPendingEffect(state,now))return false;
  const kinds=Object.keys(SERENA_SKILLS),start=state.nextSkillIndex||0;
  const index=Array.from({length:kinds.length},(_,offset)=>(start+offset)%kinds.length)
    .find(i=>now>=(state.ready[kinds[i]]||0)&&boss.mp>=SERENA_SKILLS[kinds[i]].mana);
  if(index===undefined){state.nextDecisionAt=now+2000;return false;}
  const kind=kinds[index],rule=SERENA_SKILLS[kind],roll=random();
  state.nextSkillIndex=(index+1)%kinds.length;
  state.nextDecisionAt=now+rule.decisionMs;
  return Number.isFinite(roll)&&roll>=0&&roll<rule.chance&&beginSerenaSkill(room,boss,kind,now,random);
}

// 즉사는 방어·면역·반사·자동 부활로 회피하지 않으며 일반 사망 상태를 기록합니다.
function instantDefeat(player,now){
  const value=ensureVitals(player),damage=value.hp;
  value.hp=0;value.defeatedAt=now;player.input={x:0,y:0,at:0};
  (player.damageNumbers??=[]).push({targetId:player.id,targetKind:'player',mapId:player.mapId,x:player.x,y:player.y,damage});
  if(player.damageNumbers.length>40)player.damageNumbers.shift();
  return {damage,vitals:playerVitals(player),defeated:true};
}

export function tickSerenaSkills(room,boss,now){
  const state=boss.serenaSkills,hits=[];
  if(!state)return hits;
  if(boss.hp<=0||state.mapId!==boss.mapId){clearSerenaSkills(boss);return hits;}
  const power=monsterType(boss.typeId)?.power??30;
  state.bursts=state.bursts.filter(b=>b.endsAt>now);
  // 위치가 고정된 경고만 폭발하며, 출처 캐릭터가 사망·이탈하면 함께 제거합니다.
  state.warnings=state.warnings.filter(w=>{
    if(boss.hp<=0||!valid(boss,room.players.get(w.playerId)))return false;
    if(now<w.endsAt)return true;
    const results=damagePlayersInArea(room,{mapId:boss.mapId,x:w.x,y:w.y,radius:w.radius,excludeTeachers:true,teacherTargetIds:boss.teacherRetaliation,sourceMonsterId:boss.id},power,now);
    for(const result of results)hits.push({...visual(boss,'yellow',w.x,w.y),...result});
    state.bursts.push({id:w.id,x:w.x,y:w.y,radius:w.radius,startsAt:now,endsAt:now+SERENA_SKILLS.yellow.burstMs});
    extendBusyUntil(state,now+SERENA_SKILLS.yellow.burstMs);
    return false;
  });
  if(boss.hp<=0){clearSerenaSkills(boss);return hits;}
  state.marks=state.marks.filter(mark=>{
    const p=room.players.get(mark.playerId);
    if(boss.hp<=0||!valid(boss,p))return false;
    if(mark.kind==='black'){
      if(now>=mark.endsAt){hits.push({...visual(boss,'black',p.x,p.y),targetId:p.id,...instantDefeat(p,now)});return false;}
      const contacts=new Set(candidates(room,boss).filter(other=>other.id!==p.id&&Math.hypot(other.x-p.x,other.y-p.y)<=RULES.radius*2).map(other=>other.id));
      for(const id of contacts)if(!mark.contacts.has(id))mark.remaining=Math.max(0,mark.remaining-1);
      mark.contacts=contacts;return mark.remaining>0;
    }
    const interval=SERENA_SKILLS[mark.kind].intervalMs;
    // 20초 예약 펄스는 한 구간 미만의 틱 지연만 허용하고 바로 종료합니다.
    // 이전에 건너뛴 펄스는 재생하지 않으며, 긴 정지 뒤에는 마지막 피해도 버립니다.
    const delayedFinal=mark.nextTickAt===mark.endsAt&&now<mark.endsAt+interval;
    if(now>mark.endsAt&&!delayedFinal)return false;
    if(now>=mark.nextTickAt){
      // 서버 지연 뒤 과거 위치를 추측하거나 밀린 피해를 한꺼번에 적용하지 않습니다.
      mark.nextTickAt+=(Math.floor((now-mark.nextTickAt)/interval)+1)*interval;
      if(mark.kind==='yellow'){
        state.warnings.push({id:nextId(boss,state),playerId:p.id,x:p.x,y:p.y,radius:SERENA_SKILLS.yellow.radius,startsAt:now,endsAt:now+SERENA_SKILLS.yellow.warningMs});
        extendBusyUntil(state,now+SERENA_SKILLS.yellow.warningMs+SERENA_SKILLS.yellow.burstMs);
      }
      else{
        Object.assign(mark,serenaRedRadii(p));
        for(const other of candidates(room,boss)){
          if(other.id===p.id||((other.x-p.x)/(mark.radiusX+RULES.radius))**2+((other.y-p.y)/(mark.radiusY+RULES.radius))**2>1)continue;
          const result=damagePlayer(other,power,now,{room});
          if(!result)continue;
          if(result.reflectedDamage)reflectLibraDamage(room,other,{sourceMonsterId:boss.id},result.reflectedDamage,now);
          hits.push({...visual(boss,'red',p.x,p.y),targetId:other.id,...result});
          if(boss.hp<=0)break;
        }
      }
    }
    return now<mark.endsAt&&boss.hp>0&&valid(boss,p);
  });
  if(boss.hp<=0)clearSerenaSkills(boss);
  return hits;
}

export function serenaSkillViews(room,boss,now){
  const state=boss.serenaSkills;
  if(!state||boss.hp<=0||state.mapId!==boss.mapId)return null;
  return {
    marks:state.marks.filter(m=>m.endsAt>now&&valid(boss,room.players.get(m.playerId))).map(({id,kind,playerId,startsAt,endsAt,remaining,radiusX,radiusY})=>({id,kind,playerId,startsAt,endsAt,...(kind==='black'?{remaining}:{}),...(kind==='red'?{radiusX,radiusY}:{})})),
    warnings:state.warnings.filter(w=>valid(boss,room.players.get(w.playerId))).map(({id,x,y,radius,startsAt,endsAt})=>({id,x,y,radius,startsAt,endsAt})),
    bursts:state.bursts.filter(b=>b.endsAt>now).map(b=>({...b}))
  };
}
