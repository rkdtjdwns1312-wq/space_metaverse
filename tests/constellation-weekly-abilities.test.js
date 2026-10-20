import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {CONSTELLATIONS} from '../shared/constellations.js';
import {SHARDS,SHOP,VALLEY,VALLEY_ID,PROGRESSION,INTERIOR,interiorIdOf} from '../shared/config.js';
import {constellationWeekStart,weeklyAbilityFor} from '../shared/constellation-weekly-abilities.js';
import {freshConstellationAbilityState,validateConstellationAbilityState,constellationAbilityStatus,useConstellationAbility,chooseConstellationItem,corvusChoices,applyHerculesWeekly,markConstellationChange} from '../server/constellation-weekly-abilities.js';
import {toRecord,fromRecord} from '../server/persistent-rooms.js';
import {addPlanet} from '../server/world.js';
import {departmentSlots} from '../shared/plaza-layout.js';
import {goldItemIdOf} from '../shared/star-cards.js';

const NOW=Date.parse('2026-10-17T14:59:59.999Z'),SUNDAY=NOW+1,WEEK=7*86400000;
const make=(id='aquarius',level=2)=>({id:'p',role:'student',connected:true,away:false,avatar:{constellationId:id,level},starShards:100,inventory:[],constellationAbilityState:freshConstellationAbilityState()});
const recipes=[{ingredients:[{id:'little-sun-card',quantity:2}],output:{id:'asteroid-card'}},{ingredients:[{id:'asteroid-card',quantity:2}],output:{id:'space-station-card'}}];
const as=(f,id,level=2)=>f.mutate(p=>Object.assign(p.avatar,{constellationId:id,level,form:'constellation'}));

test('Friday reminder includes unused debt/cap failures, excludes passive, changed, teacher and used; KST boundaries',()=>{
 const friday=Date.parse('2026-10-15T15:00:00Z'),p=make('taurus',5);
 for(const balance of [0,SHARDS.max]){p.starShards=balance;assert.equal(constellationAbilityStatus(p,friday-1).remindUnused,false);const s=constellationAbilityStatus(p,friday);assert.equal(s.canUse,false);assert.equal(s.remindUnused,true);assert.equal(constellationAbilityStatus(p,NOW).remindUnused,true);assert.equal(constellationAbilityStatus(p,SUNDAY).remindUnused,false);}
 for(const tweak of [q=>q.role='teacher',q=>q.avatar.teacherPreview=true,q=>q.avatar.blackStar={},q=>q.avatar.constellationId='hercules',q=>markConstellationChange(q,friday),q=>useConstellationAbility(q,friday,()=>1)]){const q=make('taurus',5);tweak(q);assert.equal(constellationAbilityStatus(q,friday).remindUnused,false);}
});

test('Hercules preserves quotas through levels, warning deletion and clock rollback, with independent black reward and cap',()=>{
 const p=make('hercules',2);assert.equal(applyHerculesWeekly(p,'warning',NOW).negated,true);assert.equal(p.starShards,100);assert.equal(applyHerculesWeekly(p,'warning',NOW),null);
 p.avatar.level=4;assert.equal(applyHerculesWeekly(p,'warning',NOW).reward,3);assert.equal(applyHerculesWeekly(p,'warning',NOW),null);p.avatar.level=5;
 assert.equal(applyHerculesWeekly(p,'black',NOW).reward,8);assert.equal(applyHerculesWeekly(p,'black',NOW),null);assert.equal(constellationAbilityStatus(p,NOW).used,true);
 assert.equal(applyHerculesWeekly(p,'warning',SUNDAY).reward,4);assert.equal(applyHerculesWeekly(p,'warning',NOW),null);assert.equal(applyHerculesWeekly(p,'black',SUNDAY).reward,8);assert.equal(applyHerculesWeekly(p,'black',NOW),null);
 const full=make('hercules',5);full.starShards=SHARDS.max-2;assert.equal(applyHerculesWeekly(full,'warning',NOW).reward,0);assert.equal(full.starShards,SHARDS.max-2);assert.equal(full.constellationAbilityState.warningCount,1);
 for(const tweak of [q=>q.role='teacher',q=>q.avatar.teacherPreview=true,q=>markConstellationChange(q,NOW)]){const q=make('hercules',5);tweak(q);assert.equal(applyHerculesWeekly(q,'warning',NOW),null);assert.equal(applyHerculesWeekly(q,'black',NOW),null);}
 assert.deepEqual(validateConstellationAbilityState(p.constellationAbilityState),p.constellationAbilityState);
 const prior=make('aquarius');useConstellationAbility(prior,NOW);assert.equal(constellationAbilityStatus(prior,SUNDAY).lastResult,null);prior.avatar.constellationId='hercules';prior.avatar.level=3;applyHerculesWeekly(prior,'warning',SUNDAY);assert.equal(constellationAbilityStatus(prior,SUNDAY).used,true);assert.equal(constellationAbilityStatus(prior,SUNDAY).lastResult,null);
});

