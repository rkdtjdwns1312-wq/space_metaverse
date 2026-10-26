import {warningSummary} from './warnings.js';
import {attackPowerOf,defensePowerOf} from '../shared/combat.js';
import {playerVitals} from './vitals.js';
import {equipmentAuraOf} from '../shared/equipment.js';
import {knownStatus} from '../shared/statuses.js';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { RULES, PLAZA_ID, CHAT, EXAMPLE_PLANETS, createAvatar } from '../shared/config.js';
import { spawnPosition, addPlanet } from './world.js';
import {monsterViews} from './monsters.js';
import {serenaView} from './boss-lifecycle.js';
import {serenaEligible,serenaEligibility} from './serena-progress.js';
import {cardMarkerViews} from './item-cards.js';
import {freshAbilityState,abilityBlockViews} from './constellation-abilities.js';
import {freshConstellationAbilityState,constellationAbilityStatus} from './constellation-weekly-abilities.js';
import {swanCampaignSigns,swanCampaignRequests,swanCardOffer} from './swan-weekly.js';
import {crownPriorities} from './corona-weekly.js';
import {cetusInviteViews} from './cetus-weekly.js';
import {TEACHER_AVATAR} from '../shared/teacher-avatar.js';
import {energyDropViews} from './energy-drops.js';
import {activeStarCards,starCardShopDiscounts} from './star-cards.js';
import {EXPLORATION_GOAL} from '../shared/exploration.js';
import {objectSignals} from './object-signals.js';
import {missionViews,missionExpired} from './missions.js';
import {journeyView,practiceItems} from './tutorial-journey.js';
import {partyView,leaveParty} from './party.js';
import {GameError,pinHash,checkPin} from './pin-auth.js';
export {GameError} from './pin-auth.js';
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
// 아이템 효과를 스냅샷/사용 응답에 실을 때 쓰는 뷰. 누가 썼는지(fromId/fromNickname)는 선생님에게만 보입니다.
export function effectsView(effects, viewerIsTeacher) {
  return (effects||[]).map(e=>{
    const v={itemId:e.itemId,icon:e.icon,label:e.label,style:e.style,until:e.until,...(knownStatus(e.statusId)?{statusId:e.statusId}:{})};
    if(Number.isSafeInteger(e.remainingUses)&&e.remainingUses>=0)v.remainingUses=e.remainingUses;
    if(viewerIsTeacher){v.fromId=e.fromId;v.fromNickname=e.fromNickname;}
    return v;
  });
}
export function playerEffectsView(player,viewerIsTeacher,now=Date.now()){
  const poison=player.combatPoison?.expiresAt>now?[{statusId:'poison',label:'중독 상태',icon:'🧪',style:'poison',until:player.combatPoison.expiresAt}]:[];
  const combat=[];
  const add=(id,label,icon,until)=>{if(until>now)combat.push({statusId:id,label,icon,style:'combat',until});};
  add('capricorn-blessing','염소의 축복','♑',player.capricornBlessing?.endsAt);
  add('leo-courage','사자의 용기','♌',player.leoCourage?.endsAt);
  add('libra-reflect','천칭의 보호','⚖',player.libraAura?.endsAt);
  if(player.libraBuff?.bonus)combat.push({statusId:'libra-reflect',label:'천칭의 공격력',icon:'⚖',style:'combat',until:now+1000});
  add('hercules-shield','헤라클레스 방패','🛡',player.herculesShield?.endsAt);
  add('taurus-immunity','황소의 무적','♉',player.taurusImmuneUntil);
  if(player.waterAura?.kind==='cetus')add('whale-defense','고래의 방어','🐋',player.waterAura.endsAt);
  if(player.waterAura?.kind==='cancer')add('crab-empowerment','게의 힘','♋',player.waterAura.endsAt);
  add('crown-aura','왕관의 힘','♛',player.coronaAura?.endsAt);
  add('swan-wings','백조의 날개','🪽',player.swanAura?.endsAt);
  add('pair','물고기자리 짝','🤝',player.piscesPair?.endsAt);
  add('sleep','양자리 수면','💤',player.constellationAbilityState?.ariesSleep?.endsAt);
  const paralysis=player.constellationAbilityState?.paralysis;
  if(paralysis?.endsAt>now)add(`paralysis-${paralysis.level===2?'mid':paralysis.level===3?'low':'high'}`,
    `${paralysis.level===2?'중급':paralysis.level===3?'하급':'고급'} 마비상태`,'🐍',paralysis.endsAt);
  add('ability-seal','별자리 능력 봉인','🔒',player.constellationAbilityState?.abilitySeal?.endsAt);
  add('cetus-praise','고래의 칭찬','🐋',player.constellationAbilityState?.cetusPraise?.endsAt);
  add('cetus-stomach','고래 배 속','🐋',player.constellationAbilityState?.cetusStomach?.endsAt);
  add('cetus-afterglow','고래의 선물','✨',player.constellationAbilityState?.cetusAfterglow?.endsAt);
  for(const challenge of player.constellationAbilityState?.leoChallenges||[]){
    if(challenge.endsAt>now&&!challenge.rewarded)add(`challenge-${challenge.level===2?'low':challenge.level===3?'mid':'high'}`,
      `${challenge.level===2?'하급':challenge.level===3?'중급':'고급'} 도전 상태`,'♌',challenge.endsAt);
  }
  return [...cardMarkerViews(player,viewerIsTeacher,now),...abilityBlockViews(player,now),...effectsView(player.effects,viewerIsTeacher),...poison,...combat];
}
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
  constructor({maxActiveRooms=RULES.maxRooms,clock=Date.now}={}) {
    if(!Number.isSafeInteger(maxActiveRooms)||maxActiveRooms<1||maxActiveRooms>40)throw new Error('MAX_ACTIVE_ROOMS must be an integer from 1 to 40.');
    this.maxActiveRooms=maxActiveRooms;
    this.clock=clock;
  }
  newCode() {
    let code;
    do { code=Array.from({length:6},()=>letters[randomInt(letters.length)]).join(''); } while(this.rooms.has(code));
    return code;
  }
  create(data,socketId,{archivedCreation=false}={}) {
    ensure(archivedCreation||this.rooms.size<this.maxActiveRooms,'지금은 교실이 가득 찼어요. 잠시 후 다시 시도해주세요.');
    const title=nickname(data.title || '우리 우주 교실');
    ensure(Array.isArray(data.allowedNames) && data.allowedNames.length>=(data.allowEmpty===true?0:1) && data.allowedNames.length<=RULES.maxStudents,
      `학생 닉네임을 1~${RULES.maxStudents}개 입력해주세요.`);
    const allowedNames=new Set(data.allowedNames.map(nickname));
    ensure(allowedNames.size===data.allowedNames.length,'허용 닉네임에 같은 이름이 있어요.');
    ensure(!allowedNames.has('선생님'),'선생님은 학생 닉네임으로 사용할 수 없어요.');
    const room={ code:this.newCode(), title, allowedNames, players:new Map(), ariesInvites:new Map(), cancerInvites:new Map(), mapId:PLAZA_ID, chat:{enabled:true,history:[]},
      planets:new Map(), proposals:new Map(), missions:[], signalRanking:[], tetrisRanking:[], itemLog:[], tradeLog:[], trades:new Map(), starCardText:{},exploration:{energy:0,results:[]} };
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
    const previous=[...room.players.values()].find(p=>p.nickname===name);
    if(previous){
      ensure(!previous.connected,'이미 사용 중인 닉네임이에요. 원래 창에서 계속해주세요.');
      if(previous.pin)checkPin(previous,data.pin);
      else ensure(previous.expiresAt>Date.now()&&data.token===previous.token,
        '이전 접속 정보가 없어요. 다시 입장하려면 선생님께 알려주세요.');
      this.sessions.delete(previous.token);
      previous.token=randomBytes(32).toString('hex');
      Object.assign(previous,{socketId,connected:true,connectedAt:Date.now(),expiresAt:null,input:{x:0,y:0,at:0}});
      const session={room,player:previous};this.sessions.set(previous.token,session);return session;
    }
    // 저장하지 않는 임시 교실의 기존 소켓 호출은 PIN을 보내지 않을 수 있습니다.
    const pin=data.pin===undefined?null:pinHash(data.pin);
    ensure(room.players.size<RULES.maxPlayers,`교실 정원 ${RULES.maxPlayers}명이 모두 찼어요.`);
    const player=this.add(room,name,'student',socketId);player.pin=pin;return {room,player};
  }
  add(room,name,role,socketId) {
    const token=randomBytes(32).toString('hex');
    const p={ id:randomUUID(), nickname:name, role, ...spawnPosition(room), mapId:PLAZA_ID,
      avatar:role==='teacher'?{...createAvatar(),form:TEACHER_AVATAR.form,level:TEACHER_AVATAR.level,xp:0}:createAvatar(), inventory:[], equipmentSlots:[null,null,null], starShards:0, cosmicEnergy:0, connected:true, socketId,
      connectedAt:Date.now(),expiresAt:null, input:{x:0,y:0,at:0}, muted:false, lastChatAt:0,
      effects:[], cardMarkers:[], rabbitDraw:null, rabbitUsedDay:null,abilityState:freshAbilityState(),constellationAbilityState:freshConstellationAbilityState(),piscesPair:null,lastItemUseAt:0, notes:[], tasks:[],explorationChances:0,tutorialCompleted:false,tutorialRewardClaimed:false,tutorialCompletedAt:null,tutorialRewardClaimedAt:null,starBestMs:null,dodgeBestMs:null };
    room.players.set(p.id,p);
    if(role==='student')for(const mission of room.missions||[])if(mission.repeat!=='daily'&&mission.distribution==='all'&&!missionExpired(mission,this.clock()))mission.acceptedIds.push(p.id);
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
    Object.assign(session.player,{ connected:true, connectedAt:now,socketId, expiresAt:null, input:{x:0,y:0,at:0} });
    return session;
  }
  remove(room,p) { leaveParty(room,p.id,Date.now(),true);this.sessions.delete(p.token); room.players.delete(p.id); }
  destroy(room) {
    for (const p of room.players.values()) this.sessions.delete(p.token);
    this.rooms.delete(room.code);
  }
  // viewer: 이 스냅샷을 받을 플레이어 객체(또는 null=최소 정보). 아이들끼리는 서로의 별 파편·아이템·아이템 사용자·거래 내용이 비밀이라
  // 받는 사람에 따라 내용을 다르게 만듭니다(선생님은 전부 봅니다). roster()가 방의 플레이어 소켓마다 이 함수를 따로 호출합니다.
  snapshot(room, viewer=null,now=Date.now()) {
    const isTeacher=!!(viewer && viewer.role==='teacher');
    const memberCount=planetId=>[...room.players.values()].filter(p=>p.avatar.departmentId===planetId).length;
    return {code:room.code,title:room.title,mapId:room.mapId,maxPlayers:RULES.maxPlayers,chat:{enabled:room.chat.enabled},
      monsters:monsterViews(room,now),energyDrops:energyDropViews(room),serena:serenaView(room),
      missions:missionViews(room,viewer,now),
      ariesInvites:[...(room.ariesInvites?.values()||[])].filter(invite=>viewer&&invite.expiresAt>now&&(invite.fromId===viewer.id||invite.toId===viewer.id)),
      cancerInvites:[...(room.cancerInvites?.values()||[])].filter(invite=>viewer&&invite.expiresAt>now&&(invite.fromId===viewer.id||invite.toId===viewer.id)).map(invite=>{
        if(invite.fromId===viewer.id)return {...invite};
        const {choice,...visible}=invite;return visible;
      }),
      cetusInvites:viewer?cetusInviteViews(room,viewer,now):[],
      starCards:activeStarCards(room),campaignSigns:swanCampaignSigns(room,now),...(isTeacher?{campaignRequests:swanCampaignRequests(room,now),crownPriorities:crownPriorities(room,now)}:{}),
      exploration:{energy:room.exploration?.energy||0,goal:EXPLORATION_GOAL,festival:(room.exploration?.energy||0)>=EXPLORATION_GOAL},
      objectSignals:viewer?objectSignals(room,viewer):{},
      shopDiscounts:starCardShopDiscounts(room,viewer),
      planets:[...room.planets.values()].map(pl=>({id:pl.id,name:pl.name,description:pl.description,x:pl.x,y:pl.y,
        radius:pl.radius,color:pl.color,rules:[...pl.rules],memberCount:memberCount(pl.id),createdBy:pl.createdBy,
        joinPending:!!viewer&&(pl.joinRequests||[]).some(r=>r.playerId===viewer.id),
        mailboxCount:viewer&&(isTeacher||viewer.avatar.departmentId===pl.id)?(pl.joinRequests||[]).length:0,
        warningStatus:warningSummary(room,pl),templateId:pl.templateId,interiorDecor:structuredClone(pl.interiorDecor||{}),interiorUnlocks:structuredClone(pl.interiorUnlocks||{}),reportPending:pl.work?.report.status==='submitted',rename:renameView(room,pl.id,pl.rename)})),
      proposals:[...room.proposals.values()].map(pr=>({id:pr.id,name:pr.name,description:pr.description,x:pr.x,y:pr.y,
        radius:pr.radius,color:pr.color,playerId:pr.playerId,nickname:pr.nickname,templateId:pr.templateId})),
      players:[...room.players.values()].map(p=>{
        const out={id:p.id,nickname:p.nickname,role:p.role,accountKind:p.accountKind==='master'?'master':'student',x:p.x,y:p.y,facingX:p.facingX||1,
          connected:p.connected,connectedAt:p.connectedAt||0,away:!!p.away,avatar:{...p.avatar,blackStar:!!p.avatar.blackStar},muted:p.muted,mapId:p.mapId,departmentId:p.avatar.departmentId,
          piscesPair:p.piscesPair?.endsAt>now?{partnerId:p.piscesPair.partnerId,partnerName:room.players.get(p.piscesPair.partnerId)?.nickname||'친구',endsAt:p.piscesPair.endsAt,level:p.piscesPair.level,warningMirror:(p.piscesPair.level===3||p.piscesPair.level===4)&&p.piscesPair.sourceId===p.id}:null,
          ariesSleep:p.constellationAbilityState?.ariesSleep?.endsAt>now?{endsAt:p.constellationAbilityState.ariesSleep.endsAt,wakeCost:p.constellationAbilityState.ariesSleep.wakeCost}:null,
          transformation:p.transformation?{active:p.transformation.active,endsAt:p.transformation.endsAt,cooldownUntil:p.transformation.cooldownUntil}:null,effects:playerEffectsView(p,isTeacher,now),equipmentAura:equipmentAuraOf(p),combat:{attackPower:attackPowerOf(p.avatar.level,p.avatar.constellationId,p),defensePower:defensePowerOf(p.avatar.level,p.avatar.constellationId,p)},vitals:playerVitals(p)};
        if(isTeacher || (viewer && viewer.id===p.id)){ out.starShards=p.starShards; out.cosmicEnergy=p.cosmicEnergy??0; out.inventory=[...p.inventory];out.equipmentSlots=[...(p.equipmentSlots||[null,null,null])];out.explorationChances=p.explorationChances||0; }
        if(viewer && viewer.id===p.id){out.serenaEligible=serenaEligible(p);out.serenaEligibility=serenaEligibility(p);out.tasks=structuredClone(p.tasks||[]);out.tutorialCompleted=!!p.tutorialCompleted;out.tutorialRewardClaimed=!!p.tutorialRewardClaimed;out.tutorialCompletedAt=p.tutorialCompletedAt??null;out.tutorialRewardClaimedAt=p.tutorialRewardClaimedAt??null;out.rabbitDrawPending=!!p.rabbitDraw;out.superclusterEnergy=p.lv4State?.stacks||0;
          if(p.role==='student'){out.journey=journeyView(p);out.practiceItems=practiceItems(p);}
          out.eclipseFeeDue=(p.cardMarkers||[]).some(marker=>marker.itemId==='total-eclipse-card'&&marker.until>Date.now()&&marker.fromId!==p.id);
          out.abilityUsedWeek=p.abilityState?.usedWeek||null;out.abilityPending=structuredClone(p.abilityState?.pending||null);out.constellationAbility={...constellationAbilityStatus(p,now),swanCardOffer:swanCardOffer(room,p,now)};}
        return out;
      }),
      ...(isTeacher ? {itemLog:[...room.itemLog]} : {}),
      trades:[...room.trades.values()]
        .filter(t=>viewer && (t.fromId===viewer.id || t.toId===viewer.id))
        .map(t=>({id:t.id,fromId:t.fromId,fromNickname:t.fromNickname,toId:t.toId,toNickname:t.toNickname,
          give:t.give,want:t.want,status:t.status,at:t.at,revision:t.revision,confirmed:[...(t.confirmed||[])]})),
      summons:[...(room.summons?.values()||[])].filter(r=>r.expiresAt>Date.now()&&viewer&&(r.toId===viewer.id||r.fromId===viewer.id)),
      summonCooldowns:[...(room.summonCooldowns||[])].filter(([key,until])=>viewer&&key.startsWith(viewer.id+':')&&until>Date.now()).map(([key,until])=>({targetId:key.slice(viewer.id.length+1),until})),
      ...partyView(room,viewer,now)
    };
  }
  pushChat(room,{playerId,nickname,role,text,flagged,...scope}) {
    const msg={id:randomUUID(),playerId,nickname,role,text,at:Date.now(),flagged,...scope};
    room.chat.history.push(msg);
    if(room.chat.history.length>CHAT.historySize) room.chat.history.shift();
    return msg;
  }
}
