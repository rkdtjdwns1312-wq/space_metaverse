import express from 'express';
import { createServer } from 'node:http';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RoomStore, ensure, GameError, effectsView } from './rooms.js';
import { advance, spawnInside, exitPosition, isNear, placementFree, addPlanet, arrivePosition } from './world.js';
import { filterChat } from './chat-filter.js';
import { RULES, CHAT, DEPARTMENT_RULES, PLAZA_ID, PLANET, PLANET_COLORS, planetIdOfMap, interiorIdOf,
  STREET, STREET_ID, STATIC_MAPS, mapOf, SHARDS, SHOP, itemOf, ITEM_USE, TRADE, templateOf } from '../shared/config.js';

const equalSecret=(value,key) => {
  if(typeof value!=='string') return false;
  const a=Buffer.from(value),b=Buffer.from(key);
  return a.length===b.length && timingSafeEqual(a,b);
};
// 한국어 조사 '로/으로'는 앞 글자의 받침에 따라 달라집니다(받침 없음·ㄹ 받침이면 '로').
// 행성 이름을 아이들이 직접 지으므로 안내 문구마다 올바른 조사를 붙여줍니다.
const ro=word => {
  const last=[...String(word).trim()].pop()||'',code=last.codePointAt(0)||0;
  if(code<0xAC00 || code>0xD7A3) return '로';
  const jongseong=(code-0xAC00)%28;
  return (jongseong===0 || jongseong===8) ? '로' : '으로';
};
// 을/를, 이/가: 받침이 있으면 '을'/'이', 없으면 '를'/'가'. 아이템 사용 안내 문구에 씁니다.
const eul=word=>{
  const last=[...String(word).trim()].pop()||'',code=last.codePointAt(0)||0;
  if(code<0xAC00 || code>0xD7A3) return '를';
  return ((code-0xAC00)%28===0) ? '를' : '을';
};
const iga=word=>{
  const last=[...String(word).trim()].pop()||'',code=last.codePointAt(0)||0;
  if(code<0xAC00 || code>0xD7A3) return '가';
  return ((code-0xAC00)%28===0) ? '가' : '이';
};
// data.planetId/proposalId가 그 방에 실제로 있을 때만 통과시킵니다. 행성은 방마다 다르므로 room.planets에서 찾습니다.
const requirePlanet=(room,data) => {
  const planet=typeof data.planetId==='string'?room.planets.get(data.planetId):undefined;
  ensure(planet,'행성을 찾지 못했어요.');
  return planet;
};
const requireProposal=(room,data) => {
  const proposal=typeof data.proposalId==='string'?room.proposals.get(data.proposalId):undefined;
  ensure(proposal,'신청을 찾지 못했어요.');
  return proposal;
};
const validatePlanetName=raw => {
  const name=typeof raw==='string'?raw.normalize('NFKC').replace(/\p{Cf}/gu,'').trim():'';
  const nameRe=new RegExp('^[가-힣a-zA-Z0-9 ·!?]{'+PLANET.nameMin+','+PLANET.nameMax+'}$');
  ensure(nameRe.test(name),'행성 이름은 '+PLANET.nameMin+'~'+PLANET.nameMax+'자(한글·영문·숫자)로 적어주세요.');
  ensure(!filterChat(name).flagged,'행성 이름에 쓸 수 없는 말이 있어요.');
  return name;
};
// 행성 신청·생성 공통 입력 검증: 이름·소개·좌표(빈자리인지)·색·종류를 확인해 정리된 값을 돌려줍니다.
// 이름·소개·색은 사용자가 보낸 값을 그대로 쓰고(화면이 종류 기본값을 미리 채워 보낼 뿐), templateId만 실제로 그 종류가 있는지 검사합니다.
const planetInput=(room,data) => {
  const name=validatePlanetName(data.name);
  const description=typeof data.description==='string'?data.description.normalize('NFKC').replace(/\p{Cf}/gu,'').trim():'';
  const hasControl=[...description].some(ch=>{const c=ch.codePointAt(0);return c<32||c===127;});
  ensure(description.length<=PLANET.descriptionMax && !hasControl,'행성 소개는 '+PLANET.descriptionMax+'자 이내로 적어주세요.');
  ensure(!filterChat(description).flagged,'행성 소개에 쓸 수 없는 말이 있어요.');
  ensure(Number.isFinite(data.x) && Number.isFinite(data.y),'행성 위치를 확인해주세요.');
  const x=Math.round(data.x), y=Math.round(data.y);
  ensure(placementFree(room,x,y),'그 자리에는 행성을 만들 수 없어요. 조금 떨어진 곳을 골라주세요.');
  ensure(PLANET_COLORS.includes(data.color),'행성 색을 골라주세요.');
  ensure(templateOf(data.templateId),'행성 종류를 골라주세요.');
  return {name,description,x,y,color:data.color,templateId:data.templateId};
};
export function createClassroomServer({teacherKey, publicOrigin='', reconnectMs=RULES.reconnectMs}={}) {
  if(!teacherKey || teacherKey.length<16) throw new Error('TEACHER_KEY must be at least 16 characters.');
  const app=express(), http=createServer(app), store=new RoomStore();
  const originAllowed=req => !req.headers.origin || req.headers.origin===(publicOrigin || 'http://'+req.headers.host);
  const io=new Server(http,{maxHttpBufferSize:8192,allowRequest:(req,done)=>done(null,originAllowed(req))});
  app.disable('x-powered-by');
  app.use((req,res,next)=>{
    res.set({'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store'});
    next();
  });
  app.get('/health',(_req,res)=>res.json({ok:true,version:'0.1.0'}));
  app.use('/shared',express.static(fileURLToPath(new URL('../shared',import.meta.url))));
  app.use(express.static(fileURLToPath(new URL('../client',import.meta.url))));
  // 교사 키 무작위 대입은 연결을 새로 열어도 제한되도록 주소별로 집계합니다.
  const authAttempts=new Map();
  const joinChannel=s=>io.sockets.sockets.get(s.player.socketId)?.join(s.room.code);
  // 별 파편·아이템·거래는 아이들끼리 비밀이라 방 전체에 한 번 뿌리지 않고, 접속 중인 플레이어마다 자기 것만 보이는 스냅샷을 따로 보냅니다.
  const roster=room=>{
    for(const p of room.players.values()){
      if(!p.connected) continue;
      const sock=io.sockets.sockets.get(p.socketId);
      if(sock) sock.emit('room:state',store.snapshot(room,p));
    }
  };
  const announce=(room,text)=>{
    const msg=store.pushChat(room,{playerId:null,nickname:'안내',role:'system',text,flagged:false});
    io.to(room.code).emit('chat:message',msg);
  };
  // 한 사람에게만 가는 개인 안내(선생님의 별 파편 지급, 비밀 아이템 사용, 거래 알림 등). 방 채팅 기록에는 남지 않고
  // 그 사람의 notes에 최근 것만 보관해 재접속 시 enter()에서 방 기록과 합쳐 돌려줍니다.
  const whisper=(room,player,text)=>{
    const msg={id:randomUUID(),playerId:null,nickname:'안내',role:'system',text,at:Date.now(),flagged:false,private:true};
    player.notes.push(msg);
    if(player.notes.length>ITEM_USE.notesSize) player.notes.shift();
    const sock=player.connected?io.sockets.sockets.get(player.socketId):null;
    if(sock) sock.emit('chat:message',msg);
    return msg;
  };
  // 행성 이름 바꾸기 투표를 현재 소속 인원 기준으로 다시 계산합니다. 필요 표가 모이면 반영/부결하고 투표를 닫습니다.
  const evaluateRename=(room,planet)=>{
    const rename=planet.rename;if(!rename)return;
    const members=[...room.players.values()].filter(p=>p.avatar.departmentId===planet.id);
    const n=members.length;
    if(n===0){planet.rename=null;return;}
    const memberIds=new Set(members.map(m=>m.id));
    for(const id of [...rename.votes.keys()]) if(!memberIds.has(id)) rename.votes.delete(id);
    let yes=0,no=0;
    for(const agree of rename.votes.values()) agree?yes++:no++;
    const needed=Math.floor(n/2)+1;
    if(yes>=needed){
      const oldName=planet.name;
      planet.name=rename.name;planet.rename=null;
      announce(room,'"'+oldName+'" 행성의 이름이 "'+rename.name+'"'+ro(rename.name)+' 바뀌었어요!');
    }else if(no>=needed || yes+(n-yes-no)<needed){
      const newName=rename.name;
      planet.rename=null;
      announce(room,'"'+newName+'" 이름 바꾸기가 부결되었어요.');
    }
  };
  // 방을 나간 플레이어가 어떤 행성 소속이었다면 그 행성의 이름 바꾸기 투표를 다시 계산합니다.
  const afterMemberRemoved=(room,playerId,planetId)=>{
    if(!planetId)return;
    const planet=room.planets.get(planetId);
    if(!planet)return;
    planet.rename?.votes.delete(playerId);
    evaluateRename(room,planet);
  };
  // 거래 당사자가 방을 완전히 나가면(퇴장·만료) 진행 중이던 거래를 지우고 상대에게 알립니다.
  const cancelTradesFor=(room,playerId,nickname)=>{
    for(const trade of [...room.trades.values()]){
      if(trade.fromId!==playerId && trade.toId!==playerId) continue;
      room.trades.delete(trade.id);
      const otherId=trade.fromId===playerId?trade.toId:trade.fromId;
      const other=room.players.get(otherId);
      if(other) whisper(room,other,(nickname||'친구')+' 친구가 교실을 나가서 거래가 취소되었어요.');
    }
  };
  const roomClosed=room=>{
    for(const p of room.players.values()){
      const s=io.sockets.sockets.get(p.socketId);
      if(s){ s.emit('room:closed',{message:'교실이 종료되었어요. 새 교실 코드로 입장해주세요.'});s.leave(room.code);s.data.session=null; }
    }
    store.destroy(room);
  };
  const detach=(socket,immediate)=>{
    const s=socket.data.session;if(!s)return;
    socket.leave(s.room.code);socket.data.session=null;
    if(immediate){
      if(s.player.role==='teacher') roomClosed(s.room);
      else {
        const planetId=s.player.avatar.departmentId;
        store.remove(s.room,s.player);
        cancelTradesFor(s.room,s.player.id,s.player.nickname);
        afterMemberRemoved(s.room,s.player.id,planetId);
        roster(s.room);
      }
    }else {
      Object.assign(s.player,{connected:false,expiresAt:Date.now()+reconnectMs,input:{x:0,y:0,at:0}});
      roster(s.room);
    }
  };
  io.on('connection',socket=>{
    if(io.engine.clientsCount>400){socket.disconnect(true);return;}
    let rate={at:Date.now(),count:0};
    socket.use((_packet,next)=>{
      const now=Date.now();if(now-rate.at>1000)rate={at:now,count:0};
      if(++rate.count>80){socket.disconnect(true);return;}
      next();
    });
    const action=(name,handler)=>socket.on(name,(data,ack)=>{
      if(typeof ack!=='function')return;
      try {
        ensure(data && typeof data==='object' && !Array.isArray(data),'입력 내용을 확인해주세요.');
        ack({ok:true,...handler(data)});
      }catch(error){
        if(!(error instanceof GameError)) console.error('Action failed:',name,error.message);
        ack({ok:false,error:error instanceof GameError?error.message:'처리하지 못했어요. 다시 시도해주세요.'});
      }
    });
    const enter=session=>{
      socket.data.session=session;joinChannel(session);roster(session.room);
      const {room,player}=session;
      // 방 공개 기록과 이 사람에게만 왔던 개인 안내(notes)를 시간순으로 합쳐 돌려줍니다.
      const messages=[...room.chat.history,...player.notes].sort((a,b)=>a.at-b.at);
      return {token:player.token,selfId:player.id,room:store.snapshot(room,player),chat:{messages}};
    };
    const notJoined=()=>ensure(!socket.data.session,'먼저 현재 교실에서 나가주세요.');
    action('room:create',data=>{
      notJoined();
      const ip=socket.handshake.address,now=Date.now();
      let bucket=authAttempts.get(ip);
      if(!bucket || now-bucket.at>60_000){bucket={at:now,count:0};authAttempts.set(ip,bucket);}
      ensure(bucket.count<10,'교사 확인을 여러 번 시도했어요. 1분 후 다시 시도해주세요.');
      if(!equalSecret(data.teacherKey,teacherKey)){bucket.count++;throw new GameError('교사용 시작 링크 또는 교사 확인 키를 확인해주세요.');}
      return enter(store.create(data,socket.id));
    });
    action('room:join',data=>{notJoined();return enter(store.join(data,socket.id));});
    action('session:resume',data=>{notJoined();return enter(store.resume(data.token,socket.id));});
    action('room:leave',()=>{detach(socket,true);return {};});
    // 아직 교사 관리 패널은 없지만 종료 권한부터 서버에서 검사합니다.
    action('room:close',()=>{
      const s=socket.data.session;ensure(s?.player.role==='teacher','선생님만 교실을 종료할 수 있어요.');
      roomClosed(s.room);return {};
    });
    action('chat:send',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      const raw=data.text;
      // 보이지 않는 서식 문자(폭 없는 공백, 글자 방향 바꾸기 등)는 지운 뒤 길이를 검사합니다.
      const trimmed=typeof raw==='string'?raw.normalize('NFKC').replace(/\p{Cf}/gu,'').trim():'';
      const hasControl=[...trimmed].some(ch=>{const c=ch.codePointAt(0);return c<32||c===127;});
      ensure(typeof raw==='string' && trimmed.length>=1 && trimmed.length<=CHAT.maxLength && !hasControl,'채팅은 1~120자로 입력해주세요.');
      const text=trimmed.replace(/ {2,}/g,' ');
      if(p.role==='student'){
        ensure([...room.players.values()].some(t=>t.role==='teacher'&&t.connected),'선생님이 다시 연결할 때까지 기다려주세요.');
        ensure(room.chat.enabled,'선생님이 채팅을 껐어요.');
      }
      ensure(!p.muted,'선생님이 내 채팅을 잠시 멈췄어요.');
      const now=Date.now();
      ensure(now-p.lastChatAt>=CHAT.cooldownMs,'조금 천천히 말해요.');
      const {text:filtered,flagged}=filterChat(text);
      const msg=store.pushChat(room,{playerId:p.id,nickname:p.nickname,role:p.role,text:filtered,flagged});
      io.to(room.code).emit('chat:message',msg);
      p.lastChatAt=now;
      return {};
    });
    action('chat:setEnabled',data=>{
      const s=socket.data.session;ensure(s?.player.role==='teacher','선생님만 할 수 있어요.');
      ensure(typeof data.enabled==='boolean','입력 내용을 확인해주세요.');
      const {room}=s;
      if(room.chat.enabled===data.enabled)return {};
      room.chat.enabled=data.enabled;
      roster(room);
      announce(room,data.enabled?'선생님이 채팅을 켰어요.':'선생님이 채팅을 껐어요.');
      return {};
    });
    action('chat:mute',data=>{
      const s=socket.data.session;ensure(s?.player.role==='teacher','선생님만 할 수 있어요.');
      ensure(typeof data.playerId==='string' && typeof data.muted==='boolean','입력 내용을 확인해주세요.');
      const {room}=s;
      const target=room.players.get(data.playerId);
      ensure(target && target.role==='student','친구를 찾지 못했어요.');
      if(target.muted===data.muted)return {};
      target.muted=data.muted;
      roster(room);
      announce(room,target.nickname+(data.muted?' 친구의 채팅이 잠시 멈췄어요.':' 친구가 다시 채팅할 수 있어요.'));
      return {};
    });
    action('chat:clear',()=>{
      const s=socket.data.session;ensure(s?.player.role==='teacher','선생님만 할 수 있어요.');
      const {room}=s;
      room.chat.history=[];
      io.to(room.code).emit('chat:cleared',{});
      announce(room,'선생님이 채팅 기록을 지웠어요.');
      return {};
    });
    action('planet:propose',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      ensure(p.role==='student','선생님은 행성 만들기로 바로 만들 수 있어요.');
      ensure(p.mapId===PLAZA_ID,'광장에서만 새 행성을 만들 수 있어요. 먼저 우주 광장으로 돌아와주세요.');
      ensure(room.planets.size+room.proposals.size<PLANET.maxPerRoom,'행성이 너무 많아요. (최대 '+PLANET.maxPerRoom+'개)');
      ensure(room.proposals.size<PLANET.maxPending,'승인을 기다리는 행성이 너무 많아요. 잠시 후 다시 신청해주세요.');
      ensure(![...room.proposals.values()].some(pr=>pr.playerId===p.id),'이미 승인을 기다리는 행성이 있어요.');
      const input=planetInput(room,data);
      const proposal={id:randomUUID(),...input,radius:PLANET.radius,playerId:p.id,nickname:p.nickname,at:Date.now()};
      room.proposals.set(proposal.id,proposal);
      roster(room);
      announce(room,p.nickname+' 친구가 새 행성 "'+input.name+'"을 신청했어요. 선생님의 승인을 기다려요.');
      return {proposalId:proposal.id};
    });
    action('planet:create',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      ensure(p.role==='teacher','선생님만 할 수 있어요.');
      ensure(p.mapId===PLAZA_ID,'광장에서만 새 행성을 만들 수 있어요. 먼저 우주 광장으로 돌아와주세요.');
      ensure(room.planets.size+room.proposals.size<PLANET.maxPerRoom,'행성이 너무 많아요. (최대 '+PLANET.maxPerRoom+'개)');
      const input=planetInput(room,data);
      const planet=addPlanet(room,{...input,rules:[...PLANET.defaultRules],createdBy:p.id});
      roster(room);
      announce(room,'선생님이 새 행성 "'+planet.name+'"을 만들었어요.');
      return {planetId:planet.id};
    });
    action('planet:approve',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      ensure(p.role==='teacher','선생님만 할 수 있어요.');
      const proposal=requireProposal(room,data);
      room.proposals.delete(proposal.id);
      if(!placementFree(room,proposal.x,proposal.y)){
        announce(room,'"'+proposal.name+'" 행성은 자리가 겹쳐서 만들 수 없었어요.');
        throw new GameError('그 자리에 이미 다른 행성이 생겼어요.');
      }
      const planet=addPlanet(room,{name:proposal.name,description:proposal.description,x:proposal.x,y:proposal.y,
        color:proposal.color,rules:[...PLANET.defaultRules],createdBy:proposal.playerId,templateId:proposal.templateId});
      const student=room.players.get(proposal.playerId);
      if(student){
        const previousId=student.avatar.departmentId;
        if(student.mapId!==PLAZA_ID){
          const previousPlanet=room.planets.get(previousId);
          Object.assign(student,exitPosition(room,previousPlanet||planet),{mapId:PLAZA_ID,input:{x:0,y:0,at:0}});
        }
        student.avatar.departmentId=planet.id;
        if(previousId){
          const previous=room.planets.get(previousId);
          if(previous){ previous.rename?.votes.delete(student.id); evaluateRename(room,previous); }
        }
      }
      roster(room);
      announce(room, student
        ? '선생님이 "'+planet.name+'" 행성을 승인했어요! '+student.nickname+' 친구가 첫 멤버가 되었어요.'
        : '선생님이 "'+planet.name+'" 행성을 승인했어요!');
      return {planetId:planet.id};
    });
    action('planet:reject',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      ensure(p.role==='teacher','선생님만 할 수 있어요.');
      const proposal=requireProposal(room,data);
      room.proposals.delete(proposal.id);
      roster(room);
      announce(room,'선생님이 "'+proposal.name+'" 행성 신청을 돌려보냈어요.');
      return {};
    });
    action('planet:withdraw',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      const proposal=requireProposal(room,data);
      ensure(proposal.playerId===p.id,'내 신청만 취소할 수 있어요.');
      room.proposals.delete(proposal.id);
      roster(room);
      announce(room,p.nickname+' 친구가 "'+proposal.name+'" 행성 신청을 취소했어요.');
      return {};
    });
    action('planet:remove',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      ensure(p.role==='teacher','선생님만 할 수 있어요.');
      const planet=requirePlanet(room,data);
      room.planets.delete(planet.id);
      const mapId=interiorIdOf(planet.id);
      for(const player of room.players.values()){
        if(player.mapId===mapId) Object.assign(player,exitPosition(room,planet),{mapId:PLAZA_ID,input:{x:0,y:0,at:0}});
        if(player.avatar.departmentId===planet.id) player.avatar.departmentId=null;
      }
      roster(room);
      announce(room,'선생님이 "'+planet.name+'" 행성을 없앴어요.');
      return {};
    });
    action('planet:join',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      const planet=requirePlanet(room,data);
      ensure(p.role==='student','선생님은 모든 행성에 들어갈 수 있어요.');
      ensure(p.mapId===PLAZA_ID,'광장에서만 행성에 가입할 수 있어요.');
      const previousId=p.avatar.departmentId;
      ensure(previousId!==planet.id,'이미 '+planet.name+' 소속이에요.');
      const previous=previousId?room.planets.get(previousId):null;
      p.avatar.departmentId=planet.id;
      if(previous){ previous.rename?.votes.delete(p.id); evaluateRename(room,previous); }
      roster(room);
      announce(room, previous
        ? p.nickname+' 친구가 '+previous.name+'에서 '+planet.name+ro(planet.name)+' 옮겼어요.'
        : p.nickname+' 친구가 '+planet.name+'에 가입했어요.');
      return {};
    });
    action('planet:leave',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      const planet=requirePlanet(room,data);
      ensure(p.avatar.departmentId===planet.id,planet.name+' 소속이 아니에요.');
      if(p.mapId===interiorIdOf(planet.id)) Object.assign(p,exitPosition(room,planet),{mapId:PLAZA_ID,input:{x:0,y:0,at:0}});
      p.avatar.departmentId=null;
      planet.rename?.votes.delete(p.id); evaluateRename(room,planet);
      roster(room);
      announce(room,p.nickname+' 친구가 '+planet.name+'에서 탈퇴했어요.');
      return {};
    });
    action('planet:enter',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      const planet=requirePlanet(room,data);
      ensure(p.mapId===PLAZA_ID,'먼저 광장으로 나와주세요.');
      ensure(p.role==='teacher' || p.avatar.departmentId===planet.id,planet.name+' 소속 친구만 들어갈 수 있어요.');
      ensure(isNear(p,planet),'행성에 더 가까이 가주세요.');
      const mapId=interiorIdOf(planet.id);
      Object.assign(p,spawnInside(room,mapId),{mapId,input:{x:0,y:0,at:0}});
      roster(room);
      return {};
    });
    action('planet:exit',()=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      const planetId=planetIdOfMap(p.mapId);
      ensure(planetId,'지금은 행성 안이 아니에요.');
      const planet=room.planets.get(planetId);
      ensure(planet,'행성을 찾지 못했어요.');
      Object.assign(p,exitPosition(room,planet),{mapId:PLAZA_ID,input:{x:0,y:0,at:0}});
      roster(room);
      return {};
    });
    action('planet:rules:set',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      ensure(p.role==='teacher','선생님만 할 수 있어요.');
      const planet=requirePlanet(room,data);
      ensure(Array.isArray(data.rules) && data.rules.length>=1 && data.rules.length<=DEPARTMENT_RULES.maxLines,
        '규칙은 1~8줄, 한 줄 40자 이내로 적어주세요.');
      const rules=data.rules.map(line=>typeof line==='string'?line.normalize('NFKC').replace(/\p{Cf}/gu,'').trim():'');
      const invalid=rules.some(line=>{
        const hasControl=[...line].some(ch=>{const c=ch.codePointAt(0);return c<32||c===127;});
        return line.length<1 || line.length>DEPARTMENT_RULES.maxLineLength || hasControl;
      });
      ensure(!invalid,'규칙은 1~8줄, 한 줄 40자 이내로 적어주세요.');
      planet.rules=rules;
      roster(room);
      announce(room,'선생님이 '+planet.name+'의 규칙을 바꿨어요.');
      return {};
    });
    action('planet:rename:propose',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      const planet=requirePlanet(room,data);
      ensure(p.avatar.departmentId===planet.id,planet.name+' 소속 친구만 제안할 수 있어요.');
      const name=validatePlanetName(data.name);
      ensure(name!==planet.name,'지금 이름과 같아요.');
      ensure(!planet.rename,'이미 이름 바꾸기 투표가 진행 중이에요.');
      planet.rename={id:randomUUID(),name,proposedBy:p.id,votes:new Map([[p.id,true]]),at:Date.now()};
      announce(room,'"'+planet.name+'" 행성 친구들이 이름을 "'+name+'"'+ro(name)+' 바꿀지 투표를 시작했어요.');
      evaluateRename(room,planet);
      roster(room);
      return {};
    });
    action('planet:rename:vote',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      const planet=requirePlanet(room,data);
      ensure(p.avatar.departmentId===planet.id,planet.name+' 소속 친구만 투표할 수 있어요.');
      ensure(typeof data.agree==='boolean','입력 내용을 확인해주세요.');
      ensure(planet.rename,'진행 중인 투표가 없어요.');
      planet.rename.votes.set(p.id,data.agree);
      evaluateRename(room,planet);
      roster(room);
      return {};
    });
    action('planet:rename:set',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      ensure(p.role==='teacher','선생님만 할 수 있어요.');
      const planet=requirePlanet(room,data);
      const name=validatePlanetName(data.name);
      ensure(name!==planet.name,'지금 이름과 같아요.');
      const oldName=planet.name;
      planet.name=name;planet.rename=null;
      roster(room);
      announce(room,'선생님이 "'+oldName+'" 행성의 이름을 "'+name+'"'+ro(name)+' 바꿨어요.');
      return {};
    });
    action('map:travel',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      ensure(typeof data.to==='string' && Object.prototype.hasOwnProperty.call(STATIC_MAPS,data.to),'그런 곳은 없어요.');
      const here=mapOf(p.mapId,room.planets.values());
      const gate=here.objects.find(o=>o.kind==='gate' && o.target===data.to);
      ensure(gate,'여기서는 그곳으로 갈 수 없어요.');
      ensure(isNear(p,gate),'문에 더 가까이 가주세요.');
      Object.assign(p,arrivePosition(room,data.to,gate.arrival),{mapId:data.to,input:{x:0,y:0,at:0}});
      roster(room);
      return {};
    });
    action('shards:give',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      ensure(p.role==='teacher','선생님만 할 수 있어요.');
      const amount=data.amount;
      ensure(Number.isInteger(amount) && amount!==0 && Math.abs(amount)<=SHARDS.giveMax,'별 파편 개수는 1~999 사이 정수로 적어주세요.');
      const apply=target=>{target.starShards=Math.max(0,Math.min(SHARDS.max,target.starShards+amount));};
      // 별 파편은 아이들끼리 비밀이라 공개 채팅 대신 받는 학생에게만 개인 안내를 보냅니다. 선생님은 ack로만 확인합니다.
      const text=amount>0?'선생님이 나에게 별 파편 '+amount+'개를 주었어요.':'선생님이 내 별 파편 '+(-amount)+'개를 거두었어요.';
      if(data.playerId==='all'){
        for(const t of room.players.values()) if(t.role==='student'){ apply(t); whisper(room,t,text); }
        roster(room);
      }else{
        const target=room.players.get(data.playerId);
        ensure(target && target.role==='student','친구를 찾지 못했어요.');
        apply(target);
        whisper(room,target,text);
        roster(room);
      }
      return {};
    });
    const requireShop=p=>{
      ensure(p.mapId===STREET_ID,'별상점은 별빛 거리에 있어요.');
      const shop=STREET.objects.find(o=>o.kind==='shop');
      ensure(isNear(p,shop),'별상점에 더 가까이 가주세요.');
    };
    action('shop:buy',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      requireShop(p);
      const item=itemOf(data.itemId);
      ensure(item,'그런 물건은 없어요.');
      const quantity=data.quantity;
      ensure(Number.isInteger(quantity) && quantity>=1 && quantity<=10,'1~10개씩 사고팔 수 있어요.');
      const cost=item.price*quantity;
      ensure(p.starShards>=cost,'별 파편이 부족해요. (필요 '+cost+'개, 지금 '+p.starShards+'개)');
      const existing=p.inventory.find(i=>i.id===item.id);
      if(existing){
        ensure(existing.quantity+quantity<=SHOP.maxStack,'한 종류는 99개까지만 가질 수 있어요.');
        existing.quantity+=quantity;
      }else{
        ensure(p.inventory.length<SHOP.maxKinds,'가방이 가득 찼어요.');
        p.inventory.push({id:item.id,quantity});
      }
      p.starShards-=cost;
      roster(room);
      return {starShards:p.starShards,inventory:[...p.inventory]};
    });
    action('shop:sell',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      requireShop(p);
      const item=itemOf(data.itemId);
      ensure(item,'그런 물건은 없어요.');
      const quantity=data.quantity;
      ensure(Number.isInteger(quantity) && quantity>=1 && quantity<=10,'1~10개씩 사고팔 수 있어요.');
      const existing=p.inventory.find(i=>i.id===item.id);
      ensure(existing && existing.quantity>=quantity,'그만큼 가지고 있지 않아요.');
      const gain=Math.floor(item.price*SHOP.sellRate)*quantity;
      // 상한을 넘기면 아이템만 사라지는 일이 없도록, 담을 수 있을 때만 팝니다.
      ensure(p.starShards+gain<=SHARDS.max,'별 파편을 더 담을 수 없어요. (최대 '+SHARDS.max+'개)');
      p.starShards+=gain;
      existing.quantity-=quantity;
      if(existing.quantity===0) p.inventory=p.inventory.filter(i=>i.id!==item.id);
      roster(room);
      return {starShards:p.starShards,inventory:[...p.inventory]};
    });
    // 선생님은 취급상 LV5(모든 아이템을 쓰고, 누구에게나 쓸 수 있음). 학생은 아바타 레벨을 그대로 씁니다.
    const levelOf=player=>player.role==='teacher'?ITEM_USE.teacherLevel:player.avatar.level;
    action('item:use',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      const item=itemOf(data.itemId);
      ensure(item,'그런 물건은 없어요.');
      const owned=p.inventory.find(i=>i.id===item.id);
      ensure(owned,'가방에 그 물건이 없어요.');
      ensure(levelOf(p)>=item.level,'LV '+item.level+'부터 쓸 수 있어요.');
      ensure(typeof data.targetId==='string','그 친구는 지금 없어요.');
      const target=room.players.get(data.targetId);
      ensure(target && target.connected,'그 친구는 지금 없어요.');
      ensure(item.targets!=='self' || target.id===p.id,'이 물건은 나에게만 쓸 수 있어요.');
      ensure(levelOf(p)>=levelOf(target),'나보다 레벨이 높은 친구에게는 쓸 수 없어요.');
      const now=Date.now();
      ensure(now-p.lastItemUseAt>=ITEM_USE.cooldownMs,'조금 천천히 써요.');
      // 소비: 수량 1 소모, 0이 되면 가방에서 완전히 지웁니다.
      owned.quantity-=1;
      if(owned.quantity<=0) p.inventory=p.inventory.filter(i=>i.id!==item.id);
      p.lastItemUseAt=now;
      // 효과 적용: 같은 아이템이 이미 붙어 있으면 시간과 사용자만 갱신하고, 새로 붙는 경우 한도(maxEffects)를 넘으면
      // 가장 먼저 끝나는 효과(가장 작은 until)부터 지웁니다.
      const until=now+item.effect.durationMs;
      const existingEffect=target.effects.find(e=>e.itemId===item.id);
      if(existingEffect){
        existingEffect.until=until;existingEffect.fromId=p.id;existingEffect.fromNickname=p.nickname;
      }else{
        target.effects.push({itemId:item.id,icon:item.effect.icon,label:item.effect.label,style:item.effect.style,
          until,fromId:p.id,fromNickname:p.nickname,secret:item.secret});
        if(target.effects.length>ITEM_USE.maxEffects){
          let oldest=0;
          for(let i=1;i<target.effects.length;i++) if(target.effects[i].until<target.effects[oldest].until) oldest=i;
          target.effects.splice(oldest,1);
        }
      }
      room.itemLog.push({id:randomUUID(),at:now,userId:p.id,userNickname:p.nickname,targetId:target.id,
        targetNickname:target.nickname,itemId:item.id,itemName:item.name,secret:item.secret});
      if(room.itemLog.length>ITEM_USE.logSize) room.itemLog.shift();
      const selfTarget=target.id===p.id;
      const actorPhrase=p.role==='teacher'?'선생님이':p.nickname+' 친구가';
      if(item.secret){
        announce(room, selfTarget
          ? target.nickname+' 친구에게 '+item.name+iga(item.name)+' 조용히 생겼어요.'
          : '누군가 '+target.nickname+' 친구에게 '+item.name+eul(item.name)+' 썼어요.');
        const teacher=[...room.players.values()].find(t=>t.role==='teacher'&&t.connected);
        if(teacher) whisper(room,teacher,'(선생님만) '+actorPhrase+' '+target.nickname+' 친구에게 '+item.name+eul(item.name)+' 썼어요.');
      }else{
        announce(room, selfTarget
          ? actorPhrase+' '+item.name+eul(item.name)+' 썼어요.'
          : actorPhrase+' '+target.nickname+' 친구에게 '+item.name+eul(item.name)+' 썼어요.');
      }
      roster(room);
      return {inventory:[...p.inventory],effects:effectsView(target.effects,p.role==='teacher')};
    });
    // 거래 한쪽(주는 것/받고 싶은 것) 검증: 파편 수·아이템 종류·수량이 규칙 안이고, 아이템은 실제로 존재하며 중복이 없어야 합니다.
    const tradeSide=x=>{
      ensure(x && typeof x==='object' && !Array.isArray(x),'거래 내용을 확인해주세요.');
      ensure(Number.isInteger(x.shards) && x.shards>=0 && x.shards<=TRADE.maxShards,'거래 내용을 확인해주세요.');
      ensure(Array.isArray(x.items) && x.items.length<=TRADE.maxItemKinds,'거래 내용을 확인해주세요.');
      const seen=new Set(),items=x.items.map(it=>{
        ensure(it && typeof it==='object','거래 내용을 확인해주세요.');
        ensure(itemOf(it.id),'거래 내용을 확인해주세요.');
        ensure(Number.isInteger(it.quantity) && it.quantity>=1 && it.quantity<=99,'거래 내용을 확인해주세요.');
        ensure(!seen.has(it.id),'거래 내용을 확인해주세요.');
        seen.add(it.id);
        return {id:it.id,quantity:it.quantity};
      });
      return {shards:x.shards,items};
    };
    const sideEmpty=side=>side.shards===0 && side.items.length===0;
    const hasAssets=(player,side)=>{
      if(player.starShards<side.shards) return false;
      return side.items.every(it=>{
        const owned=player.inventory.find(i=>i.id===it.id);
        return owned && owned.quantity>=it.quantity;
      });
    };
    const busyWithTrade=(room,playerId)=>[...room.trades.values()].some(t=>t.fromId===playerId||t.toId===playerId);
    action('trade:propose',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      ensure(p.role==='student','선생님은 거래하지 않아요.');
      const target=room.players.get(data.targetId);
      ensure(target && target.role==='student' && target.id!==p.id,'친구를 찾지 못했어요.');
      ensure(target.connected,'그 친구는 지금 없어요.');
      const give=tradeSide(data.give),want=tradeSide(data.want);
      ensure(!(sideEmpty(give) && sideEmpty(want)),'주거나 받을 것을 하나는 적어주세요.');
      ensure(!busyWithTrade(room,p.id) && !busyWithTrade(room,target.id),'진행 중인 거래가 있어요. 먼저 끝내주세요.');
      ensure(room.trades.size<TRADE.maxPending,'기다리는 거래가 너무 많아요.');
      ensure(hasAssets(p,give),'주려는 것을 충분히 가지고 있지 않아요.');
      const trade={id:randomUUID(),fromId:p.id,fromNickname:p.nickname,toId:target.id,toNickname:target.nickname,
        give,want,status:'proposed',at:Date.now()};
      room.trades.set(trade.id,trade);
      roster(room);
      whisper(room,target,p.nickname+' 친구가 거래를 제안했어요. 가방에서 확인해보세요.');
      return {tradeId:trade.id};
    });
    action('trade:respond',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      const trade=room.trades.get(data.tradeId);
      ensure(trade && trade.toId===p.id && trade.status==='proposed','내가 받은 제안이 아니에요.');
      ensure(typeof data.accept==='boolean','입력 내용을 확인해주세요.');
      const proposer=room.players.get(trade.fromId);
      if(!data.accept){
        room.trades.delete(trade.id);
        roster(room);
        if(proposer) whisper(room,proposer,trade.toNickname+' 친구가 거래를 거절했어요.');
        return {};
      }
      ensure(hasAssets(p,trade.want),'받고 싶다는 것을 내가 충분히 가지고 있지 않아요.');
      trade.status='accepted';
      roster(room);
      if(proposer) whisper(room,proposer,trade.toNickname+' 친구가 수락했어요. 선생님 승인을 기다려요.');
      const teacher=[...room.players.values()].find(t=>t.role==='teacher'&&t.connected);
      if(teacher) whisper(room,teacher,'거래 승인 요청: '+trade.fromNickname+' ↔ '+trade.toNickname+'. 선생님 도구에서 확인해주세요.');
      return {};
    });
    action('trade:cancel',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      const trade=room.trades.get(data.tradeId);
      ensure(trade && (trade.fromId===p.id || trade.toId===p.id),'내 거래가 아니에요.');
      room.trades.delete(trade.id);
      const otherId=trade.fromId===p.id?trade.toId:trade.fromId;
      const other=room.players.get(otherId);
      if(other) whisper(room,other,p.nickname+' 친구가 거래를 취소했어요.');
      roster(room);
      return {};
    });
    const pushTradeLog=(room,trade,result)=>{
      room.tradeLog.push({id:randomUUID(),at:Date.now(),fromNickname:trade.fromNickname,toNickname:trade.toNickname,
        give:trade.give,want:trade.want,result});
      if(room.tradeLog.length>100) room.tradeLog.shift();
    };
    action('trade:approve',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      ensure(p.role==='teacher','선생님만 할 수 있어요.');
      const trade=room.trades.get(data.tradeId);
      ensure(trade,'거래를 찾지 못했어요.');
      ensure(trade.status==='accepted','아직 친구가 수락하지 않았어요.');
      const from=room.players.get(trade.fromId),to=room.players.get(trade.toId);
      const reject=message=>{
        room.trades.delete(trade.id);
        if(from) whisper(room,from,message);
        if(to) whisper(room,to,message);
        pushTradeLog(room,trade,'rejected');
        roster(room);
        throw new GameError(message);
      };
      if(!from || !to || !hasAssets(from,trade.give) || !hasAssets(to,trade.want))
        reject('가진 것이 바뀌어서 거래할 수 없어요.');
      if(from.starShards-trade.give.shards+trade.want.shards>SHARDS.max
        || to.starShards-trade.want.shards+trade.give.shards>SHARDS.max)
        reject('별 파편이 넘쳐서 거래할 수 없어요.');
      // 가방 한도(종류 30·스택 99)를 넘기지 않는지 미리 계산으로 확인한 뒤에만 실제로 옮깁니다.
      const wouldOverflow=(player,giveItems,wantItems)=>{
        const bag=new Map(player.inventory.map(i=>[i.id,i.quantity]));
        for(const it of giveItems){
          const left=(bag.get(it.id)||0)-it.quantity;
          if(left<=0) bag.delete(it.id); else bag.set(it.id,left);
        }
        for(const it of wantItems){
          const next=(bag.get(it.id)||0)+it.quantity;
          if(next>SHOP.maxStack) return true;
          bag.set(it.id,next);
        }
        return bag.size>SHOP.maxKinds;
      };
      if(wouldOverflow(from,trade.give.items,trade.want.items) || wouldOverflow(to,trade.want.items,trade.give.items))
        reject('가방이 가득 차서 거래할 수 없어요.');
      const invAdd=(player,itemId,quantity)=>{
        const owned=player.inventory.find(i=>i.id===itemId);
        if(owned) owned.quantity+=quantity; else player.inventory.push({id:itemId,quantity});
      };
      const invRemove=(player,itemId,quantity)=>{
        const owned=player.inventory.find(i=>i.id===itemId);
        owned.quantity-=quantity;
        if(owned.quantity<=0) player.inventory=player.inventory.filter(i=>i.id!==itemId);
      };
      from.starShards+=trade.want.shards-trade.give.shards;
      to.starShards+=trade.give.shards-trade.want.shards;
      for(const it of trade.give.items){ invRemove(from,it.id,it.quantity); invAdd(to,it.id,it.quantity); }
      for(const it of trade.want.items){ invRemove(to,it.id,it.quantity); invAdd(from,it.id,it.quantity); }
      room.trades.delete(trade.id);
      pushTradeLog(room,trade,'approved');
      roster(room);
      whisper(room,from,'선생님이 거래를 승인했어요. 가방을 확인해보세요.');
      whisper(room,to,'선생님이 거래를 승인했어요. 가방을 확인해보세요.');
      return {};
    });
    action('trade:reject',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      ensure(p.role==='teacher','선생님만 할 수 있어요.');
      const trade=room.trades.get(data.tradeId);
      ensure(trade,'거래를 찾지 못했어요.');
      room.trades.delete(trade.id);
      const from=room.players.get(trade.fromId),to=room.players.get(trade.toId);
      if(from) whisper(room,from,'선생님이 거래를 돌려보냈어요.');
      if(to) whisper(room,to,'선생님이 거래를 돌려보냈어요.');
      pushTradeLog(room,trade,'rejected');
      roster(room);
      return {};
    });
    socket.on('player:input',data=>{
      const p=socket.data.session?.player;
      if(!p || !data || typeof data!=='object')return;
      if(!Number.isFinite(data.x)||!Number.isFinite(data.y)||Math.abs(data.x)>1||Math.abs(data.y)>1)return;
      p.input={x:data.x,y:data.y,at:Date.now()};
    });
    socket.on('disconnect',()=>detach(socket,false));
  });
  let step=0; const previous=new Map();
  const timer=setInterval(()=>{
    const now=Date.now();
    for(const room of store.rooms.values()){
      let changed=false;
      for(const p of room.players.values()){
        if(!p.connected && p.expiresAt<=now){
          if(p.role==='teacher'){roomClosed(room);break;}
          const planetId=p.avatar.departmentId;
          store.remove(room,p);changed=true;
          cancelTradesFor(room,p.id,p.nickname);
          afterMemberRemoved(room,p.id,planetId);
        }
      }
      if(!store.rooms.has(room.code)){previous.delete(room.code);continue;}
      if(changed)roster(room);
      advance(room,now);
      // 1초에 한 번(50ms tick 20회) 만료된 아이템 효과를 지웁니다. 하나라도 지웠으면 스냅샷을 다시 보냅니다.
      if(step%20===0){
        let effectsChanged=false;
        for(const p of room.players.values()){
          if(!p.effects.length) continue;
          const kept=p.effects.filter(e=>e.until>now);
          if(kept.length!==p.effects.length){ p.effects=kept; effectsChanged=true; }
        }
        if(effectsChanged) roster(room);
      }
      if(step%2===0){
        const before=previous.get(room.code)||new Map(),next=new Map(),positions=[];
        for(const p of room.players.values()){
          const point=[p.id,Math.round(p.x*10)/10,Math.round(p.y*10)/10];
          next.set(p.id,point);
          const old=before.get(p.id);
          if(step%40===0 || !old || old[1]!==point[1]||old[2]!==point[2]) positions.push(point);
        }
        if(positions.length)io.to(room.code).volatile.emit('world:positions',{positions});
        previous.set(room.code,next);
      }
    }
    for(const code of previous.keys())if(!store.rooms.has(code))previous.delete(code);
    for(const [ip,b] of authAttempts)if(now-b.at>60_000)authAttempts.delete(ip);
    step++;
  },RULES.tickMs);
  return {app,http,io,store,
    listen:(port=0,host='127.0.0.1')=>new Promise((resolve,reject)=>{
      http.once('error',reject);http.listen(port,host,()=>{http.off('error',reject);resolve(http.address());});
    }),
    close:()=>new Promise(resolve=>{clearInterval(timer);io.close(()=>resolve());})
  };
}