test('real evolution and zodiac change paths stamp lock atomically; initial selection and level-up do not',async t=>{
 const f=await readingFixture(t,{abilityDie:()=>6,craftingRecipes:recipes}),star=VALLEY.objects.find(o=>o.id==='evolution-star');
 const atStar=()=>f.mutate(p=>Object.assign(p,{mapId:VALLEY_ID,x:star.x,y:star.y}));
 await f.mutate(p=>{p.avatar.xp=PROGRESSION.nextLevelXp[0];p.starShards=100;});await atStar();
 ok(await call(f.student,'evolution:evolve',{constellationId:'corvus'}));assert.equal(f.p.constellationAbilityState.changedWeek,null);
 ok(await call(f.student,'constellation-ability:use'));await f.mutate(p=>p.avatar.xp=PROGRESSION.nextLevelXp[1]);ok(await call(f.student,'evolution:evolve',{constellationId:'corvus'}));assert.equal(f.p.constellationAbilityState.changedWeek,null);assert.equal(f.p.constellationAbilityState.pending.budget,3);
 const before=structuredClone({avatar:f.p.avatar,state:f.p.constellationAbilityState,shards:f.p.starShards});
 await f.fail(async()=>assert.equal((await call(f.student,'evolution:change',{constellationId:'aquarius'})).ok,false));assert.deepEqual({avatar:f.p.avatar,state:f.p.constellationAbilityState,shards:f.p.starShards},before);
 ok(await call(f.student,'evolution:change',{constellationId:'aquarius'}));const changed=constellationWeekStart(f.now);assert.equal(f.p.constellationAbilityState.changedWeek,changed);
 for(const event of ['ability:use','constellation-ability:use','ability:choose-item','constellation-ability:choose-item'])assert.equal((await call(f.student,event,{itemId:'little-sun-card'})).ok,false);
 await f.restart();assert.equal(ok(await call(f.student,'constellation-ability:status')).blockedByChange,true);f.advance(changed+WEEK-f.now);assert.equal(ok(await call(f.student,'constellation-ability:status')).blockedByChange,false);assert.equal((await call(f.student,'constellation-ability:choose-item',{itemId:'little-sun-card'})).ok,false);
 await f.mutate(p=>{p.inventory.push({id:goldItemIdOf('zodiac'),quantity:1});p.lastItemUseAt=0;});
 const card=ok(await call(f.student,'item:use',{itemId:goldItemIdOf('zodiac')}));const id=f.room.starCards.at(-1).id;assert(card);
 await f.fail(async()=>assert.equal((await call(f.student,'star-card:choose',{id,choice:'constellation',constellationId:'hercules'})).ok,false));assert.equal(f.p.avatar.constellationId,'aquarius');assert.equal(f.p.constellationAbilityState.changedWeek,changed);
 ok(await call(f.student,'star-card:choose',{id,choice:'constellation',constellationId:'hercules'}));assert.equal(f.p.constellationAbilityState.changedWeek,changed+WEEK);assert.equal(applyHerculesWeekly(f.p,'warning',f.now),null);await f.restart();assert.equal(ok(await call(f.student,'constellation-ability:status')).blockedByChange,true);
});

