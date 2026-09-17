import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import {validateTemple} from './temple.js';
import {validateWork} from './department-work.js';
import {validateWarnings,validateBlackStar} from './warnings.js';
import {validateTasks} from './tasks.js';
import {validateInteriorDecor} from './interior-decor.js';
import { RoomStore, ensure, GameError, nickname } from './rooms.js';
import { ClassFileStore } from './store.js';
import { RULES, PLAZA_ID, BLACK_HOLE_ID, itemOf, PROGRESSION } from '../shared/config.js';
import { spawnPosition,spawnInside } from './world.js';
import {validateStarRanking} from './star-game.js';
import {validateDodgeRanking} from './dodge-game.js';

// 작은 교실용 파일 저장. 위치·접속 토큰은 제외하고, 학생의 고정 id와 소유물만 보존합니다.
export const PIN_RULES = { attempts:5, lockMs:60_000 };
export function pinHash(pin) {
  ensure(typeof pin==='string' && /^\d{4}$/.test(pin),'비밀번호는 숫자 4자리로 입력해주세요.');
  const salt=randomBytes(16).toString('hex');
  return {salt,hash:scryptSync(pin,salt,32).toString('hex'),failures:0,lockedUntil:0};
}
export function checkPin(player,pin) {
  ensure(typeof pin==='string' && /^\d{4}$/.test(pin),'비밀번호는 숫자 4자리로 입력해주세요.');
  const auth=player.pin,now=Date.now();
  ensure(auth.lockedUntil<=now,'비밀번호를 여러 번 틀렸어요. 1분 후 다시 시도해주세요.');
  const valid=timingSafeEqual(Buffer.from(auth.hash,'hex'),scryptSync(pin,auth.salt,32));
  if(!valid){
    auth.failures++;
    if(auth.failures>=PIN_RULES.attempts){auth.lockedUntil=now+PIN_RULES.lockMs;auth.failures=0;}
    // 실패 횟수도 저장하여 연결이나 서버를 다시 켜서 잠금을 피하지 못하게 합니다.
    const error=new GameError('비밀번호가 맞지 않아요. 잊었다면 선생님께 알려주세요.');
    error.commitOnError=true;throw error;
  }
  auth.failures=0;auth.lockedUntil=0;
}
function offline(p) {
  Object.assign(p,{connected:false,socketId:null,token:null,expiresAt:null,away:true,
    x:0,y:0,mapId:PLAZA_ID,input:{x:0,y:0,at:0},effects:[],lastChatAt:0,lastItemUseAt:0});
  return p;
}
export function toRecord(room) {
  return {schemaVersion:1,code:room.code,title:room.title,createdAt:room.createdAt,
    temple:structuredClone(room.temple),
    starRanking:structuredClone(room.starRanking||[]),
    dodgeRanking:structuredClone(room.dodgeRanking||[]),
    allowedNames:[...room.allowedNames],chat:structuredClone(room.chat),
    summonCooldowns:[...(room.summonCooldowns||[])].filter(([,until])=>until>Date.now()),
    planets:[...room.planets.values()].map(p=>({...p,rename:p.rename?{...p.rename,votes:[...p.rename.votes]}:null})),
    proposals:[...room.proposals.values()],itemLog:room.itemLog,tradeLog:room.tradeLog,
    students:[...room.players.values()].filter(p=>p.role==='student').map(p=>({
      id:p.id,nickname:p.nickname,avatar:p.avatar,inventory:p.inventory,starShards:p.starShards,
      muted:p.muted,notes:p.notes,tasks:p.tasks||[],pin:p.pin
    }))};
}
// 읽을 수 없는 파일은 조용히 초기화하지 않습니다. 관리자가 원본/백업을 확인하도록 시작을 중단합니다.
export function fromRecord(r) {
  const bad=()=>{throw new Error('교실 저장 데이터가 올바르지 않습니다: '+r.code);};
  if(!Array.isArray(r.allowedNames)||r.allowedNames.length<1||r.allowedNames.length>29 ||
    !Array.isArray(r.students)||r.students.length>29||!Array.isArray(r.planets)||!Array.isArray(r.proposals)||
    !Array.isArray(r.itemLog)||!Array.isArray(r.tradeLog)||!Array.isArray(r.chat?.history)||
    typeof r.chat.enabled!=='boolean'||!Number.isFinite(r.createdAt))bad();
  const allowedNames=new Set(r.allowedNames.map(nickname));
  if(allowedNames.size!==r.allowedNames.length||allowedNames.has('선생님'))bad();
  const room={code:r.code,title:nickname(r.title),createdAt:r.createdAt,allowedNames,players:new Map(),
    temple:validateTemple(r.temple),
    starRanking:validateStarRanking(r.starRanking),
    dodgeRanking:validateDodgeRanking(r.dodgeRanking),
    mapId:PLAZA_ID,chat:structuredClone(r.chat),planets:new Map(),proposals:new Map(),
    itemLog:structuredClone(r.itemLog),tradeLog:structuredClone(r.tradeLog),trades:new Map()};
  for(const pl of r.planets){
    if(typeof pl.id!=='string'||room.planets.has(pl.id)||typeof pl.name!=='string'||
      !Array.isArray(pl.rules)||!Number.isFinite(pl.x)||!Number.isFinite(pl.y)||!Number.isFinite(pl.radius))bad();
    if(pl.rename && !Array.isArray(pl.rename.votes))bad();
    room.planets.set(pl.id,structuredClone({...pl,work:validateWork(pl.work),warnings:validateWarnings(pl.warnings),interiorDecor:validateInteriorDecor(pl.interiorDecor),rename:pl.rename?{...pl.rename,votes:new Map(pl.rename.votes)}:null}));
  }
  const names=new Set();
  for(const p of r.students){
    if(typeof p.id!=='string'||room.players.has(p.id)||!allowedNames.has(p.nickname)||names.has(p.nickname)||
      !Number.isSafeInteger(p.starShards)||p.starShards<0||!Array.isArray(p.inventory)||
      p.inventory.some(i=>!itemOf(i.id)||!Number.isSafeInteger(i.quantity)||i.quantity<1)||
      !Array.isArray(p.notes)||typeof p.muted!=='boolean'||!p.avatar||
      !Number.isInteger(p.avatar.level)||p.avatar.level<1||p.avatar.level>PROGRESSION.maxLevel||
      !Number.isSafeInteger(p.avatar.xp)||p.avatar.xp<0||
      (p.avatar.departmentId && !room.planets.has(p.avatar.departmentId))||
      !/^[a-f0-9]{32}$/.test(p.pin?.salt)||!/^[a-f0-9]{64}$/.test(p.pin?.hash)||
      !Number.isInteger(p.pin.failures)||p.pin.failures<0||!Number.isFinite(p.pin.lockedUntil))bad();
    names.add(p.nickname);
    const avatar=structuredClone(p.avatar);avatar.blackStar=validateBlackStar(avatar.blackStar,new Set(room.planets.keys()));
    const tasks=validateTasks(p.tasks);
    if(tasks.some(task=>!room.temple.assignments.some(assignment=>assignment.id===task.assignmentId)))bad();
    room.players.set(p.id,offline({...structuredClone(p),avatar,tasks,role:'student'}));
  }
  for(const pr of r.proposals){
    if(typeof pr.id!=='string'||room.proposals.has(pr.id)||!room.players.has(pr.playerId))bad();
    room.proposals.set(pr.id,structuredClone(pr));
  }
  if(r.summonCooldowns!==undefined&&(!Array.isArray(r.summonCooldowns)||r.summonCooldowns.some(e=>!Array.isArray(e)||e.length!==2||typeof e[0]!=='string'||!Number.isSafeInteger(e[1]))))bad();
  room.summonCooldowns=new Map((r.summonCooldowns||[]).filter(([,until])=>until>Date.now()));
  room.summons=new Map(); // 답을 기다리는 호출은 다음 수업에 자동 재생하지 않습니다.
  return room;
}

