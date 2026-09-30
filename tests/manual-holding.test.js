import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io} from 'socket.io-client';
import {HOLDING_ITEMS,holdingWeek,validateHoldingState} from '../shared/holding-abilities.js';
import {holdingStatus,useHoldingAbility} from '../server/holding-abilities.js';
import {settleLv2Items,lv2ItemsDue} from '../server/lv2-item-effects.js';
import {settleLv3Items,lv3ItemsDue} from '../server/lv3-item-effects.js';
import {validateLv4State,useLv4Holding,confirmLv4,syncLv4Holdings} from '../server/lv4-item-effects.js';
import {validateCardMarkers} from '../server/item-cards.js';
import {PersistentRoomStore} from '../server/persistent-rooms.js';
import {createClassroomServer} from '../server/app.js';
import {SHARDS,SHOP,MAP,PLAZA_ID} from '../shared/config.js';
const WEEK=7*86400000,MONDAY=Date.parse('2026-10-05T00:00:00+09:00');
function fixture(id='galaxy-card',quantity=1){
  const p={id:'a',nickname:'검사',role:'student',connected:true,away:false,avatar:{level:4},inventory:[{id,quantity}],starShards:10,cardMarkers:[],effects:[],abilityState:{markers:[],blocks:[]},lastItemUseAt:0,
    lv2State:{galaxyNextAt:[MONDAY-5*WEEK]},lv3State:{clusterNextAt:[MONDAY-5*WEEK],supernovaUsed:{}},lv4State:validateLv4State()};
  const teacher={...structuredClone(p),id:'teacher',role:'teacher',inventory:[]};
  return {p,teacher,room:{players:new Map([[p.id,p],[teacher.id,teacher]]),planets:new Map(),itemLog:[],starCards:[]}};
}
const use=(f,data={},now=MONDAY-1000,die)=>useHoldingAbility(f.room,f.p,{itemId:f.p.inventory[0].id,...data},now,die);
const reject=(f,fn,pattern)=>{const before=structuredClone(f.room);assert.throws(fn,pattern);assert.deepEqual(f.room,before);};
test('315: all nine holding cards and strict persistent format',()=>{
  assert.equal(HOLDING_ITEMS.length,9);assert.equal(new Set(HOLDING_ITEMS.map(x=>x.id)).size,9);
  const value=validateHoldingState();value.usedWeeks['galaxy-card']='2026-09-28';assert.deepEqual(validateHoldingState(value),value);
  for(const bad of [null,[],{}, {...value,usedWeeks:{unknown:'2026-09-28'}},{...value,usedWeeks:{'galaxy-card':'2026-09-29'}},{...value,usedWeeks:{'galaxy-card':'2026-02-30'}},{...value,queenReadyWeek:1},{...value,supernovaActiveId:'supernova-alpha-card'},{...value,extra:true}])assert.throws(()=>validateHoldingState(bad),/저장 데이터/);
});
for(const id of ['galaxy-card','galaxy-cluster-card']){
  test(`${id}: no automatic payout or legacy catchup, online/offline`,()=>{
    const f=fixture(id,2);f.p.connected=false;const old=structuredClone(f.p);
    for(const now of [MONDAY-1,MONDAY,MONDAY+8*WEEK]){assert.equal(lv2ItemsDue(f.room,now),false);assert.equal(lv3ItemsDue(f.room,now),false);settleLv2Items(f.room,now);settleLv3Items(f.room,now);}
    assert.deepEqual(f.p,old);
  });
  test(`${id}: current quantity capped at two, no consumption; reacquisition and Monday reset`,()=>{
    const f=fixture(id,3),n=id==='galaxy-card'?2:4;use(f);assert.equal(f.p.starShards,10+n);assert.equal(f.p.inventory[0].quantity,3);
    assert.equal(holdingStatus(f.room,f.p,id,MONDAY-1).items[0].used,true);reject(f,()=>use(f,{},MONDAY-1),/이번 주/);
    f.p.inventory=[];f.p.inventory=[{id,quantity:1}];reject(f,()=>use(f,{},MONDAY-1),/이번 주/);use(f,{},MONDAY);assert.equal(f.p.starShards,10+n+n/2);
  });
  test(`${id}: full wallet fails atomically and freeing capacity cannot auto-pay`,()=>{
    const f=fixture(id,2);f.p.starShards=SHARDS.max;reject(f,()=>use(f),/가득/);f.p.starShards=0;
    settleLv2Items(f.room,MONDAY);settleLv3Items(f.room,MONDAY);assert.equal(f.p.starShards,0);use(f);assert.ok(f.p.starShards>0);
  });
}
test('315: forged actor/target, ownership, level and status restrictions are atomic',()=>{
  for(const setup of [f=>f.p.connected=false,f=>f.p.away=true,f=>f.p.avatar.level=1,f=>f.p.inventory=[],f=>f.p.cardMarkers=[{itemId:'little-sun-card',until:MONDAY+WEEK}],f=>f.p.abilityState.blocks=[{until:MONDAY+WEEK}]]){
    const f=fixture();setup(f);reject(f,()=>useHoldingAbility(f.room,f.p,{itemId:'galaxy-card'},MONDAY));
  }
  const f=fixture();reject(f,()=>useHoldingAbility(f.room,{...f.p},{itemId:'galaxy-card'},MONDAY));
  reject(f,()=>use(f,{playerId:'teacher'}),/다른 학생/);reject(f,()=>use(f,{targetId:'teacher'}),/나에게만/);reject(f,()=>use(f,{itemId:'moon-card'}),/보유능력이 없는/);
});
test('315: supernova family activates once, latest held kind has real activeUntil',()=>{
  const f=fixture('supernova-alpha-card');f.p.inventory.push({id:'supernova-beta-card',quantity:1});
  use(f);assert.equal(f.p.holdingState.supernovaActiveId,'supernova-alpha-card');
  assert.equal(holdingStatus(f.room,f.p,'supernova-alpha-card',MONDAY-1).items[0].activeUntil,null);
  assert.equal(holdingStatus(f.room,f.p,'supernova-beta-card',MONDAY-1).items[0].activeUntil,MONDAY);
  reject(f,()=>use(f,{itemId:'supernova-beta-card'}),/이번 주/);assert.equal(holdingStatus(f.room,f.p,'supernova-beta-card',MONDAY).items[0].activeUntil,null);
});
test('315: princess uses server die, cannot reroll a pending draw, and caps star-card reward',()=>{
  const f=fixture('rabbit-princess-card'),r=use(f,{roll:6},MONDAY-1,()=>2);assert.equal(r.roll,2);assert.ok(r.draw);assert.ok(f.p.rabbitDraw);
  reject(f,()=>use(f,{},MONDAY,()=>6),/뽑기/);
  const g=fixture('rabbit-princess-card');g.p.inventory.push({id:'star-card',quantity:SHOP.maxStack});reject(g,()=>use(g,{},MONDAY,()=>6),/가방/);
  g.p.inventory.pop();use(g,{},MONDAY,()=>6);assert.equal(g.p.inventory.find(i=>i.id==='star-card').quantity,1);
});
test('315: comet removes one own warning only; invalid department does not consume quota',()=>{
  const f=fixture('comet-card');f.room.planets.set('p',{id:'p',name:'검사부서',warnings:{threshold:3,entries:[{id:'1',targetId:'a',active:true},{id:'2',targetId:'a',active:true},{id:'3',targetId:'teacher',active:true}]}});
  reject(f,()=>use(f,{planetId:'missing'}),/내 경고/);use(f,{planetId:'p'});assert.equal(f.room.planets.get('p').warnings.entries.filter(e=>e.active).length,2);assert.equal(f.room.planets.get('p').warnings.entries[2].active,true);
});
test('315: alien creates a persistent teacher-review marker until Monday; queen requires confirmation then manual payout',()=>{
  const alien=fixture('alien-creature-card');use(alien);assert.equal(holdingStatus(alien.room,alien.p,'alien-creature-card',MONDAY-1).items[0].activeUntil,MONDAY);
  assert.equal(alien.p.cardMarkers[0].until,MONDAY);assert.equal(validateCardMarkers(alien.p.cardMarkers)[0].holdingAbility,true);
  assert.equal(holdingStatus(alien.room,alien.p,'alien-creature-card',MONDAY).items[0].activeUntil,null);
  const f=fixture('alien-queen-card');reject(f,()=>use(f),/선생님/);reject(f,()=>confirmLv4(f.room,f.p,{action:'queen-writing',playerId:'a',reference:'1'},MONDAY-1),/선생님/);
  confirmLv4(f.room,f.teacher,{action:'queen-writing',playerId:'a',reference:'1'},MONDAY-1);assert.equal(f.p.starShards,10);
  use(f);assert.equal(f.p.starShards,11);reject(f,()=>use(f),/이번 주/);reject(f,()=>use(f,{},MONDAY),/선생님/);
});
test('315: supercluster weekly Monday stacking, legacy normalization, 1/2-stack choice and old-route quota',()=>{
  const f=fixture('supercluster-card');syncLv4Holdings(f.p,MONDAY-1);assert.equal(f.p.lv4State.nextStackAt,MONDAY);syncLv4Holdings(f.p,MONDAY);assert.equal(f.p.lv4State.stacks,1);
  f.p.lv4State.nextStackAt=MONDAY-2*WEEK+86400000;syncLv4Holdings(f.p,MONDAY);assert.equal(f.p.lv4State.stacks,4);syncLv4Holdings(f.p,MONDAY);assert.equal(f.p.lv4State.stacks,4);
  use(f,{reward:'card'},MONDAY);assert.equal(f.p.lv4State.stacks,2);assert.equal(f.p.inventory.find(i=>i.id==='star-card').quantity,1);
  reject(f,()=>useLv4Holding(f.room,f.p,{reward:'shards',requestId:'bypass'},MONDAY),/이번 주/);use(f,{reward:'shards'},MONDAY+WEEK);assert.equal(f.p.starShards,14);
});
test('315 socket: no automatic catchup; disk rollback, reacquisition, restart, Monday reset, strict saved validation',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'manual-holding-')),key='temporary-holding-key',sockets=[];let game,now=MONDAY-1000;
  const start=async()=>{game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false,clock:()=>now,craftingRecipes:[]});return await game.listen();};
  const connect=async port=>{const s=io('http://127.0.0.1:'+port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise(r=>s.once('connect',r));return s;};
  const call=(s,event,data={})=>s.timeout(3000).emitWithAck(event,data);
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await game?.close();rmSync(dir,{recursive:true,force:true});});
  const address=await start(),teacher=await connect(address.port),stranger=await connect(address.port);assert.equal((await call(stranger,'holding:use',{itemId:'galaxy-card'})).ok,false);
  const created=await call(teacher,'room:create',{teacherKey:key,studentAccounts:[{nickname:'검사',pin:'1234'}]});assert.ok(created.ok);
  const code=created.room.code,id=[...game.store.rooms.get(code).players.values()].find(p=>p.role==='student').id,player=()=>game.store.rooms.get(code).players.get(id);
  game.store.transact(()=>Object.assign(player(),{avatar:{...player().avatar,level:4},lv2State:{galaxyNextAt:[MONDAY-9*WEEK]},lv3State:{clusterNextAt:[MONDAY-9*WEEK],supernovaUsed:{}}}));
  for(let i=0;i<2;i++)assert.ok((await call(teacher,'teacher:inventory:give',{playerId:id,itemIds:['galaxy-card','galaxy-cluster-card']})).ok);
  await new Promise(r=>setTimeout(r,1100));assert.equal(player().starShards,0);
  const student=await connect(address.port);assert.ok((await call(student,'room:join',{code,nickname:'검사',pin:'1234'})).ok);
  assert.equal((await call(student,'holding:use',{itemId:'galaxy-card',playerId:'other'})).ok,false);
  const save=game.store.files.save.bind(game.store.files);game.store.files.save=()=>{throw Error('simulated disk full');};
  const beforeRead=structuredClone(player());assert.ok((await call(student,'holding:status',{itemId:'galaxy-card'})).ok);assert.deepEqual(player(),beforeRead);
  assert.equal((await call(student,'holding:use',{itemId:'galaxy-card'})).ok,false);game.store.files.save=save;
  assert.equal(player().starShards,0);assert.equal(player().holdingState?.usedWeeks?.['galaxy-card'],undefined);
  assert.ok((await call(student,'holding:use',{itemId:'galaxy-card',quantity:99,now:0})).ok);assert.equal(player().starShards,2);
  assert.ok((await call(student,'holding:use',{itemId:'galaxy-cluster-card'})).ok);assert.equal(player().starShards,6);
  for(let i=0;i<2;i++)assert.ok((await call(teacher,'teacher:inventory:remove',{playerId:id,itemId:'galaxy-card'})).ok);
  assert.ok((await call(teacher,'teacher:inventory:give',{playerId:id,itemIds:['galaxy-card']})).ok);assert.equal((await call(student,'holding:use',{itemId:'galaxy-card'})).ok,false);
  assert.ok((await call(teacher,'teacher:inventory:give',{playerId:id,itemIds:['alien-creature-card']})).ok);
  assert.ok((await call(student,'holding:use',{itemId:'alien-creature-card'})).ok);
  const pillar=MAP.objects.find(o=>o.kind==='pillar'&&o.service==='effects');
  for(const p of game.store.rooms.get(code).players.values())Object.assign(p,{mapId:PLAZA_ID,x:pillar.x,y:pillar.y});
  const rows=await call(teacher,'temple:read',{objectId:pillar.id}),row=rows.rows.find(r=>r.itemId==='alien-creature-card');assert.match(row.note,/마감 기한 1일 연장/);assert.equal(row.remainingUses,1);
  assert.equal((await call(student,'item:complete',{objectId:pillar.id,targetId:id,markerId:row.markerId})).ok,false);
  assert.ok((await call(teacher,'item:complete',{objectId:pillar.id,targetId:id,markerId:row.markerId})).ok);
  assert.equal((await call(student,'holding:status',{itemId:'alien-creature-card'})).items[0].activeUntil,null);
  await game.close();const reopened=await start(),teacher2=await connect(reopened.port);assert.ok((await call(teacher2,'room:open',{teacherKey:key,code})).ok);
  const student2=await connect(reopened.port);assert.ok((await call(student2,'room:join',{code,nickname:'검사',pin:'1234'})).ok);
  assert.equal((await call(student2,'holding:status',{itemId:'galaxy-card'})).items[0].used,true);assert.equal((await call(student2,'holding:use',{itemId:'galaxy-card'})).ok,false);assert.equal(player().starShards,6);
  now=MONDAY;await new Promise(r=>setTimeout(r,1100));assert.equal(player().starShards,6);assert.ok((await call(student2,'holding:use',{itemId:'galaxy-card'})).ok);assert.equal(player().starShards,7);
  const record=JSON.parse(readFileSync(join(dir,code+'.json'),'utf8'));assert.equal(record.students.find(p=>p.id===id).holdingState.usedWeeks['galaxy-card'],holdingWeek(MONDAY));
  await game.close();game=null;record.students.find(p=>p.id===id).holdingState.usedWeeks['galaxy-card']='bad';writeFileSync(join(dir,code+'.json'),JSON.stringify(record));assert.throws(()=>new PersistentRoomStore(dir),/보유능력 저장/);
});