test('warning API negates only newest warning; reward/black transitions save together and audit deletion never refunds quota',async t=>{
 const f=await readingFixture(t);let planetId;
 await f.mutate((p,room)=>{const planet=addPlanet(room,{name:'검사',description:'',...departmentSlots()[0],color:'#c5c9f7',rules:['공평하게'],templateId:'rules'});planetId=planet.id;f.q.avatar.departmentId=planetId;Object.assign(p.avatar,{constellationId:'aries',level:2});p.starShards=100;});
 const actorAt=()=>f.mutate(()=>{const rock=INTERIOR.objects.find(o=>o.kind==='warning-rock');Object.assign(f.q,{mapId:interiorIdOf(planetId),x:rock.x,y:rock.y});});await actorAt();
 const issue=()=>call(f.other,'warning:issue',{planetId,targetId:f.p.id,reason:'검사'});
 const old=ok(await issue());await as(f,'hercules',2);const negated=ok(await issue());assert.equal(negated.ability.negated,true);assert.equal(negated.message,'별자리 능력으로 이번 경고 1회는 무효가 됩니다');assert.equal(negated.count,1);assert.equal(f.room.planets.get(planetId).warnings.entries[0].active,true);assert.equal(f.room.planets.get(planetId).warnings.entries[1].active,false);assert(old);
 await as(f,'hercules',5);const before=structuredClone({state:f.p.constellationAbilityState,avatar:f.p.avatar,shards:f.p.starShards,entries:f.room.planets.get(planetId).warnings.entries});
 await f.fail(async()=>assert.equal((await issue()).ok,false));assert.deepEqual({state:f.p.constellationAbilityState,avatar:f.p.avatar,shards:f.p.starShards,entries:f.room.planets.get(planetId).warnings.entries},before);
 assert.equal(ok(await issue()).ability.reward,4);
 await f.fail(async()=>assert.equal((await issue()).ok,false));assert.equal(f.p.avatar.blackStar,null);assert.equal(f.p.constellationAbilityState.blackWeek,null);
 const black=ok(await issue());assert.equal(black.blackAbility.reward,8);assert.equal(f.p.starShards,112);await f.restart();await actorAt();assert.equal(ok(await call(f.student,'constellation-ability:status')).used,true);
 const active=f.room.planets.get(planetId).warnings.entries.filter(e=>e.active);ok(await call(f.teacher,'warning:teacher:delete',{warningId:active.at(-1).id}));const repeated=ok(await issue());assert.equal(repeated.blackStar,true);assert.equal(repeated.blackAbility,null);assert.equal(repeated.ability,null);assert.equal(f.p.starShards,112);
});

test('Sunday KST epoch, all 16 frames, exact 3 currency tables and forged dice ignored',()=>{
 assert.equal(constellationWeekStart(NOW),Date.parse('2026-10-10T15:00:00Z'));assert.equal(constellationWeekStart(SUNDAY),SUNDAY);
 for(const c of CONSTELLATIONS)assert.equal(weeklyAbilityFor(c.id,2).configured,['aquarius','capricorn','taurus','corvus','gemini','hercules','libra','pisces','sagittarius','cygnus','corona-borealis','aries','cancer'].includes(c.id));
 for(const [level,reward] of [[2,1],[3,2],[4,4],[5,6]]){const p=make('aquarius',level);assert.equal(useConstellationAbility(p,NOW,()=>{throw Error('no die');}).reward,reward);}
 for(const [id,table] of [['capricorn',[[0,1,1,1,1,2],[0,0,2,2,4,4],[2,2,4,4,6,6],[3,3,6,6,9,9]]],['taurus',[[3,-1,3,-1,3,-1],[6,-2,6,-2,6,-2],[9,-3,9,-3,9,-3],[12,-3,12,-3,12,-3]]]]){
  for(let level=2;level<=5;level++)for(let roll=1;roll<=6;roll++){const p=make(id,level),r=useConstellationAbility(p,NOW,()=>roll);assert.equal(r.roll,roll);assert.equal(r.reward,table[level-2][roll-1]);assert.equal(p.starShards,100+r.reward);assert(r.used);assert.throws(()=>useConstellationAbility(p,NOW,()=>6));assert.deepEqual(validateConstellationAbilityState(p.constellationAbilityState),p.constellationAbilityState);}
 }
});

