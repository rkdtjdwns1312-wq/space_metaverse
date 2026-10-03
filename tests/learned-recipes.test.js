import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {SHOP,STREET,STREET_ID,createAvatar,itemOf} from '../shared/config.js';
import {recipeItemId} from '../shared/recipe-items.js';
import {validateLearnedRecipeIds,useRecipeItem} from '../server/learned-recipes.js';
import {attemptCraft} from '../server/crafting.js';
import {addRecipeDrop,collectEnergyDrop,energyDropViews} from '../server/energy-drops.js';
import {damageMonster} from '../server/monsters.js';
import {toRecord,fromRecord} from '../server/persistent-rooms.js';
import {adjustTeacherInventory} from '../server/teacher-inventory.js';

const recipes=[
  {output:{id:'android-card',quantity:1},ingredients:[{id:'space-food-card',quantity:1},{id:'space-robot-card',quantity:1}]},
  {output:{id:'supernova-alpha-card',quantity:1},ingredients:[{id:'android-card',quantity:1}]},
  {output:{id:'supernova-beta-card',quantity:1},ingredients:[{id:'moon-card',quantity:1}]}
];
const RID=recipeItemId('android-card'),NOW=Date.now(),KEY='learned-recipes-private-test';
const call=(socket,event,data={})=>socket.timeout(4000).emitWithAck(event,data);
const ok=result=>{assert.ok(result.ok,result.error);return result;};
const makePlayer=id=>({id,nickname:id,role:'student',connected:true,away:false,mapId:'star-origin-2',x:100,y:100,
  avatar:{...createAvatar(),level:3},inventory:[],starShards:20,cosmicEnergy:0,lastItemUseAt:0});
const makeRoom=(players=[makePlayer('a'),makePlayer('b')])=>({players:new Map(players.map(p=>[p.id,p])),planets:new Map(),
  recipeDropOutputIds:recipes.map(r=>r.output.id)});
const monster=(typeId='star-scorpion')=>({id:'test-monster',typeId,mapId:'star-origin-2',x:100,y:100,
  hp:40,maxHp:40,attackers:new Map(),contributors:new Map(),attackOrder:0,mapExitCount:0,nextAttackAt:0});
const spawn=(room,owner='a',now=NOW)=>addRecipeDrop(room,monster(),new Map([[owner,40]]),now,()=>0);

async function fixture(t,{persistent=true}={}){
  const dir=persistent?fs.mkdtempSync(path.join(os.tmpdir(),'learned-recipes-')):null;
  const sockets=[];let game,url,closed=true,now=NOW;
  const start=async()=>{game=createClassroomServer({teacherKey:KEY,dataDir:dir,studentHours:false,
    teacherManagedAccounts:false,unattended:false,clock:()=>now,craftingRecipes:recipes});
    const address=await game.listen();url='http://127.0.0.1:'+address.port;closed=false;};
  t.after(async()=>{sockets.forEach(s=>s.disconnect());if(!closed)await game.close();
    if(dir){assert(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));assert(path.basename(dir).startsWith('learned-recipes-'));fs.rmSync(dir,{recursive:true,force:true});}});
  await start();
  const connect=async()=>{const s=io(url,{transports:['websocket'],reconnection:false,forceNew:true});sockets.push(s);
    await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;};
  let teacher=await connect(),student=await connect(),other=await connect();
  const created=ok(await call(teacher,'room:create',{teacherKey:KEY,title:'개인 조합법 검사',allowedNames:['하나','둘']})),code=created.room.code;
  const a=ok(await call(student,'room:join',{code,nickname:'하나',pin:'1234'}));
  const b=ok(await call(other,'room:join',{code,nickname:'둘',pin:'1234'}));
  const f={get game(){return game;},get room(){return game.store.rooms.get(code);},get p(){return f.room.players.get(a.selfId);},
    get q(){return f.room.players.get(b.selfId);},get student(){return student;},get teacher(){return teacher;},get other(){return other;},
    get url(){return url;},get now(){return now;},connect,
    mutate(fn){return persistent?game.store.transact(()=>fn(f.p,f.q)):fn(f.p,f.q);},
    atMachine(p=f.p){const machine=STREET.objects.find(o=>o.kind==='crafting');Object.assign(p,{mapId:STREET_ID,x:machine.x,y:machine.y});},
    async restart(){sockets.forEach(s=>s.disconnect());await game.close();closed=true;await start();
      teacher=await connect();ok(await call(teacher,'room:open',{teacherKey:KEY,code}));
      assert.deepEqual(f.room.recipeDropOutputIds,recipes.map(recipe=>recipe.output.id));
      student=await connect();other=await connect();
      ok(await call(student,'room:join',{code,nickname:'하나',pin:'1234'}));ok(await call(other,'room:join',{code,nickname:'둘',pin:'1234'}));},
    advance(){now+=3000;}
  };
  f.mutate((p,q)=>{p.avatar.level=3;q.avatar.level=3;p.starShards=20;});return f;
}

