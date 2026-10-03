import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTaurusDashes,taurusDashViews} from '../server/taurus-skills.js';

test('황소 돌진 도중 다른 맵으로 이동하면 도착 좌표를 유지하고 돌진·면역을 끝낸다',()=>{
  const player={id:'bull',role:'student',connected:true,away:false,mapId:'space-plaza',
    x:3090,y:738,avatar:{level:4,constellationId:'taurus'},taurusImmuneUntil:1500,
    taurusDash:{mapId:'black-hole',at:1000,endsAt:1400,startX:574,startY:640,
      dx:1,dy:0,distance:350,progress:0,size:100,power:72,seen:new Set()}};
  const room={players:new Map([[player.id,player]])};
  assert.deepEqual(taurusDashViews(room,'space-plaza',1100),[]);
  assert.deepEqual(advanceTaurusDashes(room,1100),[]);
  assert.deepEqual([player.x,player.y],[3090,738]);
  assert.equal(player.taurusDash,null);
  assert.equal(player.taurusImmuneUntil,0);
});