test('common use survives evolution/change, zero reward, Sunday and backwards time; teachers only read',()=>{
 const p=make('capricorn');useConstellationAbility(p,NOW,()=>1);assert.equal(p.starShards,100);
 Object.assign(p.avatar,{level:5,constellationId:'aquarius'});assert.throws(()=>useConstellationAbility(p,NOW));
 assert.equal(constellationAbilityStatus(p,SUNDAY).canUse,true);useConstellationAbility(p,SUNDAY);
 assert.throws(()=>useConstellationAbility(p,NOW));assert.equal(constellationAbilityStatus(p,NOW).nextResetAt,SUNDAY+WEEK);
 for(const level of [1,6])assert.equal(constellationAbilityStatus(make('aquarius',level),NOW).canUse,false);
 const teacher=make('aquarius',5);teacher.role='teacher';teacher.avatar.teacherPreview=true;assert(constellationAbilityStatus(teacher,NOW).configured);assert.equal(constellationAbilityStatus(teacher,NOW).canUse,false);assert.throws(()=>useConstellationAbility(teacher,NOW));
});

test('Taurus checks debt and maximum win before rolling; invalid server dice cannot consume or award',()=>{
 const p=make('taurus',5);let rolled=0;p.starShards=2;
 assert.throws(()=>useConstellationAbility(p,NOW,()=>{rolled++;return 1;}));p.starShards=SHARDS.max-11;
 assert.throws(()=>useConstellationAbility(p,NOW,()=>{rolled++;return 2;}));assert.equal(rolled,0);assert.equal(p.constellationAbilityState.usedWeek,null);
 p.starShards=3;useConstellationAbility(p,NOW,()=>2);assert.equal(p.starShards,0);
 for(const die of [0,7,NaN,1.5,'6']){const q=make('capricorn'),before=structuredClone(q);assert.throws(()=>useConstellationAbility(q,NOW,()=>die));assert.deepEqual(q,before);}
});

test('Corvus recursive value is ingredients plus1, unknown/zero value excludes privileged drops; all level budgets',()=>{
 const choices=corvusChoices(recipes);assert.equal(choices.find(i=>i.id==='asteroid-card').value,3);assert.equal(choices.find(i=>i.id==='space-station-card').value,7);
 for(const id of ['star-card','spirit-king-soul','radiant-star-origin','leoon-claw','exploration-ticket'])assert.equal(choices.some(i=>i.id===id),false);
 for(const [level,budgets] of [[2,[0,1,1,2,2,3]],[3,[1,2,3,4,5,6]],[4,[2,4,6,8,10,12]],[5,[3,6,9,12,15,18]]])for(let roll=1;roll<=6;roll++){
  const p=make('corvus',level),r=useConstellationAbility(p,NOW,()=>roll,recipes);assert.equal(r.lastResult.budget,budgets[roll-1]);assert.equal(r.reward,0);assert(r.used);
  if(!r.lastResult.budget)assert.equal(r.pending,null);else assert(r.choices.every(i=>i.value<=budgets[roll-1]));
  assert.deepEqual(validateConstellationAbilityState(p.constellationAbilityState),p.constellationAbilityState);
 }
});

