import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {MAP,PLAZA_ID,STREET,STREET_ID,SHOP,SHARDS} from '../shared/config.js';
import {MARKET} from '../shared/market.js';
import {activeSupernova,activatedSupernova,lifeAbilityModifiers,lifeAbilityUsage,lifeAbilityDescription} from '../shared/supernova-life.js';
import {abilityForLevel} from '../shared/constellation-abilities.js';
import {syncLv3Holdings,validateLv3State,availableSupernovas,useLv3Item} from '../server/lv3-item-effects.js';
import {freshAbilityState,validateAbilityState,settleItemBlocks} from '../server/constellation-abilities.js';
import {weekStart} from '../server/temple.js';

const ALPHA='supernova-alpha-card',BETA='supernova-beta-card';
const NOW=Date.parse('2026-09-21T03:00:00Z'),WEEK=7*86400000;
const KEY='supernova-life-isolated-test';
const call=(socket,event,data={})=>socket.timeout(6000).emitWithAck(event,data);
const ok=result=>{assert.ok(result.ok,result.error);return result;};
async function fixture(t,{persistent=false}={}) {
  let now=NOW,dice=[],game,url,closed=false;
  const dir=persistent?fs.mkdtempSync(path.join(os.tmpdir(),'supernova-life-')):null,sockets=[];
  const start=async()=>{
    game=createClassroomServer({teacherKey:KEY,dataDir:dir,studentHours:false,teacherManagedAccounts:false,
      unattended:false,clock:()=>now,abilityDie:()=>{assert.ok(dice.length,'explicit test dice required');return dice.shift();},
      craftingRecipes:[{ingredients:[{id:'moon-card',quantity:1}],output:{id:BETA}}]});
    const address=await game.listen();url='http://127.0.0.1:'+address.port;closed=false;
  };
  await start();
  const connect=async()=>{const socket=io(url,{transports:['websocket'],reconnection:false,forceNew:true});sockets.push(socket);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;};
  let teacher=await connect();
  const created=ok(await call(teacher,'room:create',{teacherKey:KEY,title:'초신성 생활 검증',allowedNames:['하나','둘']}));
  const code=created.room.code;
  let student=await connect(),friend=await connect();
  const a=ok(await call(student,'room:join',{code,nickname:'하나',pin:'1234'}));
  const b=ok(await call(friend,'room:join',{code,nickname:'둘',pin:'1234'}));
  t.after(async()=>{sockets.forEach(s=>s.disconnect());if(!closed)await game.close();
    if(dir){assert(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));assert(path.basename(dir).startsWith('supernova-life-'));fs.rmSync(dir,{recursive:true,force:true});}});
  const f={get game(){return game;},get room(){return game.store.rooms.get(code);},get p(){return f.room.players.get(a.selfId);},get other(){return f.room.players.get(b.selfId);},
    get teacher(){return teacher;},get student(){return student;},get friend(){return friend;},get now(){return now;},dir,
    mutate(fn){return persistent?game.store.transact(()=>fn(f.p,f.other)):fn(f.p,f.other);},
    as(id='aquarius',level=3){f.mutate(p=>{Object.assign(p.avatar,{constellationId:id,level,form:'constellation',xp:0});p.abilityState=freshAbilityState();delete p.constellationAbilityState;});},
    rolls(...values){dice=values;},setNow(value){now=value;},
    async give(id,playerId=a.selfId){return ok(await call(teacher,'teacher:inventory:give',{playerId,itemIds:[id]}));},
    async remove(id){return ok(await call(teacher,'teacher:inventory:remove',{playerId:a.selfId,itemId:id}));},
    async status(){return ok(await call(student,'ability:status'));},
    async activate(id=activeSupernova(f.p)){return ok(await call(student,'holding:use',{itemId:id}));},
    atShop(){const shop=STREET.objects.find(o=>o.kind==='shop');f.mutate(p=>Object.assign(p,{mapId:STREET_ID,x:shop.x,y:shop.y}));},
    atPillar(){const pillar=MAP.objects.find(o=>o.id==='pillar-effects');f.mutate(()=>{for(const p of f.room.players.values())Object.assign(p,{mapId:PLAZA_ID,x:pillar.x,y:pillar.y});});return pillar;},
    async restart(){await game.close();closed=true;await start();teacher=await connect();ok(await call(teacher,'room:open',{teacherKey:KEY,code}));
      student=await connect();friend=await connect();ok(await call(student,'room:join',{code,nickname:'하나',pin:'1234'}));ok(await call(friend,'room:join',{code,nickname:'둘',pin:'1234'}));}
  };
  f.as();f.mutate((p,q)=>{p.starShards=300;q.starShards=100;Object.assign(q.avatar,{level:3,form:'constellation',constellationId:'aquarius'});});return f;
}

