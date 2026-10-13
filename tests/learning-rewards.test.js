import test from 'node:test';
import assert from 'node:assert/strict';
import {awardLearningReward,validateLearningRewards} from '../server/learning-rewards.js';
import {createMission} from '../server/missions.js';
import {toRecord,fromRecord} from '../server/persistent-rooms.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function play(f,subject,correct=10,grade=1,{beforeLast=null,rounds=10,socket=f.student,player=f.p}={}){
 f.at(subject,player);ok(await call(socket,`learning:${subject}:start`,subject==='math'?{grade}:{level:`grade-${grade}`}));let result;
 for(let index=0;index<rounds;index++){
  const run=player[subject+'Run'],answer=index<correct?run.question.answer:run.question.choices.find(a=>a!==run.question.answer);
  if(index===9&&beforeLast)await beforeLast();
  result=ok(await call(socket,`learning:${subject}:answer`,{questionId:run.questionId,answer,reward:999,amount:999}));
  if(index<9)assert.equal(result.learningReward,undefined);
  if(index<rounds-1||rounds<10)ok(await call(socket,`learning:${subject}:next`));
  await wait(30);
 }return result;
}

test('learning daily stamps validate legacy/date data and both subjects use the exact shared five-level reward table',()=>{
 assert.deepEqual(validateLearningRewards(undefined),{math:null,english:null});
 for(const raw of [null,[],{}, {math:'2026-02-30',english:null},{math:null,english:1}])assert.throws(()=>validateLearningRewards(raw));
 for(const subject of ['math','english'])for(let level=1;level<=5;level++){
  const p={role:'student',avatar:{level},cosmicEnergy:0};const result=awardLearningReward(p,subject,{done:true,correct:9},Date.parse('2026-10-13T14:59:59Z'));
  assert.equal(result.amount,[0,1,2,5,30,100][level]);assert.equal(p.cosmicEnergy,result.amount);
  assert.equal(awardLearningReward(p,subject,{done:true,correct:10},Date.parse('2026-10-13T14:59:59Z')).awarded,false);
 }
});

test('under-nine attempts remain eligible; daily rewards are per subject, not grade, and reset at KST midnight',async t=>{
 const f=await readingFixture(t);f.mutate(p=>{p.avatar.level=3;});
 const failed=await play(f,'math',8);assert.equal(failed.learningReward.awarded,false);assert.equal(f.p.learningRewards,undefined);
 const passed=await play(f,'math',9,6,{beforeLast:()=>f.mutate(p=>{p.avatar.level=4;})});assert.equal(passed.learningReward.amount,30);assert.equal(passed.correct,9);
 const repeated=await play(f,'math',10,2);assert.equal(repeated.learningReward.awarded,false);assert.equal(f.p.cosmicEnergy,30);
 const english=await play(f,'english',9,5);assert.equal(english.learningReward.amount,30);assert.equal(f.p.cosmicEnergy,60);
 f.advance(999);assert.equal((await play(f,'english',10,1)).learningReward.awarded,false);
 f.advance(1);assert.equal((await play(f,'english',9,6)).learningReward.amount,30);assert.equal(f.p.learningRewards.english,'2026-10-14');assert.equal(f.p.learningRewards.math,'2026-10-13');
});

test('math correct-count and English seven-correct missions keep their original thresholds; teachers receive no energy',async t=>{
 const f=await readingFixture(t);let math,english;
 f.mutate((p,room)=>{math=createMission(room,{title:'수학',description:'정답',rewardShards:1,distribution:'all',objective:'math-correct',grade:1,goal:10});english=createMission(room,{title:'영어',description:'성공',rewardShards:1,distribution:'all',objective:'english-success',goal:1});});
 const result=await play(f,'english',7);assert.equal(result.success,true);assert.equal(result.learningReward.awarded,false);assert.equal(f.room.missions.find(m=>m.id===english.id).progress[f.p.id],1);
 await play(f,'math',8);assert.equal(f.room.missions.find(m=>m.id===math.id).progress[f.p.id],8);assert.equal(f.p.cosmicEnergy,0);
 for(const subject of ['math','english']){
  const teacher=await play(f,subject,10,1,{socket:f.teacher,player:f.teacherPlayer});assert.equal(teacher.learningReward.awarded,false);assert.equal(teacher.learningReward.amount,0);assert.match(teacher.learningReward.message,/선생님/);
 }assert.equal(f.teacherPlayer.learningRewards,undefined);
});

