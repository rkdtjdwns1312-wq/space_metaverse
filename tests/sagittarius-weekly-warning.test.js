import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {addPlanet} from '../server/world.js';
import {departmentSlots} from '../shared/plaza-layout.js';
import {issueWarning,warningCount} from '../server/warnings.js';
import {constellationAbilityStatus} from '../server/constellation-weekly-abilities.js';
import {createClassroomServer} from '../server/app.js';
import {io} from 'socket.io-client';

const setup=async(f,level)=>{
  const ids=[];
  await f.mutate((p,room)=>{
    p.avatar.constellationId='sagittarius';p.avatar.level=level;p.avatar.form='constellation';
    for(let index=0;index<2;index++){
      const planet=addPlanet(room,{name:'검사 부서 '+index,description:'',...departmentSlots()[index],color:'#c5c9f7',rules:['공평하게'],templateId:'rules'});
      ids.push(planet.id);
    }
  });
  return ids;
};
const warn=(f,planetId,target=f.p)=>f.mutate((_,room)=>issueWarning(room,room.planets.get(planetId),f.teacherPlayer,target,'약속을 지켜요',f.now)).entry;

test('사수자리 Lv2는 내 경고 하나, Lv3은 둘을 골라 삭제하고 남의 경고는 못 지운다',async t=>{
  for(const level of [2,3])await t.test(`Lv${level}`,async t=>{
    const f=await readingFixture(t),[planetId]=await setup(f,level);
    const own=[warn(f,planetId),warn(f,planetId)],other=warn(f,planetId,f.q);
    const options=ok(await call(f.student,'constellation-ability:sagittarius-options'));
    assert.equal(options.warnings.length,2);assert(options.warnings.every(entry=>entry.planetId===planetId));
    assert.equal((await call(f.student,'constellation-ability:use',{mode:'warning',warningId:other.id})).ok,false);
    assert.equal((await call(f.other,'constellation-ability:sagittarius-options')).ok,false);
    ok(await call(f.student,'constellation-ability:use',{mode:'warning',warningId:own[0].id}));
    assert.equal(warningCount(f.room.planets.get(planetId),f.p.id),1);
    assert.equal(warningCount(f.room.planets.get(planetId),f.q.id),1);
    assert.equal(constellationAbilityStatus(f.p,f.now).used,level===2);
    await f.restart();assert.equal(constellationAbilityStatus(f.p,f.now).uses,1);
    const second=await call(f.student,'constellation-ability:use',{mode:'warning',warningId:own[1].id});
    assert.equal(second.ok,level===3);
    assert.equal(constellationAbilityStatus(f.p,f.now).used,true);
    assert.equal((await call(f.student,'constellation-ability:use',{mode:'warning',warningId:own[0].id})).ok,false);
  });
});

test('사수자리 Lv4는 자기 검은별의 원인 부서만 해제하고 다른 부서 경고는 남긴다',async t=>{
  const f=await readingFixture(t),[planetId,otherPlanetId]=await setup(f,4);
  assert.equal((await call(f.student,'constellation-ability:use',{mode:'black-star'})).ok,false);
  warn(f,otherPlanetId);
  for(let i=0;i<3;i++)warn(f,planetId);
  assert(f.p.avatar.blackStar);
  assert.equal((await call(f.student,'constellation-ability:use',{mode:'black-star',blackStarAt:f.p.avatar.blackStar.at-1})).ok,false,'오래된 검은별 화면의 재시도는 거절한다');
  const result=ok(await call(f.student,'constellation-ability:use',{mode:'black-star',blackStarAt:f.p.avatar.blackStar.at}));
  assert.equal(result.used,true);assert.equal(f.p.avatar.blackStar,null);assert.equal(warningCount(f.room.planets.get(planetId),f.p.id),0);
  assert.equal(warningCount(f.room.planets.get(otherPlanetId),f.p.id),1);
  await f.restart();assert.equal(constellationAbilityStatus(f.p,f.now).used,true);
});

test('사수자리 자신의 경고 해제는 물고기자리 짝의 복사 경고를 삭제하지 않는다',async t=>{
  const f=await readingFixture(t);
  await f.mutate((p,room)=>{p.avatar.constellationId='pisces';p.avatar.level=3;f.q.avatar.constellationId='sagittarius';f.q.avatar.level=3;
    const planet=addPlanet(room,{name:'짝 경고 시험',description:'',...departmentSlots()[0],color:'#c5c9f7',rules:['공평하게'],templateId:'rules'});room.testPlanetId=planet.id;});
  const invitation=ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id})).invitation;
  ok(await call(f.other,'constellation-ability:pair-respond',{requestId:invitation.id,accept:true}));
  const warning=warn(f,f.room.testPlanetId,f.q);
  assert.equal(warningCount(f.room.planets.get(f.room.testPlanetId),f.p.id),1);
  ok(await call(f.other,'constellation-ability:use',{mode:'warning',warningId:warning.id}));
  assert.equal(warningCount(f.room.planets.get(f.room.testPlanetId),f.q.id),0);
  assert.equal(warningCount(f.room.planets.get(f.room.testPlanetId),f.p.id),1);
});

