import {randomUUID} from 'node:crypto';
import {ARCHIVE_KINDS,ARCHIVE_LIMITS as L} from '../shared/starlight-archive.js';
import {MAP} from '../shared/config.js';
import {GameError} from './pin-auth.js';
import {isNear} from './world.js';
import {isDefeated} from './vitals.js';
const need=(v,m='기록 내용을 확인해주세요.')=>{if(!v)throw new GameError(m);};
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const key=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(v);
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
function text(v,max,required=false){need(typeof v==='string'&&v.length<=max);const result=v.normalize('NFC').replace(/\r\n?/g,'\n').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,'').trim();need(!required||result.length>0);return result;}
function fields(data,kind){need(date(data.date));return {date:data.date,title:text(data.title,L.title,true),body:text(data.body,L.body,true),bookTitle:kind==='reading'?text(data.bookTitle??'',L.bookTitle,true):'',author:kind==='reading'?text(data.author??'',L.author):''};}
export function validateArchive(raw){
 if(raw===undefined)return {diary:[],reading:[]};
 need(raw&&typeof raw==='object'&&!Array.isArray(raw));const out={};
 for(const kind of ARCHIVE_KINDS){need(Array.isArray(raw[kind])&&raw[kind].length<=L.entriesPerKind);const ids=new Set(),requests=new Set();
  out[kind]=raw[kind].map(e=>{need(e&&e.kind===kind&&key(e.id)&&key(e.requestId)&&!ids.has(e.id)&&!requests.has(e.requestId)&&integer(e.revision)&&e.revision>=1&&integer(e.createdAt)&&integer(e.updatedAt)&&e.updatedAt>=e.createdAt);ids.add(e.id);requests.add(e.requestId);
   const content=fields(e,kind);for(const [k,v] of Object.entries(content))need(e[k]===v);
   let stamp=null;if(e.stamp!==null){need(e.stamp&&e.stamp.text==='참 잘했어요'&&integer(e.stamp.signedAt)&&e.stamp.signedAt>=e.createdAt);stamp={text:'참 잘했어요',teacherName:text(e.stamp.teacherName,100,true),signedAt:e.stamp.signedAt};}
   return {id:e.id,kind,requestId:e.requestId,revision:e.revision,...content,createdAt:e.createdAt,updatedAt:e.updatedAt,stamp};
  });
 }return out;
}
const view=e=>{const {requestId,...safe}=e;return structuredClone(safe);};
function entries(player,kind){need(ARCHIVE_KINDS.includes(kind));return player.starlightArchive?.[kind]??[];}
export function archiveRoster(room){const order=[...room.allowedNames];return [...room.players.values()].filter(p=>p.role==='student').map(p=>({id:p.id,number:order.indexOf(p.nickname)+1,nickname:p.nickname})).sort((a,b)=>a.number-b.number||a.nickname.localeCompare(b.nickname));}
function target(room,player,studentId){
 if(player.role==='student'){need(studentId===undefined||studentId===player.id,'본인의 기록만 볼 수 있어요.');return player;}
 need(player.role==='teacher','교실에 다시 입장해주세요.');const id=studentId??archiveRoster(room)[0]?.id;if(id===undefined)return null;
 const p=room.players.get(id);need(p?.role==='student','이 교실의 학생을 선택해주세요.');return p;
}
export function readArchive(room,player,data){
 need(ARCHIVE_KINDS.includes(data.kind));const page=data.page??0;need(integer(page)&&page<=100000);const p=target(room,player,data.studentId),list=p?entries(p,data.kind):[];
 return {kind:data.kind,studentId:p?.id??null,page,pageSize:L.pageSize,total:list.length,records:[...list].sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id)).slice(page*L.pageSize,(page+1)*L.pageSize).map(e=>{const {body,...summary}=view(e);return summary;}),...(player.role==='teacher'?{roster:archiveRoster(room)}:{})};
}
export function getArchive(room,player,data){const p=target(room,player,data.studentId),entry=p&&entries(p,data.kind).find(e=>e.id===data.id);need(entry,'기록을 찾을 수 없어요.');return {entry:view(entry)};}
export function saveArchive(player,data,now){
 need(player.role==='student','학생 본인이 기록을 작성할 수 있어요.');need(data.studentId===undefined||data.studentId===player.id,'본인의 기록만 쓸 수 있어요.');need(ARCHIVE_KINDS.includes(data.kind)&&(data.id!==undefined||key(data.requestId)));
 const state=validateArchive(player.starlightArchive),list=state[data.kind],content=fields(data,data.kind);let entry;
 if(data.id===undefined){entry=list.find(e=>e.requestId===data.requestId);if(entry)return {entry:view(entry)};need(list.length<L.entriesPerKind,'기록 보관함이 가득 찼어요. 선생님께 알려주세요. 기존 기록은 그대로 보관돼요.');entry={id:randomUUID(),kind:data.kind,requestId:data.requestId,revision:1,...content,createdAt:now,updatedAt:now,stamp:null};list.push(entry);}
 else{entry=list.find(e=>e.id===data.id);need(entry,'기록을 찾을 수 없어요.');need(data.revision===entry.revision,'다른 창에서 기록이 바뀌었어요. 다시 열어 확인해주세요.');if(Object.entries(content).some(([k,v])=>entry[k]!==v)){need(entry.revision<Number.MAX_SAFE_INTEGER);Object.assign(entry,content,{revision:entry.revision+1,updatedAt:now,stamp:null});}}
 player.starlightArchive=state;return {entry:view(entry)};
}
export function signArchive(room,player,data,now){
 need(player.role==='teacher','선생님만 싸인할 수 있어요.');const p=target(room,player,data.studentId);need(p,'학생을 선택해주세요.');const state=validateArchive(p.starlightArchive);need(ARCHIVE_KINDS.includes(data.kind));const e=state[data.kind].find(e=>e.id===data.id);need(e,'기록을 찾을 수 없어요.');need(data.revision===e.revision,'학생의 글이 바뀌었어요. 다시 읽은 뒤 싸인해주세요.');
 if(!e.stamp){need(e.revision<Number.MAX_SAFE_INTEGER);e.stamp={text:'참 잘했어요',teacherName:text(player.nickname,100,true),signedAt:now};e.revision++;}p.starlightArchive=state;return {entry:view(e)};
}
export function registerStarlightArchive({socket,action,store,clock=Date.now}){
 const access=()=>{const {room,player}=socket.data.session||{};need(socket.connected&&player?.connected&&!player.away&&player.socketId===socket.id&&['teacher','student'].includes(player.role)&&store.rooms.get(room?.code)===room&&room?.players.get(player.id)===player,'현재 접속에서 교실에 다시 입장해주세요.');const prop=MAP.objects.find(o=>o.kind==='starlight-archive');need(player.mapId===MAP.id&&prop&&isNear(player,prop),'별빛 기록소 가까이에서 이용해주세요.');need(!isDefeated(player),'체력을 회복한 뒤 이용해주세요.');return {room,player};};
 action('archive:read',data=>{const {room,player}=access();return readArchive(room,player,data);},false);
 action('archive:get',data=>{const {room,player}=access();return getArchive(room,player,data);},false);
 action('archive:save',data=>saveArchive(access().player,data,clock()));
 action('archive:sign',data=>{const {room,player}=access();return signArchive(room,player,data,clock());});
}
