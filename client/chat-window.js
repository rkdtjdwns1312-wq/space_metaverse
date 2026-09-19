// 맵을 막지 않는 고정 채팅창. 크기와 스크롤은 맵 전환과 독립적으로 유지합니다.
export function createChatWindow({stop}) {
  const $=id=>document.getElementById(id),dialog=$('chat-dialog'),log=$('chat-log');
  document.body.append(dialog);
  let size=2;
  const bottom=()=>log.scrollHeight-log.clientHeight-log.scrollTop<24;
  function latest(){log.scrollTop=log.scrollHeight;$('chat-latest').hidden=true;}
  function resize(next){
    const follow=bottom();size=Math.max(1,Math.min(3,next));dialog.dataset.size=String(size);
    $('chat-size-label').textContent=size+' / 3';$('chat-shrink').disabled=size===1;$('chat-grow').disabled=size===3;
    if(follow)requestAnimationFrame(latest);
  }
  function sync(){
    $('chat-window-toggle').textContent=dialog.open?'채팅창 닫기':'채팅창 열기';
    $('chat-window-toggle').setAttribute('aria-expanded',String(dialog.open));
  }
  $('chat-shrink').onclick=()=>resize(size-1);$('chat-grow').onclick=()=>resize(size+1);
  $('chat-window-close').onclick=()=>dialog.close();
  $('chat-latest').onclick=latest;
  log.addEventListener('scroll',()=>{if(bottom())$('chat-latest').hidden=true;});
  dialog.addEventListener('focusin',e=>{if(e.target.matches('input,textarea,select'))stop();});
  dialog.addEventListener('close',sync);
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&dialog.open&&!document.querySelector('dialog:modal')){e.preventDefault();dialog.close();}
  });
  resize(2);sync();
  return {
    open(){stop();if(!dialog.open)dialog.show();sync();requestAnimationFrame(latest);},
    reset(){dialog.close();resize(2);$('chat-latest').hidden=true;sync();},
    capture(){
      const top=log.getBoundingClientRect().top;
      const anchor=[...log.children].find(el=>el.getBoundingClientRect().bottom>top);
      return {follow:bottom(),top:log.scrollTop,id:anchor?.dataset.messageId,offset:anchor?anchor.getBoundingClientRect().top-top:0};
    },
    restore(saved){
      if(saved.follow){latest();return;}
      const anchor=[...log.children].find(el=>el.dataset.messageId===saved.id);
      log.scrollTop=anchor?log.scrollTop+anchor.getBoundingClientRect().top-log.getBoundingClientRect().top-saved.offset:saved.top;
      $('chat-latest').hidden=bottom();
    }
  };
}
