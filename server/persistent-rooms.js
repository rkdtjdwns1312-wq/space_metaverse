import {validateJoinRequests} from './planet-membership.js';
import {relocateDepartments} from './plaza-migration.js';
import {validateLv4State} from './lv4-item-effects.js';
import { randomBytes, randomInt } from 'node:crypto';
import {validateTemple} from './temple.js';
import {validateWork} from './department-work.js';
import {validateWarnings,validateBlackStar} from './warnings.js';
import {validateTasks} from './tasks.js';
import {validateMissions} from './missions.js';
import {validateSignalRanking} from './signal-game.js';
import {validateTetrisRanking} from './tetris-game.js';
import {validateInteriorDecor} from './interior-decor.js';
import {validateCardMarkers} from './item-cards.js';
import {validateRabbitDraw,validateRabbitDrawCounts} from './rabbit-draw.js';
import {validateAbilityState} from './constellation-abilities.js';
import { RoomStore, ensure, GameError, nickname } from './rooms.js';
import {pinHash,checkPin} from './pin-auth.js';
export {PIN_RULES,pinHash,checkPin} from './pin-auth.js';
import { ClassFileStore } from './store.js';
import { RULES, PLAZA_ID, BLACK_HOLE_ID, itemOf, PROGRESSION } from '../shared/config.js';
import { spawnPosition,spawnInside } from './world.js';
import {validateStarRanking} from './star-game.js';
import {validateDodgeRanking} from './dodge-game.js';
import {validateMemoryRanking} from './memory-game.js';
import {validateStarCards} from './star-cards.js';
import {validateStarCardText} from './star-card-text.js';
import {validateLv3State} from './lv3-item-effects.js';
import {validateHoldingState} from '../shared/holding-abilities.js';
import {validateLearnedRecipeIds} from './learned-recipes.js';
import {validateExploration,validateExplorationChances} from './exploration.js';
import {equipmentOf,validateEquipmentSlots} from '../shared/equipment.js';

