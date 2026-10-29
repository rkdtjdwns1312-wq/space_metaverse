import {validateHuntingTime} from './hunting-time.js';
import {validateCozyActivities} from './cozy-activities.js';
import {normalizePlanetDesign} from '../shared/planet-design.js';
const savedPlanetDesign=value=>{if(value==null)return null;const result=normalizePlanetDesign(value);if(!result)throw Error('행성 그림 저장 데이터가 올바르지 않습니다.');return result;};
import {validateStatGrowth} from './stat-growth.js';
import {validateJoinRequests} from './planet-membership.js';
import {constellationOf,CONSTELLATION_LIMIT} from '../shared/constellations.js';
import {MASTER_BASE} from '../shared/master-account.js';
import {recordSerenaLevel} from './serena-progress.js';
import {relocateDepartments} from './plaza-migration.js';
import {validateLv4State} from './lv4-item-effects.js';
import { randomBytes, randomInt } from 'node:crypto';
import {validateTemple} from './temple.js';
import {validateWork} from './department-work.js';
import {validateWarnings,validateBlackStar} from './warnings.js';
import {validateTasks} from './tasks.js';
import {validateMissions,validMissionTimestamp} from './missions.js';
import {validateDailyMissions,validateDailyMissionHistory} from './daily-missions.js';
import {validateJourney} from './tutorial-journey.js';
import {validateCultureReading,validateHistoryReading,validateCultureRecommendations,validateCultureRecommendationVotes} from './culture-library.js';
import {validateScienceReading} from './science-library.js';
import {validateLearningRewards} from './learning-rewards.js';
import {validateSignalRanking} from './signal-game.js';
import {validateTetrisRanking} from './tetris-game.js';
import {validateOmokWinRecords} from './hall-of-fame.js';
import {validateInteriorDecor,validateInteriorUnlocks} from './interior-decor.js';
import {validateCardMarkers} from './item-cards.js';
import {validateRabbitDraw,validateRabbitDrawCounts} from './rabbit-draw.js';
import {validateAbilityState} from './constellation-abilities.js';
import {validateConstellationAbilityState} from './constellation-weekly-abilities.js';
import {validatePiscesPair,restorePiscesParties} from './party.js';
import { RoomStore, ensure, GameError, nickname } from './rooms.js';
import {pinHash,checkPin} from './pin-auth.js';
export {PIN_RULES,pinHash,checkPin} from './pin-auth.js';
import { ClassFileStore } from './store.js';
import {isEncryptedTeacherCode} from './teacher-access.js';
import { RULES, PLAZA_ID, BLACK_HOLE_ID, WHALE_STOMACH_ID, itemOf, PROGRESSION } from '../shared/config.js';
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
import {validateSerenaProgress} from './serena-progress.js';
import {validateSerenaState,validateDarkStarState,validateBossRespawns,settleBossDeaths} from './boss-lifecycle.js';

