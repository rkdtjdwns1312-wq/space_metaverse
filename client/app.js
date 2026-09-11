import { createWorld } from './world.js';
const $=id=>document.getElementById(id),world=createWorld($('world'));
const socket=window.io({autoConnect:false,reconnectionDelay:500,reconnectionDelayMax:2000});
let selfId=null,room=null,busy=false,toastTimer,mode='student',held=new Set(),touch={x:0,y:0},last={x:0,y:0},chatBusy=false;
let sessionToken=null;
try{sessionToken=sessionStorage.getItem('space-session');}catch{}
const saveToken=token=>{sessionToken=token;try{token?sessionStorage.setItem('space-session',token):sessionStorage.removeItem('space-session');}catch{}};
const TEACHER_KEY_STORAGE='space-teacher-key';
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function setMode(value){
  mode=value;$('student-form').hidden=value!=='student';$('teacher-form').hidden=value!=='teacher';
  for(const role of ['student','teacher']){$(role+'-tab').classList.toggle('selected',role===value);$(role+'-tab').setAttribute('aria-pressed',String(role===value));}
  $('form-message').textContent='';
}
$('student-tab').onclick=()=>setMode('student');$('teacher-tab').onclick=()=>setMode('teacher');
$('allowed-names').value=Array.from({length:29},(_,i)=>String(i+1)).join(', ');
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.has('teacher')){
  const key=fragment.get('teacher');$('teacher-key').value=key;setMode('teacher');history.replaceState(null,'',location.pathname);
  try{sessionStorage.setItem(TEACHER_KEY_STORAGE,key);}catch{}
}else{
  let savedKey=null;try{savedKey=sessionStorage.getItem(TEACHER_KEY_STORAGE);}catch{}
  if(savedKey){$('teacher-key').value=savedKey;setMode('teacher');}
}
function controls(){for(const b of document.querySelectorAll('.submit'))b.disabled=busy||!socket.connected;}
async function request(event,data){
  if(!socket.connected)throw new Error('연결을 기다리고 있어요. 잠시 후 다시 시도해주세요.');
  const reply=await socket.timeout(6000).emitWithAck(event,data);
  if(!reply.ok)throw new Error(reply.error);
  return reply;
}
function updateRoom(value){
  room=value;world.setRoom(room,selfId);
  $('room-title').textContent=room.title;$('room-code').textContent=room.code;
  $('player-count').textContent=room.players.filter(p=>p.connected).length+' / '+room.maxPlayers;
  $('crew-empty').hidden=room.players.length>0;
  const me=room.players.find(p=>p.id===selfId);
  const isTeacher=me?.role==='teacher';
  $('players').replaceChildren(...room.players.map(p=>{
    const li=document.createElement('li');li.classList.toggle('mine',p.id===selfId);
    const name=document.createElement('span');name.textContent=p.nickname+(p.id===selfId?' · 나':'');
    const state=document.createElement('span');state.textContent=!p.connected?'다시 연결 중':p.role==='teacher'?'선생님':p.muted?'채팅 멈춤':'LV 1';
    li.append(name,state);
    if(isTeacher&&p.role!=='teacher'){
      const mute=document.createElement('button');mute.type='button';mute.className='small secondary mute';mute.dataset.playerId=p.id;
      mute.textContent=p.muted?'허용':'금지';mute.setAttribute('aria-label',(p.muted?'채팅 허용: ':'채팅 금지: ')+p.nickname);
      mute.onclick=async()=>{try{await request('chat:mute',{playerId:p.id,muted:!p.muted});}catch(e){toast(e.message);}};
      li.append(mute);
    }
    return li;
  }));
  $('self-name').textContent=me?.nickname||'나의 소행성';
  $('self-description').textContent=me?.role==='teacher'?'친구들에게 교실 코드를 알려주세요. 학생들은 허용한 번호나 닉네임으로 들어올 수 있어요.':'방향키로 움직여보세요. 이름 옆에 ‘나’라고 표시된 소행성이 바로 나예요.';
  $('leave').textContent=me?.role==='teacher'?'교실 종료하기':'교실 나가기';
  if(!room.players.some(p=>p.role==='teacher'&&p.connected))$('connection').textContent='선생님 연결 대기 · 잠시 이동을 멈춰요';
  updateChatUI(me,isTeacher);
}
function updateChatUI(me,isTeacher){
  const enabled=room.chat?.enabled!==false;
  $('chat-teacher-controls').hidden=!isTeacher;
  $('chat-toggle').textContent=enabled?'채팅 끄기':'채팅 켜기';
  if(isTeacher){
    $('chat-input').disabled=false;$('chat-input').placeholder='친구들에게 말해요 (Enter)';$('chat-status').textContent=enabled?'켜짐':'꺼짐 · 선생님만 말할 수 있어요';
  }else if(!enabled){
    $('chat-input').disabled=true;$('chat-input').placeholder='선생님이 채팅을 껐어요';$('chat-status').textContent='꺼짐';
  }else if(me?.muted){
    $('chat-input').disabled=true;$('chat-input').placeholder='선생님이 내 채팅을 잠시 멈췄어요';$('chat-status').textContent='내 채팅 멈춤';
  }else{
    $('chat-input').disabled=false;$('chat-input').placeholder='친구들에게 말해요 (Enter)';$('chat-status').textContent='켜짐';
  }
  $('chat-send').disabled=chatBusy||$('chat-input').disabled;
}
const fmtTime=ms=>{const d=new Date(ms);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
function addChatMessage(msg){
  $('chat-empty').hidden=true;
  const li=document.createElement('li');
  if(msg.role==='system')li.classList.add('system');
  if(msg.playerId===selfId&&msg.role!=='system')li.classList.add('mine');
  if(msg.flagged)li.classList.add('flagged');
  const who=document.createElement('span');who.className='who';
  who.textContent=msg.role==='system'?'안내':msg.role==='teacher'?'선생님':msg.nickname;
  const text=document.createElement('span');text.className='text';text.textContent=msg.text;
  const time=document.createElement('span');time.className='time';time.textContent=fmtTime(msg.at);
  li.append(who,text,time);
  if(msg.flagged){const badge=document.createElement('span');badge.className='badge';badge.textContent='순화됨';li.append(badge);}
  $('chat-log').append(li);
  while($('chat-log').children.length>200)$('chat-log').firstElementChild.remove();
  $('chat-log').scrollTop=$('chat-log').scrollHeight;
}
function clearChat(){$('chat-log').replaceChildren();$('chat-empty').hidden=false;}
function enter(result){
  selfId=result.selfId;saveToken(result.token);updateRoom(result.room);$('lobby').hidden=true;
  $('room-badge').hidden=false;$('leave').hidden=false;$('touch-controls').hidden=false;$('chat-panel').hidden=false;
  clearChat();for(const msg of result.chat?.messages||[])addChatMessage(msg);
  document.body.classList.add('joined');$('world').focus();$('form-message').textContent='';
}
function reset(message){
  stop();selfId=null;room=null;saveToken(null);world.setRoom(null,null);
  $('lobby').hidden=false;$('room-badge').hidden=true;$('leave').hidden=true;$('touch-controls').hidden=true;$('chat-panel').hidden=true;
  $('players').replaceChildren();$('player-count').textContent='0 / 30';$('crew-empty').hidden=false;
  clearChat();$('chat-input').value='';$('chat-input').disabled=false;$('chat-input').placeholder='친구들에게 말해요 (Enter)';
  $('room-title').textContent='우리들의 우주 광장';$('self-name').textContent='나의 소행성';
  $('self-description').textContent='모두 같은 LV 1 소행성으로 다시 출발해요.';
  document.body.classList.remove('joined');$('form-message').textContent=message||'';
  if($('leave-dialog').open)$('leave-dialog').close();
}
async function submit(event,handler){
  event.preventDefault();if(busy)return;busy=true;controls();$('form-message').textContent='';
  try{enter(await handler());}catch(e){$('form-message').textContent=e.message==='operation has timed out'?'응답이 늦어지고 있어요. 연결 상태를 확인해주세요.':e.message;}
  finally{busy=false;controls();}
}
$('student-form').onsubmit=e=>submit(e,()=>request('room:join',{code:$('join-code').value,nickname:$('nickname').value}));
$('teacher-form').onsubmit=e=>submit(e,()=>request('room:create',{teacherKey:$('teacher-key').value,title:$('class-title').value,allowedNames:$('allowed-names').value.split(/[,\n]/).map(s=>s.trim()).filter(Boolean)}));
socket.on('connect',async()=>{
  $('connection').textContent='우주와 연결되었어요';controls();
  if(sessionToken){busy=true;controls();try{enter(await request('session:resume',{token:sessionToken}));}
    catch(e){reset(e.message);}finally{busy=false;controls();}}
});
socket.on('connect_error',()=>{$('connection').textContent='서버 연결을 기다리는 중…';controls();});
socket.on('disconnect',()=>{held.clear();touch={x:0,y:0};$('connection').textContent='다시 연결 중… 60초 안에 돌아올 수 있어요';controls();});
socket.on('room:state',data=>{if(selfId)updateRoom(data);});
socket.on('world:positions',data=>{if(selfId)world.positions(data);});
socket.on('room:closed',data=>reset(data.message));
socket.on('chat:message',msg=>{if(!selfId)return;addChatMessage(msg);world.say(msg.playerId,msg.text);});
socket.on('chat:cleared',()=>{if(selfId)clearChat();});
$('chat-form').onsubmit=async e=>{
  e.preventDefault();const text=$('chat-input').value.trim();if(!text||chatBusy)return;
  chatBusy=true;$('chat-send').disabled=true;
  try{await request('chat:send',{text});$('chat-input').value='';}
  catch(err){toast(err.message);}
  finally{chatBusy=false;$('chat-send').disabled=$('chat-input').disabled;$('chat-input').focus();}
};
$('chat-toggle').onclick=async()=>{
  const enabled=room?.chat?.enabled!==false;
  try{await request('chat:setEnabled',{enabled:!enabled});}catch(e){toast(e.message);}
};
$('chat-clear').onclick=async()=>{try{await request('chat:clear',{});}catch(e){toast(e.message);}};
$('world').addEventListener('keydown',e=>{if(e.code==='Enter'){e.preventDefault();$('chat-input').focus();}});
$('chat-input').addEventListener('keydown',e=>{if(e.code==='Escape'){$('chat-input').blur();$('world').focus();}});
$('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);toast('교실 코드를 복사했어요.');}catch{toast('화면의 교실 코드 '+room.code+'를 알려주세요.');}};
$('leave').onclick=()=>{
  stop();const teacher=room?.players.find(p=>p.id===selfId)?.role==='teacher';
  $('leave-title').textContent=teacher?'모두의 교실을 종료할까요?':'교실에서 나갈까요?';
  $('leave-description').textContent=teacher?'모든 친구들이 나가게 되고, 이 교실 코드는 사용할 수 없어요.':'다시 교실 코드로 입장할 수 있어요.';
  $('leave-dialog').showModal();
};
$('stay').onclick=()=>{$('leave-dialog').close();$('world').focus();};
$('confirm-leave').onclick=async()=>{
  try{await request('room:leave',{});reset('다음 여행에서 또 만나요.');}
  catch(e){toast(e.message);}finally{$('leave-dialog').close();}
};
const keys={ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1],ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0]};
function input(){
  if(!selfId||!socket.connected)return;
  let x=touch.x,y=touch.y;for(const code of held){x+=keys[code][0];y+=keys[code][1];}
  x=Math.sign(x);y=Math.sign(y);
  if(x||y||last.x||last.y)socket.volatile.emit('player:input',{x,y});
  last={x,y};
}
function stop(){held.clear();touch={x:0,y:0};input();}
window.addEventListener('keydown',e=>{
  if(!selfId||!keys[e.code]||e.ctrlKey||e.metaKey||e.altKey||$('leave-dialog').open||['INPUT','TEXTAREA','BUTTON'].includes(e.target.tagName))return;
  e.preventDefault();held.add(e.code);input();
});
window.addEventListener('keyup',e=>{if(keys[e.code]){held.delete(e.code);input();}});
window.addEventListener('blur',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
$('world').addEventListener('click',()=>$('world').focus());
for(const button of document.querySelectorAll('[data-dx]')){
  button.addEventListener('pointerdown',e=>{e.preventDefault();touch={x:Number(button.dataset.dx),y:Number(button.dataset.dy)};input();try{button.setPointerCapture(e.pointerId);}catch{}});
  for(const type of ['pointerup','pointercancel','lostpointercapture','pointerleave'])button.addEventListener(type,()=>{touch={x:0,y:0};input();});
  button.addEventListener('contextmenu',e=>e.preventDefault());
}
setInterval(input,80);controls();socket.connect();
