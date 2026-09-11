import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/rooms.js';
import { advance, isFree } from '../server/world.js';
import { RULES, MAP } from '../shared/config.js';
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
test('world boundary, planets and avatars block movement',()=>{
 const store=new RoomStore(),{room,player}=store.create(roomData,'t');
 player.x=RULES.radius;player.y=400;player.input={x:-1,y:0,at:0};advance(room,0);assert.equal(player.x,RULES.radius);
 assert.equal(isFree(room,MAP.objects[0].x,MAP.objects[0].y,player.id),false);
 const other=store.join({code:room.code,nickname:'1'},'s').player;
 player.x=400;player.y=400;other.x=436;other.y=400;
 player.input={x:1,y:0,at:0};advance(room,0);assert.equal(player.x,400);
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
