import {randomUUID} from 'node:crypto';
import {ensure} from './rooms.js';
import {RULES} from '../shared/config.js';
import {journeyComplete,journeyMissions} from './tutorial-journey.js';
import {dailyInstances,ensureDailyMissions,dailyHistoryViews} from './daily-missions.js';

export const MISSION_LIMITS=Object.freeze({count:30,title:40,description:240,reward:10,recipients:RULES.maxStudents,hours:8760});
export const MISSION_REWARD_TYPES=Object.freeze(['star-crumb','star-shard','cosmic-energy']);
export const AUTO_OBJECTIVES=Object.freeze(['map-travel','energy-collect','tetris-lines','dodge-record','memory-win','english-success','math-correct','craft-level','baseball-win','sudoku-win','signal-stage','tutorial-complete','life-star-complete','timetable-read','culture-read','history-read','science-read','one-stroke-win']);
const autoObjectives=new Set(AUTO_OBJECTIVES);
const difficulties=new Set(['low','medium','high']);
const uniqueIds=value=>Array.isArray(value)&&value.every(id=>typeof id==='string'&&id.length>0)&&new Set(value).size===value.length;
export const validMissionTimestamp=value=>Number.isSafeInteger(value)&&value>=0&&value<=8640000000000000;
export const missionExpired=(mission,now=Date.now())=>mission.expiresAt!=null&&now>=mission.expiresAt;
const missionFull=mission=>mission.maxRecipients!=null&&mission.acceptedIds.length>=mission.maxRecipients;
function missionLimitsView(mission,now){return {maxRecipients:mission.maxRecipients??null,acceptedCount:mission.acceptedIds.length,
  expiresAt:mission.expiresAt??null,expired:missionExpired(mission,now),full:missionFull(mission)};}

