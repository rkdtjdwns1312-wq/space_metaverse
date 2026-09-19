import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {monstersOf,monsterViews,moveMonsters,strikeMonster,MONSTER_RULES} from '../server/monsters.js';
import {vitalsOf} from '../shared/vitals.js';

test('LV1~5 HP/MP 1/10/20/30/40, 범위 밖 단계는 null',()=>{
 for(const [level,max] of [[1,1],[2,10],[3,20],[4,30]])assert.deepEqual(vitalsOf(level),{hp:{current:max,max},mp:{current:max,max}});
 assert.deepEqual(vitalsOf(5),{hp:{current:40,max:40},mp:{current:40,max:40}});
 for(const level of [0,6,99,'2'])assert.equal(vitalsOf(level),null);
});
test('15마리 체력20/40/100, 방향·거리·맵 검사, 한 마리 타격, 처치/재등장과 방 격리',()=>{
 const room={players:new Map()},other={},monsters=monstersOf(room,0),rabbit=monsters.get('rabbit');
 for(const m of monsters.values())assert.equal(m.hp,{'star-origin-1':20,'star-origin-2':40,'star-origin-3':100}[m.mapId]);
 const p={id:'hunter',role:'student',connected:true,avatar:{level:4,constellationId:'sagittarius'},mapId:rabbit.mapId,x:rabbit.x-62,y:rabbit.y,facing:{x:1,y:0}};room.players.set(p.id,p);
 assert.equal(strikeMonster(room,p,3,0).hp,17);assert.equal(monstersOf(other).get('rabbit').hp,20);
 p.facing.x=-1;assert.equal(strikeMonster(room,p,3,0),null);p.facing.x=1;
 p.x-=200;assert.equal(strikeMonster(room,p,3,0),null);p.x+=200;
 p.mapId='plaza';assert.equal(strikeMonster(room,p,3,0),null);p.mapId=rabbit.mapId;
 for(let i=0;i<6;i++)strikeMonster(room,p,3,0);
 assert.equal(rabbit.hp,0);assert.equal(monsterViews(room).find(m=>m.id===rabbit.id).alive,false);assert.equal(strikeMonster(room,p,3,0),null);
 moveMonsters(room,MONSTER_RULES.respawnMs-1,()=>0);assert.equal(rabbit.hp,0);
 moveMonsters(room,MONSTER_RULES.respawnMs,()=>0);assert.equal(rabbit.hp,20);
 // 큰 몬스터는 중심까지 다가갈 필요 없이 표면 바로 앞에서 때립니다.
 const giant=monsters.get('star-keeper');Object.assign(p,{mapId:giant.mapId,x:giant.x-giant.radius-45,y:giant.y});assert.equal(strikeMonster(room,p,3,11000).hp,97);
});
test('실제 Q 요청의 조작 피해 무시·연타 차단·공유 HP·스킬 방향 및 무소비·이탈 공격 차단',async t=>{
 let now=100000;const game=createClassroomServer({teacherKey:'hunting-test-key',studentHours:false,clock:()=>now}),{port}=await game.listen(),sockets=[];
 t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});
 const connect=async()=>{const s=io('http://127.0.0.1:'+port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;};
 const call=(s,event,data={})=>s.timeout(3000).emitWithAck(event,data),teacher=await connect();
 const created=await call(teacher,'room:create',{teacherKey:'hunting-test-key',allowedNames:['1','2']}),s=await connect(),joined=await call(s,'room:join',{code:created.room.code,nickname:'1'});
 const room=game.store.rooms.get(created.room.code),p=room.players.get(joined.selfId),m=monstersOf(room).get('rabbit');
 Object.assign(m,{dx:0,dy:0,nextDirectionAt:Infinity});Object.assign(p,{mapId:m.mapId,x:m.x-62,y:m.y,facing:{x:1,y:0}});p.avatar.level=4;
 const r=await call(s,'combat:attack',{power:1000,dx:-1,monsterId:'whale'});assert.equal(r.target.hp,17);assert.equal(r.target.damage,3);assert.equal((await call(s,'combat:attack')).ok,false);
 const peer=await connect(),joinedPeer=await call(peer,'room:join',{code:room.code,nickname:'2'});const p2=room.players.get(joinedPeer.selfId);Object.assign(p2,{mapId:m.mapId,x:m.x-62,y:m.y,facing:{x:1,y:0}});p2.avatar.level=3;
 assert.equal((await call(peer,'combat:attack')).target.hp,15);assert.equal(game.store.snapshot(room,p2).monsters.find(m=>m.id==='rabbit').hp,15);
 const before={hp:m.hp,avatar:structuredClone(p.avatar),shards:p.starShards};
 const skill=await call(s,'combat:skill',{dx:-1,power:999});assert.deepEqual(skill.direction,{x:1,y:0});assert.equal(skill.ready,false);assert.equal((await call(s,'combat:skill')).ok,false);
 assert.equal(m.hp,before.hp);assert.deepEqual(p.avatar,before.avatar);assert.equal(p.starShards,before.shards);
 now+=500;p.facing={x:0,y:-1};assert.deepEqual((await call(s,'combat:skill')).direction,{x:0,y:-1});
 p.away=true;now+=500;assert.equal((await call(s,'combat:attack')).ok,false);assert.equal((await call(s,'combat:skill')).ok,false);
});
