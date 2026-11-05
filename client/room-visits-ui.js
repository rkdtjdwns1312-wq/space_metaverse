import {renderVisitedScene} from './room-decor-ui.js';
const element=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
function button(text,click){const b=element('button',text,'cozy-btn');b.type='button';b.onclick=click;return b;}

export function createRoomVisits({dialog,panel,getState,getCatalog,getPlayer,request,draw,status,isBusy,onSwitch}){
 const nav=element('nav',undefined,'room-modes');
 nav.setAttribute('aria-label','별방 선택');dialog.querySelector('.cozy-hero').append(nav);
 let mode='mine',rooms=null,visit=null,version=0,writing=false,posting=false,draft='';
 const mine=button('내 방 꾸미기',()=>switchMode('mine')),friends=button('친구방 구경하기',()=>switchMode('friends'));
 nav.append(mine,friends);
 function header(){
  nav.hidden=dialog.dataset.activity!=='room';
  for(const [b,selected] of [[mine,mode==='mine'],[friends,mode==='friends']]){
   b.setAttribute('aria-pressed',String(selected));b.disabled=!getState()||posting;
  }
 }
 function reset(){version++;mode='mine';rooms=null;visit=null;writing=false;posting=false;draft='';}
 async function switchMode(next){
  if(isBusy()||posting||!getState())return;
  if(next==='mine'&&mode==='mine')return;
  if(draft.trim()&&!window.confirm('작성 중인 메모를 지우고 이동할까요?'))return;
  onSwitch();const tag=++version;mode=next;visit=null;rooms=null;writing=false;draft='';status('');draw();
  try{
   if(next==='mine'){
    if(!getState().saved||getPlayer()?.role!=='student')return;
    const data=await request('cozy:room-visit',{id:getPlayer().id});if(tag!==version)return;
    getState().guestbook=data.guestbook;
   }else{
    const data=await request('cozy:room-list',{});if(tag!==version)return;rooms=data.rooms;
   }
   draw();
  }catch(e){if(tag===version)status(e.message);}
 }
 async function openVisit(id){
  const tag=++version;status('별방을 불러오고 있어요…');
  try{const data=await request('cozy:room-visit',{id});if(tag!==version)return;visit=data;writing=false;draft='';status('');draw();}
  catch(e){if(tag===version)status(e.message);}
 }
 async function changeBook(event,payload){
  if(posting||isBusy())return;
  const tag=version;posting=true;status('방명록을 저장하고 있어요…');draw();
  try{
   const data=await request(event,payload);if(tag!==version)return;
   if(mode==='mine')getState().guestbook=data.guestbook;else visit=data;
   if(!data.stale){writing=false;draft='';}
   status(data.stale?'방명록이 바뀌었어요. 최신 메모를 확인하고 다시 저장해주세요.':'');
  }catch(e){if(tag===version)status(e.message);}
  finally{if(tag===version){posting=false;draw();}}
 }
 function guestbook(book,canDelete,id){
  const section=element('section',undefined,'room-guestbook');section.append(element('h4','방명록'));
  const entries=book?.notes||[];
  if(!entries.length)section.append(element('p','아직 남겨진 메모가 없어요.'));
  for(const note of [...entries].reverse()){
   const row=element('div',undefined,'room-note');row.append(element('b',note.nickname),element('span',note.text));
   if(canDelete){const remove=button('삭제',()=>{if(confirm('이 메모를 삭제할까요?'))changeBook('cozy:room-note-delete',{id,noteId:note.id});});
    remove.disabled=posting;remove.setAttribute('aria-label',note.nickname+'의 메모 삭제');row.append(remove);}
   section.append(row);
  }
  return section;
 }
 function render(){
  header();
  if(mode==='mine'){
   const state=getState();
   if(state.saved&&getPlayer()?.role==='student')panel.append(guestbook(state.guestbook,true,getPlayer().id));
   return;
  }
  panel.replaceChildren();const wrapper=element('section',undefined,'room-visit');panel.append(wrapper);
  if(!visit){
   wrapper.append(element('h4','친구들의 별방'));
   if(!rooms?.length){wrapper.append(element('p',rooms?'아직 별방을 저장한 친구가 없어요.':'별방 목록을 불러오고 있어요…'));return;}
   const list=element('div',undefined,'room-friend-list');
   for(const room of rooms)list.append(button(room.nickname+'의 별방',()=>openVisit(room.id)));
   wrapper.append(list);return;
  }
  const heading=element('div',undefined,'room-visit-heading');heading.append(element('h4',visit.nickname+'의 별방'),button('목록으로',()=>switchMode('friends')));wrapper.append(heading);
  wrapper.append(renderVisitedScene(visit,getCatalog()),guestbook(visit.guestbook,visit.canDelete,visit.id));
  const actions=element('div',undefined,'room-note-actions');wrapper.append(actions);
  if(!writing){
   actions.append(button('메모 남기기',()=>{writing=true;draw();panel.querySelector('.room-note-input')?.focus();}));return;
  }
  const input=element('input',undefined,'room-note-input');input.placeholder='친구에게 남길 한 줄 메모';input.setAttribute('aria-label','방명록 메모 (100자까지)');input.value=draft;input.disabled=posting;
  const save=button('메모 저장',()=>changeBook('cozy:room-note',{id:visit.id,text:draft,revision:visit.guestbook.revision}));
  const cancel=button('취소',()=>{writing=false;draft='';draw();});cancel.disabled=posting;
  const update=()=>{draft=input.value;save.disabled=posting||!draft.trim()||[...draft].length>100;};update();input.oninput=update;
  input.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing&&!save.disabled){e.preventDefault();save.click();}};
  actions.append(input,cancel,save);
 }
 return {header,reset,render,isMine:()=>mode==='mine',hasDraft:()=>!!draft.trim(),isPosting:()=>posting};
}
