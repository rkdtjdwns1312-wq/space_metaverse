import { createWorld } from './world.js';
import { PLAZA_ID, PLANET, PLANET_COLORS, planetIdOfMap, interiorIdOf } from '/shared/config.js';
const $=id=>document.getElementById(id),world=createWorld($('world'));
const socket=window.io({autoConnect:false,reconnectionDelay:500,reconnectionDelayMax:2000});
let selfId=null,room=null,busy=false,toastTimer,mode='student',held=new Set(),touch={x:0,y:0},last={x:0,y:0},chatBusy=false,planetDialogId=null,placing=false,createPoint=null;
const planetById=id=>room?.planets.find(p=>p.id===id)||null;
$('planet-colors').append(...PLANET_COLORS.map((color,i)=>{
  const label=document.createElement('label');label.className='swatch';
  const input=document.createElement('input');input.type='radio';input.name='planet-color';input.value=color;if(i===0)input.checked=true;
  const span=document.createElement('span');span.style.background=color;
  label.append(input,span);return label;
}));
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
  const myMapId=me?.mapId||PLAZA_ID,inInterior=myMapId!==PLAZA_ID;
  $('players').replaceChildren(...room.players.map(p=>{
    const li=document.createElement('li');li.classList.toggle('mine',p.id===selfId);
    const name=document.createElement('span');name.textContent=p.nickname+(p.id===selfId?' · 나':'');
    if(p.departmentId){const dept=document.createElement('span');dept.className='dept';dept.textContent=(planetById(p.departmentId)?.name||'').slice(0,2);name.append(dept);}
    const insideId=planetIdOfMap(p.mapId),inside=insideId?planetById(insideId):null;
    const state=document.createElement('span');state.textContent=!p.connected?'다시 연결 중':inside?inside.name+' 안':p.role==='teacher'?'선생님':p.muted?'채팅 멈춤':'LV 1';
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
  $('self-department').textContent=isTeacher?'선생님은 모든 행성에 들어갈 수 있어요.':me?.departmentId?'소속: '+(planetById(me.departmentId)?.name||''):'아직 소속 행성이 없어요. 행성 가까이 가서 E를 눌러보세요.';
  const myProposal=(room.proposals||[]).find(p=>p.playerId===selfId);
  $('self-proposal').hidden=!myProposal;
  if(myProposal)$('self-proposal').textContent='"'+myProposal.name+'" 행성 신청 중 · 선생님 승인을 기다려요';
  $('leave').textContent=me?.role==='teacher'?'교실 종료하기':'교실 나가기';
  $('planet-exit').hidden=!inInterior;$('planet-new').hidden=inInterior;$('planet-info').hidden=!inInterior;
  if(!placing)$('map-caption').textContent=inInterior?'✦ '+(planetById(planetIdOfMap(myMapId))?.name||'행성')+' 안 · 소속 친구들만의 공간':'✦ 같은 교실의 친구들과 함께하는 공간';
  if(!room.players.some(p=>p.role==='teacher'&&p.connected))$('connection').textContent='선생님 연결 대기 · 잠시 이동을 멈춰요';
  updateChatUI(me,isTeacher);
  updateProposalsPanel(isTeacher);
  if($('planet-dialog').open&&planetDialogId)renderPlanetDialog(planetDialogId);
}
function updateProposalsPanel(isTeacher){
  const proposals=room.proposals||[];
  $('proposals-panel').hidden=proposals.length===0;
  $('proposals').replaceChildren(...proposals.map(p=>{
    const li=document.createElement('li');
    const strong=document.createElement('strong');strong.textContent=p.name;
    const who=document.createElement('span');who.textContent='신청: '+p.nickname;
    const small=document.createElement('small');small.textContent=p.description||'';
    li.append(strong,who,small);
    if(isTeacher){
      const approve=document.createElement('button');approve.type='button';approve.className='small primary approve';approve.dataset.proposalId=p.id;approve.textContent='승인';
      approve.onclick=async()=>{try{await request('planet:approve',{proposalId:p.id});}catch(e){toast(e.message);}};
      const reject=document.createElement('button');reject.type='button';reject.className='small secondary reject';reject.dataset.proposalId=p.id;reject.textContent='돌려보내기';
      reject.onclick=async()=>{try{await request('planet:reject',{proposalId:p.id});}catch(e){toast(e.message);}};
      li.append(approve,reject);
    }else if(p.playerId===selfId){
      const withdraw=document.createElement('button');withdraw.type='button';withdraw.className='small secondary withdraw';withdraw.dataset.proposalId=p.id;withdraw.textContent='취소';
      withdraw.onclick=async()=>{try{await request('planet:withdraw',{proposalId:p.id});}catch(e){toast(e.message);}};
      li.append(withdraw);
    }
    return li;
  }));
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
function renderPlanetDialog(planetId){
  if(!room)return;
  const planet=planetById(planetId);
  if(!planet){if($('planet-dialog').open)$('planet-dialog').close();return;}
  const me=room.players.find(p=>p.id===selfId),isTeacher=me?.role==='teacher';
  $('planet-title').textContent=planet.name;$('planet-description').textContent=planet.description||'소개가 아직 없어요.';
  $('planet-member-count').textContent='소속 친구 '+(planet.memberCount||0)+'명';
  const members=room.players.filter(p=>p.departmentId===planetId);
  $('planet-members-empty').hidden=members.length>0;
  $('planet-members').replaceChildren(...members.map(p=>{
    const li=document.createElement('li');
    li.textContent=p.nickname+(p.id===selfId?' · 나':'')+(p.mapId===interiorIdOf(planetId)?' · 안에 있어요':'');
    return li;
  }));
  const rules=planet.rules||[];
  $('planet-rules-list').replaceChildren(...rules.map(line=>{const li=document.createElement('li');li.textContent=line;return li;}));
  $('planet-rules-input').value=rules.join('\n');
  $('planet-rules-editor').hidden=!isTeacher;
  $('planet-enter').hidden=!(isTeacher||me?.departmentId===planetId)||me?.mapId!==PLAZA_ID;
  $('planet-join').hidden=isTeacher||me?.departmentId===planetId;
  $('planet-join').textContent=(!isTeacher&&me?.departmentId&&me.departmentId!==planetId)?(planetById(me.departmentId)?.name||'')+'에서 옮겨오기':'가입하기';
  $('planet-leave-dept').hidden=isTeacher||me?.departmentId!==planetId;
  renderPlanetRename(planet,me,isTeacher);
}
function renderPlanetRename(planet,me,isTeacher){
  const isMember=!isTeacher&&me?.departmentId===planet.id;
  $('planet-rename').hidden=!(isTeacher||isMember);
  const rename=planet.rename;
  $('planet-rename-propose-row').hidden=!(isMember&&!rename);
  $('planet-rename-status').hidden=!rename;
  $('planet-rename-votes').hidden=!(rename&&isMember);
  if(rename){
    $('planet-rename-status').textContent='"'+rename.name+'"으로 바꿀까요? 찬성 '+rename.yes+' · 반대 '+rename.no+' · '+rename.needed+'명 찬성이면 바뀌어요 (제안: '+rename.proposedByNickname+')';
    if(isMember){
      const myVote=rename.votes?.[selfId];
      $('planet-vote-yes').classList.toggle('selected',myVote===true);
      $('planet-vote-no').classList.toggle('selected',myVote===false);
    }
  }
  $('planet-rename-teacher-row').hidden=!isTeacher;
  $('planet-remove').hidden=!isTeacher;
}
function openPlanetDialog(planetId){
  if(!planetById(planetId))return;
  planetDialogId=planetId;$('planet-rules').hidden=true;$('planet-rename-input').value='';$('planet-rename-teacher').value='';
  renderPlanetDialog(planetId);stop();
  if(!$('planet-dialog').open)$('planet-dialog').showModal();
}
$('planet-info').onclick=()=>{
  const me=room?.players.find(p=>p.id===selfId);
  const planetId=planetIdOfMap(me?.mapId||PLAZA_ID);
  if(planetId)openPlanetDialog(planetId);
};
$('planet-rename-propose').onclick=async()=>{
  const name=$('planet-rename-input').value.trim();if(!name)return;
  try{await request('planet:rename:propose',{planetId:planetDialogId,name});$('planet-rename-input').value='';}
  catch(e){toast(e.message);}
};
$('planet-vote-yes').onclick=async()=>{try{await request('planet:rename:vote',{planetId:planetDialogId,agree:true});}catch(e){toast(e.message);}};
$('planet-vote-no').onclick=async()=>{try{await request('planet:rename:vote',{planetId:planetDialogId,agree:false});}catch(e){toast(e.message);}};
$('planet-rename-set').onclick=async()=>{
  const name=$('planet-rename-teacher').value.trim();if(!name)return;
  try{await request('planet:rename:set',{planetId:planetDialogId,name});$('planet-rename-teacher').value='';toast('이름을 바꿨어요.');}
  catch(e){toast(e.message);}
};
$('planet-remove').onclick=async()=>{
  const planet=planetById(planetDialogId);if(!planet)return;
  if(!confirm('"'+planet.name+'" 행성을 없앨까요? 소속 친구들은 광장으로 나와요.'))return;
  try{await request('planet:remove',{planetId:planetDialogId});$('planet-dialog').close();}
  catch(e){toast(e.message);}
};
$('planet-rules-toggle').onclick=()=>{
  const show=$('planet-rules').hidden;$('planet-rules').hidden=!show;
  if(show&&planetDialogId)renderPlanetDialog(planetDialogId);
};
$('planet-close').onclick=()=>$('planet-dialog').close();
$('planet-dialog').addEventListener('close',()=>{planetDialogId=null;$('world').focus();});
$('planet-join').onclick=async()=>{try{await request('planet:join',{planetId:planetDialogId});}catch(e){toast(e.message);}};
$('planet-leave-dept').onclick=async()=>{try{await request('planet:leave',{planetId:planetDialogId});}catch(e){toast(e.message);}};
$('planet-enter').onclick=async()=>{
  try{await request('planet:enter',{planetId:planetDialogId});$('planet-dialog').close();}
  catch(e){toast(e.message);}
};
$('planet-rules-save').onclick=async()=>{
  const rules=$('planet-rules-input').value.split('\n').map(s=>s.trim()).filter(Boolean);
  try{await request('planet:rules:set',{planetId:planetDialogId,rules});toast('규칙을 저장했어요.');}
  catch(e){toast(e.message);}
};
async function exitPlanet(){try{await request('planet:exit',{});}catch(e){toast(e.message);}}
$('planet-exit').onclick=exitPlanet;
function doInteract(){
  const n=world.nearby();if(!n)return;
  if(n.kind==='planet')openPlanetDialog(n.id);else if(n.kind==='door')exitPlanet();
}
$('interact-prompt').onclick=doInteract;
function updateInteractPrompt(){
  if(!selfId||placing||document.querySelector('dialog[open]')){$('interact-prompt').hidden=true;return;}
  const n=world.nearby();
  if(!n){$('interact-prompt').hidden=true;return;}
  $('interact-prompt').hidden=false;
  $('interact-prompt').textContent=n.kind==='planet'?n.name+' 살펴보기 (E)':'광장으로 나가기 (E)';
}
window.addEventListener('keydown',e=>{
  if(e.code!=='KeyE'||!selfId||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')||['INPUT','TEXTAREA','BUTTON'].includes(e.target.tagName))return;
  e.preventDefault();doInteract();
});
function planetCaption(){
  const me=room?.players.find(p=>p.id===selfId),myMapId=me?.mapId||PLAZA_ID;
  if(myMapId===PLAZA_ID)return '✦ 같은 교실의 친구들과 함께하는 공간';
  return '✦ '+(planetById(planetIdOfMap(myMapId))?.name||'행성')+' 안 · 소속 친구들만의 공간';
}
function startPlacement(){
  placing=true;document.body.classList.add('placing');
  $('map-caption').textContent='✦ 지도에서 행성을 만들 자리를 눌러주세요 (Esc 취소)';
  $('planet-new').textContent='취소';
}
function stopPlacement(){
  placing=false;document.body.classList.remove('placing');
  $('planet-new').textContent='행성 만들기';world.setPlacement(null);
  if(room&&!$('planet-create-dialog').open)$('map-caption').textContent=planetCaption();
}
$('planet-new').onclick=()=>{placing?stopPlacement():startPlacement();};
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&placing)stopPlacement();});
function openPlanetCreateDialog(point){
  const isTeacher=room?.players.find(p=>p.id===selfId)?.role==='teacher';
  createPoint=point;
  $('planet-create-title').textContent=isTeacher?'새 행성 만들기':'새 행성 신청하기';
  $('planet-create-hint').textContent='행성은 우리 반의 역할이에요. 어떤 역할의 행성인지 이름과 소개를 적어요.'+(isTeacher?'':' 선생님이 승인하면 행성이 생기고, 내가 첫 멤버가 돼요.');
  $('planet-name').value='';$('planet-desc').value='';$('planet-create-error').textContent='';
  const firstColor=$('planet-colors').querySelector('input');if(firstColor)firstColor.checked=true;
  $('planet-create-submit').textContent=isTeacher?'만들기':'신청하기';
  stop();$('planet-create-dialog').showModal();
}
$('planet-create-cancel').onclick=()=>$('planet-create-dialog').close();
$('planet-create-dialog').addEventListener('close',()=>{world.setPlacement(null);$('map-caption').textContent=planetCaption();$('world').focus();});
$('planet-create-submit').onclick=async()=>{
  const name=$('planet-name').value.trim(),description=$('planet-desc').value.trim();
  const color=$('planet-colors').querySelector('input:checked')?.value||PLANET_COLORS[0];
  const isTeacher=room?.players.find(p=>p.id===selfId)?.role==='teacher';
  if(!createPoint)return;
  try{
    await request(isTeacher?'planet:create':'planet:propose',{name,description,x:createPoint.x,y:createPoint.y,color});
    $('planet-create-dialog').close();
    toast(isTeacher?'행성을 만들었어요.':'행성을 신청했어요. 선생님의 승인을 기다려요.');
  }catch(e){$('planet-create-error').textContent=e.message;}
};
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
  $('interact-prompt').hidden=true;if($('planet-dialog').open)$('planet-dialog').close();
  if($('planet-create-dialog').open)$('planet-create-dialog').close();if(placing)stopPlacement();
}
function reset(message){
  stop();selfId=null;room=null;saveToken(null);world.setRoom(null,null);
  $('lobby').hidden=false;$('room-badge').hidden=true;$('leave').hidden=true;$('touch-controls').hidden=true;$('chat-panel').hidden=true;
  $('players').replaceChildren();$('player-count').textContent='0 / 30';$('crew-empty').hidden=false;
  clearChat();$('chat-input').value='';$('chat-input').disabled=false;$('chat-input').placeholder='친구들에게 말해요 (Enter)';
  $('room-title').textContent='우리들의 우주 광장';$('self-name').textContent='나의 소행성';
  $('self-description').textContent='모두 같은 LV 1 소행성으로 다시 출발해요.';
  $('self-department').textContent='아직 소속 행성이 없어요. 행성 가까이 가서 E를 눌러보세요.';
  $('self-proposal').hidden=true;$('proposals-panel').hidden=true;$('proposals').replaceChildren();
  $('planet-exit').hidden=true;$('planet-new').hidden=true;$('interact-prompt').hidden=true;$('map-caption').textContent='✦ 같은 교실의 친구들과 함께하는 공간';
  if(placing)stopPlacement();
  document.body.classList.remove('joined');$('form-message').textContent=message||'';
  if($('leave-dialog').open)$('leave-dialog').close();
  if($('planet-dialog').open)$('planet-dialog').close();
  if($('planet-create-dialog').open)$('planet-create-dialog').close();
}
async function submit(event,handler){
  event.preventDefault();if(busy)return;busy=true;controls();$('form-message').textContent='';
  try{enter(await handler());}catch(e){$('form-message').textContent=e.message==='operation has timed out'?'응답이 늦어지고 있어요. 연결 상태를 확인해주세요.':e.message;}
  finally{busy=false;controls();}
}
$('student-form').onsubmit=e=>submit(e,()=>request('room:join',{code:$('join-code').value,nickname:$('nickname').value}));
$('teacher-form').onsubmit=e=>submit(e,()=>request('room:create',{teacherKey:$('teacher-key').value,title:$('class-title').value,allowedNames:$('allowed-names').value.split(/[,\n]/).map(s=>s.trim()).filter(Boolean),seedPlanets:$('seed-planets').checked}));
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
  if(!selfId||!keys[e.code]||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')||['INPUT','TEXTAREA','BUTTON'].includes(e.target.tagName))return;
  e.preventDefault();held.add(e.code);input();
});
window.addEventListener('keyup',e=>{if(keys[e.code]){held.delete(e.code);input();}});
window.addEventListener('blur',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
$('world').addEventListener('click',e=>{
  $('world').focus();
  if(!placing){
    if(world.currentMapId()===PLAZA_ID){
      const planet=world.planetAt(world.canvasPoint(e));
      if(planet)openPlanetDialog(planet.id);
    }
    return;
  }
  const point=world.canvasPoint(e);
  world.setPlacement(point);placing=false;document.body.classList.remove('placing');$('planet-new').textContent='행성 만들기';
  openPlanetCreateDialog(point);
});
for(const button of document.querySelectorAll('[data-dx]')){
  button.addEventListener('pointerdown',e=>{e.preventDefault();touch={x:Number(button.dataset.dx),y:Number(button.dataset.dy)};input();try{button.setPointerCapture(e.pointerId);}catch{}});
  for(const type of ['pointerup','pointercancel','lostpointercapture','pointerleave'])button.addEventListener(type,()=>{touch={x:0,y:0};input();});
  button.addEventListener('contextmenu',e=>e.preventDefault());
}
setInterval(()=>{input();updateInteractPrompt();},80);controls();socket.connect();
