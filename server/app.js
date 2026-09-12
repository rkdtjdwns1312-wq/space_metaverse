import express from 'express';
import { createServer } from 'node:http';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RoomStore, ensure, GameError } from './rooms.js';
import { advance, spawnInside, exitPosition, isNear, placementFree, addPlanet } from './world.js';
import { filterChat } from './chat-filter.js';
import { RULES, CHAT, DEPARTMENT_RULES, PLAZA_ID, PLANET, PLANET_COLORS, planetIdOfMap, interiorIdOf } from '../shared/config.js';

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
// 행성 신청·생성 공통 입력 검증: 이름·소개·좌표(빈자리인지)·색을 확인해 정리된 값을 돌려줍니다.
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
  return {name,description,x,y,color:data.color};
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
  const roster=room=>io.to(room.code).emit('room:state',store.snapshot(room));
  const announce=(room,text)=>{
    const msg=store.pushChat(room,{playerId:null,nickname:'안내',role:'system',text,flagged:false});
    io.to(room.code).emit('chat:message',msg);
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
      return {token:session.player.token,selfId:session.player.id,room:store.snapshot(session.room),
        chat:{messages:[...session.room.chat.history]}};
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
        color:proposal.color,rules:[...PLANET.defaultRules],createdBy:proposal.playerId});
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
      ensure(p.mapId===PLAZA_ID,'행성 안에서는 다른 행성에 가입할 수 없어요. 먼저 광장으로 나와주세요.');
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
      ensure(planetId,'지금은 광장에 있어요.');
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
          afterMemberRemoved(room,p.id,planetId);
        }
      }
      if(!store.rooms.has(room.code)){previous.delete(room.code);continue;}
      if(changed)roster(room);
      advance(room,now);
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
