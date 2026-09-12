import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { RULES, PLAZA_ID, CHAT, EXAMPLE_PLANETS, createAvatar } from '../shared/config.js';
import { spawnPosition, addPlanet } from './world.js';
export class GameError extends Error {}
// planet.rename(내부 투표 상태, votes는 Map)을 화면에 보낼 형태로 계산합니다. 현재 방에 없는 멤버의 표는 세지 않습니다.
function renameView(room, planetId, rename) {
  if (!rename) return null;
  const members=[...room.players.values()].filter(p=>p.avatar.departmentId===planetId);
  const memberIds=new Set(members.map(m=>m.id));
  let yes=0,no=0; const votes={};
  for (const [id,agree] of rename.votes) if (memberIds.has(id)) { votes[id]=agree; agree?yes++:no++; }
  const proposer=room.players.get(rename.proposedBy);
  return {id:rename.id,name:rename.name,proposedBy:rename.proposedBy,
    proposedByNickname:proposer?proposer.nickname:'친구',yes,no,needed:Math.floor(members.length/2)+1,votes};
}
export const ensure = (test,message) => { if (!test) throw new GameError(message); };
const letters='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function nickname(value) {
  ensure(typeof value==='string','닉네임을 입력해주세요.');
  const s=value.normalize('NFKC').trim();
  ensure(/^[가-힣a-zA-Z0-9 _-]{1,12}$/.test(s),'닉네임은 한글·영문·숫자 등 1~12자로 입력해주세요.');
  return s;
}
export class RoomStore {
  rooms = new Map();
  sessions = new Map();
  newCode() {
    let code;
    do { code=Array.from({length:6},()=>letters[randomInt(letters.length)]).join(''); } while(this.rooms.has(code));
    return code;
  }
  create(data,socketId) {
    ensure(this.rooms.size<RULES.maxRooms,'지금은 교실이 가득 찼어요. 잠시 후 다시 시도해주세요.');
    const title=nickname(data.title || '우리 우주 교실');
    ensure(Array.isArray(data.allowedNames) && data.allowedNames.length>=1 && data.allowedNames.length<=29,
      '학생 닉네임을 1~29개 입력해주세요.');
    const allowedNames=new Set(data.allowedNames.map(nickname));
    ensure(allowedNames.size===data.allowedNames.length,'허용 닉네임에 같은 이름이 있어요.');
    ensure(!allowedNames.has('선생님'),'선생님은 학생 닉네임으로 사용할 수 없어요.');
    const room={ code:this.newCode(), title, allowedNames, players:new Map(), mapId:PLAZA_ID, chat:{enabled:true,history:[]},
      planets:new Map(), proposals:new Map() };
    this.rooms.set(room.code,room);
    // '예시 행성으로 시작'을 켠 경우에만 예시 4개를 미리 놓습니다. 기본은 행성 없음(아이들이 직접 만듭니다).
    if (data.seedPlanets===true) for (const seed of EXAMPLE_PLANETS) addPlanet(room,{...seed,createdBy:null});
    return {room, player:this.add(room,'선생님','teacher',socketId)};
  }
  join(data,socketId) {
    ensure(typeof data.code==='string','교실 코드를 입력해주세요.');
    const room=this.rooms.get(data.code.trim().toUpperCase());
    ensure(room,'교실을 찾지 못했어요. 코드를 확인해주세요.');
    ensure([...room.players.values()].some(p=>p.role==='teacher' && p.connected),'선생님이 다시 연결할 때까지 기다려주세요.');
    const name=nickname(data.nickname);
    ensure(room.allowedNames.has(name),'선생님이 허용한 닉네임이나 번호로 입장해주세요.');
    ensure(![...room.players.values()].some(p=>p.nickname===name),'이미 사용 중인 닉네임이에요. 재접속 중이라면 원래 창을 사용해주세요.');
    ensure(room.players.size<RULES.maxPlayers,'교실 정원 30명이 모두 찼어요.');
    return {room,player:this.add(room,name,'student',socketId)};
  }
  add(room,name,role,socketId) {
    const token=randomBytes(32).toString('hex');
    const p={ id:randomUUID(), nickname:name, role, ...spawnPosition(room), mapId:PLAZA_ID,
      avatar:createAvatar(), inventory:[], starShards:0, connected:true, socketId,
      expiresAt:null, input:{x:0,y:0,at:0}, muted:false, lastChatAt:0 };
    room.players.set(p.id,p);
    this.sessions.set(token,{room,player:p});
    p.token=token; // private: snapshot() 아래 허용 필드에 포함하지 않습니다.
    return p;
  }
  resume(token,socketId,now=Date.now()) {
    ensure(typeof token==='string' && /^[a-f0-9]{64}$/.test(token),'다시 입장해주세요.');
    const session=this.sessions.get(token);
    ensure(session && this.rooms.has(session.room.code),'교실 연결 시간이 끝났어요. 다시 입장해주세요.');
    ensure(!session.player.connected,'이 접속은 다른 창에서 사용 중이에요.');
    ensure(session.player.expiresAt>now,'재접속 시간이 지났어요. 다시 입장해주세요.');
    Object.assign(session.player,{ connected:true, socketId, expiresAt:null, input:{x:0,y:0,at:0} });
    return session;
  }
  remove(room,p) { this.sessions.delete(p.token); room.players.delete(p.id); }
  destroy(room) {
    for (const p of room.players.values()) this.sessions.delete(p.token);
    this.rooms.delete(room.code);
  }
  snapshot(room) {
    const memberCount=planetId=>[...room.players.values()].filter(p=>p.avatar.departmentId===planetId).length;
    return {code:room.code,title:room.title,mapId:room.mapId,maxPlayers:RULES.maxPlayers,chat:{enabled:room.chat.enabled},
      planets:[...room.planets.values()].map(pl=>({id:pl.id,name:pl.name,description:pl.description,x:pl.x,y:pl.y,
        radius:pl.radius,color:pl.color,rules:[...pl.rules],memberCount:memberCount(pl.id),createdBy:pl.createdBy,
        rename:renameView(room,pl.id,pl.rename)})),
      proposals:[...room.proposals.values()].map(pr=>({id:pr.id,name:pr.name,description:pr.description,x:pr.x,y:pr.y,
        radius:pr.radius,color:pr.color,playerId:pr.playerId,nickname:pr.nickname})),
      players:[...room.players.values()].map(p=>({id:p.id,nickname:p.nickname,role:p.role,x:p.x,y:p.y,
        connected:p.connected,avatar:p.avatar,muted:p.muted,mapId:p.mapId,departmentId:p.avatar.departmentId,
        starShards:p.starShards,inventory:[...p.inventory]}))};
  }
  pushChat(room,{playerId,nickname,role,text,flagged}) {
    const msg={id:randomUUID(),playerId,nickname,role,text,at:Date.now(),flagged};
    room.chat.history.push(msg);
    if(room.chat.history.length>CHAT.historySize) room.chat.history.shift();
    return msg;
  }
}
