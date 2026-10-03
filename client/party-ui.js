import {constellationOf} from '/shared/constellations.js';
import {STATUS_ICONS} from './status-icons.js';

const icons=new Map(STATUS_ICONS.map(icon=>[icon.id,icon]));
export function createPartyUI({getRoom,getSelfId,request,toast,stop}){
  const hud=document.createElement('aside');hud.id='party-hud';hud.setAttribute('aria-label','파티원 체력과 마나');
  hud.hidden=true;document.querySelector('.map-wrap').append(hud);
  const inviteButton=document.createElement('button');inviteButton.id='friend-party';inviteButton.className='secondary';
  inviteButton.type='button';inviteButton.textContent='파티 초대';
  document.getElementById('friend-summon').after(inviteButton);
  const leaveButton=document.createElement('button');leaveButton.id='party-leave';leaveButton.className='secondary';
  leaveButton.type='button';leaveButton.textContent='파티 나가기';
  document.getElementById('social-dialog').querySelector('.dialog-actions').prepend(leaveButton);
  const invitation=document.createElement('dialog');invitation.id='party-invitation';
  const title=document.createElement('h2');title.textContent='파티 초대';
  const message=document.createElement('p');
  const actions=document.createElement('div');actions.className='dialog-actions';
  const reject=document.createElement('button');reject.type='button';reject.className='secondary';reject.textContent='거절';
  const accept=document.createElement('button');accept.type='button';accept.className='primary';accept.textContent='수락';
  actions.append(reject,accept);invitation.append(title,message,actions);document.body.append(invitation);
  let friendId=null,inviteId=null,rolling=false;
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
  leaveButton.onclick=()=>act('party:leave',{},'파티에서 나왔어요.');
  async function respond(agree){
    if(!inviteId)return;
    accept.disabled=reject.disabled=true;
    await act('party:respond',{requestId:inviteId,accept:agree},agree?'파티에 참여했어요.':'초대를 거절했어요. 5분 동안 다시 초대받지 않아요.');
    accept.disabled=reject.disabled=false;
    if(invitation.open)invitation.close();
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
    const friend=room?.players.find(p=>p.id===friendId);
    const denied=room?.partyDeclines?.find(r=>r.targetId===friendId&&r.until>Date.now());
    inviteButton.hidden=!friend||friend.role==='teacher'||self?.role==='teacher';
    inviteButton.disabled=!friend?.connected||!!denied||!!room?.party&&room.party.memberIds.length>=4||!!room?.party?.memberIds.includes(friendId);
    inviteButton.title=denied?'거절 뒤 5분이 지나야 다시 초대할 수 있어요.':'최대 네 명까지 함께할 수 있어요.';
    const pending=room?.partyInvites?.find(r=>r.expiresAt>Date.now());
    if(pending){inviteId=pending.id;message.textContent=safeText(pending.fromNickname)+' 친구가 파티로 초대했어요. 함께할까요?';if(!invitation.open){stop();invitation.showModal();}}
    else{inviteId=null;if(invitation.open)invitation.close();}
    hud.hidden=!party;if(!party)return;
    const heading=document.createElement('h3');heading.textContent='✦ 우리 파티 · '+party.memberIds.length+'/4';
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
    hud.replaceChildren(heading,list);
    const roll=room.lootRolls?.find(r=>r.tiedIds?.includes(getSelfId())||r.rolls?.some(v=>v.playerId===getSelfId()));
    if(roll){
      const status=document.createElement('p');status.className='party-roll-message';
      const mine=roll.rolls.find(r=>r.playerId===getSelfId());
      status.textContent='🎲 '+(mine?mine.value+' · ':'')+(roll.winnerId?
        (roll.awarded===false?'당첨된 친구의 가방이 가득 차 아이템이 바닥에 남았어요.':
          roll.winnerId===getSelfId()?'내가 아이템을 받았어요!':(room.players.find(p=>p.id===roll.winnerId)?.nickname||'친구')+' 친구가 아이템을 받았어요.'):
        '최고 눈이 같아요. 다시 굴려요!');
      hud.append(status);
      if(roll.tiedIds?.includes(getSelfId())){
        const button=document.createElement('button');button.type='button';button.className='small secondary';
        button.textContent='다시 굴리기 R';button.onclick=()=>reroll(roll.dropId);hud.append(button);
      }
    }
  }
  return {friend(id){friendId=id;update();},update,reset(){friendId=null;inviteId=null;hud.hidden=true;if(invitation.open)invitation.close();}};
}
