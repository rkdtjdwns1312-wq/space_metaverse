import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {io} from 'socket.io-client';
import {SHOP} from '../shared/config.js';
import {recipeItemId} from '../shared/recipe-items.js';
import {teacherInventoryView,adjustTeacherInventory} from '../server/teacher-inventory.js';
import {createClassroomServer} from '../server/app.js';

function fixture(){
  const teacher={id:'teacher',role:'teacher',connected:true},student={id:'student',nickname:'학생',role:'student',connected:false,inventory:[]};
  return {teacher,student,room:{players:new Map([[teacher.id,teacher],[student.id,student]]),recipeDropOutputIds:['galaxy-card','supernova-alpha-card','nebula-card','mini-satellite']}};
}
test('교사만 같은 교실의 미접속 가방 조회·추가·1개 제거, 학생 레벨/재화 무관',()=>{
  const {room,teacher,student}=fixture();student.avatar={level:1};student.starShards=0;
  const view=teacherInventoryView(room,teacher);assert.equal(view.playerId,student.id);assert.equal(view.students[0].connected,false);
  assert.ok(view.catalog.every(i=>i.level>=1&&i.level<=4));
  const recipes=view.catalog.filter(i=>i.mode==='recipe');
  assert.deepEqual(recipes.map(i=>[i.id,i.level]),[['recipe:galaxy-card',2],['recipe:supernova-alpha-card',3],['recipe:nebula-card',4],['recipe:mini-satellite',2]]);
  assert.ok(recipes.every(i=>!('ingredients'in i)&&!('recipe'in i)));
  for(const actor of [student,{...teacher},{...teacher,role:'student'},undefined]){
    assert.throws(()=>teacherInventoryView(room,actor));
    assert.throws(()=>adjustTeacherInventory(room,actor,{playerId:student.id,itemIds:['nebula-card']},'give'));
  }
  const data={playerId:student.id,itemIds:['space-food-card','nebula-card']};
  adjustTeacherInventory(room,teacher,data,'give');adjustTeacherInventory(room,teacher,data,'give');
  adjustTeacherInventory(room,teacher,{playerId:student.id,itemIds:[recipeItemId('nebula-card')]},'give');
  assert.equal(student.inventory.find(i=>i.id===recipeItemId('nebula-card')).quantity,1);
  assert.equal(student.inventory.find(i=>i.id==='space-food-card').quantity,2);assert.equal(student.starShards,0);
  adjustTeacherInventory(room,teacher,{playerId:student.id,itemId:'space-food-card'},'remove');assert.equal(student.inventory.find(i=>i.id==='space-food-card').quantity,1);
  adjustTeacherInventory(room,teacher,{playerId:student.id,itemId:'space-food-card'},'remove');assert.equal(student.inventory.some(i=>i.id==='space-food-card'),false);
  assert.throws(()=>adjustTeacherInventory(room,teacher,{playerId:student.id,itemId:'space-food-card'},'remove'));
  assert.throws(()=>teacherInventoryView(room,teacher,'another-class'));assert.throws(()=>teacherInventoryView(room,teacher,teacher.id));
});
test('여러 아이템 추가는 중복·미등록·상한·가방부족 시 일부 지급 없이 원자적 거절',()=>{
  for(const setup of [
    s=>({itemIds:['space-food-card','unknown']}),
    s=>({itemIds:['space-food-card','space-food-card']}),
    s=>({itemIds:[]}),s=>({itemIds:['space-food-card',null]}),
    s=>{s.inventory=[{id:'galaxy-card',quantity:2}];return {itemIds:['space-food-card','galaxy-card']};},
    s=>{s.inventory=[{id:'space-food-card',quantity:99}];return {itemIds:['nebula-card','space-food-card']};},
    s=>{s.inventory=SHOP.items.filter(i=>i.id!=='nebula-card').slice(0,SHOP.maxKinds).map(i=>({id:i.id,quantity:1}));return {itemIds:['nebula-card']};}
  ]){
    const {room,teacher,student}=fixture(),data=setup(student),before=structuredClone(student.inventory);
    assert.throws(()=>adjustTeacherInventory(room,teacher,{playerId:student.id,...data},'give'));assert.deepEqual(student.inventory,before);
  }
});
test('소켓 권한·교실 격리·저장 실패 복원·오프라인 추가 제거·서버 재시작 보존',async t=>{
  const root=resolve(tmpdir()),dir=mkdtempSync(join(root,'teacher-bag-')),key='teacher-bag-test-key';let game,sockets=[];
  const start=async()=>{game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false,unattended:true});await game.listen();};
  const connect=async()=>{const s=io(`http://127.0.0.1:${game.http.address().port}`,{transports:['websocket'],reconnection:false,autoConnect:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);s.connect();});return s;};
  const call=(s,name,data={})=>s.timeout(5000).emitWithAck(name,data);
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await game?.close();assert.equal(dirname(resolve(dir)),root);rmSync(dir,{recursive:true,force:true});});
  await start();const teacher=await connect(),anon=await connect();
  const made=await call(teacher,'room:create',{teacherKey:key,studentAccounts:[{nickname:'학생',pin:'1234'},{nickname:'오프라인',pin:'1234'}]});assert.ok(made.ok,made.error);
  const code=made.room.code,room=()=>game.store.rooms.get(code);
  const id=[...room().players.values()].find(p=>p.nickname==='오프라인').id,target=()=>room().players.get(id);
  const student=await connect();assert.ok((await call(student,'room:join',{code,nickname:'학생',pin:'1234'})).ok);
  for(const action of ['read','give','remove'])for(const client of [anon,student]){
    const reply=await call(client,'teacher:inventory:'+action,{playerId:id,itemIds:['nebula-card'],itemId:'nebula-card'});assert.equal(reply.ok,false);assert.equal(reply.inventory,undefined);
  }
  const stranger=await connect(),other=await call(stranger,'room:create',{teacherKey:key,studentAccounts:[{nickname:'다른반',pin:'1234'}]});assert.ok(other.ok);
  const foreign=other.room.players.find(p=>p.role==='student').id;
  for(const action of ['read','give','remove'])assert.equal((await call(teacher,'teacher:inventory:'+action,{playerId:foreign,itemIds:['nebula-card'],itemId:'nebula-card'})).ok,false);
  const given=await call(teacher,'teacher:inventory:give',{playerId:id,itemIds:['space-food-card','nebula-card']});assert.ok(given.ok,given.error);assert.equal(given.inventory.length,2);assert.equal(target().connected,false);
  const save=game.store.files.save.bind(game.store.files);game.store.files.save=()=>{throw Error('teacher-inventory test disk failure');};
  try{assert.equal((await call(teacher,'teacher:inventory:remove',{playerId:id,itemId:'nebula-card'})).ok,false);
    assert.equal((await call(teacher,'teacher:inventory:give',{playerId:id,itemIds:['moon-card']})).ok,false);
  }finally{game.store.files.save=save;}
  assert.equal(target().inventory.length,2);assert.equal(target().inventory.find(i=>i.id==='nebula-card').quantity,1);
  assert.ok((await call(teacher,'teacher:inventory:remove',{playerId:id,itemId:'space-food-card'})).ok);
  sockets.forEach(s=>s.disconnect());await game.close();await start();const back=await connect();assert.ok((await call(back,'room:open',{teacherKey:key,code})).ok);
  const restored=await call(back,'teacher:inventory:read',{playerId:id});assert.deepEqual(restored.inventory,[{id:'nebula-card',quantity:1}]);
  const login=await connect();assert.ok((await call(login,'room:join',{code,nickname:'오프라인',pin:'1234'})).ok);
  const updated=new Promise(resolve=>login.once('room:state',resolve));assert.ok((await call(back,'teacher:inventory:give',{playerId:id,itemIds:['little-moon-card']})).ok);
  const state=await updated;assert.ok(state.players.find(p=>p.id===id).inventory.some(i=>i.id==='little-moon-card'));
});
