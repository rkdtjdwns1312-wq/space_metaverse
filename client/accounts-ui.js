import { drawStudentQr, shareableStudentLink } from './student-qr.js';
import { RULES } from '/shared/config.js';
import {CONSTELLATIONS} from '/shared/constellations.js';

export function createAccountsUI({getRoom,getSelfId,request,toast,saveToken}) {
  const $=id=>document.getElementById(id),classCode=new URLSearchParams(location.search).get('class')||'';
  let managed=false;
  // 이 교사 화면에서 발급한 비밀번호만 잠시 보관하고, 이름은 서버 명단에서 가져옵니다.
  const issuedPins=new Map();
  const masterFields=document.createElement('div');masterFields.hidden=true;
  const masterLabel=document.createElement('label');masterLabel.htmlFor='master-constellation';masterLabel.textContent='마스터 첫 별자리';
  const masterSelect=document.createElement('select');masterSelect.id='master-constellation';
  masterSelect.replaceChildren(...CONSTELLATIONS.filter(c=>!c.legacy).map(c=>Object.assign(document.createElement('option'),{value:c.id,textContent:c.name})));
  const masterHelp=document.createElement('p');masterHelp.className='muted';masterHelp.textContent='이 교실 전용 · 학생 정원 1칸 · 처음부터 LV5 · 기본 공격20/방어5/HP·MP500 · 재화 무제한. 선생님 도구 권한은 없어요.';
  masterFields.append(masterLabel,masterSelect,masterHelp);$('account-target').after(masterFields);
  const ready=fetch('/api/public-config').then(r=>r.json()).then(config=>{
    managed=config.managedAccounts;
    $('student-setup-fields').hidden=!managed;
    $('student-setup-fields').disabled=!managed;
    $('legacy-names-fields').hidden=managed;
    $('allowed-names').required=!managed;
    document.body.dataset.accountMode=managed?'managed':'open';
    if(managed){
      $('join-code').value=classCode;$('join-code').required=!classCode;$('join-code').hidden=!!classCode;
      document.querySelector('label[for="join-code"]').hidden=!!classCode;
      $('nickname').placeholder='선생님이 알려주신 이름';document.querySelector('label[for="nickname"]').textContent='이름';
      $('pin-help').textContent='선생님이 알려주신 비밀번호로 들어오세요.';
      $('names-help').textContent=`학생 이름을 쉼표나 줄바꿈으로 구분 · 최대 ${RULES.maxStudents}명. 계정과 임시 비밀번호가 만들어져요.`;
    }
  }).catch(()=>{throw new Error('입장 설정을 불러오지 못했어요. 새로고침해주세요.');});
  ready.catch(e=>toast(e.message));
  $('account-target').onchange=()=>{
    const p=getRoom()?.players.find(p=>p.id===$('account-target').value);
    $('account-name').value=p?.nickname||'';$('account-pin').value='';$('account-result').textContent='';
    $('account-save').textContent=p?'변경 저장':'계정 추가하기';
    masterFields.hidden=$('account-target').value!=='new-master';
  };
  $('account-add').onclick=()=>{
    $('account-target').value='new';$('account-target').dispatchEvent(new Event('change'));
    $('account-name').scrollIntoView({block:'nearest'});$('account-name').focus();
  };
  $('account-delete').onclick=async()=>{
    const ids=[...$('account-delete-list').querySelectorAll('input:checked')].map(input=>input.value);
    if(!ids.length){$('account-result').textContent='삭제할 계정을 먼저 선택해주세요.';return;}
    const names=getRoom().players.filter(p=>ids.includes(p.id)).map(p=>p.nickname);
    if(!window.confirm(names.join(', ')+' 계정 '+ids.length+'개를 삭제할까요? 계정의 저장 자료가 삭제되고 접속 중이면 퇴장합니다. 되돌릴 수 없어요.'))return;
    $('account-delete').disabled=true;
    try{const result=await request('student:delete',{playerIds:ids});for(const id of result.deletedIds||ids)issuedPins.delete(id);renderCredentials();$('account-result').textContent=ids.length+'개 계정을 삭제했어요.';}
    catch(error){$('account-result').textContent=error.message;}finally{$('account-delete').disabled=false;}
  };
  $('account-save').onclick=async()=>{
    const target=$('account-target').value,nickname=$('account-name').value.trim(),pin=$('account-pin').value;
    $('account-save').disabled=true;
    try{const isNew=target==='new'||target==='new-master',event=target==='new-master'?'master:create':target==='new'?'student:create':'student:update';const result=await request(event,{playerId:target,nickname,pin,...(target==='new-master'?{constellationId:masterSelect.value}:{})});if(pin)issuedPins.set(isNew?result.playerId:target,pin);renderCredentials();$('account-pin').value='';$('account-result').textContent=nickname+' 계정을 저장했어요. 사용할 분에게 알려주세요.';}
    catch(e){$('account-result').textContent=e.message;}finally{$('account-save').disabled=false;}
  };
  $('credentials-download').onclick=()=>{
    const url=URL.createObjectURL(new Blob([$('credentials-text').value],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='배부용-계정.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
    try{const result=await request('room:studentLink',{});await navigator.clipboard.writeText(shareableStudentLink(result.url));toast('학생 입장 링크를 복사했어요.');}
    catch(e){toast(e.message);}
  };
  $('copy-student-qr').onclick=async()=>{
    try{
      const result=await request('room:studentLink',{});
      const url=shareableStudentLink(result.url);
      drawStudentQr($('student-qr-canvas'),url);
      $('student-qr-link').textContent=url;
      $('student-qr-dialog').showModal();
      await copyStudentQrImage();
    }catch(e){toast(e.message);}
  };
  async function copyStudentQrImage(){
    if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw new Error('이 브라우저에서는 QR 이미지 복사를 지원하지 않아요. PNG 저장을 이용해주세요.');
    const blob=await new Promise(resolve=>$('student-qr-canvas').toBlob(resolve,'image/png'));
    if(!blob)throw new Error('QR 이미지를 만들지 못했어요. 다시 시도해주세요.');
    await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
    toast('학생 입장 QR 코드를 복사했어요.');
  }
  $('student-qr-copy').onclick=async()=>{
    try{await copyStudentQrImage();}
    catch(e){toast(e.message||'QR 이미지를 복사하지 못했어요. PNG 저장을 이용해주세요.');}
  };
  $('student-qr-download').onclick=()=>{
    const anchor=document.createElement('a');
    anchor.href=$('student-qr-canvas').toDataURL('image/png');
    anchor.download='우주교실-학생입장-QR.png';
    anchor.click();
  };
  function renderCredentials(room=getRoom()){
    const me=room?.players.find(p=>p.id===getSelfId()),teacher=me?.role==='teacher'&&room?.managedAccounts;
    const students=teacher?room.players.filter(p=>p.role==='student'):[];
    const credentialsAvailable=students.length>0;
    $('credentials-text').value=students.map(p=>p.nickname+(p.accountKind==='master'?' [마스터]':'')+'\t'+(issuedPins.get(p.id)||'비밀번호 재지정 필요')).join('\n');
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
      select.replaceChildren(Object.assign(document.createElement('option'),{value:'new',textContent:'새 학생 만들기'}),Object.assign(document.createElement('option'),{value:'new-master',textContent:'마스터 계정 만들기'}),...room.players.filter(p=>p.role==='student').map(p=>Object.assign(document.createElement('option'),{value:p.id,textContent:p.nickname+(p.accountKind==='master'?' [마스터]':'')})));
      if([...select.options].some(o=>o.value===old))select.value=old;
      else if(old&&old!=='new')select.dispatchEvent(new Event('change'));
      masterFields.hidden=select.value!=='new-master';
      const list=$('account-delete-list'),selected=new Set([...list.querySelectorAll('input:checked')].map(input=>input.value));
      const students=room.players.filter(p=>p.role==='student');
      const signature=JSON.stringify(students.map(p=>[p.id,p.nickname,p.accountKind]));
      if(list.dataset.signature!==signature){
        list.dataset.signature=signature;
        list.replaceChildren(...students.map(p=>{const row=document.createElement('div'),label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=p.id;input.checked=selected.has(p.id);label.append(input,document.createTextNode(' '+p.nickname+(p.accountKind==='master'?' [마스터]':'')));row.append(label);return row;}));
      }
    },
    entered(result,{login=false}={}){
      if(result.credentials?.length){for(const c of result.credentials){const p=result.room.players.find(p=>p.role==='student'&&p.nickname===c.nickname);if(p)issuedPins.set(p.id,c.pin);}renderCredentials(result.room);}
      else if(login&&result.room.managedAccounts)$('password-offer-dialog').showModal();
    },
    reset(){issuedPins.clear();$('credentials-text').value='';$('account-delete-list').replaceChildren();delete $('account-delete-list').dataset.signature;renderCredentials(null);},
    checkLink(){if(managed&&!/^[A-Z0-9]{6}$/.test($('join-code').value.trim().toUpperCase()))throw new Error('선생님이 알려주신 교실 코드 6자리를 적어주세요.');}
  };
}
