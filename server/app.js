import {advanceProjectiles,projectileViews} from './projectiles.js';
import {allowsOfflineItemTarget} from '../shared/item-targets.js';
import {teacherInventoryView,adjustTeacherInventory} from './teacher-inventory.js';
import {holdingStatus,useHoldingAbility} from './holding-abilities.js';
import {teacherCardCatalog} from './teacher-card-catalog.js';
import {displayStarCard,STAR_CARD_TEXT_LIMITS} from './star-card-text.js';
import {castAquarius,advanceAquarius,aquariusViews,aquariusCooldowns} from './aquarius-skills.js';
import {castCorvus,corvusCooldowns} from './corvus-skills.js';
import {castWater,advanceWaterAuras,waterAuraViews,waterCooldowns,resolveWaterHit} from './water-skills.js';
import {castSwan,advanceSwanAuras,swanAuraViews,swanCooldowns} from './swan-skills.js';
import {castOphiuchus,advanceOphiuchusVenoms,advanceOphiuchusPoison,ophiuchusCooldowns,ophiuchusViews} from './ophiuchus-skills.js';
import {castGemini,geminiCooldowns} from './gemini-skills.js';
import {castAries,advanceAriesClouds,ariesCloudViews,ariesCooldowns} from './aries-skills.js';
import {castTaurus,advanceTaurusDashes,taurusDashViews,taurusCooldowns} from './taurus-skills.js';
import {castHercules,advanceHerculesShields,herculesShieldViews,herculesCooldowns} from './hercules-skills.js';
import {castLibra,advanceLibraAuras,libraAuraViews,libraCooldowns} from './libra-skills.js';
import {castCorona,advanceCorona,coronaAuraViews,coronaCooldowns} from './corona-skills.js';
import {castCapricorn,advanceCapricorn,capricornBlessingViews,capricornCooldowns} from './capricorn-skills.js';
import {castLeo,advanceLeoRoars,advanceLeoCourage,leoCooldowns} from './leo-skills.js';
import {isWaterConstellation} from '../shared/water-skills.js';
import {startTransformation,expireTransformation} from './transformation.js';
import {requestMembership,clearJoinRequests,mailboxView,requireNoDepartment} from './planet-membership.js';
import {startLifeRecovery,advanceLifeRecovery,finishLifeRecovery} from './life-star.js';
import {advancePassiveRecovery} from './passive-recovery.js';
import {readExploration,explore,clearExplorationResults,resetExploration,useExplorationTicket,updateExplorationCards} from './exploration.js';
import {registerMarketTrades,pruneMarketTrades} from './market-trades.js';
import {useLv4Item,useLv4Holding,lv4Info,lv4TeacherInfo,confirmLv4,blackHolePreview,syncLv4Holdings,settleLv4Items,lv4ItemsDue} from './lv4-item-effects.js';
import express from 'express';
import {hasUnlimitedShards,shardCost} from '../shared/economy.js';
import {collectEnergyDrop,rerollPartyLoot,energyDropViews,pruneEnergyDrops} from './energy-drops.js';
import {attackPowerOf,attackGeometryOf,ATTACK_VISUAL,SKILL_COOLDOWN_MS} from '../shared/combat.js';
import {skillEffectOf} from '../shared/skill-effects.js';
import {isSagittarius} from '../shared/sagittarius-skills.js';
import {attackSagittarius,castSagittarius,advanceSagittarius,sagittariusViews,skillCooldowns,combatEnemies,damageTargets} from './sagittarius-skills.js';
import { createServer } from 'node:http';
import { timingSafeEqual, randomUUID, randomBytes } from 'node:crypto';
import {configuredAdminPassword} from './admin-password.js';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RoomStore, ensure, GameError, playerEffectsView, nickname } from './rooms.js';
import { PersistentRoomStore, pinHash, checkPin } from './persistent-rooms.js';
import {decryptTeacherCode,encryptTeacherCode,issueTeacherCode,matchesTeacherCode} from './teacher-access.js';
import { advance, spawnInside, exitPosition, isNear, placementFree, addPlanet, movePlanet, arrivePosition } from './world.js';
import { filterChat } from './chat-filter.js';
import { CRAFTING } from '../shared/crafting.js';
import { attemptCraft } from './crafting.js';
import {learnedRecipesView,useRecipeItem} from './learned-recipes.js';
import { templeItemRows } from './temple-items.js';
import {observeJourney,journeyPillar,journeyGoal,journeyTickGoals,journeyView,journeyMissions,claimJourney,usePractice,equipPractice} from './tutorial-journey.js';
import { availableCraftingRecipes,loadCraftingRecipes } from './crafting-recipes.js';
import {sellQuote} from '../shared/item-pricing.js';
import {awardDrawReward} from './draw-rewards.js';
import {useStarCard,useTypedStarCard,activeStarCards,removeStarCard,starCardsDue,expireStarCards,
  chooseStarCard,starCardChoiceInfo,requireStarCardItemAccess,starCardShopDiscounts,starCardPurchaseQuote,consumeStarCardDiscounts} from './star-cards.js';
