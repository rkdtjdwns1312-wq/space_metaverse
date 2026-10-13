import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {toRecord,fromRecord} from '../server/persistent-rooms.js';
import {freshJourney,validateJourney,journeyTickGoals,journeyGoal,practiceEffectRows} from '../server/tutorial-journey.js';
import {JOURNEY_STEPS,JOURNEY_ITEM_IDS,JOURNEY_EQUIP_MESSAGE} from '../shared/tutorial-journey.js';
import {MAP,VALLEY,STREET,SHOP,SHARDS,itemOf} from '../shared/config.js';

const call=(s,e,d={})=>s.timeout(4000).emitWithAck(e,d),ok=r=>{assert.equal(r.ok,true,r.error);return r;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){const deadline=Date.now()+3000;while(!fn()&&Date.now()<deadline)await wait(30);assert(fn(),'timed out waiting for server goal');}
async function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'journey-v2-')),key='journey-private-test',sockets=[];
 let game,teacher,student,other,url,code,id,qid,now=Date.now(),closed=true;
 const start=async()=>{game=createClassroomServer({teacherKey:key,dataDir:dir,teacherManagedAccounts:false,studentHours:false,clock:()=>now});url=`http://127.0.0.1:${(await game.listen()).port}`;closed=false;};
 const connect=async()=>{const s=io(url,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;};
 t.after(async()=>{sockets.forEach(s=>s.disconnect());if(!closed)await game.close();assert(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(dir).startsWith('journey-v2-'));fs.rmSync(dir,{recursive:true,force:true});});
 await start();teacher=await connect();code=ok(await call(teacher,'room:create',{teacherKey:key,title:'행동 여행',allowedNames:['하나','둘']})).room.code;
 student=await connect();id=ok(await call(student,'room:join',{code,nickname:'하나',pin:'1234'})).selfId;other=await connect();qid=ok(await call(other,'room:join',{code,nickname:'둘',pin:'1234'})).selfId;
 const f={get game(){return game;},get room(){return game.store.rooms.get(code);},get p(){return f.room.players.get(id);},get q(){return f.room.players.get(qid);},get student(){return student;},get other(){return other;},get teacher(){return teacher;},get now(){return now;},advance(ms=5000){now+=ms;},
  view(){return game.store.snapshot(f.room,f.p);},self(){return f.view().players.find(p=>p.id===id);},
  mutate(fn){game.store.transact(()=>fn(f.p,f.room));},stage(n,goals=[]){f.mutate(p=>{p.journey={version:2,stage:n,goals,claimedAt:Array(n-1).fill(now),practiceUntil:0};});},
  async observe(goalId){return ok(await call(student,'tutorial:observe',{goalId,playerId:qid}));},
  async claim(stage){return ok(await call(student,'mission:claim',{missionId:'first-journey-'+stage,claimedAt:1}));},
  async placeGoal(stage,goalId){const goal=JOURNEY_STEPS[stage-1].goals.find(g=>g.id===goalId);Object.assign(f.p,{mapId:goal.mapId,x:goal.x,y:goal.y+(goal.ry||0)*.45,input:{x:0,y:0,at:0}});await until(()=>f.p.journey?.goals.includes(goalId));},
  async pillar(id){const object=MAP.objects.find(o=>o.id===id);Object.assign(f.p,{mapId:MAP.id,x:object.x,y:object.y+object.radius+30,input:{x:0,y:0,at:0}});return ok(await call(student,'temple:read',{objectId:id}));},
  async info(id){const object=VALLEY.objects.find(o=>o.id===id);Object.assign(f.p,{mapId:VALLEY.id,x:object.x,y:object.y+object.radius+30,input:{x:0,y:0,at:0}});return ok(await call(student,id==='growth-star'?'growth:info':'evolution:info'));},
  async fail(work){const save=game.store.files.save.bind(game.store.files);game.store.files.save=()=>{throw Error('journey disk failure');};try{await work();}finally{game.store.files.save=save;}},
  async restart(){sockets.forEach(s=>s.disconnect());await game.close();closed=true;await start();teacher=await connect();ok(await call(teacher,'room:open',{teacherKey:key,code}));student=await connect();ok(await call(student,'room:join',{code,nickname:'하나',pin:'1234'}));other=await connect();ok(await call(other,'room:join',{code,nickname:'둘',pin:'1234'}));}
 };return f;
}

