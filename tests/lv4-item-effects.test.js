import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEM_USE, SHOP, SHARDS} from '../shared/config.js';
import {LV4_ITEMS} from '../shared/lv4-items.js';
import {blackHolePreview, confirmLv4, lv4ItemsDue, settleLv4Items,
  syncLv4Holdings, useLv4Holding, useLv4Item, validateLv4State} from '../server/lv4-item-effects.js';
import {GameError} from '../server/rooms.js';

const NOW = Date.parse('2026-09-21T03:00:00Z');
const DAY = 86_400_000, WEEK = 7 * DAY;
const card = id => LV4_ITEMS.find(item => item.id === id);
function player(id, level = 4, role = 'student') {
  return {id, nickname: id, role, connected: true, away: false,
    avatar: {level, blackStar: null}, inventory: [], starShards: 20,
    cardMarkers: [], effects: [], abilityState: {markers: [], blocks: []}, lastItemUseAt: 0};
}
function fixture(itemId, quantity = 1) {
  const [actor, b, c, d, e, f, g, h, teacher] = ['a','b','c','d','e','f','g','h','teacher'].map(id => player(id, 4, id === 'teacher' ? 'teacher' : 'student'));
  if (itemId) actor.inventory.push({id: itemId, quantity});
  const room = {players: new Map([actor,b,c,d,e,f,g,h,teacher].map(p => [p.id,p])), planets: new Map()};
  return {room, actor, b, c, d, e, f, g, h, teacher};
}
function use(f, id, data = {}, now = NOW) { return useLv4Item(f.room, f.actor, card(id), data, now); }
function marker(itemId, extra = {}) { return {id:`mark-${itemId}`,itemId,until:NOW+WEEK,fromId:'owner',fromNickname:'owner',at:NOW-1000,fromLevel:4,...extra}; }
function rejectedWithoutMutation(f, fn, pattern) {
  const before = structuredClone(f.room);
  assert.throws(fn, error => { assert.ok(error instanceof GameError); if (pattern) assert.match(error.message, pattern); return true; });
  assert.deepEqual(f.room, before);
}
const planets = (f, ids=['p1','p2','p3']) => ids.forEach(id => f.room.planets.set(id,{id,name:id,warnings:{entries:[]}}));

test('LV4 use rejects lower-level student atomically and catalog contains only public cards', () => {
  assert.equal(LV4_ITEMS.length,7);
  assert.ok(LV4_ITEMS.every(c => c.level===4 && c.mode==='lv4'));
  const f=fixture('nebula-card'); f.actor.avatar.level=3;
  rejectedWithoutMutation(f,()=>use(f,'nebula-card'),/lv보다 높은/);
});

test('solar system requires seven distinct eligible others and writes seven ordered markers', () => {
  const bad=[[],['b','b','c','d','e','f','g'],['a','b','c','d','e','f','g'],['b','c','d','e','f','g','missing']];
  for(const targetIds of bad){const f=fixture('solar-system-card');rejectedWithoutMutation(f,()=>use(f,'solar-system-card',{targetIds}),/대상|서로 다른|친구/);}
  const f=fixture('solar-system-card');
  const result=use(f,'solar-system-card',{targetIds:['b','c','d','e','f','g','h']});
  assert.deepEqual(result.targetIds,['b','c','d','e','f','g','h']);
  for(const [i,p] of [f.b,f.c,f.d,f.e,f.f,f.g,f.h].entries())assert.match(p.cardMarkers[0].note,new RegExp(`${i+1}번째`));
  assert.equal(f.actor.inventory.length,0);
});

test('supercluster grants two selected typed gold cards, stacks duplicates, and rolls back over-capacity', () => {
  const f=fixture('supercluster-card');
  use(f,'supercluster-card',{cardIds:['polaris','polaris']});
  assert.deepEqual(f.actor.inventory,[{id:'gold-polaris-card',quantity:2}]);
  const full=fixture('supercluster-card');full.actor.inventory.push({id:'gold-polaris-card',quantity:SHOP.maxStack});
  rejectedWithoutMutation(full,()=>use(full,'supercluster-card',{cardIds:['polaris','comet']}),/가방 공간/);
  for(const cardIds of [['alien-card','polaris'],['polaris'],['polaris','polaris','polaris']]){
    const bad=fixture('supercluster-card');rejectedWithoutMutation(bad,()=>use(bad,'supercluster-card',{cardIds}),/별 카드 2장/);
  }
});

