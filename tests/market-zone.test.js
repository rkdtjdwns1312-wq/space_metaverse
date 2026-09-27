import test from 'node:test';
import assert from 'node:assert/strict';
import {inMarket,MARKET} from '../shared/market.js';
import {PLAZA_LAYOUT} from '../shared/plaza-layout.js';

const player=(x,y,overrides={})=>({mapId:'space-plaza',connected:true,away:false,x,y,...overrides});

test('market trade area follows the full market island ellipse with a 10px wall margin',()=>{
  const island=PLAZA_LAYOUT.islands.find(value=>value.id==='market');
  assert.ok(island);
  assert.deepEqual([MARKET.x,MARKET.y,MARKET.rx,MARKET.ry],[island.x,island.y,island.rx,island.ry]);
  assert.equal(MARKET.radius,island.rx-10);
  for(const [dx,dy] of [[0,0],[island.rx-11,0],[-island.rx+11,0],[0,island.ry-11],[0,-island.ry+11]])
    assert.equal(inMarket(player(island.x+dx,island.y+dy)),true,`inside point ${dx},${dy}`);
  for(const [dx,dy] of [[island.rx-9,0],[-island.rx+9,0],[0,island.ry-9],[0,-island.ry+9],[island.rx,0],[0,island.ry]])
    assert.equal(inMarket(player(island.x+dx,island.y+dy)),false,`wall/outside point ${dx},${dy}`);
  assert.equal(inMarket(player(island.x+(island.rx-10)*0.8,island.y+(island.ry-10)*0.8)),false,
    'the ellipse corner outside the oval is excluded');
});

test('outside-map, bridge, disconnected, away and invalid-position players cannot trade',()=>{
  const island=PLAZA_LAYOUT.islands.find(value=>value.id==='market');
  const center=PLAZA_LAYOUT.center,dx=center.x-island.x,dy=center.y-island.y;
  const scale=1/Math.sqrt((dx/(island.rx-10))**2+(dy/(island.ry-10))**2);
  const bridgePoint={x:island.x+dx*(scale+24/Math.hypot(dx,dy)),y:island.y+dy*(scale+24/Math.hypot(dx,dy))};
  assert.equal(inMarket(player(bridgePoint.x,bridgePoint.y)),false,'bridge just beyond the market edge is excluded');
  assert.equal(inMarket(player(island.x,island.y,{mapId:'another-map'})),false);
  assert.equal(inMarket(player(island.x,island.y,{connected:false})),false);
  assert.equal(inMarket(player(island.x,island.y,{away:true})),false);
  assert.equal(inMarket(player(Number.NaN,island.y)),false);
  assert.equal(inMarket(player(island.x,Infinity)),false);
});
