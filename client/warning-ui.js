const $=id=>document.getElementById(id);

export function createWarningUI({request,stop,toast,getSelfId}){
  let planetId=null,canIssue=false,pendingWarning=null,issuing=false;
  const dialog=$('warning-dialog'),teacherDialog=$('black-star-dialog');
  const confirmation=$('warning-confirm-dialog');
  const releaseConfirmation=$('black-star-confirm-dialog');
  let releaseTarget=null,releasing=false;
  const render=data=>{
    $('warning-title').textContent=data.planetName+' · 경고 돌덩이';
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
  $('black-star-confirm-cancel').onclick=()=>releaseConfirmation.close();
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
    try{const data=await request('warning:teacher:list',{});renderBlackStars(data);$('teacher-dialog').close();stop();teacherDialog.showModal();}
    catch(error){toast(error.message);}
  };
  $('black-star-close').onclick=()=>teacherDialog.close();
  teacherDialog.addEventListener('close',()=>{releaseTarget=null;releaseConfirmation.close();$('world').focus();});
  return {open,reset(){planetId=null;pendingWarning=null;releaseTarget=null;canIssue=false;confirmation.close();releaseConfirmation.close();dialog.close();teacherDialog.close();}};
}
