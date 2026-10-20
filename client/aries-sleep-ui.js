export function createAriesSleepUI({request,getPlayer,getRoom,stop,toast}){
  const panel=document.createElement('section');panel.className='aries-sleep-choices';panel.hidden=true;
  const dialog=document.createElement('dialog');dialog.className='aries-sleep-dialog';dialog.setAttribute('aria-labelledby','aries-sleep-title');
  const title=document.createElement('h2');title.id='aries-sleep-title';
  const message=document.createElement('p');message.className='aries-sleep-message';
  const actions=document.createElement('div');actions.className='aries-sleep-actions';
  dialog.append(title,message,actions);document.body.append(dialog);
  const reopen=document.createElement('button');reopen.type='button';reopen.className='secondary aries-sleep-reopen';reopen.textContent='💤 잠에서 깨기';reopen.hidden=true;document.body.append(reopen);
  const abilityDialog=document.getElementById('ability-dialog');
  const abilityUse=document.getElementById('self-ability-use');
  document.getElementById('ability-description').after(panel);
  let shownInviteId='',wakeDismissedUntil=0,busy=false,activePrompt='',days=1,selectedFriendId='';
  const button=(label,handler,primary=false)=>{
    const element=document.createElement('button');element.type='button';element.className=primary?'primary':'secondary';element.textContent=label;element.disabled=busy;
    element.onclick=handler;return element;
  };
  function openPrompt(kind,heading,text,buttons){
    if(activePrompt===kind&&dialog.open)return;
    activePrompt=kind;stop();title.textContent=heading;message.textContent=text;actions.replaceChildren(...buttons);
    if(!dialog.open)dialog.showModal();
  }
  function closePrompt(){activePrompt='';if(dialog.open)dialog.close();}
  async function act(event,payload,success){
    if(busy)return;busy=true;actions.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{const result=await request(event,payload);closePrompt();toast(result.message||success);}
    catch(error){toast(error.message);}
    finally{busy=false;if(dialog.open)actions.querySelectorAll('button').forEach(button=>button.disabled=false);update();}
  }
  function renderAbility(status,player,room){
    panel.replaceChildren();panel.hidden=status?.constellationId!=='aries';
    if(panel.hidden)return;
    if(status.level===2&&status.canUse){
      const heading=document.createElement('h3');heading.textContent='함께 잠들 친구를 선택해요';panel.append(heading);
      const pending=room?.ariesInvites?.find(invite=>invite.fromId===player?.id&&invite.expiresAt>Date.now());
      if(pending){const wait=document.createElement('p');wait.textContent=`${room.players.find(friend=>friend.id===pending.toId)?.nickname||'친구'}가 수면 신청에 답하기를 기다려요.`;panel.append(wait);return;}
      const friends=(room?.players||[]).filter(friend=>friend.role==='student'&&friend.id!==player?.id&&friend.connected&&!friend.away&&(!friend.ariesSleep||friend.ariesSleep.endsAt<=Date.now()));
      const select=document.createElement('select');select.setAttribute('aria-label','함께 잠들 친구');
      for(const friend of friends){const option=document.createElement('option');option.value=friend.id;option.textContent=friend.nickname;select.append(option);}
      if(friends.some(friend=>friend.id===selectedFriendId))select.value=selectedFriendId;
      else selectedFriendId=select.value;
      select.onchange=()=>{selectedFriendId=select.value;};
      const send=button('수면 신청하기',()=>void act('constellation-ability:use',{targetId:select.value},'수면 신청을 보냈어요.'),true);send.disabled=busy||!friends.length;
      panel.append(select,send);
    }else if(status.level===3&&status.canUse){
      const heading=document.createElement('h3');heading.textContent='잠들 기간을 선택해요';panel.append(heading);
      const select=document.createElement('select');select.setAttribute('aria-label','잠들 기간');select.value=String(days);
      for(let value=1;value<=3;value++){const option=document.createElement('option');option.value=String(value);option.textContent=`${value}일 · 깨어나면 별 파편 ${value}개`;select.append(option);}
      select.value=String(days);select.onchange=()=>{days=Number(select.value);};
      panel.append(select,button('선택한 기간 잠들기',()=>void act('constellation-ability:use',{days},'수면을 시작했어요.'),true));
    }else if(status.level>=4&&status.level<=5&&status.canUse){
      const note=document.createElement('p');note.textContent=`아래 ‘능력 사용’ 버튼을 누르면 무작위 학생 ${status.level===4?'최대 6':'최대 10'}명이 하루 동안 잠들어요. 잠든 학생은 별 파편 1개를 내고 즉시 깨어날 수 있어요.`;panel.append(note);
    }
  }
  function update(){
    const player=getPlayer(),room=getRoom?.(),status=player?.constellationAbility;
    renderAbility(status,player,room);
    const invites=(room?.ariesInvites||[]).filter(invite=>invite.toId===player?.id&&invite.expiresAt>Date.now());
    const invite=invites[0];
    if(invite&&invite.id!==shownInviteId&&!busy){
      shownInviteId=invite.id;
      const sender=room.players.find(friend=>friend.id===invite.fromId)?.nickname||invite.fromNickname||'친구';
      openPrompt('invite:'+invite.id,'양자리 수면 신청',`${sender}님이 함께 잠들자고 신청했어요. 수락하면 다음 날 오전 8시에 깨어나요.`,[
        button('거절하기',()=>void act('aries-sleep:respond',{requestId:invite.id,accept:false},'수면 신청을 거절했어요.')),
        button('수락하기',()=>void act('aries-sleep:respond',{requestId:invite.id,accept:true},'수면 신청을 수락했어요.'),true)
      ]);
    }else if(!invite&&activePrompt.startsWith('invite:'))closePrompt();
    const sleep=player?.ariesSleep||status?.ariesSleep;
    reopen.hidden=!(sleep?.wakeCost===1&&sleep.endsAt>Date.now());
    if(sleep?.wakeCost===1){
      if(activePrompt!=='wake'&&sleep.endsAt!==wakeDismissedUntil&&!busy)openPrompt('wake','잠에서 깨어날까요?','지금 깨어나면 별 파편 1개를 사용해요.',[
        button('계속 자기',()=>{wakeDismissedUntil=sleep.endsAt;closePrompt();}),button('별 파편 1개 내고 깨기',()=>void act('aries-sleep:wake',{},'잠에서 깨어났어요.'),true)
      ]);
    }else{wakeDismissedUntil=0;if(activePrompt==='wake')closePrompt();}
  }
  abilityUse.addEventListener('click',event=>{
    const player=getPlayer();if(player?.avatar?.constellationId!=='aries'||player.avatar.level>3)return;
    event.stopImmediatePropagation();
    stop();window.dispatchEvent(new Event('game-ui-focus'));
    if(!abilityDialog.open)abilityDialog.showModal();
    update();
  },true);
  reopen.onclick=()=>{wakeDismissedUntil=0;update();};
  dialog.addEventListener('cancel',event=>event.preventDefault());
  dialog.addEventListener('close',()=>{activePrompt='';});
  return {update,reset(){shownInviteId='';wakeDismissedUntil=0;busy=false;days=1;selectedFriendId='';panel.hidden=true;reopen.hidden=true;closePrompt();}};
}