export function validateMissions(value,{limit=MISSION_LIMITS.count,instances=false}={}){
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>limit)throw new Error('Invalid missions');
  const ids=new Set();
  return value.map(mission=>{
    const validRewards=mission?.rewards===undefined||Array.isArray(mission.rewards)&&mission.rewards.length>0&&
      new Set(mission.rewards.map(reward=>reward?.type)).size===mission.rewards.length&&mission.rewards.every(reward=>
        reward&&MISSION_REWARD_TYPES.includes(reward.type)&&Number.isSafeInteger(reward.quantity)&&reward.quantity>=1&&reward.quantity<=MISSION_LIMITS.reward);
    if(!mission||typeof mission!=='object'||typeof mission.id!=='string'||ids.has(mission.id)||
      typeof mission.title!=='string'||!mission.title.trim()||mission.title.length>MISSION_LIMITS.title||
      typeof mission.description!=='string'||!mission.description.trim()||mission.description.length>MISSION_LIMITS.description||
      !validRewards||!(mission.repeat==='daily'?mission.rewards!==undefined?
          Number.isSafeInteger(mission.rewardShards)&&mission.rewardShards===(mission.rewards.find(reward=>reward.type==='star-shard')?.quantity||0):
          mission.rewardShards===0&&mission.rewardItem==='star-crumb'&&Number.isSafeInteger(mission.rewardQuantity)&&mission.rewardQuantity>=1&&mission.rewardQuantity<=10:
        mission.rewards!==undefined?Number.isSafeInteger(mission.rewardShards)&&mission.rewardShards>=0&&mission.rewardShards<=MISSION_LIMITS.reward:
        Number.isSafeInteger(mission.rewardShards)&&mission.rewardShards>=1&&mission.rewardShards<=MISSION_LIMITS.reward)||
      !['all','board'].includes(mission.distribution)||!Number.isSafeInteger(mission.at)||mission.at<0||
      !uniqueIds(mission.acceptedIds)||!uniqueIds(mission.completedIds)||!uniqueIds(mission.claimedIds)||
      mission.completedIds.some(id=>!mission.acceptedIds.includes(id))||
      mission.claimedIds.some(id=>!mission.completedIds.includes(id))||
      (mission.objective!==undefined&&(!autoObjectives.has(mission.objective)||!Number.isSafeInteger(mission.goal)||mission.goal<1||mission.goal>100||
        (mission.objective==='math-correct'&&(!Number.isSafeInteger(mission.grade)||mission.grade<1||mission.grade>6))||
        (mission.objective==='craft-level'&&(!Number.isSafeInteger(mission.itemLevel)||mission.itemLevel<2||mission.itemLevel>5))||
        (['baseball-win','sudoku-win','one-stroke-win'].includes(mission.objective)&&!difficulties.has(mission.difficulty))||
        (mission.objective==='signal-stage'&&(!Number.isSafeInteger(mission.stage)||mission.stage<1||mission.stage>6||mission.goal!==1))||
        (['tutorial-complete','life-star-complete','timetable-read'].includes(mission.objective)&&mission.goal!==1)||
        !mission.progress||typeof mission.progress!=='object'||Array.isArray(mission.progress)||
        Object.entries(mission.progress).some(([id,count])=>!mission.acceptedIds.includes(id)||!Number.isSafeInteger(count)||count<0||count>mission.goal))))throw new Error('Invalid missions');
    if(mission.maxRecipients!=null&&(!Number.isSafeInteger(mission.maxRecipients)||mission.maxRecipients<1||mission.maxRecipients>MISSION_LIMITS.recipients||mission.distribution!=='board'||mission.acceptedIds.length>mission.maxRecipients))throw new Error('Invalid mission capacity');
    if(mission.repeat!=null&&mission.repeat!=='daily')throw new Error('Invalid mission repeat');
    if(mission.repeat==='daily'&&(!mission.objective||mission.objective==='tutorial-complete'||mission.distribution!=='all'||mission.maxRecipients!=null||
      mission.validityHours!=null&&(!Number.isSafeInteger(mission.validityHours)||mission.validityHours<1||mission.validityHours>24)||
      !instances&&(mission.acceptedIds.length||mission.completedIds.length||mission.claimedIds.length||mission.day!==undefined||mission.expiresAt!=null)))throw new Error('Invalid daily template');
    if(mission.expiresAt!=null&&(!validMissionTimestamp(mission.expiresAt)||mission.expiresAt<=mission.at))throw new Error('Invalid mission expiry');
    if(mission.claimedAt!==undefined&&(!mission.claimedAt||typeof mission.claimedAt!=='object'||Array.isArray(mission.claimedAt)||
      Object.entries(mission.claimedAt).some(([id,at])=>!mission.claimedIds.includes(id)||!validMissionTimestamp(at))))throw new Error('Invalid mission claim dates');
    ids.add(mission.id);return structuredClone(mission);
  });
}

