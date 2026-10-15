import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {CULTURE_STORIES} from '../shared/culture-stories.js';
import {HISTORY_LESSONS} from '../shared/history-lessons.js';
import {STREET} from '../shared/config.js';
const mission=async(f,objective,extra={})=>ok(await call(f.teacher,'mission:auto:create',{title:'배움 도전',description:'활동 완료',rewardShards:1,distribution:'all',objective,goal:2,...extra}));
function solve(run){const degree=run.points.map((_,i)=>run.edges.filter(e=>e.includes(i)).length),used=new Set(),out=[];function visit(a){for(let n=0;n<run.edges.length;n++){const [x,y]=run.edges[n];if(!used.has(n)&&(x===a||y===a)){used.add(n);visit(x===a?y:x);}}out.push(a);}visit(Math.max(0,degree.findIndex(n=>n%2)));return out.reverse();}
test('reading missions count awarded completions, not opens/duplicate claims, and persist to claim once',async t=>{
 const f=await readingFixture(t);
 for(const [kind,list] of [['culture',CULTURE_STORIES],['history',HISTORY_LESSONS],['science',null]]){
  const m=await mission(f,kind+'-read');f.at(kind);const saved=()=>f.room.missions.find(x=>x.id===m.missionId);
  for(let i=0;i<2;i++){
   const opened=ok(await call(f.student,kind+':open',list?{storyId:list[i].id}:{})),data=list?{storyId:list[i].id}:{factId:opened.factId};
   assert.equal(saved().progress[f.p.id]||0,i);ok(await call(f.student,kind+':claim',data));assert.equal(saved().progress[f.p.id],i+1);
   ok(await call(f.student,kind+':claim',data));assert.equal(saved().progress[f.p.id],i+1);
  }
  assert(saved().completedIds.includes(f.p.id));await f.restart();ok(await call(f.student,'mission:claim',{missionId:m.missionId}));assert.equal((await call(f.student,'mission:claim',{missionId:m.missionId})).ok,false);
 }
});
test('one-stroke mission validates issued graph and difficulty, prevents replay, and rolls back failed saves',async t=>{
 const f=await readingFixture(t),m=await mission(f,'one-stroke-win',{difficulty:'high',goal:1});
 assert.equal((await call(f.student,'one-stroke:start',{difficulty:'high'})).ok,false);
 const machine=STREET.objects.find(o=>o.gameId==='path');Object.assign(f.p,{mapId:STREET.id,x:machine.x,y:machine.y+50});
 assert.equal((await call(f.student,'one-stroke:start',{difficulty:'invalid'})).ok,false);
 const low=ok(await call(f.student,'one-stroke:start',{difficulty:'low'}));ok(await call(f.student,'one-stroke:complete',{runId:low.runId,path:solve(low),difficulty:'high'}));
 const progress=()=>f.room.missions.find(x=>x.id===m.missionId).progress[f.p.id]||0;assert.equal(progress(),0);
 const run=ok(await call(f.student,'one-stroke:start',{difficulty:'high'})),path=solve(run);
 assert.equal((await call(f.student,'one-stroke:complete',{runId:'fake',path})).ok,false);
 assert.equal((await call(f.student,'one-stroke:complete',{runId:run.runId,path:Array(run.edges.length+1).fill(0)})).ok,false);
 await f.fail(async()=>assert.equal((await call(f.student,'one-stroke:complete',{runId:run.runId,path})).ok,false));assert.equal(progress(),0);assert.equal(f.p.oneStrokeRun.id,run.runId);
 ok(await call(f.student,'one-stroke:complete',{runId:run.runId,path}));assert.equal(progress(),1);
 assert.equal((await call(f.student,'one-stroke:complete',{runId:run.runId,path})).ok,false);assert.equal(progress(),1);
 await f.restart();ok(await call(f.student,'mission:claim',{missionId:m.missionId}));
});
