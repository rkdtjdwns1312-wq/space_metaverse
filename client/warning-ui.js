const $=id=>document.getElementById(id);

export function createWarningUI({request,stop,toast,getSelfId}){
  let planetId=null,canIssue=false,pendingWarning=null,issuing=false;
  const dialog=$('warning-dialog'),teacherDialog=$('black-star-dialog');
  const confirmation=$('warning-confirm-dialog');
  const releaseConfirmation=$('black-star-confirm-dialog');
  const deleteConfirmation=$('teacher-warning-delete-dialog');
  let releaseTarget=null,releasing=false,deleteTarget=null,deleting=false,teacherMode=null,historyNextOffset=null,historyLoading=false;
  const displayTime=at=>new Date(at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
  const render=data=>{
    $('warning-title').textContent=data.planetName+' · 경고 제어돌';
    $('warning-summary').textContent='경고 '+data.threshold+'회가 쌓이면 검은별이 되어 블랙홀로 이동해요.';
    $('warning-threshold').value=String(data.threshold);
    const options=data.students.filter(p=>p.id!==getSelfId()&&!p.blackStar);
    const selected=$('warning-target').value;
    $('warning-target').replaceChildren(...options.map(p=>{
      const option=document.createElement('option');option.value=p.id;option.textContent=p.nickname+' · 경고 '+p.count+'회';return option;
    }));
    if(options.some(p=>p.id===selected))$('warning-target').value=selected;
    $('warning-issue').disabled=issuing||!canIssue||!options.length;
    $('warning-target').disabled=!canIssue;
    $('warning-reason').disabled=!canIssue;
    $('warning-entries').replaceChildren(...data.entries.slice().reverse().map(e=>{
      const li=document.createElement('li');
      li.textContent=e.targetName+' · '+e.actorName+'이 경고 · '+e.reason+(e.active?'':' · 해제됨');
      return li;
    }));
    if(!data.entries.length){const li=document.createElement('li');li.textContent='아직 경고 기록이 없어요.';$('warning-entries').append(li);}
  };
  async function open(id,allowed){
    planetId=id;canIssue=allowed;$('warning-error').textContent='';
    try{const data=await request('warning:get',{planetId:id});render(data);stop();dialog.showModal();}
    catch(error){toast(error.message);}
  }
  $('warning-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{planetId=null;pendingWarning=null;confirmation.close();$('world').focus();});
  $('warning-threshold-save').onclick=async()=>{
    const button=$('warning-threshold-save');button.disabled=true;
    try{render(await request('warning:threshold:set',{planetId,threshold:Number($('warning-threshold').value)}));toast('검은별 경고 기준을 저장했어요.');}
    catch(error){$('warning-error').textContent=error.message;}finally{button.disabled=false;}
  };
  $('warning-issue').onclick=()=>{
    if(issuing||!canIssue||!planetId)return;
    const targetId=$('warning-target').value,reason=$('warning-reason').value.trim();
    if(!targetId||!reason){$('warning-error').textContent='친구와 경고 이유를 입력해주세요.';return;}
    const targetName=$('warning-target').selectedOptions[0]?.textContent?.split(' · ')[0]||'이 친구';
    // 확인창을 열었을 때의 대상을 보관합니다. 취소 시에는 서버 요청을 보내지 않습니다.
    pendingWarning={planetId,targetId,reason};
    $('warning-confirm-target').textContent=targetName+'에게 경고를 줄까요?';
    $('warning-confirm-reason').textContent=reason;
    $('warning-confirm-yes').disabled=false;
    confirmation.showModal();$('warning-confirm-cancel').focus();
  };
  $('warning-confirm-cancel').onclick=()=>confirmation.close();
  confirmation.addEventListener('close',()=>{pendingWarning=null;if(dialog.open)$('warning-issue').focus();});
  $('warning-confirm-yes').onclick=async()=>{
    if(!pendingWarning||issuing)return;
    const warning=pendingWarning;pendingWarning=null;issuing=true;
    $('warning-confirm-yes').disabled=true;$('warning-issue').disabled=true;
    $('warning-error').textContent='';confirmation.close();
    try{
      const data=await request('warning:issue',warning);
      if(planetId===warning.planetId&&dialog.open){render(data);$('warning-reason').value='';}
      toast(data.blackStar?'경고 기준에 도달해 검은별이 되었어요.':'경고가 추가되었어요.');
    }catch(error){if(planetId===warning.planetId)$('warning-error').textContent=error.message;}
    finally{issuing=false;$('warning-issue').disabled=!canIssue||!$('warning-target').options.length;}
  };
  const renderBlackStars=data=>{
    const list=$('black-star-students');list.replaceChildren();
    $('black-star-empty').hidden=data.students.length>0;
    for(const student of data.students){
      const li=document.createElement('li');
      const name=document.createElement('span');name.textContent=student.nickname+' · '+student.planetName+' 경고';
      const time=document.createElement('time');time.dateTime=new Date(student.at).toISOString();
      time.textContent='검은별 상태가 된 시간: '+displayTime(student.at);name.append(document.createElement('br'),time);
      const button=document.createElement('button');button.className='small secondary';button.type='button';button.textContent='검은별 상태 해제';
      button.disabled=releasing;
      button.onclick=()=>{
        if(releasing)return;
        releaseTarget=student.id;
        $('black-star-confirm-message').textContent=student.nickname+' 친구의 검은별 상태를 해제할까요?';
        $('black-star-confirm-error').textContent='';
        $('black-star-confirm-yes').disabled=false;
        releaseConfirmation.showModal();$('black-star-confirm-cancel').focus();
      };
      li.append(name,button);list.append(li);
    }
  };
  const showTeacherMode=mode=>{
    teacherMode=mode;
    $('teacher-warning-history').hidden=mode!=='history';
    $('teacher-black-star-status').hidden=mode!=='black-star';
    $('teacher-warning-history-tab').setAttribute('aria-pressed',String(mode==='history'));
    $('teacher-black-star-tab').setAttribute('aria-pressed',String(mode==='black-star'));
  };
  const renderTeacherHistory=(data,append)=>{
    const list=$('teacher-warning-entries');if(!append)list.replaceChildren();
    for(const entry of data.entries){
      const li=document.createElement('li'),title=document.createElement('strong'),time=document.createElement('time'),reason=document.createElement('p');
      title.textContent=entry.targetName+' · '+entry.planetName+(entry.active?'':' · 해제됨');
      time.dateTime=new Date(entry.at).toISOString();time.textContent='경고 시간: '+displayTime(entry.at)+' · 준 사람: '+entry.actorName;
      reason.textContent='사유: '+entry.reason;
      li.append(title,time,reason);list.append(li);
      if(entry.active){
        const button=document.createElement('button');button.type='button';button.className='small secondary';button.textContent='경고 삭제';
        button.disabled=deleting;
        button.onclick=()=>{
          deleteTarget=entry.id;
          $('teacher-warning-delete-message').textContent=entry.targetName+' 친구의 경고를 삭제할까요? 사유: '+entry.reason;
          $('teacher-warning-delete-error').textContent='';deleteConfirmation.showModal();$('teacher-warning-delete-cancel').focus();
        };
        li.append(button);
      }
    }
    $('teacher-warning-empty').hidden=list.children.length>0;
    historyNextOffset=data.nextOffset;
    $('teacher-warning-more').hidden=historyNextOffset===null;
  };
  const loadTeacherHistory=async(append=false)=>{
    if(historyLoading)return;
    historyLoading=true;$('teacher-warning-more').disabled=true;
    if(!append){$('teacher-warning-entries').replaceChildren();$('teacher-warning-empty').hidden=true;}
    try{
      const data=await request('warning:teacher:history',{offset:append?historyNextOffset:0});
      if(teacherDialog.open&&teacherMode==='history')renderTeacherHistory(data,append);
    }catch(error){toast(error.message);}
    finally{historyLoading=false;$('teacher-warning-more').disabled=false;}
  };
  $('black-star-confirm-cancel').onclick=()=>releaseConfirmation.close();
  $('teacher-warning-delete-cancel').onclick=()=>deleteConfirmation.close();
  deleteConfirmation.addEventListener('close',()=>{deleteTarget=null;});
  $('teacher-warning-delete-yes').onclick=async()=>{
    if(!deleteTarget||deleting)return;
    const warningId=deleteTarget;deleting=true;$('teacher-warning-delete-yes').disabled=true;
    try{
      const data=await request('warning:teacher:delete',{warningId});
      renderTeacherHistory(data,false);deleteConfirmation.close();
      toast(data.released?'경고를 삭제하고 검은별 상태를 해제했어요.':'경고를 삭제했어요.');
    }catch(error){$('teacher-warning-delete-error').textContent=error.message;}
    finally{deleting=false;$('teacher-warning-delete-yes').disabled=false;for(const button of $('teacher-warning-entries').querySelectorAll('button'))button.disabled=false;}
  };
  releaseConfirmation.addEventListener('close',()=>{releaseTarget=null;});
  $('black-star-confirm-yes').onclick=async()=>{
    if(!releaseTarget||releasing)return;
    const targetId=releaseTarget;releasing=true;$('black-star-confirm-yes').disabled=true;
    try{
      const data=await request('warning:teacher:clear',{targetId});
      renderBlackStars(data);releaseConfirmation.close();toast('검은별 상태를 해제했어요.');
    }catch(error){$('black-star-confirm-error').textContent=error.message;}
    finally{releasing=false;$('black-star-confirm-yes').disabled=false;for(const button of $('black-star-students').querySelectorAll('button'))button.disabled=false;}
  };
  $('black-star-list-button').onclick=async()=>{
    $('teacher-dialog').close();stop();showTeacherMode(null);teacherDialog.showModal();
  };
  $('teacher-warning-history-tab').onclick=()=>{showTeacherMode('history');loadTeacherHistory();};
  $('teacher-warning-more').onclick=()=>{if(historyNextOffset!==null)loadTeacherHistory(true);};
  $('teacher-black-star-tab').onclick=async()=>{
    showTeacherMode('black-star');
    try{const data=await request('warning:teacher:list',{});if(teacherDialog.open&&teacherMode==='black-star')renderBlackStars(data);}
    catch(error){toast(error.message);}
  };
  $('black-star-close').onclick=()=>teacherDialog.close();
  teacherDialog.addEventListener('close',()=>{releaseTarget=null;deleteTarget=null;showTeacherMode(null);releaseConfirmation.close();deleteConfirmation.close();$('world').focus();});
  return {open,reset(){planetId=null;pendingWarning=null;releaseTarget=null;deleteTarget=null;canIssue=false;confirmation.close();releaseConfirmation.close();deleteConfirmation.close();dialog.close();teacherDialog.close();}};
}
