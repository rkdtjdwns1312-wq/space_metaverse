import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';import {STREET} from '../shared/config.js';
import {CULTURE_STORIES} from '../shared/culture-stories.js';
import {toRecord,fromRecord} from '../server/persistent-rooms.js';
import {validateCultureRecommendations,validateCultureRecommendationVotes} from '../server/culture-library.js';

const ids=CULTURE_STORIES.map(book=>book.id);
const call=(socket,event,data={})=>socket.timeout(4000).emitWithAck(event,data),ok=result=>{assert.equal(result.ok,true,result.error);return result;};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(t){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'culture-recommend-')),sockets=[],key='culture-recommend-test-key-long';
  let game,url,teacher,student,other,code,id,otherId,closed=true,now=Date.parse('2026-10-13T14:59:59Z');
  const start=async()=>{game=createClassroomServer({teacherKey:key,dataDir:directory,teacherManagedAccounts:false,studentHours:false,clock:()=>now});url=`http://127.0.0.1:${(await game.listen()).port}`;closed=false;};
  const connect=async()=>{const socket=io(url,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;};
  const join=async()=>{student=await connect();id=ok(await call(student,'room:join',{code,nickname:'하나',pin:'1234'})).selfId;other=await connect();otherId=ok(await call(other,'room:join',{code,nickname:'둘',pin:'1234'})).selfId;};
  t.after(async()=>{sockets.forEach(s=>s.disconnect());if(!closed)await game.close();assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(directory,{recursive:true,force:true});});
  await start();teacher=await connect();code=ok(await call(teacher,'room:create',{teacherKey:key,title:'추천 검사',allowedNames:['하나','둘']})).room.code;await join();
  const f={get game(){return game;},get room(){return game.store.rooms.get(code);},get p(){return f.room.players.get(id);},get q(){return f.room.players.get(otherId);},get student(){return student;},get other(){return other;},get teacher(){return teacher;},get now(){return now;},at(kind,p=f.p){const s=STREET.objects.find(o=>o.kind===kind+'-station');Object.assign(p,{mapId:STREET.id,x:s.x,y:s.y+120,input:{x:0,y:0,at:0}});},
    async restart(){sockets.forEach(s=>s.disconnect());await game.close();closed=true;await start();teacher=await connect();ok(await call(teacher,'room:open',{teacherKey:key,code}));await join();},
    async fail(work){const save=game.store.files.save.bind(game.store.files);game.store.files.save=()=>{throw Error('recommend disk failure');};try{await work();}finally{game.store.files.save=save;}}
  };f.at('culture');f.at('culture',f.q);return f;
}

test('recommendation schema validates unique known votes and exact classroom totals',()=>{
  assert.deepEqual(validateCultureRecommendationVotes(undefined),[]);
  assert.deepEqual(validateCultureRecommendations(undefined,[[ids[0],ids[1]],[ids[0]]]),{[ids[0]]:2,[ids[1]]:1});
  for(const votes of [null,{},[ids[0],ids[0]],['unknown']])assert.throws(()=>validateCultureRecommendationVotes(votes));
  assert.throws(()=>validateCultureRecommendations({[ids[0]]:1},[[ids[0]],[ids[0]]]));
  assert.throws(()=>validateCultureRecommendations({unknown:1},[]));
});

