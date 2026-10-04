import {itemOf} from '/shared/config.js';

export function createTeacherCardCatalog({request,getPlayer,stop=()=>{},toast=()=>{}}){
  const css=document.createElement('link');css.rel='stylesheet';css.href='/teacher-card-catalog.css';document.head.append(css);
  const footer=document.querySelector('#inventory-dialog > .dialog-actions'),buttons=document.createElement('div');
  buttons.id='teacher-card-catalog-buttons';buttons.hidden=true;footer.prepend(buttons);
  const dialog=document.createElement('dialog');dialog.id='teacher-card-catalog-dialog';dialog.setAttribute('aria-labelledby','teacher-card-catalog-title');
  dialog.innerHTML='<header class="teacher-catalog-dialog-heading"><h2 id="teacher-card-catalog-title"></h2><button type="button" id="teacher-card-catalog-edit" class="secondary" hidden>수정하기</button></header><p id="teacher-card-catalog-summary" role="status"></p><div id="teacher-card-catalog-list"></div><div class="dialog-actions"><button type="button" id="teacher-card-catalog-save-silver" class="secondary" hidden>저장하기</button><button type="button" class="secondary">닫기</button></div>';
  document.body.append(dialog);
  const title=dialog.querySelector('h2'),summary=dialog.querySelector('p'),list=dialog.querySelector('#teacher-card-catalog-list'),editButton=dialog.querySelector('#teacher-card-catalog-edit'),silverSave=dialog.querySelector('#teacher-card-catalog-save-silver');
  let revision=0;
  let catalogData=null,currentKind=null,editing=false;
  const teacher=()=>getPlayer()?.role==='teacher';
  function text(tag,value,parent){const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;}
  function render(data,kind){
    list.replaceChildren();const gold=kind==='gold',entries=gold?data.gold:data.silver;
    summary.textContent=gold?`금별 카드 ${entries.length}종 · 효과를 확인하세요.`:`은별 뽑기 ${data.silverTotal}장 · ${entries.length}종의 보상과 구성 장수예요.`;
    if(gold&&editing)text('p','표시 문구 수정이며 실제 보상·효과의 작동 규칙은 바뀌지 않아요.',list).className='teacher-catalog-edit-note';
    for(const card of entries){
      const article=document.createElement('article');article.className='teacher-catalog-card';
      const heading=document.createElement('div');heading.className='teacher-catalog-heading';
      if(!gold&&card.kind==='item'&&itemOf(card.itemId)?.art){const img=document.createElement('img');img.src=itemOf(card.itemId).art;img.alt='';img.loading='lazy';heading.append(img);}
      text('h3',card.name,heading);if(!gold&&!editing)text('span',`${card.count}장`,heading).className='teacher-catalog-count';article.append(heading);
      if(gold&&editing){
        const form=document.createElement('div');form.className='teacher-catalog-fields';
        for(const [field,label,value,multiline] of [['name','이름',card.name,false],['description','소개',card.description||'',true],['effect','효과',card.effect||'',true]]){
          const wrapper=document.createElement('label');wrapper.className='teacher-catalog-field';text('span',label,wrapper);
          const input=document.createElement(multiline?'textarea':'input');input.dataset.field=field;input.value=value;if(field==='name')input.maxLength=80;if(multiline)input.rows=field==='description'?3:4;wrapper.append(input);form.append(wrapper);
        }
        const save=document.createElement('button');save.type='button';save.className='secondary teacher-catalog-save';save.textContent='저장하기';
        const status=document.createElement('p');status.className='teacher-catalog-save-status';status.setAttribute('role','status');
        save.onclick=()=>saveCard(card,article,save,status);
        article.append(form,save,status);
      }else if(gold){text('p',card.effect,article).className='teacher-catalog-effect';
        if(card.description)text('p',card.description,article).className='teacher-catalog-note';
        for(const note of [...card.automatic,...card.manual])text('p',note,article).className='teacher-catalog-note';
      }else{
        const reward=card.kind==='shards'?`별 파편 ${card.amount}개`:card.kind==='xp'?`경험치 ${card.amount}`:card.kind==='item'?`${card.name} ${card.amount}개`:'추가 보상 없음';
        text('p',reward,article).className='teacher-catalog-effect';
        if(card.kind==='item'){const item=itemOf(card.itemId);if(item?.description)text('p',item.description,article).className='teacher-catalog-note';}
        if(editing){const wrapper=document.createElement('label');wrapper.className='teacher-catalog-field teacher-catalog-count-field';text('span','구성 장수',wrapper);const input=document.createElement('input');input.type='number';input.min='0';input.max='200';input.step='1';input.dataset.field='count';input.value=String(card.count);wrapper.append(input);article.append(wrapper);}
      }
      list.append(article);
    }
    editButton.hidden=false;
    editButton.textContent=editing?'수정 닫기':'수정하기';
    silverSave.hidden=gold||!editing;
  }
  function hasUnsavedChanges(){
    if(!editing||!catalogData)return false;
    return [...list.querySelectorAll('.teacher-catalog-card')].some((article,index)=>{
      const card=(currentKind==='gold'?catalogData.gold:catalogData.silver)[index];
      return [...article.querySelectorAll('[data-field]')].some(input=>input.value!==String(card[input.dataset.field]??''));
    });
  }
  function toggleEditing(){
    if(!editing){editing=true;render(catalogData,currentKind);return;}
    if(hasUnsavedChanges()){
      confirmDiscard(()=>{editing=false;render(catalogData,currentKind);});return;
    }
    editing=false;render(catalogData,currentKind);
  }
  function confirmDiscard(onDiscard){
    list.querySelector('.teacher-catalog-unsaved')?.remove();
    const notice=document.createElement('div');notice.className='teacher-catalog-unsaved';notice.setAttribute('role','alert');
    text('p','저장하지 않은 변경 사항이 있어요. 닫으면 입력 내용이 사라집니다.',notice);
    const keep=document.createElement('button');keep.type='button';keep.className='secondary';keep.textContent='계속 편집';keep.onclick=()=>notice.remove();
    const discard=document.createElement('button');discard.type='button';discard.className='secondary';discard.textContent='저장하지 않고 닫기';discard.onclick=()=>{notice.remove();onDiscard();};
    notice.append(keep,discard);list.prepend(notice);notice.scrollIntoView({block:'nearest'});
  }
  function closeDialog(){if(hasUnsavedChanges())confirmDiscard(()=>dialog.close());else dialog.close();}
  async function saveCard(card,article,button,status){
    const current=revision;
    const fields=Object.fromEntries([...article.querySelectorAll('[data-field]')].map(input=>[input.dataset.field,input.value.trim()]));
    if(!fields.name){status.textContent='카드 이름을 입력해 주세요.';return;}
    button.disabled=true;status.textContent='저장하고 있어요.';
    try{
      const result=await request('teacher:cards:update',{id:card.id,name:fields.name,description:fields.description,effect:fields.effect});
      if(current!==revision||!teacher()||!dialog.open||currentKind!=='gold'||!article.isConnected)return;
      if(!result?.card)throw new Error('저장 응답을 확인하지 못했어요.');
      const index=catalogData.gold.findIndex(entry=>entry.id===card.id);
      if(index>=0)catalogData.gold[index]={...catalogData.gold[index],...result.card};
      article.querySelector('h3').textContent=result.card.name;
      status.textContent='저장 완료';button.disabled=false;
      toast('카드가 저장되었습니다.');
    }catch(error){if(current===revision&&article.isConnected){status.textContent=error?.message||'카드를 저장하지 못했어요.';button.disabled=false;}}
  }
  silverSave.onclick=async()=>{
    const current=revision,counts=[...list.querySelectorAll('[data-field="count"]')].map(input=>Number(input.value));
    const total=counts.reduce((sum,count)=>sum+count,0);
    if(counts.length!==catalogData?.silver.length||counts.some(count=>!Number.isSafeInteger(count)||count<0||count>200)||total<1||total>500){summary.textContent='각 카드 0~200장, 전체 1~500장으로 입력해주세요.';return;}
    silverSave.disabled=true;summary.textContent='카드 구성을 저장하고 있어요.';
    try{const data=await request('teacher:cards:silver:update',{counts});
      if(current!==revision||!teacher()||!dialog.open||currentKind!=='silver')return;
      catalogData=data;editing=false;render(data,'silver');toast('뽑기카드 구성을 저장했어요.');
    }catch(error){if(current===revision&&dialog.open)summary.textContent=error?.message||'카드 구성을 저장하지 못했어요.';}
    finally{if(current===revision)silverSave.disabled=false;}
  };
  editButton.onclick=toggleEditing;
  dialog.querySelector(':scope > .dialog-actions button:last-child').onclick=closeDialog;
  dialog.addEventListener('cancel',event=>{if(hasUnsavedChanges()){event.preventDefault();closeDialog();}});
  async function open(kind){
    if(!teacher())return;stop();const current=++revision;catalogData=null;currentKind=kind;editing=false;title.textContent=kind==='gold'?'별카드 보기':'뽑기카드 보기';editButton.hidden=true;summary.textContent='카드 목록을 불러오고 있어요.';list.replaceChildren();dialog.showModal();
    try{const data=await request('teacher:cards:catalog',{});if(current===revision&&teacher()&&dialog.open){catalogData=data;render(data,kind);}}
    catch(error){if(current===revision){summary.textContent='목록을 불러오지 못했어요. 창을 닫고 다시 열어주세요.';toast(error.message);}}
  }
  for(const [kind,label] of [['gold','별카드 보기'],['silver','뽑기카드 보기']]){
    const b=document.createElement('button');b.type='button';b.className='secondary small';b.dataset.catalog=kind;b.textContent=label;b.onclick=()=>open(kind);buttons.append(b);
  }
  function reset(){revision++;buttons.hidden=true;editing=false;catalogData=null;dialog.close();list.replaceChildren();}
  function update(){buttons.hidden=!teacher();if(!teacher()&&dialog.open)reset();}
  dialog.addEventListener('close',()=>{revision++;});update();return {update,reset};
}
