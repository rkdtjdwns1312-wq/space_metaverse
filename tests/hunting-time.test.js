import test from 'node:test';
import assert from 'node:assert/strict';
import {HUNTING_STATIONS,HUNTING_STATION_MS,HUNTING_MAX_MS,isHuntingMap,huntingCycle,huntingResetAt} from '../shared/hunting-time.js';
import {validateHuntingTime,huntingTimeView,settleHuntingTime,chargeHuntingStation,requireHuntingEntry} from '../server/hunting-time.js';
import {awardLearningReward} from '../server/learning-rewards.js';
const now=Date.parse('2026-10-29T03:00:00Z');
const player=()=>({role:'student',avatar:{level:2},cosmicEnergy:0,mapId:'star-street',connected:true,away:false});
test('hunting maps classified explicitly and legacy zero budget rejects all hunt entry but permits safe maps',()=>{
 const p=player();assert.deepEqual(validateHuntingTime(),{cycle:null,remainingMs:0,chargedStations:[]});
 for(const id of ['star-origin-1','star-origin-4','sleeping-stars-1','sleeping-stars-4','moon-garden','sun-paradise','sun-paradise-3','moon-paradise-2','star-paradise']){assert(isHuntingMap(id));assert.throws(()=>requireHuntingEntry(p,id,now));}
 for(const id of ['space-plaza','star-street','milky-valley','planet:one','black-hole','whale-stomach','star-origin-99']){assert(!isHuntingMap(id));assert.doesNotThrow(()=>requireHuntingEntry(p,id,now));}
 for(const raw of [null,{}, {cycle:1,remainingMs:-1,chargedStations:[]},{cycle:1,remainingMs:1,chargedStations:[]},{cycle:1,remainingMs:0,chargedStations:['math','math']},{cycle:1,remainingMs:0,chargedStations:['fake']}])assert.throws(()=>validateHuntingTime(raw));
});
test('five stations independently charge 15 minutes once per22KSTcycle; midnight does not reset; closing does',()=>{
 const p=player();for(const station of HUNTING_STATIONS){assert.equal(chargeHuntingStation(p,station,now),HUNTING_STATION_MS);assert.equal(chargeHuntingStation(p,station,now),0);}assert.equal(p.huntingTime.remainingMs,HUNTING_MAX_MS);
 const boundary=Date.parse('2026-10-29T13:00:00Z');assert.equal(huntingResetAt(now),boundary);assert.equal(huntingTimeView(p,boundary-1).remainingMs,HUNTING_MAX_MS);assert.equal(huntingTimeView(p,boundary).remainingMs,0);
 settleHuntingTime(p,boundary);assert.deepEqual(p.huntingTime.chargedStations,[]);chargeHuntingStation(p,'math',boundary+1);assert.equal(chargeHuntingStation(p,'math',Date.parse('2026-10-29T15:00:00Z')),0);
});
test('countdown tracks connected active hunt time only; pause,resume,offline,restart and safe maps preserve balance',()=>{
 const p=player();chargeHuntingStation(p,'math',now);settleHuntingTime(p,now+10000);assert.equal(p.huntingTime.remainingMs,HUNTING_STATION_MS);
 p.mapId='moon-garden';settleHuntingTime(p,now+10000);assert.equal(huntingTimeView(p,now+15000).remainingMs,HUNTING_STATION_MS-5000);
 settleHuntingTime(p,now+15000);p.mapId='star-street';settleHuntingTime(p,now+15000);settleHuntingTime(p,now+25000);assert.equal(p.huntingTime.remainingMs,HUNTING_STATION_MS-5000);
 p.mapId='sleeping-stars-2';settleHuntingTime(p,now+25000);settleHuntingTime(p,now+27000);p.connected=false;settleHuntingTime(p,now+27000);settleHuntingTime(p,now+57000);assert.equal(p.huntingTime.remainingMs,HUNTING_STATION_MS-7000);
 p.connected=true;p.away=true;settleHuntingTime(p,now+57000);settleHuntingTime(p,now+67000);assert.equal(p.huntingTime.remainingMs,HUNTING_STATION_MS-7000);
 const restored={...player(),huntingTime:validateHuntingTime(p.huntingTime)};settleHuntingTime(restored,now+367000);assert.equal(restored.huntingTime.remainingMs,HUNTING_STATION_MS-7000);
});
test('math and english require9of10 completion and no clientamount; independent stamps also credit prior energy winners',()=>{
 const p=player();awardLearningReward(p,'math',{done:false,correct:10},now);awardLearningReward(p,'math',{done:true,correct:8},now);assert.equal(huntingTimeView(p,now).remainingMs,0);
 awardLearningReward(p,'math',{done:true,correct:9,amount:99999},now);assert.equal(p.huntingTime.remainingMs,HUNTING_STATION_MS);
 p.learningRewards.english='2026-10-29';assert.equal(awardLearningReward(p,'english',{done:true,correct:10},now).awarded,false);assert.equal(p.huntingTime.remainingMs,2*HUNTING_STATION_MS);
});
test('migration credits proven completedtoday only once, never after22 or after an initialized reset',()=>{
 const p=player();p.learningRewards={math:'2026-10-29',english:'2026-10-28'};p.scienceReading={day:'2026-10-29',claimedIds:['seen']};p.cultureReading={day:'2026-10-29',claimedIds:[]};
 settleHuntingTime(p,now);assert.deepEqual(p.huntingTime.chargedStations,['math','science']);assert.equal(p.huntingTime.remainingMs,2*HUNTING_STATION_MS);
 const after=Date.parse('2026-10-29T13:00:00Z');settleHuntingTime(p,after);assert.equal(p.huntingTime.remainingMs,0);assert.deepEqual(p.huntingTime.chargedStations,[]);
 const q={...p,huntingTime:undefined};settleHuntingTime(q,after);assert.equal(q.huntingTime.remainingMs,0);
});
test('teacher/master exempt from gates,countdown and learningtime charging',()=>{
 for(const p of [{...player(),role:'teacher'},{...player(),accountKind:'master'}]){assert.doesNotThrow(()=>requireHuntingEntry(p,'moon-garden',now));assert.equal(chargeHuntingStation(p,'math',now),0);p.mapId='moon-garden';settleHuntingTime(p,now);settleHuntingTime(p,now+5000);assert.equal(huntingTimeView(p,now+5000).exempt,true);assert.equal(huntingTimeView(p,now+5000).running,false);}
});