test('eclipse taxes each eligible use once and keeps its seven-day marker; higher, self, and immune targets reject', () => {
  const f=fixture('nebula-card');f.actor.cardMarkers=[marker('total-eclipse-card',{fromId:'b',fromLevel:4})];f.actor.starShards=2;
  f.b.inventory=[{id:'nebula-card',quantity:1}];f.b.cardMarkers=[marker('total-eclipse-card',{fromId:'a',fromLevel:4})];
  f.room.players.get('b').lastItemUseAt=0;
  const target=player('tax-owner');f.room.players.set(target.id,target);
  f.actor.cardMarkers=[marker('total-eclipse-card',{fromId:target.id,fromLevel:4})];
  use(f,'nebula-card'); assert.equal(f.actor.starShards,1);assert.equal(target.starShards,21);
  assert.equal(f.actor.cardMarkers[0].until,NOW+WEEK);
  const self=fixture('total-eclipse-card');
  rejectedWithoutMutation(self,()=>use(self,'total-eclipse-card',{targetIds:['a']}),/다른 친구/);
  const higher=fixture('total-eclipse-card');higher.b.avatar.level=5;
  rejectedWithoutMutation(higher,()=>use(higher,'total-eclipse-card',{targetIds:['b']}),/높은/);
  const immune=fixture('total-eclipse-card');immune.b.cardMarkers=[marker('little-moon-card')];
  rejectedWithoutMutation(immune,()=>use(immune,'total-eclipse-card',{targetIds:['b']}),/보호/);
});

test('black hole preview prices warning per target and black star at three, totals days, and rejects atomically', () => {
  const f=fixture('black-hole-card');planets(f);
  f.room.planets.get('p1').warnings.entries=[{active:true,targetId:'b'},{active:true,targetId:'b'}];
  f.room.planets.get('p2').warnings.entries=[{active:true,targetId:'c'}];
  f.b.avatar.blackStar={planetId:'p2'};f.b.starShards=8; f.c.starShards=2;
  const preview=blackHolePreview(f.room,f.actor,['p1','p2','p3'],NOW);
  assert.deepEqual(preview.costs.map(x=>[x.playerId,x.amount]),[['b',5],['c',1]]);
  assert.equal(preview.total,6);assert.equal(preview.durationDays,0.6);
  f.c.starShards=0;
  rejectedWithoutMutation(f,()=>use(f,'black-hole-card',{planetIds:['p1','p2','p3']}),/부족/);
  f.c.starShards=2;assert.equal(blackHolePreview(f.room,f.actor,['p1','p2','p3'],NOW).total,6);
  const success=fixture('black-hole-card');planets(success);success.room.planets.get('p1').warnings.entries=[{active:true,targetId:'b'}];
  success.b.avatar.blackStar={planetId:'p2'};success.b.starShards=10;
  use(success,'black-hole-card',{planetIds:['p1','p2','p3']});
  assert.equal(success.b.starShards,6);assert.equal(success.b.avatar.blackStar,null);
  assert.equal(success.actor.cardMarkers[0].until,NOW+Math.round(4*DAY/10));
});

test('teacher confirmations require teacher, unique references, and queen writing has no extra reward', () => {
  const f=fixture();f.b.inventory=[{id:'alien-queen-card',quantity:1}];
  const data={playerId:'b',action:'queen-writing',reference:'reading-1',markerId:'unused'};
  const before=f.b.starShards;confirmLv4(f.room,f.teacher,data,NOW);assert.equal(f.b.starShards,before+1);
  assert.throws(()=>confirmLv4(f.room,f.teacher,data,NOW),/중복 지급/);assert.equal(f.b.starShards,before+1);
  assert.throws(()=>confirmLv4(f.room,f.b,{...data,reference:'reading-2'},NOW),/선생님만/);
});

test('nebula teacher transfer moves one shard, rejects duplicate and zero-fund transfers', () => {
  const f=fixture();f.b.cardMarkers=[marker('nebula-card')];f.b.starShards=4;f.c.starShards=3;
  const data={playerId:'b',action:'nebula-tax',reference:'square-1',markerId:f.b.cardMarkers[0].id,targetId:'c'};
  confirmLv4(f.room,f.teacher,data,NOW);assert.deepEqual([f.b.starShards,f.c.starShards],[5,2]);
  assert.throws(()=>confirmLv4(f.room,f.teacher,data,NOW),/중복/);
  f.d.cardMarkers=[marker('nebula-card')];f.d.starShards=10;f.e.starShards=0;
  const zero={playerId:'d',action:'nebula-tax',reference:'square-2',markerId:f.d.cardMarkers[0].id,targetId:'e'};
  const before=structuredClone(f.room);assert.throws(()=>confirmLv4(f.room,f.teacher,zero,NOW),/부족/);assert.deepEqual(f.room,before);
});

