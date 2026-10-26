import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {fromRecord} from '../server/persistent-rooms.js';
import {hasUnlimitedShards,formatCurrency} from '../shared/economy.js';
import {attackPowerOf,defensePowerOf} from '../shared/combat.js';
import {vitalsOf} from '../shared/vitals.js';
import {ensureVitals} from '../server/vitals.js';
import {buyEquipment} from '../server/equipment.js';
import {attemptCraft} from '../server/crafting.js';
import {STAR_CRUMB_RECIPE,PUBLIC_CRAFTING_RECIPES} from '../shared/crafting.js';
import {evolutionInfo,selectTeacherEvolution,changeConstellation} from '../server/evolution.js';
import {VALLEY,VALLEY_ID} from '../shared/config.js';
import {MARKET} from '../shared/market.js';
import {serenaEligible} from '../server/serena-progress.js';
const key='master-account-test-secret';
const call=(socket,name,data={})=>socket.timeout(5000).emitWithAck(name,data);
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'master-accounts-')),sockets=[];let game,url;
  async function start(){game=createClassroomServer({teacherKey:key,dataDir:directory,studentHours:false});const address=await game.listen();url='http://127.0.0.1:'+address.port;}
  async function connect(){const socket=io(url,{transports:['websocket'],reconnection:false});sockets.push(socket);await new Promise((yes,no)=>{socket.once('connect',yes);socket.once('connect_error',no);});return socket;}
  await start();t.after(async()=>{for(const socket of sockets)socket.disconnect();await game.close();await rm(directory,{recursive:true,force:true});});
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:key,title:'마스터 검사',studentAccounts:[{nickname:'학생',pin:'1234'}]});assert.ok(created.ok,created.error);
  const code=created.room.code;
  return {directory,teacher,code,connect,get game(){return game;},get room(){return game.store.rooms.get(code);},async restart(){for(const socket of sockets)socket.disconnect();await game.close();await start();},
    async master(name='마스터',constellationId='leo'){const result=await call(teacher,'master:create',{nickname:name,pin:'2468',constellationId});assert.ok(result.ok,result.error);return game.store.rooms.get(code).players.get(result.playerId);}};
}
test('master is a room-scoped student with LV5 base stats, finite currency and no teacher authority',async t=>{
  const f=await fixture(t),master=await f.master(),socket=await f.connect();
  const joined=await call(socket,'room:join',{code:f.code,nickname:'마스터',pin:'2468',role:'teacher'});assert.ok(joined.ok);
  const me=joined.room.players.find(p=>p.id===joined.selfId);assert.equal(me.role,'student');assert.equal(me.accountKind,'master');assert.equal(me.avatar.level,5);
  assert.deepEqual(me.combat,{attackPower:20,defensePower:5});assert.deepEqual(me.vitals.hp,{current:500,max:500});assert.deepEqual(me.vitals.mp,{current:500,max:500});
  assert.equal(hasUnlimitedShards(master),true);assert.equal(formatCurrency(master,'cosmicEnergy'),'∞ (무제한)');assert.equal(master.starShards,0);assert.equal(master.cosmicEnergy,0);assert.equal(serenaEligible(master),false);
  for(const [name,data] of [['student:create',{nickname:'위조',pin:'1234'}],['master:create',{nickname:'위조',pin:'1234',constellationId:'leo'}],['student:update',{playerId:master.id,nickname:'위조'}],['shards:give',{playerId:'all',amount:100}],['room:studentLink',{}],['crafting:recipes',{level:2}],['admin:list',{}]])assert.equal((await call(socket,name,data)).ok,false,name);
  assert.equal('starShards' in joined.room.players.find(p=>p.nickname==='학생'),false);
  const star=VALLEY.objects.find(o=>o.id==='evolution-star');Object.assign(master,{mapId:VALLEY_ID,x:star.x,y:star.y});
  assert.equal(evolutionInfo(f.room,master).teacherMode,false);assert.equal(evolutionInfo(f.room,master).changeCost,0);
  assert.throws(()=>selectTeacherEvolution(f.room,master,{level:2,constellationId:'leo'}),/선생님/);
  changeConstellation(f.room,master,{constellationId:'gemini'});assert.equal(master.starShards,0);
  assert.equal(attackPowerOf(5,'gemini',master),20);assert.equal(defensePowerOf(5,'gemini',master),5);assert.equal(vitalsOf(5,master).hp.max,500);
});
test('ordinary create/join/update cannot forge a master profile or unlimited funds; capacity stays 35',async t=>{
  const f=await fixture(t);const result=await call(f.teacher,'student:create',{nickname:'보통',pin:'2468',accountKind:'master',role:'teacher',unlimited:true,avatar:{level:5}});assert.ok(result.ok);
  const normal=f.room.players.get(result.playerId);assert.equal(normal.accountKind,undefined);assert.equal(normal.avatar.level,1);assert.equal(hasUnlimitedShards(normal),false);
  await call(f.teacher,'student:update',{playerId:normal.id,nickname:'보통',accountKind:'master'});assert.equal(normal.accountKind,undefined);
  const joined=await call(await f.connect(),'room:join',{code:f.code,nickname:'보통',pin:'2468',accountKind:'master'});assert.ok(joined.ok);assert.equal(joined.room.players.find(p=>p.id===normal.id).accountKind,'student');
  for(let i=3;i<=35;i++)assert.ok((await call(f.teacher,'student:create',{nickname:'학생'+i,pin:'1234'})).ok);
  assert.equal((await call(f.teacher,'master:create',{nickname:'초과',pin:'2468',constellationId:'leo'})).ok,false);
  assert.equal(f.room.allowedNames.size,35);
});
test('master identity, PIN changes, account kind and assets survive restart without PIN/token leakage',async t=>{
  const f=await fixture(t),p=await f.master(),socket=await f.connect();await call(socket,'room:join',{code:f.code,nickname:p.nickname,pin:'2468'});
  ensureVitals(p).hp=123;socket.disconnect();
  const changing=await f.connect(),back=await call(changing,'room:join',{code:f.code,nickname:p.nickname,pin:'2468'});assert.equal(back.room.players.find(value=>value.id===p.id).vitals.hp.current,123);
  const changed=await call(changing,'student:password',{currentPin:'2468',pin:'6789',accountKind:'student'});assert.ok(changed.ok,changed.error);
  await f.restart();const teacher=await f.connect();assert.ok((await call(teacher,'room:open',{teacherKey:key,code:f.code})).ok);
  const restored=await call(await f.connect(),'room:join',{code:f.code,nickname:p.nickname,pin:'6789'});assert.ok(restored.ok);assert.equal(restored.selfId,p.id);assert.equal(restored.room.players.find(value=>value.id===p.id).accountKind,'master');
  const record=JSON.parse(await readFile(join(f.directory,f.code+'.json'),'utf8'));assert.equal(record.students.find(value=>value.id===p.id).accountKind,'master');assert.equal(record.students.find(value=>value.nickname==='학생').accountKind,undefined);
  assert.equal(JSON.stringify(restored).includes('"pin"'),false);record.students[0].accountKind='administrator';assert.throws(()=>fromRecord(record),/올바르지/);
});
test('master buys energy equipment and converts virtual crumbs without granting physical boss ingredients',async t=>{
  const f=await fixture(t),p=await f.master();
  buyEquipment(p,'celestial-crown');assert.equal(p.cosmicEnergy,0);assert.equal(p.inventory[0].id,'celestial-crown');
  const crumbs=attemptCraft(p,STAR_CRUMB_RECIPE.ingredients);assert.equal(crumbs.success,true);assert.equal(p.starShards,0);assert.equal(p.inventory.some(i=>i.id==='star-crumb'),false);
  const boss=PUBLIC_CRAFTING_RECIPES.find(recipe=>recipe!==STAR_CRUMB_RECIPE);assert.ok(boss);
  assert.equal(attemptCraft(p,boss.ingredients).error,'insufficient-ingredients');
  p.inventory=boss.ingredients.map(part=>({...part}));assert.equal(attemptCraft(p,boss.ingredients).success,true);assert.equal(p.cosmicEnergy,0);assert.equal(p.starShards,0);
  p.equipmentSlots=['azure-starblade','silver-shield','crescent-charm'];assert.equal(attackPowerOf(5,'leo',p),21);assert.equal(defensePowerOf(5,'leo',p),6);assert.equal(vitalsOf(5,p).hp.max,505);
});
test('master cannot enter a different classroom using its room-scoped credentials',async t=>{
  const f=await fixture(t);await f.master();const other=await call(await f.connect(),'room:create',{teacherKey:key,title:'다른교실',studentAccounts:[{nickname:'다른학생',pin:'1234'}]});assert.ok(other.ok);
  assert.equal((await call(await f.connect(),'room:join',{code:other.room.code,nickname:'마스터',pin:'2468'})).ok,false);
});
test('master trades bounded currency and virtual crumbs only after both accounts consent',async t=>{
  const f=await fixture(t),master=await f.master(),a=await f.connect(),b=await f.connect();
  await call(a,'room:join',{code:f.code,nickname:'마스터',pin:'2468'});
  const joined=await call(b,'room:join',{code:f.code,nickname:'학생',pin:'1234'}),student=f.room.players.get(joined.selfId);
  for(const p of [master,student])Object.assign(p,{mapId:'space-plaza',x:MARKET.x,y:MARKET.y});
  const proposed=await call(a,'trade:propose',{targetId:student.id});assert.ok(proposed.ok,proposed.error);
  assert.ok((await call(b,'trade:respond',{tradeId:proposed.tradeId,accept:true})).ok);
  const offered=await call(a,'trade:offer',{tradeId:proposed.tradeId,revision:0,offer:{shards:12,energy:345,items:[{id:'star-crumb',quantity:5}]}});assert.ok(offered.ok,offered.error);
  assert.ok((await call(a,'trade:confirm',{tradeId:proposed.tradeId,revision:offered.revision})).ok);
  assert.equal(student.starShards,0);
  const completed=await call(b,'trade:confirm',{tradeId:proposed.tradeId,revision:offered.revision});assert.ok(completed.completed,completed.error);
  assert.equal(master.starShards,0);assert.equal(master.cosmicEnergy,0);assert.deepEqual(master.inventory,[]);
  assert.equal(student.starShards,12);assert.equal(student.cosmicEnergy,345);assert.equal(student.inventory.find(i=>i.id==='star-crumb').quantity,5);
});
test('failed master save rolls back profile, name and account count; invalid type/constellation never grants access',async t=>{
  const f=await fixture(t),before=await readFile(join(f.directory,f.code+'.json'),'utf8');
  assert.equal((await call(f.teacher,'master:create',{nickname:'잘못',pin:'2468',constellationId:'not-a-star'})).ok,false);
  const save=f.game.store.files.save;f.game.store.files.save=()=>{throw new Error('simulated master disk full');};
  try{assert.equal((await call(f.teacher,'master:create',{nickname:'롤백',pin:'2468',constellationId:'leo'})).ok,false);}
  finally{f.game.store.files.save=save;}
  assert.equal(f.room.allowedNames.size,1);assert.equal([...f.room.players.values()].some(p=>p.accountKind==='master'),false);
  assert.equal(await readFile(join(f.directory,f.code+'.json'),'utf8'),before);
});
