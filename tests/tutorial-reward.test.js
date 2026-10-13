import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {JOURNEY_STEPS} from '../shared/tutorial-journey.js';

test('old tutorial completion never skips the new five stages or claims the old reward',async t=>{
  const key='tutorial-reward-test-key',game=createClassroomServer({teacherKey:key,studentHours:false});
  const {port}=await game.listen(),sockets=[];
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});
  const connect=async()=>{const s=io(`http://127.0.0.1:${port}`,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;};
  const call=(s,event,data={})=>s.timeout(3000).emitWithAck(event,data),teacher=await connect();
  const created=await call(teacher,'room:create',{teacherKey:key,title:'new journey',allowedNames:['1']});assert(created.ok);
  const student=await connect(),joined=await call(student,'room:join',{code:created.room.code,nickname:'1'});assert(joined.ok);
  const room=game.store.rooms.get(created.room.code),p=room.players.get(joined.selfId);
  Object.assign(p,{tutorialCompleted:true,tutorialRewardClaimed:true,starShards:1});
  assert.equal(game.store.snapshot(room,p).players.find(v=>v.id===p.id).journey.stage,1);
  for(const s of [teacher,student]){
    assert.equal((await call(s,'tutorial:complete')).ok,false);
    assert.equal((await call(s,'mission:claim',{missionId:'first-journey'})).ok,false);
  }
  assert.equal((await call(student,'mission:claim',{missionId:'first-journey-2'})).ok,false);
  p.journey={version:2,stage:1,goals:JOURNEY_STEPS[0].goals.map(g=>g.id),claimedAt:[],practiceUntil:0};
  assert.equal((await call(student,'mission:claim',{missionId:'first-journey-1'})).ok,true);
  assert.equal(p.starShards,2);assert.equal(p.journey.stage,2);
  assert.equal((await call(student,'mission:claim',{missionId:'first-journey-1'})).ok,false);
});