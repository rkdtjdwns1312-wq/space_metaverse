export function createCetusUI({request,getPlayer,getRoom,stop,toast}){
  const panel=document.createElement('section');panel.id='cetus-hud';panel.className='cetus-hud';panel.hidden=true;
  panel.setAttribute('aria-live','polite');document.body.append(panel);
  let busy=false,signature='';
  function button(label,handler,kind='secondary'){
    const item=document.createElement('button');item.type='button';item.className=kind;item.textContent=label;item.disabled=busy;
    item.onclick=handler;return item;
  }
  async function respond(invite,accept){
    if(busy)return;busy=true;render();
    try{const result=await request('cetus:respond',{requestId:invite.id,accept});toast(result.message);}
    catch(error){toast(error.message);}
    finally{busy=false;render();}
  }
  async function escape(){
    if(busy)return;busy=true;stop();render();
    try{const result=await request('cetus:escape',{});toast(result.message);}
    catch(error){toast(error.message);}
    finally{busy=false;render();}
  }
  function render(){
    const me=getPlayer(),room=getRoom(),stomach=me?.constellationAbility?.cetusStomach;
    document.body.classList.toggle('in-whale-stomach',!!stomach);
    if(stomach){const mapTab=document.querySelector('[data-chat-tab="map"]');if(mapTab?.getAttribute('aria-pressed')!=='true')mapTab?.click();}
    const invites=(room?.cetusInvites||[]).filter(invite=>invite.toId===me?.id&&invite.expiresAt>Date.now());
    panel.replaceChildren();panel.hidden=!stomach&&!invites.length;
    if(stomach){
      const heading=document.createElement('strong');heading.textContent='🐋 고래 배 속';
      const note=document.createElement('p');note.textContent='안에서는 함께 있는 친구와 채팅만 할 수 있어요. 혼자서도 언제든 나갈 수 있지만 고래자리의 이후 효과는 받지 못해요.';
      panel.append(heading,note,button('즉시 탈출하기',escape,'primary'));
      return;
    }
    for(const invite of invites){
      const heading=document.createElement('strong');heading.textContent=`🐋 ${invite.fromNickname} 친구의 ${invite.level===2?'칭찬 제안':'고래 배 속 초대'}`;
      const note=document.createElement('p');note.textContent=invite.level===2?'동의하면 앞으로 쓸 별자리 능력이 2배가 돼요.':'동의하면 하루 동안 배 속에 머물 수 있어요. 언제든 혼자 탈출할 수 있어요.';
      const actions=document.createElement('div');actions.className='cetus-actions';
      actions.append(button('거절',()=>void respond(invite,false)),button('수락',()=>void respond(invite,true),'primary'));
      panel.append(heading,note,actions);
    }
  }
  return {update(){const me=getPlayer(),room=getRoom(),next=JSON.stringify({id:me?.id,stomach:me?.constellationAbility?.cetusStomach,invites:room?.cetusInvites});if(next!==signature){signature=next;render();}},reset(){busy=false;signature='';document.body.classList.remove('in-whale-stomach');panel.hidden=true;panel.replaceChildren();}};
}
