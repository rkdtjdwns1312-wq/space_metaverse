import test from 'node:test';
import assert from 'node:assert/strict';
import {actCozy,cozyView,validateCozyActivities} from '../server/cozy-activities.js';
import {starEnding,starScores,validateStarRaising} from '../server/star-raising.js';
import {STAR_ACTIVITIES,STAR_CAREERS,STAR_EVENTS} from '../shared/star-raising.js';
const now=Date.parse('2026-10-30T03:00:00Z');
const act=(p,action,data={},time=now)=>actCozy(p,{kind:'pet',action,...data},time);
function player(level=2){const p={role:'student',avatar:{level},cosmicEnergy:0};act(p,'adopt',{species:'moon',name:'반짝'});return p;}
function start(p,time=now){return act(p,'raising:start',{runId:cozyView(p,'pet',time).state.raising.runId},time).state.raising;}
function turn(p,activityId='science',choiceId='0',time=now){const r=cozyView(p,'pet',time).state.raising;return act(p,'raising:choose',{runId:r.runId,step:r.step,activityId,choiceId},time);}
test('12 educational choices have no tied axes, all 16 types and all 48 careers reachable',()=>{
 const types=new Set(),careers=new Set();
 for(const a of STAR_ACTIVITIES)for(let bits=0;bits<16;bits++){
  const turns=STAR_EVENTS.map(e=>({activityId:a.id,choiceId:String((bits>>e.axis)&1)})),e=starEnding(turns,now),s=starScores(turns);
  types.add(e.type);careers.add(e.careerId);assert.equal(e.track,a.id);assert.equal(Object.values(s.scores).reduce((a,b)=>a+b),12);
 }
 assert.equal(types.size,16);assert.equal(careers.size,48);assert.equal(new Set(STAR_CAREERS.map(c=>c.name)).size,48);
 for(const e of STAR_EVENTS){assert.equal(e.choices.length,2);assert(e.choices.every(c=>c.label&&c.feedback));}
 for(const c of STAR_CAREERS)assert(c.description&&c.learningTip);
});
test('completion alone awards remaining shared daily quota, preserves old identity and care, repeats stay playable',()=>{
 for(const level of [1,2,3,4,5]){
  const p=player(level),unit=[0,10,30,100,250,400][level];act(p,'care',{care:'feed'});start(p);
  for(let i=0;i<11;i++)assert.equal(turn(p).amount,0);
  const done=turn(p);assert.equal(done.amount,unit*2);assert.equal(p.cosmicEnergy,unit*3);assert.equal(done.state.raising.status,'complete');
  assert.equal(done.state.name,'반짝');assert.equal(done.state.species,'moon');assert.equal(done.state.careCount,4);
  start(p);for(let i=0;i<12;i++)assert.equal(turn(p).amount,0);assert.equal(p.cozyActivities.pet.careCount,7);assert.equal(act(p,'care',{care:'play'}).amount,0);
  start(p,now+86400000);for(let i=0;i<12;i++)turn(p,'art','1',now+86400000);assert.equal(p.cosmicEnergy,unit*6);
 }
});
test('generation and step reject duplicates, forged data and midrun resets without mutations',()=>{
 const p=player();const r=start(p),before=structuredClone(p);
 for(const data of [{runId:null},{runId:r.runId}]){assert.throws(()=>act(p,'raising:start',data));assert.deepEqual(p,before);}
 for(const data of [{runId:'old',step:0,activityId:'science',choiceId:'0'},{runId:r.runId,step:1,activityId:'science',choiceId:'0'},{runId:r.runId,step:0,activityId:'bad',choiceId:'0'},{runId:r.runId,step:0,activityId:'science',choiceId:0}]){assert.throws(()=>act(p,'raising:choose',data));assert.deepEqual(p,before);}
 const data={runId:r.runId,step:0,activityId:'science',choiceId:'0',type:'ENTJ',amount:999999};act(p,'raising:choose',data);assert.equal(p.cosmicEnergy,0);assert.throws(()=>act(p,'raising:choose',data));
 for(let i=1;i<12;i++)turn(p);const old=r.runId;start(p);assert.notEqual(p.cozyActivities.pet.raising.run.id,old);assert.throws(()=>act(p,'raising:choose',{...data,runId:old}));
});
test('overflow rolls back final choice and collection; teacher/master previews never pay',()=>{
 const p=player();start(p);for(let i=0;i<11;i++)turn(p);p.cosmicEnergy=Number.MAX_SAFE_INTEGER;let before=structuredClone(p);assert.throws(()=>turn(p));assert.deepEqual(p,before);
 p.cosmicEnergy=0;p.cozyActivities.pet.careCount=Number.MAX_SAFE_INTEGER-2;before=structuredClone(p);assert.throws(()=>turn(p));assert.deepEqual(p,before);
 for(const props of [{role:'teacher'},{accountKind:'master'}]){const q=Object.assign(player(),props);start(q);for(let i=0;i<12;i++)assert.equal(turn(q).amount,0);assert.equal(q.cosmicEnergy,0);assert.equal(q.cozyActivities.pet.raising.album.length,1);}
});
test('album bounds, recent bounds, legacy save migration and crossday JSON restore',()=>{
 let p=player();for(const a of STAR_ACTIVITIES)for(let bits=0;bits<8;bits++){start(p);for(const e of STAR_EVENTS)turn(p,a.id,e.axis===0?'0':String((bits>>(3-e.axis))&1));}
 assert.equal(p.cozyActivities.pet.raising.album.length,48);assert.equal(p.cozyActivities.pet.raising.recent.length,8);
 const saved=structuredClone(p.cozyActivities);assert.deepEqual(validateCozyActivities(JSON.parse(JSON.stringify(saved))),saved);
 start(p);for(let i=0;i<5;i++)turn(p);p=JSON.parse(JSON.stringify(p));p.cozyActivities=validateCozyActivities(p.cozyActivities);
 for(let i=5;i<12;i++)turn(p,'nature','1',now+86400000);assert.equal(p.cosmicEnergy,180);
 delete saved.pet.raising;assert.deepEqual(validateCozyActivities(saved).pet.raising,{run:null,album:[],recent:[]});
 const bad=structuredClone(p.cozyActivities.pet.raising);bad.album.push(bad.album[0]);assert.throws(()=>validateStarRaising(bad));
 for(const edit of [r=>r.run.turns.push({activityId:'science',choiceId:'0'}),r=>r.run.turns[0].choiceId='x',r=>r.run.id='old',r=>r.run.completedAt=-1]){const b=structuredClone(p.cozyActivities.pet.raising);edit(b);assert.throws(()=>validateStarRaising(b));}
});
