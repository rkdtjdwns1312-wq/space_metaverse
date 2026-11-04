import {randomUUID} from 'node:crypto';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {ART_LIMITS as L,normalizeArtDrawing} from '../shared/art-studio.js';
import {STREET} from '../shared/config.js';
import {GameError} from './pin-auth.js';
import {isNear} from './world.js';
import {isDefeated} from './vitals.js';
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
function owner(room,player,id){
 need(['student','teacher'].includes(player.role),'교실에 다시 입장해주세요.');
 const selected=id??(player.role==='student'?player.id:[...room.players.values()].find(p=>p.role==='student')?.id);
 if(selected===undefined)return null;
 const p=room.players.get(selected);need(p?.role==='student','이 교실의 친구를 선택해주세요.');return p;
}
export function listArt(room,player,data={}){
 const p=owner(room,player,data.ownerId);
 return {ownerId:p?.id??null,canEdit:player.role==='student'&&p?.id===player.id,total:p?works(p).length:0,works:p?[...works(p)].sort((a,b)=>b.updatedAt-a.updatedAt).map(metadata):[],roster:[...room.players.values()].filter(p=>p.role==='student').map(p=>({id:p.id,nickname:p.nickname,count:works(p).length}))};
}
export function getArt(room,player,data){const p=owner(room,player,data.ownerId),work=p&&works(p).find(w=>w.id===data.id);need(work,'작품을 찾을 수 없어요.');return {ownerId:p.id,canEdit:p.id===player.id&&player.role==='student',work:view(work)};}
export function saveArt(player,data,now){
 need(player.role==='student','학생 본인만 작품을 저장할 수 있어요.');need(data.ownerId===undefined||data.ownerId===player.id,'본인의 작품만 수정할 수 있어요.');
 const list=validateArtStudio(player.artStudio,{trustedCompact:true}),title=titleOf(data.title),drawing=normalizeArtDrawing(data.drawing);need(drawing,'그림이 너무 복잡하거나 올바르지 않아요. 되돌리기 후 다시 저장해주세요.');const compact=encodeDrawing(drawing);let work;
 if(data.id===undefined){need(key(data.requestId));work=list.find(w=>w.requestId===data.requestId);if(work)return {work:view(work),replayed:true};need(list.length<L.works,'작품은 10개까지 보관해요. 기존 작품을 수정하거나 하나를 삭제해주세요.');work={id:randomUUID(),requestId:data.requestId,revision:1,title,drawing:compact,createdAt:now,updatedAt:now};list.push(work);}
 else{need(key(data.id));work=list.find(w=>w.id===data.id);need(work,'본인의 작품을 선택해주세요.');need(data.revision===work.revision,'다른 창에서 작품이 바뀌었어요. 다시 불러온 뒤 수정해주세요.');if(work.title!==title||JSON.stringify(work.drawing)!==JSON.stringify(compact)){need(work.revision<Number.MAX_SAFE_INTEGER);Object.assign(work,{title,drawing:compact,revision:work.revision+1,updatedAt:now});}}
 player.artStudio=list;return {work:view(work)};
}
export function deleteArt(player,data){
 need(player.role==='student','학생 본인만 작품을 삭제할 수 있어요.');need(data.ownerId===undefined||data.ownerId===player.id,'본인의 작품만 삭제할 수 있어요.');const list=validateArtStudio(player.artStudio,{trustedCompact:true}),index=list.findIndex(w=>w.id===data.id);need(index>=0,'본인의 작품을 선택해주세요.');need(data.revision===list[index].revision,'다른 창에서 작품이 바뀌었어요. 다시 불러온 뒤 삭제해주세요.');list.splice(index,1);player.artStudio=list;return {id:data.id};
}
export function registerArtStudio({socket,action,store,clock=Date.now}){
 const access=()=>{const {room,player}=socket.data.session||{};need(socket.connected&&player?.connected&&!player.away&&player.socketId===socket.id&&['teacher','student'].includes(player.role)&&store.rooms.get(room?.code)===room&&room?.players.get(player.id)===player,'현재 접속에서 교실에 다시 입장해주세요.');const prop=STREET.objects.find(o=>o.kind==='art-station');need(player.mapId===STREET.id&&prop&&isNear(player,prop),'별 예술 발전소 가까이에서 이용해주세요.');need(!isDefeated(player),'체력을 회복한 뒤 이용해주세요.');return {room,player};};
 action('art:list',data=>{const {room,player}=access();return listArt(room,player,data);},false);
 action('art:get',data=>{const {room,player}=access();return getArt(room,player,data);},false);
 action('art:save',data=>saveArt(access().player,data,clock()));
 action('art:delete',data=>deleteArt(access().player,data));
}
