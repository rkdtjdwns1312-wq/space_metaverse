import {randomInt} from 'node:crypto';
import {SCIENCE_FACTS} from '../shared/science-facts.js';
import {stationReward} from '../shared/station-rewards.js';
import {STREET,STREET_ID} from '../shared/config.js';
import {GameError} from './pin-auth.js';
import {isNear} from './world.js';
import {cultureDay} from './culture-library.js';

export const SCIENCE_DAILY_LIMIT=2;
const ids=SCIENCE_FACTS.map(fact=>fact.id),known=new Set(ids);
const station=STREET.objects.find(o=>o.kind==='science-station');
const need=(condition,message)=>{if(!condition)throw new GameError(message);};
const validDay=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T00:00:00Z'))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;
export function validateScienceReading(raw){
 if(raw===undefined)return {day:null,seenIds:[],openedIds:[],claimedIds:[],activeId:null};
 const unique=(list,max)=>Array.isArray(list)&&list.length<=max&&new Set(list).size===list.length&&list.every(id=>known.has(id));
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!(raw.day===null||validDay(raw.day))||
  !unique(raw.seenIds,ids.length)||!unique(raw.openedIds,2)||!unique(raw.claimedIds,2)||
  raw.openedIds.some(id=>!raw.seenIds.includes(id))||raw.claimedIds.some(id=>!raw.openedIds.includes(id))||
  !(raw.activeId===null||known.has(raw.activeId)&&raw.activeId===raw.seenIds.at(-1)&&raw.openedIds.includes(raw.activeId)&&!raw.claimedIds.includes(raw.activeId))||
  raw.openedIds.some(id=>id!==raw.activeId&&!raw.claimedIds.includes(id))||raw.day===null&&raw.seenIds.length)
  throw Error('Invalid science reading record');
 return {day:raw.day,seenIds:[...raw.seenIds],openedIds:[...raw.openedIds],claimedIds:[...raw.claimedIds],activeId:raw.activeId};
}
function today(player,now){
 const record=validateScienceReading(player.scienceReading),day=cultureDay(now);
 return record.day===day?record:{...record,day,openedIds:[],claimedIds:[]};
}
export function scienceStatus(player,now=Date.now()){
 const record=today(player,now),teacher=player.role==='teacher',reward=teacher?0:stationReward(player.avatar?.level);
 need(teacher||reward>0,'현재 레벨을 확인해주세요.');
 const count=record.openedIds.length,remaining=ids.length-record.seenIds.length;
 const canOpen=record.activeId!==null?(record.openedIds.includes(record.activeId)||count<2):remaining>0&&count<2;
 const exhausted=remaining===0&&record.activeId===null;
 return {day:record.day,count,limit:2,reward,remaining,total:ids.length,activeId:record.activeId,canOpen,exhausted,
  message:exhausted?'과학 상식 50편을 모두 읽었어요. 새로운 상식이 준비되면 다시 만나요.':teacher?'선생님은 읽을 수 있지만 우주에너지 보상은 받지 않아요.':!canOpen?'오늘은 과학 상식 2편을 모두 읽었어요. 내일 다시 만나요.':''};
}
export function registerScienceLibrary({socket,action,store,roster,clock=Date.now}){
 let selected=null;
 const access=()=>{
  const session=socket.data.session,player=session?.player,room=session?.room;
  need(socket.connected&&player?.connected&&!player.away&&player.socketId===socket.id&&['student','teacher'].includes(player.role)&&
   store.rooms.get(room?.code)===room&&room?.players.get(player.id)===player,'현재 접속에서 교실에 다시 입장해주세요.');
  need(player.mapId===STREET_ID&&station&&isNear(player,station),'별 과학 발전소 가까이에서 읽어주세요.');return {room,player};
 };
 action('science:status',()=>scienceStatus(access().player,clock()),false);
 action('science:open',()=>{
  const {room,player}=access(),now=clock(),status=scienceStatus(player,now),record=today(player,now);
  need(status.canOpen,status.message||'오늘은 새 과학 상식을 열 수 없어요.');
  if(record.activeId===null){const unseen=ids.filter(id=>!record.seenIds.includes(id));record.activeId=unseen[randomInt(unseen.length)];record.seenIds.push(record.activeId);}
  if(!record.openedIds.includes(record.activeId))record.openedIds.push(record.activeId);
  player.scienceReading=record;
  selected={roomCode:room.code,playerId:player.id,token:player.token,factId:record.activeId};
  return {...scienceStatus(player,now),factId:record.activeId};
 });
 action('science:claim',data=>{
  const {room,player}=access(),now=clock();
  need(typeof data.factId==='string'&&known.has(data.factId),'읽을 과학 상식을 골라주세요.');
  need(selected?.roomCode===room.code&&selected.playerId===player.id&&selected.token===player.token&&selected.factId===data.factId,'먼저 이 과학 상식을 열어 읽어주세요.');
  const status=scienceStatus(player,now),record=today(player,now);
  if(record.activeId!==data.factId){need(record.seenIds.includes(data.factId),'먼저 이 과학 상식을 열어 읽어주세요.');return {...status,awarded:false,amount:0,message:'이미 읽음 처리를 마친 과학 상식이에요.'};}
  // Finishing yesterday's still-open fact consumes one of today's two slots.
  if(!record.openedIds.includes(data.factId)){need(record.openedIds.length<2,'오늘은 과학 상식 2편을 모두 읽었어요.');record.openedIds.push(data.factId);}
  const amount=status.reward,before=player.cosmicEnergy??0;
  need(Number.isSafeInteger(before)&&before>=0&&Number.isSafeInteger(before+amount),'우주에너지를 더 담을 수 없어요.');
  player.cosmicEnergy=before+amount;record.claimedIds.push(data.factId);record.activeId=null;player.scienceReading=record;
  if(amount>0)roster(room);
  return {...scienceStatus(player,now),awarded:amount>0,amount,message:amount>0?`과학 상식을 다 읽었어요! 우주에너지 ${amount}을 받았어요.`:'선생님 읽음을 완료했어요. 보상 없이 다음 상식을 살펴볼 수 있어요.'};
 });
}
