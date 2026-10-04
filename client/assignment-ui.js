export function createAssignmentUI({request,stop,toast}){
  const dialog=document.createElement('dialog');dialog.id='assignment-dialog';dialog.setAttribute('aria-labelledby','assignment-title');
  dialog.innerHTML='<h2 id="assignment-title">✨ 과제별서고</h2><p class="muted">학생은 작성중·제출 상태를 고르고, 선생님이 확인하면 완료돼요.</p><button id="assignment-incomplete-button" class="small secondary" type="button" hidden>과제 미완료자</button><section id="assignment-main"><div id="assignment-weeks" class="assignment-weeks" role="tablist" aria-label="최근 3주"></div><h3 id="assignment-week-title"></h3><div id="assignment-items"></div><section id="assignment-detail" hidden><h3 id="assignment-selected"></h3><p id="assignment-my-status" hidden></p><div id="assignment-status-actions" class="assignment-status-actions" hidden><button id="assignment-working" class="small secondary" type="button">작성중</button><button id="assignment-submit" class="small primary" type="button">제출</button></div><section id="assignment-submitted-section" hidden><h4>제출 · 확인 대기</h4><ul id="assignment-submitted" class="warning-list"></ul></section><h4>완료한 친구</h4><ol id="assignment-completed" aria-label="과제 완료한 친구"></ol></section></section><section id="assignment-incomplete-panel" hidden><h3>과제 미완료자</h3><ul id="assignment-incomplete-list" class="assignment-incomplete-list"></ul><p id="assignment-incomplete-empty" class="muted" hidden></p></section><p id="assignment-error" role="alert"></p><div class="dialog-actions"><button id="assignment-close" class="secondary" type="button">닫기</button></div>';
  document.body.append(dialog);
  const $=id=>dialog.querySelector('#assignment-'+id);
  let data=null,weekIndex=0,selectedId=null,revision=0,busy=false;
  $('close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{revision++;document.getElementById('world').focus();});
  const currentAssignment=()=>data?.weeks[weekIndex]?.assignments.find(a=>a.id===selectedId);
  function selectAssignment(assignment){
    selectedId=assignment.id;$('detail').hidden=false;$('selected').textContent=assignment.text;
    $('completed').replaceChildren(...assignment.completed.map(name=>{const li=document.createElement('li');li.textContent=name;return li;}));
    if(!assignment.completed.length){const li=document.createElement('li');li.textContent='아직 완료한 친구가 없어요.';$('completed').append(li);}
    $('my-status').hidden=data.canConfirm;
    $('status-actions').hidden=data.canConfirm||assignment.myStatus==='completed';
    if(!data.canConfirm)$('my-status').textContent='내 상태: '+({working:'작성중',submitted:'제출 · 확인 대기',completed:'완료','not-started':'미작성'}[assignment.myStatus]||'미작성');
    $('working').disabled=busy||assignment.myStatus==='working';$('submit').disabled=busy||assignment.myStatus==='submitted';
    $('submitted-section').hidden=!data.canConfirm;
    const list=$('submitted');list.replaceChildren();
    if(data.canConfirm){
      for(const student of assignment.submitted||[]){
        const li=document.createElement('li'),name=document.createElement('span'),button=document.createElement('button');
        name.textContent=student.nickname;button.type='button';button.className='small primary';button.textContent='과제 확인';button.disabled=busy;
        button.onclick=()=>confirmAssignment(assignment.id,student.id);li.append(name,button);list.append(li);
      }
      if(!list.children.length){const li=document.createElement('li');li.textContent='확인을 기다리는 과제가 없어요.';list.append(li);}
    }
  }
  function selectWeek(index){
    weekIndex=index;selectedId=null;const week=data.weeks[index];
    for(const [i,button] of [...$('weeks').children].entries()){button.classList.toggle('selected',i===index);button.setAttribute('aria-selected',String(i===index));}
    $('week-title').textContent=week.week?week.label+' · '+week.week+' 시작':week.label;$('detail').hidden=true;
    const list=document.createElement('ul');list.className='assignment-items';
    for(const assignment of week.assignments){const li=document.createElement('li'),button=document.createElement('button');
      button.type='button';button.className='secondary';button.textContent=assignment.text+' · 완료 '+assignment.completed.length+'명';
      button.onclick=()=>selectAssignment(assignment);li.append(button);list.append(li);}
    if(!week.assignments.length){const li=document.createElement('li');li.textContent='이 주에는 아직 과제가 없어요.';list.append(li);}
    $('items').replaceChildren(list);
  }
  function render(){
    $('incomplete-button').hidden=!data.canConfirm;
    $('weeks').replaceChildren(...data.weeks.map((week,index)=>{
      const button=document.createElement('button');button.type='button';button.className='small secondary';
      button.textContent=week.label;button.setAttribute('role','tab');button.onclick=()=>selectWeek(index);return button;
    }));
    selectWeek(weekIndex);
  }
  function refreshSelection(result,id){data=result;weekIndex=Math.min(weekIndex,data.weeks.length-1);render();const assignment=data.weeks[weekIndex].assignments.find(value=>value.id===id);if(assignment)selectAssignment(assignment);}
  async function setStatus(status){
    const assignment=currentAssignment();if(!assignment||busy)return;
    busy=true;$('working').disabled=true;$('submit').disabled=true;$('error').textContent='';
    try{refreshSelection(await request('assignment:status:set',{assignmentId:assignment.id,status}),assignment.id);toast(status==='submitted'?'과제를 제출했어요. 선생님의 확인을 기다려요.':'작성중으로 바꿨어요.');}
    catch(error){$('error').textContent=error.message;}finally{busy=false;const current=currentAssignment();if(current)selectAssignment(current);}
  }
  async function confirmAssignment(assignmentId,studentId){
    if(busy)return;busy=true;$('error').textContent='';
    for(const button of $('submitted').querySelectorAll('button'))button.disabled=true;
    try{refreshSelection(await request('assignment:confirm',{assignmentId,studentId}),assignmentId);toast('과제 확인을 마쳤어요.');}
    catch(error){$('error').textContent=error.message;}finally{busy=false;const current=currentAssignment();if(current)selectAssignment(current);}
  }
  $('working').onclick=()=>setStatus('working');$('submit').onclick=()=>setStatus('submitted');
  function renderIncomplete(result){
    const list=$('incomplete-list');list.replaceChildren();
    for(const student of result.students){
      const li=document.createElement('li'),name=document.createElement('strong'),details=document.createElement('ul');name.textContent=student.nickname;
      for(const task of student.missing){const row=document.createElement('li');row.textContent='미제출 · '+task.text;details.append(row);}
      for(const task of student.pending){const row=document.createElement('li');row.textContent='제출 · 확인 대기 · '+task.text;details.append(row);}
      li.append(name,details);list.append(li);
    }
    $('incomplete-empty').hidden=result.students.length>0;
    $('incomplete-empty').textContent=result.assignmentCount?'진행 중인 과제는 모두 완료했어요.':'등록된 과제가 없어요.';
  }
  $('incomplete-button').onclick=async()=>{
    if(!$('incomplete-panel').hidden){$('incomplete-panel').hidden=true;$('main').hidden=false;$('incomplete-button').textContent='과제 미완료자';return;}
    try{const result=await request('assignment:incomplete',{});if(!dialog.open)return;renderIncomplete(result);$('main').hidden=true;$('incomplete-panel').hidden=false;$('incomplete-button').textContent='과제로 돌아가기';}
    catch(error){$('error').textContent=error.message;}
  };
  async function open(){
    const rev=++revision;
    try{const result=await request('assignment:read',{});if(rev!==revision)return;data=result;weekIndex=0;selectedId=null;$('main').hidden=false;$('incomplete-panel').hidden=true;$('incomplete-button').textContent='과제 미완료자';$('error').textContent='';stop();render();dialog.showModal();}
    catch(error){toast(error.message);}
  }
  return {open};
}
