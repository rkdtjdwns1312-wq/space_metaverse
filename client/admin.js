const $=id=>document.getElementById(id);
const embedded=new URLSearchParams(location.search).has('embedded');
if(embedded)document.documentElement.classList.add('embedded');
const notifyParent=type=>{if(embedded&&window.parent!==window)window.parent.postMessage(type,location.origin);};
const socket=io({reconnection:true});
let loggedIn=false;
let deleteTarget=null;
let issuedClasses=[];
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
function normalizeSearch(value){return String(value??'').normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase();}
function render(classes){issuedClasses=Array.isArray(classes)?classes:[];renderClassList();}
function renderClassList(){
  const list=$('class-list');list.replaceChildren();
  const query=normalizeSearch($('class-search-input').value);
  const matches=issuedClasses.filter(item=>normalizeSearch(item.title).includes(query));
  $('class-list-count').textContent=query?`검색결과 ${matches.length}개 · 전체 ${issuedClasses.length}개`:`전체 ${issuedClasses.length}개`;
  $('clear-class-search').hidden=!query;
  if(!issuedClasses.length){const p=document.createElement('p');p.textContent='아직 만든 교실이 없어요.';list.append(p);return;}
  if(!matches.length){const p=document.createElement('p');p.className='class-list-empty';p.textContent='검색 결과가 없어요.';list.append(p);return;}
  for(const item of matches){
    const row=document.createElement('article');row.className='class-row';
    const h=document.createElement('h3');h.textContent=item.title;
    const info=document.createElement('p');info.textContent='교실 코드: ';
    const code=document.createElement('span');code.className='code';code.textContent=item.code;info.append(code);
    const current=document.createElement('p');current.textContent='담당: '+(item.teacherName||'미배정')+' · '+(item.open?'접속 중':'대기 중');
    const teacherCode=document.createElement('div');teacherCode.className='teacher-code-line';
    const teacherCodeLabel=document.createElement('span');teacherCodeLabel.textContent='선생님 코드:';
    const teacherCodeValue=document.createElement('code');
    teacherCodeValue.textContent=item.teacherCode|| (item.assigned?'기존 코드 확인 불가 · 기존 코드로 선생님이 한 번 접속하면 표시됩니다.':'아직 발급되지 않았어요.');
    teacherCode.append(teacherCodeLabel,teacherCodeValue);
    if(item.teacherCode){
      const copy=document.createElement('button');copy.type='button';copy.className='secondary';copy.textContent='복사하기';
      copy.onclick=async()=>{try{await navigator.clipboard.writeText(item.teacherCode);showMessage('선생님 코드를 복사했어요.');}catch{showMessage('복사할 수 없어요. 코드를 직접 선택해 복사해 주세요.');}};
      teacherCode.append(copy);
    }
    const actions=document.createElement('div');actions.className='class-actions';
    let teacherNameLabel=null;
    if(!item.assigned){
      teacherNameLabel=document.createElement('label');teacherNameLabel.textContent='새로 발급할 선생님 이름';
      const name=document.createElement('input');name.maxLength=40;name.value=item.teacherName||'';name.placeholder='담당 선생님 이름';teacherNameLabel.append(name);
      const grant=document.createElement('button');grant.type='button';grant.textContent='선생님 코드 발급';
      grant.onclick=async()=>{grant.disabled=true;try{const reply=await request('admin:grant',{code:item.code,teacherName:name.value});render(reply.classes);showCode(item.code,reply.teacherCode);showMessage('새 코드를 발급했어요.');}catch(error){showMessage(error.message);}finally{grant.disabled=false;}};
      actions.append(grant);
    }
    const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='교실 삭제';
    remove.onclick=()=>{deleteTarget=item;$('delete-target').textContent=item.title+' · 교실 코드 '+item.code;$('delete-code').value='';$('delete-error').textContent='';$('delete-dialog').showModal();$('delete-code').focus();};
    actions.append(remove);row.append(h,info,teacherCode,current,...(teacherNameLabel?[teacherNameLabel]:[]),actions);list.append(row);
  }
}
$('class-search-input').addEventListener('input',renderClassList);
$('clear-class-search').onclick=()=>{$('class-search-input').value='';renderClassList();$('class-search-input').focus();};
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
