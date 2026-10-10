import {randomUUID} from 'node:crypto';
import {ensure} from './rooms.js';

export const MISSION_LIMITS=Object.freeze({count:30,title:40,description:240,reward:10});
export const AUTO_OBJECTIVES=Object.freeze(['map-travel','energy-collect','tetris-lines','dodge-record','memory-win','english-success','math-correct','craft-level','baseball-win','sudoku-win','signal-stage','tutorial-complete','life-star-complete']);
const autoObjectives=new Set(AUTO_OBJECTIVES);
const difficulties=new Set(['low','medium','high']);
const uniqueIds=value=>Array.isArray(value)&&value.every(id=>typeof id==='string'&&id.length>0)&&new Set(value).size===value.length;

export function validateMissions(value){
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>MISSION_LIMITS.count)throw new Error('Invalid missions');
  const ids=new Set();
  return value.map(mission=>{
    if(!mission||typeof mission!=='object'||typeof mission.id!=='string'||ids.has(mission.id)||
      typeof mission.title!=='string'||!mission.title.trim()||mission.title.length>MISSION_LIMITS.title||
      typeof mission.description!=='string'||!mission.description.trim()||mission.description.length>MISSION_LIMITS.description||
      !Number.isSafeInteger(mission.rewardShards)||mission.rewardShards<1||mission.rewardShards>MISSION_LIMITS.reward||
      !['all','board'].includes(mission.distribution)||!Number.isSafeInteger(mission.at)||mission.at<0||
      !uniqueIds(mission.acceptedIds)||!uniqueIds(mission.completedIds)||!uniqueIds(mission.claimedIds)||
      mission.completedIds.some(id=>!mission.acceptedIds.includes(id))||
      mission.claimedIds.some(id=>!mission.completedIds.includes(id))||
      (mission.objective!==undefined&&(!autoObjectives.has(mission.objective)||!Number.isSafeInteger(mission.goal)||mission.goal<1||mission.goal>100||
        (mission.objective==='math-correct'&&(!Number.isSafeInteger(mission.grade)||mission.grade<1||mission.grade>6))||
        (mission.objective==='craft-level'&&(!Number.isSafeInteger(mission.itemLevel)||mission.itemLevel<2||mission.itemLevel>5))||
        (['baseball-win','sudoku-win'].includes(mission.objective)&&!difficulties.has(mission.difficulty))||
        (mission.objective==='signal-stage'&&(!Number.isSafeInteger(mission.stage)||mission.stage<1||mission.stage>6||mission.goal!==1))||
        (['tutorial-complete','life-star-complete'].includes(mission.objective)&&mission.goal!==1)||
        !mission.progress||typeof mission.progress!=='object'||Array.isArray(mission.progress)||
        Object.entries(mission.progress).some(([id,count])=>!mission.acceptedIds.includes(id)||!Number.isSafeInteger(count)||count<0||count>mission.goal))))throw new Error('Invalid missions');
    ids.add(mission.id);return structuredClone(mission);
  });
}

export function createMission(room,data,now=Date.now()){
  const title=String(data?.title||'').trim(),description=String(data?.description||'').trim();
  ensure(title.length>0&&title.length<=MISSION_LIMITS.title,'미션 이름을 40자 이내로 적어 주세요.');
  ensure(description.length>0&&description.length<=MISSION_LIMITS.description,'완료 조건을 240자 이내로 적어 주세요.');
  ensure(Number.isSafeInteger(data?.rewardShards)&&data.rewardShards>=1&&data.rewardShards<=MISSION_LIMITS.reward,'별 파편 보상은 1~10개로 정해 주세요.');
  ensure(['all','board'].includes(data?.distribution),'배포 방식을 선택해 주세요.');
  if(data?.objective!==undefined){
    ensure(autoObjectives.has(data.objective),'자동미션 조건을 골라 주세요.');
    ensure(Number.isSafeInteger(data.goal)&&data.goal>=1&&data.goal<=100,'목표 횟수는 1~100회로 정해 주세요.');
    if(data.objective==='math-correct')ensure(Number.isSafeInteger(data.grade)&&data.grade>=1&&data.grade<=6,'수학 발전소 학년을 골라 주세요.');
    if(data.objective==='craft-level')ensure(Number.isSafeInteger(data.itemLevel)&&data.itemLevel>=2&&data.itemLevel<=5,'조합할 아이템 레벨을 골라 주세요.');
    if(['baseball-win','sudoku-win'].includes(data.objective))ensure(difficulties.has(data.difficulty),'게임 난이도를 골라 주세요.');
    if(data.objective==='signal-stage')ensure(Number.isSafeInteger(data.stage)&&data.stage>=1&&data.stage<=6&&data.goal===1,'우주 신호 단계를 골라 주세요.');
    if(['tutorial-complete','life-star-complete'].includes(data.objective))ensure(data.goal===1,'이 조건은 한 번 완료하면 달성돼요.');
  }
  room.missions??=[];ensure(room.missions.length<MISSION_LIMITS.count,'미션은 교실당 30개까지 만들 수 있어요.');
  const mission={id:randomUUID(),title,description,rewardShards:data.rewardShards,distribution:data.distribution,at:now,
    acceptedIds:data.distribution==='all'?[...room.players.values()].filter(p=>p.role==='student').map(p=>p.id):[],completedIds:[],claimedIds:[],
    ...(data.objective?{objective:data.objective,goal:data.goal,progress:{},
      ...(data.objective==='math-correct'?{grade:data.grade}:{}),...(data.objective==='craft-level'?{itemLevel:data.itemLevel}:{}),
      ...(['baseball-win','sudoku-win'].includes(data.objective)?{difficulty:data.difficulty}:{}),
      ...(data.objective==='signal-stage'?{stage:data.stage}:{})}:{})};
  // 첫 여행 안내는 한 번만 끝낼 수 있으므로, 미션 제작 전에 완료한 친구도 즉시 달성 상태로 둡니다.
  if(mission.objective==='tutorial-complete')for(const id of mission.acceptedIds){
    if(room.players.get(id)?.tutorialCompleted){mission.progress[id]=1;mission.completedIds.push(id);}
  }
  room.missions.push(mission);return mission;
}

