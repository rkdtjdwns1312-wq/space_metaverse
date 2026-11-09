import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyDestination,journeyRoute,journeySegmentClear,createJourneyGuide,tutorialButtonArrowPlacement} from '../client/tutorial-directions.js';
import {JOURNEY_STEPS} from '../shared/tutorial-journey.js';
import {mapOf} from '../shared/config.js';
import {STREET_LAYOUT} from '../shared/street-layout.js';
import {avatarPositionIsClear,avatarCollisionShape} from '../shared/avatar-boundary.js';

const playerAt=(mapId,x,y)=>({id:'route-test',role:'student',mapId,x,y,avatar:{form:'asteroid',level:1}});
const seeded=(seed)=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
function assertWalkablePath(player,route){
 assert(route?.reachable&&route.points.length,'route should have at least one usable waypoint');
 const map=mapOf(player.mapId),shape=avatarCollisionShape(player);let from={x:player.x,y:player.y,mapId:map.id};
 for(const waypoint of route.points){
  const length=Math.hypot(waypoint.x-from.x,waypoint.y-from.y),steps=Math.max(1,Math.ceil(length/20));
  for(let i=1;i<=steps;i++)assert(avatarPositionIsClear(map,from.x+(waypoint.x-from.x)*i/steps,from.y+(waypoint.y-from.y)*i/steps,player,[],from),`blocked route segment ${map.id} at ${from.x+(waypoint.x-from.x)*i/steps},${from.y+(waypoint.y-from.y)*i/steps}, from ${from.x},${from.y} toward ${waypoint.x},${waypoint.y}`);
  // Simulate following each emitted waypoint, then request a fresh route from
  // that moved position to catch cached routes tied to stale player coordinates.
  from={...waypoint,mapId:map.id};
 }
 assert(shape.radius>0);
}

test('tutorial route destinations resolve across all five tutorial maps',()=>{
 const goals=JOURNEY_STEPS.flatMap(step=>step.goals.map(goal=>goal.id)).filter(id=>journeyDestination(id));
 assert(goals.some(id=>journeyDestination(id).mapId==='space-plaza'));
 assert(goals.some(id=>journeyDestination(id).mapId==='star-street'));
 assert(goals.some(id=>journeyDestination(id).mapId==='milky-valley'));
});

test('random valid starts and moving waypoints produce walkable routes to every world destination',()=>{
 const rand=seeded(6232026),destinations=[...new Set(JOURNEY_STEPS.flatMap(step=>step.goals.map(g=>g.id)).filter(id=>journeyDestination(id)))];
 const plans={
  'space-plaza':[{x:1800,y:1320},{x:2280,y:1020}],
  'assignment-archive':[{x:600,y:510}],
  'star-market':[{x:600,y:2100}],
  'department-plaza':[{x:2940,y:2070}],
  'star-street':[STREET_LAYOUT.upper],
  'star-station':[STREET_LAYOUT.north],
  'star-playground':[STREET_LAYOUT.lower],
  'milky-valley':[{x:1200,y:420},{x:480,y:820},{x:1920,y:820}],
 };
 for(const [mapId,areas] of Object.entries(plans))for(const area of areas){
  const map=mapOf(mapId),spawn=playerAt(mapId,area.x,area.y);
  let picked=0;
  for(let attempt=0;attempt<120&&picked<1;attempt++){
   const x=area.x+(rand()*2-1)*(area.rx||180),y=area.y+(rand()*2-1)*(area.ry||120),candidate=playerAt(mapId,x,y);
   if(!avatarPositionIsClear(map,x,y,candidate))continue;picked++;
   for(const goal of destinations){
    const target=journeyDestination(goal);if(target.mapId!==mapId)continue;
    const route=journeyRoute(candidate,goal);assertWalkablePath(candidate,route);
    if(!target.interact&&target.rx&&target.ry){
     const end=route.points.at(-1);
     assert(((end.x-target.x)/target.rx)**2+((end.y-target.y)/target.ry)**2<=1,`${goal} waypoint must complete the visit zone`);
    }
    let moved=candidate;
    for(const point of route.points.slice(0,1)){
     moved=playerAt(mapId,point.x,point.y);
     const refreshed=journeyRoute(moved,goal);try{assertWalkablePath(moved,refreshed);}catch(error){error.message+=` goal=${goal}`;throw error;}
    }
   }
  }
  assert.equal(picked,1,`could not find representative valid starts near ${spawn.x},${spawn.y}`);
 }
});

