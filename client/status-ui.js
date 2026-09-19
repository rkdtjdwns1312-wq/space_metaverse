import {activeStatuses} from '/shared/statuses.js';
// 이 모듈은 서버가 보내 준 상태만 표시하며 상태를 생성하거나 해제하지 않습니다.
export function createStatusUI(list,empty){
  let signature='';
  return {update(player,now=Date.now()){
    const states=activeStatuses(player,now),next=JSON.stringify(states);
    if(next===signature)return;signature=next;empty.hidden=states.length>0;
    list.replaceChildren(...states.map(state=>{
      const badge=document.createElement('li');badge.className='status-badge';badge.dataset.statusId=state.id;badge.dataset.tone=state.tone;
      const expiry=state.until===null?'해제될 때까지':new Date(state.until).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+'까지';
      badge.title=state.name+' · '+state.description+' · '+expiry+(state.count>1?' · '+state.count+'개 효과 적용 중':'');badge.setAttribute('aria-label',badge.title);
      const icon=document.createElement('span');icon.className='status-icon';icon.textContent=state.icon;icon.setAttribute('aria-hidden','true');
      const name=document.createElement('span');name.className='status-name';name.textContent=state.name;
      badge.append(icon,name);return badge;
    }));
  }};
}
