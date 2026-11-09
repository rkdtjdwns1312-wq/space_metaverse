import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP,PLAZA_ID,PLAZA_SUBMAPS,ASSIGNMENT_ID,ASSIGNMENT_MAP,MARKET_ID,DEPARTMENT_ID,BLACK_HOLE_ID,STATIC_MAPS,UNIVERSE_MAP_LAYOUT,mapOf,interiorIdOf} from '../shared/config.js';
import {PLAZA_LAYOUT,PLAZA_ROUTES,departmentSlots,onPlazaFloor,migrateLegacyPlazaPosition} from '../shared/plaza-layout.js';
import {avatarPositionIsClear} from '../shared/avatar-boundary.js';
import {isHuntingMap} from '../shared/hunting-time.js';
import {inMarket,marketInteraction} from '../shared/market.js';
import {studentReturnPosition} from '../server/last-location.js';
import {addPlanet,exitPosition,isFree,isNear} from '../server/world.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';

test('satellite floors, facilities and universe visibility are independent; all arrivals fit large avatars',()=>{
 const player={id:'large',role:'student',avatar:{level:5,form:'star'}};
 assert(MAP.width<3720&&MAP.height<2640);assert(!MAP.objects.some(o=>['andromeda','mission-board','market','planet'].includes(o.kind)));
 for(const m of PLAZA_SUBMAPS){assert(!UNIVERSE_MAP_LAYOUT.some(v=>v.id===m.id));assert(!isHuntingMap(m.id));assert(!onPlazaFloor(m,1800,1320));}
 for(const z of PLAZA_LAYOUT.islands)assert(!onPlazaFloor(MAP,z.x,z.y));
 for(const source of [MAP,...PLAZA_SUBMAPS,STATIC_MAPS[BLACK_HOLE_ID]])for(const gate of source.objects.filter(o=>o.target)){
  assert(avatarPositionIsClear(mapOf(gate.target),gate.arrival.x,gate.arrival.y,player),source.id+' -> '+gate.target);
 }
 assert.equal(ASSIGNMENT_MAP.objects.filter(o=>['andromeda','mission-board'].includes(o.kind)).length,2);
 const planet={id:'kept',...departmentSlots()[0],radius:36,kind:'planet',rules:['keep'],work:{balance:8}};
 assert(!mapOf(PLAZA_ID,[planet]).objects.includes(planet));assert(mapOf(DEPARTMENT_ID,[planet]).objects.includes(planet));
 assert.equal(mapOf(interiorIdOf(planet.id),[planet]).objects.find(o=>o.kind==='door').target,DEPARTMENT_ID);
 assert(!inMarket({mapId:PLAZA_ID,x:600,y:2100,connected:true}));assert(inMarket({mapId:MARKET_ID,x:600,y:2100,connected:true}));
});

test('legacy island saves migrate once without changing coordinates; new saves restore independently',()=>{
 const room={players:new Map(),planets:new Map(),proposals:new Map()},p={id:'restore',role:'student',avatar:{level:1,blackStar:null,departmentId:null}};
 for(const route of PLAZA_ROUTES.filter(r=>r.returnGate)){
  const z=PLAZA_LAYOUT.islands.find(z=>z.id===route.id),old={mapId:PLAZA_ID,x:z.x,y:z.y};
  const migrated=migrateLegacyPlazaPosition(old);assert.deepEqual(migrated,{...old,mapId:route.target});assert.deepEqual(migrateLegacyPlazaPosition(migrated),migrated);
  const restored=studentReturnPosition(room,p,Date.now(),old);assert.equal(restored.mapId,route.target);assert(isFree(room,restored.x,restored.y,p.id,route.target,false,p));
 }
 const central=migrateLegacyPlazaPosition({mapId:PLAZA_ID,x:78,y:1320});assert.equal(central.mapId,PLAZA_ID);assert(onPlazaFloor(MAP,central.x,central.y));
});

test('gates enforce proximity, map restrictions, assignments, department exits and black-hole confinement',async t=>{
 const f=await readingFixture(t);
 for(const route of PLAZA_ROUTES.filter(r=>r.returnGate)){
  Object.assign(f.p,{mapId:PLAZA_ID,x:1800,y:1320});assert.equal((await call(f.student,'map:travel',{to:route.target})).ok,false);
  Object.assign(f.p,{x:route.x,y:route.y});ok(await call(f.student,'map:travel',{to:route.target}));assert.equal(f.p.mapId,route.target);
  assert.equal((await call(f.student,'map:fast-travel',{to:route.target})).ok,false,'hidden destinations cannot be forged via universe travel');
  const back=mapOf(route.target).objects.find(o=>o.target===PLAZA_ID);Object.assign(f.p,{x:back.x,y:back.y});ok(await call(f.student,'map:travel',{to:PLAZA_ID}));
 }
 const board=ASSIGNMENT_MAP.objects.find(o=>o.kind==='mission-board');Object.assign(f.p,{mapId:PLAZA_ID,x:board.x,y:board.y});assert.equal((await call(f.student,'mission:board:read')).ok,false);Object.assign(f.p,{mapId:ASSIGNMENT_ID,x:board.x,y:board.y});ok(await call(f.student,'mission:board:read'));
 const planet=addPlanet(f.room,{name:'보존행성',...departmentSlots()[0],color:'#ccccff',rules:['keep']});f.p.avatar.departmentId=planet.id;
 Object.assign(f.p,{mapId:DEPARTMENT_ID,x:planet.x,y:planet.y+70});ok(await call(f.student,'planet:enter',{planetId:planet.id}));
 Object.assign(f.p,{x:600,y:650});ok(await call(f.student,'planet:exit'));assert.equal(f.p.mapId,DEPARTMENT_ID);assert.deepEqual(planet.rules,['keep']);
 const black=MAP.objects.find(o=>o.kind==='black-hole');Object.assign(f.p,{mapId:PLAZA_ID,x:black.x,y:black.y});assert.equal((await call(f.student,'map:travel',{to:BLACK_HOLE_ID})).ok,false);
 Object.assign(f.teacherPlayer,{mapId:PLAZA_ID,x:black.x,y:black.y});ok(await call(f.teacher,'map:travel',{to:BLACK_HOLE_ID}));
 f.p.avatar.blackStar={planetId:planet.id};Object.assign(f.p,{mapId:BLACK_HOLE_ID,x:600,y:680});assert.equal((await call(f.student,'map:travel',{to:PLAZA_ID})).ok,false);
});

test('market interaction key selects its return gate before trade and keeps trade available elsewhere',()=>{
 const map=mapOf(MARKET_ID),gate=map.objects.find(o=>o.kind==='gate');
 for(const role of ['student','teacher']){
  const p={id:'market-visitor',role,mapId:MARKET_ID,connected:true,avatar:{level:5},x:gate.x,y:gate.y};
  assert.equal(marketInteraction(p,map.objects,isNear).id,gate.id);
  Object.assign(p,map.spawn);assert.equal(marketInteraction(p,map.objects,isNear).kind,'market');
  p.mapId=PLAZA_ID;assert.equal(marketInteraction(p,map.objects,isNear),null);
 }
});