test('acquisition order detects an increase in an existing stack; removal restores remaining type; legacy week counts once',()=>{
  const p={inventory:[{id:ALPHA,quantity:1}],lv3State:validateLv3State()};
  syncLv3Holdings(p,NOW);p.inventory.push({id:BETA,quantity:1});syncLv3Holdings(p,NOW);
  assert.equal(activeSupernova(p),BETA);
  p.inventory[0].quantity++;syncLv3Holdings(p,NOW);assert.equal(activeSupernova(p),ALPHA);
  const persisted=validateLv3State(JSON.parse(JSON.stringify(p.lv3State)));
  assert.deepEqual(persisted.supernovaOrder,[BETA,ALPHA]);
  p.inventory[0].quantity=0;syncLv3Holdings(p,NOW);assert.equal(activeSupernova(p),BETA);
  assert.equal(syncLv3Holdings(p,NOW),false);
  const legacy=validateAbilityState({usedWeek:weekStart(NOW),pending:null,markers:[],blocks:[]});
  assert.equal(lifeAbilityModifiers(p,NOW).weeklyLimit,1);
  p.holdingState={usedWeeks:{[BETA]:weekStart(NOW)},supernovaActiveId:BETA,queenReadyWeek:null};
  assert.equal(legacy.usedCount,1);assert.equal(lifeAbilityUsage(legacy,weekStart(NOW),lifeAbilityModifiers(p,NOW)).remaining,1);
  assert.throws(()=>validateLv3State({...persisted,supernovaOrder:[ALPHA,ALPHA]}));
  assert.throws(()=>validateLv3State({...persisted,supernovaHoldings:{[ALPHA]:-1}}));
  assert.throws(()=>validateAbilityState({...legacy,usedCount:3}));
});

test('each supernova consumes one card for one star card, with bag/stack/level rejection atomic',async t=>{
  const f=await fixture(t);
  for(const id of [ALPHA,BETA]){await f.give(id);const before=f.p.inventory.find(e=>e.id==='star-card')?.quantity||0;
    ok(await call(f.student,'item:use',{itemId:id}));assert.equal(f.p.inventory.find(e=>e.id===id),undefined);
    assert.equal(f.p.inventory.find(e=>e.id==='star-card').quantity,before+1);f.setNow(f.now+10000);}
  await f.give(BETA);await f.give(ALPHA);ok(await call(f.student,'item:use',{itemId:ALPHA}));assert.equal(activeSupernova(f.p),BETA);
  f.setNow(f.now+10000);await f.give(ALPHA);
  f.mutate(p=>{p.inventory.find(e=>e.id==='star-card').quantity=SHOP.maxStack;});
  const snapshot=JSON.stringify(f.p);assert.equal((await call(f.student,'item:use',{itemId:ALPHA})).ok,false);assert.equal(JSON.stringify(f.p),snapshot);
  // No empty slot is freed when consuming one of two α cards.
  const draft=structuredClone(f.p);draft.connected=true;draft.avatar.level=3;draft.lastItemUseAt=0;
  draft.inventory=[{id:ALPHA,quantity:2},...Array.from({length:SHOP.maxKinds-1},(_,i)=>({id:'filler-'+i,quantity:1}))];
  const room={players:new Map([[draft.id,draft]]),planets:new Map()};const before=structuredClone(room);
  assert.throws(()=>useLv3Item(room,draft,ALPHA,{},f.now),/가방/);assert.deepEqual(room,before);
  f.mutate(p=>{p.avatar.level=2;});assert.equal((await call(f.student,'item:use',{itemId:ALPHA})).ok,false);
});

