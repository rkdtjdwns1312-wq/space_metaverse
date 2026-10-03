// 서버가 고른 카드와 합계를 그대로 보여 줍니다. 카드 선택이나 재화 계산은 화면에서 하지 않습니다.
export function createExplorationUI({request,stop,toast}){
  const dialog=document.createElement('dialog');dialog.id='exploration-dialog';dialog.setAttribute('aria-label','우주 탐사');document.body.append(dialog);
  let state=null,selected=null,busy=false;
  const node=(tag,text,className)=>Object.assign(document.createElement(tag),{textContent:text??'',className:className??''});
  function cardView(result){
    const card=node('div','','exploration-card');card.dataset.energy=String(result?.card?.energy??0);
    const seal=node('div','✦  우주 탐사 결과  ✦','exploration-card-seal');
    const art=node('div','','exploration-card-art');art.setAttribute('aria-hidden','true');
    const title=node('h3',result?.card?.title||'다음 이야기를 기다려요');
    const story=node('p',result?.card?.story||'아직 탐사 결과가 없습니다.','exploration-card-story');
    const reward=node('p',result?`찬란한 별의 기운을 ${result.card.energy} 획득합니다.`:'탐사권을 사용하면 결과 카드가 나타나요.','exploration-card-reward');
    card.append(seal,art,title,story,reward);return card;
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
    const close=node('button','닫기','secondary');close.type='button';close.onclick=()=>dialog.close();header.append(close);
    const status=node('p',`찬란한 별의 기운 ${state.energy} / ${state.goal} · 탐사 기회 ${state.chances}번`,'exploration-status');
    const message=node('p',state.festival?'✦ 우주 대축제가 열렸어요! 광장을 둘러보세요.':'탐사 결과가 쌓이면 광장에 찬란한 빛이 가득해져요.','exploration-message');
    const controls=node('div','','exploration-actions');const start=action('탐사하기','exploration:explore','primary');start.disabled=state.chances<1||state.festival;controls.append(start);
    const contributors=node('section','','exploration-contributors');contributors.append(node('h3','탐사 기여자'));
    if(!state.contributors.length)contributors.append(node('p','아직 기운을 모은 친구가 없어요.'));
    else for(const person of state.contributors)contributors.append(node('p',`${person.nickname} · 찬란한 별의 기운 ${person.energy}`));
    const priorities=state.teacher?node('section','','exploration-contributors'):null;
    if(priorities){priorities.append(node('h3','베텔기우스 급식 우선권'));
      if(!state.priorityRows?.length)priorities.append(node('p','현재 적용 중인 우선권이 없어요.'));
      else for(const person of state.priorityRows)priorities.append(node('p',`${person.nickname} · ${new Date(person.until).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}까지`));
    }
    if(state.chances<1&&!state.festival)controls.append(node('span','선생님이 준 탐사권을 가방에서 먼저 사용해요.','exploration-hint'));
    if(state.teacher){controls.append(action('이번 주 결과 내리기','exploration:clear-results'));
      if(state.festival)controls.append(action('축제 초기화','exploration:reset','danger'));}
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
    dialog.replaceChildren(header,status,message,controls,contributors,...(priorities?[priorities]:[]),cardView(shown),results);
  }
  async function open(){try{state=await request('exploration:read',{});selected=state.results.at(-1)?.id||null;render();stop?.();dialog.showModal();}catch(error){toast?.(error.message);}}
  return {open};
}
