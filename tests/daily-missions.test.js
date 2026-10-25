import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {MAP,STREET,SHARDS} from '../shared/config.js';
import {RoomStore} from '../server/rooms.js';
import {toRecord,fromRecord} from '../server/persistent-rooms.js';
import {ensureDailyMissions,dailyMissionDay,validateDailyMissions,validateDailyMissionHistory} from '../server/daily-missions.js';
import {createMission,advanceMissions,claimMission,missionViews,acceptMission,completeMission} from '../server/missions.js';

const daily=f=>f.room.dailyMissions.instances.find(m=>m.templateId==='builtin-timetable');
const at=(p,kind)=>{const o=MAP.objects.find(o=>o.service===kind||o.kind===kind);Object.assign(p,{mapId:MAP.id,x:o.x,y:o.y+o.radius+5});return o.id;};
const read=f=>call(f.student,'temple:read',{objectId:at(f.p,'timetable')});
const template={title:'매일 시간표',description:'시간표를 읽어요',objective:'timetable-read',goal:1,repeat:'daily',rewardQuantity:3,distribution:'all'};

test('daily timetable validates location, awards one crumb atomically and retains private claims after restart',async t=>{
 const f=await readingFixture(t),id=daily(f).id;
 assert.equal(id,`daily:builtin-timetable:${dailyMissionDay(f.now)}`);
 assert.equal(daily(f).acceptedIds.includes(f.teacherPlayer.id),false);
 assert.equal((await call(f.student,'temple:read',{objectId:'pillar-timetable'})).ok,false);
 assert.equal((await call(f.student,'mission:claim',{missionId:id})).ok,false);
 ok(await read(f));assert(daily(f).completedIds.includes(f.p.id));
 const responses=await Promise.all([call(f.student,'mission:claim',{missionId:id}),call(f.student,'mission:claim',{missionId:id})]);
 assert.equal(responses.filter(r=>r.ok).length,1);assert.equal(responses.find(r=>r.ok).rewardItem,'star-crumb');
 assert.equal(f.p.inventory.find(e=>e.id==='star-crumb').quantity,1);assert.equal(f.p.starShards,0);
 assert.equal((await call(f.teacher,'mission:claim',{missionId:id})).ok,false);
 assert.equal((await call(f.other,'mission:claim',{missionId:id})).ok,false);
 assert(!JSON.stringify(missionViews(f.room,f.q,f.now)).includes(f.p.id));
 await f.restart();assert.equal(daily(f).id,id);assert(daily(f).claimedIds.includes(f.p.id));
 assert.equal((await call(f.student,'mission:claim',{missionId:id})).ok,false);
 assert.equal(f.p.inventory.find(e=>e.id==='star-crumb').quantity,1);
});

test('teacher daily automatic missions grant selected rewards while built-in timetable keeps its crumb default',async t=>{
 const f=await readingFixture(t),selected=[{type:'star-crumb',quantity:2},{type:'star-shard',quantity:3},{type:'cosmic-energy',quantity:4}];
 const made=ok(await call(f.teacher,'mission:auto:create',{title:'매일 세 가지',description:'시간표를 확인해요',objective:'timetable-read',goal:1,
  repeat:'daily',distribution:'all',rewards:selected,rewardShards:3}));
 const custom=f.room.dailyMissions.instances.find(m=>m.templateId===made.missionId),builtin=daily(f);
 assert.deepEqual(custom.rewards,selected);assert.deepEqual(builtin.rewards,undefined);
 ok(await read(f));
 const customClaim=ok(await call(f.student,'mission:claim',{missionId:custom.id}));
 assert.deepEqual(customClaim.rewards,selected);assert.equal(f.p.starShards,3);assert.equal(f.p.cosmicEnergy,4);
 assert.equal(f.p.inventory.find(item=>item.id==='star-crumb').quantity,2);
 const defaultClaim=ok(await call(f.student,'mission:claim',{missionId:builtin.id}));
 assert.deepEqual(defaultClaim.rewards,[{type:'star-crumb',quantity:1}]);
 assert.equal(f.p.inventory.find(item=>item.id==='star-crumb').quantity,3);
 assert.equal((await call(f.student,'mission:claim',{missionId:custom.id})).ok,false);
 await f.restart();
 assert.deepEqual(f.room.dailyMissions.instances.find(m=>m.templateId===made.missionId).rewards,selected);
 f.advance(86400000);ok(await call(f.teacher,'mission:board:read'));
 const history=f.p.dailyMissionHistory.find(entry=>entry.templateId===made.missionId);
 assert.deepEqual(history.rewards,selected);assert(validateDailyMissionHistory(f.p.dailyMissionHistory).some(entry=>entry.id===history.id));
});