test('old 20-minute balances load intact; new awards add15 once and next cycle caps at75',()=>{
 assert.equal(HUNTING_STATION_MS,15*60000);assert.equal(HUNTING_MAX_MS,75*60000);
 for(let count=1;count<=5;count++){
  const old={cycle:huntingCycle(now),remainingMs:count*20*60000,chargedStations:HUNTING_STATIONS.slice(0,count)};
  const p={...player(),huntingTime:validateHuntingTime(JSON.parse(JSON.stringify(old)))};
  assert.deepEqual(huntingTimeView(p,now).chargedStations,old.chargedStations);assert.equal(huntingTimeView(p,now).remainingMs,old.remainingMs);
  for(const station of old.chargedStations)assert.equal(chargeHuntingStation(p,station,now),0);
  for(const station of HUNTING_STATIONS.slice(count))assert.equal(chargeHuntingStation(p,station,now),15*60000);
  assert.equal(p.huntingTime.remainingMs,(count*20+(5-count)*15)*60000);assert.deepEqual(validateHuntingTime(p.huntingTime),p.huntingTime);
  const next=huntingResetAt(now);assert.equal(huntingTimeView(p,next).remainingMs,0);
  for(const station of HUNTING_STATIONS)assert.equal(chargeHuntingStation(p,station,next+1),15*60000);
  assert.equal(p.huntingTime.remainingMs,75*60000);assert.equal(chargeHuntingStation(p,'math',next+2),0);
 }
 for(const [remainingMs,chargedStations]of [[100*60000+1,[...HUNTING_STATIONS]],[20*60000+1,['math']]])assert.throws(()=>validateHuntingTime({cycle:huntingCycle(now),remainingMs,chargedStations}));
});