// 작은 교실용 파일 저장. 위치·접속 토큰은 제외하고, 학생의 고정 id와 소유물만 보존합니다.
function offline(p) {
  Object.assign(p,{connected:false,socketId:null,token:null,expiresAt:null,away:true,
    x:0,y:0,mapId:PLAZA_ID,input:{x:0,y:0,at:0},effects:[],lastChatAt:0,lastItemUseAt:0});
  return p;
}
export function toRecord(room) {
  return {schemaVersion:1,code:room.code,title:room.title,createdAt:room.createdAt,
    ...(room.adminCreated?{adminCreated:true}:{}),
    ...(room.teacherAccess?{teacherAccess:structuredClone(room.teacherAccess)}:{}),
    temple:structuredClone(room.temple),exploration:validateExploration(room.exploration),
    starCards:validateStarCards(room.starCards),
    starCardText:validateStarCardText(room.starCardText),
    rabbitDrawCounts:validateRabbitDrawCounts(room.rabbitDrawCounts),
    starRanking:structuredClone(room.starRanking||[]),
    dodgeRanking:structuredClone(room.dodgeRanking||[]),
    memoryRanking:structuredClone(room.memoryRanking||[]),signalRanking:validateSignalRanking(room.signalRanking),tetrisRanking:validateTetrisRanking(room.tetrisRanking),missions:validateMissions(room.missions),
    allowedNames:[...room.allowedNames],chat:structuredClone(room.chat),
    summonCooldowns:[...(room.summonCooldowns||[])].filter(([,until])=>until>Date.now()),
    planets:[...room.planets.values()].map(p=>({...p,rename:p.rename?{...p.rename,votes:[...p.rename.votes]}:null})),
    proposals:[...room.proposals.values()],itemLog:room.itemLog,tradeLog:room.tradeLog,
    students:[...room.players.values()].filter(p=>p.role==='student').map(p=>({
      id:p.id,nickname:p.nickname,avatar:p.avatar,inventory:p.inventory,equipmentSlots:validateEquipmentSlots(p.equipmentSlots),starShards:p.starShards,cosmicEnergy:p.cosmicEnergy??0,explorationChances:validateExplorationChances(p.explorationChances),
      muted:p.muted,notes:p.notes,tasks:p.tasks||[],tutorialCompleted:!!p.tutorialCompleted,tutorialRewardClaimed:!!p.tutorialRewardClaimed,
      starBestMs:p.starBestMs??null,dodgeBestMs:p.dodgeBestMs??null,cardMarkers:p.cardMarkers||[],lv2State:p.lv2State||{galaxyNextAt:[]},
      lv3State:validateLv3State(p.lv3State),lv4State:validateLv4State(p.lv4State),
      holdingState:validateHoldingState(p.holdingState),
      learnedRecipeIds:validateLearnedRecipeIds(p.learnedRecipeIds),
      rabbitDraw:p.rabbitDraw||null,rabbitUsedDay:p.rabbitUsedDay||null,abilityState:p.abilityState,pin:p.pin
    }))};
}
// 읽을 수 없는 파일은 조용히 초기화하지 않습니다. 관리자가 원본/백업을 확인하도록 시작을 중단합니다.
export function fromRecord(r) {
  const bad=()=>{throw new Error('교실 저장 데이터가 올바르지 않습니다: '+r.code);};
  if(!Array.isArray(r.allowedNames)||r.allowedNames.length<(r.adminCreated?0:1)||r.allowedNames.length>29 ||
    !Array.isArray(r.students)||r.students.length>29||!Array.isArray(r.planets)||!Array.isArray(r.proposals)||
    !Array.isArray(r.itemLog)||!Array.isArray(r.tradeLog)||!Array.isArray(r.chat?.history)||
    typeof r.chat.enabled!=='boolean'||!Number.isFinite(r.createdAt))bad();
  if(r.teacherAccess && (typeof r.teacherAccess!=='object'||
    typeof r.teacherAccess.label!=='string'||!r.teacherAccess.label.trim()||r.teacherAccess.label.length>40||
    typeof r.teacherAccess.digest!=='string'||!/^[0-9a-f]{64}$/.test(r.teacherAccess.digest)||
    !Number.isFinite(r.teacherAccess.createdAt)))bad();
  const allowedNames=new Set(r.allowedNames.map(nickname));
  if(allowedNames.size!==r.allowedNames.length||allowedNames.has('선생님'))bad();
  const room={code:r.code,title:nickname(r.title),createdAt:r.createdAt,adminCreated:r.adminCreated===true,allowedNames,players:new Map(),
    teacherAccess:r.teacherAccess?structuredClone(r.teacherAccess):null,
    temple:validateTemple(r.temple),exploration:validateExploration(r.exploration),
    starCards:validateStarCards(r.starCards),
    starCardText:validateStarCardText(r.starCardText),
    rabbitDrawCounts:validateRabbitDrawCounts(r.rabbitDrawCounts),
    starRanking:validateStarRanking(r.starRanking),
    dodgeRanking:validateDodgeRanking(r.dodgeRanking),
    memoryRanking:validateMemoryRanking(r.memoryRanking),signalRanking:validateSignalRanking(r.signalRanking),tetrisRanking:validateTetrisRanking(r.tetrisRanking),missions:validateMissions(r.missions),
    mapId:PLAZA_ID,chat:structuredClone(r.chat),planets:new Map(),proposals:new Map(),
    itemLog:structuredClone(r.itemLog),tradeLog:structuredClone(r.tradeLog),trades:new Map()};
  for(const pl of r.planets){
    if(typeof pl.id!=='string'||room.planets.has(pl.id)||typeof pl.name!=='string'||
      !Array.isArray(pl.rules)||!Number.isFinite(pl.x)||!Number.isFinite(pl.y)||!Number.isFinite(pl.radius))bad();
    if(pl.rename && !Array.isArray(pl.rename.votes))bad();
    room.planets.set(pl.id,structuredClone({...pl,joinRequests:validateJoinRequests(pl.joinRequests),work:validateWork(pl.work),warnings:validateWarnings(pl.warnings),interiorDecor:validateInteriorDecor(pl.interiorDecor),rename:pl.rename?{...pl.rename,votes:new Map(pl.rename.votes)}:null}));
  }
  const names=new Set();
  for(const p of r.students){
    // 이전 저장 파일에 없는 새 재화만 0으로 보완합니다. 잘못된 값은 초기화하지 않습니다.
    const cosmicEnergy=p.cosmicEnergy===undefined?0:p.cosmicEnergy;
    if(typeof p.id!=='string'||room.players.has(p.id)||!allowedNames.has(p.nickname)||names.has(p.nickname)||
      !Number.isSafeInteger(cosmicEnergy)||cosmicEnergy<0||
      !Number.isSafeInteger(p.starShards)||p.starShards<0||!Array.isArray(p.inventory)||
      p.inventory.some(i=>!itemOf(i.id)||!Number.isSafeInteger(i.quantity)||i.quantity<1)||
      !Array.isArray(p.notes)||typeof p.muted!=='boolean'||!p.avatar||
      !Number.isInteger(p.avatar.level)||p.avatar.level<1||p.avatar.level>6||
      !Number.isSafeInteger(p.avatar.xp)||p.avatar.xp<0||
      (p.avatar.departmentId && !room.planets.has(p.avatar.departmentId))||
      !/^[a-f0-9]{32}$/.test(p.pin?.salt)||!/^[a-f0-9]{64}$/.test(p.pin?.hash)||
      !Number.isInteger(p.pin.failures)||p.pin.failures<0||!Number.isFinite(p.pin.lockedUntil))bad();
    names.add(p.nickname);
    const avatar=structuredClone(p.avatar);avatar.blackStar=validateBlackStar(avatar.blackStar,new Set(room.planets.keys()));
    // 이전 버전의 LV6 초월체도 새 최종 단계 LV5로 읽으며 계보·소유물은 그대로 보존합니다.
    if(avatar.level>=PROGRESSION.transcendentLevel){avatar.level=PROGRESSION.transcendentLevel;avatar.form='transcendent';avatar.xp=0;}
    if(p.tutorialCompleted!==undefined&&typeof p.tutorialCompleted!=='boolean')bad();
    if(p.tutorialRewardClaimed!==undefined&&typeof p.tutorialRewardClaimed!=='boolean')bad();
    if([p.starBestMs,p.dodgeBestMs].some(value=>value!==undefined&&value!==null&&(!Number.isSafeInteger(value)||value<1)))bad();
    const tasks=validateTasks(p.tasks);
    if(tasks.some(task=>!room.temple.assignments.some(assignment=>assignment.id===task.assignmentId)))bad();
    const savedMarkers=validateCardMarkers(p.cardMarkers),rabbitDraw=validateRabbitDraw(p.rabbitDraw);
    const lv2State=p.lv2State||{galaxyNextAt:[]};
    if(!Array.isArray(lv2State.galaxyNextAt)||lv2State.galaxyNextAt.length>2||lv2State.galaxyNextAt.some(n=>!Number.isSafeInteger(n)||n<0))bad();
    if(p.rabbitUsedDay!==undefined&&p.rabbitUsedDay!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(p.rabbitUsedDay))bad();
    if(rabbitDraw?.markerId&&!savedMarkers.some(marker=>marker.id===rabbitDraw.markerId&&marker.itemId==='moon-rabbit-card'))bad();
    // 옛 달토끼 효과 기록만 정리하고 진행 중인 뽑기·보상 순서는 보존합니다.
    const cardMarkers=savedMarkers.filter(marker=>marker.itemId!=='moon-rabbit-card');
    if(rabbitDraw)rabbitDraw.markerId=null;
    const equipmentSlots=validateEquipmentSlots(p.equipmentSlots);
    if(equipmentSlots.some(id=>id&&equipmentOf(id).level>avatar.level))bad();
    room.players.set(p.id,offline({...structuredClone(p),tutorialCompleted:p.tutorialCompleted??false,tutorialRewardClaimed:p.tutorialRewardClaimed??!!p.tutorialCompleted,
      starBestMs:p.starBestMs??null,dodgeBestMs:p.dodgeBestMs??null,equipmentSlots,learnedRecipeIds:validateLearnedRecipeIds(p.learnedRecipeIds),cosmicEnergy,explorationChances:validateExplorationChances(p.explorationChances),avatar,tasks,cardMarkers,rabbitDraw,rabbitUsedDay:p.rabbitUsedDay||null,
      lv2State:structuredClone(lv2State),lv3State:validateLv3State(p.lv3State),lv4State:validateLv4State(p.lv4State),holdingState:validateHoldingState(p.holdingState),abilityState:validateAbilityState(p.abilityState),role:'student'}));
  }
  for(const pr of r.proposals){
    if(typeof pr.id!=='string'||room.proposals.has(pr.id)||!room.players.has(pr.playerId))bad();
    room.proposals.set(pr.id,structuredClone(pr));
  }
  if(r.summonCooldowns!==undefined&&(!Array.isArray(r.summonCooldowns)||r.summonCooldowns.some(e=>!Array.isArray(e)||e.length!==2||typeof e[0]!=='string'||!Number.isSafeInteger(e[1]))))bad();
  room.summonCooldowns=new Map((r.summonCooldowns||[]).filter(([,until])=>until>Date.now()));
  room.summons=new Map(); // 답을 기다리는 호출은 다음 수업에 자동 재생하지 않습니다.
  relocateDepartments(room);
  return room;
}

