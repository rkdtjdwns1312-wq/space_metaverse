import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {activeStarCards,useStarCard} from '../server/star-cards.js';
import {displayStarCard,validateStarCardText} from '../server/star-card-text.js';

test('별카드 표시 문구는 기존 저장 자료와 호환되고 잘못된 저장 값을 거부한다',()=>{
  assert.deepEqual(validateStarCardText(undefined),{});
  assert.equal(displayStarCard({},'new-life').name,'새로운 삶의 터전');
  for(const value of [{missing:{name:'a',description:'',effect:'b'}},{'new-life':{name:'',description:'',effect:'b'}},
    {'new-life':{name:'a',description:'',effect:'b',automation:{}}}])assert.throws(()=>validateStarCardText(value));
});

test('교사만 카드 문구를 저장하고 학생 화면·재시작에 반영하며 저장 실패는 복원한다',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'star-card-text-')),key='card-text-test-key';
  let game;const sockets=[];
  const start=async()=>{game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false,unattended:true});await game.listen();};
  const connect=async()=>{const socket=io(`http://127.0.0.1:${game.http.address().port}`,{transports:['websocket'],reconnection:false,autoConnect:false});sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);socket.connect();});return socket;};
  const call=(socket,event,data={})=>socket.timeout(5000).emitWithAck(event,data);
  t.after(async()=>{sockets.forEach(socket=>socket.disconnect());await game?.close();rmSync(dir,{recursive:true,force:true});});
  await start();const teacher=await connect(),anonymous=await connect();
  const made=await call(teacher,'room:create',{teacherKey:key,studentAccounts:[{nickname:'학생',pin:'1234'}]});assert.ok(made.ok,made.error);
  const code=made.room.code,student=await connect();assert.ok((await call(student,'room:join',{code,nickname:'학생',pin:'1234'})).ok);
  const update={id:'new-life',name:'새 출발의 별',description:'새로운 우주를 만나요.',effect:'선생님과 새 자리를 정해요.'};
  for(const socket of [anonymous,student])assert.equal((await call(socket,'teacher:cards:update',{...update,role:'teacher'})).ok,false);
  assert.equal((await call(teacher,'teacher:cards:update',{...update,id:'unknown'})).ok,false);
  assert.equal((await call(teacher,'teacher:cards:update',{...update,name:'X'.repeat(81)})).ok,false);
  const saved=await call(teacher,'teacher:cards:update',update);assert.ok(saved.ok,saved.error);
  assert.equal(saved.card.effect,update.effect);
  const catalog=await call(teacher,'teacher:cards:catalog');assert.equal(catalog.gold.find(card=>card.id===update.id).name,update.name);
  const room=game.store.rooms.get(code),player=[...room.players.values()].find(p=>p.role==='student');
  player.inventory.push({id:'star-card',quantity:1});
  const used=useStarCard(room,player,Date.now(),()=>0);assert.equal(activeStarCards(room)[0].effect,update.effect);
  const view=activeStarCards(room)[0];Object.assign(player,{mapId:view.mapId,x:view.x,y:view.y});
  const read=await call(student,'star-card:read',{id:used.record.id});assert.ok(read.ok,read.error);assert.equal(read.definition.description,update.description);
  const save=game.store.files.save.bind(game.store.files);game.store.files.save=()=>{throw Error('simulated storage failure');};
  try{assert.equal((await call(teacher,'teacher:cards:update',{...update,effect:'저장되면 안 돼요.'})).ok,false);}
  finally{game.store.files.save=save;}
  assert.equal((await call(teacher,'teacher:cards:catalog')).gold.find(card=>card.id===update.id).effect,update.effect);
  sockets.forEach(socket=>socket.disconnect());await game.close();await start();
  const reopened=await connect();assert.ok((await call(reopened,'room:open',{teacherKey:key,code})).ok);
  assert.equal((await call(reopened,'teacher:cards:catalog')).gold.find(card=>card.id===update.id).name,update.name);
});