test('only the selected culture book can be recommended; votes toggle and remain classroom-wide across restart',async t=>{
  const f=await fixture(t);f.at('culture');
  assert.deepEqual(ok(await call(f.student,'culture:status')).recommendationCounts,{});
  assert.equal((await call(f.student,'culture:recommend',{storyId:ids[0]})).ok,false);
  ok(await call(f.student,'culture:open',{storyId:ids[0]}));
  assert.equal((await call(f.student,'culture:recommend',{storyId:ids[1]})).ok,false);
  const first=ok(await call(f.student,'culture:recommend',{storyId:ids[0]}));
  assert.deepEqual(first.recommendedIds,[ids[0]]);assert.equal(first.recommendationCounts[ids[0]],1);
  assert.deepEqual(ok(await call(f.other,'culture:status')).recommendedIds,[]);
  ok(await call(f.other,'culture:open',{storyId:ids[0]}));
  const second=ok(await call(f.other,'culture:recommend',{storyId:ids[0]}));assert.equal(second.recommendationCounts[ids[0]],2);
  const again=ok(await call(f.student,'culture:recommend',{storyId:ids[0]}));
  assert.deepEqual(again.recommendedIds,[]);assert.equal(again.recommendationCounts[ids[0]],1);
  const snapshot=f.game.store.snapshot(f.room,f.p,f.now);
  for(const visible of snapshot.players){assert.equal(Object.hasOwn(visible,'cultureRecommendationVotes'),false);assert.equal(Object.hasOwn(visible,'recommendationCounts'),false);}
  const saved=toRecord(f.room);assert.equal(saved.cultureRecommendations[ids[0]],1);
  assert.deepEqual(saved.students.find(p=>p.id===f.p.id).cultureRecommendationVotes,[]);
  await f.restart();f.at('culture');
  const restored=ok(await call(f.student,'culture:status'));
  assert.equal(restored.recommendationCounts[ids[0]],1);assert.deepEqual(restored.recommendedIds,[]);
  assert.deepEqual(fromRecord({...saved,cultureRecommendations:undefined}).cultureRecommendations,{[ids[0]]:1});
});

test('recommendation checks login, current book, student role, nearby station and rollback on save failure',async t=>{
  const f=await fixture(t);f.at('culture');
  assert.equal((await call(f.student,'culture:recommend',{storyId:ids[0]})).ok,false);
  ok(await call(f.student,'culture:open',{storyId:ids[0]}));
  f.p.mapId='space-plaza';assert.equal((await call(f.student,'culture:recommend',{storyId:ids[0]})).ok,false);
  f.at('culture');
  await f.fail(async()=>assert.equal((await call(f.student,'culture:recommend',{storyId:ids[0]})).ok,false));
  assert.deepEqual(f.p.cultureRecommendationVotes||[],[]);assert.deepEqual(f.room.cultureRecommendations||{},{});
  ok(await call(f.student,'culture:recommend',{storyId:ids[0]}));
  assert.deepEqual(f.p.cultureRecommendationVotes,[ids[0]]);assert.equal(f.room.cultureRecommendations[ids[0]],1);
  f.at('history');const historyStatus=ok(await call(f.student,'history:status'));
  assert.equal(Object.hasOwn(historyStatus,'recommendationCounts'),false);assert.equal(Object.hasOwn(historyStatus,'recommendedIds'),false);
});

test('reading claim response preserves the reader recommendation state',async t=>{
  const f=await fixture(t);f.at('culture');
  ok(await call(f.student,'culture:open',{storyId:ids[0]}));
  const vote=ok(await call(f.student,'culture:recommend',{storyId:ids[0]}));
  const claim=ok(await call(f.student,'culture:claim',{storyId:ids[0]}));
  assert.deepEqual(claim.recommendedIds,vote.recommendedIds);
  assert.deepEqual(claim.recommendationCounts,vote.recommendationCounts);
});

test('reading claims reject duplicates and the daily-limit overrun',async t=>{
  const f=await fixture(t);f.at('culture');
  ok(await call(f.student,'culture:open',{storyId:ids[0]}));ok(await call(f.student,'culture:claim',{storyId:ids[0]}));
  assert(f.p.dailyMissionHistory||f.room.dailyMissions||f.room.missions);
  const missionState=structuredClone({history:f.p.dailyMissionHistory,missions:f.room.dailyMissions});
  assert.equal(ok(await call(f.student,'culture:claim',{storyId:ids[0]})).awarded,false);
  assert.deepEqual(structuredClone({history:f.p.dailyMissionHistory,missions:f.room.dailyMissions}),missionState);
  for(let i=1;i<10;i++){ok(await call(f.student,'culture:open',{storyId:ids[i]}));ok(await call(f.student,'culture:claim',{storyId:ids[i]}));}
  const before=structuredClone({history:f.p.dailyMissionHistory,missions:f.room.dailyMissions});
  ok(await call(f.student,'culture:open',{storyId:ids[10]}));assert.equal(ok(await call(f.student,'culture:claim',{storyId:ids[10]})).awarded,false);
  assert.deepEqual(structuredClone({history:f.p.dailyMissionHistory,missions:f.room.dailyMissions}),before);
});
