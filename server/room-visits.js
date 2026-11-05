import {GameError} from './pin-auth.js';
import {filterChat} from './chat-filter.js';

const limit=30;
const requireValue=(ok,message='별방 방명록을 확인해주세요.')=>{if(!ok)throw new GameError(message);};
const natural=n=>Number.isSafeInteger(n)&&n>=0;
const validText=value=>typeof value==='string'&&value.length>0&&[...value].length<=100&&!/[\p{Cc}\p{Cf}]/u.test(value);

export function validateGuestbook(raw){
 if(raw===undefined)return {revision:0,notes:[]};
 requireValue(raw&&natural(raw.revision)&&Array.isArray(raw.notes)&&raw.notes.length<=limit);
 let last=0;
 const notes=raw.notes.map(note=>{
  requireValue(note&&natural(note.id)&&note.id>last&&note.id<=raw.revision&&validText(note.nickname)&&validText(note.text)&&typeof note.authorId==='string'&&note.authorId.length<=128&&note.authorId.length>0);
  last=note.id;
  return {id:last,authorId:note.authorId,nickname:note.nickname,text:note.text};
 });
 return {revision:raw.revision,notes};
}

export function registerRoomVisits({action,access}){
 const saved=p=>p?.role==='student'&&p.cozyActivities?.room&&(p.cozyActivities.room.saved??(p.cozyActivities.room.layout.length>0||p.cozyActivities.room.theme!=='moon'||p.cozyActivities.room.rewarded));
 function target(id){
  const {room,player}=access('room'),owner=room.players.get(id);
  requireValue(saved(owner),'이 교실에서 저장한 별방을 다시 골라주세요.');
  return {room,player,owner,state:owner.cozyActivities.room};
 }
 function detail({owner,player,state}){
  const book=validateGuestbook(state.guestbook);
  return {id:owner.id,nickname:owner.nickname,theme:state.theme,layout:state.layout,
   guestbook:{revision:book.revision,notes:book.notes.map(({id,nickname,text})=>({id,nickname,text}))},
   canDelete:player===owner||player.role==='teacher'};
 }
 action('cozy:room-list',()=>{
  const {room,player}=access('room');
  return {rooms:[...room.players.values()].filter(p=>p!==player&&saved(p)).map(p=>({id:p.id,nickname:p.nickname})).sort((a,b)=>a.nickname.localeCompare(b.nickname,'ko',{numeric:true}))};
 },false);
 action('cozy:room-visit',data=>detail(target(data.id)),false);
 action('cozy:room-note',data=>{
  const visit=target(data.id),{room,player,owner,state}=visit;
  requireValue(owner!==player,'친구 별방에서 메모를 남겨주세요.');
  requireValue(!player.muted&&(player.role==='teacher'||room.chat.enabled),'지금은 메모를 남길 수 없어요.');
  const raw=typeof data.text==='string'?data.text.normalize('NFKC').replace(/\p{Cf}/gu,'').trim():'';
  requireValue(validText(raw),'메모는 한 줄로 1~100자까지 적어주세요.');
  const {text}=filterChat(raw.replace(/ {2,}/g,' ')),book=validateGuestbook(state.guestbook);
  requireValue(natural(data.revision),'방명록을 다시 열어주세요.');
  if(data.revision!==book.revision){
   const duplicate=book.notes.some(n=>n.id===data.revision+1&&n.authorId===player.id&&n.text===text);
   return {...detail(visit),stale:!duplicate};
  }
  requireValue(natural(book.revision+1));
  book.notes.push({id:++book.revision,authorId:player.id,nickname:player.nickname,text});
  book.notes=book.notes.slice(-limit);state.guestbook=book;
  return detail(visit);
 });
 action('cozy:room-note-delete',data=>{
  const visit=target(data.id),{player,owner,state}=visit;
  requireValue(player===owner||player.role==='teacher','방 주인이나 선생님만 메모를 삭제할 수 있어요.');
  const book=validateGuestbook(state.guestbook);
  requireValue(natural(data.noteId)&&data.noteId>0&&data.noteId<=book.revision);
  if(book.notes.some(n=>n.id===data.noteId)){
   requireValue(natural(book.revision+1));book.revision++;book.notes=book.notes.filter(n=>n.id!==data.noteId);state.guestbook=book;
  }
  return detail(visit);
 });
}