export class PersistentRoomStore extends RoomStore {
  constructor(directory,{unattended=false,teacherManagedAccounts=false,maxActiveRooms=RULES.maxRooms}={}) {
    super({maxActiveRooms});this.unattended=unattended;this.teacherManagedAccounts=teacherManagedAccounts;this.files=new ClassFileStore(directory);this.records=new Map();
    try {for(const r of this.files.loadAll()){fromRecord(r);this.records.set(r.code,r);}}
    catch(error){this.files.close();throw error;}
  }
  newCode(){let code;do{code=super.newCode();}while(this.records.has(code));return code;}
  create(data,socketId,options){
    let accounts=null;
    if(data.studentAccounts!==undefined){
      ensure(this.teacherManagedAccounts,'학생 계정 동시 생성은 저장 교실에서만 가능해요.');
      ensure(Array.isArray(data.studentAccounts)&&data.studentAccounts.length>=1&&data.studentAccounts.length<=29,
        '학생 수는 1~29명으로 정해주세요.');
      accounts=data.studentAccounts.map(entry=>{
        ensure(entry&&typeof entry==='object'&&!Array.isArray(entry),'학생 이름과 비밀번호를 확인해주세요.');
        const name=nickname(entry.nickname);
        ensure(typeof entry.pin==='string'&&/^\d{4}$/.test(entry.pin),'학생 비밀번호는 숫자 4자리로 입력해주세요.');
        return {nickname:name,pin:entry.pin};
      });
    }
    const s=super.create(accounts?{...data,allowedNames:accounts.map(account=>account.nickname)}:data,socketId,options);
    s.room.createdAt=Date.now();s.room.unattended=this.unattended;
    if(this.teacherManagedAccounts)s.credentials=(accounts||[...s.room.allowedNames].map(name=>({nickname:name,pin:String(randomInt(10000)).padStart(4,'0')}))).map(account=>{
      this.createStudent(s.room,account);return account;
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
    if(active){
      ensure(![...active.players.values()].some(p=>p.role==='teacher'&&p.connected),'이미 열린 교실이에요. 원래 선생님 창에서 계속해주세요.');
      for(const p of active.players.values())if(p.role==='teacher')this.remove(active,p);
      return {room:active,player:this.add(active,'선생님','teacher',socketId)};
    }
    ensure(this.rooms.size<this.maxActiveRooms,'지금은 교실이 가득 찼어요.');
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
      ensure(this.rooms.size<this.maxActiveRooms,'지금은 교실이 가득 찼어요.');
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
      Object.assign(p,mapId===BLACK_HOLE_ID?spawnInside(room,mapId,p):spawnPosition(room),{token:randomBytes(32).toString('hex'),socketId,connected:true,away:false,
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
  deleteClass(code){
    const room=this.rooms.get(code);
    if(room)super.destroy(room);
    this.records.delete(code);
  }
  // 한 요청은 교실 하나만 바꿉니다. 파일 교체 성공 뒤에만 소켓 응답을 내보냅니다.
  // 실패하면 Map 간 참조까지 함께 복구하여 지급/구매/거래가 메모리에만 반영되지 않게 합니다.
  transact(work){
    const originalPlayers=new Map([...this.rooms].map(([code,room])=>[code,new Map(room.players)]));
    const backup=structuredClone({rooms:this.rooms,sessions:this.sessions,records:this.records});
    let result,denial;
    try {
      try {result=work();}catch(e){if(e.commitOnError)denial=e;else throw e;}
      const candidates=new Map(this.records);
      for(const room of this.rooms.values())candidates.set(room.code,toRecord(room));
      const changed=[...new Set([...backup.records.keys(),...candidates.keys()])]
        .filter(code=>JSON.stringify(candidates.get(code))!==JSON.stringify(backup.records.get(code)))
        .map(code=>[code,candidates.get(code)]);
      if(changed.length>1)throw new Error('한 번에 여러 교실을 저장할 수 없습니다.');
      for(const [code,r] of changed){
        if(r===undefined)this.files.remove(code);
        else{this.files.save(r);this.records.set(code,structuredClone(r));}
      }
    }catch(error){
      // 실행 중인 오락기와 공격 쿨타임은 플레이어 객체를 참조합니다. 복제된
      // 방 상태를 복구하되 기존 플레이어 객체의 정체성은 유지합니다.
      for(const [code,room] of backup.rooms){
        const originals=originalPlayers.get(code);
        for(const [id,saved] of room.players){
          const player=originals?.get(id);if(!player)continue;
          for(const key of Object.keys(player))if(!Object.hasOwn(saved,key))delete player[key];
          Object.assign(player,saved);room.players.set(id,player);
        }
      }
      for(const session of backup.sessions.values()){
        const room=backup.rooms.get(session.room.code);
        if(room){session.room=room;session.player=room.players.get(session.player.id)||session.player;}
      }
      Object.assign(this,backup);throw error;
    }
    if(denial)throw denial;
    return result;
  }
  close(){this.files.close();}
}
