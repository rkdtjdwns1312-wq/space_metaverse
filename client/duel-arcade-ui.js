import {DUEL_PICTURES,DUEL_MEMORY_SIZES,duelMemorySize} from '/shared/duel-arcade.js';

export function createDuelArcadeUI({request,stop,toast,getRoom,getSelfId,socket}){
  if(!document.querySelector('link[data-duel-style]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./duel-arcade.css',import.meta.url).href;link.dataset.duelStyle='';document.head.append(link);
  }
  const dialog=document.createElement('dialog');dialog.className='duel-dialog';dialog.setAttribute('aria-label','친구와 함께하는 오락기');
  const invitation=document.createElement('dialog');invitation.className='duel-dialog duel-invitation';invitation.setAttribute('aria-label','친구의 놀이 초대');
  document.body.append(dialog,invitation);
  let state=null,objectId=null,invite=null,busy=false,sizeId='3x4',warning='',version=0,generation=0,reconnecting=false,lastResult=null;
  const self=()=>getRoom()?.players?.find(p=>p.id===getSelfId());
  const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
  function button(text,run,className=''){
    const el=node('button',text,className);el.type='button';el.disabled=busy;el.onclick=run;return el;
  }
  function show(){stop();if(!dialog.open)dialog.showModal();}
  function take(next){
    if(!next)return;version++;
    if(next.closed){if(next.objectId===objectId)reset();return;}
    state=next;objectId=next.objectId;
    const g=next.game;
    if(g?.phase==='finished'&&lastResult!==g.id){lastResult=g.id;toast(resultText(g));}
    if(g?.phase==='playing'&&!g.spectator){if(invitation.open)invitation.close();invite=null;show();}
    render();
  }
  async function act(event,data={}){
    if(busy)return null;
    busy=true;warning='';const before=version,epoch=generation;render();renderInvite();
    try{
      const result=await request(event,data);
      if(epoch!==generation)return null;
      if(before===version&&result.state)take(result.state);
      return result;
    }catch(error){
      if(epoch===generation){warning=error.message;if(!warning.includes('3·3'))toast(warning);}
      return null;
    }finally{if(epoch===generation){busy=false;render();renderInvite();}}
  }
  function gameData(extra={}){return {sessionId:state.game.id,revision:state.game.revision,...extra};}
  function resultText(g){
    const winner=g.players.find(p=>p.id===g.winnerId);
    return winner?(winner.id===getSelfId()?'내가 이겼어요!':winner.nickname+' 친구가 이겼어요!'):'무승부예요. 함께 잘했어요!';
  }
  async function closeView(){
    if(state?.game&&!state.game.spectator){
      if(state.game.phase==='invited'){toast('초대 답변을 기다리고 있어요. 초대는 30초 후 끝나요.');return;}
      await act('duel:proposal',gameData({kind:'leave'}));return;
    }
    const result=await act('duel:unwatch');if(result&&dialog.open){dialog.close();objectId=null;state=null;}
  }
  function render(){
    if(!state)return;
    const focus=document.activeElement?.dataset?.duelCell,scroll=dialog.querySelector('.duel-board-scroll')?.scrollLeft||0;
    const heading=node('div',undefined,'duel-heading');heading.append(node('h2',state.name));
    heading.append(button(state.game&&!state.game.spectator?'함께 나가기':'닫기',closeView,'duel-secondary'));
    const body=node('div'),g=state.game;
    if(!g){
      body.append(node('p',state.teacher?'선생님은 학생을 초대하지 않고 진행 중인 놀이를 관전해요.':
        '같은 오락기 가까이에 있는 친구를 골라 초대해요. 친구가 수락하면 시작해요.'));
      if(state.busy)body.append(node('p','다른 친구들이 이 오락기에서 놀고 있어요. 잠시 기다려주세요.','duel-status'));
      else if(!state.teacher){
        if(state.gameId==='memory'){
          const label=node('label','카드판 크기 '),select=node('select');select.setAttribute('aria-label','카드판 크기');select.disabled=busy;
          for(const size of DUEL_MEMORY_SIZES){const option=node('option',size.rows+' × '+size.columns+' · '+size.pairs+'쌍');option.value=size.id;select.append(option);}
          select.value=sizeId;select.onchange=()=>{sizeId=select.value;};label.append(select);body.append(label);
        }
        const list=node('div',undefined,'duel-friends');
        for(const friend of state.candidates)list.append(button(friend.nickname+' 초대',()=>act('duel:invite',{objectId,targetId:friend.id,sizeId})));
        if(!state.candidates.length)list.append(node('p','친구를 기다리고 있어요. 함께할 친구와 이 오락기 앞으로 모여주세요.','duel-status'));
        body.append(list);
      }
    }else if(g.phase==='invited'){
      const size=duelMemorySize(g.sizeId);
      body.append(node('p',(size?size.rows+' × '+size.columns+' ('+size.pairs+'쌍) · ':'')+'친구의 초대 답변을 기다리고 있어요.','duel-status'));
      if(g.invite.toId===getSelfId()){
        body.append(button('함께 시작',()=>act('duel:respond',{inviteId:g.invite.id,accept:true})),button('거절',()=>act('duel:respond',{inviteId:g.invite.id,accept:false}),'duel-secondary'));
      }
    }else{
      const scores=node('div',undefined,'duel-scores');
      for(const p of g.players)scores.append(node('p',p.nickname+(p.id===getSelfId()?' (나)':'')+' · '+
        (g.gameId==='memory'?p.score+'쌍':p.stone===1?'● 흑돌':'○ 백돌')+(!p.connected?' · 연결 기다림':'')));
      body.append(scores);
      const current=g.players.find(p=>p.id===g.turnId),myTurn=g.turnId===getSelfId();
      const status=node('p',g.phase==='finished'?resultText(g):g.paused?'연결이 끊긴 친구를 30초 동안 기다리고 있어요.':
        g.proposal?'친구의 요청에 답해주세요.':g.revealUntil?'두 그림을 기억해요. 잠시 후 상대 차례예요.':myTurn?'내 차례예요!':(current?.nickname||'친구')+' 친구 차례예요.','duel-status');
      status.setAttribute('aria-live','polite');body.append(status);
      body.append(node('p',g.gameId==='memory'?'같은 그림을 찾으면 한 번 더! 가장 많은 짝을 찾으면 이겨요.':
        '흑돌부터 번갈아 두어요. 5개 이상 이으면 승리! 흑돌은 열린 3이 두 방향으로 생기는 3·3에 놓을 수 없어요.','duel-help'));
      if(g.gameId==='omok')body.append(node('p','작은 화면에서는 판을 좌우로 밀어 보세요. 방향키와 엔터로도 둘 수 있어요.','duel-help'));
      const wrap=node('div',undefined,'duel-board-scroll'),board=node('div',undefined,'duel-board '+(g.gameId==='memory'?'duel-memory duel-size-'+g.sizeId:'duel-omok'));
      board.setAttribute('role','group');board.setAttribute('aria-label',g.gameId==='memory'?'그림 카드판':'오목판. 방향키로 이동하고 엔터로 돌 놓기');
      const cols=g.gameId==='memory'?duelMemorySize(g.sizeId).columns:15;
      const values=g.gameId==='memory'?g.cards:g.board;
      values.forEach((value,index)=>{
        const face=g.gameId==='memory'?(value.value===null?'?':DUEL_PICTURES[value.value]):'';
        const cell=button(face,()=>act('duel:move',gameData({index})),'duel-cell');cell.dataset.duelCell=String(index);
        const occupied=g.gameId==='memory'?value.value!==null:!!value;
        // Keep board cells focusable for keyboard navigation and inspection.
        const unavailable=busy||g.phase!=='playing'||!myTurn||g.paused||!!g.proposal||!!g.revealUntil||occupied||g.spectator;
        cell.disabled=false;cell.setAttribute('aria-disabled',String(unavailable));
        cell.onclick=()=>{if(!unavailable)act('duel:move',gameData({index}));};
        cell.setAttribute('aria-label',(Math.floor(index/cols)+1)+'행 '+(index%cols+1)+'열 · '+
          (g.gameId==='memory'?(value.matched?'찾은 짝 ':value.value===null?'뒤집힌 카드 ': '공개된 카드 ')+(value.value===null?'':face):value===1?'흑돌':value===2?'백돌':'빈자리'));
        if(g.gameId==='memory'){if(value.matched)cell.classList.add('duel-matched');if(value.value===null)cell.classList.add('duel-hidden');}
        else{cell.classList.add(value===1?'duel-black':value===2?'duel-white':'duel-empty');if(g.winningLine.includes(index))cell.classList.add('duel-winning');}
        cell.onkeydown=event=>{
          const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-cols,ArrowDown:cols}[event.key];
          if(offset===undefined)return;event.preventDefault();event.stopPropagation();
          const next=Math.max(0,Math.min(values.length-1,index+offset));board.children[next]?.focus({preventScroll:false});
        };board.append(cell);
      });
      wrap.append(board);body.append(wrap);
      if(g.proposal){
        const box=node('div',undefined,'duel-proposal'),name=g.proposal.kind==='leave'?'함께 나가기':'새 판으로 다시하기';
        box.append(node('p',g.proposal.fromId===getSelfId()?name+'를 요청했어요. 친구의 동의를 기다려요.':name+' 요청이 왔어요. 동의하나요?'));
        if(g.proposal.fromId!==getSelfId()&&!g.spectator)box.append(button('동의',()=>act('duel:proposal:respond',gameData({proposalId:g.proposal.id,accept:true}))),button('계속 둘래요',()=>act('duel:proposal:respond',gameData({proposalId:g.proposal.id,accept:false})),'duel-secondary'));
        body.append(box);
      }
      if(!g.spectator){
        const actions=node('div',undefined,'duel-actions');
        if(!g.proposal&&!g.paused)actions.append(button('다시하기 요청',()=>act('duel:proposal',gameData({kind:'rematch'})),'duel-secondary'));
        if(g.phase==='playing')actions.append(button('기권',()=>{
          warning='기권하면 상대가 이기고 놀이가 끝나요.';render();
          const box=dialog.querySelector('.duel-warning');box.append(button('기권하고 끝내기',()=>act('duel:resign',gameData()),'duel-secondary'));
        },'duel-secondary'));
        body.append(actions);
      }
    }
    const warn=node('p',warning,'duel-warning');warn.setAttribute('role','status');warn.hidden=!warning;
    dialog.replaceChildren(heading,warn,body);
    if(focus!==undefined)dialog.querySelector('[data-duel-cell="'+focus+'"]')?.focus({preventScroll:true});
    const wrap=dialog.querySelector('.duel-board-scroll');if(wrap)wrap.scrollLeft=scroll;
  }
  function renderInvite(){
    if(!invite)return;
    const size=duelMemorySize(invite.sizeId),text=invite.invite.fromNickname+' 친구가 '+invite.name+(size?' '+size.rows+' × '+size.columns+' ('+size.pairs+'쌍)':'')+'에 초대했어요.';
    const actions=node('div',undefined,'duel-actions');
    actions.append(button('함께 시작',()=>replyInvite(true)),button('거절',()=>replyInvite(false),'duel-secondary'));
    invitation.replaceChildren(node('h2','친구의 놀이 초대'),node('p',text),actions);
  }
  async function replyInvite(accept){
    if(!invite)return;const id=invite.invite.id;
    const result=await act('duel:respond',{inviteId:id,accept});
    if(result){invite=null;if(invitation.open)invitation.close();}
  }
  function receiveInvite(value){
    if(!value.invite){if(invite?.objectId===value.objectId){invite=null;if(invitation.open)invitation.close();}return;}
    invite=value;renderInvite();stop();if(!invitation.open)invitation.showModal();
  }
  function reset(){generation++;busy=false;state=null;objectId=null;invite=null;warning='';lastResult=null;if(dialog.open)dialog.close();if(invitation.open)invitation.close();}
  async function update(){
    if(!getSelfId()){reset();return;}
    if(objectId&&self()?.mapId!=='star-street'){reset();return;}
    if(reconnecting&&objectId&&socket.connected&&self()){
      reconnecting=false;const result=await act('duel:open',{objectId});if(!result)reconnecting=true;
    }
  }
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeView();});
  invitation.addEventListener('cancel',event=>{event.preventDefault();replyInvite(false);});
  for(const modal of [dialog,invitation])for(const event of ['keydown','keyup'])modal.addEventListener(event,e=>e.stopPropagation());
  socket.on('duel:state',take);socket.on('duel:invite',receiveInvite);socket.on('duel:notice',value=>toast(value.message));
  socket.on('disconnect',()=>{reconnecting=true;warning='연결을 기다리고 있어요. 30초 안에 돌아오면 이어할 수 있어요.';render();});
  socket.on('connect',()=>{if(objectId)reconnecting=true;});
  return {async open(object){const result=await act('duel:open',{objectId:object.id});if(result)show();},reset,update};
}
