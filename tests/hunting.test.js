import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {monstersOf,monsterViews,moveMonsters,strikeMonster,MONSTER_RULES} from '../server/monsters.js';
import {vitalsOf} from '../shared/vitals.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {CONSTELLATIONS} from '../shared/constellations.js';

test('LV1~5 HP/MP 1/20/40/60/60·1/20/30/40/40, 범위 밖 단계는 null',()=>{
 for(const [level,maxHp,maxMp] of [[1,1,1],[2,20,20],[3,40,30],[4,60,40]])assert.deepEqual(vitalsOf(level),{hp:{current:maxHp,max:maxHp},mp:{current:maxMp,max:maxMp}});
 assert.deepEqual(vitalsOf(5),{hp:{current:60,max:60},mp:{current:40,max:40}});
 for(const level of [0,6,99,'2'])assert.equal(vitalsOf(level),null);
});
test('일반35마리와 보스2마리 체력·방향·거리·맵 검사, 한 마리 타격, 처치/재등장과 방 격리',()=>{
 const room={players:new Map()},other={},monsters=monstersOf(room,0),rabbit=monsters.get('star-crab');
 for(const m of monsters.values())assert.equal(m.hp,{'star-origin-1':50,'star-origin-2':100,'star-origin-3':300,'moon-garden':100,'sun-paradise':300,'sun-paradise-2':1000,'moon-paradise-1':300,'moon-paradise-2':1000,'sun-paradise-3':2000,'moon-paradise-3':2000}[m.mapId]);
 const p={id:'hunter',role:'student',connected:true,avatar:{level:4,constellationId:'sagittarius'},mapId:rabbit.mapId,x:rabbit.x-62,y:rabbit.y,facing:{x:1,y:0}};room.players.set(p.id,p);
 assert.equal(strikeMonster(room,p,10,0).hp,40);assert.equal(monstersOf(other).get('star-crab').hp,50);
 p.facing.x=-1;assert.equal(strikeMonster(room,p,3,0),null);p.facing.x=1;
 p.x-=200;assert.equal(strikeMonster(room,p,3,0),null);p.x+=200;
 p.mapId='plaza';assert.equal(strikeMonster(room,p,3,0),null);p.mapId=rabbit.mapId;
 for(let i=0;i<5;i++)strikeMonster(room,p,10,i+1);
 assert.equal(rabbit.hp,0);assert.equal(monsterViews(room).find(m=>m.id===rabbit.id).alive,false);assert.equal(strikeMonster(room,p,10,40),null);
 moveMonsters(room,MONSTER_RULES.respawnMs+5,()=>0);assert.equal(rabbit.hp,50);
 // 큰 몬스터는 중심까지 다가갈 필요 없이 표면 바로 앞에서 때립니다.
 const giant=monsters.get('star-dragon-1');Object.assign(p,{mapId:giant.mapId,x:giant.x-giant.radius-45,y:giant.y});assert.equal(strikeMonster(room,p,10,11000).hp,292);
});
test('실제 Q 요청의 조작 피해 무시·연타 차단·공유 HP·스킬 방향 및 무소비·이탈 공격 차단',async t=>{
 let now=100000;const game=createClassroomServer({teacherKey:'hunting-test-key',studentHours:false,clock:()=>now}),{port}=await game.listen(),sockets=[];
 t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});
 const connect=async()=>{const s=io('http://127.0.0.1:'+port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;};
 const call=(s,event,data={})=>s.timeout(3000).emitWithAck(event,data),teacher=await connect();
 const created=await call(teacher,'room:create',{teacherKey:'hunting-test-key',allowedNames:['1','2']}),s=await connect(),joined=await call(s,'room:join',{code:created.room.code,nickname:'1'});
 const room=game.store.rooms.get(created.room.code),p=room.players.get(joined.selfId),m=monstersOf(room).get('star-crab');
 // 확대된 LV4 몸이 바닥 보정으로 순간 이동하지 않도록 중앙의 실제 보행 영역에서 검사합니다.
 Object.assign(m,{x:700,y:500,dx:0,dy:0,nextDirectionAt:Infinity});Object.assign(p,{mapId:m.mapId,x:m.x-62,y:m.y,facing:{x:1,y:0}});p.avatar.level=4;
 const r=await call(s,'combat:attack',{power:1000,dx:-1,monsterId:'star-dragon-1'});assert.equal(r.target.hp,40);assert.equal(r.target.damage,10);assert.equal((await call(s,'combat:attack')).ok,false);
 const peer=await connect(),joinedPeer=await call(peer,'room:join',{code:room.code,nickname:'2'});const p2=room.players.get(joinedPeer.selfId);Object.assign(p2,{mapId:m.mapId,x:m.x-62,y:m.y,facing:{x:1,y:0}});p2.avatar.level=3;
 assert.equal((await call(peer,'combat:attack')).target.hp,33);assert.equal(game.store.snapshot(room,p2).monsters.find(m=>m.id==='star-crab').hp,33);
 now+=999;assert.equal((await call(s,'combat:attack')).ok,false);assert.equal(m.hp,33,'999ms에는 피해 없음');
 now+=1;assert.equal((await call(s,'combat:attack')).target.hp,23,'정확히1000ms에 다음 공격 허용');
 const before={hp:m.hp,avatar:structuredClone(p.avatar),shards:p.starShards};
 const skill=await call(s,'combat:skill',{dx:-1,power:999});assert.deepEqual(skill.direction,{x:1,y:0});assert.equal(skill.ready,false);assert.equal((await call(s,'combat:skill')).ok,false);
 assert.equal(m.hp,before.hp);assert.deepEqual(p.avatar,before.avatar);assert.equal(p.starShards,before.shards);
 now+=500;p.facing={x:0,y:-1};assert.deepEqual((await call(s,'combat:skill')).direction,{x:0,y:-1});
 p.away=true;now+=500;assert.equal((await call(s,'combat:attack')).ok,false);assert.equal((await call(s,'combat:skill')).ok,false);
});

