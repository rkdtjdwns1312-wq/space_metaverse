import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {monstersOf,strikeMonsters,selectMonsterTarget,moveMonsters,monsterViews} from '../server/monsters.js';
import {STREET,STREET_ID} from '../shared/config.js';
import {MONSTER_TYPES} from '../shared/monsters.js';

const player=id=>({id,role:'student',connected:true,away:false,avatar:{level:3,constellationId:'aquarius'},mapId:'star-origin-2',x:538,y:450,facing:{x:1,y:0},cosmicEnergy:0});
test('실제 누적 피해 최대자가 소유하며 마지막 과잉 피해·중복 공격으로 빼앗지 못한다',()=>{
  const a=player('a'),b=player('b'),room={players:new Map([['a',a],['b',b]])};
  const m=monstersOf(room,0).get('star-scorpion-1');room.monsters=new Map([[m.id,m]]);m.x=600;m.y=450;
  strikeMonsters(room,a,60,0);strikeMonsters(room,b,10,1);strikeMonsters(room,a,20,2);
  assert.equal(m.contributors.get('a'),78);assert.equal(m.hp,13);
  strikeMonsters(room,b,99999,3);
  const drop=[...room.energyDrops.values()][0];assert.deepEqual([...drop.shares.keys()],['a']);
  assert.ok(drop.total>=6&&drop.total<=10);assert.equal(m.hp,0);
  strikeMonsters(room,b,99999,4);assert.equal(room.energyDrops.size,1);
});

test('전회복 시 이전 전투 기여도 제거, 새 싸움 보상 소유권을 오염하지 않는다',()=>{
  const a=player('a'),b=player('b'),room={players:new Map([['a',a],['b',b]])};
  const m=monstersOf(room,0).get('star-scorpion-1');room.monsters=new Map([[m.id,m]]);m.x=600;m.y=450;
  strikeMonsters(room,a,30,0);a.mapId='star-origin-1';selectMonsterTarget(room,m);
  assert.equal(m.hp,100);assert.equal(m.contributors.size,0);
  strikeMonsters(room,b,101,2);assert.deepEqual([...room.energyDrops.values()][0].shares.keys().toArray(),['b']);
});

test('첫 맵은 별게3·물별이2, 서버가 좌우 이동 방향을 전파한다',()=>{
  const room={},list=monsterViews(room).filter(m=>m.mapId==='star-origin-1');
  assert.equal(list.filter(m=>m.typeId==='star-crab').length,3);assert.equal(list.filter(m=>m.typeId==='water-star').length,2);
  assert.ok(list.every(m=>m.hp===50&&m.attackPower===3));
  assert.deepEqual(MONSTER_TYPES.filter(t=>t.level===1&&!t.boss).map(t=>t.name),['Lv1 별게','Lv1 물별이']);
  const m=monstersOf(room).get('star-crab');room.monsters=new Map([[m.id,m]]);
  Object.assign(m,{x:600,y:450,lastMoveAt:0,nextDirectionAt:0,patrolStartedAt:0,patrolPhaseOffset:0});
  moveMonsters(room,50,()=>0);assert.equal(monsterViews(room)[0].facingX,1);assert.equal(monsterViews(room)[0].moving,true);
  moveMonsters(room,4000,()=>.5);assert.equal(monsterViews(room)[0].facingX,-1);
});

