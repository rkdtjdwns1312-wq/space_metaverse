import {createChatWindow} from './chat-window.js';
// 하단 메뉴와 친구 기능. 게임 렌더러와 서버 권한 로직은 별도 파일에 둡니다.
export function createSocialUI({getRoom,getSelfId,request,stop,toast,renderMessage,clearMessages}) {
  const $=id=>document.getElementById(id);
  let messages=[],context='',revision=0,friendId=null,invitationId=null,unread=0;
  const chatWindow=createChatWindow({stop});
  let renderedIds='';
  const me=()=>getRoom()?.players.find(p=>p.id===getSelfId());
  const closeRoots=()=>{for(const id of ['social-dialog','menu-dialog','friend-dialog'])if($(id).open)$(id).close();};
  function open(id){stop();closeRoots();if(!$(id).open)$(id).showModal();}
  for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>$(button.dataset.close).close();
  // 프로필의 스킬 4칸은 index.html에서 상태·효과와 함께 구성합니다.
  $('dock-avatar').onclick=()=>open('avatar-dialog');
  $('dock-inventory').onclick=()=>open('inventory-dialog');
  $('dock-tasks').onclick=()=>open('tasks-dialog');
  $('dock-chat').onclick=()=>open('social-dialog');
  $('dock-menu').onclick=()=>open('menu-dialog');
  $('menu-dialog').addEventListener('click',e=>{if(e.target.closest('#teacher-tools,#planet-new,#planet-exit,#planet-info,#leave'))closeRoots();},true);
  $('crew-button').addEventListener('click',closeRoots,true);
  $('open-chat').onclick=()=>openChat();
  $('chat-window-toggle').onclick=()=>{$('chat-dialog').open?$('chat-dialog').close():openChat();};
  function render(){
    const channel=$('chat-channel').value,target=$('chat-recipient').value;
    const visible=messages.filter(msg=>msg.role==='system'||msg.channel===channel&&(channel!=='direct'||(msg.playerId===getSelfId()?msg.targetId:msg.playerId)===target));
    const signature=channel+'|'+target+'|'+visible.map(m=>m.id).join(',');
    if(signature===renderedIds)return;
    const scroll=chatWindow.capture();clearMessages();for(const msg of visible)renderMessage(msg);
    renderedIds=signature;chatWindow.restore(scroll);
  }
  async function refresh(){
    const rev=++revision;
    try{const result=await request('chat:history',{});if(rev===revision){messages=[...new Map([...result.messages,...messages].map(m=>[m.id,m])).values()].sort((a,b)=>a.at-b.at).slice(-200);render();}}
    catch(e){if(rev===revision)toast(e.message);}
  }
  function routing(){
    const channel=$('chat-channel').value,room=getRoom();
    $('chat-recipient').hidden=channel!=='direct';
    const department=room?.planets.find(p=>p.id===me()?.departmentId);
    $('chat-context').textContent=channel==='map'?'전체 대화는 지금 같은 맵에 있는 친구에게만 보여요.':channel==='department'?(department?department.name+' 소속 친구끼리 다른 맵에서도 대화해요.':'부서행성에 가입하면 사용할 수 있어요.'):'선택한 친구와 나만 볼 수 있는 1:1 대화예요.';
    render();
  }
  function openChat(targetId){
    if(targetId){$('chat-channel').value='direct';$('chat-recipient').value=targetId;}
    routing();closeRoots();chatWindow.open();unread=0;$('unread-count').hidden=true;$('chat-input').focus();refresh();
  }
  $('chat-channel').onchange=routing;$('chat-recipient').onchange=routing;
  function friendState(){
    const room=getRoom(),p=room?.players.find(p=>p.id===friendId);
    if(!p){if($('friend-dialog').open)$('friend-dialog').close();return;}
    $('friend-title').textContent=p.nickname+' 친구';
    const blocked=room.summonCooldowns?.find(r=>r.targetId===friendId&&r.until>Date.now());
    $('friend-whisper').disabled=!p.connected;$('friend-summon').disabled=!p.connected||!!blocked;
    $('friend-note').textContent=blocked?'거절 후 24시간 동안 다시 부를 수 없어요. 다시 요청: '+new Date(blocked.until).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'상대가 예를 눌러야 내 앞으로 와요. 요청은 1분 동안 유효해요.';
  }
  function friend(id){friendId=id;friendState();if($('crew-dialog').open)$('crew-dialog').close();open('friend-dialog');}
  $('friend-whisper').onclick=()=>openChat(friendId);
  $('friend-summon').onclick=async()=>{
    $('friend-summon').disabled=true;
    try{await request('social:summon',{targetId:friendId});toast('친구에게 요청을 보냈어요.');$('friend-dialog').close();}
    catch(e){toast(e.message);}finally{friendState();}
  };
  function invitations(){
    const next=getRoom()?.summons?.find(r=>r.toId===getSelfId()&&r.expiresAt>Date.now());
    if(!next){invitationId=null;if($('summon-dialog').open)$('summon-dialog').close();return;}
    invitationId=next.id;$('summon-message').textContent=next.fromNickname+' 친구가 자기 앞으로 와 달라고 해요. 이동할까요?';
    if(!$('summon-dialog').open){stop();$('summon-dialog').showModal();}
  }
  async function respond(accept){
    const id=invitationId;if(!id)return;
    $('summon-yes').disabled=true;$('summon-no').disabled=true;
    try{await request('social:respond',{requestId:id,accept});toast(accept?'친구 앞으로 이동했어요.':'거절했어요. 이 친구는 24시간 동안 다시 요청할 수 없어요.');}
    catch(e){toast(e.message);}finally{$('summon-yes').disabled=false;$('summon-no').disabled=false;invitations();}
  }
  $('summon-yes').onclick=()=>respond(true);$('summon-no').onclick=()=>respond(false);
  $('summon-dialog').addEventListener('cancel',e=>{e.preventDefault();respond(false);});
  setInterval(()=>{if(getSelfId()){invitations();if($('friend-dialog').open)friendState();}},1000);
  return {
    friend,openChat,
    update(){
      const room=getRoom(),self=me();if(!self)return;
      const old=$('chat-recipient').value;
      $('chat-recipient').replaceChildren(...room.players.filter(p=>p.id!==self.id&&p.connected).map(p=>Object.assign(document.createElement('option'),{value:p.id,textContent:p.nickname})));
      if([...$('chat-recipient').options].some(o=>o.value===old))$('chat-recipient').value=old;
      const next=room.code+'|'+self.mapId+'|'+self.departmentId;
      if(context&&context!==next){
        // 이미 직접 받은 맵 대화는 남깁니다. 새 메시지 전달 권한은 서버가 계속 검사합니다.
        messages=messages.filter(msg=>msg.channel!=='department'||msg.departmentId===self.departmentId);refresh();
      }
      context=next;routing();friendState();invitations();
    },
    seed(list){messages=list||[];render();},
    receive(msg){messages.push(msg);if(messages.length>200)messages.shift();render();if(!$('chat-dialog').open&&msg.playerId!==getSelfId()){unread++;$('unread-count').textContent=unread>99?'99+':unread;$('unread-count').hidden=false;}},
    clear(){messages=[];render();},
    reset(){chatWindow.reset();renderedIds='';messages=[];context='';revision++;friendId=null;invitationId=null;unread=0;$('unread-count').hidden=true;$('chat-channel').value='map';for(const d of document.querySelectorAll('dialog[open]'))d.close();},
    scope(){return {channel:$('chat-channel').value,targetId:$('chat-recipient').value};}
  };
}
