const $=id=>document.getElementById(id);

export function createWarningUI({request,stop,toast,getSelfId}){
  let planetId=null,canIssue=false;
  const dialog=$('warning-dialog'),teacherDialog=$('black-star-dialog');
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
    $('warning-issue').disabled=!canIssue||!options.length;
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
  dialog.addEventListener('close',()=>{planetId=null;$('world').focus();});
  $('warning-threshold-save').onclick=async()=>{
    const button=$('warning-threshold-save');button.disabled=true;
    try{render(await request('warning:threshold:set',{planetId,threshold:Number($('warning-threshold').value)}));toast('검은별 경고 기준을 저장했어요.');}
    catch(error){$('warning-error').textContent=error.message;}finally{button.disabled=false;}
  };
  $('warning-issue').onclick=async()=>{
    const targetId=$('warning-target').value,reason=$('warning-reason').value.trim();
    if(!targetId||!reason){$('warning-error').textContent='친구와 경고 이유를 입력해주세요.';return;}
    const targetName=$('warning-target').selectedOptions[0]?.textContent?.split(' · ')[0]||'이 친구';
    if(!confirm(targetName+'에게 경고를 바로 부여할까요? 취소하려면 취소를 누르세요.'))return;
    const button=$('warning-issue');button.disabled=true;$('warning-error').textContent='';
    try{const data=await request('warning:issue',{planetId,targetId,reason});render(data);$('warning-reason').value='';toast(data.blackStar?'경고 기준에 도달해 검은별이 되었어요.':'경고가 추가되었어요.');}
    catch(error){$('warning-error').textContent=error.message;}finally{button.disabled=false;}
  };
  const renderBlackStars=data=>{
    const list=$('black-star-students');list.replaceChildren();
    $('black-star-empty').hidden=data.students.length>0;
    for(const student of data.students){
      const li=document.createElement('li');
      const name=document.createElement('span');name.textContent=student.nickname+' · '+student.planetName+' 경고';
      const button=document.createElement('button');button.className='small secondary';button.type='button';button.textContent='검은별 상태 해제';
      button.onclick=async()=>{
        if(!confirm(student.nickname+' 친구의 검은별 상태를 해제할까요?'))return;
        button.disabled=true;
        try{renderBlackStars(await request('warning:teacher:clear',{targetId:student.id}));toast('검은별 상태를 해제했어요.');}
        catch(error){toast(error.message);button.disabled=false;}
      };
      li.append(name,button);list.append(li);
    }
  };
  $('black-star-list-button').onclick=async()=>{
    try{const data=await request('warning:teacher:list',{});renderBlackStars(data);$('teacher-dialog').close();stop();teacherDialog.showModal();}
    catch(error){toast(error.message);}
  };
  $('black-star-close').onclick=()=>teacherDialog.close();
  teacherDialog.addEventListener('close',()=>$('world').focus());
  return {open};
}
