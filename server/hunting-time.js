import {sleepingStarsEligible,SLEEPING_STARS_ENTRY_MESSAGE} from '../shared/sleeping-stars.js';
import {HUNTING_STATIONS,HUNTING_STATION_LIMIT,HUNTING_STATION_MS,HUNTING_PLAYGROUNDS,HUNTING_PLAYGROUND_LIMIT,HUNTING_PLAYGROUND_MS,isHuntingMap,huntingCycle,huntingResetAt} from '../shared/hunting-time.js';
import {GameError} from './pin-auth.js';
export {isHuntingMap};
export const huntingExempt=p=>p?.role==='teacher'||p?.accountKind==='master';
// Older cycles could have all five original stamps and up to 100 minutes.
export function validateHuntingTime(raw){
 if(raw===undefined)return {cycle:null,remainingMs:0,chargedStations:[],chargedPlaygrounds:[]};
 const games=raw?.chargedPlaygrounds??[];
 if(!Array.isArray(games)||games.length>HUNTING_PLAYGROUND_LIMIT||new Set(games).size!==games.length||games.some(id=>!HUNTING_PLAYGROUNDS.includes(id)))throw Error('Invalid hunting playground record');
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!(raw.cycle===null||Number.isSafeInteger(raw.cycle)&&raw.cycle>=-1&&raw.cycle<=100000000)||
 !Number.isSafeInteger(raw.remainingMs)||raw.remainingMs<0||!Array.isArray(raw.chargedStations)||raw.chargedStations.length>5||
 raw.chargedStations.length>4&&raw.chargedStations.includes('art')||
 new Set(raw.chargedStations).size!==raw.chargedStations.length||raw.chargedStations.some(s=>!HUNTING_STATIONS.includes(s))||raw.remainingMs>raw.chargedStations.length*HUNTING_STATION_MS+games.length*HUNTING_PLAYGROUND_MS||raw.cycle===null&&(raw.remainingMs!==0||raw.chargedStations.length||games.length))throw Error('Invalid hunting time record');
 return {cycle:raw.cycle,remainingMs:raw.remainingMs,chargedStations:[...raw.chargedStations],chargedPlaygrounds:[...games]};
}
const active=p=>!huntingExempt(p)&&p?.role==='student'&&p.connected&&!p.away&&isHuntingMap(p.mapId);
function current(p,now){
 const state=validateHuntingTime(p.huntingTime);if(state.cycle===huntingCycle(now))return state;
 const next={cycle:huntingCycle(now),remainingMs:0,chargedStations:[],chargedPlaygrounds:[]};
 // Legacy records credit only proven completed work today, before the 22:00 reset.
 const korea=new Date(now+9*3600000),today=korea.toISOString().slice(0,10);
 if(state.cycle===null&&!huntingExempt(p)&&korea.getUTCHours()<22){
  for(const subject of ['math','english'])if(p.learningRewards?.[subject]===today)next.chargedStations.push(subject);
  for(const subject of ['culture','history','science'])if(p[subject+'Reading']?.day===today&&p[subject+'Reading']?.claimedIds?.length)next.chargedStations.push(subject);
  next.chargedStations=next.chargedStations.slice(0,HUNTING_STATION_LIMIT);
  next.remainingMs=next.chargedStations.length*HUNTING_STATION_MS;
 }
 return next;
}
export function huntingTimeView(p,now=Date.now()){
 const state=current(p,now),marker=p.huntingTimer;
 if(marker?.running&&marker.cycle===state.cycle)state.remainingMs=Math.max(0,state.remainingMs-Math.max(0,Math.floor(now-marker.at)));
 return {remainingMs:state.remainingMs,running:active(p)&&state.remainingMs>0,serverNow:now,resetAt:huntingResetAt(now),chargedStations:state.chargedStations,chargedPlaygrounds:state.chargedPlaygrounds,exempt:huntingExempt(p)};
}
// Runtime markers are deliberately excluded from disk: offline time never consumes budget.
export function settleHuntingTime(p,now=Date.now()){
 if(p.huntingTime?.cycle===huntingCycle(now)&&!p.huntingTimer?.running&&!active(p)&&Array.isArray(p.huntingTime.chargedPlaygrounds))return false;
 const view=huntingTimeView(p,now),before=p.huntingTime;
 p.huntingTime={cycle:huntingCycle(now),remainingMs:view.remainingMs,chargedStations:view.chargedStations,chargedPlaygrounds:view.chargedPlaygrounds};
 p.huntingTimer={cycle:p.huntingTime.cycle,at:now,running:view.running};
 return !before||before.cycle!==p.huntingTime.cycle||before.remainingMs!==view.remainingMs;
}
export function chargeHuntingStation(p,station,now=Date.now()){
 if(huntingExempt(p))return 0;
 if(p?.role!=='student'||!HUNTING_STATIONS.includes(station))throw new GameError('발전소 학습 기록을 확인해주세요.');
 settleHuntingTime(p,now);if(p.huntingTime.chargedStations.length>=HUNTING_STATION_LIMIT||p.huntingTime.chargedStations.includes(station))return 0;
 p.huntingTime.chargedStations.push(station);p.huntingTime.remainingMs+=HUNTING_STATION_MS;
 settleHuntingTime(p,now);return HUNTING_STATION_MS;
}
export function chargeHuntingPlayground(p,game,now=Date.now()){
 if(huntingExempt(p))return 0;
 if(p?.role!=='student'||!HUNTING_PLAYGROUNDS.includes(game))throw new GameError('놀이터 이용 기록을 확인해주세요.');
 settleHuntingTime(p,now);
 if(p.huntingTime.chargedPlaygrounds.length>=HUNTING_PLAYGROUND_LIMIT||p.huntingTime.chargedPlaygrounds.includes(game))return 0;
 p.huntingTime.chargedPlaygrounds.push(game);p.huntingTime.remainingMs+=HUNTING_PLAYGROUND_MS;
 settleHuntingTime(p,now);return HUNTING_PLAYGROUND_MS;
}
export function completedHuntingPlayground(event,result){
 if(event==='one-stroke:complete')return 'path';
 if(event==='sudoku:complete')return 'sudoku';
 if(event==='tetris:finish')return 'tetris';
 if(event==='memory:flip'&&result?.won)return 'memory';
 if(event==='baseball:submit'&&result?.won)return 'baseball';
 if(event==='signal:choose'&&result?.stageCleared)return 'signal';
 return null;
}
export function requireHuntingEntry(p,mapId,now=Date.now()){
 if(!sleepingStarsEligible(p,mapId))throw new GameError(SLEEPING_STARS_ENTRY_MESSAGE);
 if(isHuntingMap(mapId)&&!huntingExempt(p)&&huntingTimeView(p,now).remainingMs<=0)throw new GameError('사냥 시간이 없어요. 발전소 최대 3곳에서 각 20분, 놀이터 최대 2곳에서 각 10분을 충전할 수 있어요.');
}
