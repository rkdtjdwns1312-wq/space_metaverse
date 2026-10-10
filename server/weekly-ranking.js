import {ensure} from './rooms.js';

// 한국은 UTC+9 고정입니다. 월요일 00:00을 기준으로 해당 주의 기록만 남깁니다.
export function weekStartKst(now=Date.now()){
  const local=new Date(now+9*60*60*1000),days=(local.getUTCDay()+6)%7;
  return Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()-days)-9*60*60*1000;
}
export function currentWeekRecords(records=[],now=Date.now()){
  const start=weekStartKst(now),end=start+7*24*60*60*1000;
  return records.filter(record=>record.at>=start&&record.at<end);
}

export function resetWeeklyRanking(room,player,game,now=Date.now()){
  ensure(player?.role==='teacher'&&room.players.get(player.id)===player,'선생님만 랭킹을 초기화할 수 있어요.');
  const key={memory:'memoryRanking',stars:'starRanking',tetris:'tetrisRanking',dodge:'dodgeRanking',signal:'signalRanking'}[game];
  ensure(key,'이 게임에는 랭킹이 없어요.');
  const start=weekStartKst(now),end=start+7*24*60*60*1000;
  room[key]=(room[key]||[]).filter(record=>record.at<start||record.at>=end);
}
