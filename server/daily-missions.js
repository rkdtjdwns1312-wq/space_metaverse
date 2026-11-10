import {monsterType} from '../shared/monsters.js';
import {validateMissions,missionExpired,advanceMissions} from './missions.js';

export const DAILY_HISTORY_LIMIT=100;
const rewardTypes=new Set(['star-crumb','star-shard','cosmic-energy']);
const validRewards=rewards=>Array.isArray(rewards)&&rewards.length>0&&new Set(rewards.map(reward=>reward?.type)).size===rewards.length&&
 rewards.every(reward=>reward&&rewardTypes.has(reward.type)&&Number.isSafeInteger(reward.quantity)&&reward.quantity>=1&&reward.quantity<=10);
export const dailyMissionDay=now=>new Date(now+9*3600000).toISOString().slice(0,10);
const dayStart=day=>Date.parse(day+'T00:00:00+09:00');
const validDay=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(dayStart(day))&&dailyMissionDay(dayStart(day))===day;
const idFor=(templateId,day)=>`daily:${templateId}:${day}`;
const defaultTemplate={id:'builtin-timetable',title:'시간표 확인하기',description:'광장의 오늘의 시간표 기둥에서 시간표를 확인해요.',
 objective:'timetable-read',goal:1,distribution:'all',repeat:'daily',rewardItem:'star-crumb',rewardQuantity:1,rewardShards:0,
 maxRecipients:null,validityHours:null,at:0};

export const isBuiltinDaily=id=>['builtin-timetable','builtin-hunt'].includes(id);
const huntTemplate={...defaultTemplate,id:'builtin-hunt',title:'내 레벨 이하 몬스터 10마리 잡기',
 description:'오늘 내 현재 레벨 이하의 몬스터 10마리를 잡아요. 피해를 준 몬스터의 처치를 인정해요.',objective:'monster-hunt',goal:10};

export function dailyInstances(room,now=Date.now()){
 return room.dailyMissions?.day===dailyMissionDay(now)?room.dailyMissions.instances:[];
}
export function validateDailyMissions(raw){
 if(raw===undefined)return {day:null,instances:[]};
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!(raw.day===null||validDay(raw.day))||!Array.isArray(raw.instances)||raw.instances.length>32||raw.day===null&&raw.instances.length)throw Error('Invalid daily missions');
 const instances=validateMissions(raw.instances,{limit:32,instances:true}),templates=new Set();
 for(const m of instances){
  if(m.repeat!=='daily'||m.day!==raw.day||typeof m.templateId!=='string'||!m.templateId||templates.has(m.templateId)||m.id!==idFor(m.templateId,raw.day)||
   m.at<dayStart(raw.day)||m.at>=dayStart(raw.day)+86400000||m.expiresAt==null||m.expiresAt>dayStart(raw.day)+86400000||
   m.claimedIds.some(id=>!Number.isSafeInteger(m.claimedAt?.[id])||m.claimedAt[id]<m.at||m.claimedAt[id]>=m.expiresAt))throw Error('Invalid daily instance');
  templates.add(m.templateId);
 }
 return {day:raw.day,instances};
}
export function validateDailyMissionHistory(raw){
 if(raw===undefined)return [];
 if(!Array.isArray(raw)||raw.length>DAILY_HISTORY_LIMIT)throw Error('Invalid daily history');
 const ids=new Set();
 return raw.map(m=>{
  if(!m||typeof m.templateId!=='string'||!m.templateId||!validDay(m.day)||m.id!==idFor(m.templateId,m.day)||ids.has(m.id)||typeof m.title!=='string'||!m.title||m.title.length>40||
   typeof m.description!=='string'||!m.description||m.description.length>240||!(m.rewards!==undefined?validRewards(m.rewards):
    m.rewardItem==='star-crumb'&&Number.isSafeInteger(m.rewardQuantity)&&m.rewardQuantity>=1&&m.rewardQuantity<=10)||
   !Number.isSafeInteger(m.claimedAt)||m.claimedAt<dayStart(m.day)||m.claimedAt>=dayStart(m.day)+86400000)throw Error('Invalid daily history entry');
  ids.add(m.id);return {id:m.id,templateId:m.templateId,day:m.day,title:m.title,description:m.description,
   ...(m.rewards!==undefined?{rewards:structuredClone(m.rewards)}:{rewardItem:'star-crumb',rewardQuantity:m.rewardQuantity}),claimedAt:m.claimedAt};
 });
}