export function createMission(room,data,now=Date.now()){
  const title=String(data?.title||'').trim(),description=String(data?.description||'').trim();
  ensure(title.length>0&&title.length<=MISSION_LIMITS.title,'미션 이름을 40자 이내로 적어 주세요.');
  ensure(description.length>0&&description.length<=MISSION_LIMITS.description,'완료 조건을 240자 이내로 적어 주세요.');
  ensure(data.repeat==null||data.repeat==='daily','반복 설정을 확인해주세요.');
  const daily=data.repeat==='daily',legacyQuantity=daily?data.rewardQuantity:data.rewardShards;
  let rewards;
  if(data.rewards!==undefined){
    ensure(Array.isArray(data.rewards)&&data.rewards.length>0&&data.rewards.length<=MISSION_REWARD_TYPES.length,'보상을 하나 이상 선택해 주세요.');
    const types=new Set();
    rewards=data.rewards.map(reward=>{
      ensure(reward&&MISSION_REWARD_TYPES.includes(reward.type)&&!types.has(reward.type),'보상 종류를 확인해주세요.');types.add(reward.type);
      ensure(Number.isSafeInteger(reward.quantity)&&reward.quantity>=1&&reward.quantity<=MISSION_LIMITS.reward,'각 보상 수량은 1~10개로 정해 주세요.');
      return {type:reward.type,quantity:reward.quantity};
    });
    const shardAmount=rewards.find(reward=>reward.type==='star-shard')?.quantity||0;
    ensure(data.rewardShards===undefined||data.rewardShards===shardAmount||data.rewardShards===0&&shardAmount===0,'별 파편 보상 값이 선택한 보상과 달라요.');
  }else if(daily)ensure(Number.isSafeInteger(legacyQuantity)&&legacyQuantity>=1&&legacyQuantity<=MISSION_LIMITS.reward,'보상은 1~10개로 정해 주세요.');
  else ensure(Number.isSafeInteger(legacyQuantity)&&legacyQuantity>=1&&legacyQuantity<=MISSION_LIMITS.reward,'보상은 1~10개로 정해 주세요.');
  const shardReward=rewards?rewards.find(reward=>reward.type==='star-shard')?.quantity||0:daily?0:legacyQuantity;
  ensure(!daily||data.objective&&data.objective!=='tutorial-complete'&&data.distribution==='all'&&data.maxRecipients==null,'매일 반복은 다시 수행할 수 있는 자동미션을 전체 배포로 정해주세요.');
  ensure(['all','board'].includes(data?.distribution),'배포 방식을 선택해 주세요.');
  const maxRecipients=data.maxRecipients??null,validityHours=data.validityHours??null;
  ensure(maxRecipients===null||Number.isSafeInteger(maxRecipients)&&maxRecipients>=1&&maxRecipients<=MISSION_LIMITS.recipients,`선착순 인원은 1~${MISSION_LIMITS.recipients}명으로 정해 주세요.`);
  ensure(maxRecipients===null||data.distribution==='board','선착순 미션은 게시판에서 직접 받기로 정해 주세요.');
  ensure(validityHours===null||Number.isSafeInteger(validityHours)&&validityHours>=1&&validityHours<=MISSION_LIMITS.hours,'유효기간은 1~8760시간으로 정해 주세요.');
  ensure(!daily||validityHours===null||validityHours<=24,'일일 미션의 유효기간은 1~24시간으로 정해 주세요.');
  ensure(validMissionTimestamp(now)&&validMissionTimestamp(now+(validityHours||0)*3600000),'미션 시간을 기록할 수 없어요.');
  if(data?.objective!==undefined){
    ensure(autoObjectives.has(data.objective),'자동미션 조건을 골라 주세요.');
    ensure(Number.isSafeInteger(data.goal)&&data.goal>=1&&data.goal<=100,'목표 횟수는 1~100회로 정해 주세요.');
    if(data.objective==='math-correct')ensure(Number.isSafeInteger(data.grade)&&data.grade>=1&&data.grade<=6,'수학 발전소 학년을 골라 주세요.');
    if(data.objective==='craft-level')ensure(Number.isSafeInteger(data.itemLevel)&&data.itemLevel>=2&&data.itemLevel<=5,'조합할 아이템 레벨을 골라 주세요.');
    if(['baseball-win','sudoku-win','one-stroke-win'].includes(data.objective))ensure(difficulties.has(data.difficulty),'게임 난이도를 골라 주세요.');
    if(data.objective==='signal-stage')ensure(Number.isSafeInteger(data.stage)&&data.stage>=1&&data.stage<=6&&data.goal===1,'우주 신호 단계를 골라 주세요.');
    if(['tutorial-complete','life-star-complete','timetable-read'].includes(data.objective))ensure(data.goal===1,'이 조건은 한 번 완료하면 달성돼요.');
  }
  room.missions??=[];ensure(room.missions.length<MISSION_LIMITS.count,'미션은 교실당 30개까지 만들 수 있어요.');
  if(daily)ensure(dailyInstances(room,now).filter(m=>m.templateId!=='builtin-timetable').length<MISSION_LIMITS.count,'오늘 배정한 반복 미션은 중지한 미션을 포함해 30개까지 만들 수 있어요.');
  const mission={id:randomUUID(),title,description,rewardShards:shardReward,...(rewards?{rewards}:{}),distribution:data.distribution,at:now,maxRecipients,
    ...(daily?{repeat:'daily',...(rewards?{}:{rewardItem:'star-crumb',rewardQuantity:legacyQuantity}),validityHours}:{}),
    expiresAt:daily||validityHours===null?null:now+validityHours*3600000,
    acceptedIds:!daily&&data.distribution==='all'?[...room.players.values()].filter(p=>p.role==='student').map(p=>p.id):[],completedIds:[],claimedIds:[],
    ...(data.objective?{objective:data.objective,goal:data.goal,progress:{},
      ...(data.objective==='math-correct'?{grade:data.grade}:{}),...(data.objective==='craft-level'?{itemLevel:data.itemLevel}:{}),
      ...(['baseball-win','sudoku-win','one-stroke-win'].includes(data.objective)?{difficulty:data.difficulty}:{}),
      ...(data.objective==='signal-stage'?{stage:data.stage}:{})}:{})};
  // 첫 여행 안내는 한 번만 끝낼 수 있으므로, 미션 제작 전에 완료한 친구도 즉시 달성 상태로 둡니다.
  if(mission.objective==='tutorial-complete')for(const id of mission.acceptedIds){
    if(journeyComplete(room.players.get(id)||{})){mission.progress[id]=1;mission.completedIds.push(id);}
  }
  room.missions.push(mission);if(daily)ensureDailyMissions(room,now);return mission;
}