test('α keeps item benefits but cannot multiply new Aquarius rewards or override the cap',async t=>{
 const f=await fixture(t);await f.give(ALPHA);await f.activate();
 for(const [level,reward] of [[2,1],[3,2],[4,4],[5,6]]){f.as('aquarius',level);f.mutate(p=>p.starShards=0);const r=ok(await call(f.student,'ability:use',{multiplier:99,reward:999}));assert.equal(r.reward,reward);assert.equal(f.p.starShards,reward);assert.equal((await call(f.student,'ability:use')).ok,false);}
 f.as('aquarius',4);f.mutate(p=>p.starShards=SHARDS.max-3);assert.equal((await call(f.student,'ability:use')).ok,false);assert.equal(f.p.constellationAbilityState,undefined);assert.equal((await call(f.teacher,'ability:use')).ok,false);
});

test('β no longer adds weekly constellation uses; holding changes do not refund and Sunday resets',async t=>{
 const f=await fixture(t);await f.give(BETA);await f.activate();ok(await call(f.student,'ability:use'));
 for(const id of [ALPHA,BETA]){await f.give(id);assert.equal((await f.status()).canUse,false);assert.equal((await call(f.student,'ability:use')).ok,false);}
 f.mutate(p=>Object.assign(p.avatar,{constellationId:'capricorn',level:4}));assert.equal((await call(f.student,'ability:use')).ok,false);
 f.setNow(Date.parse('2026-09-26T14:59:59Z'));assert.equal((await f.status()).canUse,false);f.setNow(Date.parse('2026-09-26T15:00:00Z'));f.rolls(1);
 const r=await Promise.all([call(f.student,'ability:use'),call(f.student,'constellation-ability:use')]);assert.equal(r.filter(v=>v.ok).length,1);
});

test('saved legacy craft completes once; current Corvus use has an independent fixed Sunday budget',async t=>{
 const f=await fixture(t);f.as('corvus',3);f.mutate(p=>p.abilityState={...freshAbilityState(),usedWeek:weekStart(NOW),usedCount:1,pending:{mode:'value-item',week:weekStart(NOW),budget:6,maxLevel:2,picks:1,roll:6,selected:[]}});
 const before=structuredClone(f.p.abilityState.pending);assert.equal((await call(f.student,'ability:choose-item',{itemId:ALPHA})).ok,false);assert.deepEqual(f.p.abilityState.pending,before);
 ok(await call(f.student,'ability:choose-item',{itemId:'space-food-card'}));assert.equal(f.p.abilityState.pending,null);assert.equal((await call(f.student,'ability:choose-item',{itemId:'space-food-card'})).ok,false);
});

test('saved α craft quantity/budget remain fixed after inventory and level changes',async t=>{
 const f=await fixture(t);f.as('corvus',2);f.mutate(p=>p.abilityState={...freshAbilityState(),usedWeek:weekStart(NOW),usedCount:1,pending:{mode:'dice-item',week:weekStart(NOW),maxLevel:2,roll:4,quantity:2,multiplier:2}});
 await f.give(BETA);f.mutate(p=>p.inventory.push({id:'galaxy-card',quantity:1}));assert.equal((await call(f.student,'ability:choose-item',{itemId:'galaxy-card'})).ok,false);const r=ok(await call(f.student,'ability:choose-item',{itemId:'space-food-card'}));assert.equal(r.quantity,2);
 f.as('corvus',4);f.mutate(p=>p.abilityState={...freshAbilityState(),usedWeek:weekStart(NOW),usedCount:1,pending:{mode:'value-item',week:weekStart(NOW),budget:24,maxLevel:5,picks:2,roll:6,selected:[],multiplier:2}});
 assert.deepEqual(validateAbilityState(f.p.abilityState),f.p.abilityState);assert.equal((await call(f.student,'ability:choose-item',{itemId:'alien-creature-card'})).ok,false);
});

