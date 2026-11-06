import test from 'node:test';
import assert from 'node:assert/strict';
import {SHOP,itemOf} from '../shared/config.js';
import {TRUTH_CONVERGENCE_RECIPE as recipe} from '../shared/crafting.js';
import {equipmentBonus,equipmentStatText} from '../shared/equipment.js';
import {attackPowerOf,defensePowerOf} from '../shared/combat.js';
import {vitalsOf} from '../shared/vitals.js';
import {characterAbilities} from '../shared/character-skills.js';
import {transformationCooldownMs} from '../shared/transformation.js';
import {skillDamageFactor} from '../shared/skill-damage.js';
import {attemptCraft} from '../server/crafting.js';
import {availableCraftingRecipes} from '../server/crafting-recipes.js';
import {learnedRecipesView,validateLearnedRecipeIds} from '../server/learned-recipes.js';
import {equip,unequip,buyEquipment} from '../server/equipment.js';
import {ensureVitals} from '../server/vitals.js';
import {castGemini} from '../server/gemini-skills.js';
import {monstersOf} from '../server/monsters.js';
import {teacherResourcesCatalog,teacherInventoryView} from '../server/teacher-inventory.js';

const id='truth-convergence',gem='truth-gem';
const player=()=>({id:'s',role:'student',connected:true,mapId:'star-origin-1',x:500,y:450,facing:{x:1,y:0},avatar:{level:5,constellationId:'gemini'},inventory:[{id:gem,quantity:2}],equipmentSlots:[null,null,null],starShards:0,cosmicEnergy:60000});
const cooldown=p=>Number(characterAbilities(p)[1].description.match(/쿨타임: (?:종료 후 )?([\d.]+)초/)[1])*1000;

test('truth material explains the exact public recipe; no private file, prior learning, or shards are needed',()=>{
 const p=player(),recipes=availableCraftingRecipes([]);
 assert.equal(itemOf(gem).name,'진리를 담은 보석');assert.match(itemOf(gem).special,/1개.*30,000개.*진리의 결집체/);
 assert.equal(itemOf(gem).forSale,false);assert.equal(itemOf(gem).usable,false);
 assert.deepEqual(learnedRecipesView(p,recipes),[]);
 for(let n=1;n<=2;n++){
  assert.equal(attemptCraft(p,recipe.ingredients).success,true);
  assert.equal(p.cosmicEnergy,60000-30000*n);assert.equal(p.starShards,0);
  assert.equal(p.inventory.find(x=>x.id===id).quantity,n);assert.equal(p.inventory.find(x=>x.id===gem)?.quantity||0,2-n);
  assert.deepEqual(validateLearnedRecipeIds(p.learnedRecipeIds),[id]);
 }
 assert.deepEqual(learnedRecipesView(p,recipes),[recipe]);
 assert.equal(availableCraftingRecipes([structuredClone(recipe)]).filter(r=>r.output.id===id).length,1);
});

test('failed crafting preserves material, currencies, inventory and learning; full material slot can be replaced',()=>{
 for(const {error,...changes} of [
  {cosmicEnergy:29999,error:'insufficient-energy'},
  {inventory:[],error:'insufficient-ingredients'},
  {inventory:[{id:gem,quantity:1},{id,quantity:99}],error:'output-stack-full'},
  {inventory:[{id:gem,quantity:2},...Array.from({length:SHOP.maxKinds-1},(_,i)=>({id:'filler-'+i,quantity:1}))],error:'inventory-full'}
 ]){const p=Object.assign(player(),changes),before=structuredClone(p);assert.equal(attemptCraft(p,recipe.ingredients).error,error);assert.deepEqual(p,before);}
 const p=player();p.inventory=[{id:gem,quantity:1},...Array.from({length:SHOP.maxKinds-1},(_,i)=>({id:'filler-'+i,quantity:1}))];
 assert.equal(attemptCraft(p,recipe.ingredients).success,true);assert.equal(p.inventory.length,SHOP.maxKinds);
});

