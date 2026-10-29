import test from 'node:test';
import assert from 'node:assert/strict';
import {STREET,interactionDistance,interactionReach} from '../shared/config.js';
import {avatarPositionIsClear} from '../shared/avatar-boundary.js';
test('three cozy venues fit the shelter and stay reachable for all student levels',()=>{
 const props=STREET.objects.filter(o=>o.kind.startsWith('cozy-'));
 assert.deepEqual(props.map(o=>o.kind),['cozy-pet','cozy-room','cozy-garden']);
 assert.equal(STREET.objects.some(o=>o.kind==='shelter-flowerbed'),false);
 for(let level=1;level<=5;level++){
  const p={role:'student',avatar:{level}};
  assert(avatarPositionIsClear(STREET,STREET.spawn.x,STREET.spawn.y,p));
  for(const o of props){const point={x:o.x,y:o.y+100};assert(avatarPositionIsClear(STREET,point.x,point.y,p),o.id+' approach '+level);assert(interactionDistance(point,o)<=interactionReach(o),o.id+' interaction');assert(!avatarPositionIsClear(STREET,o.x,o.y,p),o.id+' solid base');}
 }
});
