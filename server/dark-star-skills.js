import {DARK_STAR_SKILLS as RULE,DARK_STAR_COLOR_PAIRS} from '../shared/dark-star-skills.js';
import {RULES,mapOf,interactionDistance,interactionReach} from '../shared/config.js';
import {onOriginFloor} from '../shared/origin-floor.js';
import {monsterType} from '../shared/monsters.js';
import {ensureVitals,damagePlayer,playerVitals,libraProtectors} from './vitals.js';
import {reflectLibraDamage} from './area-combat.js';
import {ensure} from './rooms.js';
import {randomUUID} from 'node:crypto';

const valid=(boss,p)=>p?.connected&&!p.away&&!p.avatar?.blackStar&&p.mapId===boss.mapId&&ensureVitals(p)?.hp>0&&
  !(p.role==='teacher'&&(p.avatar?.teacherPreview||!boss.teacherRetaliation?.has(p.id)));
const stateOf=boss=>boss.darkStarSkills??={mapId:boss.mapId,sequence:0,ready:{},aim:null,projectiles:[],paths:[],cards:[],puzzleEndsAt:null,
  triggered:0,absorptionQueue:[],absorbedColors:[],absorption:null,satellites:[]};
// A puzzle keeps its slot until success/deadline resolution; persistent satellites do not occupy it.
const majorActive=(state,now)=>state.puzzleEndsAt!==null||state.paths.some(path=>path.endsAt>now);
const roll=random=>Math.max(0,Math.min(.999999999,Number(random())||0));
const nextId=(boss,state,kind)=>`${boss.id}-${kind}-${++state.sequence}`;
export function segmentDistance(x,y,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/d)):0;
  return Math.hypot(x-x1-t*dx,y-y1-t*dy);
}
function clearPuzzle(room,state){
  for(const card of state.cards){card.hp=0;room.monsters?.delete(card.id);}
  state.cards=[];state.puzzleEndsAt=null;
}
export function clearDarkStarSkills(room,boss){
  if(boss.darkStarSkills)clearPuzzle(room,boss.darkStarSkills);
  boss.darkStarSkills=null;
}
function positions(map,count,radius,random,allowed=()=>true){
  const result=[],validPoint=(x,y)=>onOriginFloor(map,x,y,radius)&&allowed(x,y)&&
    !(map.objects||[]).some(o=>o.kind==='gate'&&Math.hypot(x-o.x,y-o.y)<radius+(o.radius||0)+100)&&
    result.every(p=>Math.hypot(x-p.x,y-p.y)>140);
  for(let i=0;i<250&&result.length<count;i++){
    const x=map.width*(.15+roll(random)*.7),y=map.height*(.2+roll(random)*.6);
    if(validPoint(x,y))result.push({x,y});
  }
  for(let y=map.height*.3;y<map.height*.7&&result.length<count;y+=150)
    for(let x=map.width*.25;x<map.width*.75&&result.length<count;x+=150)if(validPoint(x,y))result.push({x,y});
  return result.length===count?result:null;
}
export function beginDarkStarSkill(room,boss,kind,now,random=Math.random){
  const rule=RULE[kind];
  if(!['rainbow','puzzle'].includes(kind)||boss.typeId!=='dark-star'||boss.hp<=0||!Number.isFinite(now)||
    (boss.sleepUntil||0)>now||(boss.stunUntil||0)>now)return false;
  const state=stateOf(boss);
  if(majorActive(state,now)||state.absorption||state.absorptionQueue.length||state.mapId!==boss.mapId||now<(state.ready[kind]||0)||boss.mp<rule.mana||
    ![...room.players.values()].some(p=>valid(boss,p)))return false;
  const map=mapOf(boss.mapId,room.planets?.values?.()||[]);
  if(kind==='rainbow'){
    const center=positions(map,1,rule.length/2+rule.width/2,random)?.[0];
    if(!center)return false;
    const angle=roll(random)*Math.PI*2,dx=Math.cos(angle)*rule.length/2,dy=Math.sin(angle)*rule.length/2;
    state.paths.push({id:nextId(boss,state,'rainbow'),x1:center.x-dx,y1:center.y-dy,x2:center.x+dx,y2:center.y+dy,
      width:rule.width,startsAt:now,endsAt:now+rule.durationMs,contacts:new Map()});
  }else{
    if(state.puzzleEndsAt!==null)return false;
    // The artwork extends well above the ground center. Keep cards clear of its
    // full body bounds as well as the boss's immediate combat footprint.
    const bodyHalf=boss.radius*1.2+rule.radius+12,bodyY=boss.y-boss.radius*.3-8;
    const points=positions(map,rule.count,rule.radius,random,(x,y)=>
      Math.hypot(x-boss.x,y-boss.y)>boss.radius+80&&
      (Math.abs(x-boss.x)>bodyHalf||Math.abs(y-bodyY)>bodyHalf)&&
      state.satellites.every(s=>Math.hypot(x-s.x,y-s.y)>s.radius+rule.radius+32));if(!points)return false;
    const pair=[...DARK_STAR_COLOR_PAIRS[Math.floor(roll(random)*DARK_STAR_COLOR_PAIRS.length)]];
    if(roll(random)<.5)pair.reverse();
    const oddIndex=Math.floor(roll(random)*rule.count);
    state.puzzleEndsAt=now+rule.durationMs;
    state.cards=points.map((point,index)=>({id:nextId(boss,state,'card'),typeId:'dark-star-card',bossId:boss.id,mapId:boss.mapId,...point,
      radius:rule.radius,hp:1,startsAt:now,endsAt:state.puzzleEndsAt,revealUntil:0,confirmations:new Map(),
      color:pair[index===oddIndex?1:0],correct:index===oddIndex,attackers:new Map(),contributors:new Map(),attackOrder:0}));
    for(const card of state.cards)room.monsters.set(card.id,card);
  }
  boss.mp-=rule.mana;state.ready[kind]=now+rule.cooldownMs;state.lastMajor=kind;return true;
}
export function tryDarkStarSkills(room,boss,target,now,random=Math.random){
  if(!target||!valid(boss,target))return;
  const state=stateOf(boss);
  if(majorActive(state,now)||state.absorption||state.absorptionQueue.length)return;
  let choices=['rainbow','puzzle'].filter(kind=>now>=(state.ready[kind]||0)&&boss.mp>=RULE[kind].mana);
  if(choices.length>1&&state.lastMajor)choices=choices.filter(kind=>kind!==state.lastMajor);
  if(choices.length)beginDarkStarSkill(room,boss,choices[Math.floor(roll(random)*choices.length)],now,random);
}
const visual=(boss,kind,x,y)=>({monsterId:boss.id,mapId:boss.mapId,x,y,dx:0,dy:0,reach:0,skillKind:`dark-star-${kind}`,durationMs:450,noEffect:true});
function hitPlayer(room,boss,player,now,kind,x,y){
  const hit=damagePlayer(player,monsterType(boss.typeId).power,now,{room});
  if(hit?.reflectedDamage)reflectLibraDamage(room,player,{sourceMonsterId:boss.id},hit.reflectedDamage,now);
  return {targetId:player.id,...visual(boss,kind,x,y),...hit};
}
export function aimDarkStar(room,boss,target,now){
  const state=stateOf(boss);
  if(state.absorption||!target||!valid(boss,target)||(boss.sleepUntil||0)>now||(boss.stunUntil||0)>now){state.aim=null;return [];}
  const distance=Math.hypot(target.x-boss.x,target.y-boss.y),dx=distance?(target.x-boss.x)/distance:1,dy=distance?(target.y-boss.y)/distance:0;
  state.aim??={startsAt:now,endsAt:now+RULE.basic.aimMs};
  Object.assign(state.aim,{x:boss.x,y:boss.y,dx,dy});
  if(now<state.aim.endsAt)return [];
  state.projectiles.push({id:nextId(boss,state,'shot'),x:boss.x,y:boss.y,dx,dy,radius:RULE.basic.radius,startsAt:now,endsAt:now+RULE.basic.durationMs,lastAt:now});
  state.aim={x:boss.x,y:boss.y,dx,dy,startsAt:now,endsAt:now+RULE.basic.aimMs};
  return [{...visual(boss,'basic',boss.x,boss.y),dx,dy,attackOnly:true}];
}
export function recordDarkStarDamage(boss){
  if(boss.typeId!=='dark-star'||boss.hp<=0)return;
  const state=stateOf(boss),rule=RULE.absorption;
  while(state.triggered<rule.thresholds.length&&boss.hp<=rule.thresholds[state.triggered]){
    state.absorptionQueue.push(rule.colors[state.triggered++]);
  }
}
function instantDefeat(room,boss,p,now,kind){
  if(libraProtectors(room,p,now).length)return {...visual(boss,kind,p.x,p.y),targetId:p.id,damage:0,vitals:playerVitals(p),defeated:false,immune:true};
  const vitals=ensureVitals(p),damage=vitals.hp;vitals.hp=0;vitals.defeatedAt=now;p.input={x:0,y:0,at:0};
  (p.damageNumbers??=[]).push({targetId:p.id,targetKind:'player',mapId:p.mapId,x:p.x,y:p.y,damage});
  if(p.damageNumbers.length>40)p.damageNumbers.shift();
  return {...visual(boss,kind,p.x,p.y),targetId:p.id,damage,vitals:playerVitals(p),defeated:true};
}
function tickAbsorption(room,boss,state,now,hits,random){
  const rule=RULE.absorption;
  if(state.absorption&&now>=state.absorption.endsAt){
    const cast=state.absorption;state.absorption=null;
    for(const p of room.players.values())if(valid(boss,p)&&Math.hypot(p.x-cast.x,p.y-cast.y)<=cast.radius+RULES.radius)
      hits.push(instantDefeat(room,boss,p,now,'absorption'));
  }
  if(!state.absorption&&state.absorptionQueue.length&&!majorActive(state,now)){
    const color=state.absorptionQueue.shift(),map=mapOf(boss.mapId,room.planets?.values?.()||[]);
    state.absorbedColors.push(color);state.aim=null;
    state.absorption={color,x:boss.x,y:boss.y,radius:rule.radius,startsAt:now,endsAt:now+rule.warningMs};
    const point=positions(map,1,rule.satelliteRadius,random,(x,y)=>state.cards.every(c=>
      Math.hypot(x-c.x,y-c.y)>rule.satelliteRadius+c.radius+32))?.[0];
    if(point)state.satellites.push({id:nextId(boss,state,'satellite'),color,...point,radius:rule.satelliteRadius,startsAt:now,contacts:new Map()});
  }
  for(const satellite of state.satellites){
    const present=new Set();
    for(const p of room.players.values())if(valid(boss,p)&&Math.hypot(p.x-satellite.x,p.y-satellite.y)<=satellite.radius+RULES.radius){
      present.add(p.id);
      const contact=satellite.contacts.get(p.id);
      // Reconnecting cannot claim continuity while absent from the server.
      if(!contact||contact.player!==p||contact.socketId!==p.socketId){satellite.contacts.set(p.id,{player:p,socketId:p.socketId,nextAt:now+rule.contactMs});continue;}
      if(now>=contact.nextAt&&boss.hp>0){
        contact.nextAt=now+rule.contactMs;hits.push(hitPlayer(room,boss,p,now,'satellite',satellite.x,satellite.y));
      }
    }
    for(const id of satellite.contacts.keys())if(!present.has(id))satellite.contacts.delete(id);
    if(boss.hp<=0)break;
  }
}
export function tickDarkStarSkills(room,boss,now,random=Math.random){
  const state=boss.darkStarSkills,hits=[];
  if(!state)return hits;
  if(boss.hp<=0||state.mapId!==boss.mapId){clearDarkStarSkills(room,boss);return hits;}
  // Resolve the deadline before any new cast or late attack/interaction.
  if(state.puzzleEndsAt!==null&&now>=state.puzzleEndsAt){
    clearPuzzle(room,state);
    for(const p of room.players.values())if(valid(boss,p)){
      hits.push(instantDefeat(room,boss,p,now,'puzzle'));
    }
  }
  tickAbsorption(room,boss,state,now,hits,random);
  state.paths=state.paths.filter(path=>now<path.endsAt);
  for(const path of state.paths){
    const present=new Set();
    for(const p of room.players.values()){
      if(boss.hp<=0)break;
      if(!valid(boss,p)||segmentDistance(p.x,p.y,path.x1,path.y1,path.x2,path.y2)>path.width/2+RULES.radius)continue;
      present.add(p.id);
      const contact=path.contacts.get(p.id);
      // A fresh touch hits immediately; staying on the path ticks once per second.
      // Never replay missed damage after a delayed server tick.
      if(!contact||contact.player!==p||contact.socketId!==p.socketId||now>=contact.nextAt){
        path.contacts.set(p.id,{player:p,socketId:p.socketId,nextAt:now+RULE.rainbow.contactMs});
        hits.push(hitPlayer(room,boss,p,now,'rainbow',p.x,p.y));
      }
    }
    for(const id of path.contacts.keys())if(!present.has(id))path.contacts.delete(id);
  }
  state.projectiles=state.projectiles.filter(shot=>{
    if(boss.hp<=0||now>=shot.endsAt)return false;
    const oldX=shot.x,oldY=shot.y,travel=Math.max(0,now-shot.lastAt)/1000*RULE.basic.speed;
    shot.x+=shot.dx*travel;shot.y+=shot.dy*travel;shot.lastAt=now;
    const target=[...room.players.values()].filter(p=>valid(boss,p)&&segmentDistance(p.x,p.y,oldX,oldY,shot.x,shot.y)<=shot.radius+RULES.radius)
      .sort((a,b)=>Math.hypot(a.x-oldX,a.y-oldY)-Math.hypot(b.x-oldX,b.y-oldY))[0];
    if(!target)return true;
    hits.push(hitPlayer(room,boss,target,now,'basic',shot.x,shot.y));return false;
  });
  if(boss.hp<=0)clearDarkStarSkills(room,boss);
  return hits;
}
export function revealDarkStarCard(room,player,cardId,now=Date.now(),removeToken=null){
  const card=room.monsters?.get(cardId),boss=room.monsters?.get(card?.bossId);
  ensure(card?.typeId==='dark-star-card'&&card.hp>0&&boss?.hp>0&&card.mapId===boss.mapId&&now<card.endsAt&&
    player?.connected&&room.players.get(player.id)===player&&!player.away&&!player.avatar?.blackStar&&ensureVitals(player)?.hp>0&&player.mapId===card.mapId&&
    interactionDistance(player,card)<=interactionReach(card),'별 카드 가까이에서 확인해 주세요.');
  const state=boss.darkStarSkills;
  ensure(state?.cards.includes(card)&&now<state.puzzleEndsAt,'카드 확인 시간이 끝났어요.');
  card.confirmations??=new Map();
  for(const [id,c] of card.confirmations)if(c.until<=now)card.confirmations.delete(id);
  const confirmation=card.confirmations.get(player.id);
  if(removeToken&&confirmation?.token===removeToken&&confirmation.player===player&&confirmation.socketId===player.socketId&&now<confirmation.until){
    ensure(now>=confirmation.removeAfter,'색을 확인한 뒤 F를 한 번 더 눌러주세요.');
    card.confirmations.clear();card.hp=0;room.monsters.delete(card.id);
    if(card.correct)clearPuzzle(room,state);else state.cards=state.cards.filter(c=>c!==card);
    const hit=card.correct?null:instantDefeat(room,boss,player,now,'wrong-card');
    return {message:card.correct?'다른 색 카드를 찾아냈어요!':'다른 색 카드가 아니었어요.',cardId:card.id,removed:true,correct:card.correct,...(hit?{hit}:{})};
  }
  // A first request can be replayed safely: only a player-owned returned token
  // makes a later deliberate confirmation destructive. Expired tokens reveal anew.
  card.revealUntil=now+RULE.puzzle.revealMs;
  const next={token:randomUUID(),player,socketId:player.socketId,until:card.revealUntil,removeAfter:now+300};
  card.confirmations.set(player.id,next);
  return {message:'F를 한 번 더 누르면 제거합니다.',cardId:card.id,revealUntil:next.until,canRemove:true,removeToken:next.token,removeAfter:next.removeAfter};
}
// Cards are interaction-only objects. Every attack/skill shares this final guard.
export function damageDarkStarCard(){return null;}
export function darkStarSkillViews(room,boss,now){
  const state=boss.darkStarSkills;
  if(!state||boss.hp<=0||state.mapId!==boss.mapId)return null;
  return {aim:state.aim?{...state.aim}:null,
    projectiles:state.projectiles.filter(s=>now<s.endsAt).map(({id,x,y,dx,dy,radius,startsAt,endsAt})=>({id,x,y,dx,dy,radius,startsAt,endsAt})),
    paths:state.paths.filter(p=>now<p.endsAt).map(({id,x1,y1,x2,y2,width,startsAt,endsAt})=>({id,x1,y1,x2,y2,width,startsAt,endsAt})),
    cards:state.cards.filter(c=>c.hp>0&&now<c.endsAt).map(({id,x,y,radius,startsAt,endsAt,revealUntil,color})=>({id,x,y,radius,startsAt,endsAt,revealUntil,...(now<revealUntil?{color}:{})})),
    puzzleEndsAt:state.puzzleEndsAt,absorbedColors:[...state.absorbedColors],absorption:state.absorption?{...state.absorption}:null,
    satellites:state.satellites.map(({id,color,x,y,radius,startsAt})=>({id,color,x,y,radius,startsAt}))};
}
