import {createResetConfirmation} from './reset-confirm.js';

// 세 게임이 같은 하단 버튼 순서와 게임 안 확인창을 사용합니다.
export function createArcadeRanking({game,prefix,root,footer,request,subscribe,toast=()=>{}}){
  const panel=root.querySelector(`#${prefix}-ranking-panel`),list=root.querySelector(`#${prefix}-ranking`);
  const button=document.createElement('button');button.type='button';button.id=`${prefix}-ranking-toggle`;button.textContent='랭킹 보기';button.setAttribute('aria-expanded','false');
  const reset=document.createElement('button');reset.type='button';reset.id=`${prefix}-ranking-reset`;reset.textContent='초기화';reset.hidden=true;
  const host=footer||root;host.append(reset,button);
  let active=true;
  const confirm=createResetConfirmation({root,title:'이번 주 랭킹 초기화',message:'이 게임의 이번 주 랭킹만 초기화할까요?',
    submit:()=>request(`${game}:ranking:reset`,{}),onSuccess:data=>{render(data);toast('이번 주 랭킹을 초기화했어요.');}});
  function render({ranking=[],canReset}={}){
    if(!active)return;
    if(typeof canReset==='boolean')reset.hidden=!canReset;
    list.replaceChildren(...ranking.map(r=>{
      const li=document.createElement('li');
      li.textContent=`${r.rank}위 · ${r.nickname} · ${game==='memory'?'남은 시간 ':''}${((game==='memory'?r.remainingMs:r.elapsedMs)/1000).toFixed(2)}초`;return li;
    }));
    if(!ranking.length){const li=document.createElement('li');li.textContent=game==='stars'?'아직 기록이 없어요. 첫 기록에 도전해요!':'아직 이번 주 기록이 없어요.';list.append(li);}
  }
  async function refresh(){try{render(await request(`${game}:ranking`,{}));}catch(e){if(active)toast(e.message);}}
  const unsubscribe=subscribe?.(render)||(()=>{});
  button.onclick=()=>{
    const open=panel.hidden;panel.hidden=!open;button.textContent=open?'랭킹 닫기':'랭킹 보기';button.setAttribute('aria-expanded',String(open));if(open)refresh();
  };
  reset.onclick=()=>confirm.open();
  refresh();
  return {render,destroy(){active=false;unsubscribe();confirm.destroy();reset.remove();button.remove();}};
}