// 작은 교실용 파일 저장. 위치·접속 토큰은 제외하고, 학생의 고정 id와 소유물만 보존합니다.
function offline(p) {
  Object.assign(p,{connected:false,socketId:null,token:null,expiresAt:null,away:true,
    x:0,y:0,mapId:PLAZA_ID,input:{x:0,y:0,at:0},effects:[],lastChatAt:0,lastItemUseAt:0});
  return p;
}
export function toRecord(room) {
  const cultureVotes=[...room.players.values()].filter(p=>p.role==='student').map(p=>validateCultureRecommendationVotes(p.cultureRecommendationVotes));
  return {schemaVersion:1,code:room.code,title:room.title,createdAt:room.createdAt,
    cultureRecommendations:validateCultureRecommendations(room.cultureRecommendations,cultureVotes),
    dailyMissions:validateDailyMissions(room.dailyMissions),
    serena:validateSerenaState(room.serena),darkStar:validateDarkStarState(room.darkStar),bossRespawns:validateBossRespawns(room.bossRespawns),
    ...(room.adminCreated?{adminCreated:true}:{}),
    ...(room.teacherAccess?{teacherAccess:structuredClone(room.teacherAccess)}:{}),
    temple:structuredClone(room.temple),exploration:validateExploration(room.exploration),
    starCards:validateStarCards(room.starCards),
    starCardText:validateStarCardText(room.starCardText),
    rabbitDrawCounts:validateRabbitDrawCounts(room.rabbitDrawCounts),
    starRanking:structuredClone(room.starRanking||[]),
    dodgeRanking:structuredClone(room.dodgeRanking||[]),
    memoryRanking:structuredClone(room.memoryRanking||[]),omokWinRecords:validateOmokWinRecords(room.omokWinRecords),signalRanking:validateSignalRanking(room.signalRanking),tetrisRanking:validateTetrisRanking(room.tetrisRanking),missions:validateMissions(room.missions),
    allowedNames:[...room.allowedNames],chat:structuredClone(room.chat),
    summonCooldowns:[...(room.summonCooldowns||[])].filter(([,until])=>until>Date.now()),
    planets:[...room.planets.values()].map(p=>({...p,customDesign:savedPlanetDesign(p.customDesign),rename:p.rename?{...p.rename,votes:[...p.rename.votes]}:null})),
    proposals:[...room.proposals.values()].map(p=>({...p,customDesign:savedPlanetDesign(p.customDesign)})),itemLog:room.itemLog,tradeLog:room.tradeLog,
    students:[...room.players.values()].filter(p=>p.role==='student').map(p=>({
      ...(p.accountKind==='master'?{accountKind:'master'}:{}),
      id:p.id,nickname:p.nickname,avatar:p.avatar,inventory:p.inventory,equipmentSlots:validateEquipmentSlots(p.equipmentSlots),starShards:p.starShards,cosmicEnergy:p.cosmicEnergy??0,explorationChances:validateExplorationChances(p.explorationChances),
      serenaProgress:validateSerenaProgress(p.serenaProgress,p.avatar,p.role),
      muted:p.muted,notes:p.notes,tasks:p.tasks||[],tutorialCompleted:!!p.tutorialCompleted,tutorialRewardClaimed:!!p.tutorialRewardClaimed,
      tutorialCompletedAt:p.tutorialCompletedAt??null,tutorialRewardClaimedAt:p.tutorialRewardClaimedAt??null,
      journey:validateJourney(p.journey),
      cultureReading:validateCultureReading(p.cultureReading),
      cultureRecommendationVotes:validateCultureRecommendationVotes(p.cultureRecommendationVotes),
      historyReading:validateHistoryReading(p.historyReading),
      scienceReading:validateScienceReading(p.scienceReading),
      learningRewards:validateLearningRewards(p.learningRewards),cozyActivities:validateCozyActivities(p.cozyActivities),huntingTime:validateHuntingTime(p.huntingTime),
      dailyMissionHistory:validateDailyMissionHistory(p.dailyMissionHistory),
      starBestMs:p.starBestMs??null,dodgeBestMs:p.dodgeBestMs??null,cardMarkers:p.cardMarkers||[],lv2State:p.lv2State||{galaxyNextAt:[]},
      lv3State:validateLv3State(p.lv3State),lv4State:validateLv4State(p.lv4State),
      holdingState:validateHoldingState(p.holdingState),
      constellationAbilityState:validateConstellationAbilityState(p.constellationAbilityState),
      piscesPair:validatePiscesPair(p.piscesPair),
      learnedRecipeIds:validateLearnedRecipeIds(p.learnedRecipeIds),statGrowth:validateStatGrowth(p.statGrowth),
      rabbitDraw:p.rabbitDraw||null,rabbitUsedDay:p.rabbitUsedDay||null,abilityState:p.abilityState,pin:p.pin
    }))};
}
// 읽을 수 없는 파일은 조용히 초기화하지 않습니다. 관리자가 원본/백업을 확인하도록 시작을 중단합니다.
export function fromRecord(r,now=Date.now()) {
  const bad=()=>{throw new Error('교실 저장 데이터가 올바르지 않습니다: '+r.code);};
  if(!Array.isArray(r.allowedNames)||r.allowedNames.length>RULES.maxStudents ||
    !Array.isArray(r.students)||r.students.length>RULES.maxStudents||!Array.isArray(r.planets)||!Array.isArray(r.proposals)||
    !Array.isArray(r.itemLog)||!Array.isArray(r.tradeLog)||!Array.isArray(r.chat?.history)||
    typeof r.chat.enabled!=='boolean'||!Number.isFinite(r.createdAt))bad();
  if(r.teacherAccess && (typeof r.teacherAccess!=='object'||
    typeof r.teacherAccess.label!=='string'||!r.teacherAccess.label.trim()||r.teacherAccess.label.length>40||
    typeof r.teacherAccess.digest!=='string'||!/^[0-9a-f]{64}$/.test(r.teacherAccess.digest)||
    !Number.isFinite(r.teacherAccess.createdAt)||
    (r.teacherAccess.encryptedCode!==undefined&&!isEncryptedTeacherCode(r.teacherAccess.encryptedCode))))bad();
  const allowedNames=new Set(r.allowedNames.map(nickname));
  if(allowedNames.size!==r.allowedNames.length||allowedNames.has('선생님'))bad();
  const savedCultureVotes=r.students.map(p=>validateCultureRecommendationVotes(p.cultureRecommendationVotes));
  let cultureRecommendations;
  try{cultureRecommendations=validateCultureRecommendations(r.cultureRecommendations,savedCultureVotes);}catch{bad();}
  const room={code:r.code,title:nickname(r.title),createdAt:r.createdAt,adminCreated:r.adminCreated===true,allowedNames,players:new Map(),ariesInvites:new Map(),cancerInvites:new Map(),
    cultureRecommendations,
    dailyMissions:validateDailyMissions(r.dailyMissions),
    serena:validateSerenaState(r.serena),darkStar:validateDarkStarState(r.darkStar),bossRespawns:validateBossRespawns(r.bossRespawns),persistBossDefeats:true,
    teacherAccess:r.teacherAccess?structuredClone(r.teacherAccess):null,
    temple:validateTemple(r.temple),exploration:validateExploration(r.exploration),
    starCards:validateStarCards(r.starCards),
    starCardText:validateStarCardText(r.starCardText),
    rabbitDrawCounts:validateRabbitDrawCounts(r.rabbitDrawCounts),
    starRanking:validateStarRanking(r.starRanking),
    dodgeRanking:validateDodgeRanking(r.dodgeRanking),
    memoryRanking:validateMemoryRanking(r.memoryRanking),omokWinRecords:validateOmokWinRecords(r.omokWinRecords),signalRanking:validateSignalRanking(r.signalRanking),tetrisRanking:validateTetrisRanking(r.tetrisRanking),missions:validateMissions(r.missions),
    mapId:PLAZA_ID,chat:structuredClone(r.chat),planets:new Map(),proposals:new Map(),
    itemLog:structuredClone(r.itemLog),tradeLog:structuredClone(r.tradeLog),trades:new Map()};
  for(const pl of r.planets){
    if(typeof pl.id!=='string'||room.planets.has(pl.id)||typeof pl.name!=='string'||
      !Array.isArray(pl.rules)||!Number.isFinite(pl.x)||!Number.isFinite(pl.y)||!Number.isFinite(pl.radius))bad();
    if(pl.rename && !Array.isArray(pl.rename.votes))bad();
    room.planets.set(pl.id,structuredClone({...pl,customDesign:savedPlanetDesign(pl.customDesign),joinRequests:validateJoinRequests(pl.joinRequests),work:validateWork(pl.work),warnings:validateWarnings(pl.warnings),interiorDecor:validateInteriorDecor(pl.interiorDecor),interiorUnlocks:validateInteriorUnlocks(pl.interiorUnlocks),rename:pl.rename?{...pl.rename,votes:new Map(pl.rename.votes)}:null}));
  }
  const names=new Set();
  for(const p of r.students){
    if(p.accountKind!==undefined&&p.accountKind!=='student'&&p.accountKind!=='master')bad();
    // 이전 저장 파일에 없는 새 재화만 0으로 보완합니다. 잘못된 값은 초기화하지 않습니다.
    const cosmicEnergy=p.cosmicEnergy===undefined?0:p.cosmicEnergy;
    if(typeof p.id!=='string'||room.players.has(p.id)||!allowedNames.has(p.nickname)||names.has(p.nickname)||
      !Number.isSafeInteger(cosmicEnergy)||cosmicEnergy<0||
      !Number.isSafeInteger(p.starShards)||p.starShards<0||!Array.isArray(p.inventory)||
      p.inventory.some(i=>!itemOf(i.id)||itemOf(i.id).mode==='journey-practice'||!Number.isSafeInteger(i.quantity)||i.quantity<1||
        (itemOf(i.id).temporaryCrown&&(!Number.isSafeInteger(i.expiresAt)||i.expiresAt<0)))||
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
    for(const [field,done] of [['tutorialCompletedAt',p.tutorialCompleted],['tutorialRewardClaimedAt',p.tutorialRewardClaimed??p.tutorialCompleted]]){
      if(p[field]!=null&&(!done||!validMissionTimestamp(p[field])))bad();
    }
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
    const crownTrial=validateConstellationAbilityState(p.constellationAbilityState).coronaTrial;
    const borrowedCrown=p.constellationAbilityState?.ophiuchus?.copied;
    if(crownTrial&&(avatar.level!==1||
      !(avatar.constellationId==='corona-borealis'||avatar.constellationId==='ophiuchus'&&borrowedCrown?.constellationId==='corona-borealis'&&borrowedCrown.level===4)||
      crownTrial.savedEquipmentSlots.some(id=>id&&!equipmentOf(id))))bad();
    room.players.set(p.id,offline({...structuredClone(p),huntingTimer:null,tutorialCompleted:p.tutorialCompleted??false,tutorialRewardClaimed:p.tutorialRewardClaimed??!!p.tutorialCompleted,
      tutorialCompletedAt:p.tutorialCompletedAt??null,tutorialRewardClaimedAt:p.tutorialRewardClaimedAt??null,
      journey:validateJourney(p.journey),
      cultureReading:validateCultureReading(p.cultureReading),
      cultureRecommendationVotes:validateCultureRecommendationVotes(p.cultureRecommendationVotes),
      historyReading:validateHistoryReading(p.historyReading),
      scienceReading:validateScienceReading(p.scienceReading),
      learningRewards:validateLearningRewards(p.learningRewards),cozyActivities:validateCozyActivities(p.cozyActivities),huntingTime:validateHuntingTime(p.huntingTime),
      dailyMissionHistory:validateDailyMissionHistory(p.dailyMissionHistory),
      serenaProgress:validateSerenaProgress(p.serenaProgress,avatar,'student'),
      starBestMs:p.starBestMs??null,dodgeBestMs:p.dodgeBestMs??null,equipmentSlots,learnedRecipeIds:validateLearnedRecipeIds(p.learnedRecipeIds),statGrowth:validateStatGrowth(p.statGrowth),cosmicEnergy,explorationChances:validateExplorationChances(p.explorationChances),avatar,tasks,cardMarkers,rabbitDraw,rabbitUsedDay:p.rabbitUsedDay||null,
      lv2State:structuredClone(lv2State),lv3State:validateLv3State(p.lv3State),lv4State:validateLv4State(p.lv4State),holdingState:validateHoldingState(p.holdingState),abilityState:validateAbilityState(p.abilityState),constellationAbilityState:validateConstellationAbilityState(p.constellationAbilityState),piscesPair:validatePiscesPair(p.piscesPair),role:'student'}));
  }
  restorePiscesParties(room,now);
  for(const pr of r.proposals){
    if(typeof pr.id!=='string'||room.proposals.has(pr.id)||!room.players.has(pr.playerId))bad();
    room.proposals.set(pr.id,structuredClone({...pr,customDesign:savedPlanetDesign(pr.customDesign)}));
  }
  if(r.summonCooldowns!==undefined&&(!Array.isArray(r.summonCooldowns)||r.summonCooldowns.some(e=>!Array.isArray(e)||e.length!==2||typeof e[0]!=='string'||!Number.isSafeInteger(e[1]))))bad();
  room.summonCooldowns=new Map((r.summonCooldowns||[]).filter(([,until])=>until>Date.now()));
  room.summons=new Map(); // 답을 기다리는 호출은 다음 수업에 자동 재생하지 않습니다.
  relocateDepartments(room);
  return room;
}

export class PersistentRoomStore extends RoomStore {
  constructor(directory,{unattended=false,teacherManagedAccounts=false,maxActiveRooms=RULES.maxRooms,clock=Date.now}={}) {
    super({maxActiveRooms,clock});this.unattended=unattended;this.teacherManagedAccounts=teacherManagedAccounts;this.files=new ClassFileStore(directory);this.records=new Map();
    try {for(const r of this.files.loadAll()){
      const restored=fromRecord(r,this.clock());
      // 이전 파일의 새 기본 필드를 메모리 기준에도 정규화합니다. 다른 교실의
      // 첫 저장이 다중 교실 변경으로 오인되지 않으며 파일은 실제 변경 때 저장합니다.
      this.records.set(r.code,{...r,serena:restored.serena,darkStar:restored.darkStar,bossRespawns:restored.bossRespawns,
        students:r.students.map(p=>({...p,serenaProgress:restored.players.get(p.id).serenaProgress}))});
    }}
    catch(error){this.files.close();throw error;}
  }
  newCode(){let code;do{code=super.newCode();}while(this.records.has(code));return code;}
  create(data,socketId,options){
    let accounts=null;
    if(data.studentAccounts!==undefined){
      ensure(this.teacherManagedAccounts,'학생 계정 동시 생성은 저장 교실에서만 가능해요.');
      ensure(Array.isArray(data.studentAccounts)&&data.studentAccounts.length>=1&&data.studentAccounts.length<=RULES.maxStudents,
        `학생 수는 1~${RULES.maxStudents}명으로 정해주세요.`);
      accounts=data.studentAccounts.map(entry=>{
        ensure(entry&&typeof entry==='object'&&!Array.isArray(entry),'학생 이름과 비밀번호를 확인해주세요.');
        const name=nickname(entry.nickname);
        ensure(typeof entry.pin==='string'&&/^\d{4}$/.test(entry.pin),'학생 비밀번호는 숫자 4자리로 입력해주세요.');
        return {nickname:name,pin:entry.pin};
      });
    }
    const s=super.create(accounts?{...data,allowedNames:accounts.map(account=>account.nickname)}:data,socketId,options);
    s.room.createdAt=Date.now();s.room.unattended=this.unattended;
    s.room.persistBossDefeats=true;
    if(this.teacherManagedAccounts)s.credentials=(accounts||[...s.room.allowedNames].map(name=>({nickname:name,pin:String(randomInt(10000)).padStart(4,'0')}))).map(account=>{
      this.createStudent(s.room,account);return account;
    });
    return s;
  }
  createStudent(room,data){
    const name=nickname(data.nickname),pin=pinHash(data.pin);
    ensure(name!=='선생님'&&![...room.players.values()].some(p=>p.nickname===name),'이미 있는 이름이에요. 다른 이름을 적어주세요.');
    ensure(room.allowedNames.has(name)||room.allowedNames.size<RULES.maxStudents,`학생은 최대 ${RULES.maxStudents}명까지 만들 수 있어요.`);
    room.allowedNames.add(name);
    const player=this.add(room,name,'student',null);player.pin=pin;this.remove(room,player);return player;
  }
  createMaster(room,data){
    const selected=constellationOf(data.constellationId,MASTER_BASE.level);
    ensure(selected&&!selected.legacy,'마스터 계정의 첫 별자리를 골라주세요.');
    const count=[...room.players.values()].filter(p=>p.role==='student'&&p.avatar.level>=2&&p.avatar.constellationId===selected.id).length;
    ensure(count<CONSTELLATION_LIMIT,'이 별자리는 이미 정원이 찼어요. 다른 별자리를 골라주세요.');
    const player=this.createStudent(room,data);
    player.accountKind='master';
    player.avatar={...player.avatar,level:MASTER_BASE.level,xp:0,form:'transcendent',constellationId:selected.id};
    recordSerenaLevel(player);
    return player;
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
    const room=fromRecord(record,this.clock());room.unattended=this.unattended;this.rooms.set(code,room);
    return {room,player:this.add(room,'선생님','teacher',socketId)};
  }
  list(){return [...this.records.values()].map(r=>({code:r.code,title:r.title,open:this.rooms.has(r.code)}));}
  snapshot(room,viewer,now){return {...super.snapshot(room,viewer,now),persistent:true,unattended:!!room.unattended,managedAccounts:this.teacherManagedAccounts};}
  join(data,socketId){
    const code=typeof data.code==='string'?data.code.trim().toUpperCase():'';
    let room=this.rooms.get(code);
    if(!room&&this.unattended&&this.records.has(code)){
      ensure(this.rooms.size<this.maxActiveRooms,'지금은 교실이 가득 찼어요.');
      room=fromRecord(this.records.get(code),this.clock());room.unattended=true;this.rooms.set(code,room);
    }
    ensure(room,'선생님이 교실을 열었는지와 교실 코드를 확인해주세요.');
    ensure(room.unattended||[...room.players.values()].some(p=>p.role==='teacher'&&p.connected),'선생님이 다시 연결할 때까지 기다려주세요.');
    const name=nickname(data.nickname);ensure(room.allowedNames.has(name),'선생님이 허용한 닉네임이나 번호로 입장해주세요.');
    const p=[...room.players.values()].find(p=>p.nickname===name);
    if(p){
      ensure(!p.connected,'이미 사용 중인 닉네임이에요. 원래 창에서 계속해주세요.');
      checkPin(p,data.pin);
      this.sessions.delete(p.token);
      const mapId=p.avatar.blackStar?BLACK_HOLE_ID:p.constellationAbilityState?.cetusStomach?.endsAt>this.clock()?WHALE_STOMACH_ID:PLAZA_ID;
      Object.assign(p,mapId===BLACK_HOLE_ID||mapId===WHALE_STOMACH_ID?spawnInside(room,mapId,p):spawnPosition(room),{token:randomBytes(32).toString('hex'),socketId,connected:true,away:false,
        expiresAt:null,mapId,input:{x:0,y:0,at:0}});
      const session={room,player:p};this.sessions.set(p.token,session);return session;
    }
    ensure(!this.teacherManagedAccounts,'선생님이 아직 계정을 만들지 않았어요. 선생님께 알려주세요.');
    const pin=pinHash(data.pin);
    ensure(room.players.size<RULES.maxPlayers,`교실 정원 ${RULES.maxPlayers}명이 모두 찼어요.`);
    const player=this.add(room,name,'student',socketId);player.pin=pin;return {room,player};
  }
  remove(room,p){
    this.sessions.delete(p.token);
    if(p.role==='student')offline(p);else room.players.delete(p.id);
  }
  destroy(room,now=Date.now()){
    // 처치 직후 다음 전투 틱 전에 수업을 끝내도 자격과 다음 날 07시 복원 시각을 보존합니다.
    settleBossDeaths(room,now);
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
