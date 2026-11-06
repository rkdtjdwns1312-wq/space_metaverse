import test from 'node:test';
import assert from 'node:assert/strict';
import {attackPowerOf} from '../shared/combat.js';
import {activeStatuses} from '../shared/statuses.js';
import {INFINITE_BRACELET,infiniteEnergyStacks} from '../shared/infinite-energy.js';
import {equip,unequip} from '../server/equipment.js';
import {infiniteEnergyChanged} from '../server/infinite-energy.js';
import {damageMonster,monstersOf} from '../server/monsters.js';
import {playerEffectsView} from '../server/rooms.js';
import {castGemini} from '../server/gemini-skills.js';
import {advanceProjectiles} from '../server/projectiles.js';
import {combatEnemies,damageTargets} from '../server/sagittarius-skills.js';
import {castHercules} from '../server/hercules-skills.js';
import {ensureVitals} from '../server/vitals.js';
import {readingFixture} from './helpers/reading-fixture.js';
import {chargeHuntingStation} from '../server/hunting-time.js';

function fixture(){
  const player={id:'wearer',role:'student',avatar:{constellationId:'gemini',level:5},connected:true,
    x:500,y:450,facing:{x:1,y:0},mapId:'star-origin-1',equipmentSlots:[INFINITE_BRACELET,null,null],inventory:[]};
  const room={players:new Map([[player.id,player]]),planets:new Map()};
  const original=[...monstersOf(room).values()][0];
  const monster={...original,id:'target',typeId:'test-no-art',level:1,mapId:player.mapId,x:565,y:450,hp:20000,maxHp:20000};
  room.monsters=new Map([[monster.id,monster]]);
  const attack=t=>attackPowerOf(5,player.avatar.constellationId,player,t);
  const hit=t=>damageMonster(room,monster,player,attack(t),t);
  return {player,room,monster,attack,hit};
}

test('each real monster hit powers subsequent attacks up to three, refreshes at cap, and expires exactly five seconds later',()=>{
  const {player,room,hit,attack}=fixture(),base=attack(1000);
  assert.equal(base,attackPowerOf(5,'gemini',{...player,equipmentSlots:[]},1000)+5);
  for(let i=0;i<7;i++){
    assert.equal(hit(1000+i*1000).damage,base+Math.min(3,i));
    assert.equal(infiniteEnergyStacks(player,1000+i*1000),Math.min(3,i+1));
  }
  const effects=playerEffectsView(player,false,11999,room);
  assert.equal(activeStatuses({effects},11999).find(s=>s.id==='infinite-energy').count,3);
  assert.equal(effects.find(s=>s.statusId==='infinite-energy').until,12000);
  assert.equal(attack(11999),base+3);assert.equal(attack(12000),base);
  assert.equal(hit(12000).damage,base);assert.equal(player.infiniteEnergy.stacks,1);
});

test('empty, dead, reflected and immune targets do not grant stacks; replacement or unequip removes them immediately',()=>{
  const {player,room,monster,hit,attack}=fixture(),base=attack(1000);
  assert.equal(damageMonster(room,monster,player,20,1000,{fixedDamage:0}).damage,0);
  damageMonster(room,monster,player,20,1001,{reflected:true});
  const mirror={...monster,typeId:'noksera',moonAura:{mapId:monster.mapId,fullStartsAt:0,fullEndsAt:3000}};
  assert.equal(damageMonster(room,mirror,player,10,1002).damage,0);
  assert.equal(damageMonster(room,{...monster,hp:0},player,20,1003),null);
  assert.equal(infiniteEnergyStacks(player,1004),0);
  hit(1005);assert(infiniteEnergyChanged(player,1005));assert(!infiniteEnergyChanged(player,1005));
  unequip(player,1);assert(infiniteEnergyChanged(player,1006));
  equip(player,INFINITE_BRACELET,1);assert.equal(attack(1006),base);
  hit(1007);
  player.inventory.push({id:'comet-compass',quantity:1});equip(player,'comet-compass',1);
  equip(player,INFINITE_BRACELET,1);assert.equal(attack(1008),base);
});

test('a scaled projectile snapshots monster and PvP power separately and each target is resolved only once',()=>{
  const {player,room,monster,hit}=fixture();
  const friend={...player,id:'friend',avatar:{level:5},x:565,equipmentSlots:[]};room.players.set(friend.id,friend);
  const cast=(now)=>{castGemini(room,player,now);return room.projectiles[0];};
  const first=cast(1000),unbuffed=first.power;room.projectiles=[];player.geminiCooldownUntil=0;
  hit(1100);
  const second=cast(1500);assert(second.power>unbuffed);assert.equal(second.playerPower,unbuffed);
  const hp=monster.hp;
  const events=advanceProjectiles(room,3000,combatEnemies,damageTargets);
  assert(events.some(e=>e.targets.some(t=>t.monsterId===monster.id)));
  assert(events.some(e=>e.playerTargets.some(t=>t.targetId===friend.id)));
  const after=monster.hp,stacks=player.infiniteEnergy.stacks;
  assert(after<hp);assert.equal(stacks,1+events.flatMap(e=>e.targets).length);
  advanceProjectiles(room,3100,combatEnemies,damageTargets);
  assert.equal(monster.hp,after);assert.equal(player.infiniteEnergy.stacks,stacks);
});

test('PvP-only melee neither gains nor spends the monster bonus',()=>{
  const {player,room,monster,hit}=fixture();
  player.avatar.constellationId='hercules';
  const teacher={...player,id:'teacher',role:'teacher',avatar:{level:6},equipmentSlots:[],x:585};
  room.players.set(teacher.id,teacher);
  hit(1000);const until=player.infiniteEnergy.endsAt,unbuffed=attackPowerOf(5,'hercules',player,1100,true);
  monster.x=1500;const previous=ensureVitals(teacher).hp;
  const result=castHercules(room,player,1100,{basic:true});
  assert.equal(result.targets.length,0);assert.equal(previous-ensureVitals(teacher).hp,unbuffed);
  assert.equal(player.infiniteEnergy.endsAt,until);assert.equal(player.infiniteEnergy.stacks,1);
});

test('the wearer receives actual attack and countdown updates on gain and expiry without another room snapshot',async t=>{
  const f=await readingFixture(t),p=f.p;
  Object.assign(p.avatar,{constellationId:'hercules',level:5});p.equipmentSlots=[INFINITE_BRACELET,null,null];
  const monster=[...monstersOf(f.room,f.now).values()][0];
  chargeHuntingStation(p,'math',f.now);p.mapId=monster.mapId;monster.hp=10000;
  const next=()=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{f.student.off('combat:infinite-energy',listen);reject(Error('missing passive update'));},3000);
    function listen(data){clearTimeout(timer);f.student.off('combat:infinite-energy',listen);resolve(data);}
    f.student.on('combat:infinite-energy',listen);
  });
  const base=attackPowerOf(5,'hercules',p,f.now),gain=next();damageMonster(f.room,monster,p,base,f.now);
  const event=await gain;assert.equal(event.attackPower,base+1);assert.equal(event.effect.until,f.now+5000);
  const me=f.game.store.snapshot(f.room,p,f.now).players.find(s=>s.id===p.id);
  assert.equal(me.combat.attackPower,base+1);assert.equal(me.effects.find(s=>s.statusId==='infinite-energy').stacks,1);
  const expired=next();f.advance(5000);assert.deepEqual(await expired,{effect:null,attackPower:base});
});
