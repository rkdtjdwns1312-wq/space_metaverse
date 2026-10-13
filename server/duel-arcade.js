import {randomInt,randomUUID} from 'node:crypto';
import {GameError} from './pin-auth.js';
import {DUEL_RULES,duelMachine,duelMemorySize,nearDuelMachine,omokLine,isOmokDoubleThree} from '../shared/duel-arcade.js';

const requireThat=(condition,message)=>{if(!condition)throw new GameError(message);};
const online=p=>!!p?.connected&&!p.away;

/** Ephemeral state is deliberately outside RoomStore and its persistence snapshots.
 * getRoom(code) MUST look up the current room (transactions can replace objects).
 * emitPrivate(code, playerId, event, payload) MUST resolve the current socket and
 * use the app's deliver(()=>socket.emit(...)), never io.to(room.code).
 * Run onTick() after world movement, outside transactions. After successful
 * room teardown call closeRoom(code). Optional playerLeft(code,id) is also
 * post-commit; otherwise tick detects removals/map changes. No own timers.
 */
export function createDuelArcade({getRoom,emitPrivate,clock=Date.now,random=randomInt}){
  const rooms=new Map();
  function bucket(code){
    if(!rooms.has(code))rooms.set(code,{games:new Map(),viewers:new Map()});
    return rooms.get(code);
  }
  function send(code,id,event,payload){emitPrivate(code,id,event,payload);}
  function sessionOf(b,id){return [...b.games.values()].find(g=>g.ids.includes(id));}
  function access(session){
    const room=getRoom(session?.room?.code),player=room?.players.get(session?.player?.id);
    requireThat(room&&player&&player===session.player&&online(player),'먼저 교실에 다시 입장해주세요.');
    return {room,player,b:bucket(room.code)};
  }
  function students(room,machine){return [...room.players.values()].filter(p=>p.role==='student'&&online(p)&&nearDuelMachine(p,machine));}
  function gameView(room,g,viewerId){
    const result={id:g.id,objectId:g.objectId,gameId:g.gameId,sizeId:g.sizeId,phase:g.phase,revision:g.revision,
      players:g.ids.map((id,i)=>({id,nickname:room.players.get(id)?.nickname||'친구',connected:online(room.players.get(id)),
        score:g.scores[i],stone:g.gameId==='omok'?i+1:null})),
      turnId:g.ids[g.turn],winnerId:g.winnerId??null,reason:g.reason??null,winningLine:[...g.winningLine],
      paused:g.offline.size>0,pauseUntil:g.offline.size?Math.min(...g.offline.values())+DUEL_RULES.disconnectMs:null,
      revealUntil:g.revealUntil||null,proposal:g.proposal?{...g.proposal}:null,
      spectator:!g.ids.includes(viewerId)};
    if(g.phase==='invited'){
      result.invite={id:g.id,fromId:g.ids[0],toId:g.ids[1],expiresAt:g.expiresAt};
    }else if(g.gameId==='memory'){
      // A newly connected client receives only the currently visible cards.
      result.cards=g.deck.map((value,index)=>({index,value:g.matched[index]||g.flipped.includes(index)?value:null,matched:!!g.matched[index]}));
    }else result.board=[...g.board];
    return result;
  }
  function state(room,b,id,objectId){
    const machine=duelMachine(objectId),p=room.players.get(id),g=b.games.get(objectId);
    const canSee=g&&(g.ids.includes(id)||p?.role==='teacher'&&g.phase!=='invited');
    return {objectId,gameId:machine.gameId,name:machine.name,teacher:p?.role==='teacher',busy:!!g&&!canSee,
      candidates:students(room,machine).filter(friend=>friend.id!==id&&!sessionOf(b,friend.id)).map(friend=>({id:friend.id,nickname:friend.nickname})),
      game:canSee?gameView(room,g,id):null};
  }
  function publish(room,b){
    for(const [id,view] of b.viewers){
      const p=room.players.get(id),g=sessionOf(b,id);
      if(!online(p)){if(!g)b.viewers.delete(id);continue;}
      if(!nearDuelMachine(p,duelMachine(view.objectId))&&!g){
        send(room.code,id,'duel:state',{objectId:view.objectId,closed:true});b.viewers.delete(id);continue;
      }
      const value=state(room,b,id,view.objectId),signature=JSON.stringify(value);
      if(signature!==view.signature||p.socketId!==view.socketId){
        view.signature=signature;view.socketId=p.socketId;send(room.code,id,'duel:state',value);
      }
    }
  }
  function watch(b,id,objectId){b.viewers.set(id,{objectId,signature:null,socketId:null});}
  function finish(g,winnerId,reason){
    // Departure/timeout may clean up a completed game, but cannot decide it again.
    if(g.phase==='finished')return;
    g.phase='finished';g.winnerId=winnerId;g.reason=reason;g.proposal=null;g.flipped=[];g.revealUntil=0;g.revealRemaining=null;g.offline.clear();g.revision++;
  }
  function remove(room,b,g,reason){
    for(const id of g.ids)send(room.code,id,'duel:invite',{objectId:g.objectId,invite:null});
    b.games.delete(g.objectId);
    if(reason)for(const id of g.ids)send(room.code,id,'duel:notice',{message:reason});
  }
  function start(g){
    const pairs=duelMemorySize(g.sizeId)?.pairs||0;
    g.id=randomUUID();g.phase='playing';g.turn=0;g.revision++;g.scores=[0,0];g.flipped=[];g.matched=Array(pairs*2).fill(false);
    g.board=Array(225).fill(0);g.revealUntil=0;g.revealRemaining=null;g.proposal=null;g.winnerId=null;g.reason=null;g.winningLine=[];g.offline.clear();
    g.deck=g.gameId==='memory'?Array.from({length:pairs*2},(_,i)=>i%pairs):[];
    for(let i=g.deck.length-1;i>0;i--){const j=random(i+1);[g.deck[i],g.deck[j]]=[g.deck[j],g.deck[i]];}
  }
  function reconcile(room,b){
    const now=clock();
    for(const g of [...b.games.values()]){
      const missing=g.ids.filter(id=>!room.players.has(id)||!nearDuelMachine(room.players.get(id),duelMachine(g.objectId)));
      if(missing.length){
        if(g.phase!=='invited'){
          finish(g,missing.length===1?g.ids.find(id=>id!==missing[0]):null,'left');publish(room,b);
        }
        remove(room,b,g,'친구가 오락기나 맵을 떠나 놀이가 끝났어요.');continue;
      }
      if(g.phase==='invited'){
        if(now>=g.expiresAt||g.ids.some(id=>!online(room.players.get(id))))remove(room,b,g,'초대가 끝났어요. 가까운 친구를 다시 초대해 주세요.');
        continue;
      }
      for(const id of g.ids){
        if(!online(room.players.get(id))){if(!g.offline.has(id))g.offline.set(id,now);}
        // Check the deadline before accepting a late reconnection.
        else if(g.offline.has(id)&&now-g.offline.get(id)<DUEL_RULES.disconnectMs)g.offline.delete(id);
      }
      const timedOut=[...g.offline].filter(([,at])=>now-at>=DUEL_RULES.disconnectMs).map(([id])=>id);
      if(timedOut.length){
        const connected=g.ids.filter(id=>online(room.players.get(id))&&!timedOut.includes(id));
        finish(g,connected.length===1?connected[0]:null,'disconnect');publish(room,b);remove(room,b,g,'30초 동안 연결되지 않아 놀이가 끝났어요.');continue;
      }
      // Freeze the remaining reveal duration once; resume only when BOTH peers
      // are online. Keep the two faces visible throughout the reconnect window.
      if(g.offline.size){
        if(g.revealUntil){g.revealRemaining=Math.max(0,g.revealUntil-now);g.revealUntil=0;g.revision++;}
      }else if(g.revealRemaining!==null){
        g.revealUntil=now+g.revealRemaining;g.revealRemaining=null;g.revision++;
      }
      if(g.proposal&&now>=g.proposal.expiresAt){g.proposal=null;g.revision++;}
      if(!g.offline.size&&g.revealUntil&&now>=g.revealUntil){g.flipped=[];g.revealUntil=0;g.turn=1-g.turn;g.revision++;}
    }
    publish(room,b);
  }
  function current(session,data){
    const {room,player,b}=access(session);reconcile(room,b);
    const g=sessionOf(b,player.id);
    requireThat(g&&g.id===data.sessionId,'놀이가 바뀌었어요. 오락기를 다시 열어주세요.');
    requireThat(Number.isInteger(data.revision)&&data.revision===g.revision,'화면이 바뀌었어요. 차례를 확인하고 다시 눌러주세요.');
    requireThat(player.role==='student','선생님은 관전만 할 수 있어요.');
    return {room,player,b,g};
  }
  function usable(g){
    requireThat(!g.offline.size,'친구의 연결을 30초 동안 기다리고 있어요.');
    requireThat(!g.proposal,'친구가 나가기·다시하기 요청에 답할 때까지 기다려주세요.');
  }
  const api={
    open(session,data){
      const {room,player,b}=access(session);reconcile(room,b);
      const machine=duelMachine(data.objectId);
      requireThat(nearDuelMachine(player,machine),'오락기 가까이에서 열어주세요.');
      const currentGame=sessionOf(b,player.id);
      requireThat(!currentGame||currentGame.objectId===machine.id,'지금 함께하는 놀이를 먼저 마쳐주세요.');
      watch(b,player.id,machine.id);publish(room,b);return {state:state(room,b,player.id,machine.id)};
    },
    invite(session,data){
      const {room,player,b}=access(session);reconcile(room,b);
      const machine=duelMachine(data.objectId),target=room.players.get(data.targetId);
      requireThat(machine&&(machine.gameId!=='memory'||duelMemorySize(data.sizeId)),'카드판 크기를 골라주세요.');
      requireThat(player.role==='student'&&target?.role==='student'&&player.id!==target.id,'함께할 학생 친구를 골라주세요. 선생님은 관전만 해요.');
      requireThat(online(target)&&nearDuelMachine(player,machine)&&nearDuelMachine(target,machine),'두 친구 모두 같은 오락기 가까이에 있어야 해요.');
      requireThat(!b.games.has(machine.id)&&!sessionOf(b,player.id)&&!sessionOf(b,target.id),'이미 초대나 놀이를 진행 중이에요.');
      const g={id:randomUUID(),objectId:machine.id,gameId:machine.gameId,sizeId:machine.gameId==='memory'?data.sizeId:null,phase:'invited',ids:[player.id,target.id],revision:0,
        turn:0,scores:[0,0],winningLine:[],offline:new Map(),expiresAt:clock()+DUEL_RULES.inviteMs};
      b.games.set(machine.id,g);watch(b,player.id,machine.id);watch(b,target.id,machine.id);
      send(room.code,target.id,'duel:invite',{objectId:machine.id,name:machine.name,sizeId:g.sizeId,invite:{id:g.id,fromId:player.id,fromNickname:player.nickname,expiresAt:g.expiresAt}});
      publish(room,b);return {state:state(room,b,player.id,machine.id)};
    },
    respond(session,data){
      const {room,player,b}=access(session);reconcile(room,b);
      const g=sessionOf(b,player.id);
      requireThat(g?.phase==='invited'&&g.id===data.inviteId&&g.ids[1]===player.id&&typeof data.accept==='boolean','이 초대에 답할 수 없어요.');
      if(data.accept){
        // Colour/first player assignment is server-owned, including rematches.
        if(random(2))g.ids.reverse();
        for(const id of g.ids)send(room.code,id,'duel:invite',{objectId:g.objectId,invite:null});
        start(g);
      }else remove(room,b,g,'친구가 초대를 거절했어요.');
      publish(room,b);return {state:state(room,b,player.id,g.objectId)};
    },
    move(session,data){
      const {room,player,b,g}=current(session,data);usable(g);
      requireThat(g.phase==='playing'&&g.ids[g.turn]===player.id,'지금은 내 차례가 아니에요.');
      requireThat(!g.revealUntil,'두 그림을 잠깐 확인해 주세요.');
      const index=data.index,max=g.gameId==='memory'?g.deck.length:225;
      requireThat(Number.isInteger(index)&&index>=0&&index<max,'놀이판의 빈칸을 골라주세요.');
      if(g.gameId==='memory'){
        requireThat(!g.matched[index]&&!g.flipped.includes(index),'아직 뒤집지 않은 카드를 골라주세요.');
        g.flipped.push(index);
        if(g.flipped.length===2){
          const [a,b]=g.flipped;
          if(g.deck[a]===g.deck[b]){
            g.matched[a]=g.matched[b]=true;g.scores[g.turn]++;g.flipped=[];
            if(g.scores[0]+g.scores[1]===g.deck.length/2)finish(g,g.scores[0]===g.scores[1]?null:g.ids[g.scores[0]>g.scores[1]?0:1],'complete');
          }else g.revealUntil=clock()+DUEL_RULES.revealMs;
        }
      }else{
        requireThat(g.board[index]===0,'이미 돌이 놓인 자리예요.');
        const next=[...g.board];next[index]=g.turn+1;
        requireThat(g.turn!==0||!isOmokDoubleThree(next,index),'3·3 자리에는 놓을 수 없어요.');
        g.board=next;g.winningLine=omokLine(g.board,index);
        if(g.winningLine.length)finish(g,player.id,'complete');
        else if(g.board.every(Boolean))finish(g,null,'draw');
        else g.turn=1-g.turn;
      }
      g.revision++;publish(room,b);return {state:state(room,b,player.id,g.objectId)};
    },
    proposal(session,data){
      const {room,player,b,g}=current(session,data);usable(g);
      requireThat(['playing','finished'].includes(g.phase)&&['leave','rematch'].includes(data.kind),'나가기 또는 다시하기를 골라주세요.');
      g.proposal={id:randomUUID(),kind:data.kind,fromId:player.id,expiresAt:clock()+DUEL_RULES.proposalMs};
      g.revision++;publish(room,b);return {state:state(room,b,player.id,g.objectId)};
    },
    proposalRespond(session,data){
      const {room,player,b,g}=current(session,data);
      requireThat(!g.offline.size&&g.proposal&&g.proposal.fromId!==player.id&&g.proposal.id===data.proposalId&&typeof data.accept==='boolean','친구의 요청을 다시 확인해주세요.');
      if(data.accept){
        if(g.proposal.kind==='leave')remove(room,b,g,'두 친구가 동의해서 놀이를 마쳤어요.');
        else {if(random(2))g.ids.reverse();start(g);}
      }else {g.proposal=null;g.revision++;}
      publish(room,b);return {state:state(room,b,player.id,g.objectId)};
    },
    resign(session,data){
      const {room,player,b,g}=current(session,data);
      requireThat(g.phase==='playing','진행 중인 놀이에서 기권할 수 있어요.');
      finish(g,g.ids.find(id=>id!==player.id),'resign');publish(room,b);
      remove(room,b,g,'기권으로 놀이가 끝났어요.');publish(room,b);return {state:state(room,b,player.id,g.objectId)};
    },
    unwatch(session){
      const {room,player,b}=access(session);
      requireThat(!sessionOf(b,player.id),'함께하는 놀이를 먼저 마쳐주세요.');
      b.viewers.delete(player.id);if(!b.games.size&&!b.viewers.size)rooms.delete(room.code);return {};
    },
    onTick(){
      for(const [code,b] of rooms){const room=getRoom(code);if(!room){rooms.delete(code);continue;}reconcile(room,b);}
    },
    playerLeft(code,id){
      const room=getRoom(code),b=rooms.get(code);if(!room||!b)return;
      const g=sessionOf(b,id);
      if(g){if(g.phase!=='invited'){finish(g,g.ids.find(other=>other!==id),'left');publish(room,b);}remove(room,b,g,'친구가 교실을 떠나 놀이가 끝났어요.');}
      b.viewers.delete(id);publish(room,b);
    },
    closeRoom(code){rooms.delete(code);},
    dispose(){rooms.clear();}
  };
  return api;
}

export function registerDuelArcade({socket,action,duel,getSession=()=>socket.data.session}){
  for(const [event,method] of Object.entries({open:'open',invite:'invite',respond:'respond',move:'move',proposal:'proposal','proposal:respond':'proposalRespond',resign:'resign',unwatch:'unwatch'})){
    action('duel:'+event,data=>{
      const session=getSession();
      requireThat(session?.player?.socketId===socket.id,'현재 접속에서 다시 입장해주세요.');
      return duel[method](session,data);
    },false);
  }
}