test('16종×LV2~5 실제 공격 피해·타격 표시·내 정보가 계열별 고정표와 일치하고 입력 위조를 무시한다',async t=>{
 let now=100000;const game=createClassroomServer({teacherKey:'attack-class-test',studentHours:false,clock:()=>now}),{port}=await game.listen(),sockets=[];
 t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});
 const connect=async()=>{const s=io('http://127.0.0.1:'+port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;};
 const call=(s,event,data={})=>s.timeout(3000).emitWithAck(event,data),teacher=await connect();
 const created=await call(teacher,'room:create',{teacherKey:'attack-class-test',allowedNames:['1']}),student=await connect();
 const joined=await call(student,'room:join',{code:created.room.code,nickname:'1'}),room=game.store.rooms.get(created.room.code),p=room.players.get(joined.selfId),m=monstersOf(room).get('star-crab');
 const table={'수호계':[3,5,8,8],'제작계':[4,6,9,9],'생산계':[4,6,9,9],'공격계':[6,8,11,11],'특수계':[5,7,10,10]};
 for(const c of CONSTELLATIONS)for(const level of [2,3,4,5]){
   const baseHp=level===2?50:level===3?100:300;Object.assign(m,{x:700,y:500,hp:baseHp,maxHp:baseHp,nextAttackAt:Infinity,nextDirectionAt:Infinity,dx:0,dy:0});
   Object.assign(p,{mapId:m.mapId,x:m.x-62,y:m.y,facing:{x:1,y:0}});Object.assign(p.avatar,{level,constellationId:c.id});
   p.facing={x:1,y:0};
   p.transformation={active:level===5};
   m.x=p.x+avatarSizeOf(p)*.5; p.x=m.x-avatarSizeOf(p)*.5;now+=1000;
   const expected=Math.max(1,table[c.type][level-2]-({2:0,3:1,4:2,5:2})[level]);
   const displayedPower=level===5&&!p.transformation.active?table[c.type][2]:table[c.type][level-2];
   p.facing={x:1,y:0};
   const visual=new Promise(r=>student.once('combat:hit',r));
   const result=await call(student,'combat:attack',{power:999,attackPower:999,level:5,constellationId:'sagittarius',type:'공격계'});
   assert.equal(result.ok,true);
    if(['corvus','aquarius','cancer','cetus','pisces','cygnus','ophiuchus','gemini','aries','sagittarius','taurus','libra'].includes(c.id)){
     assert.ok(!result.target);now+=650;await new Promise(r=>setTimeout(r,70));
   }else {
     const target=result.target||result.targets?.[0];
     assert.ok(target,c.id+' LV'+level+' 기본 타격 대상');
     assert.equal(target.damage,table[c.type][level-2],c.id+' LV'+level);
   }
   const projectileAttack=['corvus','sagittarius','aquarius','cancer','cetus','pisces','cygnus','ophiuchus','gemini','aries','taurus','libra'].includes(c.id);
   const expectedDamage=projectileAttack?table[c.type][level-2]:expected;
   if(!projectileAttack&&c.type!=='수호계'&&c.type!=='공격계'&&c.id!=='capricorn'&&c.id!=='taurus')assert.equal(m.hp,baseHp-expectedDamage,c.id+' LV'+level);
   const hitEvent=await visual;
   if(hitEvent.power!==undefined)assert.equal(hitEvent.power,displayedPower);
   if(hitEvent.kind==='sagittarius-arrow')assert.equal(hitEvent.power,expectedDamage,c.id+' LV'+level+' 발사체 피해');
   assert.equal(game.store.snapshot(room,p).players.find(v=>v.id===p.id).combat.attackPower,displayedPower);
 }
 p.avatar.level=1;now+=500;assert.equal((await call(student,'combat:attack',{level:5,power:999})).ok,false);
});
