import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCozyActivities,actCozy,cozyView} from '../server/cozy-activities.js';
import {cozyPreset,COZY_SEEDS,cozyRewardUnit} from '../shared/cozy-activities.js';
const now=Date.parse('2026-10-29T14:59:59Z');
const player=()=>({role:'student',avatar:{level:2},cosmicEnergy:0});
const act=(p,kind,action,data={},time=now)=>actCozy(p,{kind,action,...data},time);
test('cozy schema legacy default, complete bounded validation and independent readonly view',()=>{
 const p=player(),blank=validateCozyActivities();assert.equal(cozyView(p,'pet',now).state.day,'2026-10-29');assert.equal(p.cozyActivities,undefined);
 assert.deepEqual(validateCozyActivities(blank),blank);
 const cases=[null,{}, {...blank,pet:{...blank.pet,careCount:-1}}, {...blank,pet:{...blank.pet,species:'fake'}}, {...blank,pet:{...blank.pet,day:'2026-02-30'}},
 {...blank,room:{...blank.room,layout:[{id:'bed',x:6,y:0,rotation:0,palette:0}]}}, {...blank,garden:{...blank.garden,pots:[null]}},
 {...blank,garden:{...blank.garden,collection:{...blank.garden.collection,stardaisy:Infinity}}}];
 for(const c of cases)assert.throws(()=>validateCozyActivities(c));
});
test('pet adoption, distinct daily care, milestones, name sanitization, rollover and no reset rewards',()=>{
 const p=player();act(p,'pet','adopt',{species:'moon',name:'<달>\u0000별'});assert.equal(p.cozyActivities.pet.name,'달별');
 assert.throws(()=>act(p,'pet','adopt',{species:'cloud'}));assert.throws(()=>act(p,'pet','accessory',{accessory:'halo'}));
 for(let d=0;d<6;d++)for(const care of ['feed','pet','play']){const result=act(p,'pet','care',{care},now+d*86400000);assert(result.amount>0);assert.equal(act(p,'pet','care',{care},now+d*86400000).amount,0);}
 const view=cozyView(p,'pet',now+5*86400000);assert.equal(view.state.stage,3);assert.deepEqual(view.state.album,[3,9,18]);
 act(p,'pet','accessory',{accessory:'halo'},now+5*86400000);assert.equal(p.cozyActivities.pet.accessory,'halo');
 assert.deepEqual(p.cozyActivities.garden.collection,validateCozyActivities().garden.collection);assert.equal(p.cozyActivities.room.rewarded,false);
});
test('room rejects overlaps, duplicates, bounds, palette and rotation; preset never rewards; save quota survives preset',()=>{
 const p=player();assert.equal(act(p,'room','preset',{theme:'cloud'}).amount,0);const l=cozyPreset('cloud');
 for(const invalid of [[...l,l[0]],[{...l[0],x:-1}],[{...l[0],rotation:4}],[{...l[0],palette:4}],[{...l[0]},{...l[1],x:l[0].x,y:l[0].y}]])assert.throws(()=>act(p,'room','save',{theme:'moon',layout:invalid}));
 assert.equal(act(p,'room','save',{theme:'moon',layout:l.slice(0,2)}).amount,0);assert(act(p,'room','save',{theme:'moon',layout:l}).amount>0);
 act(p,'room','preset',{theme:'study'});assert.equal(act(p,'room','save',{theme:'study',layout:l}).amount,0);
 assert(act(p,'room','save',{theme:'study',layout:l},now+1000).amount>0);
});
test('garden server timestamps, water reduction, ready boundary, collection after daily cap and offline growth',()=>{
 const p=player(),time=now+1000;let total=0;
 for(let i=0;i<4;i++){const start=time+i*300000;act(p,'garden','plant',{pot:0,seed:'stardaisy',plantedAt:0,readyAt:0},start);
  assert.equal(p.cozyActivities.garden.pots[0].plantedAt,start);assert.throws(()=>act(p,'garden','harvest',{pot:0},start));
  act(p,'garden','water',{pot:0},start);assert.throws(()=>act(p,'garden','water',{pot:0},start));
  assert.throws(()=>act(p,'garden','harvest',{pot:0},start+239999));assert.equal(cozyView(p,'garden',start+240000).state.pots[0].ready,true);
  const result=act(p,'garden','harvest',{pot:0},start+240000);if(i<3)assert(result.amount>0);else assert.equal(result.amount,0);total+=result.amount;
 }
 assert.equal(p.cosmicEnergy,total);assert.equal(p.cozyActivities.garden.collection.stardaisy,4);assert.equal(p.cozyActivities.garden.harvestsToday,3);
 assert.throws(()=>act(p,'garden','plant',{pot:3,seed:'stardaisy'},time));assert.throws(()=>act(p,'garden','plant',{pot:0,seed:'fake'},time));
 for(const seed of COZY_SEEDS){const q=player();act(q,'garden','plant',{pot:2,seed:seed.id},time);assert.equal(cozyView(q,'garden',time+seed.minutes*60000-1).state.pots[2].ready,false);assert(act(q,'garden','harvest',{pot:2},time+seed.minutes*60000).amount>0);}
});
test('teacher/master preview is free, no energy, and overflow rejects entire mutation',()=>{
 for(const p of [{...player(),role:'teacher'},{...player(),accountKind:'master'}]){act(p,'pet','adopt',{species:'cloud'});assert.equal(act(p,'pet','care',{care:'feed'}).amount,0);assert.equal(p.cosmicEnergy,0);assert.equal(cozyView(p,'pet',now).preview,true);}
 const p=player();act(p,'pet','adopt',{species:'flower'});p.cosmicEnergy=Number.MAX_SAFE_INTEGER;const before=structuredClone(p);
 assert.throws(()=>act(p,'pet','care',{care:'feed'}));assert.deepEqual(p,before);
});
test('actual avatar levels scale each independent quota; caller level and level changes never reopen claimed rewards',()=>{
 for(const [level,unit] of [[1,10],[2,30],[3,100],[4,250],[5,400]]){
  assert.equal(cozyRewardUnit(level),unit);const p=player();p.avatar.level=level;const time=now+1000;
  act(p,'pet','adopt',{species:'moon'},time);for(const care of ['feed','pet','play'])assert.equal(act(p,'pet','care',{care,level:5,amount:9999},time).amount,unit);
  assert.equal(act(p,'room','save',{theme:'moon',layout:cozyPreset()},time).amount,unit*3);
  for(let pot=0;pot<3;pot++){act(p,'garden','plant',{pot,seed:'stardaisy'},time);assert.equal(act(p,'garden','harvest',{pot},time+300000).amount,unit);}
  assert.equal(p.cosmicEnergy,unit*9);p.avatar.level=5;assert.equal(act(p,'pet','care',{care:'feed'},time+300000).amount,0);assert.equal(act(p,'room','save',{theme:'cloud',layout:cozyPreset()},time+300000).amount,0);
 }
 for(const level of [0,6,2.5,'5',null])assert.equal(cozyRewardUnit(level),0);
});