test('Corvus pending budget stays fixed through level change; cap/bag failure preserves pending; one item only',()=>{
 const p=make('corvus',2);useConstellationAbility(p,NOW,()=>6,recipes);const pending=structuredClone(p.constellationAbilityState);
 Object.assign(p.avatar,{level:5});assert.throws(()=>chooseConstellationItem(p,'space-station-card',NOW));assert.deepEqual(p.constellationAbilityState,pending);
 p.inventory=Array.from({length:SHOP.maxKinds},(_,i)=>({id:'fixture-'+i,quantity:1}));assert.throws(()=>chooseConstellationItem(p,'asteroid-card',NOW));assert.deepEqual(p.constellationAbilityState,pending);
 p.inventory=[{id:'asteroid-card',quantity:99}];assert.throws(()=>chooseConstellationItem(p,'asteroid-card',NOW));assert.deepEqual(p.constellationAbilityState,pending);
 p.inventory=[];const chosen=chooseConstellationItem(p,'asteroid-card',NOW);assert.equal(chosen.lastResult.itemId,'asteroid-card');assert.equal(chosen.pending,null);assert.deepEqual(p.inventory,[{id:'asteroid-card',quantity:1}]);assert.equal(p.starShards,100);assert.throws(()=>chooseConstellationItem(p,'asteroid-card',NOW));
 const q=make('corvus',2);useConstellationAbility(q,NOW,()=>6,recipes);assert.equal(constellationAbilityStatus(q,SUNDAY).pending,null);assert.throws(()=>chooseConstellationItem(q,'asteroid-card',SUNDAY));
});

test('Gemini requires owned affordable item both at use and selection; no dice or original consumption',()=>{
 for(const [level,budget] of [[2,2],[3,4],[4,8],[5,12]]){
  const p=make('gemini',level);assert.throws(()=>useConstellationAbility(p,NOW,()=>{throw Error('no dice');},recipes));assert.equal(p.constellationAbilityState.usedWeek,null);
  p.inventory=[{id:'little-sun-card',quantity:1},{id:'asteroid-card',quantity:1}];
  const r=useConstellationAbility(p,NOW,()=>{throw Error('no dice');},recipes);assert.equal(r.pending.budget,budget);assert.equal(r.pending.mode,'copy');assert.equal(r.roll,null);
  assert.equal(r.choices.some(i=>i.id==='asteroid-card'),budget>=3);p.inventory=[];
  assert.throws(()=>chooseConstellationItem(p,'little-sun-card',NOW));assert(p.constellationAbilityState.pending);
  p.inventory=[{id:'little-sun-card',quantity:1}];Object.assign(p.avatar,{level:5});chooseConstellationItem(p,'little-sun-card',NOW);assert.equal(p.inventory[0].quantity,2);assert.equal(p.starShards,100);
 }
});

test('Libra Lv2 teacher marker, Lv3 difference, and Lv4/Lv5 card outcomes',()=>{
 const p=make('libra',2);p.abilityState={usedWeek:null,usedCount:0,pending:null,markers:[],blocks:[]};
 const xp=useConstellationAbility(p,NOW,()=>{throw Error('no die');});
 assert.equal(xp.reward,0);assert.equal(p.abilityState.markers.length,1);assert.equal(p.abilityState.markers[0].constellationId,'libra');
 assert.deepEqual(validateConstellationAbilityState(p.constellationAbilityState),p.constellationAbilityState);
 for(const [dice,reward] of [[[6,1],5],[[3,3],0]]){
  const q=make('libra',3),seq=[...dice],result=useConstellationAbility(q,NOW,()=>seq.shift());
  assert.equal(result.reward,reward);assert.deepEqual(result.lastResult.rolls,dice);assert.equal(q.starShards,100+reward);
  assert.deepEqual(validateConstellationAbilityState(q.constellationAbilityState),q.constellationAbilityState);
 }
 for(const [level,dice,itemId] of [[4,[1,2,1,4],'silver-draw-card'],[4,[1,2,3,4],'star-card'],[5,[1,2,1],'silver-draw-card'],[5,[1,2,3],'star-card']]){
  const q=make('libra',level),seq=[...dice],result=useConstellationAbility(q,NOW,()=>seq.shift());
  assert.equal(result.lastResult.itemId,itemId);assert.deepEqual(result.lastResult.rolls,dice);
  assert.deepEqual(q.inventory,[{id:itemId,quantity:1}]);assert.equal(q.starShards,100);
  assert.deepEqual(validateConstellationAbilityState(q.constellationAbilityState),q.constellationAbilityState);
  assert.throws(()=>useConstellationAbility(q,NOW));
 }
 assert.equal(weeklyAbilityFor('libra',5).rollCount,3);
});