test('recipe wrapper metadata contains output only and valid learned IDs round-trip without exposing ingredients',()=>{
  const item=itemOf(RID);assert.equal(item.level,2);assert.equal(item.mode,'recipe');assert.equal(item.outputId,'android-card');
  assert.equal(item.forSale,false);assert.equal(item.sellPrice,null);assert.equal(item.ingredients,undefined);
  assert(!JSON.stringify(item).includes('space-food-card'));assert.equal(itemOf('recipe:recipe:android-card'),null);
  assert.equal(itemOf('recipe:space-food-card'),null);assert.equal(itemOf('recipe:missing'),null);
  assert.deepEqual(validateLearnedRecipeIds(),[]);
  const ids=['android-card'];assert.deepEqual(validateLearnedRecipeIds(ids),ids);assert.notEqual(validateLearnedRecipeIds(ids),ids);
  for(const invalid of [null,{},['missing'],['space-food-card'],['android-card','android-card'],[RID],[2]])
    assert.throws(()=>validateLearnedRecipeIds(invalid));
});

test('only successful crafting learns a recipe; mismatch, cap, fee, and forged learned payload do not',()=>{
  const p=makePlayer('a');p.inventory=structuredClone(recipes[0].ingredients);
  assert.equal(attemptCraft(p,[{id:'space-food-card',quantity:1}],{recipes}).success,false);
  assert.equal(p.learnedRecipeIds,undefined);assert.equal(p.inventory.length,2);
  p.starShards=0;assert.equal(attemptCraft(p,recipes[0].ingredients,{recipes}).success,false);assert.equal(p.learnedRecipeIds,undefined);
  p.starShards=20;p.inventory.push({id:'android-card',quantity:99});
  assert.equal(attemptCraft(p,recipes[0].ingredients,{recipes}).success,false);assert.equal(p.learnedRecipeIds,undefined);
  p.inventory=structuredClone(recipes[0].ingredients);assert.equal(attemptCraft(p,recipes[0].ingredients,{recipes}).success,true);
  assert.deepEqual(p.learnedRecipeIds,['android-card']);
  p.inventory.push(...structuredClone(recipes[0].ingredients));attemptCraft(p,recipes[0].ingredients,{recipes});
  assert.deepEqual(p.learnedRecipeIds,['android-card']);
});

test('drop probability has exactly one successful value out of 100; output selection respects monster level without fallback',()=>{
  let hits=0;
  for(let value=0;value<100;value++){
    const room=makeRoom();const drop=addRecipeDrop(room,monster(),new Map([['a',2]]),NOW,(min,max)=>{
      assert.equal(min,0);return max===100?value:0;
    });if(drop){hits++;assert.equal(drop.itemId,RID);}
  }
  assert.equal(hits,1);
  const room=makeRoom();assert.equal(addRecipeDrop(room,monster('star-crab'),new Map([['a',2]]),NOW,()=>{throw Error('no level-one recipe');}),null);
  room.recipeDropOutputIds=['android-card'];assert.equal(addRecipeDrop(room,monster('star-dragon'),new Map([['a',2]]),NOW,()=>0),null);
  room.recipeDropOutputIds=recipes.map(r=>r.output.id);
  for(const index of [0,1]){let rolls=0;const drop=addRecipeDrop(room,monster('star-dragon'),new Map([['a',2]]),NOW,()=>rolls++?index:0);
    assert.equal(drop.itemId,recipeItemId(recipes[index+1].output.id));assert.equal(itemOf(drop.itemId).level,3);}
});