test('actual movement, four distinct nearby pillars, ordered visits and UI observations unlock five rewards',async t=>{
 const f=await fixture(t);f.mutate(p=>Object.assign(p,{tutorialCompleted:true,tutorialRewardClaimed:true,starShards:1}));
 const made=ok(await call(f.teacher,'mission:auto:create',{title:'여행 완료',description:'새 여행 완료',rewardShards:2,distribution:'all',objective:'tutorial-complete',goal:1}));
 assert.equal(f.room.missions[0].completedIds.length,0,'old completed flag cannot complete a newly created auto mission');
 assert.deepEqual(f.view().missions.filter(m=>m.kind==='tutorial').map(m=>m.id),['first-journey-1']);
 assert.deepEqual(f.self().journey,freshJourney());
 for(const goalId of ['moved','pillar-notice','station','practice-used','chat-open'])assert.equal((await call(f.student,'tutorial:observe',{goalId})).ok,false);
 assert.equal((await call(f.student,'tutorial:complete')).ok,false);assert.equal((await call(f.student,'mission:claim',{missionId:'first-journey'})).ok,false);
 const initial={x:f.p.x,y:f.p.y};f.student.emit('player:input',{x:1,y:0});await until(()=>f.p.journey?.goals.includes('moved'));f.student.emit('player:input',{x:0,y:0});assert(Math.hypot(f.p.x-initial.x,f.p.y-initial.y)>0);
 assert.equal((await call(f.student,'temple:read',{objectId:'pillar-effects'})).ok,false);
 await f.pillar('pillar-notice');await f.pillar('pillar-notice');assert.equal(f.p.journey.goals.length,2);
 for(const id of ['pillar-effects','pillar-timetable','pillar-weekly'])await f.pillar(id);
 await f.claim(1);assert.equal(f.p.starShards,2);assert.equal(f.p.journey.stage,2);assert.deepEqual(f.p.journey.goals,[]);
 assert.equal((await call(f.student,'tutorial:observe',{goalId:'department-menu'})).ok,false);
 for(const id of ['black-hole','department','market','assignment'])await f.placeGoal(2,id);
 await f.observe('department-menu');await f.observe('world-map');f.advance();await f.claim(2);
 assert.equal(f.p.journey.claimedAt[1],f.now);assert.equal((await call(f.student,'mission:claim',{missionId:'first-journey-4'})).ok,false);
 // Visiting the shops before the north station does not count.
 const shops=JOURNEY_STEPS[2].goals[1];Object.assign(f.p,{mapId:shops.mapId,x:shops.x,y:shops.y});await wait(120);assert.deepEqual(f.p.journey.goals,[]);
 for(const id of ['station','shops','playground'])await f.placeGoal(3,id);
 assert.equal((await call(f.student,'growth:info')).ok,false);await f.info('evolution-star');assert(!f.p.journey.goals.includes('evolution-star'));
 await f.info('growth-star');await f.info('evolution-star');await f.claim(3);
 assert.deepEqual(f.self().practiceItems,Object.values(JOURNEY_ITEM_IDS).map(id=>({id,quantity:1})));assert.deepEqual(f.p.inventory,[]);
 for(const id of ['bag-1','bag-2','bag-3','item-info'])await f.observe(id);
 assert.deepEqual(f.q.journey?.goals||[],[]);ok(await call(f.student,'tutorial:practice-use',{targetId:f.q.id}));
 const rows=(await f.pillar('pillar-effects')).rows;assert(rows.some(r=>r.itemId===JOURNEY_ITEM_IDS.consumable));
 const equipped=ok(await call(f.student,'tutorial:practice-equip'));assert.equal(equipped.message,JOURNEY_EQUIP_MESSAGE);assert.deepEqual(f.p.equipmentSlots,[null,null,null]);
 await f.claim(4);assert.deepEqual(f.self().practiceItems,[]);assert.equal(f.p.journey.practiceUntil,0);
 await f.observe('chat-open');await f.observe('friends-open');assert.equal(f.room.missions[0].completedIds.length,0);f.advance();await f.claim(5);
 assert.equal(f.p.starShards,6,'new reward is five shards in addition to the old one');assert.equal(f.p.journey.stage,6);assert.deepEqual(f.p.journey.goals,[]);
 assert.equal(f.room.missions[0].progress[f.p.id],1);assert(f.view().missions.find(m=>m.id===made.missionId).status==='ready');
 assert.equal(f.view().missions.filter(m=>m.kind==='tutorial'&&m.status==='claimed').length,5);
 const before=structuredClone(f.p.journey);await f.restart();assert.deepEqual(f.p.journey,before);assert.equal(f.p.starShards,6);
 assert.equal((await call(f.student,'mission:claim',{missionId:'first-journey-5'})).ok,false);
});