test('α shop copy adds two without spending pending/discount/balance on stack or bag rejection',async t=>{
  const f=await fixture(t);await f.give(ALPHA);await f.activate();f.as('gemini',3);f.mutate(p=>p.abilityState={...freshAbilityState(),usedWeek:weekStart(NOW),usedCount:1,pending:{mode:'shop-copy',week:weekStart(NOW),maxPrice:4,quantity:2,multiplier:2}});f.atShop();
  f.mutate(p=>p.inventory.push({id:'meteor-fragment-card',quantity:97}));
  const before=structuredClone({bag:f.p.inventory,state:f.p.abilityState,shards:f.p.starShards,lv3:f.p.lv3State});
  assert.equal((await call(f.student,'shop:buy',{itemId:'meteor-fragment-card',quantity:1})).ok,false);
  assert.deepEqual({bag:f.p.inventory,state:f.p.abilityState,shards:f.p.starShards,lv3:f.p.lv3State},before);
  await f.give(BETA);const result=ok(await call(f.student,'shop:buy',{itemId:'space-food-card',quantity:1}));
  assert.equal(result.copiedQuantity,2);assert.equal(f.p.inventory.find(e=>e.id==='space-food-card').quantity,3);assert.equal(f.p.abilityState.pending,null);
  assert.equal(f.p.abilityState.pending,null);
});

test('α cannot scale new Capricorn/Taurus/Libra dice and old Libra retry grants nothing',async t=>{
 const f=await fixture(t);await f.give(ALPHA);await f.activate();
 for(const [id,level,roll,reward] of [['capricorn',3,5,4],['capricorn',4,6,6],['taurus',3,2,-2],['taurus',4,3,9]]){f.as(id,level);f.mutate(p=>p.starShards=100);f.rolls(roll);const r=ok(await call(f.student,'ability:use'));assert.equal(r.reward,reward);assert.equal(f.p.starShards,100+reward);}
 f.as('libra',3);f.mutate(p=>{p.starShards=20;p.abilityState={...freshAbilityState(),usedWeek:weekStart(NOW),usedCount:1,pending:{mode:'dice-retry',week:weekStart(NOW),multiplier:2}};});f.rolls(1,6);await f.give(BETA);
 assert.equal((await call(f.student,'ability:retry')).ok,false);assert.equal(f.p.starShards,20);
 const libra=ok(await call(f.student,'ability:use'));assert.equal(libra.reward,5);assert.equal(f.p.starShards,25);
 assert.equal((await call(f.student,'ability:retry')).ok,false);assert.equal((await call(f.student,'ability:use')).ok,false);
});

test('retired warning abilities cannot start; saved delayed rewards retain cap and exactly-once settlement',async t=>{
 const f=await fixture(t);await f.give(ALPHA);await f.activate();
 for(const id of ['sagittarius','ophiuchus']){f.as(id,2);assert.equal((await call(f.student,'ability:use',{targetId:f.other.id})).ok,false);}
 f.other.abilityState.blocks=[{id:'saved-block',sourceId:'ophiuchus',until:NOW+86400000,fromId:f.p.id,fromNickname:f.p.nickname,reward:2}];const until=NOW+86400000;
 f.other.starShards=SHARDS.max-1;assert.equal(settleItemBlocks(f.other,until),false);f.other.starShards=SHARDS.max-2;assert.equal(settleItemBlocks(f.other,until),true);assert.equal(f.other.starShards,SHARDS.max);assert.equal(settleItemBlocks(f.other,until),false);
});

test('saved manual α XP confirmation preserves multiplier and new Lv2 activation enters teacher queue',async t=>{
 const f=await fixture(t);f.as('libra',2);const marker={id:'saved-xp',constellationId:'libra',level:2,at:NOW,note:'기존 경험치 확인',targetName:'',week:weekStart(NOW),multiplier:2,sourceDescription:lifeAbilityDescription(abilityForLevel('libra',2),2)};
 f.mutate(p=>p.abilityState.markers.push(marker));const pillar=f.atPillar(),input={objectId:pillar.id,targetId:f.p.id,abilityMarkerId:marker.id};
 assert.equal((await call(f.student,'ability:complete',{...input,xpAmount:4})).ok,false);assert.equal((await call(f.teacher,'ability:complete',{...input,xpAmount:1})).ok,false);
 assert.equal((await call(f.student,'ability:use')).ok,true);assert.equal(f.p.abilityState.markers.length,2);
 ok(await call(f.teacher,'ability:complete',{...input,xpAmount:4,multiplier:99}));assert.equal(f.p.avatar.xp,4);assert.equal((await call(f.teacher,'ability:complete',{...input,xpAmount:4})).ok,false);
});

