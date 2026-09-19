import express from 'express';
import {attackPowerOf,ATTACK_VISUAL} from '../shared/combat.js';
import {requireMapLevel} from './map-access.js';
import { createServer } from 'node:http';
import { timingSafeEqual, randomUUID, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RoomStore, ensure, GameError, playerEffectsView, nickname } from './rooms.js';
import { PersistentRoomStore, pinHash, checkPin } from './persistent-rooms.js';
import { advance, spawnInside, exitPosition, isNear, placementFree, addPlanet, arrivePosition } from './world.js';
import { filterChat } from './chat-filter.js';
import { checkChatRate } from './chat-rate.js';
import { chatScope, canReadChat, visibleHistory, requestSummon, respondSummon } from './social.js';
import { studentAccessOpen, STUDENT_HOURS_MESSAGE } from './access-hours.js';
import {readDaily,saveNotice,readTimetable,saveTimetable,assignmentById,markAssignmentDone,recentAssignments,weeklyRewards,recordReward,koreaDay,weekStart} from './temple.js';
import {validateWork,saveReport,awardReport,proposeDistribution,confirmDistribution,cancelDistribution,reconcileMembership} from './department-work.js';
import {moveMonsters,monsterViews,strikeMonster} from './monsters.js';
import {isDefeated} from './vitals.js';
import {recoverDefeated} from './battle-recovery.js';
import {starRanking,startStarRun,cancelStarRun,clickStar} from './star-game.js';
import {startDodgeRun,setDodgeInput,cancelDodgeRun,advanceDodgeRuns,completeDodgeRun,dodgeRanking} from './dodge-game.js';
import {currentWeekRecords} from './weekly-ranking.js';
import {evolutionInfo,changeConstellation,evolveConstellation,growthInfo,buyExperience} from './evolution.js';
import {gainExperience} from './progression.js';
import {warningView,issueWarning,clearBlackStar,clearWarningsFromPlanet,clearOneWarningFromPlanet,warningCount,blackStarList} from './warnings.js';
import {activeCardMarkers,hasCardStatus,addCardMarker,nextKoreaMidnight,MAX_CARD_MARKERS} from './item-cards.js';
import {createRabbitDraw,rabbitDrawView} from './rabbit-draw.js';
import {activeItemBlocks,addItemBlock,settleItemBlocks,rollStarDie,freshAbilityState} from './constellation-abilities.js';
import {constellationOf} from '../shared/constellations.js';
import {addTask,completeTask} from './tasks.js';
import {interiorDecorObject,interiorDecorColor} from '../shared/interior-decor.js';
import { RULES, CHAT, DEPARTMENT_RULES, PLAZA_ID, PLANET, PLANET_COLORS, planetIdOfMap, interiorIdOf,
  MAP, STREET, STREET_ID, BLACK_HOLE_ID, WARNING_RULES, STATIC_MAPS, mapOf, SHARDS, SHOP, itemOf, ITEM_USE, TRADE, templateOf } from '../shared/config.js';

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
export function createClassroomServer({teacherKey, publicOrigin='', reconnectMs=RULES.reconnectMs, dataDir=null, studentHours=true, clock=Date.now, unattended=true, teacherManagedAccounts=true, abilityDie=rollStarDie}={}) {
  if(!teacherKey || teacherKey.length<16) throw new Error('TEACHER_KEY must be at least 16 characters.');
  const app=express(), http=createServer(app), store=dataDir?new PersistentRoomStore(dataDir,{unattended,teacherManagedAccounts}):new RoomStore();
  const persistent=!!dataDir;
  const studentOpen=()=>!studentHours||studentAccessOpen(clock());
  // 브라우저의 미리 연결(preconnect)은 HTTP 요청 없이도 남을 수 있습니다.
  // 서버 종료 때 이 연결까지 닫아야 http.close()가 무기한 기다리지 않습니다.
  const connections=new Set();
  http.on('connection',connection=>{connections.add(connection);connection.once('close',()=>connections.delete(connection));});
  const originAllowed=req => !req.headers.origin || req.headers.origin==='http://'+req.headers.host || (!!publicOrigin&&req.headers.origin===publicOrigin);
  const io=new Server(http,{maxHttpBufferSize:32768,allowRequest:(req,done)=>done(null,originAllowed(req))});
  app.disable('x-powered-by');
  app.use((req,res,next)=>{
    res.set({'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store'});
    next();
  });
  app.get('/health',(_req,res)=>res.json({ok:true,service:'space-classroom',version:'0.2.0',persistent,publicOrigin}));
  app.get('/api/public-config',(_req,res)=>res.json({managedAccounts:persistent&&teacherManagedAccounts,studentHours}));
  app.use('/shared',express.static(fileURLToPath(new URL('../shared',import.meta.url))));
  app.use(express.static(fileURLToPath(new URL('../client',import.meta.url))));
  // 교사 키 무작위 대입은 연결을 새로 열어도 제한되도록 주소별로 집계합니다.
  const authAttempts=new Map(),lastAttacks=new WeakMap(),lastSkills=new WeakMap();
  // 저장이 끝날 때까지 알림을 보류합니다. 파일 실패 시 화면에도 변경을 보내지 않습니다.
  let pending=null;
  const deliver=fn=>pending?pending.push(fn):fn();
  const transaction=work=>{
    if(!persistent)return work();
    const connections=[...io.sockets.sockets.values()].map(s=>[s,s.data.session?.player.token]);
    pending=[];
    try {
      const result=store.transact(work),events=pending;pending=null;
      for(const event of events)event();
      return result;
    }catch(error){
      if(error.commitOnError){
        const events=pending;pending=null;for(const event of events)event();throw error;
      }
      pending=null;
      for(const [s,token] of connections)s.data.session=store.sessions.get(token)||null;
      if(!(error instanceof GameError)){
        console.error('교실 저장 실패:',error.message);
        throw new GameError('저장하지 못했어요. 변경을 취소했어요. 선생님은 서버의 저장 공간을 확인해주세요.');
      }
      throw error;
    }
  };
  const joinChannel=s=>deliver(()=>io.sockets.sockets.get(s.player.socketId)?.join(s.room.code));
  // 별 파편·아이템·거래는 아이들끼리 비밀이라 방 전체에 한 번 뿌리지 않고, 접속 중인 플레이어마다 자기 것만 보이는 스냅샷을 따로 보냅니다.
  const roster=room=>{
    // 가입·탈퇴·계정 삭제 뒤에는 과거 부원 명단으로 분배할 수 없습니다.
    for(const planet of room.planets.values()) if(planet.work?.distribution) {
      reconcileMembership(room,planet,clock());
      if(!planet.work.distribution) deliver(()=>io.to(room.code).emit('department:changed',{planetId:planet.id}));
    }
    for(const p of room.players.values()){
      if(!p.connected) continue;
      const sock=io.sockets.sockets.get(p.socketId);
      if(sock) deliver(()=>sock.emit('room:state',store.snapshot(room,p)));
    }
  };
  const announce=(room,text)=>{
    const msg=store.pushChat(room,{playerId:null,nickname:'안내',role:'system',text,flagged:false});
    deliver(()=>io.to(room.code).emit('chat:message',msg));
  };
  // 한 사람에게만 가는 개인 안내(선생님의 별 파편 지급, 비밀 아이템 사용, 거래 알림 등). 방 채팅 기록에는 남지 않고
  // 그 사람의 notes에 최근 것만 보관해 재접속 시 enter()에서 방 기록과 합쳐 돌려줍니다.
  const whisper=(room,player,text)=>{
    const msg={id:randomUUID(),playerId:null,nickname:'안내',role:'system',text,at:Date.now(),flagged:false,private:true};
    player.notes.push(msg);
    if(player.notes.length>ITEM_USE.notesSize) player.notes.shift();
    const sock=player.connected?io.sockets.sockets.get(player.socketId):null;
    if(sock) deliver(()=>sock.emit('chat:message',msg));
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
      if(s){
        s.data.session=null;
        deliver(()=>{s.emit('room:closed',{message:persistent?'수업을 마쳤어요. 다음에도 같은 코드와 비밀번호로 만나요.':'교실이 종료되었어요. 새 교실 코드로 입장해주세요.'});s.leave(room.code);});
      }
    }
    store.destroy(room);
  };
  const detach=(socket,immediate)=>{
    const s=socket.data.session;if(!s)return;
    deliver(()=>socket.leave(s.room.code));socket.data.session=null;
    if(immediate){
      if(s.player.role==='teacher'&&!s.room.unattended) roomClosed(s.room);
      else {
        const planetId=s.player.avatar.departmentId;
        store.remove(s.room,s.player);
        cancelTradesFor(s.room,s.player.id,s.player.nickname);
        if(!persistent)afterMemberRemoved(s.room,s.player.id,planetId);
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
    const action=(name,handler,save=true)=>socket.on(name,(data,ack)=>{
      if(typeof ack!=='function')return;
      try {
        ensure(data && typeof data==='object' && !Array.isArray(data),'입력 내용을 확인해주세요.');
        const execute=save?transaction:work=>work();
        ack({ok:true,...execute(()=>{
          const session=socket.data.session;
          if(session&&['combat:attack','combat:skill','map:travel','evolution:evolve','evolution:change'].includes(name))ensure(!isDefeated(session.player),'체력을 회복하는 중이에요. 잠시 기다려주세요.');
          if(session?.player.role==='student'&&name!=='room:leave')ensure(studentOpen(),STUDENT_HOURS_MESSAGE);
          if(persistent && !session?.room.unattended && session?.player.role==='student' && name!=='room:leave')
            ensure([...session.room.players.values()].some(p=>p.role==='teacher'&&p.connected),'선생님이 다시 연결할 때까지 기다려주세요.');
          return handler(data);
        })});
      }catch(error){
        if(!(error instanceof GameError)) console.error('Action failed:',name,error.message);
        ack({ok:false,error:error instanceof GameError?error.message:'처리하지 못했어요. 다시 시도해주세요.'});
      }
    });
    // 일시적인 타격 표시는 디스크에 저장하지 않습니다. 좌표·방향·공격력은 서버만 결정합니다.
    action('combat:attack',()=>{
      const session=socket.data.session;ensure(session,'먼저 교실에 입장해주세요.');
      const {room,player}=session,now=clock(),power=attackPowerOf(player.avatar.level);
      ensure(player.connected&&!player.away,'먼저 교실에 입장해주세요.');
      ensure(!player.avatar.blackStar,'현재 검은별 상태입니다');
      ensure(power!==null,player.avatar.level<2?'LV2부터 공격할 수 있어요.':'이 단계의 공격력은 설정 준비 중이에요.');
      ensure(now-(lastAttacks.get(player)??-Infinity)>=ATTACK_VISUAL.cooldownMs,'공격을 조금 천천히 해주세요.');
      lastAttacks.set(player,now);
      const direction=player.facing||{x:0,y:1};
      const hit={playerId:player.id,mapId:player.mapId,x:player.x,y:player.y,dx:direction.x,dy:direction.y,durationMs:ATTACK_VISUAL.durationMs,power};
      for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId)io.to(viewer.socketId).emit('combat:hit',hit);
      const target=strikeMonster(room,player,power,now);
      return {target};
    },false);
    // 이전 클라이언트에도 바로 안내하고, 폐지된 몬스터 상호작용은 실행하지 않습니다.
    action('combat:skill',()=>{
      const session=socket.data.session;ensure(session,'먼저 교실에 입장해주세요.');
      const {room,player}=session,now=clock();
      ensure(player.connected&&!player.away,'먼저 교실에 입장해주세요.');
      ensure(!player.avatar.blackStar,'현재 검은별 상태입니다');
      ensure(now-(lastSkills.get(player)??-Infinity)>=ATTACK_VISUAL.cooldownMs,'스킬을 조금 천천히 사용해주세요.');
      lastSkills.set(player,now);
      const direction=player.facing||{x:0,y:1};
      const hit={kind:'skill',playerId:player.id,mapId:player.mapId,x:player.x,y:player.y,dx:direction.x,dy:direction.y,durationMs:ATTACK_VISUAL.durationMs};
      for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId)io.to(viewer.socketId).emit('combat:hit',hit);
      // 전투 스킬은 방향 표시만 제공합니다. 주간 카드 능력·마나·HP를 소비하지 않습니다.
      return {ready:false,direction};
    },false);
    action('monster:info',()=>{ensure(false,'몬스터는 Q 공격키로 직접 공격해주세요.');},false);
    const enter=session=>{
      const credentials=session.credentials;delete session.credentials;
      socket.data.session=session;joinChannel(session);roster(session.room);
      const {room,player}=session;
      // 방 공개 기록과 이 사람에게만 왔던 개인 안내(notes)를 시간순으로 합쳐 돌려줍니다.
      const messages=visibleHistory(room,player);
      return {token:player.token,selfId:player.id,room:store.snapshot(room,player),chat:{messages},...(credentials?{credentials}:{})};
    };
    const notJoined=()=>ensure(!socket.data.session,'먼저 현재 교실에서 나가주세요.');
    const authorizeTeacher=data=>{
      const ip=socket.handshake.address,now=Date.now();
      let bucket=authAttempts.get(ip);
      if(!bucket || now-bucket.at>60_000){bucket={at:now,count:0};authAttempts.set(ip,bucket);}
      ensure(bucket.count<10,'교사 확인을 여러 번 시도했어요. 1분 후 다시 시도해주세요.');
      if(!equalSecret(data.teacherKey,teacherKey)){bucket.count++;throw new GameError('교사용 시작 링크 또는 교사 확인 키를 확인해주세요.');}
    };
    action('room:create',data=>{
      notJoined();authorizeTeacher(data);
      return enter(store.create(data,socket.id));
    });
    action('room:list',data=>{notJoined();authorizeTeacher(data);ensure(persistent,'저장 기능이 켜져 있지 않아요.');return {classes:store.list()};});
    action('room:studentLink',()=>{
      const s=socket.data.session;ensure(s?.player.role==='teacher','선생님만 할 수 있어요.');
      return {url:(publicOrigin||'http://'+socket.handshake.headers.host)+'/?class='+s.room.code};
    });
    action('room:open',data=>{notJoined();authorizeTeacher(data);ensure(persistent,'저장 기능이 켜져 있지 않아요.');return enter(store.open(data,socket.id));});
    action('student:pin:set',data=>{
      const s=socket.data.session;ensure(s?.player.role==='teacher','선생님만 할 수 있어요.');
      ensure(persistent,'저장 기능이 켜져 있지 않아요.');
      const p=s.room.players.get(data.playerId);ensure(p?.role==='student','학생을 선택해주세요.');
      const pin=pinHash(data.pin),oldSocket=io.sockets.sockets.get(p.socketId);
      cancelTradesFor(s.room,p.id,p.nickname);store.remove(s.room,p);p.pin=pin;
      if(oldSocket){oldSocket.data.session=null;deliver(()=>{oldSocket.leave(s.room.code);oldSocket.emit('room:closed',{message:'선생님이 비밀번호를 바꿨어요. 새 비밀번호로 입장해주세요.'});});}
      roster(s.room);return {};
    });
    action('student:create',data=>{
      const s=socket.data.session;ensure(s?.player.role==='teacher','선생님만 할 수 있어요.');ensure(persistent,'저장 기능이 필요해요.');
      const player=store.createStudent(s.room,data);roster(s.room);return {playerId:player.id};
    });
    action('student:password',data=>{
      const s=socket.data.session;ensure(persistent&&s?.player.role==='student','학생 본인만 바꿀 수 있어요.');
      const replacement=pinHash(data.pin);checkPin(s.player,data.currentPin);
      ensure(data.pin!==data.currentPin,'지금과 다른 비밀번호를 정해주세요.');
      s.player.pin=replacement;store.sessions.delete(s.player.token);
      s.player.token=randomBytes(32).toString('hex');store.sessions.set(s.player.token,s);
      return {token:s.player.token};
    });
    action('student:update',data=>{
      const s=socket.data.session;ensure(s?.player.role==='teacher','선생님만 할 수 있어요.');ensure(persistent,'저장 기능이 필요해요.');
      const p=s.room.players.get(data.playerId);ensure(p?.role==='student','학생을 골라주세요.');
      const name=nickname(data.nickname),pin=data.pin?pinHash(data.pin):null;
      ensure(name!=='선생님'&&![...s.room.players.values()].some(other=>other.id!==p.id&&other.nickname===name),'이미 있는 이름이에요.');
      const oldSocket=io.sockets.sockets.get(p.socketId);
      cancelTradesFor(s.room,p.id,p.nickname);store.remove(s.room,p);
      s.room.allowedNames.delete(p.nickname);s.room.allowedNames.add(name);p.nickname=name;if(pin)p.pin=pin;
      if(oldSocket){oldSocket.data.session=null;deliver(()=>{oldSocket.leave(s.room.code);oldSocket.emit('room:closed',{message:'선생님이 계정을 수정했어요. 새 이름과 비밀번호로 들어와주세요.'});});}
      roster(s.room);return {};
    });
    action('room:join',data=>{notJoined();ensure(studentOpen(),STUDENT_HOURS_MESSAGE);return enter(store.join(data,socket.id));});
    action('session:resume',data=>{notJoined();const old=store.sessions.get(data.token);if(old?.player.role==='student')ensure(studentOpen(),STUDENT_HOURS_MESSAGE);return enter(store.resume(data.token,socket.id));});
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
      ensure(typeof raw==='string' && trimmed.length>=1 && [...trimmed].length<=CHAT.maxLength && !hasControl,'채팅은 1~100자로 입력해주세요.');
      const text=trimmed.replace(/ {2,}/g,' ');
      if(p.role==='student'){
        ensure(room.unattended||[...room.players.values()].some(t=>t.role==='teacher'&&t.connected),'선생님이 다시 연결할 때까지 기다려주세요.');
        ensure(room.chat.enabled,'선생님이 채팅을 껐어요.');
      }
      ensure(!p.muted,'선생님이 내 채팅을 잠시 멈췄어요.');
      const now=Date.now();
      const {text:filtered,flagged}=filterChat(text);
      const scope=chatScope(room,p,data);
      if(scope.channel==='direct')ensure(room.players.get(scope.targetId)?.connected,'현재 접속 중인 친구에게 말해주세요.');
      const recentChats=checkChatRate(p,filtered,now);
      const msg=store.pushChat(room,{playerId:p.id,nickname:p.nickname,role:p.role,text:filtered,flagged,...scope});
      for(const recipient of room.players.values())if(recipient.connected&&canReadChat(recipient,msg)){
        const targetSocket=io.sockets.sockets.get(recipient.socketId);
        if(targetSocket)deliver(()=>targetSocket.emit('chat:message',msg));
      }
      p.lastChatAt=now;p.recentChats=recentChats;
      return {};
    });
    action('chat:history',()=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      return {messages:visibleHistory(s.room,s.player)};
    });
    action('social:summon',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const invitation=requestSummon(s.room,s.player,data.targetId);roster(s.room);return {invitation};
    });
    action('social:respond',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const invitation=respondSummon(s.room,s.player,data.requestId,data.accept);
      const host=s.room.players.get(invitation.fromId);
      if(host)whisper(s.room,host,s.player.nickname+(data.accept?' 친구가 내 앞으로 왔어요.':' 친구가 호출을 거절했어요. 24시간 뒤에 다시 요청할 수 있어요.'));
      roster(s.room);return {};
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
      deliver(()=>io.to(room.code).emit('chat:cleared',{}));
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
      // 새 행성의 기본 규칙은 고른 종류의 규칙(없으면 공통 기본 규칙)으로 시작합니다.
      const planet=addPlanet(room,{...input,rules:[...(templateOf(input.templateId)?.rules||PLANET.defaultRules)],createdBy:p.id});
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
        const error=new GameError('그 자리에 이미 다른 행성이 생겼어요.');error.commitOnError=true;throw error;
      }
      const planet=addPlanet(room,{name:proposal.name,description:proposal.description,x:proposal.x,y:proposal.y,
        color:proposal.color,rules:[...(templateOf(proposal.templateId)?.rules||PLANET.defaultRules)],createdBy:proposal.playerId,templateId:proposal.templateId});
      const student=room.players.get(proposal.playerId);
      if(student){
        const previousId=student.avatar.departmentId;
        if(student.mapId!==PLAZA_ID&&!student.avatar.blackStar){
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
      for(const player of room.players.values())if(player.avatar.blackStar?.planetId===planet.id)clearBlackStar(room,player);
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
    // 문서와 분배 명단은 해당 부서와 교사에게만 보냅니다. 공개 스냅샷에는 제출 표시만 포함합니다.
    const departmentAccess=data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const planet=requirePlanet(s.room,data),p=s.player;
      ensure(p.role==='teacher'||p.avatar.departmentId===planet.id,'우리 부서의 실적만 볼 수 있어요.');
      const inside=p.mapId===interiorIdOf(planet.id);
      ensure(inside||(p.mapId===PLAZA_ID&&isNear(p,planet)),'행성에 가까이 가거나 안에 입장해주세요.');
      const document=mapOf(interiorIdOf(planet.id)).objects.find(o=>o.kind==='report-board');
      return {...s,planet,canWrite:p.role==='student'&&inside&&isNear(p,document)};
    };
    const departmentView=s=>({planetId:s.planet.id,name:s.planet.name,work:validateWork(s.planet.work,clock()),
      members:[...s.room.players.values()].filter(p=>p.role==='student'&&p.avatar.departmentId===s.planet.id).map(p=>({playerId:p.id,nickname:p.nickname,connected:p.connected})),
      teacher:s.player.role==='teacher',selfId:s.player.id,canWrite:s.canWrite});
    const departmentChanged=s=>{roster(s.room);deliver(()=>io.to(s.room.code).emit('department:changed',{planetId:s.planet.id}));return departmentView(s);};
    action('department:get',data=>departmentView(departmentAccess(data)));
    for(const event of ['save','submit']) action('department:'+event,data=>{
      const s=departmentAccess(data);ensure(s.canWrite,'부서 안의 실적 문서에 가까이 가주세요.');
      saveReport(s.planet,data.text,data.version,event==='submit',clock());return departmentChanged(s);
    });
    action('department:award',data=>{
      const s=departmentAccess(data);ensure(s.player.role==='teacher','선생님만 실적을 확인하고 별을 줄 수 있어요.');
      awardReport(s.planet,data.amount,data.version,clock());return departmentChanged(s);
    });
    action('department:propose',data=>{
      const s=departmentAccess(data);proposeDistribution(s.room,s.planet,s.player.id,data.allocations,clock());return departmentChanged(s);
    });
    action('department:confirm',data=>{
      const s=departmentAccess(data),result=confirmDistribution(s.room,s.planet,s.player.id,data.proposalId,clock());
      if(result.completed) for(const a of result.allocations){
        recordReward(s.room,a.playerId,a.quantity,clock());
        whisper(s.room,s.room.players.get(a.playerId),s.planet.name+' 분배로 별 파편 '+a.quantity+'개를 받았어요.');
      }
      return {...departmentChanged(s),completed:result.completed};
    });
    action('department:cancel',data=>{const s=departmentAccess(data);cancelDistribution(s.room,s.planet,s.player.id);return departmentChanged(s);});
    const rulesBoardAccess=data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      const planet=requirePlanet(room,data);
      ensure(p.role==='teacher'||p.avatar.departmentId===planet.id,'이 행성에 소속된 친구만 규칙을 수정할 수 있어요.');
      const mapId=interiorIdOf(planet.id),board=mapOf(mapId).objects.find(o=>o.kind==='board');
      ensure(p.mapId===mapId&&board&&isNear(p,board),'행성 안의 규칙판 가까이에서 수정해주세요.');
      return {room,player:p,planet};
    };
    action('planet:rules:open',data=>{
      const {planet}=rulesBoardAccess(data);return {planetId:planet.id,name:planet.name,rules:[...planet.rules]};
    });
    action('planet:rules:set',data=>{
      const {room,player:p,planet}=rulesBoardAccess(data);
      ensure(Array.isArray(data.expectedRules)&&JSON.stringify(data.expectedRules)===JSON.stringify(planet.rules),'다른 친구가 규칙을 바꿨어요. 창을 닫고 다시 열어 확인해주세요.');
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
      announce(room,(p.role==='teacher'?'선생님이':p.nickname+' 친구가')+' '+planet.name+'의 규칙을 바꿨어요.');
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
      ensure(!p.avatar.blackStar || data.to===BLACK_HOLE_ID,'현재 검은별 상태입니다');
      const here=mapOf(p.mapId,room.planets.values());
      const gate=here.objects.find(o=>(o.kind==='gate'||o.kind==='black-hole') && o.target===data.to);
      ensure(gate,'여기서는 그곳으로 갈 수 없어요.');
      ensure(isNear(p,gate),'문에 더 가까이 가주세요.');
      requireMapLevel(p,data.to);
      Object.assign(p,arrivePosition(room,data.to,gate.arrival),{mapId:data.to,input:{x:0,y:0,at:0}});
      roster(room);
      return {};
    });
    action('planet:interior-decor:set',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s,planet=requirePlanet(room,data);
      ensure(p.role==='teacher'||p.avatar.departmentId===planet.id,'우리 부서의 오브젝트만 꾸밀 수 있어요.');
      ensure(p.mapId===interiorIdOf(planet.id),'부서행성 안에서만 꾸밀 수 있어요.');
      const object=interiorDecorObject(data.objectId);
      ensure(object,'꾸밀 오브젝트를 골라주세요.');
      const target=mapOf(p.mapId).objects.find(item=>item.id===object.id);
      ensure(target&&isNear(p,target),'오브젝트 가까이에서 꾸며주세요.');
      ensure(interiorDecorColor(data.colorId)&&object.shapes.some(shape=>shape.id===data.shapeId),'준비된 색과 모양 중에서 골라주세요.');
      const style={colorId:data.colorId,shapeId:data.shapeId};
      planet.interiorDecor??={};planet.interiorDecor[object.id]=style;
      roster(room);
      return {planetId:planet.id,objectId:object.id,style};
    });
    const warningRockAccess=data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const planet=requirePlanet(s.room,data),p=s.player;
      ensure(p.mapId===interiorIdOf(planet.id),'부서행성 안에서만 경고 돌덩이를 이용할 수 있어요.');
      ensure(p.role==='teacher'||p.avatar.departmentId===planet.id,'소속 학생만 이 부서의 경고를 줄 수 있어요.');
      const rock=mapOf(p.mapId).objects.find(o=>o.kind==='warning-rock');
      ensure(rock&&isNear(p,rock),'경고 돌덩이에 더 가까이 가주세요.');
      return {...s,planet};
    };
    action('warning:get',data=>{
      const {room,planet}=warningRockAccess(data);
      return warningView(room,planet);
    });
    action('warning:threshold:set',data=>{
      const {room,planet}=warningRockAccess(data);
      ensure(Number.isInteger(data.threshold)&&data.threshold>=WARNING_RULES.minThreshold&&data.threshold<=WARNING_RULES.maxThreshold,
        '검은별 기준은 1~10회로 정해주세요.');
      planet.warnings??={threshold:WARNING_RULES.defaultThreshold,entries:[]};
      planet.warnings.threshold=data.threshold;
      roster(room);
      return warningView(room,planet);
    });
    action('warning:issue',data=>{
      const {room,player:p,planet}=warningRockAccess(data);
      ensure(p.role==='student'&&p.avatar.departmentId===planet.id,'소속 학생만 경고를 줄 수 있어요.');
      const target=typeof data.targetId==='string'?room.players.get(data.targetId):null;
      const reason=typeof data.reason==='string'?data.reason.normalize('NFKC').replace(/\p{Cf}/gu,'').trim():'';
      ensure(![...reason].some(ch=>{const c=ch.codePointAt(0);return c<32||c===127;}),'경고 이유에 줄바꿈이나 제어 문자를 쓸 수 없어요.');
      ensure(!filterChat(reason).flagged,'경고 이유에 쓸 수 없는 말이 있어요.');
      const result=issueWarning(room,planet,p,target,reason,clock());
      whisper(room,target,planet.name+'에서 경고를 받았어요. ('+result.count+'/'+result.threshold+'회) 이유: '+reason+(result.blackStar?' 검은별이 되어 블랙홀로 이동했어요.':''));
      roster(room);
      return {...warningView(room,planet),count:result.count,blackStar:result.blackStar};
    });
    action('warning:teacher:list',()=>{
      const s=socket.data.session;ensure(s?.player.role==='teacher','선생님만 검은별 명단을 볼 수 있어요.');
      return {students:blackStarList(s.room)};
    });
    action('warning:teacher:clear',data=>{
      const s=socket.data.session;ensure(s?.player.role==='teacher','선생님만 검은별 상태를 해제할 수 있어요.');
      const target=typeof data.targetId==='string'?s.room.players.get(data.targetId):null;
      clearBlackStar(s.room,target);
      whisper(s.room,target,'선생님이 검은별 상태를 해제했어요. 다시 별의 기원으로 이동했어요.');
      roster(s.room);
      return {students:blackStarList(s.room)};
    });
    const templeAccess=data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const pillar=MAP.objects.find(o=>o.kind==='pillar'&&o.id===data.objectId);
      ensure(pillar&&s.player.mapId===PLAZA_ID&&isNear(s.player,pillar),'해당 기둥에 더 가까이 가주세요.');
      return {...s,pillar};
    };
    action('temple:read',data=>{
      const {room,player,pillar}=templeAccess(data),kind=pillar.service;
      if(kind==='weekly')return {kind,...weeklyRewards(room,clock())};
      if(kind==='effects')return {kind,canComplete:player.role==='teacher',rows:[...room.players.values()].flatMap(p=>[
        ...playerEffectsView(p,player.role==='teacher',clock()).filter(e=>e.until===null||e.until>clock()).map(e=>({targetId:p.id,nickname:p.nickname,...e})),
        ...(p.abilityState?.markers||[]).map(marker=>({targetId:p.id,nickname:p.nickname,itemId:null,icon:'✦',
          label:'Lv'+(marker.level||2)+' '+(constellationOf(marker.constellationId)?.name||'별자리')+' 능력',description:constellationOf(marker.constellationId,marker.level||2)?.ability?.description||'',
          note:marker.note,until:null,...(player.role==='teacher'?{abilityMarkerId:marker.id,constellationId:marker.constellationId,abilityLevel:marker.level||2}:{} )}))])};
      if(kind==='timetable')return {kind,...readTimetable(room),canEdit:player.role==='teacher'};
      return {kind,...readDaily(room,kind,clock()),canEdit:player.role==='teacher'};
    });
    action('temple:save',data=>{
      const {room,player,pillar}=templeAccess(data);ensure(player.role==='teacher','선생님만 내용을 바꿀 수 있어요.');
      ensure(pillar.service==='notice','알림장 기둥에서 저장해주세요.');
      ensure(typeof data.text==='string'&&data.text.length<=2000,'내용은 2000자 이내로 적어주세요.');
      try{return {kind:pillar.service,...saveNotice(room,data.text,data.taskLineIndexes??[],clock()),canEdit:true};}
      catch(error){if(error.message.startsWith('Invalid temple:'))throw new GameError('알림장 과제 표시를 확인해주세요. 비어 있지 않은 줄만 체크할 수 있어요.');throw error;}
    });
    action('temple:timetable:save',data=>{
      const {room,player,pillar}=templeAccess(data);ensure(player.role==='teacher','선생님만 시간표를 바꿀 수 있어요.');
      ensure(pillar.service==='timetable','오늘의 시간표 기둥 가까이에서 저장해주세요.');
      try{return {kind:'timetable',...saveTimetable(room,data.cells),canEdit:true};}
      catch(error){if(error.message.startsWith('Invalid temple:'))throw new GameError('시간표를 확인해주세요. 월~금 1~6교시 과목을 각 20자 이내로 적어주세요.');throw error;}
    });
    action('task:add',data=>{
      const {room,player,pillar}=templeAccess({objectId:'pillar-notice'});
      ensure(player.role==='student'&&pillar.service==='notice','학생만 알림장에서 과제를 가져올 수 있어요.');
      ensure(Number.isInteger(data.lineIndex)&&data.lineIndex>=0,'가져올 알림장 줄을 골라주세요.');
      const notice=readDaily(room,'notice',clock()),line=notice.text.split('\n')[data.lineIndex]?.trim();
      const marked=notice.taskLines?.find(item=>item.lineIndex===data.lineIndex);
      ensure(line&&marked,'과제로 표시된 오늘 알림장 줄을 골라주세요.');
      ensure(typeof data.assignmentId==='string'&&data.assignmentId===marked.assignmentId,'알림장 과제가 바뀌었어요. 다시 열어주세요.');
      const assignment=assignmentById(room,marked.assignmentId);
      ensure(assignment&&assignment.text===line,'과제 내용이 바뀌었어요. 다시 열어주세요.');
      const tasks=addTask(player,{assignmentId:assignment.id,text:line,sourceDate:notice.date,lineIndex:data.lineIndex},clock());
      roster(room);return {tasks};
    });
    action('task:complete',data=>{
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 자신의 과제를 완료할 수 있어요.');
      const task=s.player.tasks?.find(task=>task.id===data.taskId);
      ensure(task,'과제를 찾지 못했어요.');
      markAssignmentDone(s.room,task.assignmentId,s.player.id);
      const tasks=completeTask(s.player,data.taskId);roster(s.room);return {tasks};
    });
    action('assignment:read',()=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const portal=MAP.objects.find(o=>o.kind==='andromeda');
      ensure(s.player.mapId===PLAZA_ID&&isNear(s.player,portal),'과제안드로메다 가까이에서 확인해주세요.');
      return recentAssignments(s.room,clock());
    });
    action('shards:give',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      ensure(p.role==='teacher','선생님만 할 수 있어요.');
      const amount=data.amount;
      ensure(Number.isInteger(amount) && amount!==0 && Math.abs(amount)<=SHARDS.giveMax,'별 파편 개수는 1~999 사이 정수로 적어주세요.');
      const apply=target=>{const previous=target.starShards;target.starShards=Math.max(0,Math.min(SHARDS.max,previous+amount));recordReward(room,target.id,Math.max(0,target.starShards-previous),clock());};
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
    action('arcade:open',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const machine=STREET.objects.find(o=>o.kind==='arcade'&&o.id===data.objectId);
      ensure(machine&&s.player.mapId===STREET_ID&&isNear(s.player,machine),'오락기에 더 가까이 가주세요.');
      return {gameId:machine.gameId};
    });
    const avatarSession=()=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');return s;};
    action('evolution:info',()=>{const s=avatarSession();return evolutionInfo(s.room,s.player);});
    action('evolution:change',data=>{const s=avatarSession(),result=changeConstellation(s.room,s.player,data);roster(s.room);return result;});
    action('evolution:evolve',data=>{const s=avatarSession(),result=evolveConstellation(s.room,s.player,data);roster(s.room);return result;});
    action('growth:info',()=>{const s=avatarSession();return growthInfo(s.room,s.player);});
    action('growth:buy',data=>{const s=avatarSession(),result=buyExperience(s.room,s.player,data);roster(s.room);return result;});
    const starAccess=()=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const machine=STREET.objects.find(o=>o.gameId==='stars');
      ensure(s.player.mapId===STREET_ID&&isNear(s.player,machine),'반짝별 찾기 오락기 가까이에서 이용해주세요.');return s;
    };
    action('stars:ranking',()=>{const s=starAccess();return {ranking:starRanking(s.room)};});
    action('stars:start',()=>{const s=starAccess();return startStarRun(s.room,s.player);});
    action('stars:cancel',data=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');cancelStarRun(s.room,s.player,data.runId);return {};});
    action('stars:click',data=>{
      const s=starAccess(),result=clickStar(s.room,s.player,data);
      if(result.done)deliver(()=>io.to(s.room.code).emit('stars:ranking',{ranking:result.ranking}));
      return result;
    });
    const dodgeAccess=()=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const machine=STREET.objects.find(o=>o.gameId==='dodge');
      ensure(s.player.mapId===STREET_ID&&isNear(s.player,machine),'별 피하기 오락기 가까이에서 이용해주세요.');return s;
    };
    action('dodge:ranking',()=>{const s=dodgeAccess();return {ranking:dodgeRanking(s.room)};});
    action('dodge:start',()=>{const s=dodgeAccess();return startDodgeRun(s.room,s.player);});
    action('dodge:cancel',data=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');cancelDodgeRun(s.room,s.player,data.runId);return {};});
    // 방향 입력에는 디스크 저장이 필요 없습니다. 점수와 충돌 판정은 서버가 계산합니다.
    socket.on('dodge:input',data=>{
      const s=socket.data.session;if(!s||!data||typeof data!=='object'||(s.player.role==='student'&&!studentOpen()))return;
      setDodgeInput(s.room,s.player,data);
    });
    const requireShop=p=>{
      ensure(p.mapId===STREET_ID,'별상점은 오색별빛 쉼터에 있어요.');
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
      const copyPending=p.avatar?.constellationId==='gemini'&&p.abilityState?.pending?.mode==='shop-copy'&&
        p.abilityState.pending.week===weekStart(clock())&&
        (p.abilityState.pending.maxPrice!==undefined?item.price<=p.abilityState.pending.maxPrice:item.level<=2);
      const totalQuantity=quantity+(copyPending?1:0);
      const existing=p.inventory.find(i=>i.id===item.id);
      if(existing){
        ensure(existing.quantity+totalQuantity<=SHOP.maxStack,'한 종류는 99개까지만 가질 수 있어요.');
        existing.quantity+=totalQuantity;
      }else{
        ensure(p.inventory.length<SHOP.maxKinds,'가방이 가득 찼어요.');
        p.inventory.push({id:item.id,quantity:totalQuantity});
      }
      p.starShards-=cost;
      if(copyPending)p.abilityState.pending=null;
      roster(room);
      return {starShards:p.starShards,inventory:[...p.inventory],copiedItem:copyPending?item.name:null};
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
    action('item:meteor:options',()=>{
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 운석 파편을 사용할 수 있어요.');
      return {planets:[...s.room.planets.values()].filter(planet=>planet.id!==s.player.avatar.departmentId)
        .map(planet=>({id:planet.id,name:planet.name,count:warningCount(planet,s.player.id)})).filter(planet=>planet.count>0)};
    });
    action('draw:status',()=>{
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 달토끼 뽑기를 할 수 있어요.');
      return {draw:rabbitDrawView(s.player.rabbitDraw)};
    });
    action('draw:start',()=>{
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 달토끼 뽑기를 할 수 있어요.');
      const {room,player:p}=s,now=clock(),item=itemOf('moon-rabbit-card');
      if(p.rabbitDraw)return {draw:rabbitDrawView(p.rabbitDraw),inventory:[...p.inventory]};
      const owned=p.inventory.find(entry=>entry.id===item.id&&entry.quantity>0);
      ensure(owned,'가방에 달토끼 카드가 없어요.');
      ensure(levelOf(p)>=item.level,'캐릭터의 lv보다 높은 아이템으로 사용할 수 없습니다');
      ensure(!hasCardStatus(p,'little-sun-card',now),'자외선 상태라 오늘 자정까지 아이템을 사용할 수 없어요.');
      ensure(!activeItemBlocks(p,now).length,'별자리 능력 때문에 지금은 아이템을 사용할 수 없어요.');
      ensure(!hasCardStatus(p,'little-moon-card',now),'꼬마 달 보호 중에는 다른 카드 효과를 받을 수 없어요.');
      ensure(p.rabbitUsedDay!==koreaDay(now),'달토끼는 하루에 한 번만 사용할 수 있어요.');
      ensure(p.starShards<=SHARDS.max-10,'별 파편을 더 담을 수 없어요. 뽑기 전에 별 파편을 조금 사용해주세요.');
      ensure(activeCardMarkers(p,now).length<MAX_CARD_MARKERS,'사용 중인 카드 기록이 가득 찼어요. 선생님께 알려주세요.');
      ensure(now-p.lastItemUseAt>=ITEM_USE.cooldownMs,'조금 천천히 써요.');
      owned.quantity--;if(!owned.quantity)p.inventory=p.inventory.filter(entry=>entry.id!==item.id);
      p.lastItemUseAt=now;p.rabbitUsedDay=koreaDay(now);
      const draw=createRabbitDraw(now),marker=addCardMarker(p,item,p,null,'뽑기 진행 중');
      draw.markerId=marker.id;p.rabbitDraw=draw;
      room.itemLog.push({id:randomUUID(),at:now,userId:p.id,userNickname:p.nickname,targetId:p.id,
        targetNickname:p.nickname,itemId:item.id,itemName:item.name,secret:false});
      if(room.itemLog.length>ITEM_USE.logSize)room.itemLog.shift();
      roster(room);return {draw:rabbitDrawView(draw),inventory:[...p.inventory]};
    });
    action('draw:pick',data=>{
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 달토끼 뽑기를 할 수 있어요.');
      const {room,player:p}=s,draw=p.rabbitDraw;
      ensure(draw&&draw.id===data.drawId,'진행 중인 뽑기가 없어요.');
      const card=draw.cards.find(entry=>entry.id===data.cardId);
      ensure(card,'펼쳐진 카드 한 장을 골라주세요.');
      ensure(p.starShards+card.reward<=SHARDS.max,'별 파편을 더 담을 수 없어요.');
      p.starShards+=card.reward;p.rabbitDraw=null;
      const marker=p.cardMarkers?.find(entry=>entry.id===draw.markerId);
      if(marker)marker.note='당첨: 별 파편 '+card.reward+'개';
      whisper(room,p,'달토끼 뽑기에서 별 파편 '+card.reward+'개를 받았어요.');
      roster(room);return {reward:card.reward,starShards:p.starShards};
    });
    action('item:complete',data=>{
      const {room,player,pillar}=templeAccess(data);
      ensure(player.role==='teacher'&&pillar.service==='effects','선생님만 사용 중인 아이템을 처리 완료할 수 있어요.');
      const target=typeof data.targetId==='string'?room.players.get(data.targetId):null;
      const marker=target?.cardMarkers?.find(entry=>entry.id===data.markerId&&entry.until===null);
      ensure(marker,'처리할 아이템 기록을 찾지 못했어요.');
      ensure(target.rabbitDraw?.markerId!==marker.id,'뽑기를 마친 뒤 처리 완료할 수 있어요.');
      target.cardMarkers=target.cardMarkers.filter(entry=>entry.id!==marker.id);
      roster(room);
      return {};
    });
    action('ability:status',()=>{
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 별자리 능력을 사용할 수 있어요.');
      const {room,player:p}=s,week=weekStart(clock()),state=p.abilityState||freshAbilityState();
      if(state.pending?.week!==week)state.pending=null;
      return {week,used:state.usedWeek===week,pending:state.pending,
        planets:[...room.planets.values()].filter(planet=>planet.id!==p.avatar.departmentId&&warningCount(planet,p.id)>0)
          .map(planet=>({id:planet.id,name:planet.name,count:warningCount(planet,p.id)}))};
    });
    action('ability:use',data=>{
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 별자리 능력을 사용할 수 있어요.');
      const {room,player:p}=s,now=clock(),week=weekStart(now),constellation=constellationOf(p.avatar.constellationId,p.avatar.level);
      ensure(p.avatar.level>=2&&constellation&&!constellation.legacy,'LV2 별자리 아바타부터 능력을 사용할 수 있어요.');
      const state=p.abilityState??=freshAbilityState(),ability=constellation.ability,mode=ability.mode;
      ensure(state.usedWeek!==week,'이번 주 별자리 능력은 이미 사용했어요. 다음 월요일에 다시 쓸 수 있어요.');
      if(state.pending?.week!==week)state.pending=null;
      let target=null,planet=null,roll=null,reward=0,note='';
      if(['ban-two-days','sleep','manual'].includes(mode)&&typeof data.targetId==='string'&&data.targetId){
        target=room.players.get(data.targetId);
        ensure(target?.role==='student'&&target.connected&&target.id!==p.id,'지금 접속 중인 다른 학생 친구를 골라주세요.');
      }
      if(['ban-two-days','sleep'].includes(mode)||ability.target||
        (p.avatar.level===2&&['cetus','cancer','pisces'].includes(constellation.id)))
        ensure(target,'함께할 학생 친구를 골라주세요.');
      const targetMax=ability.targetMaxLevel||(p.avatar.level===2&&constellation.id==='cetus'?2:null);
      if(targetMax)ensure(target&&target.avatar.level<=targetMax,'Lv'+targetMax+' 이하 별자리 친구를 골라주세요.');
      if(mode==='warning-one'){
        planet=typeof data.planetId==='string'?room.planets.get(data.planetId):null;
        ensure(planet&&planet.id!==p.avatar.departmentId&&warningCount(planet,p.id)>0,'경고를 받은 다른 부서행성을 골라주세요.');
      }
      if(['grant-one','dice-shards','dice-risk','sleep','dice-difference','dice-triple'].includes(mode)){
        const maxReward=mode==='dice-risk'?(ability.win||3):mode==='dice-shards'?Math.max(...(ability.rewards||[0,1,1,1,1,2])):
          mode==='dice-difference'?5:mode==='dice-triple'?2:(ability.reward||1);
        ensure(p.starShards<=SHARDS.max-maxReward,'별 파편을 더 담을 수 없어요.');
        if(mode==='sleep')ensure(target.starShards<SHARDS.max,'친구가 별 파편을 더 담을 수 없어요.');
        if(mode==='dice-risk')ensure(p.starShards>=(ability.loss||1),'별 파편 '+(ability.loss||1)+'개가 있어야 황소자리 주사위를 던질 수 있어요.');
      }
      if(mode==='ban-two-days')ensure((target.abilityState?.blocks||[]).length<20,'친구의 능력 상태 기록이 가득 찼어요.');
      if(mode==='sleep')ensure((p.abilityState?.blocks||[]).length<20&&(target.abilityState?.blocks||[]).length<20,'능력 상태 기록이 가득 찼어요.');
      if(['manual','dice-triple'].includes(mode))ensure(state.markers.length<30,'처리 대기 중인 능력 기록이 가득 찼어요.');
      if(['dice-item','value-item','dice-shards','dice-risk','dice-difference','dice-triple'].includes(mode))roll=abilityDie();
      const rolls=roll?[roll]:[];
      if(mode==='grant-one')reward=ability.reward||1;
      if(mode==='dice-shards')reward=(ability.rewards||[0,1,1,1,1,2])[roll-1];
      if(mode==='dice-risk')reward=roll%2===1?(ability.win||3):-(ability.loss||1);
      if(mode==='dice-difference'){
        rolls.push(abilityDie());reward=Math.abs(rolls[0]-rolls[1]);
        note='주사위 '+rolls.join(' · ')+' → 차이 '+reward+'개';
        if(!reward)state.pending={mode:'dice-retry',week};
      }
      if(mode==='dice-triple'){
        rolls.push(abilityDie(),abilityDie());
        const kinds=new Set(rolls).size;
        if(kinds===2)reward=2;
        note='주사위 '+rolls.join(' · ')+' → '+(kinds===1?'별 카드 · 선생님 확인':kinds===3?'뽑기 카드 · 선생님 확인':'별 2개');
        if(kinds!==2)state.markers.push({id:randomUUID(),constellationId:constellation.id,level:p.avatar.level,at:now,note,targetName:''});
      }
      if(mode==='sleep')reward=1;
      if(reward)p.starShards+=reward;
      if(mode==='shop-copy'){state.pending={mode,week,...(ability.maxPrice?{maxPrice:ability.maxPrice}:{})};note='이번 주 '+(ability.maxPrice?'별 파편 '+ability.maxPrice+'개 이하':'Lv2 이하')+' 아이템 구매 시 1개 복사 대기';}
      if(mode==='value-item'){
        state.pending={mode,week,budget:roll*ability.multiplier,maxLevel:ability.maxItemLevel,picks:ability.picks,roll,selected:[]};
        note='별 파편 '+state.pending.budget+'개 이하 가치 · 최대 '+ability.picks+'종 제작 대기';
      }
      if(mode==='dice-item'&&roll>=2){state.pending={mode,week,maxLevel:Math.floor(roll/2),roll};note='Lv'+state.pending.maxLevel+' 이하 아이템 선택 대기';}
      if(mode==='dice-item'&&roll===1)note='주사위 1: 만들 수 있는 아이템이 없어요.';
      if(mode==='warning-one'){const result=clearOneWarningFromPlanet(room,planet,p);note=planet.name+' 경고 1개 해제'+(result.released?' · 검은별 해제':'');}
      if(mode==='ban-two-days'){addItemBlock(target,'ophiuchus',p,now+2*86400000,1);note=target.nickname+' 아이템 사용 2일 정지 · 해제일 별 1개';}
      if(mode==='sleep'){addItemBlock(p,'aries',p,nextKoreaMidnight(now));addItemBlock(target,'aries',p,nextKoreaMidnight(now));target.starShards++;note=target.nickname+'와 각각 별 1개 · 오늘 자정까지 수면';}
      if(mode==='manual'){
        note=(target?target.nickname+' 대상 · ':'')+constellation.ability.description;
        state.markers.push({id:randomUUID(),constellationId:constellation.id,level:p.avatar.level,at:now,note:note.slice(0,120),targetName:target?.nickname||''});
        note='선생님 확인 요청을 남겼어요. 효과·보상은 선생님 확인 후 적용해요.';
      }
      state.usedWeek=week;
      whisper(room,p,constellation.name+' 능력을 사용했어요.'+(roll?' 주사위 '+roll+'.':'')+(note?' '+note:''));
      roster(room);
      return {week,roll,rolls,reward,note,pending:state.pending,starShards:p.starShards,
        ...(target?{targetNickname:target.nickname}:{} )};
    });
    action('ability:choose-item',data=>{
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 별자리 능력을 사용할 수 있어요.');
      const {room,player:p}=s,state=p.abilityState,pending=state?.pending;
      ensure(p.avatar.constellationId==='corvus'&&['dice-item','value-item'].includes(pending?.mode)&&pending.week===weekStart(clock()),'진행 중인 까마귀자리 아이템 생성이 없어요.');
      const item=itemOf(data.itemId);
      ensure(item&&item.level<=pending.maxLevel,'주사위 눈으로 만들 수 있는 Lv 아이템을 골라주세요.');
      if(pending.mode==='value-item'){
        ensure(item.price<=pending.budget,'남은 제작 가치보다 비싼 아이템이에요.');
        ensure(!pending.selected.includes(item.id),'서로 다른 종류의 아이템을 골라주세요.');
      }
      const owned=p.inventory.find(entry=>entry.id===item.id);
      if(owned)ensure(owned.quantity<SHOP.maxStack,'그 아이템을 더 담을 수 없어요.');
      else ensure(p.inventory.length<SHOP.maxKinds,'가방이 가득 찼어요.');
      if(owned)owned.quantity++;else p.inventory.push({id:item.id,quantity:1});
      if(pending.mode==='value-item'){
        pending.budget-=item.price;pending.picks--;pending.selected.push(item.id);
        if(!pending.picks||!SHOP.items.some(value=>value.level<=pending.maxLevel&&value.price<=pending.budget&&!pending.selected.includes(value.id)))state.pending=null;
      }else state.pending=null;
      whisper(room,p,item.name+' 1개를 만들었어요.');roster(room);
      return {itemName:item.name,inventory:[...p.inventory]};
    });
    action('ability:retry',()=>{
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 별자리 능력을 사용할 수 있어요.');
      const {room,player:p}=s,state=p.abilityState,week=weekStart(clock());
      ensure(p.avatar.constellationId==='libra'&&state?.pending?.mode==='dice-retry'&&state.pending.week===week&&state.usedWeek===week,'다시 던질 수 있는 천칭자리 능력이 없어요.');
      ensure(p.starShards>=2,'다시 도전하려면 별 파편 2개가 필요해요.');
      ensure(p.starShards-2+5<=SHARDS.max,'별 파편을 더 담을 수 없어요.');
      const rolls=[abilityDie(),abilityDie()],reward=Math.abs(rolls[0]-rolls[1]);
      p.starShards+=reward-2;if(reward)state.pending=null;
      const note='별 2개 사용 · 주사위 '+rolls.join(' · ')+' → 차이 '+reward+'개';
      whisper(room,p,note);roster(room);return {roll:rolls[0],rolls,reward,note,pending:state.pending,starShards:p.starShards};
    });
    action('ability:complete',data=>{
      const {room,player,pillar}=templeAccess(data);
      ensure(player.role==='teacher'&&pillar.service==='effects','선생님만 별자리 능력 처리를 완료할 수 있어요.');
      const target=typeof data.targetId==='string'?room.players.get(data.targetId):null;
      const marker=target?.abilityState?.markers?.find(entry=>entry.id===data.abilityMarkerId);
      ensure(marker,'처리할 별자리 능력 기록을 찾지 못했어요.');
      if(marker.constellationId==='libra'&&(marker.level||2)===2){
        ensure(Number.isInteger(data.xpAmount)&&data.xpAmount>=0&&data.xpAmount<=2,'천칭자리 경험치는 0~2 중에서 선택해주세요.');
        target.avatar=gainExperience(target.avatar,data.xpAmount);
        whisper(room,target,'선생님이 천칭자리 능력 경험치 '+data.xpAmount+'을 확인했어요.');
      }else ensure(data.xpAmount===undefined,'이 능력에는 경험치를 지급할 수 없어요.');
      target.abilityState.markers=target.abilityState.markers.filter(entry=>entry.id!==marker.id);
      roster(room);return {};
    });
    action('item:discard',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player}=s,item=itemOf(data.itemId);
      ensure(item,'그런 물건은 없어요.');
      const owned=player.inventory.find(i=>i.id===item.id);ensure(owned&&owned.quantity>0,'가방에 그 물건이 없어요.');
      // 확인창에서 선택한 한 개만 버립니다. 타인의 id/수량은 입력받지 않습니다.
      owned.quantity--;if(!owned.quantity)player.inventory=player.inventory.filter(i=>i.id!==item.id);
      whisper(room,player,item.name+' 1개를 버렸어요.');roster(room);return {};
    });
    action('item:use',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      const item=itemOf(data.itemId);
      ensure(item,'그런 물건은 없어요.');
      const owned=p.inventory.find(i=>i.id===item.id);
      ensure(owned,'가방에 그 물건이 없어요.');
      ensure(levelOf(p)>=item.level,'캐릭터의 lv보다 높은 아이템으로 사용할 수 없습니다');
      const now=clock();
      ensure(!hasCardStatus(p,'little-sun-card',now)||item.mode==='moon','자외선 상태라 오늘 자정까지 아이템을 사용할 수 없어요. 꼬마 달은 사용할 수 있어요.');
      ensure(!activeItemBlocks(p,now).length,'별자리 능력 때문에 지금은 아이템을 사용할 수 없어요.');
      ensure(item.mode!=='draw','달토끼 카드는 뽑기 카드 화면에서 사용해주세요.');
      ensure(typeof data.targetId==='string','그 친구는 지금 없어요.');
      const target=room.players.get(data.targetId);
      ensure(target && target.connected,'그 친구는 지금 없어요.');
      ensure(item.targets!=='self' || target.id===p.id,'이 물건은 나에게만 쓸 수 있어요.');
      ensure(item.targets!=='other' || target.id!==p.id,'이 물건은 다른 친구에게만 쓸 수 있어요.');
      const second=item.targets==='pair'&&typeof data.secondTargetId==='string'?room.players.get(data.secondTargetId):null;
      if(item.targets==='pair')ensure(second&&second.connected&&second.id!==target.id&&second.role==='student'&&target.role==='student','서로 다른 학생 친구 2명을 골라주세요.');
      const targets=second?[target,second]:[target];
      for(const recipient of targets){
        ensure(levelOf(p)>=levelOf(recipient),'나보다 레벨이 높은 친구에게는 쓸 수 없어요.');
        ensure(!hasCardStatus(recipient,'little-moon-card',now)||item.mode==='moon','꼬마 달 보호 중인 친구는 다른 카드 효과를 받지 않아요.');
      }
      if(item.mode==='moon')ensure(!p.avatar.blackStar,'검은별 상태에서는 꼬마 달을 사용할 수 없어요.');
      if(item.mode==='uv')ensure(target.role==='student','학생 친구에게만 자외선을 적용할 수 있어요.');
      let meteorPlanet=null;
      if(item.mode==='meteor'){
        ensure(p.role==='student'&&target.id===p.id,'운석 파편은 본인이 받은 경고에만 쓸 수 있어요.');
        meteorPlanet=typeof data.planetId==='string'?room.planets.get(data.planetId):null;
        ensure(meteorPlanet&&meteorPlanet.id!==p.avatar.departmentId,'다른 부서행성을 골라주세요.');
        ensure(warningCount(meteorPlanet,p.id)>0,'그 부서에서 받은 활성 경고가 없어요.');
      }
      if(item.mode)for(const recipient of targets){
        const remaining=activeCardMarkers(recipient,now).filter(marker=>!(item.mode==='moon'&&marker.itemId==='little-sun-card')&&
          !(['moon','uv'].includes(item.mode)&&marker.itemId===item.id));
        ensure(remaining.length<MAX_CARD_MARKERS,'사용 중인 카드 기록이 가득 찼어요. 선생님께 알려주세요.');
      }
      ensure(now-p.lastItemUseAt>=ITEM_USE.cooldownMs,'조금 천천히 써요.');
      // 소비: 수량 1 소모, 0이 되면 가방에서 완전히 지웁니다.
      owned.quantity-=1;
      if(owned.quantity<=0) p.inventory=p.inventory.filter(i=>i.id!==item.id);
      p.lastItemUseAt=now;
      if(item.mode){
        if(item.mode==='meteor'){
          const cleared=clearWarningsFromPlanet(room,meteorPlanet,p);
          whisper(room,p,meteorPlanet.name+'에서 받은 경고 '+cleared.cleared+'건이 해제됐어요.'+(cleared.released?' 검은별 상태도 풀렸어요.':''));
        }
        for(const recipient of targets){
          recipient.cardMarkers=activeCardMarkers(recipient,now).filter(marker=>!(item.mode==='moon'&&marker.itemId==='little-sun-card')&&
            !(['moon','uv'].includes(item.mode)&&marker.itemId===item.id));
          addCardMarker(recipient,item,p,['moon','uv'].includes(item.mode)?nextKoreaMidnight(now):null,
            second?'자리 맞교환: '+(recipient.id===target.id?second.nickname:target.nickname):'');
        }
      }else{
        // 기존 상점 아이템은 정해진 시간 동안 외형 효과를 표시합니다.
        const until=now+item.effect.durationMs;
        const existingEffect=target.effects.find(e=>e.itemId===item.id);
        if(existingEffect){
          existingEffect.until=until;existingEffect.fromId=p.id;existingEffect.fromNickname=p.nickname;
        }else{
          target.effects.push({itemId:item.id,icon:item.effect.icon,label:item.effect.label,style:item.effect.style,
            until,fromId:p.id,fromNickname:p.nickname,secret:item.secret});
          if(target.effects.length>ITEM_USE.maxEffects){
            let oldest=0;
            for(let i=1;i<target.effects.length-1;i++) if(target.effects[i].until<target.effects[oldest].until) oldest=i;
            target.effects.splice(oldest,1);
          }
        }
      }
      room.itemLog.push({id:randomUUID(),at:now,userId:p.id,userNickname:p.nickname,targetId:target.id,
        targetNickname:second?target.nickname+' · '+second.nickname:target.nickname,itemId:item.id,itemName:item.name,secret:item.secret});
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
          : actorPhrase+' '+(second?target.nickname+'·'+second.nickname:target.nickname)+' 친구에게 '+item.name+eul(item.name)+' 썼어요.');
        const text=actorPhrase+' '+item.name+eul(item.name)+' 썼어요.';
        for(const recipient of room.players.values())if(recipient.connected&&recipient.mapId===PLAZA_ID){const sock=io.sockets.sockets.get(recipient.socketId);if(sock)deliver(()=>sock.emit('item:notice',{text}));}
      }
      roster(room);
      return {inventory:[...p.inventory],effects:playerEffectsView(target,p.role==='teacher',now)};
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
      // 거절당한 상대에게 바로 다시 제안하며 조르는 것을 막습니다(TRADE.declineBlockMs 동안).
      const blockedUntil=p.tradeBlocks?.get(target.id)||0;
      ensure(blockedUntil<=Date.now(),'그 친구가 거절했어요. '+Math.ceil(TRADE.declineBlockMs/60_000)+'분 뒤에 다시 제안할 수 있어요.');
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
        if(proposer){
          if(!proposer.tradeBlocks) proposer.tradeBlocks=new Map();
          proposer.tradeBlocks.set(p.id,Date.now()+TRADE.declineBlockMs);
        }
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
        // 거래 실패라는 응답과 별개로 취소·안내·교사 기록은 확정해 저장해야 합니다.
        const error=new GameError(message);error.commitOnError=true;throw error;
      };
      if(!from || !to || !hasAssets(from,trade.give) || !hasAssets(to,trade.want))
        reject('가진 것이 바뀌어서 거래할 수 없어요.');
      if(from.starShards-trade.give.shards+trade.want.shards>SHARDS.max
        || to.starShards-trade.want.shards+trade.give.shards>SHARDS.max)
        reject('별 파편이 넘쳐서 거래할 수 없어요.');
      // 가방 한도(종류 SHOP.maxKinds=20칸·한 종류 SHOP.maxStack=99개)를 넘기지 않는지 미리 계산으로 확인한 뒤에만 실제로 옮깁니다.
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
      if(p.role==='student'&&!studentOpen())return;
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
      // 21시에 토큰도 회수합니다. 열린 브라우저나 재접속으로 시간을 우회할 수 없습니다.
      if(!studentOpen()&&[...room.players.values()].some(p=>p.role==='student'&&(p.connected||p.token))&&now>=(room.cleanupRetryAt||0)){
        try {transaction(()=>{
          for(const p of room.players.values())if(p.role==='student'&&(p.connected||p.token)){
            const sock=io.sockets.sockets.get(p.socketId),dept=p.avatar.departmentId;
            store.remove(room,p);cancelTradesFor(room,p.id,p.nickname);
            if(!persistent)afterMemberRemoved(room,p.id,dept);
            if(sock){sock.data.session=null;deliver(()=>{sock.leave(room.code);sock.emit('room:closed',{message:STUDENT_HOURS_MESSAGE});});}
            changed=true;
          }
          if(changed)roster(room);
        });}catch(error){const restored=store.rooms.get(room.code);if(restored)restored.cleanupRetryAt=now+5000;console.error('이용 시간 종료 저장 실패:',error.message);continue;}
      }
      const expired=now>=(room.cleanupRetryAt||0)&&[...room.players.values()].some(p=>!p.connected && p.expiresAt!==null && p.expiresAt<=now);
      try { if(expired)transaction(()=>{for(const p of room.players.values()){
        if(!p.connected && p.expiresAt!==null && p.expiresAt<=now){
          if(p.role==='teacher'&&!room.unattended){roomClosed(room);break;}
          const planetId=p.avatar.departmentId;
          store.remove(room,p);changed=true;
          cancelTradesFor(room,p.id,p.nickname);
          if(!persistent)afterMemberRemoved(room,p.id,planetId);
        }
      }}); }catch(error){
        const restored=store.rooms.get(room.code);if(restored)restored.cleanupRetryAt=now+5000;
        console.error('수업 정리 실패:',error.message);continue;
      }
      if(!store.rooms.has(room.code)){previous.delete(room.code);continue;}
      if(changed)roster(room);
      advance(room,now);
      for(const p of recoverDefeated(room,clock())){
        io.to(p.socketId).emit('combat:recovered',{message:'체력과 마나를 회복했어요. 다시 출발해요!'});roster(room);
      }
      for(const hit of moveMonsters(room,clock())){
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===hit.mapId){
          io.to(viewer.socketId).emit('combat:monster-hit',hit);
          io.to(viewer.socketId).emit('combat:vitals',{playerId:hit.targetId,vitals:hit.vitals});
        }
      }
      let dodgeSaveFailed=false;
      for(const update of advanceDodgeRuns(room)){
        const player=room.players.get(update.playerId);if(!player?.connected)continue;
        if(update.finished){
          if(now<(room.dodgeSaveRetryAt||0))continue;
          try{transaction(()=>{
            const result=completeDodgeRun(room,player,update.state.runId);
            deliver(()=>io.to(player.socketId).emit('dodge:state',{...update,result}));
            deliver(()=>io.to(room.code).emit('dodge:ranking',{ranking:result.ranking}));
          });}catch(error){
            const restored=store.rooms.get(room.code);if(restored)restored.dodgeSaveRetryAt=now+5000;
            io.to(player.socketId).emit('dodge:state',{...update,error:error.message});
            console.error('별 피하기 기록 저장 실패:',error.message);dodgeSaveFailed=true;break;
          }
        }else io.to(player.socketId).volatile.emit('dodge:state',update);
      }
      // 롤백은 room 객체도 교체하므로 실패 전 참조로 아래 작업을 계속하지 않습니다.
      if(dodgeSaveFailed)continue;
      // 1초에 한 번(50ms tick 20회) 만료된 아이템 효과를 지웁니다. 하나라도 지웠으면 스냅샷을 다시 보냅니다.
      if(step%20===0){
        const abilityNow=clock();
        const abilityDue=[...room.players.values()].some(p=>(p.abilityState?.blocks||[]).some(block=>
          block.until<=abilityNow&&(!block.reward||p.starShards+block.reward<=SHARDS.max)));
        if(abilityDue){
          try{transaction(()=>{let changed=false;for(const p of room.players.values())changed=settleItemBlocks(p,abilityNow)||changed;if(changed)roster(room);});}
          catch(error){console.error('별자리 능력 만료 저장 실패:',error.message);continue;}
        }
        // 열린 랭킹 창도 한국 시간 월요일 0시를 지나면 즉시 비웁니다.
        if(now>=(room.rankingRetryAt||0)&&['starRanking','dodgeRanking'].some(key=>currentWeekRecords(room[key]||[]).length!==(room[key]||[]).length)){
          try{transaction(()=>{
            room.starRanking=currentWeekRecords(room.starRanking||[]);room.dodgeRanking=currentWeekRecords(room.dodgeRanking||[]);
            deliver(()=>io.to(room.code).emit('stars:ranking',{ranking:starRanking(room)}));
            deliver(()=>io.to(room.code).emit('dodge:ranking',{ranking:dodgeRanking(room)}));
          });}catch(error){const restored=store.rooms.get(room.code);if(restored)restored.rankingRetryAt=now+5000;console.error('주간 순위 초기화 저장 실패:',error.message);continue;}
        }
        let effectsChanged=false;
        for(const p of room.players.values()){
          const kept=p.effects.filter(e=>e.until>now);
          if(kept.length!==p.effects.length){p.effects=kept;effectsChanged=true;}
          const active=activeCardMarkers(p,now);
          if(active.length!==(p.cardMarkers||[]).length){p.cardMarkers=active;effectsChanged=true;}
        }
        if(effectsChanged) roster(room);
      }
      if(step%2===0){
        const before=previous.get(room.code)||new Map(),next=new Map(),positions=[];
        for(const p of room.players.values()){
          if(p.away)continue;
          const point=[p.id,Math.round(p.x*10)/10,Math.round(p.y*10)/10];
          next.set(p.id,point);
          const old=before.get(p.id);
          if(step%40===0 || !old || old[1]!==point[1]||old[2]!==point[2]) positions.push(point);
        }
        // 아바타 좌표와 몬스터 좌표를 한 번에 보냅니다. 두 volatile 이벤트를 연달아
        // 전송하면 이동 중 첫 패킷 뒤의 몬스터 패킷이 버려질 수 있습니다.
        // 몬스터는 같은 교실 안에서 공유하되 현재 맵의 그림만 클라이언트가 표시합니다.
        io.to(room.code).volatile.emit('world:positions',{positions,monsters:monsterViews(room)});
        previous.set(room.code,next);
      }
    }
    for(const code of previous.keys())if(!store.rooms.has(code))previous.delete(code);
    for(const [ip,b] of authAttempts)if(now-b.at>60_000)authAttempts.delete(ip);
    step++;
  },RULES.tickMs);
  return {app,http,io,store,
    setPublicOrigin(value){const url=new URL(value);if(url.protocol!=='https:'||url.origin!==value)throw new Error('공개 주소는 HTTPS origin이어야 합니다.');publicOrigin=value;},
    listen:(port=0,host='127.0.0.1')=>new Promise((resolve,reject)=>{
      http.once('error',reject);http.listen(port,host,()=>{http.off('error',reject);resolve(http.address());});
    }),
    close:async()=>{
      clearInterval(timer);
      let saveError;
      try {if(persistent)for(const room of [...store.rooms.values()])transaction(()=>roomClosed(room));}
      catch(error){saveError=error;}
      const closing=io.close();
      for(const connection of connections)connection.destroy();
      try {await closing;}finally{if(persistent)store.close();}
      if(saveError)throw saveError;
    }
  };
}
