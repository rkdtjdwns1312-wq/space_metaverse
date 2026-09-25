import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {STREET, STREET_ID} from '../shared/config.js';

const teacherKey='crafting-teacher-test-secret';
const recipes=[
  {output:{id:'android-card',quantity:1},ingredients:[{id:'space-food-card',quantity:17}]},
  {output:{id:'space-station-card',quantity:1},ingredients:[{id:'android-card',quantity:2}]}
];

async function fixture(t){
  const game=createClassroomServer({teacherKey,studentHours:false,craftingRecipes:recipes});
  const address=await game.listen(),url=`http://127.0.0.1:${address.port}`,sockets=[];
  t.after(async()=>{for(const socket of sockets)socket.disconnect();await game.close();});
  const connect=async()=>{
    const socket=io(url,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(socket);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
    return socket;
  };
  const call=(socket,event,data={})=>socket.timeout(3000).emitWithAck(event,data);
  return {game,connect,call};
}

async function createTeacher(connect,call){
  const socket=await connect();
  const room=await call(socket,'room:create',{teacherKey,title:'조합 권한 시험',allowedNames:['1','2']});
  assert.equal(room.ok,true);
  return {socket,room};
}

function placeAtMachine(player){
  const machine=STREET.objects.find(object=>object.kind==='crafting');
  Object.assign(player,{mapId:STREET_ID,x:machine.x,y:machine.y,connected:true,away:false});
}

test('교사는 LV2·LV3 조합만 조회하고 LV4는 빈 목록을 받으며 정확한 수량과 무변경을 보장한다',async t=>{
  const {game,connect,call}=await fixture(t),{socket,room:created}=await createTeacher(connect,call);
  const state=game.store.rooms.get(created.room.code),player=[...state.players.values()].find(value=>value.role==='teacher');
  placeAtMachine(player);
  const before={inventory:structuredClone(player.inventory),starShards:player.starShards};

  const lv2=await call(socket,'crafting:recipes',{level:2});
  assert.deepEqual(lv2,{ok:true,level:2,recipes:[recipes[0]]});
  const lv3=await call(socket,'crafting:recipes',{level:3});
  assert.deepEqual(lv3,{ok:true,level:3,recipes:[recipes[1]]});
  assert.deepEqual(await call(socket,'crafting:recipes',{level:4}),{ok:true,level:4,recipes:[]});
  assert.deepEqual(player.inventory,before.inventory);
  assert.equal(player.starShards,before.starShards);
});

test('학생·미로그인 연결과 위조 role은 조합법 조회를 할 수 없다',async t=>{
  const {game,connect,call}=await fixture(t),{room:created}=await createTeacher(connect,call);
  const student=await connect(),joined=await call(student,'room:join',{code:created.room.code,nickname:'1',role:'teacher'});
  assert.equal(joined.ok,true);
  const player=game.store.rooms.get(created.room.code).players.get(joined.selfId);
  placeAtMachine(player);
  for(const data of [{level:2},{level:3},{level:4,role:'teacher'}])
    assert.equal((await call(student,'crafting:recipes',data)).ok,false);
  const anonymous=await connect();
  assert.equal((await call(anonymous,'crafting:recipes',{level:2,role:'teacher'})).ok,false);
  assert.equal((await call(student,'crafting:open')).ok,true);
  assert.equal(JSON.stringify(joined).includes('space-station-card'),false);
  assert.equal(JSON.stringify(joined).includes('android-card'),false);
  assert.equal(JSON.stringify(joined).includes('space-food-card'),false);
});

test('교사의 맵 이탈·기계와 거리 이탈·away·미접속·전투 제한은 조회를 거부한다',async t=>{
  const {game,connect,call}=await fixture(t),{socket,room:created}=await createTeacher(connect,call);
  const player=[...game.store.rooms.get(created.room.code).players.values()].find(value=>value.role==='teacher');
  placeAtMachine(player);
  for(const change of [
    {mapId:'space-plaza'},
    {mapId:STREET_ID,x:STREET.objects.find(object=>object.kind==='shop').x,y:STREET.objects.find(object=>object.kind==='shop').y},
    {mapId:STREET_ID,x:STREET.objects.find(object=>object.kind==='crafting').x,y:STREET.objects.find(object=>object.kind==='crafting').y,away:true},
    {mapId:STREET_ID,x:STREET.objects.find(object=>object.kind==='crafting').x,y:STREET.objects.find(object=>object.kind==='crafting').y,connected:false}
  ]){
    placeAtMachine(player);Object.assign(player,change);
    assert.equal((await call(socket,'crafting:recipes',{level:2})).ok,false);
  }
  placeAtMachine(player);player.avatar.blackStar=true;
  assert.equal((await call(socket,'crafting:recipes',{level:2})).ok,false);
});

test('level은 숫자 2·3·4만 허용한다',async t=>{
  const {game,connect,call}=await fixture(t),{socket,room:created}=await createTeacher(connect,call);
  placeAtMachine([...game.store.rooms.get(created.room.code).players.values()].find(value=>value.role==='teacher'));
  for(const level of ['2',1,5,null,{},0])
    assert.equal((await call(socket,'crafting:recipes',{level})).ok,false,`level=${String(level)}`);
});

test('학생 스냅샷과 crafting:open에는 레시피 내용이 포함되지 않는다',async t=>{
  const {game,connect,call}=await fixture(t),{socket:teacher,room:created}=await createTeacher(connect,call);
  const student=await connect(),joined=await call(student,'room:join',{code:created.room.code,nickname:'1'});
  const player=game.store.rooms.get(created.room.code).players.get(joined.selfId);placeAtMachine(player);
  const opened=await call(student,'crafting:open');
  assert.equal(opened.ok,true);
  assert.deepEqual(Object.keys(opened).sort(),['enabled','fee','ok']);
  const state=game.store.snapshot(game.store.rooms.get(created.room.code),player);
  assert.equal(JSON.stringify(state).includes('space-station-card'),false);
  assert.equal(JSON.stringify(state).includes('android-card'),false);
  assert.equal(JSON.stringify(state).includes('space-food-card'),false);
  assert.equal(JSON.stringify(joined.room).includes('space-food-card'),false);
  const teacherPlayer=[...game.store.rooms.get(created.room.code).players.values()].find(value=>value.role==='teacher');
  placeAtMachine(teacherPlayer);
  assert.equal((await call(teacher,'crafting:recipes',{level:2})).ok,true);
});