test('latest-only discount is one per week across switching, reacquisition and duplicate stacks',async t=>{
  const f=await fixture(t);await f.give(ALPHA);await f.give(BETA);f.atShop();assert.deepEqual(availableSupernovas(f.p,NOW),[]);await f.activate();assert.deepEqual(availableSupernovas(f.p,NOW),[BETA]);
  const r=ok(await call(f.student,'shop:buy',{itemId:'space-food-card',quantity:5}));assert.equal(r.discounted,1);
  await f.give(ALPHA);assert.equal(activeSupernova(f.p),ALPHA);assert.deepEqual(availableSupernovas(f.p,NOW),[]);
  ok(await call(f.student,'shop:sell',{itemId:ALPHA,quantity:2}));await f.give(ALPHA);assert.deepEqual(availableSupernovas(f.p,NOW),[]);
  f.setNow(NOW+WEEK);assert.deepEqual(availableSupernovas(f.p,f.now),[]);await f.activate();assert.deepEqual(availableSupernovas(f.p,f.now),[ALPHA]);
});

test('teacher grants, trade and crafting update acquisition order; order and weekly activation persist across restart',async t=>{
  const f=await fixture(t,{persistent:true});f.atShop();
  await f.give(ALPHA);await f.give(BETA);
  assert.equal(activeSupernova(f.p),BETA);await f.activate();ok(await call(f.student,'ability:use'));assert.equal((await f.status()).used,true);
  await f.give(ALPHA);assert.equal(activeSupernova(f.p),ALPHA);assert.equal((await f.status()).canUse,false);
  await f.give(BETA);assert.equal(activeSupernova(f.p),BETA);
  await f.give(ALPHA,f.other.id);
  f.mutate((p,q)=>{for(const x of [p,q])Object.assign(x,{mapId:PLAZA_ID,x:MARKET.x,y:MARKET.y});});
  const trade=ok(await call(f.friend,'trade:propose',{targetId:f.p.id}));ok(await call(f.student,'trade:respond',{tradeId:trade.tradeId,accept:true}));
  const offer=ok(await call(f.friend,'trade:offer',{tradeId:trade.tradeId,revision:0,offer:{shards:0,energy:0,items:[{id:ALPHA,quantity:1}]}}));
  ok(await call(f.friend,'trade:confirm',{tradeId:trade.tradeId,revision:offer.revision}));ok(await call(f.student,'trade:confirm',{tradeId:trade.tradeId,revision:offer.revision}));
  assert.equal(activeSupernova(f.p),ALPHA);
  await f.give('moon-card');const station=STREET.objects.find(o=>o.kind==='crafting');
  f.mutate(p=>Object.assign(p,{mapId:STREET_ID,x:station.x,y:station.y}));
  const crafted=ok(await call(f.student,'crafting:combine',{ingredients:[{id:'moon-card',quantity:1}]}));assert(crafted.success);assert.equal(activeSupernova(f.p),BETA);
  const order=[...f.p.lv3State.supernovaOrder];await f.restart();
  assert.deepEqual(f.p.lv3State.supernovaOrder,order);assert.equal(activeSupernova(f.p),BETA);assert.equal((await f.status()).used,true);
  assert.equal((await call(f.student,'ability:use')).ok,false);await f.restart();assert.equal((await f.status()).used,true);assert.equal((await f.status()).canUse,false);
});

test('disk failures roll back α reward, consumption, pending state and acquisition tracking together',async t=>{
  const f=await fixture(t,{persistent:true});await f.give(ALPHA);await f.activate();const before=structuredClone({inventory:f.p.inventory,lv3:f.p.lv3State,ability:f.p.abilityState,shards:f.p.starShards});
  const save=f.game.store.files.save.bind(f.game.store.files);f.game.store.files.save=()=>{throw Error('supernova test disk failure');};
  try {assert.equal((await call(f.student,'ability:use')).ok,false);assert.equal((await call(f.student,'item:use',{itemId:ALPHA})).ok,false);
    assert.equal((await call(f.teacher,'teacher:inventory:give',{playerId:f.p.id,itemIds:[BETA]})).ok,false);
  }finally{f.game.store.files.save=save;}
  assert.deepEqual({inventory:f.p.inventory,lv3:f.p.lv3State,ability:f.p.abilityState,shards:f.p.starShards},before);
  ok(await call(f.student,'ability:use'));assert.equal(f.p.starShards,before.shards+2);
});