for(const subject of ['math','english'])test(`${subject} final answer write failure restores question and mission; concurrent retry pays once and restart preserves stamp`,async t=>{
 const f=await readingFixture(t);let missionId;
 f.mutate((p,room)=>{p.avatar.level=5;missionId=createMission(room,{title:'마지막 답',description:'자동 검사',rewardShards:1,distribution:'all',objective:subject==='math'?'math-correct':'english-success',grade:1,goal:subject==='math'?10:1}).id;});
 await play(f,subject,10,1,{rounds:9});
 const run=structuredClone(f.p[subject+'Run']),mission=structuredClone(f.room.missions.find(m=>m.id===missionId)),record=structuredClone(f.game.store.records.get(f.room.code));
 const data={questionId:run.questionId,answer:run.question.answer};
 await f.fail(async()=>assert.equal((await call(f.student,`learning:${subject}:answer`,data)).ok,false));
 assert.deepEqual(f.p[subject+'Run'],run);assert.deepEqual(f.room.missions.find(m=>m.id===missionId),mission);assert.deepEqual(f.game.store.records.get(f.room.code),record);assert.equal(f.p.cosmicEnergy,0);
 assert.equal((await call(f.student,`learning:${subject}:next`)).ok,false);
 await f.reconnect();f.at(subject);
 const race=await Promise.all(Array.from({length:6},()=>call(f.student,`learning:${subject}:answer`,data)));
 assert.equal(race.filter(r=>r.ok).length,1);assert.equal(race.find(r=>r.ok).learningReward.amount,100);assert.equal(f.p.cosmicEnergy,100);
 assert.equal(f.room.missions.find(m=>m.id===missionId).completedIds.includes(f.p.id),true);
 await f.restart();f.at(subject);assert.equal(f.p.cosmicEnergy,100);assert.equal(f.p.learningRewards[subject],'2026-10-13');
 assert.equal((await call(f.student,`learning:${subject}:answer`,data)).ok,false);assert.equal((await play(f,subject,10,6)).learningReward.awarded,false);
 const saved=toRecord(f.room),p=saved.students.find(p=>p.id===f.p.id);delete p.learningRewards;assert.deepEqual(fromRecord(saved).players.get(f.p.id).learningRewards,{math:null,english:null});
 for(const viewer of [f.q,f.teacherPlayer])assert.equal(f.game.store.snapshot(f.room,viewer,f.now).players.find(p=>p.id===f.p.id).learningRewards,undefined);
});

test('learning access checks deny guest, other station, away and stale sockets without consuming a question',async t=>{
 const f=await readingFixture(t),guest=await f.connect();
 for(const subject of ['math','english']){
  assert.equal((await call(guest,`learning:${subject}:start`,{grade:1,level:'grade-1'})).ok,false);
  f.at(subject);ok(await call(f.student,`learning:${subject}:start`,{grade:1,level:'grade-1'}));const run=structuredClone(f.p[subject+'Run']);
  const data={questionId:run.questionId,answer:run.question.answer};
  f.at('culture');assert.equal((await call(f.student,`learning:${subject}:answer`,data)).ok,false);f.at(subject);
  f.p.away=true;assert.equal((await call(f.student,`learning:${subject}:answer`,data)).ok,false);f.p.away=false;
  const socketId=f.p.socketId;f.p.socketId='stale';assert.equal((await call(f.student,`learning:${subject}:answer`,data)).ok,false);f.p.socketId=socketId;
  assert.deepEqual(f.p[subject+'Run'],run);
 }
});