test('Q 처치→권한·거리 확인→저장 실패 복구→재시도 한 번 지급→재시작 보존',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'energy-atomic-')),key='energy-atomic-test-key';
  const game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false,teacherManagedAccounts:false,unattended:true});
  const {port}=await game.listen(),sockets=[];
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();fs.rmSync(dir,{recursive:true,force:true});});
  const connect=async()=>{const s=io('http://127.0.0.1:'+port,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;};
  const call=(s,event,data={})=>s.timeout(4000).emitWithAck(event,data);
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:key,allowedNames:['1','2']});assert.ok(created.ok,created.error);
  const student=await connect(),joined=await call(student,'room:join',{code:created.room.code,nickname:'1',pin:'1234'});assert.ok(joined.ok,joined.error);
  const code=created.room.code,id=joined.selfId;
  const current=()=>game.store.rooms.get(code),person=()=>current().players.get(id);
  game.store.transact(()=>{const p=person(),m=monstersOf(current()).get('star-scorpion-1');Object.assign(p,{mapId:m.mapId,x:m.x-62,y:m.y,facing:{x:1,y:0}});p.avatar.level=3;p.avatar.constellationId='aquarius';m.hp=1;});
  const killed=await call(student,'combat:attack');assert.ok(killed.ok,killed.error);
  // 물병 Q는 서버 투사체가 실제 적에게 도착한 뒤 처치와 드랍이 발생합니다.
  for(let i=0;i<40&&![...(current().energyDrops?.values()||[])].some(drop=>drop.kind!=='recipe');i++)await new Promise(r=>setTimeout(r,50));
  assert.equal(monstersOf(current()).get('star-scorpion-1').hp,0);
  // The independent 1% recipe roll may insert a recipe before the energy reward.
  const drop=[...current().energyDrops.values()].find(value=>value.kind!=='recipe'),amount=drop.total;assert.equal(person().cosmicEnergy,0);
  const thief=await connect(),other=await call(thief,'room:join',{code,nickname:'2',pin:'1234'});assert.ok(other.ok,other.error);
  Object.assign(current().players.get(other.selfId),{mapId:drop.mapId,x:drop.x,y:drop.y});
  assert.equal((await call(thief,'energy:collect',{dropId:drop.id,amount:999,playerId:id})).ok,false);
  const p=person();p.x=drop.x+1000;assert.equal((await call(student,'energy:collect',{dropId:drop.id})).ok,false);
  Object.assign(person(),{x:drop.x,y:drop.y});
  const originalSave=game.store.files.save.bind(game.store.files);game.store.files.save=()=>{throw new Error('simulated energy save failure');};
  try{assert.equal((await call(student,'energy:collect',{dropId:drop.id})).ok,false);}finally{game.store.files.save=originalSave;}
  assert.equal(person().cosmicEnergy,0);assert.equal(current().energyDrops.get(drop.id).shares.get(id),amount);
  const collected=await call(student,'energy:collect',{dropId:drop.id,amount:999});assert.ok(collected.ok,collected.error);assert.equal(collected.amount,amount);
  assert.equal(person().cosmicEnergy,amount);assert.equal((await call(student,'energy:collect',{dropId:drop.id})).ok,false);
  const shop=STREET.objects.find(o=>o.kind==='energy-shop');assert.equal((await call(student,'shop:energy:open')).ok,false);
  Object.assign(person(),{mapId:STREET_ID,x:shop.x,y:shop.y});const opened=await call(student,'shop:energy:open');assert.ok(opened.ok);assert.equal(opened.items.filter(item=>!item.craftOnly).length,10);
  assert.equal((await call(student,'shop:energy:buy',{itemId:'celestial-crown'})).ok,false); // LV4 제한
  assert.equal((await call(student,'shop:buy',{itemId:'comet-compass',quantity:1})).ok,false); // 별상점 우회 방지
  const bought=await call(student,'shop:energy:buy',{itemId:'comet-compass'});assert.ok(bought.ok,bought.error);
  assert.equal(bought.cosmicEnergy,amount-4);
  assert.equal((await call(student,'equipment:equip',{itemId:'comet-compass',slot:4})).ok,false);
  const equipped=await call(student,'equipment:equip',{itemId:'comet-compass',slot:1});assert.ok(equipped.ok,equipped.error);
  assert.deepEqual(equipped.equipmentSlots,['comet-compass',null,null]);
  assert.equal((await call(student,'shop:buy',{itemId:'space-food-card',quantity:1})).ok,false);
  sockets.forEach(s=>s.disconnect());await game.close();
  const reopened=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false});
  try{const record=reopened.store.records.get(code).students.find(p=>p.id===id);assert.equal(record.cosmicEnergy,amount-4);assert.equal(record.starShards,0);assert.deepEqual(record.equipmentSlots,['comet-compass',null,null]);}finally{await reopened.close();}
});
