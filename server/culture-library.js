import {CULTURE_STORIES} from '../shared/culture-stories.js';
import {HISTORY_LESSONS} from '../shared/history-lessons.js';
import {stationReward} from '../shared/station-rewards.js';
import {STREET,STREET_ID} from '../shared/config.js';
import {GameError} from './pin-auth.js';
import {isNear} from './world.js';

export const CULTURE_DAILY_LIMIT=10;
const culture={namespace:'culture',field:'cultureReading',ids:new Set(CULTURE_STORIES.map(story=>story.id)),
  station:STREET.objects.find(object=>object.kind==='culture-station'),label:'별 교양 발전소',unit:'권'};
const history={namespace:'history',field:'historyReading',ids:new Set(HISTORY_LESSONS.map(story=>story.id)),
  station:STREET.objects.find(object=>object.kind==='history-station'),label:'별 역사 발전소',unit:'편'};
const requireThat=(condition,message)=>{if(!condition)throw new GameError(message);};
export const cultureDay=(now=Date.now())=>new Date(now+9*60*60*1000).toISOString().slice(0,10);
const validDay=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&
  Number.isFinite(Date.parse(day+'T00:00:00Z'))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;

// Only successful daily claims persist. A missing field is an old save, while
// malformed data must fail closed rather than restore another ten rewards.
export function validateCultureReading(raw){
  return validateReading(raw,culture);
}
export function validateHistoryReading(raw){return validateReading(raw,history);}
function validateReading(raw,library){
  if(raw===undefined)return {day:null,claimedIds:[]};
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    !(raw.day===null||validDay(raw.day))||!Array.isArray(raw.claimedIds)||
    raw.claimedIds.length>CULTURE_DAILY_LIMIT||new Set(raw.claimedIds).size!==raw.claimedIds.length||
    raw.claimedIds.some(id=>!library.ids.has(id))||raw.day===null&&raw.claimedIds.length)
    throw new Error(`Invalid ${library.namespace} reading record`);
  return {day:raw.day,claimedIds:[...raw.claimedIds]};
}

export function cultureStatus(player,now=Date.now()){
  return readingStatus(player,now,culture);
}
function readingStatus(player,now,library){
  const day=cultureDay(now),saved=validateReading(player[library.field],library);
  const claimedIds=saved.day===day?[...saved.claimedIds]:[];
  const teacher=player.role==='teacher',reward=teacher?0:stationReward(player.avatar?.level);
  requireThat(teacher||reward>0,'현재 레벨을 확인해주세요.');
  return {day,claimedIds,count:claimedIds.length,limit:CULTURE_DAILY_LIMIT,reward,
    ...(teacher?{message:'선생님은 이야기를 읽을 수 있지만 우주에너지 보상은 받지 않아요.'}:{})};
}

export function registerCultureLibrary(options){return registerReadingLibrary(options,culture);}
export function registerHistoryLibrary(options){return registerReadingLibrary(options,history);}
export function registerReadingLibrary({socket,action,store,roster,clock=Date.now},library){
  const {namespace,field,station,label,unit}=library;
  // Bound to this socket AND login token, never player save data. Reconnecting
  // or changing accounts requires selecting a book again. Claim does not consume
  // this selection, so a failed disk write can be retried safely.
  let selected=null;
  function access(){
    const session=socket.data.session,player=session?.player,room=session?.room;
    requireThat(socket.connected&&player?.connected&&!player.away&&player.socketId===socket.id&&
      ['student','teacher'].includes(player.role)&&store.rooms.get(room?.code)===room&&room?.players.get(player.id)===player,
      '현재 접속에서 교실에 다시 입장해주세요.');
    requireThat(player.mapId===STREET_ID&&station&&isNear(player,station),`${label} 가까이에서 읽어주세요.`);
    return {room,player};
  }
  function story(id){requireThat(typeof id==='string'&&library.ids.has(id),'읽을 이야기를 골라주세요.');}
  action(`${namespace}:status`,()=>{const {player}=access();return readingStatus(player,clock(),library);},false);
  action(`${namespace}:open`,data=>{
    const {room,player}=access();story(data.storyId);
    const status=readingStatus(player,clock(),library);
    selected={roomCode:room.code,playerId:player.id,token:player.token,storyId:data.storyId};
    return status;
  },false);
  action(`${namespace}:claim`,data=>{
    const {room,player}=access();story(data.storyId);
    requireThat(selected?.roomCode===room.code&&selected.playerId===player.id&&selected.token===player.token&&selected.storyId===data.storyId,
      '먼저 이 이야기를 선택해 읽어주세요.');
    const status=readingStatus(player,clock(),library);
    if(player.role==='teacher')return {...status,awarded:false,amount:0};
    if(status.claimedIds.includes(data.storyId))return {...status,awarded:false,amount:0,message:'오늘 이 이야기의 보상을 이미 받았어요.'};
    if(status.count>=CULTURE_DAILY_LIMIT)return {...status,awarded:false,amount:0,message:`오늘은 10${unit}의 보상을 모두 받았어요. 내일 다시 읽어주세요.`};
    const before=player.cosmicEnergy??0,amount=status.reward;
    requireThat(Number.isSafeInteger(before)&&before>=0&&Number.isSafeInteger(before+amount),'우주에너지를 더 담을 수 없어요.');
    player.cosmicEnergy=before+amount;
    player[field]={day:status.day,claimedIds:[...status.claimedIds,data.storyId]};
    roster(room);
    return {...status,claimedIds:[...player[field].claimedIds],count:status.count+1,awarded:true,amount,
      message:`이야기를 다 읽었어요! 우주에너지 ${amount}을 받았어요.`};
  });
}