test('practice effect expires, can be reused, is self-only and never affects real inventory/equipment/rewards',async t=>{
 const f=await fixture(t);f.stage(4);f.mutate(p=>{p.inventory=SHOP.items.slice(0,60).map(item=>({id:item.id,quantity:1}));});
 const bag=structuredClone(f.p.inventory),avatar=structuredClone(f.p.avatar),shards=f.p.starShards;
 assert.equal((await call(f.student,'tutorial:observe',{goalId:'effects-seen'})).ok,false);await f.pillar('pillar-effects');assert.deepEqual(f.p.journey.goals,[]);
 ok(await call(f.student,'tutorial:practice-use'));const untilAt=f.p.journey.practiceUntil;assert.equal(untilAt,f.now+60000);
 assert.equal(practiceEffectRows(f.p,f.q,f.now).length,0);assert.equal(practiceEffectRows(f.p,f.p,untilAt).length,0);
 f.advance(60000);const expired=await f.pillar('pillar-effects');assert(!expired.rows.some(r=>r.itemId===JOURNEY_ITEM_IDS.consumable));assert(!f.p.journey.goals.includes('effects-seen'));
 ok(await call(f.student,'tutorial:practice-use'));assert(f.p.journey.practiceUntil>untilAt);await f.pillar('pillar-effects');assert(f.p.journey.goals.includes('effects-seen'));
 ok(await call(f.student,'tutorial:practice-equip'));
 for(const itemId of Object.values(JOURNEY_ITEM_IDS)){
  assert.equal((await call(f.student,'item:use',{itemId,targetId:f.p.id})).ok,false);
  assert.equal((await call(f.student,'equipment:equip',{itemId,slot:1})).ok,false);
  assert.equal((await call(f.teacher,'teacher:inventory:give',{playerId:f.p.id,itemIds:[itemId]})).ok,false);
  assert.equal(itemOf(itemId).mode,'journey-practice');
  const shop=STREET.objects.find(o=>o.kind==='shop'),teacher=[...f.room.players.values()].find(p=>p.role==='teacher');
  Object.assign(teacher,{mapId:STREET.id,x:shop.x,y:shop.y+shop.radius+20});
  assert.equal((await call(f.teacher,'shop:buy',{itemId,quantity:1})).ok,false,'teacher free purchases must not materialize practice items');
  Object.assign(f.p,{mapId:STREET.id,x:shop.x,y:shop.y+shop.radius+20});
  assert.equal((await call(f.student,'shop:sell',{itemId,quantity:1})).ok,false);
 }
 assert.deepEqual(f.p.inventory,bag);assert.deepEqual(f.p.avatar,avatar);assert.equal(f.p.starShards,shards);assert.deepEqual(f.p.equipmentSlots,[null,null,null]);
 const qview=f.game.store.snapshot(f.room,f.q).players.find(p=>p.id===f.p.id);assert.equal(qview.practiceItems,undefined);assert.equal(qview.journey,undefined);
 const before=structuredClone(f.p.journey);await f.restart();assert.deepEqual(f.p.journey,before);assert.equal(f.self().practiceItems.length,2);assert.deepEqual(f.p.inventory,bag);
});

test('goal, practice and final reward writes roll back; duplicate/future claims and full shard bags cannot advance',async t=>{
 const f=await fixture(t);f.stage(4);const seen=[];f.student.on('room:state',r=>seen.push(r));
 await f.fail(async()=>assert.equal((await call(f.student,'tutorial:observe',{goalId:'bag-1'})).ok,false));assert.deepEqual(f.p.journey.goals,[]);
 await f.fail(async()=>assert.equal((await call(f.student,'tutorial:practice-use')).ok,false));assert.equal(f.p.journey.practiceUntil,0);assert.deepEqual(f.p.journey.goals,[]);
 await f.fail(async()=>assert.equal((await call(f.student,'tutorial:practice-equip')).ok,false));assert.deepEqual(f.p.journey.goals,[]);
 assert(!seen.some(r=>r.players.find(p=>p.id===f.p.id)?.journey?.goals.length));
 f.stage(5,JOURNEY_STEPS[4].goals.map(g=>g.id));const before=structuredClone(f.p.journey);
 const mission=ok(await call(f.teacher,'mission:auto:create',{title:'완료 연동',description:'모두 완료',rewardShards:1,distribution:'all',objective:'tutorial-complete',goal:1}));
 await f.fail(async()=>assert.equal((await call(f.student,'mission:claim',{missionId:'first-journey-5'})).ok,false));
 assert.deepEqual(f.p.journey,before);assert.equal(f.p.starShards,0);assert.equal(f.p.tutorialCompleted,false);assert(!f.room.missions.find(m=>m.id===mission.missionId).completedIds.length);
 f.mutate(p=>{p.starShards=SHARDS.max;});assert.equal((await call(f.student,'mission:claim',{missionId:'first-journey-5'})).ok,false);assert.deepEqual(f.p.journey,before);
 f.mutate(p=>{p.starShards=0;});const replies=await Promise.all([call(f.student,'mission:claim',{missionId:'first-journey-5'}),call(f.student,'mission:claim',{missionId:'first-journey-5'})]);
 assert.equal(replies.filter(r=>r.ok).length,1);assert.equal(f.p.starShards,1);assert.equal(f.p.journey.stage,6);assert.equal(f.p.journey.claimedAt[4],f.now);
 assert.equal((await call(f.teacher,'tutorial:observe',{goalId:'chat-open'})).ok,false);assert.equal((await call(f.other,'mission:claim',{missionId:'first-journey-5',playerId:f.p.id})).ok,false);
});