// Must run in the caller's transaction. Never used to mutate from a snapshot.
export function ensureDailyMissions(room,now=Date.now()){
 const day=dailyMissionDay(now);let state=room.dailyMissions,changed=false;
 // A backwards clock must not reopen an already issued reward day.
 if(state?.day&&state.day>day)return false;
 if(!state||state.day!==day){
  for(const m of state?.instances||[])for(const player of room.players.values())if(player.role==='student'&&m.claimedIds.includes(player.id)){
   const history=player.dailyMissionHistory||[];
   if(!history.some(entry=>entry.id===m.id))player.dailyMissionHistory=[...history,{id:m.id,templateId:m.templateId,day:m.day,title:m.title,description:m.description,
    ...(m.rewards?{rewards:structuredClone(m.rewards)}:{rewardItem:'star-crumb',rewardQuantity:m.rewardQuantity}),claimedAt:m.claimedAt[player.id]}].slice(-DAILY_HISTORY_LIMIT);
  }
  state=room.dailyMissions={day,instances:[]};changed=true;
 }
 for(const template of [defaultTemplate,huntTemplate,...(room.missions||[]).filter(m=>m.repeat==='daily')]){
  const id=idFor(template.id,day);let instance=state.instances.find(m=>m.id===id);
  if(!instance){
   const at=Math.max(dayStart(day),template.at);if(at>=dayStart(day)+86400000)continue;
   instance={...structuredClone(template),id,templateId:template.id,day,at,
    expiresAt:Math.min(dayStart(day)+86400000,at+(template.validityHours??24)*3600000),
    acceptedIds:[],completedIds:[],claimedIds:[],claimedAt:{},progress:{}};
   state.instances.push(instance);changed=true;
  }
  if(missionExpired(instance,now))continue;
  for(const p of room.players.values())if(p.role==='student'&&!instance.acceptedIds.includes(p.id)){
   instance.acceptedIds.push(p.id);changed=true;
  }
 }
 return changed;
}

export function dailyHistoryViews(player){
 return (player.dailyMissionHistory||[]).map(m=>({...m,repeat:'daily',rewardShards:m.rewards?.find(reward=>reward.type==='star-shard')?.quantity||0,
  distribution:'all',status:'claimed',archived:true,expired:true}));
}


// Capture eligibility at death, before contributor maps are cleared. Only the
// common positive-HP -> zero-HP transition calls this, including periodic hits.
export function queueDailyHunt(room,monster,contributors,now){
 const level=monsterType(monster.typeId)?.level??monster.level;
 if(!Number.isInteger(level)||level<1)return;
 const day=dailyMissionDay(now),mission=dailyInstances(room,now).find(m=>m.templateId==='builtin-hunt');
 for(const [id,damage] of contributors){
  const player=room.players.get(id);
  if(!(damage>0)||player?.role!=='student'||!Number.isInteger(player.avatar?.level)||player.avatar.level<level||mission?.completedIds.includes(id))continue;
  room.pendingHuntProgress??=new Map();
  // Expired days cannot become progress for today's mission after a save retry.
  for(const [key,value] of room.pendingHuntProgress)if(value.day<day)room.pendingHuntProgress.delete(key);
  const key=day+':'+id,previous=room.pendingHuntProgress.get(key);
  room.pendingHuntProgress.set(key,{day,playerId:id,count:Math.min(10,(previous?.count||0)+1)});
 }
}
// Called in the same persisted transaction as pending boss deaths. Failed saves
// restore both the unconsumed queue and the old progress for an exact retry.
export function settleDailyHunt(room,now){
 let changed=false;const day=dailyMissionDay(now);
 for(const [key,value] of room.pendingHuntProgress||[]){
  const player=room.players.get(value.playerId);
  if(value.day===day&&player?.role==='student')for(let i=0;i<value.count;i++)
   changed=advanceMissions(room,player,'monster-hunt',undefined,now)||changed;
  room.pendingHuntProgress.delete(key);
 }
 return changed;
}
