export function createAssignmentUI({request,stop,toast}){
  const dialog=document.createElement('dialog');dialog.id='assignment-dialog';dialog.setAttribute('aria-labelledby','assignment-title');
  dialog.innerHTML='<h2 id="assignment-title">✨ 과제안드로메다</h2><p class="muted">최근 3주의 과제와 완료한 친구를 확인해요.</p><div id="assignment-weeks" class="assignment-weeks" role="tablist" aria-label="최근 3주"></div><h3 id="assignment-week-title"></h3><div id="assignment-items"></div><h3 id="assignment-selected" hidden></h3><ol id="assignment-completed" aria-label="과제 완료한 친구" hidden></ol><p id="assignment-error" role="alert"></p><div class="dialog-actions"><button id="assignment-close" class="secondary" type="button">닫기</button></div>';
  document.body.append(dialog);
  const $=id=>dialog.querySelector('#assignment-'+id);
  let data=null,weekIndex=0,revision=0;
  $('close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{revision++;document.getElementById('world').focus();});
  function selectAssignment(assignment){
    $('selected').hidden=false;$('selected').textContent=assignment.text;
    $('completed').hidden=false;
    $('completed').replaceChildren(...assignment.completed.map(name=>{
      const li=document.createElement('li');li.textContent=name;return li;
    }));
    if(!assignment.completed.length){const li=document.createElement('li');li.textContent='아직 완료한 친구가 없어요.';$('completed').append(li);}
  }
  function selectWeek(index){
    weekIndex=index;const week=data.weeks[index];
    for(const [i,button] of [...$('weeks').children].entries()){button.classList.toggle('selected',i===index);button.setAttribute('aria-selected',String(i===index));}
    $('week-title').textContent=week.label+' · '+week.week+' 시작';
    $('selected').hidden=true;$('completed').hidden=true;
    const list=document.createElement('ul');list.className='assignment-items';
    for(const assignment of week.assignments){const li=document.createElement('li'),button=document.createElement('button');
      button.type='button';button.className='secondary';button.textContent=assignment.text+' · 완료 '+assignment.completed.length+'명';
      button.onclick=()=>selectAssignment(assignment);li.append(button);list.append(li);}
    if(!week.assignments.length){const li=document.createElement('li');li.textContent='이 주에는 아직 과제가 없어요.';list.append(li);}
    $('items').replaceChildren(list);
  }
  function render(){
    $('weeks').replaceChildren(...data.weeks.map((week,index)=>{
      const button=document.createElement('button');button.type='button';button.className='small secondary';
      button.textContent=week.label;button.setAttribute('role','tab');button.onclick=()=>selectWeek(index);return button;
    }));
    selectWeek(0);
  }
  async function open(){
    const rev=++revision;
    try{const result=await request('assignment:read',{});if(rev!==revision)return;data=result;stop();render();dialog.showModal();}
    catch(error){toast(error.message);}
  }
  return {open};
}