test('Betelgeuse records three confirmed trips and duration, then rejects a fourth', () => {
  const f=fixture();f.b.cardMarkers=[marker('betelgeuse-card',{remainingUses:3,until:null})];
  for(let i=1;i<=3;i++)confirmLv4(f.room,f.teacher,{playerId:'b',action:'exploration',reference:`trip-${i}`,markerId:f.b.cardMarkers[0].id,steps:i},NOW);
  assert.equal(f.b.lv4State.priorityUntil,NOW+6*WEEK);
  assert.equal(f.b.cardMarkers[0].remainingUses,undefined);assert.equal(f.b.cardMarkers[0].until,NOW+6*WEEK);
  const before=structuredClone(f.room);
  assert.throws(()=>confirmLv4(f.room,f.teacher,{playerId:'b',action:'exploration',reference:'trip-4',markerId:f.b.cardMarkers[0].id,steps:1},NOW),/남은 탐험/);
  assert.deepEqual(f.room,before);
  const invalid=fixture();invalid.b.cardMarkers=[marker('betelgeuse-card',{remainingUses:3,until:null})];
  assert.throws(()=>confirmLv4(invalid.room,invalid.teacher,{playerId:'b',action:'exploration',reference:'bad',markerId:invalid.b.cardMarkers[0].id,steps:100},NOW),/1~99/);
});

test('LV4 state validator defaults new saves and clones valid stacks, claims, receipts, and priority data', () => {
  assert.deepEqual(validateLv4State(),{stacks:0,nextStackAt:null,claimIds:[],receipts:[],priorityUntil:null});
  for(const value of [{stacks:-1,nextStackAt:null,claimIds:[],receipts:[],priorityUntil:null},
    {stacks:0,nextStackAt:-1,claimIds:[],receipts:[],priorityUntil:null},
    {stacks:0,nextStackAt:null,claimIds:['x','x'],receipts:[],priorityUntil:null},
    {stacks:0,nextStackAt:null,claimIds:[],receipts:[{key:'x',at:-1}],priorityUntil:null}])assert.throws(()=>validateLv4State(value),/저장 데이터/);
  const old={stacks:2,nextStackAt:NOW,claimIds:['claim'],receipts:[{key:'x',at:NOW}],priorityUntil:NOW};
  const cloned=validateLv4State(old);cloned.claimIds[0]='changed';cloned.receipts[0].key='changed';assert.deepEqual(old,{stacks:2,nextStackAt:NOW,claimIds:['claim'],receipts:[{key:'x',at:NOW}],priorityUntil:NOW});
});

test('supercluster accrues one stack per seven days independent of card quantity, including offline periods', () => {
  const f=fixture();f.actor.inventory=[{id:'supercluster-card',quantity:4}];
  assert.equal(settleLv4Items(f.room,NOW),true);assert.equal(f.actor.lv4State.nextStackAt,NOW+WEEK);assert.equal(f.actor.lv4State.stacks,0);
  assert.equal(settleLv4Items(f.room,NOW+3*WEEK+DAY),true);assert.equal(f.actor.lv4State.stacks,3);assert.equal(f.actor.lv4State.nextStackAt,NOW+4*WEEK);
  assert.equal(f.actor.starShards,20);assert.equal(f.actor.inventory[0].quantity,4);
  assert.equal(lv4ItemsDue(f.room,NOW+3*WEEK+DAY),false);
  f.actor.inventory=[];assert.equal(syncLv4Holdings(f.actor,NOW+4*WEEK),true);assert.equal(f.actor.lv4State.nextStackAt,null);assert.equal(f.actor.lv4State.stacks,3);
  assert.equal(syncLv4Holdings(f.actor,NOW+10*WEEK),false);assert.equal(f.actor.lv4State.stacks,3);
  f.actor.inventory=[{id:'supercluster-card',quantity:2}];assert.equal(syncLv4Holdings(f.actor,NOW+10*WEEK),true);assert.equal(f.actor.lv4State.nextStackAt,NOW+11*WEEK);
});

test('previous disabled LV4 reward state migrates without invented stacks or losing teacher receipts',()=>{
  const receipts=[{key:'queen-writing::old',at:NOW}];
  assert.deepEqual(validateLv4State({rewardMode:null,nextRewardAt:null,receipts,priorityUntil:NOW}),
    {stacks:0,nextStackAt:null,claimIds:[],receipts,priorityUntil:NOW});
  assert.equal(validateLv4State({rewardMode:'card',nextRewardAt:NOW+2*WEEK,receipts:[],priorityUntil:null}).nextStackAt,NOW+WEEK);
  assert.throws(()=>validateLv4State({rewardMode:'invalid',nextRewardAt:null,receipts:[],priorityUntil:null}),/저장 데이터/);
});

