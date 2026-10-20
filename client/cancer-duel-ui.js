const GESTURES=[['rock','✊','바위'],['paper','✋','보'],['scissors','✌️','가위']];
const COIN=[['heads','앞면'],['tails','뒷면']],ODD_EVEN=[['odd','홀수'],['even','짝수']];

export function createCancerDuelUI({request,getPlayer,getRoom,stop,toast}){
  const panel=document.createElement('section');panel.className='cancer-duel-choices';panel.hidden=true;
  document.getElementById('ability-description').after(panel);
  const inviteDialog=document.createElement('dialog');inviteDialog.className='cancer-duel-dialog';inviteDialog.setAttribute('aria-labelledby','cancer-duel-title');
  const title=document.createElement('h2');title.id='cancer-duel-title';title.textContent='게자리 주간 대결 신청';
  const message=document.createElement('p');message.className='cancer-duel-message';
  const actions=document.createElement('div');actions.className='cancer-duel-actions';inviteDialog.append(title,message,actions);document.body.append(inviteDialog);
  const resultDialog=document.createElement('dialog');resultDialog.className='cancer-duel-dialog cancer-duel-result';resultDialog.setAttribute('aria-labelledby','cancer-result-title');
  const resultTitle=document.createElement('h2');resultTitle.id='cancer-result-title';
  const resultText=document.createElement('p');resultText.className='cancer-duel-result-text';
  const resultClose=document.createElement('button');resultClose.type='button';resultClose.className='primary';resultClose.textContent='확인';resultClose.onclick=()=>resultDialog.close();
  resultDialog.append(resultTitle,resultText,resultClose);document.body.append(resultDialog);
  let selectedFriendId='',selectedChoice='',shownInviteId='',busy=false;
  const button=(label,fn,primary=false)=>{const b=document.createElement('button');b.type='button';b.className=primary?'primary':'secondary';b.textContent=label;b.disabled=busy;b.onclick=fn;return b;};
  const choiceSet=(choices,label)=>{const wrap=document.createElement('div');wrap.className='cancer-duel-choice-set';wrap.setAttribute('role','group');wrap.setAttribute('aria-label',label);for(const [value,caption,name] of choices){const b=button(caption+' '+(name||''),()=>{selectedChoice=value;for(const option of wrap.children){option.classList.toggle('is-selected',option.dataset.choice===value);option.setAttribute('aria-pressed',String(option.dataset.choice===value));}const accept=[...actions.querySelectorAll('button')].find(x=>x.dataset.action==='accept');if(accept)accept.disabled=busy||!selectedChoice;const send=panel.querySelector('[data-action="send"]');if(send)send.disabled=busy||!selectedFriendId||!selectedChoice;});b.dataset.choice=value;b.classList.toggle('is-selected',selectedChoice===value);b.setAttribute('aria-pressed',String(selectedChoice===value));wrap.append(b);}return wrap;};
  async function act(event,payload){if(busy)return;busy=true;try{const r=await request(event,payload);toast(r.message||'대결 신청을 처리했어요.');if(payload?.requestId&&shownInviteId===payload.requestId&&inviteDialog.open){inviteDialog.close();shownInviteId='';}}catch(e){toast(e.message);void refresh();}finally{busy=false;update();if(inviteDialog.open){const invite=getRoom?.()?.cancerInvites?.find(x=>x.id===shownInviteId);for(const action of actions.querySelectorAll('button'))action.disabled=action.dataset.action==='accept'&&invite?.level===2&&!selectedChoice;}}}
  async function refresh(){try{await request('constellation-ability:status',{});}catch{}}
  function update(){
    const player=getPlayer(),room=getRoom?.(),status=player?.constellationAbility;panel.replaceChildren();panel.hidden=status?.constellationId!=='cancer';
    const level=Number(status?.level),invites=(room?.cancerInvites||[]).filter(x=>x.expiresAt>Date.now());
    if(!panel.hidden&&level>=2&&level<=5&&status.canUse){
      const heading=document.createElement('h3');heading.textContent='친구와 주간 대결';panel.append(heading);
      const pending=invites.find(x=>x.fromId===player.id);
      if(pending){const p=document.createElement('p');p.textContent=`${pending.toNickname||'친구'}님이 대결 신청에 답하기를 기다리고 있어요.`;panel.append(p);}
      else {
        const friends=(room?.players||[]).filter(x=>x.role==='student'&&x.id!==player.id&&x.connected&&!x.away);
        const select=document.createElement('select');select.setAttribute('aria-label','대결할 친구');
        const empty=document.createElement('option');empty.value='';empty.textContent='친구를 선택하세요';select.append(empty);
        for(const f of friends){const o=document.createElement('option');o.value=f.id;o.textContent=f.nickname;select.append(o);}
        if(friends.some(f=>f.id===selectedFriendId))select.value=selectedFriendId;else if(selectedFriendId)selectedFriendId='';
        select.onchange=()=>{selectedFriendId=select.value;const send=panel.querySelector('[data-action="send"]');if(send)send.disabled=busy||!selectedFriendId||!!(level!==4&&!selectedChoice);};panel.append(select);
        let choices=null;if(level===2)choices=GESTURES;else if(level===3)choices=COIN;else if(level===5)choices=ODD_EVEN;
        if(choices){const text=document.createElement('p');text.className='cancer-duel-hint';text.textContent=level===2?'내가 낼 가위바위보를 골라요.':level===3?'앞면 또는 뒷면을 골라요.':'홀수 또는 짝수를 골라요.';panel.append(text,choiceSet(choices,'내 선택'));}
        else {selectedChoice='';const note=document.createElement('p');note.className='cancer-duel-hint';note.textContent='상대가 수락하면 별도의 선택 없이 대결해요.';panel.append(note);}
        const send=button('대결 신청 보내기',()=>void act('constellation-ability:use',{targetId:selectedFriendId,...(choices?{choice:selectedChoice}:{})}),true);
        send.dataset.action='send';
        send.disabled=busy||!selectedFriendId||!!(choices&&!selectedChoice);panel.append(send);
      }
    }
    const invite=invites.find(x=>x.toId===player?.id);
    if(invite&&invite.id!==shownInviteId){shownInviteId=invite.id;selectedChoice='';const sender=invite.fromNickname||room?.players?.find(x=>x.id===invite.fromId)?.nickname||'친구';
      title.textContent='게자리 주간 대결 신청';message.textContent=`${sender}님이 Lv${invite.level} 대결을 신청했어요${invite.level===2?' · 수락한 뒤 가위바위보를 골라요':''}.`;
      actions.replaceChildren();if(invite.level===2)actions.append(choiceSet(GESTURES,'수락할 때 낼 가위바위보'));
      actions.append(button('거절하기',()=>void act('cancer-duel:respond',{requestId:invite.id,accept:false})),button('수락하기',()=>void act('cancer-duel:respond',{requestId:invite.id,accept:true,...(invite.level===2?{choice:selectedChoice}:{})}),true));
      const accept=[...actions.querySelectorAll('button')].at(-1);accept.dataset.action='accept';accept.disabled=busy||(invite.level===2&&!selectedChoice);
      stop();if(!inviteDialog.open)inviteDialog.showModal();
    }else if(!invite&&inviteDialog.open)inviteDialog.close();
  }
  function result(data){
    const me=getPlayer();if(!me||![data.fromId,data.toId].includes(me.id))return;
    const mine=me.id===data.fromId?data.deltaFrom:data.deltaTo,other=me.id===data.fromId?data.deltaTo:data.deltaFrom;
    const winner=data.winnerId===me.id?'내 승리!':data.winnerId?'상대 승리':'무승부';
    const gesture=value=>GESTURES.find(x=>x[0]===value)?.[2]||COIN.concat(ODD_EVEN).find(x=>x[0]===value)?.[1]||value||'자동';
    resultTitle.textContent=winner;resultDialog.classList.remove('is-playing');void resultDialog.offsetWidth;resultDialog.classList.add('is-playing');
    const choices=data.level===4?`${data.fromNickname||'신청자'} 주사위 ${data.rolls?.[0]} · ${data.toNickname||'친구'} 주사위 ${data.rolls?.[1]}`:
      `${data.fromNickname||'신청자'}: ${gesture(data.initiatorChoice)} · ${data.toNickname||'친구'}: ${gesture(data.targetChoice)}`;
    const roll=data.level===3?` · 동전 ${data.rolls?.[0]%2?'앞면':'뒷면'}`:data.level===5?` · 주사위 ${data.rolls?.[0]} (${data.rolls?.[0]%2?'홀수':'짝수'})`:'';
    resultText.textContent=data.tie?`${choices}. 비겼어요. 주간 능력은 남아 있으니 다시 신청해 주세요.`:
      `${choices}${roll}. ${winner} 내 별 파편 ${mine>=0?'+':''}${mine}개 · 친구 ${other>=0?'+':''}${other}개`;
    stop();if(data.requestId&&shownInviteId===data.requestId&&inviteDialog.open){inviteDialog.close();shownInviteId='';}if(!resultDialog.open)resultDialog.showModal();toast(winner);
  }
  inviteDialog.addEventListener('cancel',e=>e.preventDefault());inviteDialog.addEventListener('close',()=>{if(!getRoom?.()?.cancerInvites?.some(x=>x.id===shownInviteId))shownInviteId='';});
  return {update,result,reset(){selectedFriendId='';selectedChoice='';shownInviteId='';busy=false;panel.hidden=true;if(inviteDialog.open)inviteDialog.close();if(resultDialog.open)resultDialog.close();}};
}