test('teacher daily templates renew at Korean midnight with independent progress and expire old claims',async t=>{
 const f=await readingFixture(t);
 assert.equal((await call(f.student,'mission:auto:create',template)).ok,false);
 ok(await call(f.teacher,'mission:auto:create',template));
 const old=daily(f).id;ok(await read(f));ok(await call(f.student,'mission:claim',{missionId:old}));
 const oldCustom=f.room.dailyMissions.instances.find(m=>m.templateId!=='builtin-timetable').id;
 f.advance(1000);ok(await call(f.teacher,'mission:board:read'));
 assert.notEqual(daily(f).id,old);assert.equal(daily(f).completedIds.length,0);
 assert.equal((await call(f.student,'mission:claim',{missionId:oldCustom})).ok,false);
 assert.equal(f.p.dailyMissionHistory.length,1);assert.equal(f.q.dailyMissionHistory?.length||0,0);
 assert.equal(missionViews(f.room,f.p,f.now).find(m=>m.id===old).status,'claimed');
 ok(await read(f));ok(await call(f.student,'mission:claim',{missionId:daily(f).id}));
 assert.equal(f.p.inventory.find(e=>e.id==='star-crumb').quantity,2);
 await f.restart();assert.equal(f.p.dailyMissionHistory.length,1);assert.equal(f.room.missions.length,1);
});

test('daily save failures roll back claims, progress, inventory, and rollover history',async t=>{
 const f=await readingFixture(t),id=daily(f).id;at(f.p,'timetable');
 await f.fail(async()=>assert.equal((await read(f)).ok,false));assert.equal(daily(f).completedIds.length,0);
 ok(await read(f));
 await f.fail(async()=>assert.equal((await call(f.student,'mission:claim',{missionId:id})).ok,false));
 assert.equal(daily(f).claimedIds.length,0);assert(!f.p.inventory.some(e=>e.id==='star-crumb'));
 ok(await call(f.student,'mission:claim',{missionId:id}));
 f.advance(1000);
 await f.fail(async()=>assert.equal((await call(f.teacher,'mission:board:read')).ok,false));
 assert.equal(daily(f).id,id);assert.equal(f.p.dailyMissionHistory?.length||0,0);
 ok(await call(f.teacher,'mission:board:read'));assert.equal(f.p.dailyMissionHistory.length,1);
});

test('daily crumb capacity preserves claim and five crumbs craft exactly one shard with disk rollback',async t=>{
 const f=await readingFixture(t);ok(await read(f));
 f.mutate(p=>{p.inventory=[{id:'star-crumb',quantity:99}];p.starShards=SHARDS.max;});
 assert.equal((await call(f.student,'mission:claim',{missionId:daily(f).id})).ok,false);
 f.mutate(p=>{p.inventory[0].quantity=5;p.starShards=0;});
 // Crafting uses the same persisted transaction as rewards.
 const forge=STREET.objects.find(o=>o.kind==='crafting');
 Object.assign(f.p,{mapId:STREET.id,x:forge.x,y:forge.y+forge.radius+5});
 const input={ingredients:[{id:'star-crumb',quantity:5}]};
 await f.fail(async()=>assert.equal((await call(f.student,'crafting:combine',input)).ok,false));
 assert.equal(f.p.inventory[0].quantity,5);assert.equal(f.p.starShards,0);
 const r=await call(f.student,'crafting:combine',input);ok(r);
 assert.equal(f.p.starShards,1);assert(!f.p.inventory.some(e=>e.id==='star-crumb'));
 await f.restart();assert.equal(f.p.starShards,1);
});

