export function keyboardViewport({height,viewportHeight,offsetTop=0,scale=1,editing=false,mobile=false}){
 const visible=Number.isFinite(viewportHeight)&&viewportHeight>0?viewportHeight:height;
 const open=mobile&&editing&&Math.abs(scale-1)<.05&&height-visible>100;
 return {open,height:Math.max(1,visible),top:Math.max(0,offsetTop)};
}

// Listen only to viewport/focus changes, never to the game's animation loop.
export function installMobileViewport(){
 const media=matchMedia('(max-width:520px),(max-width:960px) and (pointer:coarse)');
 let frame=0;
 function sync(){
  frame=0;const vv=window.visualViewport,active=document.activeElement;
  const editing=!!active?.matches('textarea,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit])');
  const state=keyboardViewport({height:innerHeight,viewportHeight:vv?.height,offsetTop:vv?.offsetTop,scale:vv?.scale??1,editing,mobile:media.matches});
  document.body.classList.toggle('mobile-keyboard-open',state.open);
  document.body.style.setProperty('--mobile-viewport-height',state.height+'px');
  document.body.style.setProperty('--mobile-viewport-top',state.top+'px');
 }
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(sync);};
 for(const [target,type]of [[window,'resize'],[window.visualViewport,'resize'],[window.visualViewport,'scroll'],[document,'focusin'],[document,'focusout']])target?.addEventListener(type,schedule);
 media.addEventListener('change',schedule);schedule();
}