export const activeMissionRecords=(room,now=Date.now())=>[...(room.missions||[]).filter(m=>m.repeat!=='daily'),...dailyInstances(room,now)];
export const findMission=(room,id,now=Date.now())=>activeMissionRecords(room,now).find(m=>m.id===id);
const rewardView=m=>({rewardItem:m.rewardItem??null,rewardQuantity:m.rewardQuantity??m.rewardShards,rewardShards:m.rewardShards,
  ...(m.rewards?{rewards:structuredClone(m.rewards)}:{}),
  ...(m.repeat==='daily'?{repeat:'daily',templateId:m.templateId,day:m.day}:{} )});

export function acceptMission(room,player,missionId,now=Date.now()){
  ensure(player.role==='student','학생만 미션을 받을 수 있어요.');
  const mission=room.missions?.find(m=>m.id===missionId);
  ensure(mission?.distribution==='board','게시판에서 받을 수 있는 미션이 아니에요.');
  ensure(!missionExpired(mission,now),'유효기간이 끝난 미션이에요.');
  ensure(!mission.acceptedIds.includes(player.id),'이미 받은 미션이에요.');
  ensure(!missionFull(mission),'선착순 인원이 모두 찼어요.');
  mission.acceptedIds.push(player.id);
  if(mission.objective==='tutorial-complete'&&journeyComplete(player)){mission.progress[player.id]=1;mission.completedIds.push(player.id);}
  return mission;
}

export function completeMission(room,studentId,missionId,now=Date.now()){
  const mission=room.missions?.find(m=>m.id===missionId);
  ensure(mission,'미션을 찾을 수 없어요.');
  ensure(!missionExpired(mission,now),'유효기간이 끝나 완료할 수 없어요.');
  ensure(!mission.objective,'자동미션은 게임 안에서 달성하면 자동으로 확인돼요.');
  ensure(mission.acceptedIds.includes(studentId),'그 친구가 받은 미션이 아니에요.');
  ensure(!mission.completedIds.includes(studentId),'이미 달성 확인을 마친 미션이에요.');
  mission.completedIds.push(studentId);return mission;
}

// 서버가 판정한 행동만 세어, 클라이언트가 임의의 달성 횟수를 보낼 수 없게 합니다.
export function advanceMissions(room,player,objective,detail,now=Date.now()){
  if(player.role!=='student')return false;
  if(objective==='tutorial-complete'&&!journeyComplete(player))return false;
  let changed=ensureDailyMissions(room,now);
  for(const mission of activeMissionRecords(room,now)){
    if(missionExpired(mission,now)||mission.objective!==objective||!mission.acceptedIds.includes(player.id)||mission.completedIds.includes(player.id)||
      objective==='math-correct'&&mission.grade!==detail||objective==='craft-level'&&mission.itemLevel!==detail||
      ['baseball-win','sudoku-win','one-stroke-win'].includes(objective)&&mission.difficulty!==detail||
      objective==='signal-stage'&&detail<mission.stage)continue;
    const gain=objective==='tetris-lines'?detail:1;
    if(!Number.isSafeInteger(gain)||gain<1)continue;
    const next=Math.min(mission.goal,(mission.progress[player.id]||0)+gain);
    mission.progress[player.id]=next;
    if(next===mission.goal)mission.completedIds.push(player.id);
    changed=true;
  }
  return changed;
}

