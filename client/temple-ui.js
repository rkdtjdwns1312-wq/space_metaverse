import {itemOf} from '/shared/config.js';

export function createTempleUI({request,stop,toast,getRoom}){
  const dialog=document.createElement('dialog');dialog.id='temple-dialog';dialog.setAttribute('aria-labelledby','temple-title');
  // 고정된 화면 뼈대만 HTML로 만듭니다. 학생 이름·교사 내용은 모두 textContent로 넣습니다.
  dialog.innerHTML='<header><h2 id="temple-title"></h2><button id="temple-close" type="button" class="secondary">닫기</button></header><p id="temple-description"></p><div id="temple-content" tabindex="0"></div><label id="temple-label" for="temple-editor" hidden>선생님 내용 입력</label><textarea id="temple-editor" rows="8" maxlength="2000" hidden></textarea><p id="temple-error" role="alert"></p><button id="temple-save" class="primary" type="button" hidden>저장하기</button><button id="temple-refresh" class="secondary" type="button" hidden>새로 보기</button>';
  document.body.append(dialog);const $=id=>dialog.querySelector('#temple-'+id);let selected=null,result=null,revision=0;
  $('close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{selected=null;result=null;revision++;});
  function renderEffects(){
    const rows=(getRoom()?.players||[]).flatMap(p=>(p.effects||[]).filter(e=>e.until>Date.now()).map(e=>({nickname:p.nickname,...e})));
    const ul=document.createElement('ul');
    for(const r of rows){const li=document.createElement('li');li.textContent=r.nickname+' · '+(itemOf(r.itemId)?.name||r.label)+' · '+Math.ceil((r.until-Date.now())/1000)+'초 남음';ul.append(li);}
    $('content').replaceChildren(rows.length?ul:Object.assign(document.createElement('p'),{textContent:'지금 사용 중인 아이템이 없어요.'}));
  }
  function render(){
    $('error').textContent='';const daily=['notice','timetable'].includes(result.kind);
    $('save').hidden=!result.canEdit;$('editor').hidden=!result.canEdit;$('label').hidden=!result.canEdit;$('refresh').hidden=daily;
    if(daily){$('description').textContent=result.date+' · 오늘';$('content').textContent=result.text||'선생님이 아직 내용을 등록하지 않았어요.';$('editor').value=result.text;}
    else if(result.kind==='weekly'){
      $('description').textContent=result.week+' 월요일부터 이번 주에 받은 별 파편 · 잔액과 달라요';const ul=document.createElement('ul');
      for(const r of result.rows){const li=document.createElement('li');li.textContent=r.nickname+' · ★ '+r.total+'개';ul.append(li);}
      $('content').replaceChildren(result.rows.length?ul:Object.assign(document.createElement('p'),{textContent:'아직 등록된 친구가 없어요.'}));
    }else{$('description').textContent='지금 효과가 남아 있는 아이템이에요.';renderEffects();}
  }
  async function load(){const rev=++revision;try{const data=await request('temple:read',{objectId:selected.id});if(rev!==revision||!dialog.open)return;result=data;render();}catch(e){if(rev===revision)$('error').textContent=e.message;}}
  $('refresh').onclick=load;
  $('save').onclick=async()=>{if(!selected)return;const rev=revision;$('save').disabled=true;try{const data=await request('temple:save',{objectId:selected.id,text:$('editor').value});if(rev===revision&&dialog.open){result=data;render();toast('오늘의 내용을 저장했어요.');}}catch(e){if(rev===revision)$('error').textContent=e.message;}finally{$('save').disabled=false;}};
  setInterval(()=>{if(dialog.open&&result?.kind==='effects')renderEffects();},1000);
  return {open(pillar){stop();selected=pillar;result=null;$('title').textContent=pillar.name;$('description').textContent='불러오는 중…';$('content').replaceChildren();$('error').textContent='';for(const id of ['label','editor','save','refresh'])$(id).hidden=true;if(!dialog.open)dialog.showModal();load();}};
}