test('holding exchange spends one stack for four shards or two for one star card without consuming supercluster', () => {
  const shards=fixture();shards.actor.inventory=[{id:'supercluster-card',quantity:3}];shards.actor.lv4State={stacks:2,nextStackAt:NOW+WEEK,claimIds:[],receipts:[],priorityUntil:null};
  const result=useLv4Holding(shards.room,shards.actor,{reward:'shards',requestId:'shards-1'},NOW);
  assert.equal(shards.actor.starShards,24);assert.equal(shards.actor.lv4State.stacks,1);assert.equal(shards.actor.inventory[0].quantity,3);assert.equal(result.holding.stacks,1);
  const cards=fixture();cards.actor.inventory=[{id:'supercluster-card',quantity:2}];cards.actor.lv4State={stacks:2,nextStackAt:NOW+WEEK,claimIds:[],receipts:[],priorityUntil:null};
  useLv4Holding(cards.room,cards.actor,{reward:'card',requestId:'card-1'},NOW);
  assert.deepEqual(cards.actor.inventory,[{id:'supercluster-card',quantity:2},{id:'star-card',quantity:1}]);assert.equal(cards.actor.lv4State.stacks,0);assert.equal(cards.actor.lv4State.nextStackAt,NOW+WEEK);
});

test('holding retries preserve request id semantics and successful requests cannot consume twice', () => {
  const f=fixture();f.actor.inventory=[{id:'supercluster-card',quantity:1}];f.actor.lv4State={stacks:1,nextStackAt:NOW+WEEK,claimIds:[],receipts:[],priorityUntil:null};
  const noStack=structuredClone(f.room);
  assert.throws(()=>useLv4Holding(f.room,f.actor,{reward:'card',requestId:'retry-1'},NOW),/보유 스택이 부족/);assert.deepEqual(f.room,noStack);
  f.actor.lv4State.stacks=3;
  useLv4Holding(f.room,f.actor,{reward:'card',requestId:'retry-1'},NOW);
  assert.deepEqual(f.actor.lv4State.claimIds,['retry-1']);
  const after=structuredClone(f.room);
  const duplicate=useLv4Holding(f.room,f.actor,{reward:'card',requestId:'retry-1'},NOW);assert.match(duplicate.message,/이미 처리/);assert.deepEqual(f.room,after);
  useLv4Holding(f.room,f.actor,{reward:'shards',requestId:'retry-2'},NOW);
  assert.deepEqual(f.actor.lv4State.claimIds,['retry-1','retry-2']);
});

test('holding rejects invalid rewards, insufficient stacks, wallet and inventory caps atomically', () => {
  const f=fixture();f.actor.inventory=[{id:'supercluster-card',quantity:1}];f.actor.lv4State={stacks:1,nextStackAt:NOW+WEEK,claimIds:[],receipts:[],priorityUntil:null};
  for(const data of [{reward:'coins',requestId:'bad'}, {reward:'shards',requestId:''}, {reward:'card',requestId:'few'}])rejectedWithoutMutation(f,()=>useLv4Holding(f.room,f.actor,data,NOW));
  f.actor.starShards=SHARDS.max;rejectedWithoutMutation(f,()=>useLv4Holding(f.room,f.actor,{reward:'shards',requestId:'wallet'},NOW),/가득/);
  f.actor.inventory.push({id:'star-card',quantity:SHOP.maxStack});f.actor.lv4State.stacks=2;
  rejectedWithoutMutation(f,()=>useLv4Holding(f.room,f.actor,{reward:'card',requestId:'bag'},NOW),/가방 공간/);
});

test('holding requires an eligible level-four connected owner and rolls back blocked attempts', () => {
  const cases=[f=>{f.actor.avatar.level=3;},f=>{f.actor.avatar.blackStar={planetId:'p1'};},f=>{f.actor.connected=false;},f=>{f.actor.away=true;},f=>{f.actor.cardMarkers=[marker('total-eclipse-card')];}];
  for(const change of cases){const f=fixture();f.actor.inventory=[{id:'supercluster-card',quantity:1}];f.actor.lv4State={stacks:1,nextStackAt:NOW+WEEK,claimIds:[],receipts:[],priorityUntil:null};change(f);rejectedWithoutMutation(f,()=>useLv4Holding(f.room,f.actor,{reward:'shards',requestId:'ineligible'},NOW));}
  const absent=fixture();absent.actor.lv4State={stacks:1,nextStackAt:NOW+WEEK,claimIds:[],receipts:[],priorityUntil:null};rejectedWithoutMutation(absent,()=>useLv4Holding(absent.room,absent.actor,{reward:'shards',requestId:'no-card'},NOW));
});

 test('LV4 adds an effect beyond 50 existing records without discarding them',()=>{
   const f=fixture('total-eclipse-card');
   f.b.cardMarkers=Array.from({length:75},(_,i)=>marker('alien-card',{id:'old-'+i,until:null}));
   use(f,'total-eclipse-card',{targetIds:['b']});
   assert.equal(f.b.cardMarkers.length,76);
   assert.equal(f.b.cardMarkers.filter(m=>m.id.startsWith('old-')).length,75);
   assert.equal(f.actor.inventory.length,0);
 });
