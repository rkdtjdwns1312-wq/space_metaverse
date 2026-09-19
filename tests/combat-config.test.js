import test from 'node:test';
import assert from 'node:assert/strict';
import {attackPowerOf} from '../shared/combat.js';
import {CONSTELLATIONS} from '../shared/constellations.js';
import {RoomStore} from '../server/rooms.js';
test('16종 별자리 공격력은 서버의 현재 레벨에서 계산하며 미확정 단계는 null이다',()=>{
 const store=new RoomStore(),{room,player}=store.create({title:'공격력 시험',allowedNames:['1']},'t');
 for(const constellation of CONSTELLATIONS)for(const [level,power] of [[2,1],[3,2],[4,3]]){
   player.avatar.level=level;player.avatar.constellationId=constellation.id;
   player.combat={attackPower:9999};
   assert.equal(store.snapshot(room,player).players[0].combat.attackPower,power);
 }
 for(const constellation of CONSTELLATIONS){
   player.avatar.level=5;player.avatar.constellationId=constellation.id;
   player.combat={attackPower:9999};
   assert.equal(store.snapshot(room,player).players[0].combat.attackPower,4);
 }
 for(const level of [1,6,0,-1,2.5,'2',null])assert.equal(attackPowerOf(level),null);
});
