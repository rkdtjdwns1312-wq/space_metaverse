import test from 'node:test';import assert from 'node:assert/strict';import {io} from 'socket.io-client';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createClassroomServer} from '../server/app.js';import {addPlanet} from '../server/world.js';
import {INTERIOR,interiorIdOf,PLAZA_ID} from '../shared/config.js';import {validateJoinRequests} from '../server/planet-membership.js';import {issueWarning,warningSummary,clearBlackStar} from '../server/warnings.js';
const call=(s,event,data={})=>s.timeout(4000).emitWithAck(event,data),key='membership-integration-test';
async function fixture(t,persistent=false){
 const dir=persistent?await mkdtemp(join(tmpdir(),'membership-test-')):null,sockets=[];let game,url;
 const start=async()=>{game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false,teacherManagedAccounts:false});const address=await game.listen();url='http://127.0.0.1:'+address.port;};await start();
 const connect=async()=>{const s=io(url,{transports:['websocket'],reconnection:false,forceNew:true});sockets.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;};
 t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();if(dir)await rm(dir,{recursive:true,force:true});});
 const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:key,allowedNames:['1','2','3'],title:'승인 검사'}),code=created.room.code;
 const students=[];for(const name of ['1','2','3']){const socket=await connect(),reply=await call(socket,'room:join',{code,nickname:name,pin:'1234'});assert.ok(reply.ok,reply.error);students.push({socket,id:reply.selfId});}
 const room=()=>game.store.rooms.get(code),player=i=>room().players.get(students[i].id);
 const planet=addPlanet(room(),{name:'우체통행성',description:'',x:650,y:150,color:'#ccccff',rules:[]});
 const mailbox=i=>Object.assign(player(i),{mapId:interiorIdOf(planet.id),x:220,y:210});
 return {get game(){return game;},code,room,player,planet,students,mailbox,connect,restart:async()=>{sockets.forEach(s=>s.disconnect());await game.close();await start();}};
}
test('가입: 빈 행성 즉시, 부원 있는 행성 승인 전 출입 금지·타인 승인 차단·중복 승인 차단',async t=>{
 const f=await fixture(t),[a,b,c]=f.students,id=f.planet.id;
 assert.equal((await call(a.socket,'planet:join',{planetId:id})).pending,false);
 assert.equal((await call(b.socket,'planet:join',{planetId:id})).pending,true);assert.equal(f.player(1).avatar.departmentId,null);
 await call(b.socket,'planet:join',{planetId:id});assert.equal(f.planet.joinRequests.length,1);
 assert.equal((await call(b.socket,'planet:enter',{planetId:id})).ok,false);
 const decision={planetId:id,playerId:b.id,accept:true};
 assert.equal((await call(c.socket,'planet:mailbox:decide',decision)).ok,false);
 assert.equal((await call(a.socket,'planet:mailbox:decide',decision)).ok,false,'같은 부원도 우체통 근처에서만');
 f.mailbox(0);const requests=await call(a.socket,'planet:mailbox:get',{planetId:id});assert.equal(requests.requests[0].nickname,'2');
 const results=await Promise.all([call(a.socket,'planet:mailbox:decide',decision),call(a.socket,'planet:mailbox:decide',decision)]);
 assert.equal(results.filter(r=>r.ok).length,1);assert.equal(f.player(1).avatar.departmentId,id);assert.equal(f.planet.joinRequests.length,0);
 assert.equal(f.game.store.snapshot(f.room(),f.player(2)).planets[0].mailboxCount,0);
});
test('가입: 신청 취소·거절·이동 승인 전 기존 소속 유지, 실내 이동 승인 후 이전 방에서 나옴',async t=>{
 const f=await fixture(t),[a,b]=f.students,id=f.planet.id;
 await call(a.socket,'planet:join',{planetId:id});
 const previous=addPlanet(f.room(),{name:'이전행성',description:'',x:1450,y:175,color:'#ccccff',rules:[]});f.player(1).avatar.departmentId=previous.id;
 await call(b.socket,'planet:join',{planetId:id});assert.equal(f.player(1).avatar.departmentId,previous.id);
 await call(b.socket,'planet:join:cancel',{planetId:id});assert.equal(f.planet.joinRequests.length,0);
 await call(b.socket,'planet:join',{planetId:id});f.mailbox(0);
 assert.ok((await call(a.socket,'planet:mailbox:decide',{planetId:id,playerId:b.id,accept:false})).ok);assert.equal(f.player(1).avatar.departmentId,previous.id);
 await call(b.socket,'planet:join',{planetId:id});f.player(1).mapId=interiorIdOf(previous.id);
 assert.ok((await call(a.socket,'planet:mailbox:decide',{planetId:id,playerId:b.id,accept:true})).ok);
 assert.equal(f.player(1).avatar.departmentId,id);assert.equal(f.player(1).mapId,PLAZA_ID);
});
test('가입: 재시작 후 신청·오프라인 소속 유지 및 오프라인 신청자 승인 저장',async t=>{
 const f=await fixture(t,true),[a,b]=f.students,id=f.planet.id;
 await call(a.socket,'planet:join',{planetId:id});await call(b.socket,'planet:join',{planetId:id});await f.restart();
 const anew=await f.connect();assert.ok((await call(anew,'room:join',{code:f.code,nickname:'1',pin:'1234'})).ok);f.mailbox(0);
 assert.equal((await call(anew,'planet:mailbox:get',{planetId:id})).requests[0].playerId,b.id);
 assert.ok((await call(anew,'planet:mailbox:decide',{planetId:id,playerId:b.id,accept:true})).ok);await f.restart();
 const bnew=await f.connect();const back=await call(bnew,'room:join',{code:f.code,nickname:'2',pin:'1234'});assert.ok(back.ok,back.error);assert.equal(f.player(1).avatar.departmentId,id);
 const cnew=await f.connect();await call(cnew,'room:join',{code:f.code,nickname:'3',pin:'1234'});
 assert.equal((await call(cnew,'planet:join',{planetId:id})).pending,true,'기존 부원이 로그아웃해도 자동 가입하지 않음');
});
test('가입 신청 저장 구조는 중복·잘못된 시간 거부, 옛 저장은 빈 목록',()=>{
 assert.deepEqual(validateJoinRequests(),[]);assert.throws(()=>validateJoinRequests([{playerId:'a',at:-1}]));assert.throws(()=>validateJoinRequests([{playerId:'a',at:1},{playerId:'a',at:2}]));
});
test('경고 현황은 부서별 유효 횟수·검은별만 표시하고 이유는 제외, 해제 즉시 제거',async t=>{
 const f=await fixture(t),actor=f.player(0),target=f.player(1);f.planet.warnings={threshold:3,entries:[]};
 issueWarning(f.room(),f.planet,actor,target,'비공개 이유');assert.equal(warningSummary(f.room(),f.planet)[0].count,1);
 issueWarning(f.room(),f.planet,actor,target,'비공개 이유');assert.equal(warningSummary(f.room(),f.planet)[0].count,2);
 issueWarning(f.room(),f.planet,actor,target,'비공개 이유');const view=warningSummary(f.room(),f.planet);assert.ok(view[0].blackStar);assert.equal(JSON.stringify(view).includes('비공개 이유'),false);
 clearBlackStar(f.room(),target);assert.deepEqual(warningSummary(f.room(),f.planet),[]);
});