export function claimMission(room,player,missionId,now=Date.now()){
  const mission=findMission(room,missionId,now);
  ensure(mission&&mission.acceptedIds.includes(player.id),'받은 미션이 아니에요.');
  ensure(!missionExpired(mission,now),'유효기간이 끝나 보상을 받을 수 없어요.');
  ensure(mission.completedIds.includes(player.id),'아직 완료 조건이 확인되지 않았어요.');
  ensure(!mission.claimedIds.includes(player.id),'이미 보상을 받은 미션이에요.');
  ensure(validMissionTimestamp(now),'완료 시각을 기록할 수 없어요.');
  mission.claimedIds.push(player.id);
  mission.claimedAt={...mission.claimedAt,[player.id]:now};return mission;
}

export function missionViews(room,viewer,now=Date.now()){
  if(!viewer)return [];
  const missions=activeMissionRecords(room,now).filter(m=>viewer.role==='teacher'||m.acceptedIds.includes(viewer.id)).map(m=>({
    id:m.id,title:m.title,description:m.description,rewardShards:m.rewardShards,distribution:m.distribution,at:m.at,
    ...rewardView(m),...(m.repeat==='daily'?{repeatStopped:m.templateId!=='builtin-timetable'&&!(room.missions||[]).some(t=>t.id===m.templateId)}:{}),
    ...missionLimitsView(m,now),
    ...(m.objective?{objective:m.objective,goal:m.goal,progress:m.progress[viewer.id]||0,
      ...(m.grade?{grade:m.grade}:{}),...(m.itemLevel?{itemLevel:m.itemLevel}:{}),
      ...(m.difficulty?{difficulty:m.difficulty}:{}),...(m.stage?{stage:m.stage}:{})}:{}),
    status:viewer.role==='teacher'?'teacher':m.claimedIds.includes(viewer.id)?'claimed':missionExpired(m,now)?'expired':m.completedIds.includes(viewer.id)?'ready':'active',
    ...(viewer.role==='student'?{claimedAt:m.claimedIds.includes(viewer.id)&&Object.hasOwn(m.claimedAt||{},viewer.id)?m.claimedAt[viewer.id]:null}:{}),
    ...(viewer.role==='teacher'?{acceptedCount:m.acceptedIds.length,completedCount:m.completedIds.length,claimedCount:m.claimedIds.length}:{})
  }));
  if(viewer.role==='student')missions.push(...dailyHistoryViews(viewer),...journeyMissions(viewer));
  return missions;
}

export function missionBoardViews(room,viewer,now=Date.now()){
  const missions=activeMissionRecords(room,now).filter(m=>viewer.role==='teacher'||m.distribution==='board'&&!m.acceptedIds.includes(viewer.id));
  return missions.map(m=>({id:m.id,title:m.title,description:m.description,rewardShards:m.rewardShards,distribution:m.distribution,
    ...missionLimitsView(m,now),...rewardView(m),...(m.repeat==='daily'?{repeatStopped:m.templateId!=='builtin-timetable'&&!(room.missions||[]).some(t=>t.id===m.templateId)}:{}),
    ...(m.objective?{objective:m.objective,goal:m.goal,
      ...(m.grade?{grade:m.grade}:{}),...(m.itemLevel?{itemLevel:m.itemLevel}:{}),
      ...(m.difficulty?{difficulty:m.difficulty}:{}),...(m.stage?{stage:m.stage}:{})}:{}),
    ...(viewer.role==='teacher'?{students:m.acceptedIds.map(id=>{
      const student=room.players.get(id);
      return {id,nickname:student?.nickname||'떠난 친구',status:m.claimedIds.includes(id)?'claimed':missionExpired(m,now)?'expired':m.completedIds.includes(id)?'ready':'active',
        ...(m.objective?{progress:m.progress[id]||0}:{})};
    })}:{})}));
}
