import {activeStatuses} from '/shared/statuses.js';
import {STATUS_ICONS} from './status-icons.js';

const iconUrls=new Map(STATUS_ICONS.map(({id,url})=>[id,url]));

export function statusRemainingText(until,now=Date.now()){
  if(until===null)return '해제될 때까지 지속';
  const seconds=Math.max(0,Math.ceil((until-now)/1000));
  return `${seconds}초`;
}

export function createStatusDockUI(container,dialog,{title,description,expiry,count,close}){
  let states=[],signature='',selectedId=null;
  function showDetail(now){
    const state=states.find(item=>item.id===selectedId);
    if(!state){if(dialog.open)dialog.close();return;}
    title.textContent=state.name;
    description.textContent=state.description;
    expiry.textContent=`지속시간: ${statusRemainingText(state.until,now)}`;
    count.textContent=state.count>1?`같은 상태 ${state.count}개 적용 중`:'';
    count.hidden=state.count<=1;
  }
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{selectedId=null;});
  return {update(player,now=Date.now()){
    states=activeStatuses(player,now);
    const next=JSON.stringify(states.map(({id,until,count})=>[id,until,count]));
    if(next!==signature){
      signature=next;container.hidden=states.length===0;
      container.replaceChildren(...states.map(state=>{
        const button=document.createElement('button');button.type='button';button.className='dock-status-button';
        button.dataset.statusId=state.id;button.dataset.tone=state.tone;
        button.setAttribute('aria-label',`${state.name} · ${state.description} · 자세히 보기`);
        button.title=state.name;
        const url=iconUrls.get(state.id);
        if(url){const image=document.createElement('img');image.src=url;image.alt='';image.width=27;image.height=27;button.append(image);}
        else {const symbol=document.createElement('span');symbol.textContent=state.icon;symbol.setAttribute('aria-hidden','true');button.append(symbol);}
        button.addEventListener('click',()=>{window.dispatchEvent(new Event('game-ui-focus'));selectedId=state.id;showDetail(Date.now());dialog.showModal();});
        return button;
      }));
    }
    if(dialog.open&&selectedId)showDetail(now);
  }};
}
