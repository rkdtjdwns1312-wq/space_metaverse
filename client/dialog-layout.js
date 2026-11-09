// These explicit callers own their header/body layout (arcade, shops, crafting).
export function pinDialogHeader(dialog){
  const header=dialog.querySelector(':scope > header');
  if(!header||dialog.classList.contains('fixed-dialog-header'))return;
  const body=document.createElement('div');body.className='dialog-scroll-body';
  for(const node of [...dialog.childNodes])if(node!==header)body.append(node);
  dialog.append(body);dialog.classList.add('fixed-dialog-header');
  dialog.addEventListener('close',()=>{body.scrollTop=0;});
}

// A header belongs to the dialog's normal layout, never to viewport coordinates.
// Keep editor buttons in their original owner/form: a header proxy forwards to
// the real button, including its disabled state, unsaved guard and default action.
export function installDialogCloseControls(root=document){
  const tracked=new Map();let frame=0,disposed=false;
  const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(sync);};
  const own=(dialog,node)=>node.closest('dialog')===dialog;
  const visible=node=>!node.hidden&&!node.closest('[hidden]')&&
    (node.classList.contains('dialog-close-source')||node.getClientRects().length>0);
  function existingClose(dialog){
    return [...dialog.querySelectorAll('button,input[type="button"]')].find(button=>own(dialog,button)&&visible(button)&&
      (button.hasAttribute('data-close')||/^(닫기|창 닫기)$/.test(button.getAttribute('aria-label')||'')||
       /^(닫기|창 닫기)$/.test((button.textContent||button.value||'').trim())));
  }
  function release(state){
    state.control?.classList.remove('dialog-pinned-close');
    state.source?.classList.remove('dialog-close-source');
    state.proxy?.remove();
    state.header?.classList.remove('dialog-header-row','dialog-header-direct');
    if(state.createdHeader?.isConnected){
      if(state.generatedTitle)state.generatedTitle.remove();
      state.createdHeader.replaceWith(...state.createdHeader.childNodes);
    }
  }
  function makeHeader(dialog){
    const heading=[...dialog.querySelectorAll('h2')].find(node=>own(dialog,node)&&visible(node));
    let header=heading?.closest('header,.card-title,.chat-titlebar');
    if(header&&!own(dialog,header))header=null;
    let createdHeader=null,generatedTitle=null;
    if(!header){
      header=document.createElement('header');createdHeader=header;
      const group=heading?.closest('.student-help-heading')||heading;
      if(group){group.before(header);header.append(group);}
      else{
        generatedTitle=document.createElement('h2');generatedTitle.textContent=dialog.getAttribute('aria-label')||'안내';
        header.append(generatedTitle);dialog.prepend(header);
      }
    }
    header.classList.add('dialog-header-row');
    if(header.parentElement===dialog)header.classList.add('dialog-header-direct');
    return {header,createdHeader,generatedTitle};
  }
  function proxyClose(dialog,state){
    // Not a button: module-owned querySelector('button') and blanket button loops
    // must continue to find only their own controls after a dynamic rerender.
    const control=document.createElement('span');control.className='dialog-header-close secondary';
    control.setAttribute('role','button');control.tabIndex=0;control.textContent='닫기';
    control.setAttribute('aria-label','창 닫기');
    function close(event){
      event.preventDefault();event.stopPropagation();
      if(state.source){if(state.source.isConnected&&!state.source.disabled)state.source.click();return;}
      const cancel=new Event('cancel',{cancelable:true});
      if(dialog.dispatchEvent(cancel)&&dialog.open)dialog.close();
    }
    control.addEventListener('click',close);
    control.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')close(event);});
    state.header.append(control);return control;
  }
  function sync(){
    frame=0;
    for(const [dialog,state] of tracked)if(!dialog.isConnected||!dialog.open){
      release(state);tracked.delete(dialog);dialog.classList.remove('has-dialog-header');
    }
    for(const dialog of root.querySelectorAll('dialog[open]')){
      let state=tracked.get(dialog);
      if(state&&(!state.header.isConnected||!dialog.contains(state.header))){release(state);tracked.delete(dialog);state=null;}
      if(!state){
        state=makeHeader(dialog);tracked.set(dialog,state);dialog.classList.add('has-dialog-header');
      }
      const css=getComputedStyle(dialog);
      for(const side of ['top','right','left']){
        const name='--dialog-padding-'+side,value=css.getPropertyValue('padding-'+side);
        if(dialog.style.getPropertyValue(name)!==value)dialog.style.setProperty(name,value);
      }
      const actual=existingClose(dialog);
      if(actual!==state.source){state.source?.classList.remove('dialog-close-source');state.source=actual;}
      const inHeader=actual&&state.header.contains(actual);
      if(inHeader){actual.classList.remove('dialog-close-source');state.proxy?.remove();state.proxy=null;}
      else{
        if(!state.proxy?.isConnected)state.proxy=proxyClose(dialog,state);
        const restoreFocus=actual&&document.activeElement===actual;
        actual?.classList.add('dialog-close-source');
        if(restoreFocus){state.proxy.focus({preventScroll:true});dialog.scrollTop=0;}
        state.proxy.setAttribute('aria-disabled',String(!!actual?.disabled));
        state.proxy.tabIndex=actual?.disabled?-1:0;
      }
      const control=inHeader?actual:state.proxy;
      if(state.control!==control){state.control?.classList.remove('dialog-pinned-close');state.control=control;control.classList.add('dialog-pinned-close');}
    }
  }
  const mutations=new MutationObserver(schedule);
  mutations.observe(root.documentElement||root,{childList:true,subtree:true,attributes:true,attributeFilter:['open','hidden','disabled']});
  window.addEventListener('resize',schedule);
  schedule();
  return ()=>{disposed=true;cancelAnimationFrame(frame);mutations.disconnect();window.removeEventListener('resize',schedule);for(const [dialog,state]of tracked){release(state);dialog.classList.remove('has-dialog-header');}tracked.clear();};
}
