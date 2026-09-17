export function createAccountsUI({getRoom,getSelfId,request,toast,saveToken}) {
  const $=id=>document.getElementById(id),classCode=new URLSearchParams(location.search).get('class')||'';
  let managed=false,credentialsAvailable=false;
  const ready=fetch('/api/public-config').then(r=>r.json()).then(config=>{
    managed=config.managedAccounts;
    if(managed){
      $('join-code').value=classCode;$('join-code').required=false;$('join-code').hidden=true;
      document.querySelector('label[for="join-code"]').hidden=true;
      $('nickname').placeholder='선생님이 알려주신 이름';document.querySelector('label[for="nickname"]').textContent='이름';
      $('pin-help').textContent='선생님이 알려주신 비밀번호로 들어오세요.';
      if(!classCode)$('form-message').textContent='선생님이 보내주신 학생 입장 링크로 접속해주세요.';
      $('names-help').textContent='학생 이름을 쉼표나 줄바꿈으로 구분 · 최대 29명. 계정과 임시 비밀번호가 만들어져요.';
    }
  }).catch(()=>{throw new Error('입장 설정을 불러오지 못했어요. 새로고침해주세요.');});
  ready.catch(e=>toast(e.message));
  $('account-target').onchange=()=>{
    const p=getRoom()?.players.find(p=>p.id===$('account-target').value);
    $('account-name').value=p?.nickname||'';$('account-pin').value='';$('account-result').textContent='';
  };
  $('account-save').onclick=async()=>{
    const target=$('account-target').value,nickname=$('account-name').value.trim(),pin=$('account-pin').value;
    $('account-save').disabled=true;
    try{await request(target==='new'?'student:create':'student:update',{playerId:target,nickname,pin});$('account-pin').value='';$('account-result').textContent=nickname+' 계정을 저장했어요. 학생에게 알려주세요.';}
    catch(e){$('account-result').textContent=e.message;}finally{$('account-save').disabled=false;}
  };
  $('credentials-download').onclick=()=>{
    const url=URL.createObjectURL(new Blob([$('credentials-text').value],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='학생별-배부용-계정.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('password-offer-no').onclick=()=>$('password-offer-dialog').close();
  function password(){
    for(const id of ['password-offer-dialog','menu-dialog'])if($(id).open)$(id).close();
    $('password-form').reset();$('password-error').textContent='';$('password-dialog').showModal();
  }
  $('password-offer-yes').onclick=password;$('my-password').onclick=password;
  $('password-form').onsubmit=async e=>{
    e.preventDefault();const pin=$('password-new').value;
    if(pin!==$('password-confirm').value){$('password-error').textContent='새 비밀번호가 서로 달라요.';return;}
    $('password-save').disabled=true;
    try{const result=await request('student:password',{currentPin:$('password-current').value,pin});saveToken(result.token);$('password-dialog').close();toast('새 비밀번호를 저장했어요. 다음 입장부터 사용하세요.');}
    catch(e){$('password-error').textContent=e.message;}finally{$('password-save').disabled=false;}
  };
  $('password-dialog').addEventListener('close',()=>$('password-form').reset());
  $('copy-student-link').onclick=async()=>{
    try{const result=await request('room:studentLink',{});await navigator.clipboard.writeText(result.url);toast('학생 입장 링크를 복사했어요.');}
    catch(e){toast(e.message);}
  };
  function renderCredentials(room=getRoom()){
    const me=room?.players.find(p=>p.id===getSelfId()),teacher=me?.role==='teacher'&&room?.managedAccounts;
    $('credentials-panel').hidden=!teacher;
    $('credentials-empty').hidden=!teacher||credentialsAvailable;
    $('credentials-text').hidden=!teacher||!credentialsAvailable;
    $('credentials-download').hidden=!teacher||!credentialsAvailable;
  }
  return {
    ready,
    update(){
      const room=getRoom(),me=room?.players.find(p=>p.id===getSelfId());if(!me)return;
      $('accounts-panel').hidden=me.role!=='teacher'||!room.managedAccounts;
      renderCredentials(room);
      $('my-password').hidden=me.role!=='student'||!room.managedAccounts;
      const select=$('account-target'),old=select.value;
      select.replaceChildren(Object.assign(document.createElement('option'),{value:'new',textContent:'새 학생 만들기'}),...room.players.filter(p=>p.role==='student').map(p=>Object.assign(document.createElement('option'),{value:p.id,textContent:p.nickname})));
      if([...select.options].some(o=>o.value===old))select.value=old;
    },
    entered(result,{login=false}={}){
      if(result.credentials?.length){$('credentials-text').value=result.credentials.map(c=>c.nickname+'\t'+c.pin).join('\n');credentialsAvailable=true;renderCredentials(result.room);}
      else if(login&&result.room.managedAccounts)$('password-offer-dialog').showModal();
    },
    reset(){credentialsAvailable=false;$('credentials-text').value='';renderCredentials(null);},
    checkLink(){if(managed&&!classCode)throw new Error('선생님이 보내주신 학생 입장 링크로 접속해주세요.');}
  };
}