test('movement tick records only real motion, writes once per goal and retries failed writes without leaking progress',async t=>{
 const f=await fixture(t);let saves=0;const save=f.game.store.files.save.bind(f.game.store.files);f.game.store.files.save=(...args)=>{saves++;return save(...args);};
 const initialSaves=saves;await wait(180);assert.equal(saves,initialSaves);assert.deepEqual(f.self().journey.goals,[]);
 const seen=[];f.student.on('room:state',r=>seen.push(r));let failures=0;
 f.game.store.files.save=(...args)=>{saves++;if(failures++===0)throw Error('movement save failure');return save(...args);};
 f.student.emit('player:input',{x:1,y:0});await until(()=>failures>0);f.student.emit('player:input',{x:0,y:0});assert(!f.p.journey?.goals.includes('moved'));
 assert(!seen.some(r=>r.players.find(p=>p.id===f.p.id)?.journey.goals.includes('moved')));
 await until(()=>f.p.journey?.goals.includes('moved'));const successfulSaves=saves;await wait(200);assert.equal(saves,successfulSaves);
 await f.restart();assert(f.p.journey.goals.includes('moved'));
});

test('saved schema rejects impossible progress and old flags start at stage one; region boundaries stay exact',()=>{
 assert.deepEqual(validateJourney(undefined),freshJourney());
 for(const value of [null,{...freshJourney(),version:1},{...freshJourney(),stage:2},{...freshJourney(),goals:['world-map']},
  {...freshJourney(),goals:['moved','moved']},{...freshJourney(),claimedAt:[1]},
  {version:2,stage:3,goals:['shops'],claimedAt:[1,2]},
  {version:2,stage:4,goals:['effects-seen'],claimedAt:[1,2,3]},
  {version:2,stage:2,goals:['department-menu'],claimedAt:[1]},
  {version:2,stage:6,goals:['chat-open'],claimedAt:[1,2,3,4,5]},
  {...freshJourney(),practiceUntil:100}])assert.throws(()=>validateJourney(value));
 const zone=JOURNEY_STEPS[1].goals.find(g=>g.id==='market'),p={role:'student',connected:true,mapId:zone.mapId,journey:{version:2,stage:2,goals:[],claimedAt:[1],practiceUntil:0},x:zone.x+zone.rx,y:zone.y};
 assert.deepEqual(journeyTickGoals(p),['market']);p.x+=.001;assert.deepEqual(journeyTickGoals(p),[]);p.x=zone.x;p.mapId='star-street';assert.deepEqual(journeyTickGoals(p),[]);
 p.mapId=zone.mapId;p.away=true;assert.deepEqual(journeyTickGoals(p),[]);p.away=false;p.connected=false;assert.deepEqual(journeyTickGoals(p),[]);
 assert.equal(journeyGoal({role:'teacher'},'moved'),false);
});

test('legacy records and private practice state survive cold loading without materializing fake inventory',async t=>{
 const f=await fixture(t);f.mutate(p=>Object.assign(p,{tutorialCompleted:true,tutorialRewardClaimed:true,tutorialRewardClaimedAt:f.now}));
 const legacy=toRecord(f.room),saved=legacy.students.find(p=>p.id===f.p.id);delete saved.journey;
 const restored=fromRecord(legacy);assert.deepEqual(restored.players.get(f.p.id).journey,freshJourney());
 saved.inventory.push({id:JOURNEY_ITEM_IDS.equipment,quantity:1});assert.throws(()=>fromRecord(legacy));
});