test('Libra Lv4 silver draw card survives save and opens the existing draw deck',async t=>{
 const dice=[1,2,1,4],f=await readingFixture(t,{abilityDie:()=>dice.shift()});await as(f,'libra',4);
 const used=ok(await call(f.student,'constellation-ability:use'));assert.deepEqual(used.lastResult.rolls,[1,2,1,4]);
 assert.equal(used.lastResult.itemId,'silver-draw-card');assert.equal(f.p.inventory.find(i=>i.id==='silver-draw-card')?.quantity,1);
 await f.restart();const saved=ok(await call(f.student,'constellation-ability:status'));
 assert.equal(saved.lastResult.itemId,'silver-draw-card');
 const draw=ok(await call(f.student,'draw:start',{itemId:'silver-draw-card'}));assert(draw.draw?.id);
 assert.equal(f.p.inventory.some(i=>i.id==='silver-draw-card'),false);
 const result=ok(await call(f.student,'draw:pick',{drawId:draw.draw.id}));assert(result.reward);assert.equal(f.p.rabbitDraw,null);
});

test('Libra card bag capacity and failed save never consume the weekly use',async t=>{
 const full=make('libra',4);full.inventory=Array.from({length:SHOP.maxKinds-1},(_,i)=>({id:`fixture-${i}`,quantity:1}));full.inventory.push({id:'star-card',quantity:1});
 let rolled=0;assert.throws(()=>useConstellationAbility(full,NOW,()=>{rolled++;return 1;}));
 assert.equal(rolled,0);assert.equal(full.constellationAbilityState.usedWeek,null);
 const dice=[1,1,2,3],f=await readingFixture(t,{abilityDie:()=>dice.shift()??1});await as(f,'libra',4);
 const before=structuredClone({ability:f.p.constellationAbilityState,inventory:f.p.inventory});
 await f.fail(async()=>assert.equal((await call(f.student,'constellation-ability:use')).ok,false));
 assert.deepEqual({ability:f.p.constellationAbilityState,inventory:f.p.inventory},before);
 assert.equal(ok(await call(f.student,'constellation-ability:use')).lastResult.itemId,'silver-draw-card');
});

test('persistent API auth, old/new concurrent use, forged roll and private status; restart and new Sunday',async t=>{
 const f=await readingFixture(t,{abilityDie:()=>1,craftingRecipes:recipes});await as(f,'capricorn');
 const stranger=await f.connect();assert.equal((await call(stranger,'constellation-ability:status')).ok,false);assert.equal((await call(stranger,'constellation-ability:use')).ok,false);
 assert.equal(ok(await call(f.teacher,'constellation-ability:status')).canUse,false);assert.equal((await call(f.teacher,'constellation-ability:use')).ok,false);
 const results=await Promise.all([call(f.student,'ability:use',{roll:6,reward:999,level:5}),call(f.student,'constellation-ability:use',{roll:6})]);
 assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>r.ok).roll,1);assert.equal(results.find(r=>r.ok).reward,0);
 assert.equal(f.game.store.snapshot(f.room,f.q).players.find(p=>p.id===f.p.id).constellationAbility,undefined);
 assert.equal(f.game.store.snapshot(f.room,f.p).players.find(p=>p.id===f.p.id).constellationAbility.configured,true);
 await f.reconnect();assert.equal(ok(await call(f.student,'constellation-ability:status')).used,true);await f.restart();assert.equal(ok(await call(f.student,'constellation-ability:status')).lastResult.roll,1);
 await as(f,'aquarius',5);assert.equal((await call(f.student,'ability:use')).ok,false);f.advance(WEEK);assert.equal(ok(await call(f.student,'constellation-ability:use')).reward,6);f.advance(-WEEK);assert.equal((await call(f.student,'constellation-ability:use')).ok,false);
});

