import test from 'node:test';
import assert from 'node:assert/strict';
import {mapOf} from '../shared/config.js';
import {originFloor,onOriginFloor} from '../shared/origin-floor.js';
import {ensureVitals} from '../server/vitals.js';
import {clearTruthCreatorAttack} from '../server/truth-creator-attack.js';
import {TRUTH_CREATOR_GALAXY as RULE,truthCreatorGalaxyRoute,tryTruthCreatorGalaxy,tickTruthCreatorGalaxy,truthCreatorGalaxyViews} from '../server/truth-creator-galaxy.js';
const now=100000;
function fixture(){
  const map=mapOf('sleeping-stars-4'),boss={id:'truth-creator-boss',typeId:'truth-creator',hp:50000,mp:100,mapId:map.id,x:map.width/2,y:map.height/2,radius:150};
  const player={id:'a',role:'student',connected:true,away:false,mapId:map.id,x:boss.x,y:boss.y+350,avatar:{level:1},statGrowth:{bonuses:{hp:1000}},equipmentSlots:[],inventory:[]};ensureVitals(player);
  return {boss,player,room:{players:new Map([[player.id,player]]),monsters:new Map([[boss.id,boss]]),planets:new Map()}};
}
test('random trajectories cross between opposite circular-floor edges with Lv3 radius and at most Lv4 movement speed',()=>{
  const map=mapOf('sleeping-stars-4'),floor=originFloor(map);
  for(let i=0;i<32;i++){
    const route=truthCreatorGalaxyRoute(map,i*Math.PI/16);assert(route);assert(route.distance>RULE.radius*4);
    assert(onOriginFloor(map,route.x,route.y,RULE.radius));assert(onOriginFloor(map,route.toX,route.toY,RULE.radius));
    assert(Math.abs((route.x+route.toX)/2-floor.cx)<.0001);assert(Math.abs((route.y+route.toY)/2-floor.cy)<.0001);
    const outer=(Math.pow((route.x-floor.cx)/floor.rx,2)+Math.pow((route.y-floor.cy)/floor.ry,2));assert(outer>.55&&outer<=1);
    for(let step=0;step<=10;step++)assert(onOriginFloor(map,route.x+(route.toX-route.x)*step/10,route.y+(route.toY-route.y)*step/10,RULE.radius));
  }
  assert.equal(RULE.radius,96);assert.equal(RULE.speed,420);
});
test('one MP30/CD60 cast launches exactly eight, with server-random one-to-three-second spacing and no warnings or queue disclosure',()=>{
  const f=fixture();assert.equal(tryTruthCreatorGalaxy(f.room,f.boss,f.player,now,()=>.5),true);assert.equal(f.boss.mp,70);
  const state=f.boss.truthCreatorGalaxy;assert.equal(state.orbs.length,1);assert.equal(state.queue.length,7);
  assert.equal(tryTruthCreatorGalaxy(f.room,f.boss,f.player,now+1),false);assert.equal(f.boss.mp,70);
  const firstView=truthCreatorGalaxyViews(f.boss,now);assert.equal(firstView.length,1);assert.equal(firstView[0].warning,undefined);assert.equal(firstView[0].queue,undefined);
  const created=new Set([state.orbs[0].id]);let last=now;
  for(let i=0;i<7;i++){
    const due=state.nextSpawnAt;assert(due-last>=1000&&due-last<=3000);tickTruthCreatorGalaxy(f.room,f.boss,due-1);assert.equal(state.queue.length,7-i);
    tickTruthCreatorGalaxy(f.room,f.boss,due);assert.equal(state.queue.length,6-i);state.orbs.forEach(orb=>created.add(orb.id));last=due;
  }
  assert.equal(created.size,8);assert.equal(state.nextSpawnAt,null);assert.equal(tryTruthCreatorGalaxy(f.room,f.boss,f.player,now+59999),false);
  assert.equal(tryTruthCreatorGalaxy(f.room,f.boss,f.player,now+60000,()=>0),true);assert.equal(f.boss.mp,40);
});
test('delayed ticks do not release the queued burst simultaneously; active flight ends at the opposite floor edge',()=>{
  const f=fixture();tryTruthCreatorGalaxy(f.room,f.boss,f.player,now,()=>0);const state=f.boss.truthCreatorGalaxy;
  tickTruthCreatorGalaxy(f.room,f.boss,now+15000);assert.equal(state.queue.length,6);assert.equal(state.nextSpawnAt,now+16000);
  assert.equal(state.orbs.length,1,'finished first projectile removed; only one late spawn');
  assert.equal(state.orbs[0].startsAt,now+15000);tickTruthCreatorGalaxy(f.room,f.boss,now+15001);assert.equal(state.queue.length,6);
});
test('swept body contact instantly defeats crossed players, while Libra and teacher preview/retaliation policies remain unchanged',()=>{
  const f=fixture();f.player.y=f.boss.y;
  const immune={...f.player,id:'immune',x:f.player.x+300,avatar:{level:1,constellationId:'libra'},battleVitals:undefined};ensureVitals(immune);
  immune.libraAura={mapId:immune.mapId,endsAt:now+30000,size:20,radius:20};f.room.players.set(immune.id,immune);
  for(const [id,change] of [['teacher',{role:'teacher',avatar:{level:6}}],['retaliating',{role:'teacher',teacherGhost:true,avatar:{level:6}}],['preview',{role:'teacher',avatar:{level:6,teacherPreview:true}}],['other',{mapId:'space-plaza'}],['offline',{connected:false}]]){
    const p={...f.player,id,...change,battleVitals:undefined};ensureVitals(p);f.room.players.set(id,p);}
  f.boss.teacherRetaliation=new Set(['retaliating','preview']);tryTruthCreatorGalaxy(f.room,f.boss,f.player,now,()=>0);
  const shot=f.boss.truthCreatorGalaxy.orbs[0],crossAt=now+(f.player.x-shot.x+400)/RULE.speed*1000;
  const hits=tickTruthCreatorGalaxy(f.room,f.boss,crossAt);assert(hits.some(hit=>hit.targetId==='a'&&hit.defeated));assert(hits.some(hit=>hit.targetId==='retaliating'&&hit.defeated));
  assert(hits.some(hit=>hit.targetId==='immune'&&hit.immune));assert(f.room.players.get('teacher').battleVitals.hp>0);assert(f.room.players.get('preview').battleVitals.hp>0);
});
test('death, map change, departure and combat reset clear both flying galaxies and their future spawn queue',()=>{
  for(const alter of [f=>f.boss.hp=0,f=>f.boss.mapId='space-plaza',f=>f.player.mapId='space-plaza',f=>f.player.connected=false,f=>f.player.battleVitals.hp=0]){
    const f=fixture();tryTruthCreatorGalaxy(f.room,f.boss,f.player,now,()=>.2);alter(f);assert.deepEqual(tickTruthCreatorGalaxy(f.room,f.boss,now+500),[]);assert.equal(f.boss.truthCreatorGalaxy,null);
  }
  const f=fixture();tryTruthCreatorGalaxy(f.room,f.boss,f.player,now,()=>.2);clearTruthCreatorAttack(f.boss,f.room);assert.equal(f.boss.truthCreatorGalaxy,null);
});
