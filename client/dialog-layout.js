// Keep controls outside the scroll area without replacing nodes or their handlers.
export function pinDialogHeader(dialog){
  const header=dialog.querySelector(':scope > header');
  if(!header||dialog.classList.contains('fixed-dialog-header'))return;
  const body=document.createElement('div');body.className='dialog-scroll-body';
  for(const node of [...dialog.childNodes])if(node!==header)body.append(node);
  dialog.append(body);dialog.classList.add('fixed-dialog-header');
  dialog.addEventListener('close',()=>{body.scrollTop=0;});
}

// Keep the real close control in its original scope: several editors attach
// unsaved-change guards to it, or find it again after rendering their content.
// Fixed positioning avoids wrapping/moving forms and module-owned containers.
export function installDialogCloseControls(root=document){
  const tracked=new Map();let frame=0,disposed=false;
  const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(sync);};
  const resize=new ResizeObserver(schedule);
  function release(state){
    state.control?.classList.remove('dialog-pinned-close');
    state.fallback?.remove();
  }
  function existingClose(dialog){
    return [...dialog.querySelectorAll('button,input[type="button"]')].find(button=>
      button.closest('dialog')===dialog&&!button.hidden&&button.getClientRects().length&&
      (button.hasAttribute('data-close')||/닫기/.test(button.getAttribute('aria-label')||'')||
       /^(닫기|창 닫기)$/.test((button.textContent||button.value||'').trim())));
  }
  function fallbackClose(dialog){
    // A non-button element deliberately avoids existing querySelector('button')
    // and querySelectorAll('button') logic in independently owned dialog modules.
    const control=document.createElement('span');control.className='dialog-fallback-close';
    control.setAttribute('role','button');control.tabIndex=0;control.textContent='닫기';
    control.setAttribute('aria-label','창 닫기');
    function close(event){
      event.preventDefault();event.stopPropagation();
      const cancel=new Event('cancel',{cancelable:true});
      if(dialog.dispatchEvent(cancel)&&dialog.open)dialog.close();
    }
    control.addEventListener('click',close);
    control.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')close(event);});
    dialog.append(control);return control;
  }
  function sync(){
    frame=0;
    for(const [dialog,state] of tracked)if(!dialog.isConnected||!dialog.open){
      release(state);resize.unobserve(dialog);tracked.delete(dialog);dialog.classList.remove('has-pinned-dialog-close');
    }
    for(const dialog of root.querySelectorAll('dialog[open]')){
      let state=tracked.get(dialog);
      if(!state){
        dialog.style.setProperty('--dialog-original-padding-top',getComputedStyle(dialog).paddingTop);
        state={};tracked.set(dialog,state);resize.observe(dialog);dialog.classList.add('has-pinned-dialog-close');
      }
      const actual=existingClose(dialog);
      if(actual&&state.fallback){state.fallback.remove();state.fallback=null;}
      const control=actual||(state.fallback?.isConnected?state.fallback:(state.fallback=fallbackClose(dialog)));
      if(control!==state.control){state.control?.classList.remove('dialog-pinned-close');state.control=control;state.position=null;control.classList.add('dialog-pinned-close');}
      const rect=dialog.getBoundingClientRect(),width=control.getBoundingClientRect().width;
      const top=Math.max(4,rect.top+10),left=Math.max(4,Math.min(innerWidth-width-4,rect.right-width-14));
      const position=top+'|'+left;
      if(position!==state.position){control.style.setProperty('--dialog-close-top',top+'px');control.style.setProperty('--dialog-close-left',left+'px');state.position=position;}
    }
  }
  const mutations=new MutationObserver(schedule);
  mutations.observe(root.documentElement||root,{childList:true,subtree:true,attributes:true,attributeFilter:['open','hidden']});
  root.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);
  window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  schedule();
  return ()=>{disposed=true;cancelAnimationFrame(frame);mutations.disconnect();resize.disconnect();root.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);for(const [dialog,state]of tracked){release(state);dialog.classList.remove('has-pinned-dialog-close');}tracked.clear();};
}