export class PersistentRoomStore extends RoomStore {
  constructor(directory,{unattended=false,teacherManagedAccounts=false}={}) {
    super();this.unattended=unattended;this.teacherManagedAccounts=teacherManagedAccounts;this.files=new ClassFileStore(directory);this.records=new Map();
    try {for(const r of this.files.loadAll()){fromRecord(r);this.records.set(r.code,r);}}
    catch(error){this.files.close();throw error;}
  }
  newCode(){let code;do{code=super.newCode();}while(this.records.has(code));return code;}
  create(data,socketId){
    const s=super.create(data,socketId);s.room.createdAt=Date.now();s.room.unattended=this.unattended;
    if(this.teacherManagedAccounts)s.credentials=[...s.room.allowedNames].map(name=>{
      const pin=String(randomInt(10000)).padStart(4,'0');this.createStudent(s.room,{nickname:name,pin});return {nickname:name,pin};
    });
    return s;
  }
  createStudent(room,data){
    const name=nickname(data.nickname),pin=pinHash(data.pin);
    ensure(name!=='선생님'&&![...room.players.values()].some(p=>p.nickname===name),'이미 있는 이름이에요. 다른 이름을 적어주세요.');
    ensure(room.allowedNames.has(name)||room.allowedNames.size<29,'학생은 최대 29명까지 만들 수 있어요.');
    room.allowedNames.add(name);
    const player=this.add(room,name,'student',null);player.pin=pin;this.remove(room,player);return player;
  }
  open(data,socketId){
    const code=typeof data.code==='string'?data.code.trim().toUpperCase():'';
    const active=this.rooms.get(code);
    if(active&&this.unattended){
      ensure(![...active.players.values()].some(p=>p.role==='teacher'&&p.connected),'이미 열린 교실이에요. 원래 선생님 창에서 계속해주세요.');
      for(const p of active.players.values())if(p.role==='teacher')this.remove(active,p);
      return {room:active,player:this.add(active,'선생님','teacher',socketId)};
    }
    ensure(!active,'이미 열린 교실이에요. 원래 선생님 창에서 계속해주세요.');
    ensure(this.rooms.size<RULES.maxRooms,'지금은 교실이 가득 찼어요.');
    const record=this.records.get(code);ensure(record,'저장된 교실 코드를 확인해주세요.');
    const room=fromRecord(record);room.unattended=this.unattended;this.rooms.set(code,room);
    return {room,player:this.add(room,'선생님','teacher',socketId)};
  }
  list(){return [...this.records.values()].map(r=>({code:r.code,title:r.title,open:this.rooms.has(r.code)}));}
  snapshot(room,viewer){return {...super.snapshot(room,viewer),persistent:true,unattended:!!room.unattended,managedAccounts:this.teacherManagedAccounts};}
  join(data,socketId){
    const code=typeof data.code==='string'?data.code.trim().toUpperCase():'';
    let room=this.rooms.get(code);
    if(!room&&this.unattended&&this.records.has(code)){
      ensure(this.rooms.size<RULES.maxRooms,'지금은 교실이 가득 찼어요.');
      room=fromRecord(this.records.get(code));room.unattended=true;this.rooms.set(code,room);
    }
    ensure(room,'선생님이 교실을 열었는지와 교실 코드를 확인해주세요.');
    ensure(room.unattended||[...room.players.values()].some(p=>p.role==='teacher'&&p.connected),'선생님이 다시 연결할 때까지 기다려주세요.');
    const name=nickname(data.nickname);ensure(room.allowedNames.has(name),'선생님이 허용한 닉네임이나 번호로 입장해주세요.');
    const p=[...room.players.values()].find(p=>p.nickname===name);
    if(p){
      ensure(!p.connected,'이미 사용 중인 닉네임이에요. 원래 창에서 계속해주세요.');
      checkPin(p,data.pin);
      this.sessions.delete(p.token);
      const mapId=p.avatar.blackStar?BLACK_HOLE_ID:PLAZA_ID;
      Object.assign(p,mapId===BLACK_HOLE_ID?spawnInside(room,mapId):spawnPosition(room),{token:randomBytes(32).toString('hex'),socketId,connected:true,away:false,
        expiresAt:null,mapId,input:{x:0,y:0,at:0}});
      const session={room,player:p};this.sessions.set(p.token,session);return session;
    }
    ensure(!this.teacherManagedAccounts,'선생님이 아직 계정을 만들지 않았어요. 선생님께 알려주세요.');
    const pin=pinHash(data.pin);
    ensure(room.players.size<RULES.maxPlayers,'교실 정원 30명이 모두 찼어요.');
    const player=this.add(room,name,'student',socketId);player.pin=pin;return {room,player};
  }
  remove(room,p){
    this.sessions.delete(p.token);
    if(p.role==='student')offline(p);else room.players.delete(p.id);
  }
  destroy(room){
    this.records.set(room.code,structuredClone(toRecord(room)));
    super.destroy(room);
  }
  // 한 요청은 교실 하나만 바꿉니다. 파일 교체 성공 뒤에만 소켓 응답을 내보냅니다.
  // 실패하면 Map 간 참조까지 함께 복구하여 지급/구매/거래가 메모리에만 반영되지 않게 합니다.
  transact(work){
    const backup=structuredClone({rooms:this.rooms,sessions:this.sessions,records:this.records});
    let result,denial;
    try {
      try {result=work();}catch(e){if(e.commitOnError)denial=e;else throw e;}
      const candidates=new Map(this.records);
      for(const room of this.rooms.values())candidates.set(room.code,toRecord(room));
      const changed=[...candidates].filter(([code,r])=>JSON.stringify(r)!==JSON.stringify(backup.records.get(code)));
      if(changed.length>1)throw new Error('한 번에 여러 교실을 저장할 수 없습니다.');
      for(const [code,r] of changed){this.files.save(r);this.records.set(code,structuredClone(r));}
    }catch(error){Object.assign(this,backup);throw error;}
    if(denial)throw denial;
    return result;
  }
  close(){this.files.close();}
}
