import {constellationOf} from '/shared/constellations.js';
import {STATUS_ICONS} from './status-icons.js';

const icons=new Map(STATUS_ICONS.map(icon=>[icon.id,icon]));
export function createPartyUI({getRoom,getSelfId,request,toast,stop}){
  const hud=document.createElement('aside');hud.id='party-hud';hud.setAttribute('aria-label','파티원 체력과 마나');
  hud.hidden=true;document.querySelector('.map-wrap').append(hud);
  const inviteButton=document.createElement('button');inviteButton.id='friend-party';inviteButton.className='secondary';
  inviteButton.type='button';inviteButton.textContent='파티 초대';
  document.getElementById('friend-summon').after(inviteButton);
  const header=document.createElement('div');header.className='party-hud-header';
  const heading=document.createElement('h3'),headerActions=document.createElement('div');headerActions.className='party-hud-actions';
  const friendsButton=document.createElement('button');friendsButton.id='party-friends';friendsButton.className='small secondary';
  friendsButton.type='button';friendsButton.textContent='초대하기';friendsButton.onclick=()=>document.getElementById('crew-button').click();
  const leaveButton=document.createElement('button');leaveButton.id='party-leave';leaveButton.className='small secondary';
  leaveButton.type='button';leaveButton.textContent='탈퇴하기';
  headerActions.append(friendsButton,leaveButton);header.append(heading,headerActions);
  const content=document.createElement('div');hud.append(header,content);
  const invitation=document.createElement('dialog');invitation.id='party-invitation';
  const title=document.createElement('h2');title.textContent='파티 초대';
  const message=document.createElement('p');
  const actions=document.createElement('div');actions.className='dialog-actions';
  const reject=document.createElement('button');reject.type='button';reject.className='secondary';reject.textContent='거절';
  const accept=document.createElement('button');accept.type='button';accept.className='primary';accept.textContent='수락';
  actions.append(reject,accept);invitation.append(title,message,actions);document.body.append(invitation);
  let friendId=null,inviteId=null,inviteKind='party',rolling=false;
  const me=()=>getRoom()?.players.find(p=>p.id===getSelfId());
  const safeText=value=>String(value??'');
  async function act(event,data,success){
    try{const result=await request(event,data);if(success)toast(success);return result;}
    catch(error){toast(error.message);return null;}
  }
  inviteButton.onclick=async()=>{
    inviteButton.disabled=true;
    const result=await act('party:invite',{targetId:friendId},'파티 초대를 보냈어요.');
    if(result&&document.getElementById('friend-dialog').open)document.getElementById('friend-dialog').close();
    inviteButton.disabled=false;
  };
  leaveButton.onclick=async()=>{stop();leaveButton.disabled=true;try{await act('party:leave',{},'파티에서 나왔어요.');}finally{leaveButton.disabled=false;}};
  async function respond(agree){
    if(!inviteId)return;
    accept.disabled=reject.disabled=true;
    const result=await act(inviteKind==='pisces'?'constellation-ability:pair-respond':'party:respond',{requestId:inviteId,accept:agree},agree?(inviteKind==='pisces'?'짝 상태를 수락했어요.':'파티에 참여했어요.'):(inviteKind==='pisces'?'짝 신청을 거절했어요.':'초대를 거절했어요. 5분 동안 다시 초대받지 않아요.'));
    accept.disabled=reject.disabled=false;
    if(result&&invitation.open)invitation.close();
  }
  accept.onclick=()=>respond(true);reject.onclick=()=>respond(false);
  invitation.addEventListener('cancel',event=>{event.preventDefault();respond(false);});
  async function reroll(dropId){
    if(rolling)return;rolling=true;
    await act('party:roll',{dropId},'주사위를 다시 굴렸어요.');rolling=false;
  }
  window.addEventListener('keydown',event=>{
    if(event.code!=='KeyR'||event.repeat||event.ctrlKey||event.altKey||event.metaKey||
      event.target.isContentEditable||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(event.target.tagName))return;
    const roll=getRoom()?.lootRolls?.find(r=>r.tiedIds?.includes(getSelfId()));
    if(!roll)return;event.preventDefault();reroll(roll.dropId);
  });
  function update(){
    const room=getRoom(),self=me(),party=room?.party;
    leaveButton.hidden=!party;
    const locked=!!party?.piscesPair&&party.endsAt>Date.now();leaveButton.disabled=locked;leaveButton.title=locked?'짝 상태가 끝날 때까지 탈퇴할 수 없어요.':'';
    friendsButton.disabled=locked;friendsButton.title=locked?'짝 상태에는 다른 친구를 초대할 수 없어요.':'';
    const friend=room?.players.find(p=>p.id===friendId);
    const denied=room?.partyDeclines?.find(r=>r.targetId===friendId&&r.until>Date.now());
    inviteButton.hidden=!friend||friend.role==='teacher'||self?.role==='teacher';
    inviteButton.disabled=!friend?.connected||!!denied||!!room?.party&&(room.party.memberIds.length>=4||room.party.piscesPair)||!!room?.party?.memberIds.includes(friendId);
    inviteButton.title=denied?'거절 뒤 5분이 지나야 다시 초대할 수 있어요.':'최대 네 명까지 함께할 수 있어요.';
    const pairInvite=room?.piscesInvites?.find(r=>r.toId===getSelfId()&&r.expiresAt>Date.now());
    const pending=pairInvite||room?.partyInvites?.find(r=>r.expiresAt>Date.now());
    if(pending){inviteId=pending.id;inviteKind=pairInvite?'pisces':'party';title.textContent=pairInvite?'물고기자리 짝 신청':'파티 초대';
      message.textContent=pairInvite?`${safeText(pending.fromNickname)} 친구가 ${pending.days}일 동안 짝이 되자고 신청했어요. 수락하면 두 사람만의 파티가 되고 책상·급식 자리를 함께해요.${pending.level===3||pending.level===4?' 친구가 받은 새 경고를 신청한 친구도 받습니다.':''} 거절할 수 있어요.`:safeText(pending.fromNickname)+' 친구가 파티로 초대했어요. 함께할까요?';if(!invitation.open){stop();invitation.showModal();}}
    else{inviteId=null;if(invitation.open)invitation.close();}
    hud.hidden=!party;if(!party)return;
    heading.textContent=locked?'물고기자리 짝 · '+Math.max(1,Math.ceil((party.endsAt-Date.now())/86400000))+'일 남음':'우리 파티 '+party.memberIds.length+'/4';
    const list=document.createElement('ul');
    for(const id of party.memberIds){
      const player=room.players.find(p=>p.id===id);if(!player)continue;
      const row=document.createElement('li'),first=document.createElement('div'),second=document.createElement('div');
      first.className='party-member-name';second.className='party-member-vitals';
      const constellation=constellationOf(player.avatar?.constellationId,player.avatar?.level)?.name||'소행성';
      first.textContent=player.nickname+' · '+constellation+(player.id===getSelfId()?' (나)':'');
      const hp=player.vitals?.hp,mp=player.vitals?.mp;
      const stats=document.createElement('span');stats.textContent='♥ '+(hp?.current??0)+'/'+(hp?.max??0)+'   ✦ '+(mp?.current??0)+'/'+(mp?.max??0);
      second.append(stats);
      for(const effect of player.effects||[]){
        const icon=icons.get(effect.statusId);if(!icon)continue;
        const img=document.createElement('img');img.src=icon.url;img.alt=effect.label||icon.label;
        img.title=effect.label||icon.label;img.width=20;img.height=20;second.append(img);
      }
      row.append(first,second);list.append(row);
    }
    content.replaceChildren(list);
    const roll=room.lootRolls?.find(r=>r.tiedIds?.includes(getSelfId())||r.rolls?.some(v=>v.playerId===getSelfId()));
    if(roll){
      const status=document.createElement('p');status.className='party-roll-message';
      const mine=roll.rolls.find(r=>r.playerId===getSelfId());
      status.textContent='🎲 '+(mine?mine.value+' · ':'')+(roll.winnerId?
        (roll.awarded===false?'당첨된 친구의 가방이 가득 차 아이템이 바닥에 남았어요.':
          roll.winnerId===getSelfId()?'내가 아이템을 받았어요!':(room.players.find(p=>p.id===roll.winnerId)?.nickname||'친구')+' 친구가 아이템을 받았어요.'):
        '최고 눈이 같아요. 다시 굴려요!');
      content.append(status);
      if(roll.tiedIds?.includes(getSelfId())){
        const button=document.createElement('button');button.type='button';button.className='small secondary';
        button.textContent='다시 굴리기 R';button.onclick=()=>reroll(roll.dropId);content.append(button);
      }
    }
  }
  return {friend(id){friendId=id;update();},update,reset(){friendId=null;inviteId=null;hud.hidden=true;if(invitation.open)invitation.close();}};
}