test('thirty definitions stay bounded across months, offline/new students enroll, backwards clock cannot replay',()=>{
 let now=Date.parse('2026-10-01T00:00:00+09:00');const store=new RoomStore({clock:()=>now});
 const {room}=store.create({title:'일일 검사',allowedNames:['하나','둘']},'teacher');
 const {player:p}=store.join({code:room.code,nickname:'하나'},'student');
 for(let i=0;i<30;i++)createMission(room,template,now);
 assert.throws(()=>createMission(room,template,now));assert.equal(room.dailyMissions.instances.length,31);
 for(let day=0;day<110;day++){
  ensureDailyMissions(room,now);advanceMissions(room,p,'timetable-read',undefined,now);
  claimMission(room,p,room.dailyMissions.instances[0].id,now);now+=86400000;
 }
 p.connected=false;ensureDailyMissions(room,now);assert(room.dailyMissions.instances.every(m=>m.acceptedIds.includes(p.id)));
 const {player:q}=store.join({code:room.code,nickname:'둘'},'student2');ensureDailyMissions(room,now);
 assert(room.dailyMissions.instances.every(m=>m.acceptedIds.includes(q.id)));
 assert.equal(p.dailyMissionHistory.length,100);validateDailyMissionHistory(p.dailyMissionHistory);validateDailyMissions(room.dailyMissions);
 const day=room.dailyMissions.day;ensureDailyMissions(room,now-86400000);assert.equal(room.dailyMissions.day,day);
 assert.equal(missionViews(room,p,now-86400000).filter(m=>m.repeat==='daily'&&!m.archived).length,0);
 assert.equal(room.missions.length,30);assert.equal(room.dailyMissions.instances.length,31);
 room.missions=[];
 assert.throws(()=>createMission(room,template,now),/오늘 배정/,'stopping templates cannot exceed the current day instance cap');
});

test('capacity is first come and expiry blocks accept, confirm, claim, progress and late all-enrollment',()=>{
 let now=1000000;const store=new RoomStore({clock:()=>now}),{room}=store.create({title:'기간',allowedNames:['하나','둘','셋']},'t');
 const {player:p}=store.join({code:room.code,nickname:'하나'},'a');
 const m=createMission(room,{title:'하나만',description:'조건',rewardShards:2,distribution:'board',maxRecipients:1,validityHours:1},now);
 acceptMission(room,p,m.id,now);
 const {player:q}=store.join({code:room.code,nickname:'둘'},'b');assert.throws(()=>acceptMission(room,q,m.id,now),/선착순/);
 completeMission(room,p.id,m.id,now);
 const auto=createMission(room,{title:'이동',description:'이동',rewardShards:1,distribution:'all',objective:'map-travel',goal:1,validityHours:1},now);
 now=m.expiresAt;
 assert.throws(()=>claimMission(room,p,m.id,now),/유효기간/);assert.throws(()=>completeMission(room,p.id,m.id,now),/유효기간/);assert.throws(()=>acceptMission(room,q,m.id,now),/유효기간/);
 advanceMissions(room,p,'map-travel',undefined,now);assert.equal(auto.completedIds.length,0);
 const {player:late}=store.join({code:room.code,nickname:'셋'},'c');assert.equal(auto.acceptedIds.includes(late.id),false);
});

