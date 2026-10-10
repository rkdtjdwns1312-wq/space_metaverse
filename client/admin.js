const $=id=>document.getElementById(id);
const embedded=new URLSearchParams(location.search).has('embedded');
if(embedded)document.documentElement.classList.add('embedded');
const notifyParent=type=>{if(embedded&&window.parent!==window)window.parent.postMessage(type,location.origin);};
const socket=io({reconnection:true});
let loggedIn=false;
let deleteTarget=null;
const showMessage=text=>{$('admin-message').textContent=text;};
async function request(event,data={}){
  if(!socket.connected)throw new Error('서버 연결을 기다려 주세요.');
  const reply=await socket.timeout(6000).emitWithAck(event,data);
  if(!reply?.ok)throw new Error(reply?.error||'다시 시도해 주세요.');
  return reply;
}
function showCode(roomCode,teacherCode){
  $('issued-class').textContent=roomCode+' 교실의 선생님 코드';
  $('issued-code').textContent=teacherCode;
  $('issued-panel').hidden=false;
  $('issued-panel').scrollIntoView({block:'nearest'});
}
function render(classes){
  const list=$('class-list');list.replaceChildren();
  if(!classes.length){const p=document.createElement('p');p.textContent='아직 만든 교실이 없어요.';list.append(p);return;}
  for(const item of classes){
    const row=document.createElement('article');row.className='class-row';
    const h=document.createElement('h3');h.textContent=item.title;
    const info=document.createElement('p');info.textContent='교실 코드: ';
    const code=document.createElement('span');code.className='code';code.textContent=item.code;info.append(code);
    const current=document.createElement('p');current.textContent='담당: '+(item.teacherName||'미배정')+' · '+(item.open?'접속 중':'대기 중');
    const label=document.createElement('label');label.textContent='새로 발급할 선생님 이름';
    const name=document.createElement('input');name.maxLength=40;name.value=item.teacherName||'';name.placeholder='담당 선생님 이름';label.append(name);
    const actions=document.createElement('div');actions.className='class-actions';
    const grant=document.createElement('button');grant.type='button';grant.textContent=item.assigned?'선생님 코드 다시 발급':'선생님 코드 발급';
    grant.onclick=async()=>{grant.disabled=true;try{const reply=await request('admin:grant',{code:item.code,teacherName:name.value});render(reply.classes);showCode(item.code,reply.teacherCode);showMessage('새 코드를 발급했어요.');}catch(error){showMessage(error.message);}finally{grant.disabled=false;}};
    const revoke=document.createElement('button');revoke.type='button';revoke.className='secondary';revoke.textContent='선생님 코드 회수';revoke.disabled=!item.assigned;
    revoke.onclick=async()=>{if(!confirm(item.title+' 선생님 코드를 회수할까요? 담당 선생님은 다시 입장해야 해요.'))return;revoke.disabled=true;try{const reply=await request('admin:revoke',{code:item.code});render(reply.classes);$('issued-panel').hidden=true;showMessage('선생님 코드를 회수했어요.');}catch(error){showMessage(error.message);}finally{revoke.disabled=false;}};
    const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='교실 삭제';
    remove.onclick=()=>{deleteTarget=item;$('delete-target').textContent=item.title+' · 교실 코드 '+item.code;$('delete-code').value='';$('delete-error').textContent='';$('delete-dialog').showModal();$('delete-code').focus();};
    actions.append(grant,revoke,remove);row.append(h,info,current,label,actions);list.append(row);
  }
}
$('admin-login').onsubmit=async event=>{
  event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;showMessage('');
  try{const reply=await request('admin:login',{key:$('admin-key').value});$('admin-key').value='';loggedIn=true;$('login-panel').hidden=true;$('admin-panel').hidden=false;render(reply.classes);notifyParent('admin:entered');}
  catch(error){showMessage(error.message);}finally{button.disabled=false;}
};
$('create-class').onsubmit=async event=>{
  event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;showMessage('');
  try{const reply=await request('admin:create',{title:$('class-name').value,teacherName:$('teacher-name').value});render(reply.classes);showCode(reply.code,reply.teacherCode);$('class-name').value='';$('teacher-name').value='';showMessage('교실을 만들었어요. 선생님 코드를 안전하게 전달해 주세요.');}
  catch(error){showMessage(error.message);}finally{button.disabled=false;}
};
$('refresh-list').onclick=async()=>{try{render((await request('admin:list')).classes);showMessage('목록을 새로고침했어요.');}catch(error){showMessage(error.message);}};
$('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText($('issued-code').textContent);showMessage('코드를 복사했어요.');}catch{showMessage('복사할 수 없어요. 코드를 직접 선택해 복사해 주세요.');}};
$('hide-issued').onclick=()=>{$('issued-code').textContent='';$('issued-panel').hidden=true;};
$('cancel-delete').onclick=()=>$('delete-dialog').close();
$('delete-dialog').addEventListener('close',()=>{deleteTarget=null;$('delete-code').value='';});
$('delete-class').onsubmit=async event=>{
  event.preventDefault();
  if(!deleteTarget)return;
  const code=deleteTarget.code;
  if($('delete-code').value!==code){$('delete-error').textContent='교실 코드를 정확히 입력해주세요.';return;}
  const button=$('confirm-delete');button.disabled=true;
  try{const reply=await request('admin:delete',{code,confirmCode:$('delete-code').value});$('delete-dialog').close();render(reply.classes);$('issued-panel').hidden=true;$('issued-code').textContent='';showMessage(code+' 교실을 삭제했어요.');}
  catch(error){$('delete-error').textContent=error.message;}finally{button.disabled=false;}
};
socket.on('disconnect',()=>{if(loggedIn){if($('delete-dialog').open)$('delete-dialog').close();deleteTarget=null;loggedIn=false;$('admin-panel').hidden=true;$('login-panel').hidden=false;$('issued-code').textContent='';$('issued-panel').hidden=true;showMessage('연결이 끊어졌어요. 다시 입장해 주세요.');notifyParent('admin:logged-out');}});
