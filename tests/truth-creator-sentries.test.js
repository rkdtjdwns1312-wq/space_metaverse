import test from 'node:test';
import assert from 'node:assert/strict';
import {mapOf} from '../shared/config.js';
import {monsterType} from '../shared/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {damageMonster,moveMonsters} from '../server/monsters.js';
import {clearTruthCreatorAttack} from '../server/truth-creator-attack.js';
import {TRUTH_CREATOR_SENTRIES as RULE,tryTruthCreatorSentry,tickTruthCreatorSentries} from '../server/truth-creator-sentries.js';
function fixture(){
  const map=mapOf('sleeping-stars-4'),boss={id:'truth-creator-boss',typeId:'truth-creator',hp:30000,maxHp:30000,mp:100,mapId:map.id,x:map.width/2,y:map.height/2,radius:150,attackers:new Map(),contributors:new Map()};
  const player={id:'a',role:'student',connected:true,away:false,mapId:map.id,x:boss.x+200,y:boss.y,avatar:{level:1},statGrowth:{bonuses:{hp:1000,defense:100}},inventory:[],equipmentSlots:[null,null,null]};ensureVitals(player);
  return {boss,player,room:{players:new Map([[player.id,player]]),monsters:new Map([[boss.id,boss]]),planets:new Map()}};
}
test('yellow sentry costs one mana every twenty seconds, has Lv2 size and 1000HP, persists with no hidden count cap',()=>{
  const f=fixture(),orb=tryTruthCreatorSentry(f.room,f.boss,f.player,1000);assert(orb);assert.equal(f.boss.mp,99);
  assert.deepEqual([orb.maxHp,orb.radius,monsterType(orb.typeId).level,monsterType(orb.typeId).defense],[1000,48,2,0]);
  assert.equal(tryTruthCreatorSentry(f.room,f.boss,f.player,20999),false);
  for(let i=1;i<40;i++)assert(tryTruthCreatorSentry(f.room,f.boss,f.player,1000+i*20000));
  assert.equal(f.boss.truthCreatorSentries.ids.size,40);assert.equal(f.boss.mp,60);
  assert.equal(orb.hp,1000);assert.equal(orb.endsAt,undefined);
  f.boss.mp=0;assert.equal(tryTruthCreatorSentry(f.room,f.boss,f.player,1000000),false);
});
test('a shared two-second pulse deals exactly count damage ignoring defense, no missed-tick burst, respects immunity and scope',()=>{
  const f=fixture();tryTruthCreatorSentry(f.room,f.boss,f.player,1000);const hp=ensureVitals(f.player).hp;
  assert.deepEqual(tickTruthCreatorSentries(f.room,f.boss,2999),[]);
  assert.equal(tickTruthCreatorSentries(f.room,f.boss,3000)[0].damage,1);assert.equal(ensureVitals(f.player).hp,hp-1);
  tryTruthCreatorSentry(f.room,f.boss,f.player,21000);assert.equal(tickTruthCreatorSentries(f.room,f.boss,21000)[0].damage,2);
  assert.equal(tickTruthCreatorSentries(f.room,f.boss,21000).length,0);assert.equal(ensureVitals(f.player).hp,hp-3);
  f.player.taurusImmuneUntil=25000;assert.equal(tickTruthCreatorSentries(f.room,f.boss,23000)[0].immune,true);
  f.player.taurusImmuneUntil=0;f.player.avatar.constellationId='libra';f.player.libraAura={mapId:f.player.mapId,endsAt:28000,size:100,radius:200};
  assert.equal(tickTruthCreatorSentries(f.room,f.boss,25000)[0].immune,true);
  for(const [id,change] of [['other',{mapId:'space-plaza'}],['offline',{connected:false}],['ghost',{role:'teacher',teacherGhost:true}],['teacher',{role:'teacher'}]])f.room.players.set(id,{...f.player,id,...change});
  assert.deepEqual(tickTruthCreatorSentries(f.room,f.boss,27000).map(hit=>hit.targetId),['a']);
});
test('any ordinary damage source can destroy sentries without healing, drops, victory credit or respawn; boss reset clears all',()=>{
  const f=fixture(),orb=tryTruthCreatorSentry(f.room,f.boss,f.player,1000);
  damageMonster(f.room,orb,f.player,400,1100);assert.equal(orb.hp,600);
  // Leaving and re-entering never triggers the generic monster heal-to-full behavior.
  f.player.mapId='space-plaza';f.player.mapId=orb.mapId;damageMonster(f.room,orb,f.player,500,1200);assert.equal(orb.hp,100);
  const teacher={...f.player,id:'teacher',role:'teacher',avatar:{level:6},battleVitals:undefined};f.room.players.set(teacher.id,teacher);
  damageMonster(f.room,orb,teacher,100,1300,{retaliateTeacher:true});assert.equal(orb.hp,0);assert.equal(f.room.monsters.has(orb.id),false);
  assert.equal(f.room.energyDrops?.size||0,0);assert.equal(f.player.serenaProgress,undefined);assert.deepEqual(tickTruthCreatorSentries(f.room,f.boss,3000),[]);
  const another=tryTruthCreatorSentry(f.room,f.boss,f.player,21000);assert(another);clearTruthCreatorAttack(f.boss,f.room);assert.equal(f.room.monsters.has(another.id),false);
});
