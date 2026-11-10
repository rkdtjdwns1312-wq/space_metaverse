import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {SHOP,itemOf} from '../shared/config.js';
import {EQUIPMENT_ITEMS,equipmentOf} from '../shared/equipment.js';
import {MISC_ITEMS} from '../shared/misc-items.js';
import {JOURNEY_ITEMS} from '../shared/journey-items.js';
import {RABBIT_DRAW_CATALOG} from '../server/rabbit-draw.js';
import {loadCraftingRecipes,availableCraftingRecipes} from '../server/crafting-recipes.js';
import {addBossDrops} from '../server/energy-drops.js';
import {teacherInventoryView,teacherResourcesCatalog} from '../server/teacher-inventory.js';
import {freshConstellationAbilityState,useConstellationAbility,chooseConstellationItem,constellationAbilityStatus,validateConstellationAbilityState,corvusChoices} from '../server/constellation-weekly-abilities.js';
import {buyEquipment} from '../server/equipment.js';
const retired=['star-sticker','space-snack','asteroid-helmet','firefly-lamp','rainbow-tail','mini-satellite','starlight-cape','meteor-board'];
const active=id=>{const item=itemOf(id);assert.ok(item,'registered: '+id);assert.equal(retired.includes(id),false,'not retired: '+id);return item;};

test('registered items have unique IDs and existing art, while old inventory IDs remain resolvable',()=>{
 const all=[...SHOP.items,...EQUIPMENT_ITEMS,...MISC_ITEMS,...JOURNEY_ITEMS];assert.equal(new Set(all.map(i=>i.id)).size,all.length);
 for(const item of all){assert.ok(itemOf(item.id),item.id);if(item.art)assert.ok(existsSync(new URL('../client'+item.art,import.meta.url)),item.art);}
 for(const id of retired){assert.ok(itemOf(id));assert.equal(itemOf(id).shopHidden,true);}
 for(const item of EQUIPMENT_ITEMS.filter(i=>i.craftOnly))for(let n=1;n<=9;n++){const enhanced=equipmentOf(item.id+'+'+n);assert.ok(enhanced);assert.ok(itemOf(enhanced.id));assert.ok(existsSync(new URL('../client'+enhanced.art,import.meta.url)));}
});
test('configured crafting, draw, teacher grants and crow choices contain only registered supported outputs',()=>{
 const recipes=availableCraftingRecipes(loadCraftingRecipes());
 for(const recipe of recipes){active(recipe.output.id);for(const part of recipe.ingredients)assert.ok(itemOf(part.id),part.id);}
 for(const reward of RABBIT_DRAW_CATALOG)if(reward.kind==='item')active(reward.itemId);
 const teacher={id:'t',role:'teacher',connected:true},student={id:'s',role:'student',inventory:[]};
 const room={players:new Map([['t',teacher],['s',student]]),recipeDropOutputIds:recipes.filter(r=>!r.currency).map(r=>r.output.id)};
 for(const catalog of [teacherInventoryView(room,teacher).catalog,teacherResourcesCatalog(room,teacher).catalog])for(const item of catalog)active(item.id);
 for(const choice of corvusChoices(recipes))active(choice.id);
});
test('every boss loot family awards registered supported items',()=>{
 for(const typeId of ['leoon','noksera','spirit-king','serena','dark-star','star-record','truth-creator','forgotten-constellation']){
  const room={players:new Map([['s',{connected:true,mapId:'map'}]])};
  const drops=addBossDrops(room,{typeId,mapId:'map',x:0,y:0},new Map([['s',10]]),100,lo=>lo);
  assert.ok(drops.length,typeId);for(const drop of drops)active(drop.itemId);
 }
});
test('stored retired choice entries cannot reappear or mint extra items; old holdings remain intact',()=>{
 const now=Date.parse('2026-11-10T00:00:00Z'),p={id:'s',role:'student',connected:true,away:false,avatar:{constellationId:'corvus',level:5},starShards:100,inventory:retired.map(id=>({id,quantity:1})),constellationAbilityState:freshConstellationAbilityState()};
 useConstellationAbility(p,now,()=>6,[]);p.constellationAbilityState.pending.choices.push(...retired.map(id=>({id,value:1})));
 assert.doesNotThrow(()=>validateConstellationAbilityState(p.constellationAbilityState));
 assert.ok(constellationAbilityStatus(p,now).choices.every(c=>!retired.includes(c.id)));
 const before=structuredClone(p);
 for(const id of [...retired,'unregistered-item']){assert.throws(()=>chooseConstellationItem(p,id,now));assert.deepEqual(p,before);}
 const good=p.constellationAbilityState.pending.choices.find(c=>!retired.includes(c.id));chooseConstellationItem(p,good.id,now);assert.ok(p.inventory.some(i=>i.id===good.id));
 for(const id of retired)assert.equal(p.inventory.find(i=>i.id===id).quantity,1);
});
test('asteroid badge is a real Lv1 energy purchase and is distinct from the virtual practice badge',()=>{
 const badge=active('asteroid-badge'),practice=JOURNEY_ITEMS.find(i=>i.practiceKind==='equipment');
 assert.equal(badge.level,1);assert.equal(badge.price,100);assert.equal(badge.bonus.durationMs,1000);assert.notEqual(practice.id,badge.id);assert.equal(practice.mode,'journey-practice');
 const p={role:'student',avatar:{level:1},inventory:[],cosmicEnergy:100};buyEquipment(p,badge.id);assert.equal(p.cosmicEnergy,0);assert.deepEqual(p.inventory,[{id:badge.id,quantity:1}]);
});

test('all-retired saved choices recover within the original budget, with copy ownership and one grant preserved',()=>{
 const now=Date.parse('2026-11-10T00:00:00Z');
 for(const mode of ['craft','copy']){
 const p={id:'s',role:'student',connected:true,away:false,avatar:{constellationId:'corvus',level:5},starShards:100,inventory:[],constellationAbilityState:freshConstellationAbilityState()};
 if(mode==='copy'){p.avatar.constellationId='gemini';p.inventory=[{id:'alien-card',quantity:1}];}
 useConstellationAbility(p,now,()=>6,[]);p.inventory=[];const pending=p.constellationAbilityState.pending;
 pending.choices=[{id:'star-sticker',value:1}];pending.mode=mode;
 const choices=constellationAbilityStatus(p,now).choices;assert.ok(choices.length);assert.ok(choices.every(c=>!itemOf(c.id).shopHidden&&c.value<=pending.budget&&itemOf(c.id).level===1));
 const id=choices[0].id;if(mode==='copy'){assert.throws(()=>chooseConstellationItem(p,id,now));p.inventory.push({id,quantity:1});}
 chooseConstellationItem(p,id,now);assert.equal(p.inventory.find(i=>i.id===id).quantity,mode==='copy'?2:1);assert.throws(()=>chooseConstellationItem(p,id,now));assert.equal(p.constellationAbilityState.pending,null);
 }
});