test('necklace is Lv5 craft-only, grants only HP/MP maxima and cannot refill vitals or stack in equipment slots',()=>{
 const p=player();attemptCraft(p,recipe.ingredients);const item=itemOf(id),base=vitalsOf(5,p),atk=attackPowerOf(5,'gemini',p),def=defensePowerOf(5,'gemini',p);
 assert.equal(item.name,'진리의 결집체');assert.equal(item.art,'/assets/equipment/truth-convergence.png');assert.equal(item.level,5);assert.equal(item.craftOnly,true);
 assert.equal(equipmentStatText(item),'최대 체력 +10 · 최대 마나 +10 · 스킬 피해량 +50% · 스킬 재사용 시간 감소 50%');
 assert.throws(()=>buyEquipment(p,id),/상점의 물건/);p.avatar.level=4;assert.throws(()=>equip(p,id,1),/LV5/);p.avatar.level=5;
 const current=ensureVitals(p);current.hp=7;current.mp=8;equip(p,id,1);
 assert.equal(vitalsOf(5,p).hp.max,base.hp.max+10);assert.equal(vitalsOf(5,p).mp.max,base.mp.max+10);
 assert.equal(ensureVitals(p).hp,7);assert.equal(ensureVitals(p).mp,8);assert.equal(attackPowerOf(5,'gemini',p),atk);assert.equal(defensePowerOf(5,'gemini',p),def);
 attemptCraft(p,recipe.ingredients);assert.throws(()=>equip(p,id,2),/같은 장비/);
 unequip(p,1);equip(p,id,1);assert.equal(ensureVitals(p).hp,7);assert.equal(ensureVitals(p).mp,8);
});

test('necklace halves every ordinary E cooldown and stacks existing reductions without altering Q or transformation',()=>{
 for(const constellationId of ['aquarius','cancer','cetus','pisces','cygnus','aries','hercules','libra','corona-borealis','capricorn','leo','ophiuchus','taurus','corvus','gemini','sagittarius']){
  const p=player();p.avatar.constellationId=constellationId;const before=cooldown(p),q=characterAbilities(p)[0],transform=transformationCooldownMs(p);
  p.equipmentSlots=[id,null,null];assert.equal(cooldown(p),Math.round(before*.5),constellationId);assert.deepEqual(characterAbilities(p)[0],q);assert.equal(transformationCooldownMs(p),transform);
  p.equipmentSlots=[id,'moon-earring','meteor-boots'];assert.equal(cooldown(p),Math.round(before*.1),constellationId);assert(cooldown(p)>=0);
 }
});

test('server E snapshots damage and cooldown bonuses while Q retains unboosted attack power',()=>{
 const p=player(),room={players:new Map([[p.id,p]]),planets:new Map()},now=Date.now(),power=attackPowerOf(5,'gemini',p),duration=cooldown(p);
 monstersOf(room,now);p.equipmentSlots=[id,'star-pattern-gloves',null];
 assert.equal(equipmentBonus(p).attack,0);assert.equal(skillDamageFactor(p),1.7);
 const q=castGemini(room,p,now,{basic:true});assert.equal(q.hit.power,power);
 const e=castGemini(room,p,now);assert.equal(e.hit.power,Math.round(power*6*1.7));assert.equal(e.cooldowns[0],now+Math.round(duration*.5));
 p.equipmentSlots=[];assert.throws(()=>castGemini(room,p,now+Math.round(duration*.5)-1),/기다려/);
 assert.equal(castGemini(room,p,now+Math.round(duration*.5)).ready,true);
});

test('teacher resource catalog and recipe wrapper discover the necklace automatically',()=>{
 const p=player(),teacher={id:'t',role:'teacher',connected:true},room={players:new Map([[p.id,p],[teacher.id,teacher]])};
 const catalog=teacherResourcesCatalog(room,teacher).catalog;
 assert.equal(teacherInventoryView(room,teacher,p.id).catalog.find(x=>x.id===id)?.level,5);
 assert.equal(catalog.find(x=>x.id==='recipe:'+id)?.level,5);
 assert.equal(itemOf('recipe:'+id).outputId,id);
});