test('사수자리 경고 삭제 저장 실패는 경고와 주간 횟수를 함께 복구하고 새 주에 횟수가 갱신된다',async t=>{
  const f=await readingFixture(t),[planetId]=await setup(f,3);
  const first=warn(f,planetId);
  await f.fail(async()=>assert.equal((await call(f.student,'constellation-ability:use',{mode:'warning',warningId:first.id})).ok,false));
  assert.equal(warningCount(f.room.planets.get(planetId),f.p.id),1);
  assert.equal(constellationAbilityStatus(f.p,f.now).uses,0);
  ok(await call(f.student,'constellation-ability:use',{mode:'warning',warningId:first.id}));
  assert.equal(constellationAbilityStatus(f.p,f.now).uses,1);
  f.advance(-7*86400000);
  assert.equal(constellationAbilityStatus(f.p,f.now).canUse,false,'시계가 이전 주로 돌아가도 추가 횟수를 열지 않는다');
  f.advance(7*86400000);
  f.advance(7*86400000);const second=warn(f,planetId);
  assert.equal(constellationAbilityStatus(f.p,f.now).uses,0);
  ok(await call(f.student,'constellation-ability:use',{mode:'warning',warningId:second.id}));
  assert.equal(constellationAbilityStatus(f.p,f.now).uses,1);
});

test('사수자리 Lv5는 내 검은별 2회 또는 한 부서의 내 경고 전체 삭제 중 한 방식만 쓴다',async t=>{
  const f=await readingFixture(t),[first,second]=await setup(f,5);
  warn(f,first);warn(f,first);warn(f,second);
  const firstOptions=ok(await call(f.student,'constellation-ability:sagittarius-options'));
  assert.equal(firstOptions.departments.length,2);
  const removed=ok(await call(f.student,'constellation-ability:use',{mode:'department',planetId:first}));
  assert.equal(removed.used,true);assert.equal(warningCount(f.room.planets.get(first),f.p.id),0);assert.equal(warningCount(f.room.planets.get(second),f.p.id),1);
  assert.equal((await call(f.student,'constellation-ability:use',{mode:'black-star'})).ok,false);

  const g=await readingFixture(t),[planetId]=await setup(g,5);
  for(let i=0;i<3;i++)warn(g,planetId);
  ok(await call(g.student,'constellation-ability:use',{mode:'black-star',blackStarAt:g.p.avatar.blackStar.at}));
  assert.equal(constellationAbilityStatus(g.p,g.now).uses,1);assert.equal(constellationAbilityStatus(g.p,g.now).used,false);
  warn(g,planetId);
  assert.equal((await call(g.student,'constellation-ability:use',{mode:'department',planetId})).ok,false,'첫 검은별 해제 뒤에는 다른 방식으로 바꿀 수 없다');
  warn(g,planetId);warn(g,planetId);
  ok(await call(g.student,'constellation-ability:use',{mode:'black-star',blackStarAt:g.p.avatar.blackStar.at}));
  assert.equal(constellationAbilityStatus(g.p,g.now).used,true);
});

test('비영속 교실에서도 Lv5 방식 변경 거절은 먼저 경고를 지우지 않는다',async t=>{
  let now=Date.now();const game=createClassroomServer({teacherKey:'sagittarius-memory-test',studentHours:false,clock:()=>now});
  const url=`http://127.0.0.1:${(await game.listen()).port}`,sockets=[];
  const connect=async()=>{const socket=io(url,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;};
  t.after(async()=>{sockets.forEach(socket=>socket.disconnect());await game.close();});
  const teacher=await connect(),created=ok(await call(teacher,'room:create',{teacherKey:'sagittarius-memory-test',title:'메모리 경고 검사',allowedNames:['검사']}));
  const student=await connect(),joined=ok(await call(student,'room:join',{code:created.room.code,nickname:'검사',pin:'1234'}));
  const room=game.store.rooms.get(created.room.code),player=room.players.get(joined.selfId);
  player.avatar.constellationId='sagittarius';player.avatar.level=5;
  const planet=addPlanet(room,{name:'메모리 부서',description:'',...departmentSlots()[0],color:'#c5c9f7',rules:['공평하게'],templateId:'rules'});
  for(let i=0;i<3;i++)issueWarning(room,planet,[...room.players.values()].find(p=>p.role==='teacher'),player,'시험',now);
  ok(await call(student,'constellation-ability:use',{mode:'black-star',blackStarAt:player.avatar.blackStar.at}));
  issueWarning(room,planet,[...room.players.values()].find(p=>p.role==='teacher'),player,'남겨둘 경고',now);
  assert.equal(warningCount(planet,player.id),1);
  assert.equal((await call(student,'constellation-ability:use',{mode:'department',planetId:planet.id})).ok,false);
  assert.equal(warningCount(planet,player.id),1);assert.equal(constellationAbilityStatus(player,now).uses,1);
});
