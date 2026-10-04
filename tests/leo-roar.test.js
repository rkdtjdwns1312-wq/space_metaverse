import test from 'node:test';
import assert from 'node:assert/strict';
import {castLeo,advanceLeoRoars} from '../server/leo-skills.js';
import {monstersOf} from '../server/monsters.js';
import {avatarSizeOf} from '../shared/avatar-size.js';

test('사자 포효는 3초 연출 중 가장 큰 프레임에서 한 번만 타격하고 그때 용기를 준다',()=>{
  const now=100000;
  const caster={id:'lion',role:'student',connected:true,away:false,mapId:'star-origin-1',x:500,y:450,
    facing:{x:1,y:0},avatar:{level:4,constellationId:'leo'}};
  const size=avatarSizeOf(caster);
  const ally={id:'friend',role:'student',connected:true,away:false,mapId:caster.mapId,x:500+size,y:450,
    avatar:{level:2,constellationId:'aries'}};
  const room={players:new Map([[caster.id,caster],[ally.id,ally]]),planets:new Map()};
  const original=[...monstersOf(room).values()][0];
  const target={...original,id:'target',x:500+size,y:450,hp:1000,maxHp:1000,radius:20,
    attackers:new Map(),contributors:new Map()};
  room.monsters=new Map([[target.id,target]]);
  const result=castLeo(room,caster,now);
  assert.equal(result.visual.durationMs,3000);
  assert.equal(result.targets.length,0);assert.equal(target.hp,1000);assert.equal(ally.leoCourage,undefined);
  assert.equal(advanceLeoRoars(room,now+1500).hits.length,0);
  assert.equal(target.hp,1000);
  const peak=advanceLeoRoars(room,now+1600);
  assert.equal(peak.hits.length,1);assert.ok(peak.hits[0].targets[0].damage>0);
  assert.equal(ally.leoCourage.bonus,4);assert.equal(ally.leoCourage.endsAt,now+11600);
  const hp=target.hp;assert.equal(advanceLeoRoars(room,now+3000).hits.length,0);assert.equal(target.hp,hp);
});
