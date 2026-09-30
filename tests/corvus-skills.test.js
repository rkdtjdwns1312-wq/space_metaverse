import test from 'node:test';
import assert from 'node:assert/strict';
import {castCorvus,advanceCorvus} from '../server/corvus-skills.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {attackPowerOf} from '../shared/combat.js';
import {avatarSizeOf} from '../shared/avatar-size.js';

function setup(level){
 const player={id:'raven',connected:true,role:'student',mapId:'star-origin-1',x:500,y:500,facing:{x:1,y:0},avatar:{level,constellationId:'corvus'}};
 const room={players:new Map([[player.id,player]]),planets:new Map()};const monster=[...monstersOf(room).values()][0];
 Object.assign(monster,{x:650,y:500,hp:1000,maxHp:1000,radius:24});room.monsters=new Map([[monster.id,monster]]);
 return{room,player,monster};
}
for(const [level,count,multiplier] of [[2,2,1],[3,3,1.5],[4,4,2],[5,4,2]])test(`까마귀 LV${level}: ${multiplier*100}%×${count}, MP5·쿨10초·사거리5배`,()=>{
 const {room,player,monster}=setup(level),mp=ensureVitals(player).mp;
 const result=castCorvus(room,player,1000);assert.equal(result.hit.range,avatarSizeOf(player)*5);assert.equal(ensureVitals(player).mp,mp-5);assert.equal(monster.hp,1000);
 assert.equal(advanceCorvus(room,1349).length,0);assert.equal(advanceCorvus(room,1350).length,1);
 assert.equal(advanceCorvus(room,2000).length,count-1);assert.equal(monster.hp,1000-Math.round(attackPowerOf(level,'corvus',player)*multiplier)*count);
 assert.equal(room.corvusCasts.length,0);assert.throws(()=>castCorvus(room,player,10999),/10초/);castCorvus(room,player,11000);
});
test('까마귀 Q는 MP0에서도 현재 공격력, 전방5배에 겹친 여러대상/후방 제외',()=>{
 const {room,player,monster}=setup(3);ensureVitals(player).mp=0;
 const twin={...monster,id:'twin',attackers:new Map(),contributors:new Map()},behind={...monster,id:'behind',x:400};room.monsters.set('twin',twin);room.monsters.set('behind',behind);
 const result=castCorvus(room,player,1000,{basic:true});assert.equal(result.targets.length,2);assert.equal(behind.hp,1000);assert.equal(ensureVitals(player).mp,0);
 assert.equal(result.targets[0].damage,attackPowerOf(3,'corvus',player));assert.equal(room.damageNumbers.length,2);
});
test('까마귀 지속 타격은 사망·맵변경·접속종료 때 취소하며 MP부족/잠금은 무소모',()=>{
 for(const change of [p=>p.mapId='other',p=>p.connected=false,p=>ensureVitals(p).hp=0,p=>p.avatar.constellationId='leo']){
  const {room,player,monster}=setup(4);castCorvus(room,player,1000);change(player);assert.deepEqual(advanceCorvus(room,2000),[]);assert.equal(monster.hp,1000);
 }
 const {room,player}=setup(2);ensureVitals(player).mp=4;assert.throws(()=>castCorvus(room,player,1000),/마나/);assert.equal(ensureVitals(player).mp,4);assert.equal(player.corvusCooldownUntil,undefined);
});
