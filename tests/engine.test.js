import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/rooms.js';
import { advance, isFree, spawnInside, exitPosition, isNear, placementFree, addPlanet } from '../server/world.js';
import { RULES, MAP, INTERACT, PLANET, EXAMPLE_PLANETS, PLAZA_ID, mapOf, interiorIdOf } from '../shared/config.js';
const roomData={title:'테스트 교실',allowedNames:Array.from({length:29},(_,i)=>String(i+1))};
test('all entrants start as level-one asteroids; identities and secrets are separated',()=>{
 const store=new RoomStore(),{room,player}=store.create(roomData,'teacher');
 const {player:student}=store.join({code:room.code,nickname:'1',role:'teacher',level:5,x:9999},'student');
 assert.equal(student.role,'student');assert.equal(student.avatar.level,1);assert.equal(student.avatar.constellationId,null);
 assert.equal(student.avatar.form,'asteroid');assert.equal(player.avatar.form,'asteroid');assert.equal(student.starShards,0);
 const snapshot=JSON.stringify(store.snapshot(room));assert.ok(!snapshot.includes(student.token));assert.ok(!snapshot.includes('allowedNames'));
 assert.throws(()=>store.join({code:room.code,nickname:'1'},'other'));
 assert.throws(()=>store.join({code:room.code,nickname:'허용안됨'},'other'));
});
test('capacity is 30 including teacher, with non-overlapping spawn positions',()=>{
 const store=new RoomStore(),{room}=store.create(roomData,'teacher');
 for(let i=1;i<=29;i++)store.join({code:room.code,nickname:String(i)},'s'+i);
 assert.equal(room.players.size,RULES.maxPlayers);
 for(const p of room.players.values())assert.ok(isFree(room,p.x,p.y,p.id));
 assert.throws(()=>store.join({code:room.code,nickname:'30'},'extra'));assert.equal(room.players.size,30);
});
test('room names and allowlist are validated atomically',()=>{
 const s=new RoomStore();
 for(const data of [{title:'<script>',allowedNames:['1']},{allowedNames:['1','1']},{allowedNames:['선생님']},{allowedNames:[]}])
   assert.throws(()=>s.create(data,'t'));
 assert.equal(s.rooms.size,0);
});
test('movement is normalized and ignores client-selected coordinates or speed',()=>{
 const store=new RoomStore(),{room,player}=store.create(roomData,'teacher');
 const start={x:player.x,y:player.y};
 player.input={x:1,y:1,at:1000};advance(room,1000);
 assert.ok(Math.abs(Math.hypot(player.x-start.x,player.y-start.y)-RULES.speed*.05)<1e-8);
 const x=player.x;advance(room,2000);assert.equal(player.x,x);
});
test('world boundary, the star and other avatars block movement',()=>{
 const store=new RoomStore(),{room,player}=store.create(roomData,'t');
 player.x=RULES.radius;player.y=400;player.input={x:-1,y:0,at:0};advance(room,0);assert.equal(player.x,RULES.radius);
 assert.equal(isFree(room,MAP.objects[0].x,MAP.objects[0].y,player.id),false);
 const other=store.join({code:room.code,nickname:'1'},'s').player;
 player.x=400;player.y=400;other.x=436;other.y=400;
 player.input={x:1,y:0,at:0};advance(room,0);assert.equal(player.x,400);
});
test('placementFree keeps new planets away from the star, other planets and pending proposals',()=>{
 const store=new RoomStore(),{room}=store.create(roomData,'t');
 const star=MAP.objects.find(o=>o.kind==='star');
 assert.equal(placementFree(room, star.x, star.y), false);
 assert.equal(placementFree(room, 190, 175), true);
 const planet=addPlanet(room,{name:'첫행성',description:'',x:190,y:175,color:'#98dfd2',rules:['규칙']});
 assert.equal(placementFree(room, planet.x, planet.y), false);
 room.proposals.set('p1',{id:'p1',name:'대기',description:'',x:400,y:400,radius:PLANET.radius,color:'#fff',playerId:'x',nickname:'x',at:Date.now()});
 assert.equal(placementFree(room, 400, 400), false);
});
test('addPlanet pushes a plaza player standing where the new planet appears out to a free spot',()=>{
 const store=new RoomStore(),{room,player}=store.create(roomData,'t');
 player.x=500;player.y=500;player.mapId=PLAZA_ID;
 const planet=addPlanet(room,{name:'새행성',description:'',x:500,y:500,color:'#98dfd2',rules:['규칙'],createdBy:null});
 assert.ok(Math.hypot(player.x-planet.x,player.y-planet.y) >= planet.radius+RULES.radius);
 assert.equal(planet.createdBy,null);
});
test('interior maps block boundary and board, allow doors, isolate collisions per map',()=>{
 const store=new RoomStore(),{room}=store.create({...roomData,seedPlanets:true},'t');
 const planet=[...room.planets.values()].find(pl=>pl.name===EXAMPLE_PLANETS[0].name);
 const mapId=interiorIdOf(planet.id), map=mapOf(mapId, room.planets.values());
 assert.equal(isFree(room, RULES.radius-1, 100, null, mapId), false);
 assert.equal(isFree(room, map.width-RULES.radius+1, 100, null, mapId), false);
 const board=map.objects.find(o=>o.kind==='board'), door=map.objects.find(o=>o.kind==='door');
 assert.equal(isFree(room, board.x, board.y, null, mapId), false);
 assert.equal(isFree(room, door.x, door.y, null, mapId), true);
 const inside=store.join({code:room.code,nickname:'1'},'s').player;
 inside.mapId=mapId;inside.x=600;inside.y=400;
 assert.equal(isFree(room, 600, 400, null, mapId), false);
 assert.equal(isFree(room, 600, 400, null, PLAZA_ID), true);
 // 광장에서는 자유롭지만 행성 안 게시판 때문에 막히는 같은 좌표
 assert.equal(isFree(room, 600, 90, null, PLAZA_ID), true);
 assert.equal(isFree(room, 600, 90, null, mapId), false);
});
test('spawnInside places players near the interior spawn point without overlap',()=>{
 const store=new RoomStore(),{room}=store.create({...roomData,seedPlanets:true},'t');
 const planet=[...room.planets.values()].find(pl=>pl.name===EXAMPLE_PLANETS[0].name);
 const mapId=interiorIdOf(planet.id), map=mapOf(mapId, room.planets.values());
 const players=[];
 for(let i=0;i<5;i++){
  const pos=spawnInside(room,mapId);
  const p=store.join({code:room.code,nickname:String(i+1)},'s'+i).player;
  Object.assign(p,pos,{mapId});
  players.push(p);
 }
 for(const p of players) assert.ok(Math.hypot(p.x-map.spawn.x,p.y-map.spawn.y)<400);
 for(let i=0;i<players.length;i++)
  for(let j=i+1;j<players.length;j++)
   assert.ok(Math.hypot(players[i].x-players[j].x,players[i].y-players[j].y)>=RULES.radius*2+2);
});
test('exitPosition lands just outside the planet, back inside the plaza',()=>{
 const store=new RoomStore(),{room}=store.create({...roomData,seedPlanets:true},'t');
 const planet=[...room.planets.values()].find(pl=>pl.name===EXAMPLE_PLANETS[0].name);
 const pos=exitPosition(room,planet);
 assert.ok(Math.hypot(pos.x-planet.x,pos.y-planet.y) > planet.radius+RULES.radius);
 assert.ok(isFree(room,pos.x,pos.y,null,PLAZA_ID));
 assert.ok(pos.x>=RULES.radius && pos.x<=MAP.width-RULES.radius && pos.y>=RULES.radius && pos.y<=MAP.height-RULES.radius);
});
test('isNear includes planet radius plus interact and player radius, inclusive at the boundary',()=>{
 const planet={x:190,y:175,radius:PLANET.radius}, limit=planet.radius+RULES.radius+INTERACT.radius;
 assert.equal(isNear({x:planet.x+limit,y:planet.y}, planet), true);
 assert.equal(isNear({x:planet.x+limit+0.01,y:planet.y}, planet), false);
});
test('snapshot exposes seeded planets (default rules, no members) and per-player mapId/departmentId, no secrets',()=>{
 const store=new RoomStore(),{room,player}=store.create({...roomData,seedPlanets:true},'t');
 const snap=store.snapshot(room);
 assert.equal(snap.planets.length, EXAMPLE_PLANETS.length);
 assert.deepEqual(snap.proposals, []);
 for(const seed of EXAMPLE_PLANETS){
  const pl=snap.planets.find(x=>x.name===seed.name);
  assert.ok(pl);assert.deepEqual(pl.rules, seed.rules);assert.equal(pl.memberCount,0);assert.equal(pl.createdBy,null);assert.equal(pl.rename,null);
 }
 const p=snap.players.find(x=>x.id===player.id);
 assert.equal(p.mapId, PLAZA_ID);assert.equal(p.departmentId, null);
 const json=JSON.stringify(snap);
 assert.ok(!json.includes(player.token));assert.ok(!json.includes('socketId'));
 assert.ok(!json.includes('lastChatAt'));assert.ok(!json.includes('"input"'));
});
test('resume token only restores its own disconnected, unexpired session',()=>{
 const store=new RoomStore(),s=store.create(roomData,'t');
 assert.throws(()=>store.resume(s.player.token,'attacker',100));
 s.player.connected=false;s.player.expiresAt=500;
 assert.throws(()=>store.resume('x'.repeat(64),'s',100));
 assert.equal(store.resume(s.player.token,'new',100).player.id,s.player.id);
 s.player.connected=false;s.player.expiresAt=500;
 assert.throws(()=>store.resume(s.player.token,'new',501));
 store.destroy(s.room);assert.equal(store.sessions.size,0);assert.equal(store.rooms.size,0);
});