test('stopping a teacher template preserves today, survives restart and blocks tomorrow; failure preserves the template',async t=>{
 const f=await readingFixture(t),r=ok(await call(f.teacher,'mission:auto:create',template)),templateId=r.missionId;
 assert.equal((await call(f.teacher,'mission:auto:create',{...template,goal:2})).ok,false);
 assert.equal((await call(f.teacher,'mission:auto:create',{...template,validityHours:25})).ok,false);
 assert.equal((await call(f.student,'mission:repeat:stop',{templateId})).ok,false);
 assert.equal((await call(f.teacher,'mission:repeat:stop',{templateId:'builtin-timetable'})).ok,false);
 assert.equal((await call(f.teacher,'mission:repeat:stop',{templateId:'other-class'})).ok,false);
 await f.fail(async()=>assert.equal((await call(f.teacher,'mission:repeat:stop',{templateId})).ok,false));
 assert(f.room.missions.some(m=>m.id===templateId));
 ok(await call(f.teacher,'mission:repeat:stop',{templateId}));
 assert.equal(f.room.missions.length,0);const instance=f.room.dailyMissions.instances.find(m=>m.templateId===templateId);
 assert(missionViews(f.room,f.p,f.now).find(m=>m.id===instance.id).repeatStopped);
 ok(await read(f));ok(await call(f.student,'mission:claim',{missionId:instance.id}));
 await f.restart();assert(f.room.dailyMissions.instances.some(m=>m.id===instance.id));
 f.advance(1000);ok(await call(f.teacher,'mission:board:read'));assert.equal(f.room.dailyMissions.instances.length,1);
 assert(f.p.dailyMissionHistory.some(m=>m.id===instance.id));
});

test('idle midnight rotates all classrooms independently and enrolls offline students without action',async t=>{
 const f=await readingFixture(t),otherTeacher=await f.connect();
 const second=ok(await call(otherTeacher,'room:create',{teacherKey:'reading-rewards-test',title:'다른 교실',allowedNames:['셋']}));
 const secondRoom=()=>f.game.store.rooms.get(second.room.code),old=f.room.dailyMissions.day;
 f.other.disconnect();f.advance(1000);
 for(let i=0;i<40&&f.room.dailyMissions.day===old;i++)await new Promise(r=>setTimeout(r,25));
 assert.notEqual(f.room.dailyMissions.day,old);assert.equal(secondRoom().dailyMissions.day,f.room.dailyMissions.day);
 assert(daily(f).acceptedIds.includes(f.q.id));
});

test('627 timetable read advances daily independently of incomplete tutorial, rejects forged service, and survives reconnect',async t=>{
 const f=await readingFixture(t),id=daily(f).id;
 f.mutate(p=>{p.journey={version:2,stage:1,goals:[],claimedAt:[],practiceUntil:0};});
 const notice=at(f.p,'notice');
 ok(await call(f.student,'temple:read',{objectId:notice,kind:'timetable',service:'timetable'}));
 assert.equal(daily(f).completedIds.includes(f.p.id),false,'client service fields cannot count a different pillar');
 ok(await read(f));assert.equal(daily(f).progress[f.p.id],1);
 assert.equal(missionViews(f.room,f.p,f.now).find(m=>m.id===id).status,'ready');
 ok(await read(f));assert.equal(daily(f).progress[f.p.id],1,'reopening does not overcount');
 await f.reconnect();assert.equal(missionViews(f.room,f.p,f.now).find(m=>m.id===id).status,'ready');
 ok(await call(f.student,'mission:claim',{missionId:id}));assert.equal(f.p.inventory.find(e=>e.id==='star-crumb').quantity,1);
});

test('627 legacy save without daily fields restores and assigns the timetable before its first read',async t=>{
 const f=await readingFixture(t),record=toRecord(f.room);
 delete record.dailyMissions;for(const p of record.students)delete p.dailyMissionHistory;
 const restored=fromRecord(record),p=restored.players.get(f.p.id);
 ensureDailyMissions(restored,f.now);
 const daily=restored.dailyMissions.instances.find(m=>m.templateId==='builtin-timetable');
 assert(daily.acceptedIds.includes(p.id));
 advanceMissions(restored,p,'timetable-read',undefined,f.now);
 assert.equal(missionViews(restored,p,f.now).find(m=>m.id===daily.id).status,'ready');
 const roundTrip=fromRecord(toRecord(restored));
 assert.equal(missionViews(roundTrip,roundTrip.players.get(p.id),f.now).find(m=>m.id===daily.id).status,'ready');
});