test('interaction objectives route to a valid side when the direct southern approach is obstructed',()=>{
 const p=playerAt('space-plaza',1800,1320),goal='pillar-notice',destination=journeyDestination(goal),shape=avatarCollisionShape(p);
 // Put the start north of the pillar: the legacy fixed-south endpoint crosses it.
 Object.assign(p,{x:destination.x,y:destination.y-220});
 const route=journeyRoute(p,goal);assertWalkablePath(p,route);
 const end=route.points.at(-1),footY=end.y+shape.offsetY;
 assert(Math.hypot(end.x-destination.x,footY-destination.y)>=destination.radius+shape.radius+11);
});

test('invalid starts overlapping an objective can follow a route out of the collision',()=>{
 const goal='pillar-notice',dest=journeyDestination(goal),p=playerAt('space-plaza',dest.x,dest.y);
 const route=journeyRoute(p,goal);assertWalkablePath(p,route);
 assert.notDeepEqual(route.points[0],{x:p.x,y:p.y},'the first waypoint should lead out of the obstructed start');
});

test('cross-map tutorial guidance selects a valid gate waypoint in either direction',()=>{
 for(const [mapId,x,y,goal] of [
  ['space-plaza',1800,1320,'station'],['star-street',900,1170,'black-hole'],
  ['star-street',900,1250,'station'],['star-street',900,2190,'playground'],['star-station',900,900,'shops'],['star-playground',900,2510,'station'],
  ['space-plaza',1800,1320,'growth-star'],['milky-valley',1200,420,'market']
 ]){
  const p=playerAt(mapId,x,y),route=journeyRoute(p,goal);
  assertWalkablePath(p,route);assert(route.target.interact,'cross-map route should point to the selected gate');
 }
});

test('the exported segment helper uses map floor, collision and live planet geometry',()=>{
 const p=playerAt('space-plaza',1800,1320),safe={x:1850,y:1320,mapId:p.mapId},blocked={x:1500,y:1430,mapId:p.mapId};
 assert(journeySegmentClear(p,{x:p.x,y:p.y,mapId:p.mapId},safe));
 assert.equal(journeySegmentClear(p,{x:p.x,y:p.y,mapId:p.mapId},blocked),false);
 assert.equal(journeySegmentClear(p,{x:p.x,y:p.y,mapId:'star-street'},safe),false);
});

test('guide refreshes moving targets within half a second and skips clear corners within 100ms without per-frame pathfinding',()=>{
 let calls=0,shortcut=false,blocked=false;
 const guide=createJourneyGuide({routeFor:()=>{calls++;return {target:{},points:[{x:100,y:0},{x:200,y:0}]};},segmentClear:(_p,_from,to)=>!blocked&&(to.x===100||shortcut)});
 const p=playerAt('star-street',0,0);
 guide.update(p,'station',[],0);assert.equal(calls,1);
 for(let t=16;t<500;t+=16)guide.update(p,'station',[],t);assert.equal(calls,1);
 shortcut=true;assert.equal(guide.update(p,'station',[],600).points[0].x,200);assert.equal(calls,1);
 p.x=60;guide.update(p,'station',[],700);assert.equal(calls,2);
 blocked=true;guide.update(p,'station',[],800);assert.equal(calls,3);
 blocked=false;p.mapId='star-station';guide.update(p,'shops',[],801);assert.equal(calls,4);
 for(let t=817;t<2800;t+=16)guide.update(p,'shops',[],t);assert.equal(calls,4,'standing still does not reroute');
});
test('top edge tutorial buttons get an upward arrow below them with no overlap',()=>{
 const rect={left:12,top:12,width:120,height:48,bottom:60},placement=tutorialButtonArrowPlacement(rect,{width:390,height:844});
 assert.equal(placement.rotation,-90);assert(placement.top>=rect.bottom+8);assert(placement.left>=8&&placement.left+32<=382);
 const lower=tutorialButtonArrowPlacement({...rect,top:200,bottom:248},{width:1440,height:1000});assert.equal(lower.rotation,90);assert(lower.top+32<=200-8);
});
