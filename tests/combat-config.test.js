import test from 'node:test';
import assert from 'node:assert/strict';
import {attackPowerOf} from '../shared/combat.js';
import {CONSTELLATIONS} from '../shared/constellations.js';
import {RoomStore} from '../server/rooms.js';
test('16종 별자리 공격력은 계열 보정이 적용된 명시적 표와 일치하며 미확정 단계는 null이다',()=>{
 const store=new RoomStore(),{room,player}=store.create({title:'공격력 시험',allowedNames:['1']},'t');
 const expected={
  gemini:[1,1,2,3],corvus:[1,1,2,3],aquarius:[1,1,2,3],capricorn:[1,1,2,3],taurus:[1,1,2,3],
  hercules:[1,1,1,2],libra:[1,1,1,2],cetus:[1,1,1,2],leo:[1,1,1,2],
  ophiuchus:[2,3,4,5],sagittarius:[2,3,4,5], 'corona-borealis':[2,3,4,5],
  cancer:[1,2,3,4],cygnus:[1,2,3,4],aries:[1,2,3,4],pisces:[1,2,3,4]
 };
 for(const constellation of CONSTELLATIONS)for(const [index,level] of [2,3,4,5].entries()){
   player.avatar.level=level;player.avatar.constellationId=constellation.id;
   player.combat={attackPower:9999};
   assert.equal(store.snapshot(room,player).players[0].combat.attackPower,expected[constellation.id][index],constellation.id+' LV'+level);
 }
 for(const level of [1,6,0,-1,2.5,'2',null])assert.equal(attackPowerOf(level),null);
});