test('recipe eligibility follows the leading contributor party; zero energy does not cancel a recipe',()=>{
  const room=makeRoom(),a=room.players.get('a'),b=room.players.get('b'),m=monster();
  room.parties=new Map([['party',{memberIds:['a','b']}]]);
  let rolls=0;const options={energyRoll:()=>0,recipeRoll:()=>{rolls++;return 0;}};
  damageMonster(room,m,a,25,NOW,options);damageMonster(room,m,b,999,NOW,options);
  assert.equal(m.hp,0);assert.equal(room.energyDrops.size,1);assert.equal(rolls,2);
  const drop=[...room.energyDrops.values()][0];assert.equal(drop.kind,'recipe');assert.deepEqual([...drop.shares],[['a',1],['b',1]]);
  assert.equal(damageMonster(room,m,b,999,NOW,options),null);assert.equal(room.energyDrops.size,1);assert.equal(rolls,2);
  const tie=addRecipeDrop(room,monster(),new Map([['b',10],['a',10]]),NOW,()=>0);assert.deepEqual([...tie.shares],[['a',1],['b',1]]);
  const view=energyDropViews(room,NOW)[0];assert.equal(view.kind,'recipe');assert.equal(view.itemId,RID);assert.equal(view.ingredients,undefined);
});

test('recipe pickup rejects foreign owner, map/distance/dead/expired and stack or sixty-kind capacity without spending the drop',()=>{
  const room=makeRoom(),p=room.players.get('a'),q=room.players.get('b'),drop=spawn(room);
  for(const recipient of [q,{...p}])assert.throws(()=>collectEnergyDrop(room,recipient,drop.id,NOW));
  p.x=200;assert.throws(()=>collectEnergyDrop(room,p,drop.id,NOW));p.x=100;
  p.mapId=STREET_ID;assert.throws(()=>collectEnergyDrop(room,p,drop.id,NOW));p.mapId=drop.mapId;
  p.avatar.blackStar=true;assert.throws(()=>collectEnergyDrop(room,p,drop.id,NOW));p.avatar.blackStar=null;
  p.inventory=[{id:RID,quantity:99}];assert.throws(()=>collectEnergyDrop(room,p,drop.id,NOW));assert.equal(p.inventory[0].quantity,99);
  p.inventory=Array.from({length:SHOP.maxKinds},(_,i)=>({id:'filler-'+i,quantity:1}));assert.equal(SHOP.maxKinds,60);
  assert.throws(()=>collectEnergyDrop(room,p,drop.id,NOW));assert.equal(drop.shares.get('a'),1);
  p.inventory.pop();const result=collectEnergyDrop(room,p,drop.id,NOW);assert.equal(result.kind,'recipe');assert.equal(p.inventory.length,60);
  assert.equal(p.cosmicEnergy,0);assert.equal(p.learnedRecipeIds,undefined);assert.throws(()=>collectEnergyDrop(room,p,drop.id,NOW));
  const expired=spawn(room);assert.throws(()=>collectEnergyDrop(room,p,expired.id,expired.expiresAt));
});

