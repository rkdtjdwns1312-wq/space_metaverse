import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {addPlanet,placementFree} from '../server/world.js';
import {PLAZA_ID,PLANET,PLANET_COLORS,interiorIdOf,mapOf} from '../shared/config.js';
import {departmentSlots} from '../shared/plaza-layout.js';
import {avatarTouchesObject} from '../shared/avatar-boundary.js';

const key='planet-move-isolated-test-key',site=i=>departmentSlots()[i];
const call=(s,event,data={})=>s.timeout(5000).emitWithAck(event,data);
async function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'planet-move-')),sockets=[];
  let game,url;
  const start=async()=>{game=createClassroomServer({teacherKey:key,dataDir:dir,teacherManagedAccounts:false,studentHours:false});url=`http://127.0.0.1:${(await game.listen()).port}`;};
  await start();
  t.after(async()=>{
    sockets.forEach(s=>s.disconnect());await game.close();
    const resolved=path.resolve(dir);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('planet-move-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  });
  const connect=async()=>{const s=io(url,{transports:['websocket'],reconnection:false,autoConnect:false});sockets.push(s);
    await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);s.connect();});return s;};
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:key,allowedNames:['member','visitor','inside']});assert.equal(created.ok,true);
  const code=created.room.code,clients={},ids={};
  for(const name of ['member','visitor','inside']){clients[name]=await connect();const joined=await call(clients[name],'room:join',{code,nickname:name,pin:'1234'});assert.equal(joined.ok,true);ids[name]=joined.selfId;}
  const room=()=>game.store.rooms.get(code),person=name=>room().players.get(ids[name]);
  let planetId,otherId;
  game.store.transact(()=>{
    const make=(name,position)=>addPlanet(room(),{name,description:'test',...position,color:PLANET_COLORS[0],rules:['test'],templateId:'reading'});
    planetId=make('이동행성',site(0)).id;otherId=make('다른행성',site(4)).id;
    for(const name of ['member','inside'])person(name).avatar.departmentId=planetId;
    Object.assign(person('member'),{mapId:PLAZA_ID,x:site(0).x,y:site(0).y+100});
    Object.assign(person('inside'),{mapId:interiorIdOf(planetId),x:600,y:400});
  });
  return {get game(){return game;},dir,code,teacher,clients,ids,room,person,planetId,otherId,connect,
    planet:()=>room().planets.get(planetId),move:(point=site(2),s=clients.member,extra={})=>call(s,'planet:move',{planetId,...point,...extra}),
    restart:async()=>{sockets.forEach(s=>s.disconnect());await game.close();await start();}};
}

test('부원 무료 이동: ID/소속/내용 유지·새 자리 플레이어 안전 배치·스냅샷·내부 출구 갱신',async t=>{
  const f=await fixture(t),before=structuredClone(f.planet()),balance=f.person('member').starShards;
  Object.assign(f.person('visitor'),site(2));const inside={...f.person('inside')};
  const result=await f.move();assert.equal(result.ok,true);assert.equal(result.moved,true);
  assert.deepEqual(f.planet(),{...before,...site(2),joinRequests:[]});assert.equal(f.person('member').starShards,balance);
  assert.equal(f.person('inside').mapId,inside.mapId);assert.equal(f.person('inside').x,inside.x);
  assert.equal(avatarTouchesObject(f.person('visitor'),f.person('visitor').x,f.person('visitor').y,f.planet()),false);
  assert.equal(f.game.store.snapshot(f.room(),f.person('inside')).planets.find(p=>p.id===f.planetId).x,site(2).x);
  assert.equal(mapOf(PLAZA_ID,f.room().planets.values()).objects.find(p=>p.id===f.planetId).x,site(2).x);
  assert.equal((await call(f.clients.inside,'planet:exit')).ok,true);
  assert.equal(f.person('inside').mapId,PLAZA_ID);assert.ok(Math.hypot(f.person('inside').x-site(2).x,f.person('inside').y-site(2).y)<250);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.dir,f.code+'.json'),'utf8')).planets.find(p=>p.id===f.planetId),JSON.parse(JSON.stringify(f.planet())));
});

