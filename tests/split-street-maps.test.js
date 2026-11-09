import test from 'node:test';
import assert from 'node:assert/strict';
import {STREET,STAR_STATION,PLAYGROUND,STATIC_MAPS} from '../shared/config.js';
import {avatarPositionIsClear,avatarFootprint} from '../shared/avatar-boundary.js';
import {studentReturnPosition} from '../server/last-location.js';
import {isHuntingMap} from '../shared/hunting-time.js';
const maps=[STREET,STAR_STATION,PLAYGROUND];
const avatars=[{role:'student',avatar:{level:5,constellationId:'sagittarius'}},{role:'teacher',avatar:{level:5}}];
test('split safe maps own their objects and every gate arrival fits the largest avatar and cropped view',()=>{
 assert.equal(STREET.objects.filter(o=>o.kind.endsWith('-station')||o.kind==='arcade').length,0);
 assert.equal(STAR_STATION.objects.filter(o=>o.kind.endsWith('-station')).length,6);
 assert.equal(PLAYGROUND.objects.filter(o=>o.kind==='arcade').length,7);
 for(const map of maps){
  assert.equal(isHuntingMap(map.id),false);
  for(const p of avatars)for(const point of [map.spawn,...map.objects.filter(o=>o.kind==='gate')]){
   assert(avatarPositionIsClear(map,point.x,point.y,p),map.id+' '+(point.id||'spawn'));
   const foot=avatarFootprint(p,point.x,point.y),b=map.viewBounds;
   assert(foot.x-foot.radius>=b.x&&foot.x+foot.radius<=b.x+b.width&&foot.y-foot.radius>=b.y&&foot.y+foot.radius<=b.y+b.height);
  }
  for(const gate of map.objects.filter(o=>o.kind==='gate'))for(const p of avatars)assert(avatarPositionIsClear(STATIC_MAPS[gate.target],gate.arrival.x,gate.arrival.y,p));
 }
});
test('station has the requested clockwise arrangement and unobstructed north doorway',()=>{
 const o=id=>STAR_STATION.objects.find(o=>o.id===id),center=o('star-angel-statue');
 assert.deepEqual([center.x,center.y],[900,530]);
 const expected={'math-station':[-1,1],'history-station':[-1,0],'science-station':[-1,-1],'culture-station':[1,-1],'english-station':[1,0],'art-station':[1,1],'gate-sleeping-stars':[0,-1]};
 for(const [id,signs] of Object.entries(expected)){const p=o(id);assert.deepEqual([Math.sign(p.x-center.x),Math.sign(p.y-center.y)],signs,id);}
 for(const p of avatars)for(let y=80;y<=390;y+=5)assert(avatarPositionIsClear(STAR_STATION,900,y,p),'north doorway '+y);
});
test('legacy station/playground locations migrate and occupied positions are repaired on restore',()=>{
 const p={id:'legacy',connected:true,role:'student',avatar:{level:5,constellationId:'sagittarius'}},room={players:new Map(),planets:new Map(),monsters:new Map()};room.players.set(p.id,p);
 for(const [x,y,mapId] of [[900,530,STAR_STATION.id],[250,650,STAR_STATION.id],[1135,100,STAR_STATION.id],[900,2900,PLAYGROUND.id],[900,1110,STREET.id],[900,2350,STREET.id]]){
  const restored=studentReturnPosition(room,p,Date.now(),{mapId:STREET.id,x,y});assert.equal(restored.mapId,mapId);assert(avatarPositionIsClear(STATIC_MAPS[mapId],restored.x,restored.y,p));
 }
});
