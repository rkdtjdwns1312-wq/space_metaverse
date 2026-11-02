import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {mapOf} from '../shared/config.js';
import {TRUTH_CREATOR,TRUTH_CREATOR_REQUIRED_BOSSES,TRUTH_CREATOR_ENTRY_MESSAGE} from '../shared/truth-creator.js';
import {recordBossVictory} from '../server/serena-progress.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
test('socket ignores forged qualifications, blocks fast travel, and opens gate only after all actual boss credits',async t=>{
  const now=Date.parse('2026-11-02T12:00:00+09:00'),teacherKey='truth-creator-isolated-test',game=createClassroomServer({teacherKey,studentHours:false,clock:()=>now}),sockets=[];
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});const {port}=await game.listen();
  async function connect(){const socket=io('http://127.0.0.1:'+port,{transports:['websocket'],reconnection:false});sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;}
  const call=(s,event,data={})=>s.timeout(4000).emitWithAck(event,data),teacher=await connect();
  const made=await call(teacher,'room:create',{teacherKey,title:'보스문검사',allowedNames:['검사']});assert(made.ok,made.error);
  const student=await connect(),joined=await call(student,'room:join',{code:made.room.code,nickname:'검사',pin:'1234'});assert(joined.ok,joined.error);
  const room=game.store.rooms.get(made.room.code),p=[...room.players.values()].find(p=>p.role==='student'),gate=mapOf('sleeping-stars-3').objects.find(o=>o.target===TRUTH_CREATOR.mapId);
  chargeHuntingStation(p,'math',now);Object.assign(p,{mapId:'sleeping-stars-3',x:gate.x,y:gate.y});
  assert.equal((await call(student,'map:fast-travel',{to:TRUTH_CREATOR.mapId})).ok,false);
  const forged=await call(student,'map:travel',{to:TRUTH_CREATOR.mapId,serenaProgress:{highestLevel:5,bossKills:TRUTH_CREATOR_REQUIRED_BOSSES}});
  assert.equal(forged.error,TRUTH_CREATOR_ENTRY_MESSAGE);assert.equal(p.mapId,'sleeping-stars-3');
  for(const typeId of TRUTH_CREATOR_REQUIRED_BOSSES)recordBossVictory(room,{typeId,mapId:p.mapId},new Map([[p.id,1]]));
  assert.equal((await call(student,'map:fast-travel',{to:TRUTH_CREATOR.mapId})).ok,false);
  Object.assign(p,{x:gate.x,y:gate.y});const entered=await call(student,'map:travel',{to:TRUTH_CREATOR.mapId});assert(entered.ok,entered.error);
  assert.equal(p.mapId,TRUTH_CREATOR.mapId);
  const statue=mapOf(p.mapId).objects.find(o=>o.id===TRUTH_CREATOR.statueId);Object.assign(p,{x:statue.x,y:statue.y+90});
  const summoned=await call(student,'truth-creator:summon');assert(summoned.ok,summoned.error);assert.equal(summoned.truthCreator.state,'active');
  assert.equal(room.monsters.get(TRUTH_CREATOR.monsterId).hp,50000);assert.equal((await call(student,'truth-creator:summon')).ok,false);
});