test('교사·비부원·미인증·다른 방 ID·가짜 소속·선택 후 탈퇴 권한 거부',async t=>{
  const f=await fixture(t),before={...f.planet()};
  for(const s of [f.teacher,f.clients.visitor,await f.connect()])assert.equal((await f.move(site(2),s,{departmentId:f.planetId,role:'student'})).ok,false);
  assert.equal((await f.move(site(2),f.clients.member,{planetId:f.otherId})).ok,false);
  const otherTeacher=await f.connect(),other=await call(otherTeacher,'room:create',{teacherKey:key,allowedNames:['other']});
  const outsider=await f.connect();await call(outsider,'room:join',{code:other.room.code,nickname:'other',pin:'1234'});
  assert.equal((await f.move(site(2),outsider)).ok,false);
  f.person('member').avatar.departmentId=null;
  assert.equal((await f.move()).ok,false);assert.deepEqual(f.planet(),before);
});

test('광장 밖·자리비움·검은별·사망 상태는 이동 거부',async t=>{
  const f=await fixture(t);
  for(const change of [p=>p.mapId=interiorIdOf(f.planetId),p=>p.away=true,p=>p.avatar.blackStar={planetId:f.planetId},
    p=>p.battleVitals={level:p.avatar.level,role:p.role,hp:0,mp:1}]){
    const p=f.person('member'),before=structuredClone(p);change(p);
    assert.equal((await f.move()).ok,false);
    Object.assign(f.person('member'),before);
  }
  assert.equal(f.planet().x,site(0).x);
});

test('자기 행성만 충돌 제외·다른 행성/승인대기/광장 밖/잘못된 좌표 거부',async t=>{
  const f=await fixture(t),old=site(0);
  assert.equal(placementFree(f.room(),old.x,old.y),false);
  assert.equal(placementFree(f.room(),old.x,old.y,f.planetId),true);
  for(const point of [site(4),{x:0,y:0},{x:2000,y:1000},{x:'100',y:100},{x:null,y:100},{x:1e99,y:100},{x:100}])assert.equal((await f.move(point)).ok,false);
  const pending={id:'pending',playerId:f.ids.visitor,nickname:'visitor',name:'신청행성',description:'',...site(2),radius:PLANET.radius,color:PLANET_COLORS[0],templateId:'reading',at:Date.now()};
  f.game.store.transact(()=>f.room().proposals.set(pending.id,pending));
  assert.equal((await f.move()).ok,false);f.game.store.transact(()=>f.room().proposals.delete(pending.id));
  assert.equal((await f.move({x:old.x+2,y:old.y})).ok,true,'원래 행성과 겹치는 작은 이동도 허용');
});

test('현재 위치 선택은 저장·안내 없이 무변경, 저장 실패는 좌표·피난·알림까지 복구',async t=>{
  const f=await fixture(t),save=f.game.store.files.save.bind(f.game.store.files);let saves=0,states=0;
  f.game.store.files.save=record=>{saves++;return save(record);};
  const same=await f.move(site(0));assert.equal(same.ok,true);assert.equal(same.moved,false);assert.equal(saves,0);
  Object.assign(f.person('visitor'),site(2));
  const before=structuredClone(f.planet()),visitor={x:f.person('visitor').x,y:f.person('visitor').y},chat=structuredClone(f.room().chat.history);
  const disk=fs.readFileSync(path.join(f.dir,f.code+'.json'),'utf8');
  f.clients.visitor.on('room:state',()=>states++);
  f.game.store.files.save=()=>{throw new Error('planet move simulated write failure');};
  try{const result=await f.move();assert.equal(result.ok,false);assert.match(result.error,/저장하지 못/);}finally{f.game.store.files.save=save;}
  assert.deepEqual(f.planet(),before);assert.equal(f.person('visitor').x,visitor.x);assert.equal(f.person('visitor').y,visitor.y);
  assert.deepEqual(f.room().chat.history,chat);assert.equal(states,0);assert.equal(fs.readFileSync(path.join(f.dir,f.code+'.json'),'utf8'),disk);
  assert.equal((await f.move()).ok,true,'복구 뒤 같은 소켓으로 재시도 가능');
});

test('옮긴 행성 좌표는 서버 재시작 후 복원',async t=>{
  const f=await fixture(t);assert.equal((await f.move()).ok,true);await f.restart();
  const teacher=await f.connect(),opened=await call(teacher,'room:open',{teacherKey:key,code:f.code});assert.equal(opened.ok,true);
  const restored=opened.room.planets.find(p=>p.id===f.planetId);assert.equal(restored.x,site(2).x);assert.equal(restored.y,site(2).y);
});