export function acceptMission(room,player,missionId){
  ensure(player.role==='student','학생만 미션을 받을 수 있어요.');
  const mission=room.missions?.find(m=>m.id===missionId);
  ensure(mission?.distribution==='board','게시판에서 받을 수 있는 미션이 아니에요.');
  ensure(!mission.acceptedIds.includes(player.id),'이미 받은 미션이에요.');
  mission.acceptedIds.push(player.id);
  if(mission.objective==='tutorial-complete'&&player.tutorialCompleted){mission.progress[player.id]=1;mission.completedIds.push(player.id);}
  return mission;
}

export function completeMission(room,studentId,missionId){
  const mission=room.missions?.find(m=>m.id===missionId);
  ensure(mission,'미션을 찾을 수 없어요.');
  ensure(!mission.objective,'자동미션은 게임 안에서 달성하면 자동으로 확인돼요.');
  ensure(mission.acceptedIds.includes(studentId),'그 친구가 받은 미션이 아니에요.');
  ensure(!mission.completedIds.includes(studentId),'이미 달성 확인을 마친 미션이에요.');
  mission.completedIds.push(studentId);return mission;
}

// 서버가 판정한 행동만 세어, 클라이언트가 임의의 달성 횟수를 보낼 수 없게 합니다.
export function advanceMissions(room,player,objective,detail){
  if(player.role!=='student')return false;
  let changed=false;
  for(const mission of room.missions||[]){
    if(mission.objective!==objective||!mission.acceptedIds.includes(player.id)||mission.completedIds.includes(player.id)||
      objective==='math-correct'&&mission.grade!==detail||objective==='craft-level'&&mission.itemLevel!==detail||
      ['baseball-win','sudoku-win'].includes(objective)&&mission.difficulty!==detail||
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

export function claimMission(room,player,missionId){
  const mission=room.missions?.find(m=>m.id===missionId);
  ensure(mission&&mission.acceptedIds.includes(player.id),'받은 미션이 아니에요.');
  ensure(mission.completedIds.includes(player.id),'아직 완료 조건이 확인되지 않았어요.');
  ensure(!mission.claimedIds.includes(player.id),'이미 보상을 받은 미션이에요.');
  mission.claimedIds.push(player.id);return mission;
}

export function missionViews(room,viewer){
  if(!viewer)return [];
  return (room.missions||[]).filter(m=>viewer.role==='teacher'||m.acceptedIds.includes(viewer.id)).map(m=>({
    id:m.id,title:m.title,description:m.description,rewardShards:m.rewardShards,distribution:m.distribution,at:m.at,
    ...(m.objective?{objective:m.objective,goal:m.goal,progress:m.progress[viewer.id]||0,
      ...(m.grade?{grade:m.grade}:{}),...(m.itemLevel?{itemLevel:m.itemLevel}:{}),
      ...(m.difficulty?{difficulty:m.difficulty}:{}),...(m.stage?{stage:m.stage}:{})}:{}),
    status:viewer.role==='teacher'?'teacher':m.claimedIds.includes(viewer.id)?'claimed':m.completedIds.includes(viewer.id)?'ready':'active',
    ...(viewer.role==='teacher'?{acceptedCount:m.acceptedIds.length,completedCount:m.completedIds.length,claimedCount:m.claimedIds.length}:{})
  }));
}

export function missionBoardViews(room,viewer){
  const missions=(room.missions||[]).filter(m=>viewer.role==='teacher'||m.distribution==='board'&&!m.acceptedIds.includes(viewer.id));
  return missions.map(m=>({id:m.id,title:m.title,description:m.description,rewardShards:m.rewardShards,distribution:m.distribution,
    ...(m.objective?{objective:m.objective,goal:m.goal,
      ...(m.grade?{grade:m.grade}:{}),...(m.itemLevel?{itemLevel:m.itemLevel}:{}),
      ...(m.difficulty?{difficulty:m.difficulty}:{}),...(m.stage?{stage:m.stage}:{})}:{}),
    ...(viewer.role==='teacher'?{students:m.acceptedIds.map(id=>{
      const student=room.players.get(id);
      return {id,nickname:student?.nickname||'떠난 친구',status:m.claimedIds.includes(id)?'claimed':m.completedIds.includes(id)?'ready':'active',
        ...(m.objective?{progress:m.progress[id]||0}:{})};
    })}:{})}));
}
