import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io} from 'socket.io-client';
import {RoomStore} from '../server/rooms.js';
import {MAP} from '../shared/config.js';
import {EXPLORATION_CARDS,EXPLORATION_GOAL} from '../shared/exploration.js';
import {readExploration,explore,clearExplorationResults,resetExploration,useExplorationTicket,validateExploration} from '../server/exploration.js';
import {createClassroomServer} from '../server/app.js';

const flask=MAP.objects.find(object=>object.kind==='exploration');
const ticket=(player,n)=>{player.inventory=[{id:'exploration-ticket',quantity:n}];};
test('탐사권을 써야 탐사하며 결과 10장은 0·1·2가 2·6·2장으로 구성된다',()=>{
  const store=new RoomStore(),{room,player:teacher}=store.create({allowedNames:['별이']},'teacher');
  const student=store.join({code:room.code,nickname:'별이'},'student').player;
  Object.assign(student,{x:flask.x,y:flask.y});
  assert.deepEqual([0,1,2].map(n=>EXPLORATION_CARDS.filter(card=>card.energy===n).length),[2,6,2]);
  assert.throws(()=>explore(room,student,1000,()=>0),/탐사권/);
  ticket(student,2);useExplorationTicket(room,student);assert.equal(student.explorationChances,1);
  const result=explore(room,student,1000,()=>8);assert.equal(result.energy,2);assert.equal(result.chances,0);
  assert.equal(readExploration(room,student).contributors[0].energy,2);
  assert.throws(()=>clearExplorationResults(room,student),/선생님만/);
  Object.assign(teacher,{x:flask.x,y:flask.y});clearExplorationResults(room,teacher);
  assert.equal(room.exploration.energy,2);assert.equal(room.exploration.results.length,0);
  assert.throws(()=>resetExploration(room,teacher),/가득 찼을 때/);
  assert.throws(()=>validateExploration({energy:16,results:[]}),/저장 데이터/);
});

test('탐사권도 개기 일식 사용료와 사용 금지 상태를 적용하고 실패 때 보존한다',()=>{
  const store=new RoomStore(),{room,player:teacher}=store.create({allowedNames:['별이']},'teacher');
  const student=store.join({code:room.code,nickname:'별이'},'student').player,now=Date.now();
  ticket(student,1);student.starShards=0;
  student.cardMarkers.push({id:'eclipse',itemId:'total-eclipse-card',fromId:teacher.id,fromNickname:teacher.nickname,until:now+100000,at:now});
  assert.throws(()=>useExplorationTicket(room,student,now),/별 파편 1개/);
  assert.equal(student.inventory[0].quantity,1);assert.equal(student.explorationChances,0);
  student.starShards=1;useExplorationTicket(room,student,now);
  assert.equal(student.starShards,0);assert.equal(teacher.starShards,1);assert.equal(student.explorationChances,1);
  ticket(student,1);assert.throws(()=>useExplorationTicket(room,student,now+1),/천천히/);
  assert.equal(student.inventory[0].quantity,1);
});

test('기운 15가 되면 축제가 열리고 선생님만 초기화하며 베텔기우스 우선권은 당일 실제 기운에 비례한다',()=>{
  const store=new RoomStore(),{room,player:teacher}=store.create({allowedNames:['별이']},'teacher');
  const student=store.join({code:room.code,nickname:'별이'},'student').player;
  Object.assign(student,{x:flask.x,y:flask.y,explorationChances:12,lv4State:{betelgeuseDay:'2026-10-03',priorityUntil:null}});
  Object.assign(teacher,{x:flask.x,y:flask.y});
  const now=Date.parse('2026-10-03T10:00:00+09:00');
  for(let i=0;i<7;i++)explore(room,student,now+i,()=>9); // 기운2 카드 일곱 장
  assert.equal(room.exploration.energy,14);explore(room,student,now+8,()=>7); // 남은 1칸은 1점 카드
  assert.equal(room.exploration.energy,EXPLORATION_GOAL);assert.equal(readExploration(room,teacher,now).festival,true);
  assert.equal(student.lv4State.priorityUntil,now+15*7*86400000);
  assert.deepEqual(readExploration(room,teacher,now).priorityRows,[{nickname:'별이',until:student.lv4State.priorityUntil}]);
  assert.equal(Object.hasOwn(readExploration(room,student,now),'priorityRows'),false);
  assert.deepEqual(readExploration(room,teacher,student.lv4State.priorityUntil).priorityRows,[]);
  assert.throws(()=>explore(room,student,now+9,()=>0),/가득/);
  resetExploration(room,teacher);assert.equal(room.exploration.energy,0);assert.equal(room.exploration.results.length,0);
  assert.equal(readExploration(room,teacher,now).priorityRows[0].nickname,'별이');
  const oldPriority=student.lv4State.priorityUntil;explore(room,student,now+86400000,()=>9);assert.equal(student.lv4State.priorityUntil,oldPriority);
});

test('교사 지급·학생 사용·탐사 결과가 방을 분리하고 재시작 후에도 저장된다',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'exploration-test-')),key='synthetic-exploration-test-key';
  let game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false,teacherManagedAccounts:true}),sockets=[];
  t.after(async()=>{for(const socket of sockets)socket.disconnect();await game.close();await rm(dir,{recursive:true,force:true});});
  let port=(await game.listen()).port;
  const connect=async()=>{const socket=io(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false});sockets.push(socket);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;};
  const call=(socket,event,data={})=>socket.timeout(5000).emitWithAck(event,data);
  const teacher=await connect(),made=await call(teacher,'room:create',{teacherKey:key,studentAccounts:[{nickname:'별이',pin:'1234'}]});assert.equal(made.ok,true,made.error);
  const student=await connect(),entered=await call(student,'room:join',{code:made.room.code,nickname:'별이',pin:'1234'});assert.equal(entered.ok,true,entered.error);
  const room=()=>game.store.rooms.get(made.room.code),player=()=>room().players.get(entered.selfId);
  assert.equal((await call(student,'exploration:explore')).ok,false);
  assert.equal((await call(teacher,'teacher:inventory:give',{playerId:player().id,itemIds:['exploration-ticket']})).ok,true);
  assert.equal((await call(student,'item:use',{itemId:'exploration-ticket',targetId:player().id})).ok,true);
  game.store.transact(()=>Object.assign(player(),{x:flask.x,y:flask.y}));
  const read=await call(student,'exploration:read');assert.equal(read.ok,true,read.error);assert.equal(read.chances,1);
  const used=await call(student,'exploration:explore');assert.equal(used.ok,true,used.error);assert.equal(used.results.length,1);
  assert.equal((await call(student,'exploration:clear-results')).ok,false);
  assert.equal((await call(student,'exploration:reset')).ok,false);
  const otherTeacher=await connect(),other=await call(otherTeacher,'room:create',{teacherKey:key,studentAccounts:[{nickname:'달이',pin:'5678'}]});assert.equal(other.ok,true);
  assert.equal(game.store.rooms.get(other.room.code).exploration.energy,0);
  const saved=game.store.records.get(made.room.code);assert.equal(saved.exploration.results.length,1);assert.equal(saved.students[0].explorationChances,0);
});
