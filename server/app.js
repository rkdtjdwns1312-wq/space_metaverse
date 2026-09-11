import express from 'express';
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RoomStore, ensure, GameError } from './rooms.js';
import { advance } from './world.js';
import { filterChat } from './chat-filter.js';
import { RULES, CHAT } from '../shared/config.js';

const equalSecret=(value,key) => {
  if(typeof value!=='string') return false;
  const a=Buffer.from(value),b=Buffer.from(key);
  return a.length===b.length && timingSafeEqual(a,b);
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
      else {store.remove(s.room,s.player);roster(s.room);}
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
    const announce=(room,text)=>{
      const msg=store.pushChat(room,{playerId:null,nickname:'안내',role:'system',text,flagged:false});
      io.to(room.code).emit('chat:message',msg);
    };
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
          store.remove(room,p);changed=true;
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