test('recipe item use requires ownership, own target, ordinary item level/status, valid server recipe and keeps duplicates',()=>{
  const room=makeRoom(),p=room.players.get('a');p.inventory=[{id:RID,quantity:2}];
  const input={itemId:RID};
  p.avatar.level=1;assert.throws(()=>useRecipeItem(room,p,input,recipes,NOW),/lv보다/);p.avatar.level=3;
  for(const extra of [{playerId:'b'},{targetId:'b'},{targetIds:['a','b']}])assert.throws(()=>useRecipeItem(room,p,{...input,...extra},recipes,NOW));
  assert.throws(()=>useRecipeItem(room,p,input,[],NOW));
  p.cardMarkers=[{itemId:'little-sun-card',until:NOW+1}];assert.throws(()=>useRecipeItem(room,p,input,recipes,NOW));p.cardMarkers=[];
  p.away=true;assert.throws(()=>useRecipeItem(room,p,input,recipes,NOW));p.away=false;
  assert.equal(useRecipeItem(room,p,input,recipes,NOW).learned,true);assert.equal(p.inventory[0].quantity,1);
  const before=structuredClone(p);const duplicate=useRecipeItem(room,p,input,recipes,NOW);
  assert.equal(duplicate.alreadyLearned,true);assert.deepEqual(p,before);
});

test('student lookup is private; unauthenticated, other-student, forged-role queries cannot read recipes; teacher all-read remains',async t=>{
  const f=await fixture(t),anon=await f.connect();f.mutate(p=>{p.inventory=[{id:'android-card',quantity:1}];});
  assert.deepEqual(ok(await call(f.student,'recipes:learned')).recipes,[]); // ownership is not historical proof
  assert.equal((await call(anon,'recipes:learned')).ok,false);assert.equal((await call(f.teacher,'recipes:learned')).ok,false);
  f.mutate(p=>{p.learnedRecipeIds=['android-card'];});
  for(const data of [{playerId:f.p.id,role:'teacher'},{targetId:f.p.id}])assert.equal((await call(f.other,'recipes:learned',data)).ok,false);
  assert.deepEqual(ok(await call(f.other,'recipes:learned')).recipes,[]);
  assert.deepEqual(ok(await call(f.student,'recipes:learned')).recipes,[recipes[0]]);
  assert.equal((await call(f.student,'crafting:recipes',{level:3,role:'teacher'})).ok,false);
  f.atMachine([...f.room.players.values()].find(p=>p.role==='teacher'));
  assert.deepEqual(ok(await call(f.teacher,'crafting:recipes',{level:3})).recipes,recipes.slice(1));
  const publicState=f.game.store.snapshot(f.room,f.q);
  assert.equal(JSON.stringify(publicState).includes('ingredients'),false);assert.equal(JSON.stringify(publicState).includes('learnedRecipeIds'),false);
  assert.equal((await fetch(f.url+'/data/crafting-recipes.json')).status,404);
});

test('successful socket crafting learns and persists across restart; no legacy migration from purchased or granted holdings',async t=>{
  const f=await fixture(t);f.mutate(p=>{p.inventory=structuredClone(recipes[0].ingredients);});f.atMachine();
  const result=ok(await call(f.student,'crafting:combine',{ingredients:recipes[0].ingredients,learnedRecipeIds:['supernova-alpha-card']}));
  assert.equal(result.success,true);assert.deepEqual(f.p.learnedRecipeIds,['android-card']);
  await f.restart();assert.deepEqual(ok(await call(f.student,'recipes:learned')).recipes,[recipes[0]]);
  const legacy=toRecord(f.room);delete legacy.students.find(p=>p.id===f.p.id).learnedRecipeIds;
  assert.deepEqual(fromRecord(legacy).players.get(f.p.id).learnedRecipeIds,[]);
  for(const invalid of [['missing'],['android-card','android-card'],{}]){
    const bad=structuredClone(legacy);bad.students[0].learnedRecipeIds=invalid;assert.throws(()=>fromRecord(bad));
  }
});

