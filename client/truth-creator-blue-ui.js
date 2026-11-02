export function createTruthCreatorBlueUI({request,getKey,getKeyLabel,onClose=()=>{},toast=()=>{}}){
  const style=document.createElement('link');style.rel='stylesheet';style.href='/truth-creator-blue.css';document.head.append(style);
  const dialog=document.createElement('dialog');dialog.id='truth-creator-blue-dialog';dialog.setAttribute('aria-labelledby','truth-blue-title');
  dialog.innerHTML='<header><h2 id="truth-blue-title">파란 구체 해제</h2><button type="button" class="secondary" data-close>닫기</button></header><div class="truth-blue-timer" role="timer" aria-label="폭발까지 남은 시간"><span>폭발까지</span><strong data-time>20초</strong></div><p class="truth-blue-instruction">왼쪽 위부터 차례대로 공격·스킬을 입력하세요.</p><ol class="truth-blue-sequence" aria-label="해제 순서"></ol><div class="truth-blue-status"><strong data-progress>0 / 8</strong><p data-message role="status" aria-live="polite">구체를 확인하고 있어요.</p></div><div class="truth-blue-actions" aria-label="해제 입력"><button type="button" data-action="attack"><span class="truth-blue-icon" aria-hidden="true">⚔</span><span>공격</span><kbd></kbd></button><button type="button" data-action="skill"><span class="truth-blue-icon" aria-hidden="true">✦</span><span>스킬</span><kbd></kbd></button></div><p class="truth-blue-hint">틀리면 이 구체의 순서가 처음부터 다시 시작돼요. 남은 시간은 늘어나지 않아요.</p>';
  document.body.append(dialog);
  const sequence=dialog.querySelector('ol'),message=dialog.querySelector('[data-message]'),progress=dialog.querySelector('[data-progress]'),time=dialog.querySelector('[data-time]');
  const buttons=[...dialog.querySelectorAll('[data-action]')];
  let orb=null,targetId=null,mapId=null,token=null,pending=false,generation=0,removedGeneration=null,serverNow=0,receivedAt=0,timer=null;
  function clock(value){if(Number.isFinite(value)){serverNow=value;receivedAt=performance.now();}}
  const remaining=()=>orb?Math.max(0,orb.endsAt-serverNow-Math.max(0,performance.now()-receivedAt)):0;
  function close(reason){removedGeneration=reason==='removed'?generation:null;generation++;orb=null;targetId=null;token=null;pending=false;clearInterval(timer);timer=null;if(dialog.open)dialog.close();}
  function tick(){if(!orb)return;const ms=remaining();time.textContent=Math.ceil(ms/1000)+'초';dialog.classList.toggle('is-urgent',ms<=5000);if(!ms)close();}
  function render(){
    progress.textContent=(orb?.progress||0)+' / 8';
    sequence.replaceChildren(...(orb?.sequence||[]).map((action,index)=>{
      const item=document.createElement('li'),done=index<orb.progress,current=index===orb.progress;
      item.className=done?'is-done':current?'is-current':'';if(current)item.setAttribute('aria-current','step');
      item.setAttribute('aria-label',`${index+1}번 ${action==='attack'?'공격':'스킬'}${done?' 완료':current?' 다음 입력':''}`);
      const number=document.createElement('span');number.className='truth-blue-number';number.textContent=String(index+1);
      const icon=document.createElement('span');icon.className='truth-blue-icon';icon.setAttribute('aria-hidden','true');icon.textContent=action==='attack'?'⚔':'✦';
      const name=document.createElement('span');name.textContent=action==='attack'?'공격':'스킬';item.append(number,icon,name);return item;
    }));
    for(const button of buttons){button.disabled=pending||!orb;button.querySelector('kbd').textContent=getKeyLabel(button.dataset.action);}
    tick();
  }
  async function choose(action){
    if(pending||!orb||!dialog.open||remaining()<=0)return;
    const version=generation;pending=true;render();
    try{
      const result=await request('truth-creator:blue-input',{orbId:orb.id,action,revision:orb.revision,interactionToken:token});
      if(version!==generation){if(result.disarmed&&removedGeneration===version){removedGeneration=null;toast('파란 구체 하나를 해제했어요.');}return;}
      if(result.disarmed){close();toast('파란 구체 하나를 해제했어요.');return;}
      if(!result.orb){close();return;}
      orb=result.orb;clock(result.serverNow);
      message.textContent=result.stale?'다른 입력으로 바뀐 순서를 확인했어요. 표시된 다음 칸부터 이어가세요.':result.correct?'맞았어요! 다음 칸을 입력하세요.':'순서가 달라요. 이 구체는 1번부터 다시 시작해요. 남은 시간은 그대로예요.';
    }catch(error){if(version===generation){close();toast(error.message||'구체를 확인할 수 없어요.');}}
    finally{if(version===generation){pending=false;render();}}
  }
  buttons.forEach(button=>button.onclick=()=>choose(button.dataset.action));
  dialog.querySelector('[data-close]').onclick=close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{if(targetId)close();onClose();});
  // Capture before the game's combat/interaction listeners, even when a button has focus.
  window.addEventListener('keydown',event=>{
    if(!dialog.open)return;
    if(event.code==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}
    if(event.code==='Tab'){
      const focusable=[...dialog.querySelectorAll('button:not(:disabled)')],index=focusable.indexOf(document.activeElement);
      if(index<0||event.shiftKey&&index===0||!event.shiftKey&&index===focusable.length-1){event.preventDefault();event.stopImmediatePropagation();focusable[event.shiftKey?focusable.length-1:0]?.focus();}
      return;
    }
    if(event.repeat&&['Enter','Space'].includes(event.code)&&event.target.closest?.('[data-action]')){event.preventDefault();event.stopImmediatePropagation();return;}
    const action=['attack','skill'].find(action=>getKey(action)===event.code);
    if(!action)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!event.repeat&&!event.ctrlKey&&!event.altKey&&!event.metaKey)void choose(action);
  },true);
  return {
    async open(target,player){
      close();const version=generation;targetId=target.id;mapId=player?.mapId;pending=true;
      message.textContent='구체를 확인하고 있어요.';dialog.classList.remove('is-urgent');time.textContent='…';render();dialog.showModal();dialog.querySelector('[data-close]').focus();
      try{
        const result=await request('truth-creator:blue-open',{orbId:target.id});if(version!==generation)return;
        orb=result.orb;token=result.interactionToken;clock(result.serverNow);pending=false;
        message.textContent=orb.progress?'이전에 맞힌 순서부터 이어서 해제하세요.':'표시된 순서대로 아래 버튼이나 키보드를 눌러주세요.';
        render();timer=setInterval(tick,100);buttons[0].focus();
      }catch(error){if(version===generation){close();toast(error.message||'구체를 확인할 수 없어요.');}}
    },
    sync(monsters,player){
      if(!targetId)return;
      if(!player||player.mapId!==mapId||player.away||player.avatar?.blackStar||player.avatar?.teacherPreview||player.vitals?.defeated||player.vitals?.hp?.current<=0){close();return;}
      if(!Array.isArray(monsters))return;
      const boss=monsters.find(monster=>monster.alive&&monster.mapId===mapId&&monster.truthCreatorEffects?.blueOrbs?.some(item=>item.id===targetId));
      if(!boss){close('removed');return;}
      const value=boss.truthCreatorEffects.blueOrbs.find(item=>item.id===targetId);
      if(orb){orb={...orb,...value};clock(boss.truthCreatorEffects.serverNow);tick();}
    },
    reset:close
  };
}
