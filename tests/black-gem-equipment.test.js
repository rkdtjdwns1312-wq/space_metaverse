import test from 'node:test';
import assert from 'node:assert/strict';
import {SHOP,itemOf} from '../shared/config.js';
import {PRIMORDIAL_STAR_SIGIL_RECIPE as recipe} from '../shared/crafting.js';
import {equipmentBonus} from '../shared/equipment.js';
import {attackPowerOf,defensePowerOf} from '../shared/combat.js';
import {vitalsOf} from '../shared/vitals.js';
import {attemptCraft} from '../server/crafting.js';
import {availableCraftingRecipes} from '../server/crafting-recipes.js';
import {learnedRecipesView,validateLearnedRecipeIds} from '../server/learned-recipes.js';
import {teacherResourcesCatalog,grantTeacherResources} from '../server/teacher-inventory.js';
import {equip,unequip,buyEquipment} from '../server/equipment.js';

const id=recipe.output.id;
const player=()=>({id:'s',role:'student',connected:true,avatar:{level:5,constellationId:'aquarius'},inventory:[{id:'black-gem',quantity:2}],equipmentSlots:[null,null,null],starShards:0,cosmicEnergy:20000});

test('black gem crafting is available without private recipes and learns once after consuming each material and energy payment',()=>{
  const p=player(),recipes=availableCraftingRecipes([]);
  assert.deepEqual(learnedRecipesView(p,recipes),[]);
  for(let count=1;count<=2;count++){
    assert.equal(attemptCraft(p,recipe.ingredients).success,true);
    assert.equal(p.cosmicEnergy,20000-count*10000);assert.equal(p.starShards,0);
    assert.equal(p.inventory.find(i=>i.id===id).quantity,count);
    assert.equal(p.inventory.find(i=>i.id==='black-gem')?.quantity||0,2-count);
    assert.deepEqual(validateLearnedRecipeIds(p.learnedRecipeIds),[id]);
  }
  assert.deepEqual(learnedRecipesView(p,recipes),[recipe]);
  assert.equal(availableCraftingRecipes([structuredClone(recipe)]).filter(r=>r.output.id===id).length,1);
});

test('black gem crafting preserves all resources on insufficient energy/materials or full inventory/output',()=>{
  const cases=[
    {cosmicEnergy:9999,error:'insufficient-energy'},
    {inventory:[],error:'insufficient-ingredients'},
    {inventory:[{id:'black-gem',quantity:1},{id,quantity:99}],error:'output-stack-full'},
    {inventory:[{id:'black-gem',quantity:2},...Array.from({length:SHOP.maxKinds-1},(_,i)=>({id:'filler-'+i,quantity:1}))],error:'inventory-full'}
  ];
  for(const {error,...changes} of cases){
    const p=Object.assign(player(),changes),before=structuredClone(p);
    assert.equal(attemptCraft(p,recipe.ingredients).error,error);assert.deepEqual(p,before);
  }
});

test('sigil grants defensive Lv5 bonuses only while equipped and cannot be purchased or equipped below Lv5',()=>{
  const p=player();assert.equal(attemptCraft(p,recipe.ingredients).success,true);
  const item=itemOf(id);assert.equal(item.name,'검은별의 인장');assert.equal(item.art,'/assets/equipment/primordial-star-sigil.webp');
  assert.equal(item.craftOnly,true);assert.equal(item.level,5);assert.throws(()=>buyEquipment(p,id),/상점의 물건/);
  const vitals=vitalsOf(5,p),defense=defensePowerOf(5,'aquarius',p),attack=attackPowerOf(5,'aquarius',p);
  assert.equal(equipmentBonus(p).hp,0);
  p.avatar.level=4;assert.throws(()=>equip(p,id,1),/LV5/);p.avatar.level=5;
  equip(p,id,1);
  assert.equal(vitalsOf(5,p).hp.max,vitals.hp.max+60);assert.equal(vitalsOf(5,p).mp.max,vitals.mp.max+40);
  assert.equal(defensePowerOf(5,'aquarius',p),defense+3);assert.equal(attackPowerOf(5,'aquarius',p),attack);
  unequip(p,1);assert.deepEqual(vitalsOf(5,p),vitals);assert.equal(equipmentBonus(p).defense,0);
});

test('teacher resources include the new recipe and metadata automatically',()=>{
  const p=player(),teacher={id:'t',role:'teacher',connected:true},room={players:new Map([[p.id,p],[teacher.id,teacher]])};
  const recipeId='recipe:'+id;
  assert.equal(teacherResourcesCatalog(room,teacher).catalog.find(i=>i.id===recipeId)?.level,5);
  grantTeacherResources(room,teacher,{playerIds:[p.id],items:[{id:recipeId,quantity:1}]});
  assert.equal(p.inventory.find(i=>i.id===recipeId).quantity,1);
  assert.equal(itemOf(recipeId).outputId,id);
});
