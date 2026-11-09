import {randomUUID} from 'node:crypto';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {ART_LIMITS as L,ART_TEACHER_OWNER,normalizeArtDrawing} from '../shared/art-studio.js';
import {STAR_STATION} from '../shared/config.js';
import {GameError} from './pin-auth.js';
import {isNear} from './world.js';
import {isDefeated} from './vitals.js';
import {chargeHuntingStation} from './hunting-time.js';
const need=(v,m='작품 내용을 확인해주세요.')=>{if(!v)throw new GameError(m);};
const key=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
function titleOf(value){need(typeof value==='string'&&value.length<=L.title);const title=value.normalize('NFC').replace(/[\x00-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,'').trim();need(title.length>0,'작품 제목을 적어주세요.');return title;}
// Keep only compact payloads in runtime/transaction snapshots. Untrusted disk records
// are fully decoded at startup; ordinary saves validate the already trusted envelope.
const encodedEnvelope=(d,trusted=false)=>d&&typeof d==='object'&&!Array.isArray(d)&&Object.keys(d).length===2&&d.encoding==='deflate-json-v1'&&typeof d.data==='string'&&d.data.length>0&&d.data.length<=Math.ceil((L.bytes+1024)/3)*4&&(trusted||/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(d.data));
const encodeDrawing=drawing=>({encoding:'deflate-json-v1',data:deflateRawSync(Buffer.from(JSON.stringify(drawing)),{level:6}).toString('base64')});
function decodeDrawing(encoded){
 need(encodedEnvelope(encoded));let drawing;
 try{drawing=normalizeArtDrawing(JSON.parse(inflateRawSync(Buffer.from(encoded.data,'base64'),{maxOutputLength:L.bytes}).toString('utf8')));}catch{need(false,'저장된 그림 내용을 확인해주세요.');}
 need(drawing,'저장된 그림 내용을 확인해주세요.');return drawing;
}
function storedDrawing(raw,trustedCompact){
 if(encodedEnvelope(raw,trustedCompact)){if(!trustedCompact)decodeDrawing(raw);return {encoding:raw.encoding,data:raw.data};}
 const drawing=normalizeArtDrawing(raw);need(drawing);return encodeDrawing(drawing);
}
export function validateArtStudio(raw,{trustedCompact=false}={}){
 if(raw===undefined)return [];
 need(Array.isArray(raw)&&raw.length<=L.works);const ids=new Set(),requests=new Set();
 return raw.map(w=>{need(w&&key(w.id)&&key(w.requestId)&&!ids.has(w.id)&&!requests.has(w.requestId)&&integer(w.revision)&&w.revision>=1&&integer(w.createdAt)&&integer(w.updatedAt)&&w.updatedAt>=w.createdAt);const title=titleOf(w.title),drawing=storedDrawing(w.drawing,trustedCompact);need(title===w.title&&drawing);ids.add(w.id);requests.add(w.requestId);return {id:w.id,requestId:w.requestId,revision:w.revision,title,drawing,createdAt:w.createdAt,updatedAt:w.updatedAt};});
}
const works=p=>p.artStudio??[];
const metadata=w=>({id:w.id,title:w.title,revision:w.revision,createdAt:w.createdAt,updatedAt:w.updatedAt});
const view=w=>({...metadata(w),drawing:decodeDrawing(w.drawing)});
const ownId=player=>player.role==='teacher'?ART_TEACHER_OWNER:player.id;
const roster=room=>[...[...room.players.values()].filter(p=>p.role==='student').map(p=>({id:p.id,nickname:p.nickname,count:works(p).length})),{id:ART_TEACHER_OWNER,nickname:'선생님',count:(room.teacherArtStudio??[]).length}];
function owner(room,player,id){
 need(['student','teacher'].includes(player.role),'교실에 다시 입장해주세요.');
 const selected=id===undefined?ownId(player):id;if(selected===null)return null;
 if(selected===ART_TEACHER_OWNER)return {id:ART_TEACHER_OWNER,artStudio:room.teacherArtStudio??[]};
 const p=room.players.get(selected);need(p?.role==='student','이 교실의 작품을 선택해주세요.');return p;
}
export function listArt(room,player,data={}){
 const people=roster(room),id=data.ownerId===undefined&&data.view==='friends'?(people.find(p=>p.id!==ownId(player))?.id??null):data.ownerId,p=owner(room,player,id);
 return {ownerId:p?.id??null,canEdit:p?.id===ownId(player),total:p?works(p).length:0,works:p?[...works(p)].sort((a,b)=>b.updatedAt-a.updatedAt).map(metadata):[],roster:people};
}
export function getArt(room,player,data){const p=owner(room,player,data.ownerId),work=p&&works(p).find(w=>w.id===data.id);need(work,'작품을 찾을 수 없어요.');return {ownerId:p.id,canEdit:p.id===ownId(player),work:view(work)};}
function writable(player,data,room){
 need(['student','teacher'].includes(player.role),'본인만 작품을 저장하거나 삭제할 수 있어요.');
 need(data.ownerId===undefined||data.ownerId===ownId(player),'본인의 작품만 수정하거나 삭제할 수 있어요.');
 if(player.role==='teacher'){need(room?.players.get(player.id)===player,'현재 교실의 선생님만 작품을 저장할 수 있어요.');return {target:room,field:'teacherArtStudio'};}
 return {target:player,field:'artStudio'};
}
export function saveArt(player,data,now,room){
 const {target,field}=writable(player,data,room);
 const list=validateArtStudio(target[field],{trustedCompact:true}),title=titleOf(data.title),drawing=normalizeArtDrawing(data.drawing);need(drawing,'그림이 너무 복잡하거나 올바르지 않아요. 되돌리기 후 다시 저장해주세요.');const compact=encodeDrawing(drawing);let work;
 let drawingChanged=true;
 if(data.id===undefined){
  need(key(data.requestId));work=list.find(w=>w.requestId===data.requestId);
  if(work)return {work:view(work),replayed:true,huntingRewardMs:0};
  need(list.length<L.works,'작품은 10개까지 보관해요. 기존 작품을 수정하거나 하나를 삭제해주세요.');
  work={id:randomUUID(),requestId:data.requestId,revision:1,title,drawing:compact,createdAt:now,updatedAt:now};list.push(work);
 }else{
  need(key(data.id));work=list.find(w=>w.id===data.id);need(work,'본인의 작품을 선택해주세요.');
  need(data.revision===work.revision,'다른 창에서 작품이 바뀌었어요. 다시 불러온 뒤 수정해주세요.');
  drawingChanged=work.drawing.data!==compact.data&&JSON.stringify(decodeDrawing(work.drawing))!==JSON.stringify(drawing);
  if(work.title!==title||drawingChanged){need(work.revision<Number.MAX_SAFE_INTEGER);Object.assign(work,{title,drawing:compact,revision:work.revision+1,updatedAt:now});}
 }
 target[field]=list;
 const hasInk=drawing.strokes.some(stroke=>stroke.tool!=='eraser'&&stroke.color!==drawing.background);
 const huntingRewardMs=drawingChanged&&hasInk?chargeHuntingStation(player,'art',now):0;
 return {work:view(work),huntingRewardMs};
}
export function deleteArt(player,data,room){
 const {target,field}=writable(player,data,room);const list=validateArtStudio(target[field],{trustedCompact:true}),index=list.findIndex(w=>w.id===data.id);need(index>=0,'본인의 작품을 선택해주세요.');need(data.revision===list[index].revision,'다른 창에서 작품이 바뀌었어요. 다시 불러온 뒤 삭제해주세요.');list.splice(index,1);target[field]=list;return {id:data.id};
}
export function registerArtStudio({socket,action,store,clock=Date.now}){
 const access=()=>{const {room,player}=socket.data.session||{};need(socket.connected&&player?.connected&&!player.away&&player.socketId===socket.id&&['teacher','student'].includes(player.role)&&store.rooms.get(room?.code)===room&&room?.players.get(player.id)===player,'현재 접속에서 교실에 다시 입장해주세요.');const prop=STAR_STATION.objects.find(o=>o.kind==='art-station');need(player.mapId===STAR_STATION.id&&prop&&isNear(player,prop),'별 예술 발전소 가까이에서 이용해주세요.');need(!isDefeated(player),'체력을 회복한 뒤 이용해주세요.');return {room,player};};
 action('art:list',data=>{const {room,player}=access();return listArt(room,player,data);},false);
 action('art:get',data=>{const {room,player}=access();return getArt(room,player,data);},false);
 action('art:save',data=>{const {room,player}=access();return saveArt(player,data,clock(),room);});
 action('art:delete',data=>{const {room,player}=access();return deleteArt(player,data,room);});
}
