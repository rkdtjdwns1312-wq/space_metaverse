import {createHash} from 'node:crypto';
import {PLAZA_ID,STREET_ID,interiorIdOf} from '../shared/config.js';

// 내용 자체를 신호로 보내지 않습니다. 받은 학생이 내용을 볼 권한이 있는지와
// 무관하게 해시만 비교하여 새 알림 표시를 정합니다.
const stamp=value=>createHash('sha256').update(JSON.stringify(value??null)).digest('hex').slice(0,20);
export function objectSignals(room,viewer){
  const signals={},put=(mapId,id,value)=>{signals[mapId+':'+id]=stamp(value);};
  const temple=room.temple||{};
  put(PLAZA_ID,'pillar-notice',temple.notices||[]);
  put(PLAZA_ID,'pillar-timetable',temple.schedule||[]);
  put(PLAZA_ID,'pillar-weekly',temple.weeks||[]);
  put(PLAZA_ID,'pillar-effects',[...room.players.values()].map(p=>[p.id,(p.cardMarkers||[]).map(m=>[m.id,m.itemId,m.until,m.remainingUses]),(p.effects||[]).map(e=>[e.itemId,e.until])]));
  put(PLAZA_ID,'exploration-flask',room.exploration||{});
  for(const pl of room.planets.values()){
    const memberCount=[...room.players.values()].filter(p=>p.avatar.departmentId===pl.id).length;
    const publicState=[pl.name,pl.description,pl.rules,pl.work?.report?.status,pl.work?.history?.length,pl.warnings,memberCount];
    put(PLAZA_ID,pl.id,publicState);
    if(viewer?.role!=='teacher'&&viewer?.avatar?.departmentId!==pl.id)continue;
    const inside=interiorIdOf(pl.id);
    put(inside,'board',pl.rules||[]);
    put(inside,'mailbox',(pl.joinRequests||[]).map(r=>[r.playerId,r.at]));
    put(inside,'report-board',pl.work||{});
    put(inside,'warning-rock',pl.warnings||[]);
    put(inside,'department-control-machine',pl.interiorDecor||{});
  }
  put(STREET_ID,'arcade-tetris',room.tetrisRanking||[]);
  put(STREET_ID,'arcade-dodge',room.dodgeRanking||[]);
  put(STREET_ID,'arcade-memory',room.memoryRanking||[]);
  return signals;
}
