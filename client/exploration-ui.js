// 서버가 고른 카드와 합계를 그대로 보여 줍니다. 카드 선택이나 재화 계산은 화면에서 하지 않습니다.
export function createExplorationUI({request,stop,toast}){
  const dialog=document.createElement('dialog');dialog.id='exploration-dialog';dialog.setAttribute('aria-label','우주 탐사');document.body.append(dialog);
  let state=null,selected=null,busy=false,viewPanel=null,editing=false;
  const node=(tag,text,className)=>Object.assign(document.createElement(tag),{textContent:text??'',className:className??''});
  function cardView(result){
    const card=node('div','','exploration-card');card.dataset.energy=String(result?.card?.energy??0);
    const seal=node('div','우주 탐사 결과','exploration-card-seal');
    const title=node('h3',result?.card?.title||'다음 이야기를 기다려요');
    const story=node('p',result?.card?.story||'아직 탐사 결과가 없습니다.','exploration-card-story');
    const reward=node('p',result?`찬란한 별의 기운을 ${result.card.energy} 획득합니다.`:'탐사권을 사용하면 결과 카드가 나타나요.','exploration-card-reward');
    card.append(seal,title,story,reward);return card;
  }
  function action(label,event,css='secondary'){
    const button=node('button',label,css);button.type='button';button.onclick=async()=>{
      if(busy)return;busy=true;button.disabled=true;
      try{state=await request(event,{});selected=event==='exploration:explore'?state.result?.id:null;render();
        if(event==='exploration:explore')toast?.(state.message);else toast?.(event==='exploration:reset'?'우주 대축제를 마치고 기운을 0으로 돌렸어요.':'이번 주 탐사 결과를 내렸어요.');
      }catch(error){toast?.(error.message);}finally{busy=false;button.disabled=false;}
    };return button;
  }
  function render(){
    const header=node('header','','exploration-header');header.append(node('h2','우주 탐사 장치'));
    const headerActions=node('div','','exploration-header-actions');
    if(state.teacher){const edit=node('button',editing?'돌아가기':'수정하기','secondary');edit.type='button';edit.onclick=()=>{editing=!editing;render();};headerActions.append(edit);}
    const close=node('button','닫기','secondary');close.type='button';close.onclick=()=>dialog.close();headerActions.append(close);header.append(headerActions);
    if(editing){
      const editor=node('section','','exploration-editor');editor.append(node('p','열 장의 탐사 카드와 획득할 기운을 수정할 수 있어요. 새 설정은 앞으로 뽑는 카드에 적용돼요.'));
      for(const card of state.cards){
        const row=node('div','','exploration-editor-row');row.dataset.cardId=card.id;
        const title=node('input');title.value=card.title;title.maxLength=40;title.setAttribute('aria-label','탐사 카드 이름');title.dataset.field='title';
        const story=node('textarea');story.value=card.story;story.maxLength=240;story.rows=2;story.setAttribute('aria-label',card.title+' 이야기');story.dataset.field='story';
        const energy=node('input');energy.type='number';energy.min='0';energy.max=String(state.goal);energy.step='1';energy.value=String(card.energy);energy.dataset.field='energy';energy.setAttribute('aria-label',card.title+' 찬란한 별의 기운');
        const reward=node('label','찬란한 별의 기운을 ','exploration-editor-reward');reward.append(energy,document.createTextNode(' 획득합니다.'));
        row.append(title,story,reward);editor.append(row);
      }
      const save=node('button','저장하기','primary');save.type='button';save.onclick=async()=>{
        if(busy)return;
        if([...editor.querySelectorAll('input,textarea')].some(input=>!input.value.trim())){toast?.('모든 카드의 이름·이야기·기운을 입력해주세요.');return;}
        const cards=[...editor.querySelectorAll('.exploration-editor-row')].map(row=>({id:row.dataset.cardId,title:row.querySelector('[data-field="title"]').value.trim(),story:row.querySelector('[data-field="story"]').value.trim(),energy:Number(row.querySelector('[data-field="energy"]').value)}));
        busy=true;save.disabled=true;
        try{state=await request('exploration:update-cards',{cards});editing=false;render();toast?.('탐사 카드를 저장했어요.');}
        catch(error){toast?.(error.message);save.disabled=false;}finally{busy=false;}
      };editor.append(save);dialog.replaceChildren(header,editor);return;
    }
    const status=node('p',`찬란한 별의 기운 ${state.energy} / ${state.goal} · 탐사 기회 ${state.chances}번`,'exploration-status');
    const message=node('p',state.festival?'✦ 우주 대축제가 열렸어요! 광장을 둘러보세요.':'탐사 결과가 쌓이면 광장에 찬란한 빛이 가득해져요.','exploration-message');
    const controls=node('div','','exploration-actions');const start=action('탐사하기','exploration:explore','primary');start.disabled=state.chances<1||state.festival;controls.append(start);
    for(const [panel,label] of [['contributors','탐사기여자 보기'],...(state.teacher?[['special','특수 기능 보기']]:[])]){
      const button=node('button',label,'secondary');button.type='button';button.setAttribute('aria-pressed',String(viewPanel===panel));button.onclick=()=>{viewPanel=viewPanel===panel?null:panel;render();};controls.append(button);
    }
    if(state.teacher){controls.append(action('이번 주 결과 내리기','exploration:clear-results'));
      if(state.festival)controls.append(action('축제 초기화','exploration:reset','danger'));}
    let detail=null;
    if(viewPanel){detail=node('section','','exploration-contributors');
      if(viewPanel==='contributors'){
        detail.append(node('h3','탐사 기여자'));
        if(!state.contributors.length)detail.append(node('p','아직 기운을 모은 친구가 없어요.'));
        else for(const person of state.contributors)detail.append(node('p',`${person.nickname} · 찬란한 별의 기운 ${person.energy}`));
      }else{
        detail.append(node('h3','베텔기우스 급식 우선권'));
        if(!state.priorityRows?.length)detail.append(node('p','현재 적용 중인 우선권이 없어요.'));
        else for(const person of state.priorityRows)detail.append(node('p',`${person.nickname} · ${new Date(person.until).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}까지`));
      }
    }
    const results=node('section','','exploration-results');results.append(node('h3','모두의 탐사 결과'));
    if(!state.results.length)results.append(node('p','아직 공개된 결과 카드가 없어요.','exploration-empty'));
    else{
      const list=node('div','','exploration-result-list');
      for(const result of [...state.results].reverse()){
        const button=node('button',`${result.nickname} · ${result.card.title} · 기운 ${result.card.energy}`,'exploration-result-entry');
        button.type='button';button.setAttribute('aria-pressed',String(selected===result.id));button.onclick=()=>{selected=result.id;render();};list.append(button);
      }results.append(list);
    }
    const shown=state.results.find(result=>result.id===selected)||state.results.at(-1);
    dialog.replaceChildren(header,status,message,controls,...(detail?[detail]:[]),cardView(shown),results);
  }
  async function open(){try{state=await request('exploration:read',{});selected=state.results.at(-1)?.id||null;viewPanel=null;editing=false;render();stop?.();dialog.showModal();}catch(error){toast?.(error.message);}}
  return {open};
}
