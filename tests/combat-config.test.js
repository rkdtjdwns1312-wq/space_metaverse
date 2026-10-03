import test from 'node:test';
import assert from 'node:assert/strict';
import {attackPowerOf} from '../shared/combat.js';
import {CONSTELLATIONS} from '../shared/constellations.js';
import {RoomStore} from '../server/rooms.js';
test('16종 별자리 공격력은 계열 보정이 적용된 명시적 표와 일치하며 미확정 단계는 null이다',()=>{
 const store=new RoomStore(),{room,player}=store.create({title:'공격력 시험',allowedNames:['1']},'t');
 player.role='student';
 const expected={
  gemini:[4,6,9,9],corvus:[4,6,9,9],aquarius:[4,6,9,9],capricorn:[4,6,9,9],taurus:[4,6,9,9],
  hercules:[3,5,8,8],libra:[3,5,8,8],cetus:[3,5,8,8],leo:[3,5,8,8],
  ophiuchus:[6,8,11,11],sagittarius:[6,8,11,11], 'corona-borealis':[6,8,11,11],
  cancer:[5,7,10,10],cygnus:[5,7,10,10],aries:[5,7,10,10],pisces:[5,7,10,10]
 };
 for(const constellation of CONSTELLATIONS)for(const [index,level] of [2,3,4,5].entries()){
   player.avatar.level=level;player.avatar.constellationId=constellation.id;
   player.transformation={active:level<5};
   player.combat={attackPower:9999};
   assert.equal(store.snapshot(room,player).players[0].combat.attackPower,expected[constellation.id][index],constellation.id+' LV'+level);
 }
 for(const level of [1,6,0,-1,2.5,'2',null])assert.equal(attackPowerOf(level),null);
});
