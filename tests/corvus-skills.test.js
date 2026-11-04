import {advanceProjectiles} from '../server/projectiles.js';
import {combatEnemies,damageTargets} from '../server/sagittarius-skills.js';
const advanceCorvus=(room,now)=>advanceProjectiles(room,now,combatEnemies,damageTargets);
import test from 'node:test';
import assert from 'node:assert/strict';
import {castCorvus} from '../server/corvus-skills.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {attackPowerOf} from '../shared/combat.js';
import {avatarSizeOf} from '../shared/avatar-size.js';

function setup(level){
 const player={id:'raven',connected:true,role:'student',mapId:'star-origin-1',x:500,y:500,facing:{x:1,y:0},avatar:{level,constellationId:'corvus'}};
 const room={players:new Map([[player.id,player]]),planets:new Map()};const monster=[...monstersOf(room).values()][0];
 Object.assign(monster,{x:650,y:500,hp:1000,maxHp:1000,radius:24});room.monsters=new Map([[monster.id,monster]]);
 return{room,player,monster};
}
for(const [level,count,multiplier] of [[2,2,2],[3,3,2.5],[4,4,3],[5,4,3]])test(`까마귀 LV${level}: ${multiplier*100}%×${count}, MP5·쿨10초·사거리5배`,()=>{
 const {room,player,monster}=setup(level),mp=ensureVitals(player).mp;
 const result=castCorvus(room,player,1000);assert.equal(result.hit.range,avatarSizeOf(player)*5);assert.equal(ensureVitals(player).mp,mp-5);assert.equal(monster.hp,1000);
 assert.equal(advanceCorvus(room,1001).length,0);advanceCorvus(room,1400);
 advanceCorvus(room,2300);assert.equal(monster.hp,1000-Math.round(attackPowerOf(level,'corvus',player)*multiplier)*count);
 assert.equal(room.projectiles.length,0);assert.throws(()=>castCorvus(room,player,10999),/10초/);castCorvus(room,player,11000);
});
test('까마귀 Q는 MP0에서도 현재 공격력, 전방5배에 겹친 여러대상/후방 제외',()=>{
 const {room,player,monster}=setup(3);ensureVitals(player).mp=0;
 const twin={...monster,id:'twin',attackers:new Map(),contributors:new Map()},behind={...monster,id:'behind',x:400};room.monsters.set('twin',twin);room.monsters.set('behind',behind);
 const result=castCorvus(room,player,1000,{basic:true});assert.equal(result.targets.length,0);const landed=advanceCorvus(room,1700).flatMap(h=>h.targets);assert.equal(landed.length,2);assert.equal(behind.hp,1000);assert.equal(ensureVitals(player).mp,0);
 assert.equal(landed[0].damage,attackPowerOf(3,'corvus',player));assert.equal(room.damageNumbers.length,2);
});
test('까마귀 지속 타격은 사망·맵변경·접속종료 때 취소하며 MP부족/잠금은 무소모',()=>{
 for(const change of [p=>p.mapId='other',p=>p.connected=false,p=>ensureVitals(p).hp=0,p=>p.avatar.constellationId='leo']){
  const {room,player,monster}=setup(4);castCorvus(room,player,1000);change(player);assert.ok(advanceCorvus(room,2000).every(h=>h.targets.length===0));assert.equal(monster.hp,1000);
 }
 const {room,player}=setup(2);ensureVitals(player).mp=4;assert.throws(()=>castCorvus(room,player,1000),/마나/);assert.equal(ensureVitals(player).mp,4);assert.equal(player.corvusCooldownUntil,undefined);
});

for(const level of [2,3,4,5])for(const basic of [true,false])test(`까마귀 Lv${level} ${basic?'Q':'E'}는 친구/교사를 통과하고 뒤 몬스터만 타격`,()=>{
 const {room,player,monster}=setup(level);
 const others=['student','teacher'].map((role,i)=>({id:role,role,connected:true,mapId:player.mapId,x:540+i*25,y:500,avatar:{level:5,constellationId:'libra'},statGrowth:{bonuses:{hp:1000}}}));
 for(const p of others)room.players.set(p.id,p);
 const before=others.map(p=>ensureVitals(p).hp);
 assert(combatEnemies(room,player).every(t=>t.kind==='monster'));
 castCorvus(room,player,1000,{basic});
 const hits=advanceCorvus(room,2300);assert(monster.hp<1000);assert(hits.every(h=>h.playerTargets.length===0));
 assert.deepEqual(others.map(p=>ensureVitals(p).hp),before);
 const forced=damageTargets(room,player,others.map(entity=>({kind:'player',entity})),999,2400);
 assert.deepEqual(forced.playerTargets,[]);assert.deepEqual(others.map(p=>ensureVitals(p).hp),before);
});

import {createClassroomServer} from '../server/app.js';
import {io} from 'socket.io-client';
import {chargeHuntingStation} from '../server/hunting-time.js';
test('까마귀 실제 소켓 E 연속탄은 친구를 통과해 몬스터만 공격한다',async t=>{
 let now=Date.now();const game=createClassroomServer({teacherKey:'corvus-peer-only',studentHours:false,clock:()=>now}),sockets=[];
 const {port}=await game.listen();t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});
 const connect=async()=>{const s=io(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;};
 const call=(s,e,d={})=>s.timeout(3000).emitWithAck(e,d),teacher=await connect(),student=await connect(),friendSocket=await connect();
 const made=await call(teacher,'room:create',{teacherKey:'corvus-peer-only',allowedNames:['까마귀','친구']});assert.ok(made.ok,made.error);
 const a=await call(student,'room:join',{code:made.room.code,nickname:'까마귀'}),b=await call(friendSocket,'room:join',{code:made.room.code,nickname:'친구'});assert.ok(a.ok);assert.ok(b.ok);
 const room=game.store.rooms.get(made.room.code),caster=room.players.get(a.selfId),friend=room.players.get(b.selfId);
 for(const p of [caster,friend])chargeHuntingStation(p,'math',now);
 Object.assign(caster,{mapId:'star-origin-1',x:500,y:500,facing:{x:1,y:0},avatar:{level:4,constellationId:'corvus'}});
 Object.assign(friend,{mapId:caster.mapId,x:580,y:500,avatar:{level:4,constellationId:'aries'}});
 const monster=[...monstersOf(room,now).values()][0];Object.assign(monster,{x:700,y:500,hp:1000,maxHp:1000,radius:24,stunUntil:now+100000});room.monsters=new Map([[monster.id,monster]]);
 const hp=ensureVitals(friend).hp,events=[];friendSocket.on('combat:player-hit',e=>events.push(e));
 const cast=await call(student,'combat:skill',{slot:0,targetId:friend.id});assert.ok(cast.ok,cast.error);now+=2000;
 const deadline=Date.now()+2000;while(room.projectiles.length&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
 assert.equal(monster.hp,1000-attackPowerOf(4,'corvus',caster)*3*4);assert.equal(ensureVitals(friend).hp,hp);assert.deepEqual(events,[]);
});