test('F pickup is once-only, item use learns only consumer, and both inventory and knowledge survive restart',async t=>{
  const f=await fixture(t);f.mutate(p=>Object.assign(p,{mapId:'star-origin-2',x:600,y:450}));
  const drop=spawn(f.room,f.p.id,f.now);
  Object.assign(drop,{x:f.p.x,y:f.p.y});
  assert.equal((await call(f.other,'energy:collect',{dropId:drop.id,playerId:f.p.id})).ok,false);
  const results=await Promise.all([call(f.student,'energy:collect',{dropId:drop.id}),call(f.student,'energy:collect',{dropId:drop.id})]);
  assert.equal(results.filter(r=>r.ok).length,1);assert.equal(f.p.inventory.find(i=>i.id===RID).quantity,1);
  await f.restart();assert.equal(f.p.inventory.find(i=>i.id===RID).quantity,1);assert.deepEqual(ok(await call(f.student,'recipes:learned')).recipes,[]);
  assert.equal((await call(f.other,'item:use',{itemId:RID,targetId:f.p.id})).ok,false);
  const learned=ok(await call(f.student,'item:use',{itemId:RID}));assert.equal(learned.learned,true);assert.equal(f.p.inventory.some(i=>i.id===RID),false);
  await f.restart();assert.deepEqual(ok(await call(f.student,'recipes:learned')).recipes,[recipes[0]]);
  assert.deepEqual(ok(await call(f.other,'recipes:learned')).recipes,[]);assert.equal((await call(f.student,'energy:collect',{dropId:drop.id})).ok,false);
  // room:open restored the configured output list before any combat takes place.
  Object.assign(f.p,{mapId:'star-origin-2',x:600,y:450});const afterRestart=monster();
  damageMonster(f.room,afterRestart,f.p,1000,f.now,{energyRoll:()=>0,recipeRoll:()=>0});
  assert.equal([...f.room.energyDrops.values()].filter(d=>d.kind==='recipe'&&d.itemId===RID).length,1);
});

test('disk failure rolls back craft learning, pickup ownership, item consumption and learning atomically',async t=>{
  const f=await fixture(t);
  const failSave=async work=>{const save=f.game.store.files.save.bind(f.game.store.files);f.game.store.files.save=()=>{throw Error('recipe disk failure');};
    try{await work();}finally{f.game.store.files.save=save;}};
  f.mutate(p=>{p.inventory=structuredClone(recipes[0].ingredients);});f.atMachine();
  const before=structuredClone({inventory:f.p.inventory,shards:f.p.starShards,learned:f.p.learnedRecipeIds});
  await failSave(async()=>assert.equal((await call(f.student,'crafting:combine',{ingredients:recipes[0].ingredients})).ok,false));
  assert.deepEqual({inventory:f.p.inventory,shards:f.p.starShards,learned:f.p.learnedRecipeIds},before);
  f.mutate(p=>{p.inventory=[];Object.assign(p,{mapId:'star-origin-2',x:600,y:450});});const drop=spawn(f.room,f.p.id,f.now);
  Object.assign(drop,{x:f.p.x,y:f.p.y});
  await failSave(async()=>assert.equal((await call(f.student,'energy:collect',{dropId:drop.id})).ok,false));
  assert.deepEqual(f.p.inventory,[]);assert.equal(f.room.energyDrops.get(drop.id).shares.get(f.p.id),1);
  ok(await call(f.student,'energy:collect',{dropId:drop.id}));
  await failSave(async()=>assert.equal((await call(f.student,'item:use',{itemId:RID})).ok,false));
  assert.equal(f.p.inventory.find(i=>i.id===RID).quantity,1);assert.equal((f.p.learnedRecipeIds||[]).length,0);
  ok(await call(f.student,'item:use',{itemId:RID}));assert.deepEqual(f.p.learnedRecipeIds,['android-card']);
});

test('sixty-kind inventory does not expand teacher single-grant batch beyond forty',()=>{
  const student=makePlayer('a'),teacher={...makePlayer('t'),role:'teacher'},room=makeRoom([student,teacher]);
  const ids=SHOP.items.filter(i=>i.level>=1&&i.level<=4).slice(0,41).map(i=>i.id);assert.equal(ids.length,41);
  assert.throws(()=>adjustTeacherInventory(room,teacher,{playerId:student.id,itemIds:ids},'give'),/40/);assert.deepEqual(student.inventory,[]);
  adjustTeacherInventory(room,teacher,{playerId:student.id,itemIds:ids.slice(0,40)},'give');assert.equal(student.inventory.length,40);
  adjustTeacherInventory(room,teacher,{playerId:student.id,itemIds:ids.slice(40)},'give');assert.equal(student.inventory.length,41);
});
