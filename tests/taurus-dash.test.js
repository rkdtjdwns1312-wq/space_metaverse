import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTaurusDashes,castTaurus,taurusContactRadius,taurusDashViews} from '../server/taurus-skills.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';

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

test('황소 변신 중 방향을 돌려 이동하고 같은 몬스터는 한 번만 맞힌다',()=>{
  const player={id:'bull',role:'student',connected:true,away:false,mapId:'star-origin-1',
    x:400,y:400,facing:{x:1,y:0},input:{x:0,y:0,at:0},avatar:{level:4,constellationId:'taurus'}};
  const room={players:new Map([[player.id,player]]),planets:new Map()};
  const monster=[...monstersOf(room,1000).values()][0];
  Object.assign(monster,{mapId:player.mapId,x:480,y:400,hp:1000,maxHp:1000});
  room.monsters=new Map([[monster.id,monster]]);ensureVitals(player);
  castTaurus(room,player,1000);
  advanceTaurusDashes(room,1300);const rightX=player.x,afterFirst=monster.hp;
  assert.ok(rightX>400);assert.ok(afterFirst<1000);
  player.input={x:-1,y:0,at:1350};advanceTaurusDashes(room,1600);
  assert.ok(player.x<rightX,'방향을 바꾸면 원래 방향으로만 돌진하지 않아야 해요.');
  assert.equal(monster.hp,afterFirst,'같은 몬스터를 다시 지나가도 한 번만 피해를 줘야 해요.');
  player.input={x:0,y:1,at:1650};const beforeY=player.y;advanceTaurusDashes(room,1900);
  assert.ok(player.y>beforeY,'변신 중 세로 방향으로도 조작할 수 있어야 해요.');
  assert.ok(taurusDashViews(room,player.mapId,1900)[0].dy>0);
});

test('황소 그림 가장자리에 걸친 몬스터만 돌진에 맞는다',()=>{
  const player={id:'bull',role:'student',connected:true,away:false,mapId:'star-origin-1',
    x:400,y:400,facing:{x:1,y:0},input:{x:0,y:0,at:0},avatar:{level:4,constellationId:'taurus'}};
  const room={players:new Map([[player.id,player]]),planets:new Map()};
  const first=[...monstersOf(room,1000).values()][0];
  ensureVitals(player);castTaurus(room,player,1000);
  const dash=player.taurusDash,x=player.x+dash.distance*100/(dash.endsAt-dash.at),edge=first.radius+taurusContactRadius(dash);
  const near={...first,id:'near',mapId:player.mapId,x,y:player.y+edge-.01,hp:1000,maxHp:1000,attackers:new Map(),contributors:new Map()};
  const far={...near,id:'far',y:player.y+edge+.01,attackers:new Map(),contributors:new Map()};
  room.monsters=new Map([[near.id,near],[far.id,far]]);
  advanceTaurusDashes(room,1100);
  assert.ok(near.hp<1000);assert.equal(far.hp,1000);
});

test('황소가 방향키를 놓고 멈춰도 몸에 닿은 새 몬스터를 한 번만 친다',()=>{
  const player={id:'bull',role:'student',connected:true,away:false,mapId:'star-origin-1',
    x:400,y:400,facing:{x:1,y:0},input:{x:0,y:0,at:0},avatar:{level:4,constellationId:'taurus'}};
  const room={players:new Map([[player.id,player]]),planets:new Map()};
  const first=[...monstersOf(room,1000).values()][0];
  ensureVitals(player);castTaurus(room,player,1000);
  player.input={x:0,y:0,at:1100};
  const monster={...first,id:'stationary-target',mapId:player.mapId,x:player.x+taurusContactRadius(player.taurusDash)-1,
    y:player.y,hp:1000,maxHp:1000,attackers:new Map(),contributors:new Map()};
  room.monsters=new Map([[monster.id,monster]]);
  advanceTaurusDashes(room,1200);
  assert.deepEqual([player.x,player.y],[400,400]);
  assert.ok(monster.hp<1000,'멈춘 황소와 닿은 몬스터도 피해를 받아야 해요.');
  const hp=monster.hp;advanceTaurusDashes(room,1300);
  assert.equal(monster.hp,hp,'같은 돌진에서 두 번 맞으면 안 돼요.');
});