test('disk failure restores weekly currency and pending/choice; restart and old choose route cannot duplicate',async t=>{
 const f=await readingFixture(t,{abilityDie:()=>6,craftingRecipes:recipes});await as(f,'aquarius',5);
 const original=structuredClone({state:f.p.constellationAbilityState,shards:f.p.starShards});
 await f.fail(async()=>assert.equal((await call(f.student,'constellation-ability:use')).ok,false));assert.deepEqual({state:f.p.constellationAbilityState,shards:f.p.starShards},original);
 await as(f,'corvus',2);await f.fail(async()=>assert.equal((await call(f.student,'ability:use')).ok,false));assert.equal(f.p.constellationAbilityState.usedWeek,null);
 ok(await call(f.student,'constellation-ability:use'));await f.restart();const before=structuredClone({state:f.p.constellationAbilityState,bag:f.p.inventory});
 await f.fail(async()=>assert.equal((await call(f.student,'constellation-ability:choose-item',{itemId:'asteroid-card'})).ok,false));assert.deepEqual({state:f.p.constellationAbilityState,bag:f.p.inventory},before);
 const r=await Promise.all([call(f.student,'ability:choose-item',{itemId:'asteroid-card',quantity:99}),call(f.student,'constellation-ability:choose-item',{itemId:'asteroid-card'})]);assert.equal(r.filter(v=>v.ok).length,1);assert.equal(f.p.inventory.find(i=>i.id==='asteroid-card').quantity,1);
 await f.restart();assert.equal(ok(await call(f.student,'constellation-ability:status')).lastResult.itemId,'asteroid-card');assert.equal((await call(f.student,'ability:choose-item',{itemId:'asteroid-card'})).ok,false);
});

test('unconfigured legacy initiation is blocked; validators reject malformed stamps/results/pending and migrate missing field',async t=>{
 const f=await readingFixture(t);for(const c of CONSTELLATIONS.filter(c=>!weeklyAbilityFor(c.id,2).configured)){
  await as(f,c.id);assert.equal((await call(f.student,'ability:use')).ok,false);assert.equal((await call(f.student,'constellation-ability:use')).ok,false);assert.equal(f.p.constellationAbilityState.usedWeek,null);
 }
 const record=toRecord(f.room);delete record.students[0].constellationAbilityState;assert.deepEqual(fromRecord(record).players.get(record.students[0].id).constellationAbilityState,freshConstellationAbilityState());
 const p=make();useConstellationAbility(p,NOW);const state=p.constellationAbilityState;
 for(const invalid of [null,[],{...state,usedWeek:state.usedWeek+1},{...state,usedWeek:Infinity},{...state,lastResult:{...state.lastResult,reward:999}},{...state,pending:{week:state.usedWeek,budget:5,choices:[]}}])assert.throws(()=>validateConstellationAbilityState(invalid));
 const q=make('corvus');useConstellationAbility(q,NOW,()=>6,recipes);const duplicate=structuredClone(q.constellationAbilityState);duplicate.pending.choices.push(duplicate.pending.choices[0]);assert.throws(()=>validateConstellationAbilityState(duplicate));
});
