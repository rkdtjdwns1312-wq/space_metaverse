import {itemOf} from '/shared/config.js';

export function createTempleUI({request,stop,toast,getRoom,getSelfId}){
  const dialog=document.createElement('dialog');dialog.id='temple-dialog';dialog.setAttribute('aria-labelledby','temple-title');
  // 고정된 화면 뼈대만 HTML로 만듭니다. 학생 이름·교사 내용은 모두 textContent로 넣습니다.
  dialog.innerHTML='<header><h2 id="temple-title"></h2><button id="temple-close" type="button" class="secondary">닫기</button></header><p id="temple-description"></p><div id="temple-content" tabindex="0"></div><div id="temple-notice-rows" hidden></div><button id="temple-add-line" type="button" class="secondary" hidden>줄 추가</button><p id="temple-error" role="alert"></p><button id="temple-save" class="primary" type="button" hidden>저장하기</button><button id="temple-refresh" class="secondary" type="button" hidden>새로 보기</button>';
  document.body.append(dialog);const $=id=>dialog.querySelector('#temple-'+id);let selected=null,result=null,revision=0;
  $('close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{selected=null;result=null;revision++;});
  function renderEffects(){
    const rows=(getRoom()?.players||[]).flatMap(p=>(p.effects||[]).filter(e=>e.until>Date.now()).map(e=>({nickname:p.nickname,...e})));
    const ul=document.createElement('ul');
    for(const r of rows){const li=document.createElement('li');li.textContent=r.nickname+' · '+(itemOf(r.itemId)?.name||r.label)+' · '+Math.ceil((r.until-Date.now())/1000)+'초 남음';ul.append(li);}
    $('content').replaceChildren(rows.length?ul:Object.assign(document.createElement('p'),{textContent:'지금 사용 중인 아이템이 없어요.'}));
  }
  function renumberNoticeRows(){[...$('notice-rows').children].forEach((row,index)=>{row.querySelector('.notice-line').setAttribute('aria-label',`${index+1}번째 알림 내용`);row.querySelector('.notice-task input').setAttribute('aria-label',`${index+1}번째 줄 과제`);row.querySelector('.notice-remove-line').setAttribute('aria-label',`${index+1}번째 줄 삭제`);});}
  function addNoticeRow(value='',checked=false,focus=false){const rows=$('notice-rows'),index=rows.children.length,row=document.createElement('div');row.className='notice-editor-row';
    const input=document.createElement('input');input.type='text';input.className='notice-line';input.maxLength=2000;input.value=value;input.setAttribute('aria-label',`${index+1}번째 알림 내용`);input.placeholder='알림 내용을 입력하세요';
    const label=document.createElement('label');label.className='notice-task';const check=document.createElement('input');check.type='checkbox';check.checked=checked;check.setAttribute('aria-label',`${index+1}번째 줄 과제`);label.append(check,document.createTextNode('과제'));
    const remove=document.createElement('button');remove.type='button';remove.className='small secondary notice-remove-line';remove.textContent='삭제';remove.setAttribute('aria-label',`${index+1}번째 줄 삭제`);remove.onclick=()=>{row.remove();if(!rows.children.length)addNoticeRow();renumberNoticeRows();};
    row.append(input,label,remove);rows.append(row);if(focus)input.focus();}
  function renderNoticeRows(){
    if(result?.kind!=='notice'||!result.canEdit)return;
    const rows=$('notice-rows'),marked=new Set((result.taskLines||[]).map(row=>row.lineIndex));rows.replaceChildren();
    String(result.text||'').split('\n').forEach((line,index)=>addNoticeRow(line,marked.has(index)));
  }
  $('add-line').onclick=()=>addNoticeRow('',false,true);
  function renderNotice(){
    const rows=(result.text||'').split('\n').map((text,index)=>({text:text.trim(),index})).filter(row=>row.text);
    if(!rows.length){$('content').textContent='선생님이 아직 내용을 등록하지 않았어요.';return;}
    const marked=new Map((result.taskLines||[]).map(row=>[row.lineIndex,row.assignmentId]));
    const own=getRoom()?.players.find(p=>p.id===getSelfId()),tasks=own?.tasks||[],list=document.createElement('ul');list.className='notice-lines';
    for(const row of rows){
      const li=document.createElement('li'),span=document.createElement('span');span.textContent=row.text;li.append(span);
      if(marked.has(row.index)){
        if(result.canEdit){const badge=document.createElement('small');badge.textContent='과제';li.append(badge);}
        else{
          const button=document.createElement('button');button.type='button';button.className='small secondary';
          const copied=tasks.some(task=>task.assignmentId===marked.get(row.index));
          button.textContent=copied?'가져왔어요':'과제로 가져오기';button.disabled=copied;
          button.onclick=async()=>{button.disabled=true;try{await request('task:add',{lineIndex:row.index,assignmentId:marked.get(row.index)});button.textContent='가져왔어요';toast('나의 과제에 추가했어요.');}
            catch(error){button.disabled=false;toast(error.message);}};
          li.append(button);
        }
      }
      list.append(li);
    }
    $('content').replaceChildren(list);
  }
  function renderTimetable(){
    const days=['월','화','수','목','금'];
    const cells=Array.isArray(result.cells)?result.cells:Array.from({length:6},()=>Array(5).fill(''));
    const table=document.createElement('table');table.className='timetable-table';
    const caption=document.createElement('caption');caption.textContent='오늘의 우주 시간표';table.append(caption);
    const head=document.createElement('thead');const hr=document.createElement('tr');const corner=document.createElement('th');corner.scope='col';corner.textContent='교시';hr.append(corner);
    for(const day of days){const th=document.createElement('th');th.scope='col';th.textContent=day;hr.append(th);}head.append(hr);table.append(head);
    const body=document.createElement('tbody');
    for(let row=0;row<6;row++){const tr=document.createElement('tr');const th=document.createElement('th');th.scope='row';th.textContent=`${row+1}교시`;tr.append(th);
      for(let col=0;col<5;col++){const td=document.createElement('td');const label=`${days[col]}요일 ${row+1}교시 과목`;if(result.canEdit){const input=document.createElement('input');input.type='text';input.maxLength=20;input.value=String(cells[row]?.[col]??'');input.setAttribute('aria-label',label);input.placeholder='과목';td.append(input);}else{const subject=String(cells[row]?.[col]||'');td.textContent=subject;td.title=subject;td.setAttribute('aria-label',subject?`${label}: ${subject}`:label);}tr.append(td);}body.append(tr);}
    table.append(body);$('content').replaceChildren(table);
  }
  function render(){
    $('error').textContent='';const daily=['notice','timetable'].includes(result.kind);
    $('save').hidden=!result.canEdit;$('content').hidden=result.kind==='notice'&&result.canEdit;$('notice-rows').hidden=result.kind!=='notice'||!result.canEdit;$('add-line').hidden=result.kind!=='notice'||!result.canEdit;$('refresh').hidden=daily;
    if(result.kind==='timetable'){$('description').textContent='월요일부터 금요일까지 · 선생님이 채우는 우주 시간표';renderTimetable();}
    else if(daily){$('description').textContent=result.date+' · 오늘';if(result.canEdit)renderNoticeRows();else renderNotice();}
    else if(result.kind==='weekly'){
      $('description').textContent=result.week+' 월요일부터 이번 주에 받은 별 파편 · 잔액과 달라요';const ul=document.createElement('ul');
      for(const r of result.rows){const li=document.createElement('li');li.textContent=r.nickname+' · ★ '+r.total+'개';ul.append(li);}
      $('content').replaceChildren(result.rows.length?ul:Object.assign(document.createElement('p'),{textContent:'아직 등록된 친구가 없어요.'}));
    }else{$('description').textContent='지금 효과가 남아 있는 아이템이에요.';renderEffects();}
  }
  async function load(){const rev=++revision;try{const data=await request('temple:read',{objectId:selected.id});if(rev!==revision||!dialog.open)return;result=data;render();}catch(e){if(rev===revision)$('error').textContent=e.message;}}
  $('refresh').onclick=load;
  $('save').onclick=async()=>{if(!selected)return;const rev=revision;$('save').disabled=true;try{let data;if(result?.kind==='timetable'){const cells=[...$('content').querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('input')].map(input=>input.value));data=await request('temple:timetable:save',{objectId:selected.id,cells});}else{const rows=[...$('notice-rows').children].map(row=>({text:row.querySelector('.notice-line').value.trim(),task:row.querySelector('.notice-task input').checked})).filter(row=>row.text);const text=rows.map(row=>row.text).join('\n');if(text.length>2000)throw new Error('알림장은 2000자 이내로 적어주세요.');const taskLineIndexes=rows.flatMap((row,index)=>row.task?[index]:[]);data=await request('temple:save',{objectId:selected.id,text,taskLineIndexes});}if(rev===revision&&dialog.open){result=data;render();toast(result.kind==='timetable'?'시간표를 저장했어요.':'오늘의 내용을 저장했어요.');}}catch(e){if(rev===revision)$('error').textContent=e.message;}finally{$('save').disabled=false;}};
  setInterval(()=>{if(dialog.open&&result?.kind==='effects')renderEffects();},1000);
  return {open(pillar){stop();selected=pillar;result=null;$('title').textContent=pillar.name;$('description').textContent='불러오는 중…';$('content').replaceChildren();$('error').textContent='';for(const id of ['notice-rows','add-line','save','refresh'])$(id).hidden=true;if(!dialog.open)dialog.showModal();load();}};
}