import {starCardOf} from '../shared/star-cards.js';
import {useLv2Item,settleLv2Items,hasLv2ItemBlock,collectSunTax,syncGalaxyHoldings,lv2ItemsDue} from './lv2-item-effects.js';
import {useLv3Item, syncLv3Holdings, settleLv3Items, lv3ItemsDue} from './lv3-item-effects.js';
import {devourOptions,devourItem} from './alien-devour.js';
import {EQUIPMENT_ITEMS,equipmentOf} from '../shared/equipment.js';
import {buyEquipment,equip,unequip} from './equipment.js';
import { checkChatRate } from './chat-rate.js';
import { chatScope, canReadChat, visibleHistory, requestSummon, respondSummon } from './social.js';
import {inviteParty,respondParty,leaveParty,invitePiscesPair,respondPiscesPair,settlePiscesPairs,activePiscesPair} from './party.js';
import { studentAccessOpen, STUDENT_HOURS_MESSAGE } from './access-hours.js';
import {readDaily,saveNotice,readTimetable,saveTimetable,assignmentById,markAssignmentDone,recentAssignments,incompleteAssignments,weeklyRewards,resetWeeklyRewards,recordReward,koreaDay,weekStart} from './temple.js';
import {validateWork,saveReport,awardReport,proposeDistribution,confirmDistribution,cancelDistribution,reconcileMembership} from './department-work.js';
import {moveMonsters,monsterViews,strikeMonsters,monstersInAttackArea} from './monsters.js';
import {summonSerena} from './serena.js';
import {serenaView,settleBossDeaths,restoreSerenaStatue} from './boss-lifecycle.js';
import {damagePlayersInArea,playersInArea} from './area-combat.js';
import {isDefeated} from './vitals.js';
import {recoverDefeated} from './battle-recovery.js';
import {starRanking} from './star-game.js';
import {startDodgeRun,setDodgeInput,cancelDodgeRun,advanceDodgeRuns,completeDodgeRun,dodgeRanking} from './dodge-game.js';
import {currentWeekRecords,resetWeeklyRanking} from './weekly-ranking.js';
import {memoryRanking,startMemoryRun,cancelMemoryRun,flipMemoryCard} from './memory-game.js';
import {evolutionInfo,changeConstellation,evolveConstellation,selectTeacherEvolution,growthInfo,buyExperience} from './evolution.js';
import {gainExperience} from './progression.js';
import {warningView,issueWarning,clearBlackStar,clearWarningsFromPlanet,clearOneWarningFromPlanet,clearOwnWarning,clearOwnDepartmentWarnings,clearOwnBlackStar,warningCount,blackStarList,teacherWarningHistory,deleteTeacherWarning} from './warnings.js';
import {hasMoonProtectionFrom,hasItemImmunity,activeCardMarkers,hasCardStatus,addCardMarker,nextKoreaMidnight} from './item-cards.js';
import {exemptionName} from '../shared/item-exemptions.js';
import {startOneStroke,completeOneStroke} from './one-stroke-game.js';
import {createRabbitDraw,rabbitDrawView,validateRabbitDrawCounts} from './rabbit-draw.js';
import {activeItemBlocks,settleItemBlocks,rollStarDie,freshAbilityState} from './constellation-abilities.js';
import {constellationOf} from '../shared/constellations.js';
import {lifeAbilityModifiers,lifeAbilityUsage,lifeAbilityDescription} from '../shared/supernova-life.js';
import {addTask,completeTask,setTaskStatus} from './tasks.js';
import {createMission,acceptMission,completeMission,claimMission,advanceMissions,missionBoardViews,findMission} from './missions.js';
import {ensureDailyMissions,dailyMissionDay} from './daily-missions.js';
import {createEnglishStation} from './english-station.js';
import {createMathStation} from './math-station.js';
import {createBaseballRuns} from './baseball-game.js';
import {createSignalRuns,signalRanking} from './signal-game.js';
import {createTetrisRuns,tetrisRanking} from './tetris-game.js';
import {createSudokuRuns} from './sudoku-runs.js';
import {interiorDecorTarget,interiorDecorColor,interiorUpgrade,interiorUpgradeUnlocked} from '../shared/interior-decor.js';
import {createDuelArcade,registerDuelArcade} from './duel-arcade.js';
import {registerCultureLibrary,registerHistoryLibrary} from './culture-library.js';
import {registerScienceLibrary} from './science-library.js';
import {awardLearningReward} from './learning-rewards.js';
import {usesTeacherSkill,castTeacherSkill} from './teacher-skill.js';
import {constellationAbilityStatus,useConstellationAbility,chooseConstellationItem,validateSagittariusUse,completeSagittariusUse,constellationChangedThisWeek,completeSwanCompliment,submitSwanCampaign,approveSwanCampaign} from './constellation-weekly-abilities.js';
import {weeklyAbilityFor} from '../shared/constellation-weekly-abilities.js';
import {activeOphiuchusParalysis,useOphiuchus,clearOphiuchusParalysis,ophiuchusTransferDue,settleOphiuchusTransfers,borrowedOphiuchusActor,promoteBorrowedOphiuchusCopy,chooseCopiedOphiuchusItem} from './ophiuchus-weekly.js';
import {useLeoChallenge,rewardLeoSubmission,settleLeoUnclaimed} from './leo-weekly.js';
import {activeCetusStomach,useCetus,respondCetus,escapeCetus,settleCetusStomachs,settleCetusUnclaimed,cetusAfterAbility} from './cetus-weekly.js';
import {swanDailyDue,settleSwanDaily,swanCardOffer,buySwanStarCard} from './swan-weekly.js';
import {useCoronaWeekly,coronaDue,settleCorona,CROWN_ITEMS} from './corona-weekly.js';
import {activeAriesSleep,ariesSleepDue,settleAriesSleep,inviteAriesSleep,respondAriesSleep,useAriesSleep,wakeAriesSleep} from './aries-weekly.js';
import {inviteCancerDuel,respondCancerDuel} from './cancer-weekly.js';
import { RULES, CHAT, DEPARTMENT_RULES, PLAZA_ID, PLANET, PLANET_COLORS, planetIdOfMap, interiorIdOf,
  MAP, STREET, STREET_ID, BLACK_HOLE_ID, WHALE_STOMACH_ID, WARNING_RULES, STATIC_MAPS, mapOf, SHARDS, SHOP, itemOf, ITEM_USE, TRADE, templateOf } from '../shared/config.js';

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
  ensure(placementFree(room,x,y),'오른쪽 아래 부서행성 광장의 빈자리를 골라주세요. 다른 행성과 떨어져 있어야 해요.');
  ensure(PLANET_COLORS.includes(data.color),'행성 색을 골라주세요.');
  ensure(templateOf(data.templateId),'행성 종류를 골라주세요.');
  return {name,description,x,y,color:data.color,templateId:data.templateId};
};
export function createClassroomServer({teacherKey, adminPassword=randomBytes(24).toString('base64url'), publicOrigin='', reconnectMs=RULES.reconnectMs, dataDir=null, studentHours=true, clock=Date.now, unattended=true, teacherManagedAccounts=true, maxActiveRooms=RULES.maxRooms, abilityDie=rollStarDie,craftingRecipes=loadCraftingRecipes(),starCardRandom}={}) {
  if(!teacherKey || teacherKey.length<16) throw new Error('TEACHER_KEY must be at least 16 characters.');
  configuredAdminPassword(adminPassword);
  const app=express(), http=createServer(app), store=dataDir?new PersistentRoomStore(dataDir,{unattended,teacherManagedAccounts,maxActiveRooms,clock}):new RoomStore({maxActiveRooms,clock});
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
    const frameAncestors=req.path==='/admin.html'?"'self'":"'none'";
    res.set({'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors "+frameAncestors,
      'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store'});
    next();
  });
  app.get('/health',(_req,res)=>res.json({ok:true,service:'space-classroom',version:'0.2.0',persistent,publicOrigin}));
  app.get('/api/public-config',(_req,res)=>res.json({managedAccounts:persistent&&teacherManagedAccounts,studentHours}));
  app.use('/shared',express.static(fileURLToPath(new URL('../shared',import.meta.url))));
  app.use(express.static(fileURLToPath(new URL('../client',import.meta.url))));
  // 교사 키 무작위 대입은 연결을 새로 열어도 제한되도록 주소별로 집계합니다.
  const authAttempts=new Map(),lastAttacks=new WeakMap(),lastSkills=new WeakMap(),englishStation=createEnglishStation(),mathStation=createMathStation(),baseballRuns=createBaseballRuns(),signalRuns=createSignalRuns(),tetrisRuns=createTetrisRuns(),sudokuRuns=createSudokuRuns();
  // 저장이 끝날 때까지 알림을 보류합니다. 파일 실패 시 화면에도 변경을 보내지 않습니다.
  let pending=null;
  const deliver=fn=>pending?pending.push(fn):fn();
  const duelArcade=createDuelArcade({getRoom:code=>store.rooms.get(code),clock,emitPrivate(code,id,event,payload){deliver(()=>{
    const player=store.rooms.get(code)?.players.get(id),sock=player&&io.sockets.sockets.get(player.socketId);
    if(sock?.data.session?.room.code===code&&sock.data.session.player.id===id)sock.emit(event,payload);
  });}});
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
    room.recipeDropOutputIds=[...new Set(craftingRecipes.map(recipe=>recipe.output.id))];
    deliver(()=>io.to(room.code).emit('planet:mailbox:changed',{}));
    for(const p of room.players.values()){syncGalaxyHoldings(p,clock());syncLv3Holdings(p,clock());syncLv4Holdings(p,clock());}
    // 가입·탈퇴·계정 삭제 뒤에는 과거 부원 명단으로 분배할 수 없습니다.
    for(const planet of room.planets.values())planet.joinRequests=(planet.joinRequests||[]).filter(r=>room.players.get(r.playerId)?.role==='student'&&room.players.get(r.playerId).avatar.departmentId!==planet.id);
    for(const planet of room.planets.values()) if(planet.work?.distribution) {
      reconcileMembership(room,planet,clock());
      if(!planet.work.distribution) deliver(()=>io.to(room.code).emit('department:changed',{planetId:planet.id}));
    }
    for(const p of room.players.values()){
      if(!p.connected) continue;
      const sock=io.sockets.sockets.get(p.socketId);
      if(sock) deliver(()=>sock.emit('room:state',store.snapshot(room,p,clock())));
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
    store.destroy(room,clock());
    deliver(()=>duelArcade.closeRoom(room.code));
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
          if(session?.player.role==='student'&&session.player.constellationAbilityState?.abilitySeal?.endsAt>clock()&&
            ['constellation-ability:choose-item','ability:choose-item','constellation-ability:swan-card-buy'].includes(name))
            throw new GameError('뱀주인자리의 고급 마비로 별자리 능력이 봉인됐어요.');
          if(session?.player.role==='student'&&activeOphiuchusParalysis(session.player,clock())&&
            ['star-card:choose','star-card:remove'].includes(name))
            throw new GameError('마비상태에서는 아이템을 사용할 수 없어요.');
          if(session?.teacherAccessDigest)ensure(session.room.teacherAccess?.digest===session.teacherAccessDigest,'선생님 접속 코드가 바뀌었어요. 다시 입장해주세요.');
          if(session?.player.role==='student'&&activeAriesSleep(session.player,clock())&&
            !['room:leave','constellation-ability:status','aries-sleep:respond','aries-sleep:wake','cetus:escape'].includes(name))
            throw new GameError('수면 중에는 행동할 수 없어요. 깨어나는 시간을 기다려 주세요.');
          if(session?.player.role==='student'&&activeCetusStomach(session.player,clock())&&
            !['room:leave','chat:send','chat:history','cetus:escape'].includes(name))
            throw new GameError('고래 배 속에서는 대화하거나 탈출만 할 수 있어요.');
          if(session&&name.startsWith('combat:')&&expireTransformation(session.player,clock()))roster(session.room);
          if(session&&['combat:attack','combat:skill','combat:transform','map:travel','evolution:evolve','evolution:change','evolution:teacher-select'].includes(name))ensure(!isDefeated(session.player),'체력을 회복하는 중이에요. 잠시 기다려주세요.');
          if(session?.player.role==='student'&&name!=='room:leave')ensure(studentOpen(),STUDENT_HOURS_MESSAGE);
          if(persistent && !session?.room.unattended && session?.player.role==='student' && name!=='room:leave')
            ensure([...session.room.players.values()].some(p=>p.role==='teacher'&&p.connected),'선생님이 다시 연결할 때까지 기다려주세요.');
          // 인벤토리가 바뀌기 전에 보유 기간을 정산해, 마지막 카드를 팔 때 지난 주의 스택을 잃지 않습니다.
          if(save&&session){settleLv4Items(session.room,clock());if(ensureDailyMissions(session.room,clock()))roster(session.room);}
          const result=handler(data);
          const current=socket.data.session;
          if(save&&current?.player.role==='student'&&settleLeoUnclaimed(current.player))roster(current.room);
          if(save&&current?.player.role==='student'&&settleCetusUnclaimed(current.player))roster(current.room);
          if(save&&current&&store.rooms.get(current.room.code)===current.room&&ensureDailyMissions(current.room,clock()))roster(current.room);
          return result;
        })});
      }catch(error){
        if(!(error instanceof GameError)) console.error('Action failed:',name,error.message);
        ack({ok:false,error:error instanceof GameError?error.message:'처리하지 못했어요. 다시 시도해주세요.'});
      }
    });
    // 일시적인 타격 표시는 디스크에 저장하지 않습니다. 좌표·방향·공격력은 서버만 결정합니다.
    registerDuelArcade({socket,action,duel:duelArcade});
    registerCultureLibrary({socket,action,store,roster,clock});
    registerHistoryLibrary({socket,action,store,roster,clock});
    registerScienceLibrary({socket,action,store,roster,clock});
    action('serena:summon',()=>{
      const session=socket.data.session;ensure(session,'먼저 교실에 입장해주세요.');
      const result=summonSerena(session.room,session.player,clock());
      roster(session.room);return result;
    });
    action('life-star:recover',()=>{
      const session=socket.data.session;ensure(session,'먼저 교실에 입장해주세요.');
      return startLifeRecovery(session.player,clock());
    },false);
    action('tutorial:complete',()=>{ensure(false,'새 첫 여행 미션의 행동 목표를 완료해 주세요.');},false);
    action('tutorial:observe',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      if(observeJourney(s.player,data.goalId))roster(s.room);
      return {journey:journeyView(s.player)};
    });
    action('tutorial:practice-use',()=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const result=usePractice(s.player,clock());roster(s.room);return {...result,journey:journeyView(s.player)};
    });
    action('tutorial:practice-equip',()=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const result=equipPractice(s.player);roster(s.room);return {...result,journey:journeyView(s.player)};
    });
    const missionBoardAccess=()=>{
      const session=socket.data.session;ensure(session,'먼저 교실에 입장해주세요.');
      const board=MAP.objects.find(object=>object.kind==='mission-board');
      ensure(session.player.role==='teacher'||session.player.mapId===PLAZA_ID&&isNear(session.player,board),'별 미션 게시판 가까이에서 확인해주세요.');
      return session;
    };
    action('mission:board:read',()=>{
      const session=missionBoardAccess();return {missions:missionBoardViews(session.room,session.player,clock())};
    });
    action('mission:create',data=>{
      const session=missionBoardAccess();ensure(session.player.role==='teacher','선생님만 미션을 만들 수 있어요.');
      ensure(data?.objective===undefined,'자동미션 제작하기에서 조건을 골라 주세요.');
      const mission=createMission(session.room,data,clock());roster(session.room);return {missionId:mission.id};
    });
    action('mission:auto:create',data=>{
      const session=missionBoardAccess();ensure(session.player.role==='teacher','선생님만 미션을 만들 수 있어요.');
      ensure(data?.objective!==undefined,'자동미션 조건을 골라 주세요.');
      const mission=createMission(session.room,data,clock());
      roster(session.room);return {missionId:mission.id};
    });
    action('mission:accept',data=>{
      const session=missionBoardAccess();const mission=acceptMission(session.room,session.player,data?.missionId,clock());
      roster(session.room);return {missionId:mission.id};
    });
    action('mission:repeat:stop',data=>{
      const session=missionBoardAccess();ensure(session.player.role==='teacher','선생님만 반복 미션을 중지할 수 있어요.');
      const index=session.room.missions.findIndex(m=>m.repeat==='daily'&&m.id===data.templateId);
      ensure(index>=0,'중지할 반복 미션을 찾을 수 없어요.');
      session.room.missions.splice(index,1);roster(session.room);
      return {templateId:data.templateId,stopped:true};
    });
    action('mission:confirm',data=>{
      const session=missionBoardAccess();ensure(session.player.role==='teacher','선생님만 달성을 확인할 수 있어요.');
      const student=session.room.players.get(data?.studentId);
      ensure(student?.role==='student','학생을 골라 주세요.');
      const mission=completeMission(session.room,student.id,data?.missionId,clock());
      roster(session.room);return {missionId:mission.id,studentId:student.id};
    });
    action('mission:claim',data=>{
      const session=socket.data.session;ensure(session?.player.role==='student','학생만 미션 보상을 받을 수 있어요.');
      const player=session.player;
      const tutorial=/^first-journey-[1-5]$/.test(data?.missionId);
      const mission=tutorial?null:findMission(session.room,data?.missionId,clock());
      if(tutorial){ensure(journeyMissions(player).find(m=>m.id===data.missionId)?.status==='ready','아직 열리지 않았거나 목표를 마치지 않은 미션 또는 이미 보상받은 미션이에요.');}
      else{ensure(mission,'알 수 없는 미션이에요.');
        ensure(mission.acceptedIds.includes(player.id)&&mission.completedIds.includes(player.id),'아직 완료 조건이 확인되지 않았어요.');
        ensure(!mission.claimedIds.includes(player.id),'이미 받은 미션 보상이에요.');}
      const reward=tutorial?1:mission.rewardShards,rewardItem=mission?.repeat==='daily'?'star-crumb':null,rewardQuantity=rewardItem?mission.rewardQuantity:reward;
      const entry=rewardItem?player.inventory.find(item=>item.id===rewardItem):null;
      if(rewardItem){
        ensure(itemOf(rewardItem),'보상 아이템을 찾을 수 없어요.');
        ensure((entry?.quantity||0)+rewardQuantity<=SHOP.maxStack,'별 부스러기 가방이 가득 찼어요. 조합한 뒤 받아 주세요.');
        ensure(entry||player.inventory.length<SHOP.maxKinds,'가방 종류가 가득 찼어요. 정리한 뒤 받아 주세요.');
      }
      ensure(player.starShards<=SHARDS.max-reward,'별 파편 가방이 가득 찼어요. 별 파편을 사용한 뒤 받아 주세요.');
      const claimedAt=clock();
      if(tutorial){const result=claimJourney(player,data.missionId,claimedAt);
        if(result.completed){if(!player.tutorialCompleted){player.tutorialCompleted=true;player.tutorialCompletedAt=claimedAt;}
          advanceMissions(session.room,player,'tutorial-complete',undefined,clock());}
      }else claimMission(session.room,player,data.missionId,claimedAt);
      player.starShards+=reward;
      if(rewardItem){if(entry)entry.quantity+=rewardQuantity;else player.inventory.push({id:rewardItem,quantity:rewardQuantity});}
      if(reward)recordReward(session.room,player.id,reward,claimedAt);roster(session.room);
      return {missionId:data.missionId,rewardItem,rewardQuantity,rewardShards:reward,starShards:player.starShards,claimedAt};
    });
    const learningStationAccess=(kind,label)=>{
      const session=socket.data.session;ensure(session,'먼저 교실에 입장해주세요.');
      const {player,room}=session;
      ensure(socket.connected&&player.connected&&!player.away&&player.socketId===socket.id&&
        ['student','teacher'].includes(player.role)&&store.rooms.get(room.code)===room&&room.players.get(player.id)===player,'현재 접속에서 교실에 다시 입장해주세요.');
      const station=STREET.objects.find(object=>object.kind===kind+'-station');
      ensure(player.mapId===STREET_ID&&isNear(player,station),`별 ${label} 발전소 가까이에서 풀어 주세요.`);
      return session;
    };
    const englishStationAccess=()=>learningStationAccess('english','영어');
    action('learning:english:start',data=>{
      const session=englishStationAccess();return englishStation.start(session.player,data?.level);
    },false);
    action('learning:english:next',()=>{
      const session=englishStationAccess();return englishStation.next(session.player);
    },false);
    action('learning:english:answer',data=>{
      const session=englishStationAccess(),result=englishStation.answer(session.player,data);
      const progressed=result.success&&advanceMissions(session.room,session.player,'english-success',undefined,clock());
      if(result.done)result.learningReward=awardLearningReward(session.player,'english',result,clock());
      if(progressed||result.learningReward?.awarded)roster(session.room);
      return result;
    });
    const mathStationAccess=()=>learningStationAccess('math','수학');
    action('learning:math:start',data=>{
      const session=mathStationAccess();return mathStation.start(session.player,data?.grade);
    },false);
    action('learning:math:next',()=>{
      const session=mathStationAccess();return mathStation.next(session.player);
    },false);
    action('learning:math:answer',data=>{
      const session=mathStationAccess(),result=mathStation.answer(session.player,data);
      const progressed=result.right&&advanceMissions(session.room,session.player,'math-correct',result.grade,clock());
      if(result.done)result.learningReward=awardLearningReward(session.player,'math',result,clock());
      if(progressed||result.learningReward?.awarded)roster(session.room);
      return result;
    });
    action('exploration:read',()=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');return readExploration(s.room,s.player,clock());},false);
    action('exploration:update-cards',data=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      return updateExplorationCards(s.room,s.player,data?.cards,clock());});
    action('exploration:explore',()=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const result=explore(s.room,s.player,clock());roster(s.room);return result;});
    action('exploration:clear-results',()=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const result=clearExplorationResults(s.room,s.player,clock());roster(s.room);return result;});
    action('exploration:reset',()=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const result=resetExploration(s.room,s.player,clock());roster(s.room);return result;});
    action('combat:attack',()=>{
      const session=socket.data.session;ensure(session,'먼저 교실에 입장해주세요.');
      const {room,player}=session,now=clock(),power=attackPowerOf(player.avatar.level,player.avatar.constellationId,player);
      ensure(player.connected&&!player.away,'먼저 교실에 입장해주세요.');
      ensure(!player.avatar.blackStar,'현재 검은별 상태입니다');
      ensure(power!==null,player.avatar.level<2?'LV2부터 공격할 수 있어요.':'이 단계의 공격력은 설정 준비 중이에요.');
      ensure(now-(lastAttacks.get(player)??-Infinity)>=ATTACK_VISUAL.cooldownMs,'공격은 1초에 한 번 할 수 있어요.');
      lastAttacks.set(player,now);
      const direction=player.facing||{x:0,y:1},geometry=attackGeometryOf(player);
      const hit={playerId:player.id,mapId:player.mapId,x:player.x,y:player.y,dx:direction.x,dy:direction.y,durationMs:ATTACK_VISUAL.durationMs,...geometry,power};
      if(['corvus','aquarius','cygnus','ophiuchus','gemini','aries','taurus','hercules','libra','corona-borealis','capricorn','leo'].includes(player.avatar.constellationId)||isWaterConstellation(player)){
      const cast=player.avatar.constellationId==='aquarius'?castAquarius:player.avatar.constellationId==='corvus'?castCorvus:player.avatar.constellationId==='cygnus'?castSwan:player.avatar.constellationId==='ophiuchus'?castOphiuchus:player.avatar.constellationId==='gemini'?castGemini:player.avatar.constellationId==='aries'?castAries:player.avatar.constellationId==='taurus'?castTaurus:player.avatar.constellationId==='hercules'?castHercules:player.avatar.constellationId==='libra'?castLibra:player.avatar.constellationId==='corona-borealis'?castCorona:player.avatar.constellationId==='capricorn'?castCapricorn:player.avatar.constellationId==='leo'?castLeo:castWater;
      const result=cast(room,player,now,{basic:true});
        if(result.targets?.some(target=>target.defeated))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,now)});
        if(room.swanAuraChanged){room.swanAuraChanged=false;roster(room);}
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId){
          io.to(viewer.socketId).emit('combat:hit',result.hit);
          io.to(viewer.socketId).emit('combat:vitals',{playerId:player.id,vitals:result.vitals});
          for(const target of result.playerTargets){io.to(viewer.socketId).emit('combat:player-hit',{mapId:player.mapId,...target});io.to(viewer.socketId).emit('combat:vitals',{playerId:target.targetId,vitals:target.vitals});}
          for(const fall of result.falls||[])io.to(viewer.socketId).emit('combat:corona-fall',fall);
        }
        return result;
      }
      if(isSagittarius(player)){
        const result=attackSagittarius(room,player,now);
        // 기존 공격 알림은 유지하되 원형 타격 대신 화살만 그립니다.
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId){
          io.to(viewer.socketId).emit('combat:hit',{...hit,kind:'sagittarius-arrow'});
          for(const effect of result.effects)io.to(viewer.socketId).emit('sagittarius:effect',effect);
          for(const target of result.playerTargets){
            io.to(viewer.socketId).emit('combat:player-hit',{mapId:player.mapId,...target});
            io.to(viewer.socketId).emit('combat:vitals',{playerId:target.targetId,vitals:target.vitals});
          }
        }
        if(result.targets.some(t=>t.defeated))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,now)});
        return {...result,target:result.targets[0]||null};
      }
      for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId)io.to(viewer.socketId).emit('combat:hit',hit);
      const targets=strikeMonsters(room,player,power,now);
      if(targets.some(target=>target.defeated))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,now)});
      const playerTargets=damagePlayersInArea(room,{mapId:player.mapId,x:player.x+direction.x*geometry.reach,y:player.y+direction.y*geometry.reach,radius:geometry.radius,sourceId:player.id},power,now);
      for(const result of playerTargets)for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId){
        io.to(viewer.socketId).emit('combat:player-hit',{...hit,...result});
        io.to(viewer.socketId).emit('combat:vitals',{playerId:result.targetId,vitals:result.vitals});
      }
      return {target:targets[0]||null,targets,playerTargets};
    },false);
    action('energy:collect',data=>{
      const session=socket.data.session;ensure(session,'먼저 교실에 입장해주세요.');
      const result=collectEnergyDrop(session.room,session.player,data.dropId,clock());
      if(result.amount>0)advanceMissions(session.room,session.player,'energy-collect',undefined,clock());
      roster(session.room);return result;
    });
    action('party:roll',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const result=rerollPartyLoot(s.room,s.player,data.dropId,clock());
      roster(s.room);return result;
    });
    // 이전 클라이언트에도 바로 안내하고, 폐지된 몬스터 상호작용은 실행하지 않습니다.
    action('combat:transform',()=>{
      const session=socket.data.session;ensure(session,'먼저 교실에 입장해주세요.');
      const candidate={...session.player,transformation:{active:true}};
      const safe=arrivePosition(session.room,session.player.mapId,session.player,candidate);
      const result=startTransformation(session.player,clock());Object.assign(session.player,safe);roster(session.room);return result;
    },false);
    action('combat:skill',data=>{
      const session=socket.data.session;ensure(session,'먼저 교실에 입장해주세요.');
      const {room,player}=session,now=clock();
      ensure(player.connected&&!player.away,'먼저 교실에 입장해주세요.');
      ensure(player.role==='teacher'||player.avatar.level>=2,'특수 스킬은 LV2부터 사용할 수 있어요.');
      ensure(!player.avatar.blackStar,'현재 검은별 상태입니다');
      ensure((data.slot??0)===0,'기존 보조 스킬은 더 이상 사용하지 않아요.');
      if(usesTeacherSkill(player)){
        const result=castTeacherSkill(room,player,now);
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId)
          for(const target of result.playerTargets)io.to(viewer.socketId).emit('combat:vitals',{playerId:target.targetId,vitals:target.vitals});
        if(result.targets.some(t=>t.defeated))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,now)});
        return result;
      }
      if(player.avatar.constellationId==='aquarius'){
        const result=castAquarius(room,player,now);
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId)
          io.to(viewer.socketId).emit('combat:vitals',{playerId:player.id,vitals:result.vitals});
        return result;
      }
      if(isWaterConstellation(player)){
        const result=castWater(room,player,now);
        if(player.waterAura)roster(room);
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId){
          io.to(viewer.socketId).emit('combat:vitals',{playerId:player.id,vitals:result.vitals});
          if(result.hit)io.to(viewer.socketId).emit('combat:hit',result.hit);
        }
        return result;
      }
      if(player.avatar.constellationId==='cygnus'){
        const result=castSwan(room,player,now);
        roster(room);
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId)
          io.to(viewer.socketId).emit('combat:vitals',{playerId:player.id,vitals:result.vitals});
        return result;
      }
      if(player.avatar.constellationId==='ophiuchus'){
        const result=castOphiuchus(room,player,now);
        roster(room);
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId){
          io.to(viewer.socketId).emit('combat:vitals',{playerId:player.id,vitals:result.vitals});
        }
        return result;
      }
      if(player.avatar.constellationId==='gemini'){
        const result=castGemini(room,player,now);
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId){
          io.to(viewer.socketId).emit('combat:vitals',{playerId:player.id,vitals:result.vitals});
          io.to(viewer.socketId).emit('combat:hit',result.hit);
        }
        return result;
      }
      if(player.avatar.constellationId==='aries'){
        const result=castAries(room,player,now);
        roster(room);
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId)
          io.to(viewer.socketId).emit('combat:vitals',{playerId:player.id,vitals:result.vitals});
        return result;
      }
      if(player.avatar.constellationId==='taurus'){
        const result=castTaurus(room,player,now);
        roster(room);
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId)
          io.to(viewer.socketId).emit('combat:vitals',{playerId:player.id,vitals:result.vitals});
        return result;
      }
      if(player.avatar.constellationId==='hercules'){
        const result=castHercules(room,player,now);
        roster(room);
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId)
          io.to(viewer.socketId).emit('combat:vitals',{playerId:player.id,vitals:result.vitals});
        return result;
      }
      if(player.avatar.constellationId==='libra'){
        const result=castLibra(room,player,now);
        roster(room);
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId)
          io.to(viewer.socketId).emit('combat:vitals',{playerId:player.id,vitals:result.vitals});
        return result;
      }
      if(player.avatar.constellationId==='corona-borealis'){
        const result=castCorona(room,player,now);
        roster(room);
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId)
          io.to(viewer.socketId).emit('combat:vitals',{playerId:player.id,vitals:result.vitals});
        return result;
      }
      if(player.avatar.constellationId==='capricorn'){
        const result=castCapricorn(room,player,now);
        roster(room);
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId)
          io.to(viewer.socketId).emit('combat:vitals',{playerId:player.id,vitals:result.vitals});
        return result;
      }
      if(player.avatar.constellationId==='leo'){
        const result=castLeo(room,player,now);
        roster(room);
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId){
          io.to(viewer.socketId).emit('combat:vitals',{playerId:player.id,vitals:result.vitals});
          io.to(viewer.socketId).emit('combat:leo-roar',result.visual);
        }
        if(result.targets.some(t=>t.defeated))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,now)});
        return result;
      }
      if(player.avatar.constellationId==='corvus'){
      const result=castCorvus(room,player,now,{basic:false});
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId){
          io.to(viewer.socketId).emit('combat:hit',result.hit);
          io.to(viewer.socketId).emit('combat:vitals',{playerId:player.id,vitals:result.vitals});
          for(const target of result.playerTargets){io.to(viewer.socketId).emit('combat:player-hit',{mapId:player.mapId,...target});io.to(viewer.socketId).emit('combat:vitals',{playerId:target.targetId,vitals:target.vitals});}
        }
        if(result.targets.some(t=>t.defeated))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,now)});
        return result;
      }
      if(isSagittarius(player)){
        const result=castSagittarius(room,player,data.slot??0,now);
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId){
          for(const effect of result.effects)io.to(viewer.socketId).emit('sagittarius:effect',effect);
          io.to(viewer.socketId).emit('combat:vitals',{playerId:player.id,vitals:result.vitals});
          for(const hit of result.playerTargets){
            io.to(viewer.socketId).emit('combat:player-hit',{mapId:player.mapId,...hit});
            io.to(viewer.socketId).emit('combat:vitals',{playerId:hit.targetId,vitals:hit.vitals});
          }
        }
        if(result.targets.some(t=>t.defeated))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,now)});
        return result;
      }
      ensure((data.slot??0)===0,'이 별자리의 보조 스킬은 준비 중이에요.');
      ensure(now-(lastSkills.get(player)??-Infinity)>=SKILL_COOLDOWN_MS,'스킬을 조금 천천히 사용해주세요.');
      lastSkills.set(player,now);
      const direction=player.facing||{x:0,y:1},geometry=attackGeometryOf(player);
      const effect=skillEffectOf(player.avatar.constellationId,Math.min(4,player.avatar.level));
      const hit={kind:'skill',playerId:player.id,mapId:player.mapId,x:player.x,y:player.y,dx:direction.x,dy:direction.y,effectId:effect?.id||null,durationMs:effect?.durationMs??ATTACK_VISUAL.durationMs,...geometry};
      if(player.avatar.constellationId==='corvus'){hit.vfxId='skill-lv'+Math.min(4,player.avatar.level);hit.durationMs=1000;}
      // 아직 효과 수치는 정하지 않았습니다. 이후 스킬도 동일한 다중 대상 판정을 사용할 수 있습니다.
      hit.playerTargetIds=playersInArea(room,{mapId:player.mapId,x:player.x+direction.x*geometry.reach,y:player.y+direction.y*geometry.reach,radius:geometry.radius,sourceId:player.id}).map(p=>p.id);
      hit.monsterTargetIds=monstersInAttackArea(room,player,now).map(m=>m.id);
      for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId)io.to(viewer.socketId).emit('combat:hit',hit);
      // 전투 스킬은 방향 표시만 제공합니다. 주간 카드 능력·마나·HP를 소비하지 않습니다.
      return {ready:false,direction,effectId:effect?.id||null};
    },false);
    action('monster:info',()=>{ensure(false,'몬스터는 Q 공격키로 직접 공격해주세요.');},false);
    const enter=session=>{
      const credentials=session.credentials;delete session.credentials;
      socket.data.session=session;joinChannel(session);ensureDailyMissions(session.room,clock());roster(session.room);
      const {room,player}=session;
      // 방 공개 기록과 이 사람에게만 왔던 개인 안내(notes)를 시간순으로 합쳐 돌려줍니다.
      const messages=visibleHistory(room,player);
      return {token:player.token,selfId:player.id,room:store.snapshot(room,player,clock()),chat:{messages},...(credentials?{credentials}:{})};
    };
    const notJoined=()=>ensure(!socket.data.session,'먼저 현재 교실에서 나가주세요.');
    const authBucket=()=>{
      const ip=socket.handshake.address,now=Date.now();
      let bucket=authAttempts.get(ip);
      if(!bucket || now-bucket.at>60_000){bucket={at:now,count:0};authAttempts.set(ip,bucket);}
      ensure(bucket.count<10,'접속 코드 확인을 여러 번 시도했어요. 1분 후 다시 시도해주세요.');
      return bucket;
    };
    const authorizeTeacher=(data,roomCode)=>{
      const bucket=authBucket();
      if(equalSecret(data.teacherKey,teacherKey))return null;
      const access=roomCode&&(store.rooms.get(roomCode)?.teacherAccess||store.records?.get(roomCode)?.teacherAccess);
      if(matchesTeacherCode(teacherKey,data.teacherKey,access))return access.digest;
      bucket.count++;throw new GameError('선생님 접속 코드와 교실 코드를 확인해주세요.');
    };
    const ownerOnly=()=>ensure(socket.data.owner===true,'홈페이지 관리자만 할 수 있어요.');
    const adminClasses=()=>[...store.records.values()].map(r=>({code:r.code,title:r.title,open:[...(store.rooms.get(r.code)?.players.values()||[])].some(p=>p.role==='teacher'&&p.connected),teacherName:r.teacherAccess?.label||'',assigned:!!r.teacherAccess,teacherCode:r.teacherAccess?.encryptedCode?(()=>{try{return decryptTeacherCode(teacherKey,r.teacherAccess.encryptedCode);}catch{return null;}})():null}));
    const adminRoom=code=>{
      ensure(typeof code==='string'&&/^[A-Z2-9]{6}$/.test(code),'교실 코드를 확인해주세요.');
      const record=store.records.get(code);ensure(record,'교실을 찾지 못했어요.');
      return {record,room:store.rooms.get(code)};
    };
    const teacherLabel=value=>{
      const label=typeof value==='string'?value.normalize('NFKC').trim():'';
      ensure(label.length>=1&&label.length<=40&&!/[\u0000-\u001f\u007f]/.test(label),'선생님 이름은 1~40자로 적어주세요.');
      return label;
    };
    const changeTeacherAccess=(code,label)=>{
      const {record,room}=adminRoom(code),previous=room?.teacherAccess?.digest||record.teacherAccess?.digest;
      const issued=label?issueTeacherCode(teacherKey):null;
      const access=issued?{digest:issued.digest,encryptedCode:issued.encryptedCode,label,createdAt:clock()}:null;
      if(room)room.teacherAccess=access;
      store.records.set(code,{...record,...(access?{teacherAccess:access}:{teacherAccess:null})});
      if(previous){
        for(const session of [...store.sessions.values()])if(session.room.code===code&&session.teacherAccessDigest===previous){
          const peer=io.sockets.sockets.get(session.player.socketId);
          store.remove(session.room,session.player);
          if(peer){peer.data.session=null;deliver(()=>{peer.leave(code);peer.emit('room:closed',{message:'선생님 접속 코드가 바뀌었어요. 새 코드로 다시 입장해주세요.'});});}
        }
      }
      if(room&&previous)roster(room);
      return issued?.code||null;
    };
    action('admin:login',data=>{
      notJoined();const bucket=authBucket();
      if(!equalSecret(data.key,adminPassword)){bucket.count++;throw new GameError('관리자 비밀번호를 확인해주세요.');}
      ensure(persistent,'저장 기능이 켜져 있지 않아요.');socket.data.owner=true;
      return {classes:adminClasses()};
    },false);
    action('admin:list',()=>{ownerOnly();return {classes:adminClasses()};},false);
    action('admin:create',data=>{
      ownerOnly();const label=teacherLabel(data.teacherName);
      const session=store.create({title:data.title,allowedNames:[],allowEmpty:true},socket.id,{archivedCreation:true});
      const room=session.room;room.adminCreated=true;store.remove(room,session.player);
      const issued=issueTeacherCode(teacherKey);
      room.teacherAccess={digest:issued.digest,encryptedCode:issued.encryptedCode,label,createdAt:clock()};
      store.destroy(room);
      return {code:room.code,teacherCode:issued.code,classes:adminClasses()};
    });
    action('admin:grant',data=>{ownerOnly();const teacherCode=changeTeacherAccess(data.code,teacherLabel(data.teacherName));return {teacherCode,classes:adminClasses()};});
    action('admin:revoke',data=>{ownerOnly();changeTeacherAccess(data.code,null);return {classes:adminClasses()};});
    action('admin:delete',data=>{
      ownerOnly();
      const {room}=adminRoom(data.code);
      ensure(data.confirmCode===data.code,'삭제하려는 교실 코드를 정확히 입력해주세요.');
      if(room){
        for(const player of room.players.values()){
          const peer=io.sockets.sockets.get(player.socketId);
          if(peer){peer.data.session=null;deliver(()=>{peer.emit('room:closed',{message:'관리자가 교실을 삭제했어요. 이 교실에는 다시 입장할 수 없어요.'});peer.leave(room.code);});}
        }
      }
      store.deleteClass(data.code);
      return {classes:adminClasses()};
    });
    action('room:create',data=>{
      notJoined();authorizeTeacher(data);ensure(equalSecret(data.teacherKey,teacherKey),'홈페이지 관리자만 교실을 만들 수 있어요.');
      return enter(store.create({...data,allowEmpty:false},socket.id));
    });
    action('room:list',data=>{notJoined();ensure(persistent,'저장 기능이 켜져 있지 않아요.');
      if(equalSecret(data.teacherKey,teacherKey)){authorizeTeacher(data);return {classes:store.list()};}
      const bucket=authBucket(),classes=[...store.records.values()].filter(r=>matchesTeacherCode(teacherKey,data.teacherKey,r.teacherAccess)).map(r=>({code:r.code,title:r.title,open:store.rooms.has(r.code)}));
      if(!classes.length){bucket.count++;throw new GameError('선생님 접속 코드를 확인해주세요.');}
      return {classes};
    });
    action('room:studentLink',()=>{
      const s=socket.data.session;ensure(s?.player.role==='teacher','선생님만 할 수 있어요.');
      return {url:(publicOrigin||'http://'+socket.handshake.headers.host)+'/?class='+s.room.code};
    });
    action('room:open',data=>{notJoined();ensure(persistent,'저장 기능이 켜져 있지 않아요.');
      const code=typeof data.code==='string'?data.code.trim().toUpperCase():'';
      const digest=authorizeTeacher(data,code),session=store.open(data,socket.id);
      if(digest){
        // 기존 검증값 전용 교실은 정상 접속에 사용한 코드만 암호화 보관합니다.
        // 발급된 코드를 바꾸지 않으며 실패 시 접속/저장이 함께 롤백됩니다.
        if(!session.room.teacherAccess.encryptedCode)
          session.room.teacherAccess.encryptedCode=encryptTeacherCode(teacherKey,data.teacherKey);
        session.teacherAccessDigest=digest;store.sessions.set(session.player.token,session);
      }
      return enter(session);
    });
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
    action('teacher:inventory:read',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      return teacherInventoryView(s.room,s.player,data.playerId);
    },false);
    for(const mode of ['give','remove'])action(`teacher:inventory:${mode}`,data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {target,message}=adjustTeacherInventory(s.room,s.player,data,mode);
      whisper(s.room,target,'선생님이 가방을 조정했어요. '+message);roster(s.room);
      return {...teacherInventoryView(s.room,s.player,target.id),message};
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
    action('session:resume',data=>{notJoined();const old=store.sessions.get(data.token);if(old?.player.role==='student')ensure(studentOpen(),STUDENT_HOURS_MESSAGE);
      if(old?.teacherAccessDigest)ensure(old.room.teacherAccess?.digest===old.teacherAccessDigest,'선생님 접속 코드가 바뀌었어요. 다시 입장해주세요.');
      return enter(store.resume(data.token,socket.id));
    });
    action('room:leave',()=>{detach(socket,true);return {};});
    // 교실 종료는 해당 교실에 입장한 선생님만 할 수 있습니다.
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
      if(p.mapId===WHALE_STOMACH_ID)ensure(scope.channel==='map','고래 배 속에서는 함께 갇힌 친구와만 대화할 수 있어요.');
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
    action('party:invite',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const invitation=inviteParty(s.room,s.player,data.targetId,clock());
      roster(s.room);return {invitation};
    },false);
    action('party:respond',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const result=respondParty(s.room,s.player,data.requestId,data.accept,clock());
      roster(s.room);return result;
    },false);
    action('party:leave',()=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      ensure(leaveParty(s.room,s.player.id,clock()),'현재 참여 중인 파티가 없어요.');
      roster(s.room);return {};
    },false);
    action('constellation-ability:pair-respond',data=>{
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 짝 신청에 답할 수 있어요.');
      const invite=s.room.piscesInvites?.get(data.requestId),borrowed=invite?.borrowedFromOphiuchus?
        borrowedOphiuchusActor(s.room.players.get(invite.fromId),clock()):null;
      const source=invite&&s.room.players.get(invite.fromId),cetusBonus=source&&!borrowed?constellationAbilityStatus(source,clock()).cetusBonusUse:false;
      const result=respondPiscesPair(s.room,s.player,data.requestId,data.accept,clock(),borrowed?.actor);
      if(result.accepted&&borrowed){borrowed.copied.used=true;borrowed.save();}
      if(result.accepted&&source&&!borrowed)cetusAfterAbility(source,clock(),cetusBonus);
      if(result.accepted){
        announce(s.room,`${result.invite.fromNickname} 친구와 ${s.player.nickname} 친구가 ${result.invite.days}일 동안 물고기자리 짝이 되었어요. 책상과 급식 자리를 함께해 주세요.`);
      }else{
        const source=s.room.players.get(result.invite.fromId);if(source)whisper(s.room,source,s.player.nickname+' 친구가 짝 신청을 거절했어요. 주간 능력은 사용되지 않았어요.');
      }
      roster(s.room);return result;
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
          Object.assign(student,exitPosition(room,previousPlanet||planet,student),{mapId:PLAZA_ID,input:{x:0,y:0,at:0}});
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
    action('planet:move',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s,planet=requirePlanet(room,data);
      ensure(p.role==='student'&&p.avatar.departmentId===planet.id,'소속 부원만 행성 위치를 옮길 수 있어요.');
      ensure(p.connected&&!p.away&&!p.avatar.blackStar&&!isDefeated(p),'지금은 행성 위치를 옮길 수 없어요.');
      ensure(p.mapId===PLAZA_ID,'광장에서 행성 위치를 골라주세요.');
      ensure(Number.isFinite(data.x)&&Number.isFinite(data.y),'행성 위치를 확인해주세요.');
      const x=Math.round(data.x),y=Math.round(data.y);
      if(x===planet.x&&y===planet.y)return {planetId:planet.id,x,y,moved:false};
      ensure(placementFree(room,x,y,planet.id),'오른쪽 아래 부서행성 광장의 빈자리를 골라주세요. 다른 행성과 떨어져 있어야 해요.');
      movePlanet(room,planet,x,y);
      roster(room);announce(room,'"'+planet.name+'" 행성의 위치를 옮겼어요.');
      return {planetId:planet.id,x,y,moved:true};
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
        if(player.mapId===mapId) Object.assign(player,exitPosition(room,planet,player),{mapId:PLAZA_ID,input:{x:0,y:0,at:0}});
        if(player.avatar.departmentId===planet.id) player.avatar.departmentId=null;
      }
      roster(room);
      announce(room,'선생님이 "'+planet.name+'" 행성을 없앴어요.');
      return {};
    });
    const completeMembership=(room,planet,p)=>{
      // 승인 대기 중 다른 행성에 가입했거나 옛 신청이 복원된 경우에도 재검사합니다.
      requireNoDepartment(p);
      p.avatar.departmentId=planet.id;clearJoinRequests(room,p.id);
      roster(room);announce(room,p.nickname+' 친구가 '+planet.name+'에 가입했어요.');
    };
    action('planet:join',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      const planet=requirePlanet(room,data);
      ensure(p.role==='student','선생님은 모든 행성에 들어갈 수 있어요.');
      ensure(p.mapId===PLAZA_ID,'광장에서만 행성에 가입할 수 있어요.');
      const previousId=p.avatar.departmentId;
      ensure(previousId!==planet.id,'이미 '+planet.name+' 소속이에요.');
      const result=requestMembership(room,planet,p,clock());
      if(result.pending){roster(room);return {pending:true,message:'가입 신청을 보냈어요. 부원의 승인을 기다려주세요.'};}
      completeMembership(room,planet,p);return {pending:false,message:planet.name+'에 가입했어요.'};
    });
    // 우체통은 내부의 실제 위치와 서버에 저장된 소속을 함께 확인합니다.
    const mailboxAccess=data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const planet=requirePlanet(s.room,data),p=s.player;
      ensure(p.role==='teacher'||p.avatar.departmentId===planet.id,'소속 부원만 가입 신청을 확인할 수 있어요.');
      const object=mapOf(interiorIdOf(planet.id)).objects.find(o=>o.kind==='mailbox');
      ensure(p.mapId===interiorIdOf(planet.id)&&isNear(p,object),'행성 안 우체통에 가까이 가주세요.');
      return {...s,planet};
    };
    action('planet:mailbox:get',data=>{const {room,planet}=mailboxAccess(data);return mailboxView(room,planet);},false);
    action('planet:mailbox:decide',data=>{
      const {room,planet}=mailboxAccess(data);
      ensure(typeof data.accept==='boolean','승인 또는 거절을 골라주세요.');
      const pending=(planet.joinRequests||[]).find(r=>r.playerId===data.playerId);
      ensure(pending,'이미 처리되었거나 취소된 가입 신청이에요.');
      const applicant=room.players.get(pending.playerId);ensure(applicant?.role==='student','신청자를 찾지 못했어요.');
      if(data.accept)completeMembership(room,planet,applicant);
      else{planet.joinRequests=planet.joinRequests.filter(r=>r!==pending);roster(room);whisper(room,applicant,planet.name+' 가입 신청이 거절되었어요.');}
      return {...mailboxView(room,planet),message:data.accept?'가입을 승인했어요.':'가입 신청을 거절했어요.'};
    });
    action('planet:join:cancel',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');const planet=requirePlanet(s.room,data);
      planet.joinRequests=(planet.joinRequests||[]).filter(r=>r.playerId!==s.player.id);roster(s.room);return {};
    });
    action('planet:leave',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      const planet=requirePlanet(room,data);
      ensure(p.avatar.departmentId===planet.id,planet.name+' 소속이 아니에요.');
      if(p.mapId===interiorIdOf(planet.id)) Object.assign(p,exitPosition(room,planet,p),{mapId:PLAZA_ID,input:{x:0,y:0,at:0}});
      p.avatar.departmentId=null;
      clearJoinRequests(room,p.id);
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
      Object.assign(p,spawnInside(room,mapId,p),{mapId,input:{x:0,y:0,at:0}});
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
      Object.assign(p,exitPosition(room,planet,p),{mapId:PLAZA_ID,input:{x:0,y:0,at:0}});
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
      Object.assign(p,arrivePosition(room,data.to,gate.arrival,p),{mapId:data.to,input:{x:0,y:0,at:0}});
      advanceMissions(room,p,'map-travel',undefined,clock());
      roster(room);
      return {};
    });
    const interiorAccess=data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s,planet=requirePlanet(room,data),object=interiorDecorTarget(data.objectId);
      ensure(p.role==='teacher'||p.avatar.departmentId===planet.id,'우리 부서의 오브젝트만 꾸밀 수 있어요.');
      ensure(p.mapId===interiorIdOf(planet.id),'부서행성 안에서만 꾸밀 수 있어요.');
      ensure(object,'꾸밀 오브젝트를 골라주세요.');
      const control=mapOf(p.mapId).objects.find(o=>o.id===data.controlId&&o.kind==='interior-decor-machine');
      ensure(control&&isNear(p,control),'제어장치 가까이에서 꾸며주세요.');
      return {room,p,planet,object};
    };
    action('planet:interior-decor:unlock',data=>{
      const {room,p,planet,object}=interiorAccess(data),tier=interiorUpgrade(data.shapeId);
      ensure(p.role==='student','해금은 소속 학생이 자신의 별 파편으로 할 수 있어요.');
      ensure(tier,'해금할 모습을 골라주세요.');
      if(interiorUpgradeUnlocked(planet,object.id,tier.id))return {alreadyUnlocked:true};
      ensure(p.starShards>=tier.price,`별 파편 ${tier.price}개가 필요해요.`);
      p.starShards-=tier.price;planet.interiorUnlocks??={};planet.interiorUnlocks[object.id]??=[];planet.interiorUnlocks[object.id].push(tier.id);
      roster(room);return {objectId:object.id,shapeId:tier.id,price:tier.price};
    });
    action('planet:interior-decor:set',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s,planet=requirePlanet(room,data);
      ensure(p.role==='teacher'||p.avatar.departmentId===planet.id,'우리 부서의 오브젝트만 꾸밀 수 있어요.');
      ensure(p.mapId===interiorIdOf(planet.id),'부서행성 안에서만 꾸밀 수 있어요.');
      const object=interiorDecorTarget(data.objectId);
      ensure(object,'꾸밀 오브젝트를 골라주세요.');
      const controlId=data.controlId,control=controlId==='department-control-machine'
        ?mapOf(p.mapId).objects.find(item=>item.id===controlId&&item.kind==='interior-decor-machine'):null;
      ensure(control&&isNear(p,control),'제어장치 가까이에서 꾸며주세요.');
      ensure(interiorDecorColor(data.colorId)&&object.shapes.some(shape=>shape.id===data.shapeId),'준비된 색과 모양 중에서 골라주세요.');
      ensure(interiorUpgradeUnlocked(planet,object.id,data.shapeId),'먼저 이 모습을 해금해 주세요.');
      const style={colorId:data.colorId,shapeId:data.shapeId};
      planet.interiorDecor??={};planet.interiorDecor[object.id]=style;
      roster(room);
      return {planetId:planet.id,objectId:object.id,style};
    });
    const warningRockAccess=data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const planet=requirePlanet(s.room,data),p=s.player;
      ensure(p.mapId===interiorIdOf(planet.id),'부서행성 안에서만 경고 제어돌을 이용할 수 있어요.');
      ensure(p.role==='teacher'||p.avatar.departmentId===planet.id,'소속 학생만 이 부서의 경고를 줄 수 있어요.');
      const rock=mapOf(p.mapId).objects.find(o=>o.kind==='warning-rock');
      ensure(rock&&isNear(p,rock),'경고 제어돌에 더 가까이 가주세요.');
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
      whisper(room,target,result.ability?.negated?result.message:planet.name+'에서 경고를 받았어요. ('+result.count+'/'+result.threshold+'회) 이유: '+reason+(result.blackStar?' 검은별이 되어 블랙홀로 이동했어요.':'')+([result.ability?.message,result.blackAbility?.message].filter(Boolean).join(' ')));
      if(result.mirrored?.active){const mate=room.players.get(result.mirrored.targetId);if(mate)whisper(room,mate,`물고기자리 짝 친구가 받은 경고를 함께 받았어요. (${result.mirrored.count}/${result.threshold}회) 이유: ${reason}`+(result.mirrored.blackStar?' 검은별이 되어 블랙홀로 이동했어요.':''));}
      roster(room);
      return {...warningView(room,planet),count:result.count,blackStar:result.blackStar,message:result.message,ability:result.ability,blackAbility:result.blackAbility};
    });
    action('warning:teacher:list',()=>{
      const s=socket.data.session;ensure(s?.player.role==='teacher','선생님만 검은별 명단을 볼 수 있어요.');
      return {students:blackStarList(s.room)};
    });
    action('warning:teacher:history',data=>{
      const s=socket.data.session;ensure(s?.player.role==='teacher','선생님만 경고 내역을 볼 수 있어요.');
      const offset=data?.offset??0;
      ensure(Number.isSafeInteger(offset)&&offset>=0,'경고 내역 위치가 올바르지 않아요.');
      return teacherWarningHistory(s.room,offset);
    });
    action('warning:teacher:delete',data=>{
      const s=socket.data.session;ensure(s?.player.role==='teacher','선생님만 경고를 삭제할 수 있어요.');
      const result=deleteTeacherWarning(s.room,data?.warningId);
      if(result.released&&result.target)whisper(s.room,result.target,'선생님이 경고를 삭제해 검은별 상태가 해제됐어요.');
      roster(s.room);
      return {...teacherWarningHistory(s.room),released:result.released,remaining:result.remaining};
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
      if(journeyPillar(player,pillar.id,clock()))roster(room);
      if(kind==='weekly')return {kind,...weeklyRewards(room,clock()),canReset:player.role==='teacher'};
      if(kind==='effects')return {kind,canComplete:player.role==='teacher',rows:templeItemRows(room,player,clock())};
      if(kind==='timetable'){
        if(advanceMissions(room,player,'timetable-read',undefined,clock()))roster(room);
        return {kind,...readTimetable(room),canEdit:player.role==='teacher'};
      }
      return {kind,...readDaily(room,kind,clock()),canEdit:player.role==='teacher'};
    });
    action('temple:weekly:reset',data=>{
      const {room,player,pillar}=templeAccess(data);
      ensure(pillar.service==='weekly','이번 주 받은 별 기둥에서 초기화해주세요.');
      const result=resetWeeklyRewards(room,player,clock());roster(room);
      return {kind:'weekly',...result,canReset:true};
    });
    action('temple:save',data=>{
      const {room,player,pillar}=templeAccess(data);ensure(player.role==='teacher','선생님만 내용을 바꿀 수 있어요.');
      ensure(pillar.service==='notice','알림장 기둥에서 저장해주세요.');
      ensure(typeof data.text==='string'&&data.text.length<=2000,'내용은 2000자 이내로 적어주세요.');
      try{const result=saveNotice(room,data.text,data.taskLineIndexes??[],clock());roster(room);return {kind:pillar.service,...result,canEdit:true};}
      catch(error){if(error.message.startsWith('Invalid temple:'))throw new GameError('알림장 과제 표시를 확인해주세요. 비어 있지 않은 줄만 체크할 수 있어요.');throw error;}
    });
    action('temple:timetable:save',data=>{
      const {room,player,pillar}=templeAccess(data);ensure(player.role==='teacher','선생님만 시간표를 바꿀 수 있어요.');
      ensure(pillar.service==='timetable','오늘의 시간표 기둥 가까이에서 저장해주세요.');
      try{const result=saveTimetable(room,data.cells);roster(room);return {kind:'timetable',...result,canEdit:true};}
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
      ensure(!assignment.completedIds.includes(player.id),'선생님이 이미 확인한 과제예요.');
      const tasks=addTask(player,{assignmentId:assignment.id,text:line,sourceDate:notice.date,lineIndex:data.lineIndex},clock());
      roster(room);return {tasks};
    });
    const assignmentAccess=()=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const portal=MAP.objects.find(o=>o.kind==='andromeda');
      ensure(s.player.mapId===PLAZA_ID&&isNear(s.player,portal),'과제별서고 가까이에서 확인해주세요.');
      return s;
    };
    action('assignment:read',()=>{
      const s=assignmentAccess();return recentAssignments(s.room,clock(),s.player);
    });
    action('assignment:status:set',data=>{
      const s=assignmentAccess();ensure(s.player.role==='student','학생만 과제 상태를 바꿀 수 있어요.');
      const assignment=typeof data.assignmentId==='string'?assignmentById(s.room,data.assignmentId):null;
      ensure(assignment&&recentAssignments(s.room,clock()).weeks.some(week=>week.assignments.some(value=>value.id===assignment.id)),'최근 과제에서 골라주세요.');
      ensure(!assignment.completedIds.includes(s.player.id),'선생님이 확인한 과제는 바꿀 수 없어요.');
      const wasSubmitted=s.player.tasks?.some(task=>task.assignmentId===assignment.id&&task.status==='submitted');
      setTaskStatus(s.player,assignment,data.status,clock());
      const challengeRewards=data.status==='submitted'&&!wasSubmitted?rewardLeoSubmission(s.room,s.player,clock()):[];
      roster(s.room);
      return {...recentAssignments(s.room,clock(),s.player),challengeRewards};
    });
    action('assignment:confirm',data=>{
      const s=assignmentAccess();ensure(s.player.role==='teacher','선생님만 과제를 확인할 수 있어요.');
      const target=typeof data.studentId==='string'?s.room.players.get(data.studentId):null;
      const assignment=typeof data.assignmentId==='string'?assignmentById(s.room,data.assignmentId):null;
      const task=target?.tasks?.find(value=>value.assignmentId===assignment?.id);
      ensure(target?.role==='student'&&assignment&&task?.status==='submitted','제출된 학생 과제를 골라주세요.');
      markAssignmentDone(s.room,assignment.id,target.id);completeTask(target,task.id);roster(s.room);
      return recentAssignments(s.room,clock(),s.player);
    });
    action('assignment:incomplete',()=>{
      const s=assignmentAccess();ensure(s.player.role==='teacher','선생님만 과제 미완료자를 볼 수 있어요.');
      return incompleteAssignments(s.room,clock());
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
    const oneStrokeAccess=()=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const machine=STREET.objects.find(o=>o.gameId==='path');
      ensure(s.player.connected&&!s.player.away&&s.player.socketId===socket.id&&s.player.mapId===STREET_ID&&isNear(s.player,machine),'별 길 한번에 그리기 오락기 가까이에서 이용해 주세요.');return s;
    };
    action('one-stroke:start',data=>{const s=oneStrokeAccess();return startOneStroke(s.player,data.difficulty);},false);
    action('one-stroke:complete',data=>{const s=oneStrokeAccess(),result=completeOneStroke(s.player,data);if(advanceMissions(s.room,s.player,'one-stroke-win',result.difficulty,clock()))roster(s.room);return result;});
    const baseballAccess=()=>{
      const session=socket.data.session;ensure(session,'먼저 교실에 입장해주세요.');
      const machine=STREET.objects.find(object=>object.gameId==='baseball');
      ensure(session.player.mapId===STREET_ID&&isNear(session.player,machine),'숫자야구 오락기 가까이에서 이용해 주세요.');
      return session;
    };
    action('baseball:start',data=>{
      const session=baseballAccess();return baseballRuns.start(session.player,data?.difficulty);
    },false);
    action('baseball:submit',data=>{
      const session=baseballAccess(),result=baseballRuns.submit(session.player,data);
      if(result.won&&advanceMissions(session.room,session.player,'baseball-win',result.difficulty,clock()))roster(session.room);
      return result;
    });
    const signalAccess=()=>{
      const session=socket.data.session;ensure(session,'먼저 교실에 입장해주세요.');
      const machine=STREET.objects.find(object=>object.gameId==='signal');
      ensure(session.player.mapId===STREET_ID&&isNear(session.player,machine),'우주 신호 오락기 가까이에서 이용해 주세요.');
      return session;
    };
    action('signal:ranking',()=>{const session=signalAccess();return {ranking:signalRanking(session.room),canReset:session.player.role==='teacher'};},false);
    action('signal:ranking:reset',()=>{
      const session=signalAccess();resetWeeklyRanking(session.room,session.player,'signal');
      deliver(()=>io.to(session.room.code).emit('signal:ranking',{ranking:[]}));roster(session.room);
      return {ranking:[],canReset:true};
    });
    action('signal:start',()=>{const session=signalAccess();return signalRuns.start(session.player);},false);
    action('signal:choose',data=>{
      const session=signalAccess(),result=signalRuns.choose(session.room,session.player,data,clock());
      if(result.stageCleared){
        advanceMissions(session.room,session.player,'signal-stage',result.stageCleared,clock());
        deliver(()=>io.to(session.room.code).emit('signal:ranking',{ranking:result.ranking}));roster(session.room);
      }
      return result;
    });
    const sudokuAccess=()=>{
      const session=socket.data.session;ensure(session,'먼저 교실에 입장해주세요.');
      const machine=STREET.objects.find(object=>object.gameId==='sudoku');
      ensure(session.player.mapId===STREET_ID&&isNear(session.player,machine),'별빛 스도쿠 오락기 가까이에서 이용해 주세요.');return session;
    };
    action('sudoku:start',data=>{const s=sudokuAccess();return sudokuRuns.start(s.player,data.difficulty);},false);
    action('sudoku:check',data=>{const s=sudokuAccess();return sudokuRuns.check(s.player,data);},false);
    action('sudoku:complete',data=>{const s=sudokuAccess(),result=sudokuRuns.complete(s.player,data);
      if(advanceMissions(s.room,s.player,'sudoku-win',result.difficulty,clock()))roster(s.room);return result;});
    const avatarSession=()=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');return s;};
    action('evolution:info',()=>{const s=avatarSession(),result=evolutionInfo(s.room,s.player);if(journeyGoal(s.player,'evolution-star'))roster(s.room);return result;});
    action('evolution:change',data=>{const s=avatarSession(),result=changeConstellation(s.room,s.player,data,clock());roster(s.room);return result;});
    action('evolution:evolve',data=>{const s=avatarSession(),result=evolveConstellation(s.room,s.player,data);roster(s.room);return result;});
    action('evolution:teacher-select',data=>{const s=avatarSession(),result=selectTeacherEvolution(s.room,s.player,data);roster(s.room);return result;});
    action('growth:info',()=>{const s=avatarSession(),result=growthInfo(s.room,s.player);if(journeyGoal(s.player,'growth-star'))roster(s.room);return result;});
    action('growth:buy',data=>{const s=avatarSession(),result=buyExperience(s.room,s.player,data);roster(s.room);return result;});
    const tetrisAccess=()=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const machine=STREET.objects.find(o=>o.gameId==='tetris');
      ensure(s.player.mapId===STREET_ID&&isNear(s.player,machine),'별 테트리스 오락기 가까이에서 이용해 주세요.');return s;
    };
    action('tetris:ranking',()=>{const s=tetrisAccess();return {ranking:tetrisRanking(s.room),canReset:s.player.role==='teacher'};},false);
    action('tetris:ranking:reset',()=>{const s=tetrisAccess();resetWeeklyRanking(s.room,s.player,'tetris');
      deliver(()=>io.to(s.room.code).emit('tetris:ranking',{ranking:[]}));roster(s.room);return {ranking:[],canReset:true};});
    action('tetris:start',()=>{const s=tetrisAccess();return tetrisRuns.start(s.player);},false);
    action('tetris:state',data=>{const s=tetrisAccess();return tetrisRuns.state(s.player,data);},false);
    action('tetris:move',data=>{const s=tetrisAccess();return tetrisRuns.move(s.player,data);},false);
    action('tetris:finish',data=>{const s=tetrisAccess(),result=tetrisRuns.finish(s.room,s.player,data);
      if(result.lines)advanceMissions(s.room,s.player,'tetris-lines',result.lines,clock());
      deliver(()=>io.to(s.room.code).emit('tetris:ranking',{ranking:result.ranking}));roster(s.room);return result;});
    const dodgeAccess=()=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const machine=STREET.objects.find(o=>o.gameId==='dodge');
      ensure(s.player.mapId===STREET_ID&&isNear(s.player,machine),'별 피하기 오락기 가까이에서 이용해주세요.');return s;
    };
    action('dodge:ranking',()=>{const s=dodgeAccess();return {ranking:dodgeRanking(s.room),canReset:s.player.role==='teacher'};});
    const memoryAccess=()=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const machine=STREET.objects.find(o=>o.gameId==='memory');
      ensure(s.player.mapId===STREET_ID&&isNear(s.player,machine),'짝맞추기 오락기 가까이에서 이용해주세요.');return s;
    };
    action('memory:ranking',()=>{const s=memoryAccess();return {ranking:memoryRanking(s.room),canReset:s.player.role==='teacher'};});
    action('memory:start',data=>{const s=memoryAccess();return startMemoryRun(s.room,s.player,data);});
    action('memory:flip',data=>{
      const s=memoryAccess(),result=flipMemoryCard(s.room,s.player,data);
      if(result.won){advanceMissions(s.room,s.player,'memory-win',undefined,clock());deliver(()=>io.to(s.room.code).emit('memory:ranking',{ranking:result.ranking}));roster(s.room);}
      return result;
    });
    action('memory:cancel',data=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');cancelMemoryRun(s.room,s.player,data.runId);return {};});
    for(const [game,access] of [['memory',memoryAccess],['dodge',dodgeAccess]]){
      action(`${game}:ranking:reset`,()=>{
        const s=access();resetWeeklyRanking(s.room,s.player,game);
        const result={ranking:[],canReset:true};
        deliver(()=>io.to(s.room.code).emit(`${game}:ranking`,{ranking:[]}));
        roster(s.room);
        return result;
      });
    }
    action('dodge:start',()=>{const s=dodgeAccess();return startDodgeRun(s.room,s.player);});
    action('dodge:cancel',data=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');cancelDodgeRun(s.room,s.player,data.runId);return {};});
    // 방향 입력에는 디스크 저장이 필요 없습니다. 점수와 충돌 판정은 서버가 계산합니다.
    socket.on('dodge:input',data=>{
      const s=socket.data.session;if(!s||!data||typeof data!=='object'||(s.player.role==='student'&&!studentOpen()))return;
      if(activeAriesSleep(s.player,clock()))return;
      setDodgeInput(s.room,s.player,data);
    });
    const requireCrafting=()=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const p=s.player,machine=STREET.objects.find(o=>o.kind==='crafting');
      ensure(p.connected&&!p.away,'먼저 교실에 입장해주세요.');
      ensure(!isDefeated(p)&&!p.avatar.blackStar,'지금은 조합기를 이용할 수 없어요.');
      ensure(p.mapId===STREET_ID&&machine&&isNear(p,machine),'별빛 조합기에 더 가까이 가주세요.');
      return s;
    };
    action('crafting:open',()=>{
      const {player}=requireCrafting();return {enabled:true,fee:shardCost(player,CRAFTING.fee)};
    },false);
    action('recipes:learned',data=>{
      const s=socket.data.session;
      ensure(s?.player.role==='student'&&s.player.connected&&!s.player.away,'학생 본인만 배운 조합법을 볼 수 있어요.');
      ensure((data.playerId===undefined||data.playerId===s.player.id)&&(data.targetId===undefined||data.targetId===s.player.id),'다른 학생의 조합법은 볼 수 없어요.');
      return {recipes:learnedRecipesView(s.player,availableCraftingRecipes(craftingRecipes))};
    },false);
    action('crafting:recipes',data=>{
      const s=socket.data.session;
      ensure(s?.player.role==='teacher','선생님만 조합법을 볼 수 있어요.');
      requireCrafting();
      ensure([2,3,4,5].includes(data.level),'LV2~LV5 중 하나를 골라주세요.');
      // 비공개 파일의 필요한 필드만 인증된 교사에게 응답합니다. 방 방송/공개 스냅샷에는 넣지 않습니다.
      const recipes=availableCraftingRecipes(craftingRecipes).filter(r=>itemOf(r.output.id)?.level===data.level).map(r=>({
        output:{id:r.output.id,quantity:1},ingredients:r.ingredients.map(p=>({id:p.id,quantity:p.quantity})),
        ...(r.cosmicEnergy?{starShards:r.starShards,cosmicEnergy:r.cosmicEnergy}:{})
      }));
      return {level:data.level,recipes};
    },false);
    action('crafting:combine',data=>{
      const {room,player}=requireCrafting();
      const result=attemptCraft(player,data.ingredients,{recipes:craftingRecipes});
      const messages={'invalid-recipe':'조합법을 준비 중이에요.','invalid-input':'조합 재료와 수량을 확인해주세요.','unknown-ingredient':'사용할 수 없는 재료예요.','insufficient-ingredients':'가방에 재료가 부족해요.','insufficient-fee':'별 파편이 부족해요.','insufficient-energy':'우주에너지가 부족해요.','output-stack-full':'완성 아이템은 99개까지만 가질 수 있어요.','inventory-full':'가방에 빈칸이 필요해요.'};
      ensure(!result.error||result.error==='recipe-mismatch',messages[result.error]||'조합할 수 없어요.');
      if(result.success)advanceMissions(room,player,'craft-level',result.item?.level,clock());
      roster(room);return {...result,itemId:result.item?.id??null};
    });
    const requireShop=p=>{
      ensure(p.mapId===STREET_ID,'별상점은 오색별빛 쉼터에 있어요.');
      const shop=STREET.objects.find(o=>o.kind==='shop');
      ensure(isNear(p,shop),'별상점에 더 가까이 가주세요.');
    };
    action('shop:energy:open',()=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const shop=STREET.objects.find(o=>o.kind==='energy-shop');
      ensure(s.player.connected&&!s.player.away&&s.player.mapId===STREET_ID&&isNear(s.player,shop),'우주에너지 상점에 더 가까이 가주세요.');
      return {currency:'cosmicEnergy',items:s.player.role==='teacher'?EQUIPMENT_ITEMS:EQUIPMENT_ITEMS.filter(item=>!item.craftOnly)};
    },false);
    action('shop:energy:buy',data=>{
      const s=socket.data.session;ensure(s?.player.connected&&!s?.player.away,'먼저 교실에 입장해주세요.');
      const shop=STREET.objects.find(o=>o.kind==='energy-shop');
      ensure(s.player.mapId===STREET_ID&&isNear(s.player,shop),'우주에너지 상점에 더 가까이 가주세요.');
      const result=buyEquipment(s.player,data.itemId);roster(s.room);return result;
    });
    action('equipment:equip',data=>{
      const s=socket.data.session;ensure(s?.player.connected&&!s?.player.away,'먼저 교실에 입장해주세요.');
      ensure(!s.player.constellationAbilityState?.coronaTrial,'왕관자리 Lv1 체험이 끝나면 장비를 바꿀 수 있어요.');
      ensure(itemOf(data.itemId)?.mode!=='journey-practice','연습 장비는 실제 장착할 수 없어요.');
      const result=equip(s.player,data.itemId,data.slot);roster(s.room);return result;
    });
    action('equipment:unequip',data=>{
      const s=socket.data.session;ensure(s?.player.connected&&!s?.player.away,'먼저 교실에 입장해주세요.');
      ensure(!s.player.constellationAbilityState?.coronaTrial,'왕관자리 Lv1 체험이 끝나면 장비를 바꿀 수 있어요.');
      const result=unequip(s.player,data.slot);roster(s.room);return result;
    });
    action('shop:buy',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      requireShop(p);
      const item=itemOf(data.itemId);
      ensure(item,'그런 물건은 없어요.');
      ensure(!equipmentOf(item.id),'장비는 우주에너지 상점에서만 살 수 있어요.');
      ensure(p.role==='teacher'||![2,3,4].includes(item.level),'LV2~LV4 아이템은 별빛 조합기로 만들 수 있어요. 직접 구매할 수 없어요.');
      ensure(p.role==='teacher'||(p.avatar?.level||1)>=(item.level||1),'아직 이 레벨 상점이 열리지 않았어요.');
      ensure(!item.shopHidden&&(p.role==='teacher'||item.forSale!==false),'이 물건은 지금 상점에서 판매하지 않아요.');
      ensure(p.role==='teacher'||(Number.isSafeInteger(item.price)&&item.price>=0),'아직 구매 가격이 정해지지 않았어요.');
      const quantity=data.quantity;
      ensure(Number.isInteger(quantity) && quantity>=1 && quantity<=10,'1~10개씩 사고팔 수 있어요.');
      // 교사 무료 구매는 학생/학급에 주어진 할인 기회도 소모하지 않습니다.
      const quote=hasUnlimitedShards(p)?{cost:0,discounted:0}:starCardPurchaseQuote(room,p,item,quantity,clock()),cost=quote.cost;
      ensure(p.starShards>=cost,'별 파편이 부족해요. (필요 '+cost+'개, 지금 '+p.starShards+'개)');
      const copyPending=!constellationChangedThisWeek(p,clock())&&p.avatar?.constellationId==='gemini'&&p.abilityState?.pending?.mode==='shop-copy'&&
        p.abilityState.pending.week===weekStart(clock())&&
        (p.abilityState.pending.maxPrice!==undefined?item.price<=p.abilityState.pending.maxPrice:item.level<=2);
      const copyQuantity=copyPending?(p.abilityState.pending.quantity||1):0;
      const totalQuantity=quantity+copyQuantity;
      const existing=p.inventory.find(i=>i.id===item.id);
      ensure(!item.maxOwned||(existing?.quantity||0)+totalQuantity<=item.maxOwned,item.name+'은 '+item.maxOwned+'개까지 보유할 수 있어요.');
      if(existing){
        ensure(existing.quantity+totalQuantity<=SHOP.maxStack,'한 종류는 99개까지만 가질 수 있어요.');
        existing.quantity+=totalQuantity;
      }else{
        ensure(p.inventory.length<SHOP.maxKinds,'가방이 가득 찼어요.');
        p.inventory.push({id:item.id,quantity:totalQuantity});
      }
      p.starShards-=cost;
      if(!hasUnlimitedShards(p))consumeStarCardDiscounts(room,item.id,quote,p,clock());
      if(copyPending)p.abilityState.pending=null;
      roster(room);
      return {starShards:p.starShards,inventory:[...p.inventory],copiedItem:copyPending?item.name:null,copiedQuantity:copyQuantity,
        cost,discounted:quote.discounted,shopDiscounts:starCardShopDiscounts(room,p,clock())};
    });
    action('shop:sell',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      requireShop(p);
      const item=itemOf(data.itemId);
      ensure(item,'그런 물건은 없어요.');
      ensure(!equipmentOf(item.id),'이 장비는 별상점에서 팔 수 없어요.');
      const quantity=data.quantity;
      ensure(Number.isInteger(quantity) && quantity>=1 && quantity<=10,'1~10개씩 사고팔 수 있어요.');
      const existing=p.inventory.find(i=>i.id===item.id);
      ensure(existing && existing.quantity>=quantity,'그만큼 가지고 있지 않아요.');
      const quote=sellQuote(item,quantity);
      ensure(!quote.error,quote.error==='quantity-must-be-even'?'이 아이템은 2개씩 묶어 팔아주세요.':'이 아이템은 아직 판매 가격을 정하지 않았어요.');
      const gain=quote.gain;
      // 상한을 넘기면 아이템만 사라지는 일이 없도록, 담을 수 있을 때만 팝니다.
      if(!hasUnlimitedShards(p)){
        ensure(p.starShards+gain<=SHARDS.max,'별 파편을 더 담을 수 없어요. (최대 '+SHARDS.max+'개)');
        p.starShards+=gain;
      }
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
    action('draw:start',data=>{
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 달토끼 뽑기를 할 수 있어요.');
      const {room,player:p}=s,now=clock(),item=itemOf(data?.itemId==='silver-draw-card'?'silver-draw-card':'moon-rabbit-card');
      if(p.rabbitDraw)return {draw:rabbitDrawView(p.rabbitDraw),inventory:[...p.inventory]};
      requireStarCardItemAccess(room,p,now);
      ensure(!activeOphiuchusParalysis(p,now),'마비상태에서는 아이템을 사용할 수 없어요. 내정보에서 별 파편으로 즉시 해제할 수 있어요.');
      const owned=p.inventory.find(entry=>entry.id===item.id&&entry.quantity>0);
      ensure(owned,`가방에 ${item.name}가 없어요.`);
      ensure(levelOf(p)>=item.level,'캐릭터의 lv보다 높은 아이템으로 사용할 수 없습니다');
      ensure(!hasCardStatus(p,'little-sun-card',now),'자외선 상태라 오늘 자정까지 아이템을 사용할 수 없어요.');
      ensure(!activeItemBlocks(p,now).length,'별자리 능력 때문에 지금은 아이템을 사용할 수 없어요.');
      ensure(!hasLv2ItemBlock(p,now),'해토끼 효과 때문에 지금은 아이템을 사용할 수 없어요.');
      if(item.id==='moon-rabbit-card')ensure(p.rabbitUsedDay!==koreaDay(now),'달토끼는 하루에 한 번만 사용할 수 있어요.');
      ensure(p.starShards<=SHARDS.max-10,'별 파편을 더 담을 수 없어요. 뽑기 전에 별 파편을 조금 사용해주세요.');
      ensure(now-p.lastItemUseAt>=ITEM_USE.cooldownMs,'조금 천천히 써요.');
      collectSunTax(room,p,now);
      owned.quantity--;if(!owned.quantity)p.inventory=p.inventory.filter(entry=>entry.id!==item.id);
      p.lastItemUseAt=now;if(item.id==='moon-rabbit-card')p.rabbitUsedDay=koreaDay(now);
      // 즉시 뽑기는 지속 효과가 아닙니다. 미완료 뽑기는 별도 상태로만 저장합니다.
      const draw=createRabbitDraw(now,room.rabbitDrawCounts);p.rabbitDraw=draw;
      room.itemLog.push({id:randomUUID(),at:now,userId:p.id,userNickname:p.nickname,targetId:p.id,
        targetNickname:p.nickname,itemId:item.id,itemName:item.name,secret:false});
      if(room.itemLog.length>ITEM_USE.logSize)room.itemLog.shift();
      roster(room);return {draw:rabbitDrawView(draw),inventory:[...p.inventory]};
    });
    action('draw:pick',data=>{
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 달토끼 뽑기를 할 수 있어요.');
      const {room,player:p}=s,draw=p.rabbitDraw;
      ensure(draw&&draw.id===data.drawId,'진행 중인 뽑기가 없어요.');
      // 시작 시 서버에서 무작위로 섞은 더미의 맨 위 카드를 뽑습니다.
      // 클라이언트 cardId는 무시하며 실패/재접속 뒤에도 같은 결과를 유지합니다.
      const card=draw.cards[0];
      ensure(card,'뽑기 카드를 찾지 못했어요.');
      const reward=awardDrawReward(p,card.reward);p.rabbitDraw=null;
      p.cardMarkers=(p.cardMarkers||[]).filter(marker=>marker.itemId!=='moon-rabbit-card');
      whisper(room,p,'달토끼 뽑기: '+reward.text);
      roster(room);return {...reward,starShards:p.starShards,inventory:[...p.inventory],avatar:p.avatar};
    });
    action('teacher:cards:catalog',()=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');return teacherCardCatalog(s.room,s.player);},false);
    action('teacher:cards:silver:update',data=>{
      const s=socket.data.session;
      ensure(s?.player.role==='teacher'&&s.room.players.get(s.player.id)===s.player&&s.player.connected,'선생님만 뽑기카드 구성을 수정할 수 있어요.');
      s.room.rabbitDrawCounts=validateRabbitDrawCounts(data?.counts);
      ensure(s.room.rabbitDrawCounts,'뽑기 카드 장수를 입력해주세요.');
      roster(s.room);
      return teacherCardCatalog(s.room,s.player);
    });
    action('teacher:cards:update',data=>{
      const s=socket.data.session;
      ensure(s?.player.role==='teacher'&&s.room.players.get(s.player.id)===s.player&&s.player.connected,'선생님만 별카드 문구를 수정할 수 있어요.');
      ensure(starCardOf(data.id),'수정할 별카드를 선택해주세요.');
      const entry={};
      for(const [field,limit] of Object.entries(STAR_CARD_TEXT_LIMITS)){
        ensure(typeof data[field]==='string'&&data[field].length<=limit&&!data[field].includes('\0'),`${field} 글자 수를 확인해주세요.`);
        entry[field]=data[field].replaceAll('\r\n','\n').trim();
      }
      ensure(entry.name&&entry.effect,'카드 이름과 효과 문구를 입력해주세요.');
      s.room.starCardText??={};
      s.room.starCardText={...s.room.starCardText,[data.id]:entry};
      roster(s.room);
      return {card:displayStarCard(s.room,data.id),message:'별카드 표시 문구를 저장했어요.'};
    });
    action('holding:status',data=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');return holdingStatus(s.room,s.player,data.itemId,clock());},false);
    action('holding:use',data=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');const result=useHoldingAbility(s.room,s.player,data,clock(),abilityDie);roster(s.room);return result;});
    action('lv4:info',()=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');return lv4Info(s.room,s.player);});
    action('lv4:black-hole:preview',data=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');ensure(levelOf(s.player)>=4,'LV4부터 사용할 수 있어요.');return blackHolePreview(s.room,s.player,data.planetIds,clock());},false);
    action('lv4:holding:use',data=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');const r=useLv4Holding(s.room,s.player,data,clock());roster(s.room);return r;});
    action('lv4:teacher:end',data=>{const s=socket.data.session;ensure(s?.player.role==='teacher','선생님만 종료할 수 있어요.');const p=s.room.players.get(data.targetId),m=p?.cardMarkers?.find(m=>m.id===data.markerId&&itemOf(m.itemId)?.mode==='lv4');ensure(m,'사용 기록을 찾지 못했어요.');p.cardMarkers=p.cardMarkers.filter(e=>e.id!==m.id);roster(s.room);return {message:'효과를 종료했어요.'};});
    action('lv4:teacher:info',()=>{const s=socket.data.session;ensure(s?.player.role==='teacher','선생님만 확인할 수 있어요.');return lv4TeacherInfo(s.room);},false);
    action('lv4:teacher:confirm',data=>{const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');const r=confirmLv4(s.room,s.player,data,clock());roster(s.room);return r;});
    action('item:complete',data=>{
      const {room,player,pillar}=templeAccess(data);
      ensure(player.role==='teacher'&&pillar.service==='effects','선생님만 사용 중인 아이템을 처리 완료할 수 있어요.');
      const target=typeof data.targetId==='string'?room.players.get(data.targetId):null;
      const marker=target?.cardMarkers?.find(entry=>entry.itemId!=='moon-rabbit-card'&&entry.id===data.markerId&&(entry.until===null||(entry.until>clock()&&(entry.remainingUses>0||entry.holdingAbility||itemOf(entry.itemId)?.mode==='lv4'))));
      ensure(marker,'처리할 아이템 기록을 찾지 못했어요.');
      ensure(!(marker.itemId==='alien-creature-card'&&marker.startsAt),'포식은 아이템 먹기에서 처리해주세요.');
      ensure(target.rabbitDraw?.markerId!==marker.id,'뽑기를 마친 뒤 처리 완료할 수 있어요.');
      if(marker.remainingUses>1)marker.remainingUses--;
      else target.cardMarkers=target.cardMarkers.filter(entry=>entry.id!==marker.id);
      roster(room);
      return {};
    });
    action('item:devour:options',data=>{
      const {room,player,pillar}=templeAccess(data);
      ensure(pillar.service==='effects','사용 중인 아이템 기둥에서 확인해주세요.');
      return devourOptions(room,player,data,clock());
    },false);
    action('item:devour',data=>{
      const {room,player,pillar}=templeAccess(data);
      ensure(pillar.service==='effects','사용 중인 아이템 기둥에서 처리해주세요.');
      const result=devourItem(room,player,data,clock());
      room.itemLog.push({id:randomUUID(),at:clock(),userId:result.eaterId,userNickname:room.players.get(result.eaterId).nickname,
        targetId:result.victimId,targetNickname:room.players.get(result.victimId).nickname,itemId:result.itemId,
        itemName:itemOf(result.itemId).name,secret:false});
      if(room.itemLog.length>ITEM_USE.logSize)room.itemLog.shift();
      roster(room);
      return result;
    });
    action('ability:status',()=>{
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 별자리 능력을 사용할 수 있어요.');
      const {room,player:p}=s;
      const current=constellationAbilityStatus(p,clock());
      if(current.configured)return current;
      const week=weekStart(clock()),state=p.abilityState||freshAbilityState();
      if(state.pending?.week!==week)state.pending=null;
      const modifiers=lifeAbilityModifiers(p,clock()),ability=constellationOf(p.avatar.constellationId,p.avatar.level)?.ability;
      return {week,...lifeAbilityUsage(state,week,modifiers),canUse:false,pending:state.pending,
        description:ability?lifeAbilityDescription(ability,modifiers.multiplier):'',
        planets:[...room.planets.values()].filter(planet=>planet.id!==p.avatar.departmentId&&warningCount(planet,p.id)>0)
          .map(planet=>({id:planet.id,name:planet.name,count:warningCount(planet,p.id)}))};
    });
    const weeklyAbilitySession=()=>{
      const s=socket.data.session;
      ensure(s&&s.room.players.get(s.player.id)===s.player&&s.player.connected&&s.player.socketId===socket.id,'먼저 교실에 입장해주세요.');
      return s;
    };
    action('constellation-ability:status',()=>{const {room,player}=weeklyAbilitySession();return {...constellationAbilityStatus(player,clock()),swanCardOffer:swanCardOffer(room,player,clock())};},false);
    const sagittariusOptions=()=>{
      const s=weeklyAbilitySession();
      const copied=s.player.constellationAbilityState?.ophiuchus?.copied;
      const borrowed=s.player.avatar?.constellationId==='ophiuchus'&&copied?.constellationId==='sagittarius'&&copied.endsAt>clock()?
        borrowedOphiuchusActor(s.player,clock()):null;
      const actor=borrowed?.actor||s.player;
      ensure(actor.avatar?.constellationId==='sagittarius','사수자리 능력에서만 볼 수 있어요.');
      const warnings=[...s.room.planets.values()].flatMap(planet=>(planet.warnings?.entries||[])
        .filter(entry=>entry.active&&entry.targetId===actor.id)
        .map(entry=>({id:entry.id,planetId:planet.id,planetName:planet.name,reason:entry.reason,at:entry.at})));
      const departments=[...s.room.planets.values()].map(planet=>({id:planet.id,name:planet.name,count:warnings.filter(entry=>entry.planetId===planet.id).length})).filter(planet=>planet.count>0);
      return {warnings,departments,blackStarAt:actor.avatar.blackStar?.at??null,status:constellationAbilityStatus(actor,clock())};
    };
    action('constellation-ability:sagittarius-options',sagittariusOptions,false);
    const weeklyAbilityUse=(data,borrowed=null)=>{
      const session=weeklyAbilitySession(),s=borrowed?{...session,player:borrowed.actor}:session;
      if(s.player.avatar?.constellationId==='cancer'){
        const invitation=inviteCancerDuel(s.room,s.player,data?.targetId,data?.choice,clock());roster(s.room);
        return {invitation,...constellationAbilityStatus(s.player,clock()),message:'대결 신청을 보냈어요. 친구가 수락하면 결과가 나와요.'};
      }
      if(s.player.avatar?.constellationId==='aries'){
        const now=clock();
        if(s.player.avatar.level===2){
          const invitation=inviteAriesSleep(s.room,s.player,data?.targetId,now);roster(s.room);
          return {invitation,...constellationAbilityStatus(s.player,now),message:'수면 신청을 보냈어요. 친구가 수락하면 함께 잠들어요.'};
        }
        const result=useAriesSleep(s.room,s.player,data,now);roster(s.room);
        return {...result,...constellationAbilityStatus(s.player,now)};
      }
      if(s.player.avatar?.constellationId==='corona-borealis'){
        const result=useCoronaWeekly(s.player,data?.choice,clock());roster(s.room);
        return {...result,...constellationAbilityStatus(s.player,clock())};
      }
      if(s.player.avatar?.constellationId==='cygnus'){
        const p=s.player,room=s.room,now=clock(),level=p.avatar.level;
        if(level===2){
          const target=room.players.get(data?.targetId);
          ensure(target?.role==='student'&&target.id!==p.id&&target.connected&&!target.away,'접속 중인 다른 친구를 골라주세요.');
          ensure(room.chat.enabled&&(room.unattended||[...room.players.values()].some(t=>t.role==='teacher'&&t.connected))&&!p.muted,'지금은 칭찬 메시지를 보낼 수 없어요.');
          const praises=['언제나 친절하게 도와줘서 고마워!','함께할 때 정말 즐거워!','열심히 도전하는 모습이 멋져!','친구를 배려하는 마음이 참 좋아!'];
          ensure(Number.isInteger(data?.praiseIndex)&&data.praiseIndex>=0&&data.praiseIndex<praises.length,'칭찬 문구를 골라주세요.');
          const content=praises[data.praiseIndex],recentChats=checkChatRate(p,content,now);
          const result=completeSwanCompliment(p,target.id,now);
          const msg=store.pushChat(room,{playerId:p.id,nickname:p.nickname,role:p.role,text:content,flagged:false,channel:'direct',targetId:target.id});
          for(const recipient of [p,target]){const sock=io.sockets.sockets.get(recipient.socketId);if(sock)deliver(()=>sock.emit('chat:message',msg));}
          p.lastChatAt=now;p.recentChats=recentChats;roster(room);
          return {...result,message:'친구에게 칭찬을 보냈어요. 별 파편 1개를 받았어요.'};
        }
        if(level===3){
          const raw=typeof data?.campaignText==='string'?data.campaignText.normalize('NFKC').replace(/\p{Cf}/gu,'').trim():'';
          ensure([...raw].length>=1&&[...raw].length<=80&&!/[\x00-\x1f\x7f]/.test(raw),'캠페인 문구를 1~80자로 적어주세요.');
          const {text:filtered,flagged}=filterChat(raw);
          ensure(!flagged,'다른 사람을 배려하는 캠페인 문구로 고쳐 주세요.');
          const result=submitSwanCampaign(p,filtered,now);roster(room);
          return {...result,message:'캠페인 푯말을 신청했어요. 선생님이 승인하면 광장에 세워지고 별 파편 3개를 받아요.'};
        }
        throw new GameError('이 단계의 백조자리 능력은 오후 3시에 자동으로 판정해요.');
      }
      if(s.player.avatar?.constellationId==='pisces'){
        const invitation=invitePiscesPair(s.room,s.player,data.targetId,clock());roster(s.room);
        return {invitation,...constellationAbilityStatus(s.player,clock()),message:'짝 신청을 보냈어요. 친구가 수락하면 능력이 사용돼요.'};
      }
      if(s.player.avatar?.constellationId==='ophiuchus'){
        const result=useOphiuchus(s.room,s.player,data,clock());roster(s.room);return result;
      }
      if(s.player.avatar?.constellationId==='leo'){
        const result=useLeoChallenge(s.room,s.player,data,clock());roster(s.room);return result;
      }
      if(s.player.avatar?.constellationId==='cetus'){
        const result=useCetus(s.room,s.player,data,clock());roster(s.room);return result;
      }
      if(s.player.avatar?.constellationId==='sagittarius'){
        const p=s.player,room=s.room,status=constellationAbilityStatus(p,clock());
        ensure(status.canUse,status.message||'이번 주 사수자리 능력을 사용할 수 없어요.');
        const mode=data?.mode;let detail={};let message;
        validateSagittariusUse(p,mode,clock());
        if(mode==='warning'&&status.level<=3){
          const {planet}=clearOwnWarning(room,p,data.warningId);
          detail={warningId:data.warningId,planetId:planet.id};message='내 경고 1개를 삭제했어요.';
        }else if(mode==='black-star'&&status.level>=4){
          const {planetId}=clearOwnBlackStar(room,p,data.blackStarAt);
          detail={planetId};message='내 검은별 상태와 그 부서의 내 경고를 해제했어요.';
        }else if(mode==='department'&&status.level===5){
          const {planet,cleared:removed}=clearOwnDepartmentWarnings(room,p,data.planetId);
          detail={planetId:planet.id};message=`${planet.name}에서 내 경고 ${removed}개를 모두 삭제했어요.`;
        }else throw new GameError('현재 단계에서 선택할 수 없는 능력이에요.');
        const result=completeSagittariusUse(p,mode,detail,clock());roster(room);
        return {...result,message};
      }
      const result=useConstellationAbility(s.player,clock(),abilityDie,craftingRecipes);
      roster(s.room);return result;
    };
    const weeklyAbilityWithCetus=data=>{
      const s=weeklyAbilitySession(),before=constellationAbilityStatus(s.player,clock()),bonus=before.cetusBonusUse;
      const result=weeklyAbilityUse(data);
      const internallyCounted=before.constellationId==='ophiuchus'||before.constellationId==='sagittarius'||before.constellationId==='cetus'||before.constellationId==='cygnus'&&before.level===2;
      if(!result.invitation&&cetusAfterAbility(s.player,clock(),bonus&&!internallyCounted))roster(s.room);
      return result;
    };
    action('constellation-ability:use',weeklyAbilityWithCetus);
    action('cetus:respond',data=>{
      const s=weeklyAbilitySession();ensure(s.player.role==='student','학생만 고래자리 초대에 답할 수 있어요.');
      const invite=s.room.cetusInvites?.get(data?.requestId),borrowed=invite?.borrowedFromOphiuchus?
        borrowedOphiuchusActor(s.room.players.get(invite.fromId),clock()):null;
      const result=respondCetus(s.room,s.player,data?.requestId,data?.accept,clock(),borrowed?.actor);
      if(result.accepted&&borrowed)borrowed.save();
      roster(s.room);return result;
    });
    action('cetus:escape',()=>{
      const s=weeklyAbilitySession();const result=escapeCetus(s.room,s.player,clock());roster(s.room);return result;
    });
    action('constellation-ability:paralysis-clear',()=>{
      const s=weeklyAbilitySession();ensure(s.player.role==='student','학생만 마비를 해제할 수 있어요.');
      const result=clearOphiuchusParalysis(s.player,clock());roster(s.room);return result;
    });
    action('constellation-ability:borrowed-use',data=>{
      const {room,player}=weeklyAbilitySession(),borrowed=borrowedOphiuchusActor(player,clock()),ability=weeklyAbilityFor(borrowed.copied.constellationId,borrowed.copied.level);
      ensure(!borrowed.copied.used,'복사한 별자리 능력은 이미 사용했어요.');
      const borrowedSlot=ability.paralysis?(borrowed.copied.level===5?data?.level:borrowed.copied.level):null;
      if(ability.paralysis)ensure(!borrowed.copied.usedLevels.includes(borrowedSlot),'이미 복사해 사용한 마비 단계예요.');
      if(ability.paralysis&&borrowed.copied.level===5&&data?.level===4){
        const used=borrowed.copied.usedLevels;
        ensure(used.includes(2)&&used.includes(3),'복사한 뱀주인자리의 Lv2와 Lv3을 먼저 사용해주세요.');
      }
      if(ability.passive||ability.swanDaily){borrowed.copied.used=true;borrowed.save();roster(room);
        return {...constellationAbilityStatus(player,clock()),message:'복사한 자동 능력을 활성화했어요.'};}
      const result=weeklyAbilityUse(data,borrowed);
      if(result.invitation)result.invitation.borrowedFromOphiuchus=true;
      if(!promoteBorrowedOphiuchusCopy(borrowed)){
        if(ability.cetus&&result.invitation){
          borrowed.copied.useCount++;
          borrowed.copied.used=borrowed.copied.useCount>=(borrowed.copied.level===4?2:borrowed.copied.level===5?4:1);
        }else if(!result.invitation){
          borrowed.copied.useCount++;
          if(ability.paralysis)borrowed.copied.usedLevels.push(borrowedSlot);
          borrowed.copied.used=ability.paralysis?borrowed.copied.usedLevels.length===(borrowed.copied.level===5?3:1):
            borrowed.copied.useCount>=(ability.warningHunter||ability.compliment?ability.uses:1)||
            !!(ability.warningHunter&&result.lastResult?.mode==='department');
        }
        borrowed.save();
      }
      roster(room);
      return {...constellationAbilityStatus(player,clock()),message:result.message,
        ...(result.reward!==undefined?{reward:result.reward}:{}),...(result.roll!==undefined?{roll:result.roll}:{}),
        ...(result.invitation?{invitation:result.invitation}:{})};
    });
    action('constellation-ability:borrowed-choose-item',data=>{
      const {room,player}=weeklyAbilitySession();
      const result=chooseCopiedOphiuchusItem(player,data?.itemId,clock());roster(room);return result;
    });
    action('cancer-duel:respond',data=>{
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 대결 신청에 답할 수 있어요.');
      const invite=s.room.cancerInvites?.get(data.requestId),borrowed=invite?.borrowedFromOphiuchus?
        borrowedOphiuchusActor(s.room.players.get(invite.fromId),clock()):null;
      const source=invite&&s.room.players.get(invite.fromId),cetusBonus=source&&!borrowed?constellationAbilityStatus(source,clock()).cetusBonusUse:false;
      const result=respondCancerDuel(s.room,s.player,data.requestId,data.accept,data.choice,clock(),abilityDie,borrowed?.actor);
      if(result.accepted&&!result.tie&&borrowed){borrowed.copied.used=true;borrowed.save();}
      if(result.accepted&&!result.tie&&source&&!borrowed)cetusAfterAbility(source,clock(),cetusBonus);
      if(result.accepted){for(const id of [result.fromId,result.toId]){
        const participant=s.room.players.get(id),sock=participant&&io.sockets.sockets.get(participant.socketId);
        if(sock)deliver(()=>sock.emit('cancer-duel:result',result));
      }}
      roster(s.room);return result;
    });
    action('aries-sleep:respond',data=>{
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 수면 신청에 답할 수 있어요.');
      const invite=s.room.ariesInvites?.get(data.requestId),borrowed=invite?.borrowedFromOphiuchus?
        borrowedOphiuchusActor(s.room.players.get(invite.fromId),clock()):null;
      const source=invite&&s.room.players.get(invite.fromId),cetusBonus=source&&!borrowed?constellationAbilityStatus(source,clock()).cetusBonusUse:false;
      const result=respondAriesSleep(s.room,s.player,data.requestId,data.accept,clock(),borrowed?.actor);
      if(result.accepted&&borrowed){borrowed.copied.used=true;borrowed.save();}
      if(result.accepted&&source&&!borrowed)cetusAfterAbility(source,clock(),cetusBonus);
      roster(s.room);
      return {...result,message:result.accepted?'수면 신청을 수락했어요. 다음 날 오전 8시에 깨어나요.':'수면 신청을 거절했어요.'};
    });
    action('aries-sleep:wake',()=>{
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 깨어날 수 있어요.');
      const result=wakeAriesSleep(s.player,clock());roster(s.room);return result;
    });
    action('constellation-ability:swan-card-buy',()=>{
      const {room,player}=weeklyAbilitySession(),result=buySwanStarCard(room,player,clock());
      roster(room);return {...result,...constellationAbilityStatus(player,clock()),swanCardOffer:false};
    });
    action('constellation-ability:swan-campaign-approve',data=>{
      const {room,player}=weeklyAbilitySession();ensure(player.role==='teacher','선생님만 푯말을 승인할 수 있어요.');
      const target=room.players.get(data?.playerId);ensure(target?.role==='student','신청한 학생을 골라주세요.');
      const copied=target.constellationAbilityState?.ophiuchus?.copied;
      const borrowed=copied?.used&&copied.constellationId==='cygnus'&&copied.level===3?
        borrowedOphiuchusActor(target,clock()):null;
      const result=approveSwanCampaign(borrowed?.actor||target,clock());if(borrowed)borrowed.save();roster(room);
      whisper(room,target,'캠페인 푯말이 승인되어 광장에 세워졌어요. 별 파편 3개를 받았어요.');
      return {message:'캠페인 푯말을 승인했어요.',...result};
    });
    // Old clients share the exact same Sunday stamp; unconfigured abilities cannot start.
    action('ability:use',weeklyAbilityWithCetus);
    const weeklyAbilityChoose=data=>{const s=weeklyAbilitySession(),result=chooseConstellationItem(s.player,data.itemId,clock());roster(s.room);return result;};
    action('constellation-ability:choose-item',weeklyAbilityChoose);
    action('ability:choose-item',data=>{
      if(socket.data.session?.player.constellationAbilityState?.pending)return weeklyAbilityChoose(data);
      const s=socket.data.session;ensure(s?.player.role==='student','학생만 별자리 능력을 사용할 수 있어요.');
      const {room,player:p}=s,state=p.abilityState,pending=state?.pending;
      ensure(!constellationChangedThisWeek(p,clock()),'별자리를 바꾼 주에는 능력을 사용할 수 없어요.');
      ensure(p.avatar.constellationId==='corvus'&&['dice-item','value-item'].includes(pending?.mode)&&pending.week===weekStart(clock()),'진행 중인 까마귀자리 아이템 생성이 없어요.');
      const item=itemOf(data.itemId);
      ensure(item&&item.level<=pending.maxLevel,'주사위 눈으로 만들 수 있는 Lv 아이템을 골라주세요.');
      ensure(Number.isSafeInteger(item.price)&&item.price>=0,'아직 제작 가치가 정해지지 않은 아이템이에요.');
      if(pending.mode==='value-item'){
        ensure(item.price<=pending.budget,'남은 제작 가치보다 비싼 아이템이에요.');
        ensure(!pending.selected.includes(item.id),'서로 다른 종류의 아이템을 골라주세요.');
      }
      const owned=p.inventory.find(entry=>entry.id===item.id);
      const quantity=pending.mode==='dice-item'?(pending.quantity||1):1;
      ensure(!item.maxOwned||(owned?.quantity||0)+quantity<=item.maxOwned,item.name+'은 '+item.maxOwned+'개까지 보유할 수 있어요.');
      if(owned)ensure(owned.quantity+quantity<=SHOP.maxStack,'그 아이템을 더 담을 수 없어요.');
      else ensure(p.inventory.length<SHOP.maxKinds,'가방이 가득 찼어요.');
      if(owned)owned.quantity+=quantity;else p.inventory.push({id:item.id,quantity});
      if(pending.mode==='value-item'){
        pending.budget-=item.price;pending.picks--;pending.selected.push(item.id);
        if(!pending.picks||!SHOP.items.some(value=>Number.isSafeInteger(value.price)&&value.price>=0&&value.level<=pending.maxLevel&&value.price<=pending.budget&&!pending.selected.includes(value.id)))state.pending=null;
      }else state.pending=null;
      whisper(room,p,item.name+' '+quantity+'개를 만들었어요.');roster(room);
      return {itemName:item.name,quantity,inventory:[...p.inventory]};
    });
    action('ability:retry',()=>{throw new GameError('천칭자리의 주사위 다시 던지기는 종료되었어요.');});
    action('ability:complete',data=>{
      const {room,player,pillar}=templeAccess(data);
      ensure(player.role==='teacher'&&pillar.service==='effects','선생님만 별자리 능력 처리를 완료할 수 있어요.');
      const target=typeof data.targetId==='string'?room.players.get(data.targetId):null;
      const marker=target?.abilityState?.markers?.find(entry=>entry.id===data.abilityMarkerId);
      ensure(marker,'처리할 별자리 능력 기록을 찾지 못했어요.');
      ensure(!constellationChangedThisWeek(target,clock()),'별자리를 바꾼 주에는 능력을 사용할 수 없어요.');
      if(marker.constellationId==='libra'&&(marker.level||2)===2){
        const multiplier=marker.multiplier||1;
        ensure([0,multiplier,2*multiplier].includes(data.xpAmount),'천칭자리 경험치는 '+[0,multiplier,2*multiplier].join('·')+' 중에서 선택해주세요.');
        target.avatar=gainExperience(target.avatar,data.xpAmount);
        whisper(room,target,'선생님이 천칭자리 능력 경험치 '+data.xpAmount+'을 확인했어요.');
      }else ensure(data.xpAmount===undefined,'이 능력에는 경험치를 지급할 수 없어요.');
      target.abilityState.markers=target.abilityState.markers.filter(entry=>entry.id!==marker.id);
      roster(room);return {};
    });
    // 학생 입력으로 카드 종류나 보상을 정하지 않습니다. 공개·제거도 같은 저장 트랜잭션에 들어갑니다.
    const cardReply=(card,canRemove=false)=>{
      const s=socket.data.session,definition=displayStarCard(s.room,card.cardId),d=card.data;
      const messages=[...(d.rewards||[]).map(r=>(itemOf(r.itemId)?.name||r.itemId)+' '+r.quantity+'개 지급'),
        ...(d.xp?[`경험치 ${d.xp} 지급`]:[]),...(d.shards?[`초과 경험치를 별 파편 ${d.shards}개로 지급`]:[]),
        ...(d.warningsCleared?[`경고 ${d.warningsCleared}건 해제`]:[]),...(d.blackStarsCleared?[`검은별 ${d.blackStarsCleared}개 해제`]:[]),
        ...(d.automation?.choice==='xp'?[`주사위 ${d.roll} → 경험치 보상 ${Math.min(d.roll*3,10)}`]:[]),
        ...(d.automation?.choice==='constellation'?[`${constellationOf(d.automation.constellationId)?.name}로 변경 완료`]:[])];
      return {card:{...card,data:{...d,messages,manualNote:[...(d.automatic||[]),...(d.manual||[])].join(' ')}},definition,canRemove,
        ...starCardChoiceInfo(s.room,s.player,card)};
    };
    const requireStarCard=data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const card=activeStarCards(s.room,clock()).find(c=>c.id===data.id);
      ensure(card,'이미 종료되었거나 찾을 수 없는 별 카드예요.');
      ensure(s.player.mapId===PLAZA_ID&&isNear(s.player,{...card,radius:28}),'신전의 별 카드에 더 가까이 가주세요.');
      return {...s,card};
    };
    action('star-card:read',data=>{const {player,card}=requireStarCard(data);return cardReply(card,player.role==='teacher');});
    action('star-card:remove',data=>{const {room,player,card}=requireStarCard(data);const result=removeStarCard(room,player,card.id);roster(room);return result;});
    action('star-card:choose',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      // 사용 직후 가방에서 열린 창에서도 선택 가능. 카드 소유권은 서버가 재검사합니다.
      const card=chooseStarCard(s.room,s.player,data,clock(),starCardRandom);
      roster(s.room);return cardReply(card);
    });
    action('item:discard',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      // 이전 화면/클라이언트가 폐기 요청을 보내도 실제 아이템은 삭제하지 않습니다.
      ensure(false,'아이템 버리기 기능은 더 이상 제공하지 않아요.');
    });
    action('item:use',data=>{
      const s=socket.data.session;ensure(s,'먼저 교실에 입장해주세요.');
      const {room,player:p}=s;
      requireStarCardItemAccess(room,p,clock());
      ensure(!activeOphiuchusParalysis(p,clock()),'마비상태에서는 아이템을 사용할 수 없어요. 내정보에서 별 파편으로 즉시 해제할 수 있어요.');
      const item=itemOf(data.itemId);
      ensure(item,'그런 물건은 없어요.');
      ensure(item.mode!=='journey-practice','연습 아이템은 첫 여행 연습 버튼으로 사용해 주세요.');
      ensure(item.usable!==false,'이 아이템의 사용 효과는 준비 중이에요.');
      if(item.mode==='recipe'){
        const result=useRecipeItem(room,p,data,craftingRecipes,clock());
        if(result.learned)roster(room);
        return result;
      }
      if(item.mode==='exploration-ticket'){
        const result=useExplorationTicket(room,p,clock());roster(room);
        return {...result,inventory:[...p.inventory],starShards:p.starShards};
      }
      if(item.mode==='star-card'){
        const result=item.id==='star-card'?useStarCard(room,p,clock(),starCardRandom):useTypedStarCard(room,p,item.id,clock(),starCardRandom);
        room.itemLog.push({id:randomUUID(),at:clock(),userId:p.id,userNickname:p.nickname,targetId:p.id,targetNickname:p.nickname,itemId:item.id,itemName:result.card.name,secret:false});
        if(room.itemLog.length>ITEM_USE.logSize)room.itemLog.shift();
        announce(room,p.nickname+' 친구가 '+result.card.name+' 별 카드를 사용했어요.');
        roster(room);
        return {message:result.message,inventory:[...p.inventory],starShards:p.starShards,avatar:{...p.avatar},starCard:cardReply(result.record)};
      }
      if(item.mode==='lv2'||item.mode==='lv3'||item.mode==='lv4'){
        const outcome=item.mode==='lv4'?useLv4Item(room,p,item,data,clock()):item.mode==='lv3'?useLv3Item(room,p,item,data,clock()):useLv2Item(room,p,item,data,clock(),abilityDie);
        room.itemLog.push({id:randomUUID(),at:clock(),userId:p.id,userNickname:p.nickname,targetId:outcome.targetIds[0],targetNickname:outcome.targetIds.map(id=>room.players.get(id)?.nickname||'').join(' · '),itemId:item.id,itemName:item.name,secret:false});
        if(room.itemLog.length>ITEM_USE.logSize)room.itemLog.shift();
        announce(room,p.nickname+' 친구가 '+item.name+'을 사용했어요.');
        roster(room);return {...outcome,inventory:[...p.inventory],effects:playerEffectsView(room.players.get(data.targetId)||p,p.role==='teacher',clock())};
      }
      const owned=p.inventory.find(i=>i.id===item.id);
      ensure(owned,'가방에 그 물건이 없어요.');
      ensure(levelOf(p)>=item.level,'캐릭터의 lv보다 높은 아이템으로 사용할 수 없습니다');
      const now=clock();
      if(CROWN_ITEMS.has(item.id))ensure(Number.isSafeInteger(owned.expiresAt)&&owned.expiresAt>now,'이 기간제 아이템은 유효기간이 끝났어요.');
      ensure(!hasCardStatus(p,'little-sun-card',now)||item.mode==='moon','자외선 상태라 오늘 자정까지 아이템을 사용할 수 없어요. 꼬마 달은 사용할 수 있어요.');
      ensure(!activeItemBlocks(p,now).length,'별자리 능력 때문에 지금은 아이템을 사용할 수 없어요.');
      ensure(!hasLv2ItemBlock(p,now),'해토끼 효과 때문에 지금은 아이템을 사용할 수 없어요.');
      ensure(item.mode!=='draw','달토끼 카드는 뽑기 카드 화면에서 사용해주세요.');
      ensure(typeof data.targetId==='string','그 친구는 지금 없어요.');
      const target=room.players.get(data.targetId);
      ensure(target && (target.connected || (allowsOfflineItemTarget(item) && target.role==='student')),'그 친구는 지금 없어요.');
      ensure(item.targets!=='self' || target.id===p.id,'이 물건은 나에게만 쓸 수 있어요.');
      ensure(item.targets!=='other' || target.id!==p.id,'이 물건은 다른 친구에게만 쓸 수 있어요.');
      const second=item.targets==='pair'&&typeof data.secondTargetId==='string'?room.players.get(data.secondTargetId):null;
      if(item.targets==='pair')ensure(second&&second.id!==target.id&&second.role==='student'&&target.role==='student','서로 다른 학생 친구 2명을 골라주세요.');
      const targets=second?[target,second]:[target];
      for(const recipient of targets){
        ensure(levelOf(p)>=levelOf(recipient),'나보다 레벨이 높은 친구에게는 쓸 수 없어요.');
        ensure(!hasItemImmunity(recipient,now)&&!hasMoonProtectionFrom(recipient,p,now),'꼬마 달 보호 중인 친구는 타인이 사용하는 효과의 대상이 되지 않아요.');
      }
      if(item.mode==='moon')ensure(!p.avatar.blackStar,'검은별 상태에서는 꼬마 달을 사용할 수 없어요.');
      if(item.mode==='uv')ensure(target.role==='student','학생 친구에게만 자외선을 적용할 수 있어요.');
      if(item.id==='alien-card')ensure(exemptionName(data.exemption),'면제할 목록에서 일기 또는 독서록을 골라주세요.');
      let meteorPlanet=null;
      if(item.mode==='meteor'){
        ensure(p.role==='student'&&target.id===p.id,'운석 파편은 본인이 받은 경고에만 쓸 수 있어요.');
        meteorPlanet=typeof data.planetId==='string'?room.planets.get(data.planetId):null;
        ensure(meteorPlanet&&meteorPlanet.id!==p.avatar.departmentId,'다른 부서행성을 골라주세요.');
        ensure(warningCount(meteorPlanet,p.id)>0,'그 부서에서 받은 활성 경고가 없어요.');
      }
      ensure(now-p.lastItemUseAt>=ITEM_USE.cooldownMs,'조금 천천히 써요.');
      // 소비: 수량 1 소모, 0이 되면 가방에서 완전히 지웁니다.
      collectSunTax(room,p,now);
      owned.quantity-=1;
      if(owned.quantity<=0) p.inventory=p.inventory.filter(i=>i.id!==item.id);
      p.lastItemUseAt=now;
      if(item.mode){
        if(item.mode==='meteor'){
          const cleared=clearWarningsFromPlanet(room,meteorPlanet,p);
          whisper(room,p,meteorPlanet.name+'에서 받은 경고 '+cleared.cleared+'건이 해제됐어요.'+(cleared.released?' 검은별 상태도 풀렸어요.':''));
        }
        for(const recipient of targets){
          recipient.cardMarkers=(recipient.cardMarkers||[]).filter(marker=>(marker.until===null||marker.until>now||marker.itemId==='sun-rabbit-card')&&!(item.mode==='moon'&&marker.itemId==='little-sun-card')&&
            !(['moon','uv'].includes(item.mode)&&marker.itemId===item.id));
          const marker=addCardMarker(recipient,item,p,['moon','uv'].includes(item.mode)?nextKoreaMidnight(now):null,
            second?'자리 맞교환: '+(recipient.id===target.id?second.nickname:target.nickname):'');
          if(item.id==='alien-card'){marker.exemption=data.exemption;marker.note=exemptionName(data.exemption)+' 1편 면제';}
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
    registerMarketTrades({action,socket,roster,whisper,clock});
    socket.on('player:input',data=>{
      const p=socket.data.session?.player;
      if(!p || !data || typeof data!=='object')return;
      if(p.role==='student'&&!studentOpen())return;
      if(activeAriesSleep(p,clock())){p.input={x:0,y:0,at:0};return;}
      if(activeCetusStomach(p,clock())){p.input={x:0,y:0,at:0};return;}
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
      if(step%20===0&&ariesSleepDue(room,clock())){
        try{transaction(()=>{if(settleAriesSleep(room,clock()))roster(room);});}
        catch(error){console.error('양자리 수면 정산 저장 실패:',error.message);continue;}
      }
      if(step%20===0&&[...room.players.values()].some(p=>p.constellationAbilityState?.cetusStomach&&
        (p.constellationAbilityState.cetusStomach.endsAt<=clock()||p.avatar?.blackStar))){
        try{transaction(()=>{if(settleCetusStomachs(room,clock()))roster(room);});}
        catch(error){console.error('고래 배 속 귀환 저장 실패:',error.message);continue;}
      }
      if(step%20===0&&coronaDue(room,clock())){
        try{transaction(()=>{if(settleCorona(room,clock()))roster(room);});}
        catch(error){console.error('왕관자리 기간제 능력 저장 실패:',error.message);continue;}
      }
      if(step%20===0&&swanDailyDue(room,clock())){
        try{transaction(()=>{const result=settleSwanDaily(room,clock());if(result.changed)roster(room);});}
        catch(error){console.error('백조자리 일일 보상 저장 실패:',error.message);continue;}
      }
      if(step%20===0&&ophiuchusTransferDue(room,clock())){
        try{transaction(()=>{if(settleOphiuchusTransfers(room,clock()))roster(room);});}
        catch(error){console.error('뱀주인자리 마비 전염 저장 실패:',error.message);continue;}
      }
      if([...room.players.values()].some(p=>p.piscesPair?.endsAt<=clock())){
        try{transaction(()=>{if(settlePiscesPairs(room,clock()))roster(room);});}
        catch(error){console.error('물고기자리 짝 만료 저장 실패:',error.message);continue;}
      }
      if((!room.dailyMissions?.day||room.dailyMissions.day<dailyMissionDay(clock()))&&now>=(room.dailyRetryAt||0)){
        try{transaction(()=>{if(ensureDailyMissions(room,clock()))roster(room);});}
        catch(error){const restored=store.rooms.get(room.code);if(restored)restored.dailyRetryAt=now+1000;console.error('일일 미션 저장 실패:',error.message);continue;}
      }
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
          if(!persistent||!activePiscesPair(p,clock()))leaveParty(room,p.id,clock(),!persistent);
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
      // 맵/위치 변경으로 시장을 떠난 거래는 바닥 보정 전에 종료합니다.
      if(pruneMarketTrades(room,clock(),whisper))roster(room);
      const combatEffectsBefore=[...room.players.values()].map(p=>({player:p,
        dash:!!p.taurusDash,shield:!!p.herculesShield,crown:!!p.coronaAura}));
      for(const hit of advanceTaurusDashes(room,now))if(hit.defeated)
        io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,now)});
      const movedIds=advance(room,now)||[];
      for(const id of movedIds){const p=room.players.get(id);if(p?.role==='student'&&(p.journey?.stage??1)===1&&!p.journey?.goals.includes('moved'))p.journeyMoved=true;}
      // Save only newly acquired goals, never every movement tick. Retry failed writes without leaking a roster.
      if(studentOpen()&&(room.unattended||[...room.players.values()].some(p=>p.role==='teacher'&&p.connected))&&now>=(room.journeyRetryAt||0)){
        const goals=[...room.players.values()].flatMap(p=>journeyTickGoals(p).map(id=>({playerId:p.id,id})));
        if(goals.length)try{transaction(()=>{for(const goal of goals)journeyGoal(room.players.get(goal.playerId),goal.id);roster(room);});}
        catch(error){const restored=store.rooms.get(room.code);if(restored)restored.journeyRetryAt=now+1000;console.error('첫 여행 진행 저장 실패:',error.message);continue;}
      }
      if(advanceLibraAuras(room,now))roster(room);
      if(pruneMarketTrades(room,clock(),whisper))roster(room);
      for(const p of recoverDefeated(room,clock())){
        io.to(p.socketId).emit('combat:recovered',{message:'체력과 마나를 회복했어요. 다시 출발해요!'});roster(room);
      }
      for(const hit of moveMonsters(room,clock())){
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===hit.mapId){
          io.to(viewer.socketId).emit('combat:monster-hit',hit);
          if(!hit.attackOnly)io.to(viewer.socketId).emit('combat:vitals',{playerId:hit.targetId,vitals:hit.vitals});
        }
      }
      for(const burst of advanceHerculesShields(room,now)){
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===burst.mapId){
          io.to(viewer.socketId).emit('combat:hercules-burst',burst);
          for(const target of burst.playerTargets){io.to(viewer.socketId).emit('combat:player-hit',{mapId:burst.mapId,...target});io.to(viewer.socketId).emit('combat:vitals',{playerId:target.targetId,vitals:target.vitals});}
        }
        if(burst.targets.some(t=>t.defeated))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,now)});
      }
      const corona=advanceCorona(room,now);
      let combatEffectEnded=combatEffectsBefore.some(({player,dash,shield,crown})=>
        dash&&!player.taurusDash||shield&&!player.herculesShield||crown&&!player.coronaAura);
      for(const p of room.players.values())if(p.taurusImmuneUntil&&p.taurusImmuneUntil<=now){
        p.taurusImmuneUntil=0;combatEffectEnded=true;
      }
      if(combatEffectEnded)roster(room);
      if(corona.hits.some(hit=>hit.defeated))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,now)});
      const capricorn=advanceCapricorn(room,now);
      for(const healed of capricorn.healed)for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===healed.mapId)
        io.to(viewer.socketId).emit('combat:vitals',{playerId:healed.playerId,vitals:healed.vitals});
      if(capricorn.hits.some(hit=>hit.defeated))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,now)});
      const leo=advanceLeoRoars(room,now);
      if(leo.changed||advanceLeoCourage(room,now))roster(room);
      if(leo.hits.some(h=>h.targets.some(t=>t.defeated)))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,now)});
      for(const reflected of room.reflectedVitals?.splice(0)||[])
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===room.players.get(reflected.playerId)?.mapId)
          io.to(viewer.socketId).emit('combat:vitals',reflected);
      if(room.reflectedDrops){room.reflectedDrops=false;io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,now)});}
      let transformationChanged=false;
      for(const player of room.players.values())transformationChanged=expireTransformation(player,clock())||transformationChanged;
      if(transformationChanged)roster(room);
      for(const hit of advanceProjectiles(room,clock(),combatEnemies,(room,player,selected,power,now,cast)=>
        isWaterConstellation(player)?resolveWaterHit(room,player,selected,power,now,cast):damageTargets(room,player,selected,power,now))){
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===hit.mapId){
          if(hit.end)io.to(viewer.socketId).emit('combat:projectile-end',hit.end);
          for(const target of hit.playerTargets){io.to(viewer.socketId).emit('combat:player-hit',{mapId:hit.mapId,...target});io.to(viewer.socketId).emit('combat:vitals',{playerId:target.targetId,vitals:target.vitals});}
          for(const healed of hit.healed||[])io.to(viewer.socketId).emit('combat:vitals',{playerId:healed.targetId,vitals:healed.vitals});
        }
        if(hit.targets.some(t=>t.defeated))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,clock())});
      }
      for(const hit of advanceAquarius(room,clock())){
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===hit.mapId)
          for(const healed of hit.healed)io.to(viewer.socketId).emit('combat:vitals',healed);
        if(hit.targets.some(t=>t.defeated))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,clock())});
      }
      for(const hit of advanceWaterAuras(room,clock())){
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===hit.mapId)
          io.to(viewer.socketId).emit('combat:water-pulse',hit);
        if(hit.targets.some(t=>t.defeated))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,clock())});
      }
      if(room.waterAuraChanged){room.waterAuraChanged=false;roster(room);}
      if(advanceSwanAuras(room,clock()))roster(room);
      const poisonTime=clock();
      for(const hit of advanceOphiuchusVenoms(room,poisonTime)){
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===hit.mapId)
          for(const target of hit.playerTargets){io.to(viewer.socketId).emit('combat:player-hit',{mapId:hit.mapId,...target});io.to(viewer.socketId).emit('combat:vitals',{playerId:target.targetId,vitals:target.vitals});}
        if(hit.targets.some(t=>t.defeated))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,clock())});
      }
      const poison=advanceOphiuchusPoison(room,poisonTime);
      for(const hit of poison.events){
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===hit.mapId)
          for(const target of hit.playerTargets){io.to(viewer.socketId).emit('combat:player-hit',{mapId:hit.mapId,...target});io.to(viewer.socketId).emit('combat:vitals',{playerId:target.targetId,vitals:target.vitals});}
        if(hit.targets.some(t=>t.defeated))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,clock())});
      }
      if(poison.changed)roster(room);
      for(const hit of advanceAriesClouds(room,clock()))
        if(hit.defeated)io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,clock())});
      for(const hit of advanceSagittarius(room,clock())){
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===hit.mapId){
          const {targets,playerTargets,...visual}=hit;
          io.to(viewer.socketId).emit('sagittarius:effect',visual);
          for(const result of playerTargets){
            io.to(viewer.socketId).emit('combat:player-hit',{mapId:hit.mapId,...result});
            io.to(viewer.socketId).emit('combat:vitals',{playerId:result.targetId,vitals:result.vitals});
          }
        }
        if(hit.targets.some(t=>t.defeated))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,clock())});
      }
      // 실수로 받은 피해를 클라이언트가 위조해 띄우지 않도록 서버 피해 함수의 큐만 전송합니다.
      const bossNow=clock();
      if(bossNow>=(room.bossSaveRetryAt||0)&&(room.pendingBossDeaths?.size||room.serena?.state==='recovering'&&bossNow>=room.serena.respawnAt)){
        try{transaction(()=>{
          settleBossDeaths(room,bossNow);restoreSerenaStatue(room,bossNow);roster(room);
          deliver(()=>io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,bossNow)}));
        });}catch(error){
          const restored=store.rooms.get(room.code);if(restored)restored.bossSaveRetryAt=clock()+1000;
          // 롤백은 전체 room Map을 교체합니다. 다음 교실도 다음 틱의 새 참조로 처리합니다.
          console.error('보스 처치/복원 저장 실패:',error.message);break;
        }
      }
      for(const event of room.bossDialogueEvents?.splice(0)||[]){
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===event.mapId)
          io.to(viewer.socketId).emit('combat:boss-defeated',event);
      }
      const damageNumbers=room.damageNumbers?.splice(0)||[];
      for(const player of room.players.values())damageNumbers.push(...(player.damageNumbers?.splice(0)||[]));
      for(const viewer of room.players.values())if(viewer.connected&&!viewer.away){
        const visible=damageNumbers.filter(hit=>hit.mapId===viewer.mapId);
        if(visible.length)io.to(viewer.socketId).emit('combat:damage-numbers',{hits:visible});
      }
      let lifeSaveFailed=false;
      for(const update of advanceLifeRecovery(room,clock())){
        const player=room.players.get(update.playerId);
        if(update.complete){
          try{transaction(()=>{
            finishLifeRecovery(player);
            if(advanceMissions(room,player,'life-star-complete',undefined,clock()))roster(room);
            deliver(()=>{for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId)
              io.to(viewer.socketId).emit('combat:vitals',update);});
            deliver(()=>io.to(player.socketId).emit('life-star:complete'));
          });}catch(error){console.error('생명의 별 미션 저장 실패:',error.message);lifeSaveFailed=true;break;}
        }else for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId)
          io.to(viewer.socketId).emit('combat:vitals',update);
      }
      // 저장 실패 복구는 방 Map 자체를 교체하므로, 다음 틱에서 새 참조로 재시도합니다.
      if(lifeSaveFailed)break;
      for(const update of advancePassiveRecovery(room,clock())){
        const player=room.players.get(update.playerId);
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away&&viewer.mapId===player.mapId)
          io.to(viewer.socketId).emit('combat:vitals',update);
      }
      let dodgeSaveFailed=false;
      for(const update of advanceDodgeRuns(room)){
        const player=room.players.get(update.playerId);if(!player?.connected)continue;
        if(update.finished){
          if(now<(room.dodgeSaveRetryAt||0))continue;
          try{transaction(()=>{
            const result=completeDodgeRun(room,player,update.state.runId);
            if(result.personalBest)advanceMissions(room,player,'dodge-record',undefined,clock());
            deliver(()=>io.to(player.socketId).emit('dodge:state',{...update,result}));
            deliver(()=>io.to(room.code).emit('dodge:ranking',{ranking:result.ranking}));
            roster(room);
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
          if(starCardsDue(room,clock())){
            try{transaction(()=>{if(expireStarCards(room,clock()))roster(room);});}
            catch(error){console.error('별 카드 종료 저장 실패:',error.message);continue;}
          }
        if(lv2ItemsDue(room,clock())){
          try{transaction(()=>{if(settleLv2Items(room,clock()))roster(room);});}
          catch(error){console.error('아이템 기간 보상 저장 실패:',error.message);continue;}
        }
        if(lv4ItemsDue(room,clock())){
          try{transaction(()=>{if(settleLv4Items(room,clock()))roster(room);});}
          catch(error){console.error('LV4 보유 보상 저장 실패:',error.message);continue;}
        }
        if(lv3ItemsDue(room,clock())){
          try{transaction(()=>{if(settleLv3Items(room,clock()))roster(room);});}
          catch(error){console.error('LV3 아이템 기간 보상 저장 실패:',error.message);continue;}
        }
        const abilityNow=clock();
        const abilityDue=[...room.players.values()].some(p=>(p.abilityState?.blocks||[]).some(block=>
          block.until<=abilityNow&&(!block.reward||p.starShards+block.reward<=SHARDS.max)));
        if(abilityDue){
          try{transaction(()=>{let changed=false;for(const p of room.players.values())changed=settleItemBlocks(p,abilityNow)||changed;if(changed)roster(room);});}
          catch(error){console.error('별자리 능력 만료 저장 실패:',error.message);continue;}
        }
        // 열린 랭킹 창도 한국 시간 월요일 0시를 지나면 즉시 비웁니다.
        if(now>=(room.rankingRetryAt||0)&&['starRanking','dodgeRanking','memoryRanking','signalRanking','tetrisRanking'].some(key=>currentWeekRecords(room[key]||[]).length!==(room[key]||[]).length)){
          try{transaction(()=>{
            room.starRanking=currentWeekRecords(room.starRanking||[]);room.dodgeRanking=currentWeekRecords(room.dodgeRanking||[]);
            room.memoryRanking=currentWeekRecords(room.memoryRanking||[]);room.signalRanking=currentWeekRecords(room.signalRanking||[]);room.tetrisRanking=currentWeekRecords(room.tetrisRanking||[]);
            deliver(()=>io.to(room.code).emit('memory:ranking',{ranking:memoryRanking(room)}));
            deliver(()=>io.to(room.code).emit('stars:ranking',{ranking:starRanking(room)}));
            deliver(()=>io.to(room.code).emit('dodge:ranking',{ranking:dodgeRanking(room)}));
            deliver(()=>io.to(room.code).emit('signal:ranking',{ranking:signalRanking(room)}));
            deliver(()=>io.to(room.code).emit('tetris:ranking',{ranking:tetrisRanking(room)}));
            roster(room);
          });}catch(error){const restored=store.rooms.get(room.code);if(restored)restored.rankingRetryAt=now+5000;console.error('주간 순위 초기화 저장 실패:',error.message);continue;}
        }
        let effectsChanged=false;
        for(const p of room.players.values()){
          const kept=p.effects.filter(e=>e.until>now);
          if(kept.length!==p.effects.length){p.effects=kept;effectsChanged=true;}
          const active=(p.cardMarkers||[]).filter(e=>e.until===null||e.until>now||e.itemId==='sun-rabbit-card');
          if(active.length!==(p.cardMarkers||[]).length){p.cardMarkers=active;effectsChanged=true;}
        }
        if(effectsChanged) roster(room);
      }
      if(step%2===0){
        const before=previous.get(room.code)||new Map(),next=new Map(),positions=[];
        for(const p of room.players.values()){
          if(p.away)continue;
          // 경계에 접한 안전 좌표를 반올림하면 클라이언트에서 바닥 밖이 될 수 있습니다.
          const point=[p.id,p.x,p.y,p.facingX||1];
          next.set(p.id,point);
          const old=before.get(p.id);
          if(step%40===0 || !old || old[1]!==point[1]||old[2]!==point[2]||old[3]!==point[3]) positions.push(point);
        }
        // 아바타 좌표와 몬스터 좌표를 한 번에 보냅니다. 두 volatile 이벤트를 연달아
        // 전송하면 이동 중 첫 패킷 뒤의 몬스터 패킷이 버려질 수 있습니다.
        // 몬스터는 같은 교실 안에서 공유하되 현재 맵의 그림만 클라이언트가 표시합니다.
        if(pruneEnergyDrops(room,now))io.to(room.code).emit('energy:drops',{drops:energyDropViews(room,now)});
        const visibleMonsters=monsterViews(room,clock());
        // volatile 패킷을 연속 전송하면 뒤 패킷이 버려지므로 이동과 스킬 상태를 합칩니다.
        // 소환/지대는 같은 맵에만, 쿨타임은 본인에게만 보냅니다.
        for(const viewer of room.players.values())if(viewer.connected&&!viewer.away)
          io.to(viewer.socketId).volatile.emit('world:positions',{positions,monsters:visibleMonsters,serena:serenaView(room),projectiles:projectileViews(room,viewer.mapId,clock()),aquarius:aquariusViews(room,viewer.mapId,clock()),ophiuchus:ophiuchusViews(room,viewer.mapId,clock()),water:waterAuraViews(room,viewer.mapId,clock()),swan:swanAuraViews(room,viewer.mapId,clock()),aries:ariesCloudViews(room,viewer.mapId,clock()),taurus:taurusDashViews(room,viewer.mapId,clock()),hercules:herculesShieldViews(room,viewer.mapId,clock()),libra:libraAuraViews(room,viewer.mapId,clock()),corona:coronaAuraViews(room,viewer.mapId,clock()),capricorn:capricornBlessingViews(room,viewer.mapId,clock()),
            sagittarius:{casts:sagittariusViews(room,viewer.mapId,clock()),cooldowns:viewer.avatar.constellationId==='aquarius'?aquariusCooldowns(viewer):viewer.avatar.constellationId==='corvus'?corvusCooldowns(viewer):viewer.avatar.constellationId==='cygnus'?swanCooldowns(viewer,clock()):viewer.avatar.constellationId==='ophiuchus'?ophiuchusCooldowns(viewer):viewer.avatar.constellationId==='gemini'?geminiCooldowns(viewer):viewer.avatar.constellationId==='aries'?ariesCooldowns(viewer):viewer.avatar.constellationId==='taurus'?taurusCooldowns(viewer):viewer.avatar.constellationId==='hercules'?herculesCooldowns(viewer):viewer.avatar.constellationId==='libra'?libraCooldowns(viewer):viewer.avatar.constellationId==='corona-borealis'?coronaCooldowns(viewer):viewer.avatar.constellationId==='capricorn'?capricornCooldowns(viewer):viewer.avatar.constellationId==='leo'?leoCooldowns(viewer):isWaterConstellation(viewer)?waterCooldowns(viewer):skillCooldowns(viewer),serverNow:clock()}});
        previous.set(room.code,next);
      }
    }
    for(const code of previous.keys())if(!store.rooms.has(code))previous.delete(code);
    duelArcade.onTick();
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
      duelArcade.dispose();
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
