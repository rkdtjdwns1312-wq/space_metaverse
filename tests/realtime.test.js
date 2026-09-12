import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { createClassroomServer } from '../server/app.js';
import { RULES, PLANET, PLANET_COLORS, PLAZA_ID, interiorIdOf, MAP, STREET, STREET_ID, SHARDS, SHOP, ITEM_USE, TRADE } from '../shared/config.js';
import { placementFree } from '../server/world.js';
const key='test-secret-not-for-deployment';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fixture(t,options={}) {
 const game=createClassroomServer({teacherKey:key,...options}), address=await game.listen();
 const url='http://127.0.0.1:'+address.port,sockets=[];
 t.after(async()=>{for(const s of sockets)s.disconnect();await game.close();});
 async function connect(){
  const s=io(url,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(s);
  await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;
 }
 return {game,url,connect};
}
const call=(socket,event,data={})=>socket.timeout(3000).emitWithAck(event,data);
const create=s=>call(s,'room:create',{teacherKey:key,title:'테스트',allowedNames:Array.from({length:29},(_,i)=>String(i+1))});
test('real sockets enforce teacher permissions and keep rooms isolated',async t=>{
 const {connect,game}=await fixture(t),a=await connect(),b=await connect(),student=await connect();
 assert.equal((await call(student,'room:create',{teacherKey:'wrong',allowedNames:['1']})).ok,false);
 const ra=await create(a),rb=await create(b);assert.ok(ra.ok&&rb.ok);assert.notEqual(ra.room.code,rb.room.code);
 const joined=await call(student,'room:join',{code:ra.room.code,nickname:'1',role:'teacher',level:5});assert.ok(joined.ok);
 assert.equal(joined.room.players.find(p=>p.id===joined.selfId).role,'student');
 assert.equal((await call(student,'room:close')).ok,false);
 let leak=false;b.on('room:state',r=>{if(r.code===ra.room.code)leak=true;});
 const states=[];a.on('world:positions',p=>states.push(p));
 const p=game.store.rooms.get(ra.room.code).players.get(joined.selfId),x=p.x;
 student.emit('player:input',{x:1,y:0});await sleep(240);
 assert.ok(p.x>x);assert.ok(states.some(s=>s.positions.some(v=>v[0]===joined.selfId)));
 student.emit('player:input',{x:Infinity,y:0});student.emit('player:input',{x:99999,y:0});
 student.emit('player:input',{x:0,y:0});await sleep(70);const stopped=p.x;await sleep(200);assert.equal(p.x,stopped);
 assert.equal(leak,false);assert.equal(game.store.rooms.get(rb.room.code).players.size,1);
});
test('30 real browser-equivalent connections admitted, extra and duplicate membership rejected',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const students=await Promise.all(Array.from({length:29},()=>connect()));
 const joins=await Promise.all(students.map((s,i)=>call(s,'room:join',{code:r.room.code,nickname:String(i+1)})));
 assert.ok(joins.every(r=>r.ok));assert.equal(game.store.rooms.get(r.room.code).players.size,30);
 assert.equal((await call(await connect(),'room:join',{code:r.room.code,nickname:'30'})).ok,false);
 assert.equal((await call(students[0],'room:join',{code:r.room.code,nickname:'2'})).ok,false);
});
test('disconnect, authenticated resume, expiry and explicit teacher closure',async t=>{
 const {connect,game}=await fixture(t,{reconnectMs:500}),teacher=await connect(),r=await create(teacher);
 const student=await connect(),joined=await call(student,'room:join',{code:r.room.code,nickname:'1'});
 student.disconnect();await sleep(70);const resumed=await connect();
 const result=await call(resumed,'session:resume',{token:joined.token});assert.ok(result.ok);assert.equal(result.selfId,joined.selfId);
 assert.equal((await call(await connect(),'session:resume',{token:joined.token})).ok,false);
 resumed.disconnect();await sleep(650);
 assert.equal((await call(await connect(),'session:resume',{token:joined.token})).ok,false);
 const newStudent=await connect();assert.ok((await call(newStudent,'room:join',{code:r.room.code,nickname:'1'})).ok);
 const closed=new Promise(resolve=>newStudent.once('room:closed',resolve));
 assert.ok((await call(teacher,'room:leave')).ok);await closed;assert.equal(game.store.rooms.size,0);assert.equal(game.store.sessions.size,0);
});
test('teacher disconnect pauses movement and expiry closes the room',async t=>{
 const {connect,game}=await fixture(t,{reconnectMs:350}),teacher=await connect(),r=await create(teacher);
 const s=await connect(),j=await call(s,'room:join',{code:r.room.code,nickname:'1'});
 teacher.disconnect();await sleep(80);const p=game.store.rooms.get(r.room.code).players.get(j.selfId),x=p.x;
 s.emit('player:input',{x:1,y:0});await sleep(120);assert.equal(p.x,x);
 await sleep(300);assert.equal(game.store.rooms.size,0);
});
test('HTTP serves only public assets; secrets and records never served',async t=>{
 const {url}=await fixture(t);
 for(const path of ['/.env','/server/app.js','/메인.md','/.local/teacher.html','/../.env'])
  assert.equal((await fetch(url+path)).status,404,path);
 const page=await fetch(url);assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 assert.match(await page.text(),/사이버 교실/);
});
test('cross-origin websocket browser access is refused',async t=>{
 const {url}=await fixture(t);
 const s=io(url,{transports:['websocket'],reconnection:false,extraHeaders:{Origin:'https://untrusted.example'}});
 t.after(()=>s.disconnect());
 await new Promise((resolve,reject)=>{s.once('connect',()=>reject(new Error('origin accepted')));s.once('connect_error',resolve);});
});
test('chat messages reach only the same room, with nickname, role and flagged reported',async t=>{
 const {connect}=await fixture(t),teacherA=await connect(),teacherB=await connect();
 const ra=await create(teacherA),rb=await create(teacherB);
 const a1=await connect(),a2=await connect(),b1=await connect();
 const joinA1=await call(a1,'room:join',{code:ra.room.code,nickname:'1'});
 await call(a2,'room:join',{code:ra.room.code,nickname:'2'});
 await call(b1,'room:join',{code:rb.room.code,nickname:'1'});
 const seenTeacher=new Promise(resolve=>teacherA.once('chat:message',resolve));
 const seenA2=new Promise(resolve=>a2.once('chat:message',resolve));
 let leaked=false;b1.on('chat:message',()=>{leaked=true;});teacherB.on('chat:message',()=>{leaked=true;});
 assert.equal((await call(a1,'chat:send',{text:'안녕하세요!'})).ok,true);
 for(const m of await Promise.all([seenTeacher,seenA2])){
  assert.equal(m.nickname,'1');assert.equal(m.role,'student');assert.equal(m.text,'안녕하세요!');
  assert.equal(m.flagged,false);assert.equal(m.playerId,joinA1.selfId);
 }
 await sleep(60);assert.equal(leaked,false);
});
test('blocked words are masked before broadcasting',async t=>{
 const {connect}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s=await connect();await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const seen=new Promise(resolve=>teacher.once('chat:message',resolve));
 await call(s,'chat:send',{text:'너 진짜 병신 같다'});
 const m=await seen;assert.equal(m.flagged,true);assert.equal(m.text,'너 진짜 ○○ 같다');
});
test('chat text is validated before anything else, independent of cooldown',async t=>{
 const {connect}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s=await connect();await call(s,'room:join',{code:r.room.code,nickname:'1'});
 for(const text of ['','   ','a'.repeat(121),'hi'+String.fromCharCode(7)+'there','줄'+String.fromCharCode(10)+'바꿈',123]){
  const res=await call(s,'chat:send',{text});
  assert.equal(res.ok,false);assert.equal(res.error,'채팅은 1~120자로 입력해주세요.');
 }
});
test('chat cooldown rejects an immediate repeat send',async t=>{
 const {connect}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s=await connect();await call(s,'room:join',{code:r.room.code,nickname:'1'});
 assert.equal((await call(s,'chat:send',{text:'하나'})).ok,true);
 const second=await call(s,'chat:send',{text:'둘'});
 assert.equal(second.ok,false);assert.equal(second.error,'조금 천천히 말해요.');
});
test('teacher can turn chat off and on; students are blocked while off but the teacher is not',async t=>{
 const {connect}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s=await connect();await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const states=[];teacher.on('room:state',st=>states.push(st));
 const sysMsgs=[];s.on('chat:message',m=>sysMsgs.push(m));
 assert.equal((await call(s,'chat:setEnabled',{enabled:false})).error,'선생님만 할 수 있어요.');
 assert.equal((await call(teacher,'chat:setEnabled',{enabled:false})).ok,true);
 await sleep(30);assert.ok(states.some(st=>st.chat.enabled===false));
 const blocked=await call(s,'chat:send',{text:'안녕'});
 assert.equal(blocked.ok,false);assert.equal(blocked.error,'선생님이 채팅을 껐어요.');
 assert.equal((await call(teacher,'chat:send',{text:'선생님은 보낼 수 있어요'})).ok,true);
 assert.ok(sysMsgs.some(m=>m.role==='system'&&m.text==='선생님이 채팅을 껐어요.'));
 assert.equal((await call(teacher,'chat:setEnabled',{enabled:true})).ok,true);
 await sleep(30);assert.ok(states.some(st=>st.chat.enabled===true));
 assert.ok(sysMsgs.some(m=>m.text==='선생님이 채팅을 켰어요.'));
});
test('teacher can mute and unmute a student; only a teacher may manage chat and only a student can be muted',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s=await connect(),joined=await call(s,'room:join',{code:r.room.code,nickname:'1'});
 assert.equal((await call(s,'chat:mute',{playerId:joined.selfId,muted:true})).error,'선생님만 할 수 있어요.');
 assert.equal((await call(s,'chat:clear',{})).error,'선생님만 할 수 있어요.');
 const muteSelf=await call(teacher,'chat:mute',{playerId:r.selfId,muted:true});
 assert.equal(muteSelf.ok,false);assert.equal(muteSelf.error,'친구를 찾지 못했어요.');
 assert.equal((await call(teacher,'chat:mute',{playerId:joined.selfId,muted:true})).ok,true);
 assert.equal(game.store.rooms.get(r.room.code).players.get(joined.selfId).muted,true);
 const blocked=await call(s,'chat:send',{text:'안녕'});
 assert.equal(blocked.ok,false);assert.equal(blocked.error,'선생님이 내 채팅을 잠시 멈췄어요.');
 assert.equal((await call(teacher,'chat:mute',{playerId:joined.selfId,muted:false})).ok,true);
 assert.equal(game.store.rooms.get(r.room.code).players.get(joined.selfId).muted,false);
});
test('teacher clearing chat wipes broadcast history but leaves a system note for new joiners',async t=>{
 const {connect}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s=await connect();await call(s,'room:join',{code:r.room.code,nickname:'1'});
 await call(s,'chat:send',{text:'지워질 메시지'});
 const clearedEvent=new Promise(resolve=>teacher.once('chat:cleared',resolve));
 assert.equal((await call(teacher,'chat:clear',{})).ok,true);await clearedEvent;
 const newcomer=await connect();
 const joined=await call(newcomer,'room:join',{code:r.room.code,nickname:'2'});
 assert.ok(joined.chat.messages.every(m=>m.text!=='지워질 메시지'));
 assert.ok(joined.chat.messages.some(m=>m.role==='system'&&m.text==='선생님이 채팅 기록을 지웠어요.'));
});
test('a student can propose a new planet; invalid name/color/location are rejected, valid ones create a pending proposal',async t=>{
 const {connect}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s=await connect();await call(s,'room:join',{code:r.room.code,nickname:'1'});
 assert.equal((await call(teacher,'planet:propose',{name:'행성',description:'',x:190,y:175,color:PLANET_COLORS[0]})).error,
   '선생님은 행성 만들기로 바로 만들 수 있어요.');
 const tooShort=await call(s,'planet:propose',{name:'가',description:'',x:190,y:175,color:PLANET_COLORS[0]});
 assert.equal(tooShort.ok,false);assert.equal(tooShort.error,'행성 이름은 2~10자(한글·영문·숫자)로 적어주세요.');
 const badWord=await call(s,'planet:propose',{name:'바보행성',description:'',x:190,y:175,color:PLANET_COLORS[0]});
 assert.equal(badWord.ok,false);assert.equal(badWord.error,'행성 이름에 쓸 수 없는 말이 있어요.');
 const badColor=await call(s,'planet:propose',{name:'독서행성',description:'',x:190,y:175,color:'#000000'});
 assert.equal(badColor.ok,false);assert.equal(badColor.error,'행성 색을 골라주세요.');
 const overlap=await call(s,'planet:propose',{name:'독서행성',description:'',x:600,y:170,color:PLANET_COLORS[0]});
 assert.equal(overlap.ok,false);assert.equal(overlap.error,'그 자리에는 행성을 만들 수 없어요. 조금 떨어진 곳을 골라주세요.');
 const states=[];teacher.on('room:state',st=>states.push(st));
 const sysMsgs=[];teacher.on('chat:message',m=>sysMsgs.push(m));
 const ok=await call(s,'planet:propose',{name:'독서행성',description:'책 읽기',x:190,y:175,color:PLANET_COLORS[0],templateId:'reading'});
 assert.equal(ok.ok,true);
 await sleep(30);
 assert.ok(states.some(st=>st.proposals.some(p=>p.id===ok.proposalId && p.name==='독서행성' && p.nickname==='1')));
 assert.ok(sysMsgs.some(m=>m.text==='1 친구가 새 행성 "독서행성"을 신청했어요. 선생님의 승인을 기다려요.'));
 const already=await call(s,'planet:propose',{name:'다른행성',description:'',x:1010,y:175,color:PLANET_COLORS[1]});
 assert.equal(already.ok,false);assert.equal(already.error,'이미 승인을 기다리는 행성이 있어요.');
});
test('planet:propose/create require a valid templateId (planet kind), and it is echoed back in the snapshot for planets and proposals',async t=>{
 const {connect}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s=await connect();await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const missing=await call(s,'planet:propose',{name:'독서행성',description:'',x:190,y:175,color:PLANET_COLORS[0]});
 assert.equal(missing.ok,false);assert.equal(missing.error,'행성 종류를 골라주세요.');
 const invalid=await call(s,'planet:propose',{name:'독서행성',description:'',x:190,y:175,color:PLANET_COLORS[0],templateId:'nope'});
 assert.equal(invalid.ok,false);assert.equal(invalid.error,'행성 종류를 골라주세요.');
 const missingCreate=await call(teacher,'planet:create',{name:'급식행성',description:'',x:1010,y:175,color:PLANET_COLORS[1]});
 assert.equal(missingCreate.ok,false);assert.equal(missingCreate.error,'행성 종류를 골라주세요.');
 const invalidCreate=await call(teacher,'planet:create',{name:'급식행성',description:'',x:1010,y:175,color:PLANET_COLORS[1],templateId:'nope'});
 assert.equal(invalidCreate.ok,false);assert.equal(invalidCreate.error,'행성 종류를 골라주세요.');
 const states=[];teacher.on('room:state',st=>states.push(st));
 const proposed=await call(s,'planet:propose',{name:'급식모임',description:'맛있게 먹어요',x:190,y:175,color:PLANET_COLORS[0],templateId:'meal'});
 assert.equal(proposed.ok,true);
 const created=await call(teacher,'planet:create',{name:'감찰행성',description:'',x:1010,y:175,color:PLANET_COLORS[1],templateId:'audit'});
 assert.equal(created.ok,true);
 await sleep(30);
 assert.ok(states.some(st=>st.proposals.some(p=>p.id===proposed.proposalId && p.templateId==='meal')));
 assert.ok(states.some(st=>st.planets.some(pl=>pl.id===created.planetId && pl.templateId==='audit')));
 // 승인된 행성도 신청 때 고른 종류를 그대로 이어받습니다.
 const approved=await call(teacher,'planet:approve',{proposalId:proposed.proposalId});
 assert.equal(approved.ok,true);
 await sleep(30);
 assert.ok(states.some(st=>st.planets.some(pl=>pl.id===approved.planetId && pl.templateId==='meal')));
});
test('pending-proposal limit blocks a further proposal once maxPending is reached',async t=>{
 const {connect}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const students=await Promise.all(Array.from({length:PLANET.maxPending+1},()=>connect()));
 await Promise.all(students.map((st,i)=>call(st,'room:join',{code:r.room.code,nickname:String(i+1)})));
 for(let i=0;i<PLANET.maxPending;i++){
  // y:550인 가로줄은 별(600,170)과 별빛 거리로 가는 문(1120,380) 둘 다에서 충분히 떨어져 있습니다.
  const res=await call(students[i],'planet:propose',{name:'행성'+i,description:'',x:100+i*200,y:550,color:PLANET_COLORS[i%PLANET_COLORS.length],templateId:'meal'});
  assert.equal(res.ok,true,'propose '+i+' failed: '+res.error);
 }
 const over=await call(students[PLANET.maxPending],'planet:propose',{name:'초과행성',description:'',x:100,y:600,color:PLANET_COLORS[0]});
 assert.equal(over.ok,false);assert.equal(over.error,'승인을 기다리는 행성이 너무 많아요. 잠시 후 다시 신청해주세요.');
});
test('the 12-per-room planet limit blocks further teacher creation and student proposals',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const room=game.store.rooms.get(r.room.code);
 let created=0,colorIndex=0;
 outer: for(let y=100;y<720;y+=160)
  for(let x=100;x<1150;x+=200){
   if(created>=PLANET.maxPerRoom) break outer;
   if(!placementFree(room,x,y)) continue;
   const res=await call(teacher,'planet:create',{name:'행성'+created,description:'',x,y,color:PLANET_COLORS[colorIndex%PLANET_COLORS.length],templateId:'meal'});
   assert.equal(res.ok,true,'create '+created+' failed: '+res.error);
   colorIndex++;created++;
  }
 assert.equal(created,PLANET.maxPerRoom);
 const overLimitCreate=await call(teacher,'planet:create',{name:'초과행성',description:'',x:600,y:400,color:PLANET_COLORS[0]});
 assert.equal(overLimitCreate.ok,false);assert.equal(overLimitCreate.error,'행성이 너무 많아요. (최대 '+PLANET.maxPerRoom+'개)');
 const s=await connect();await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const overLimitPropose=await call(s,'planet:propose',{name:'초과행성2',description:'',x:600,y:400,color:PLANET_COLORS[0]});
 assert.equal(overLimitPropose.ok,false);assert.equal(overLimitPropose.error,'행성이 너무 많아요. (최대 '+PLANET.maxPerRoom+'개)');
});
test('teacher approves a proposal: it becomes a planet and the proposer becomes its first member, with announce',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s=await connect();await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const states=[];teacher.on('room:state',st=>states.push(st));
 const sysMsgs=[];teacher.on('chat:message',m=>sysMsgs.push(m));
 const proposed=await call(s,'planet:propose',{name:'독서행성',description:'책 읽기',x:190,y:175,color:PLANET_COLORS[0],templateId:'reading'});
 assert.equal(proposed.ok,true);
 assert.equal((await call(s,'planet:approve',{proposalId:proposed.proposalId})).error,'선생님만 할 수 있어요.');
 assert.equal((await call(teacher,'planet:approve',{proposalId:'nope'})).error,'신청을 찾지 못했어요.');
 const approved=await call(teacher,'planet:approve',{proposalId:proposed.proposalId});
 assert.equal(approved.ok,true);
 await sleep(30);
 assert.ok(states.some(st=>st.planets.some(pl=>pl.id===approved.planetId && pl.name==='독서행성' && pl.memberCount===1) && st.proposals.length===0));
 assert.ok(sysMsgs.some(m=>m.text==='선생님이 "독서행성" 행성을 승인했어요! 1 친구가 첫 멤버가 되었어요.'));
 const player=[...game.store.rooms.get(r.room.code).players.values()].find(pl=>pl.nickname==='1');
 assert.equal(player.avatar.departmentId,approved.planetId);
});
test('teacher can reject a proposal; a student can withdraw only their own',async t=>{
 const {connect}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s1=await connect(),s2=await connect();
 await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 const sysMsgs=[];teacher.on('chat:message',m=>sysMsgs.push(m));
 const p1=await call(s1,'planet:propose',{name:'일기행성',description:'',x:1010,y:175,color:PLANET_COLORS[1],templateId:'diary'});
 assert.equal(p1.ok,true);
 assert.equal((await call(s2,'planet:withdraw',{proposalId:p1.proposalId})).error,'내 신청만 취소할 수 있어요.');
 assert.equal((await call(s1,'planet:withdraw',{proposalId:'nope'})).error,'신청을 찾지 못했어요.');
 const withdrawn=await call(s1,'planet:withdraw',{proposalId:p1.proposalId});
 assert.equal(withdrawn.ok,true);
 await sleep(20);
 assert.ok(sysMsgs.some(m=>m.text==='1 친구가 "일기행성" 행성 신청을 취소했어요.'));
 const p2=await call(s2,'planet:propose',{name:'청소행성',description:'',x:190,y:565,color:PLANET_COLORS[2],templateId:'cleaning'});
 assert.equal(p2.ok,true);
 assert.equal((await call(s1,'planet:reject',{proposalId:p2.proposalId})).error,'선생님만 할 수 있어요.');
 const rejected=await call(teacher,'planet:reject',{proposalId:p2.proposalId});
 assert.equal(rejected.ok,true);
 await sleep(20);
 assert.ok(sysMsgs.some(m=>m.text==='선생님이 "청소행성" 행성 신청을 돌려보냈어요.'));
});
test('creating a planet on top of a standing plaza player pushes them out',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s=await connect(),joined=await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const p=game.store.rooms.get(r.room.code).players.get(joined.selfId);
 p.x=500;p.y=500;p.mapId=PLAZA_ID;
 const created=await call(teacher,'planet:create',{name:'교과행성',description:'',x:500,y:500,color:PLANET_COLORS[3],templateId:'subject'});
 assert.equal(created.ok,true);
 assert.ok(Math.hypot(p.x-500,p.y-500) >= PLANET.radius+RULES.radius);
});
test('teacher can remove a planet: interior occupants return to the plaza and membership is cleared',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const created=await call(teacher,'planet:create',{name:'독서행성',description:'',x:190,y:175,color:PLANET_COLORS[0],templateId:'reading'});
 const s=await connect(),joined=await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const p=game.store.rooms.get(r.room.code).players.get(joined.selfId);
 await call(s,'planet:join',{planetId:created.planetId});
 p.x=190;p.y=175+60;
 await call(s,'planet:enter',{planetId:created.planetId});
 assert.equal(p.mapId,interiorIdOf(created.planetId));
 const sysMsgs=[];teacher.on('chat:message',m=>sysMsgs.push(m));
 assert.equal((await call(s,'planet:remove',{planetId:created.planetId})).error,'선생님만 할 수 있어요.');
 const removed=await call(teacher,'planet:remove',{planetId:created.planetId});
 assert.equal(removed.ok,true);
 assert.equal(p.mapId,PLAZA_ID);
 assert.equal(p.avatar.departmentId,null);
 await sleep(20);
 assert.ok(sysMsgs.some(m=>m.text==='선생님이 "독서행성" 행성을 없앴어요.'));
 assert.equal((await call(teacher,'planet:remove',{planetId:created.planetId})).error,'행성을 찾지 못했어요.');
});
test('students join and transfer planets; teachers cannot join and re-joining the same planet is rejected',async t=>{
 const {connect}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const reading=await call(teacher,'planet:create',{name:'독서행성',description:'',x:190,y:175,color:PLANET_COLORS[0],templateId:'reading'});
 const diary=await call(teacher,'planet:create',{name:'일기행성',description:'',x:1010,y:175,color:PLANET_COLORS[1],templateId:'diary'});
 const s=await connect();await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const states=[];teacher.on('room:state',st=>states.push(st));
 const sysMsgs=[];teacher.on('chat:message',m=>sysMsgs.push(m));
 assert.equal((await call(teacher,'planet:join',{planetId:reading.planetId})).error,'선생님은 모든 행성에 들어갈 수 있어요.');
 assert.equal((await call(s,'planet:join',{planetId:reading.planetId})).ok,true);
 await sleep(30);
 assert.ok(states.some(st=>st.players.some(p=>p.nickname==='1'&&p.departmentId===reading.planetId)));
 assert.ok(sysMsgs.some(m=>m.text==='1 친구가 독서행성에 가입했어요.'));
 const again=await call(s,'planet:join',{planetId:reading.planetId});
 assert.equal(again.ok,false);assert.equal(again.error,'이미 독서행성 소속이에요.');
 const moved=await call(s,'planet:join',{planetId:diary.planetId});
 assert.equal(moved.ok,true);
 await sleep(30);
 assert.ok(states.some(st=>st.players.some(p=>p.nickname==='1'&&p.departmentId===diary.planetId)));
 assert.ok(sysMsgs.some(m=>m.text==='1 친구가 독서행성에서 일기행성으로 옮겼어요.'));
});
test('entering a planet requires membership (or teacher) and proximity; success moves the player inside',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const reading=await call(teacher,'planet:create',{name:'독서행성',description:'',x:190,y:175,color:PLANET_COLORS[0],templateId:'reading'});
 const s=await connect(),joined=await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const rejectNotMember=await call(s,'planet:enter',{planetId:reading.planetId});
 assert.equal(rejectNotMember.ok,false);assert.equal(rejectNotMember.error,'독서행성 소속 친구만 들어갈 수 있어요.');
 assert.equal((await call(s,'planet:join',{planetId:reading.planetId})).ok,true);
 const p=game.store.rooms.get(r.room.code).players.get(joined.selfId);
 p.x=190+1000;p.y=175+1000;
 const tooFar=await call(s,'planet:enter',{planetId:reading.planetId});
 assert.equal(tooFar.ok,false);assert.equal(tooFar.error,'행성에 더 가까이 가주세요.');
 p.x=190;p.y=175+PLANET.radius;
 const entered=await call(s,'planet:enter',{planetId:reading.planetId});
 assert.equal(entered.ok,true);
 assert.equal(p.mapId,interiorIdOf(reading.planetId));
 assert.ok(Math.hypot(p.x-600,p.y-560)<400);
 const tp=game.store.rooms.get(r.room.code).players.get(r.selfId);
 tp.x=190;tp.y=175+PLANET.radius;
 const teacherEnter=await call(teacher,'planet:enter',{planetId:reading.planetId});
 assert.equal(teacherEnter.ok,true);
 assert.equal(tp.mapId,interiorIdOf(reading.planetId));
});
test('planet:join is rejected while inside a planet; exiting returns to the plaza just below it; exit is rejected from the plaza',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const reading=await call(teacher,'planet:create',{name:'독서행성',description:'',x:190,y:175,color:PLANET_COLORS[0],templateId:'reading'});
 const diary=await call(teacher,'planet:create',{name:'일기행성',description:'',x:1010,y:175,color:PLANET_COLORS[1],templateId:'diary'});
 const s=await connect(),joined=await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const p=game.store.rooms.get(r.room.code).players.get(joined.selfId);
 assert.equal((await call(s,'planet:exit',{})).error,'지금은 행성 안이 아니에요.');
 await call(s,'planet:join',{planetId:reading.planetId});
 p.x=190;p.y=175+PLANET.radius;
 await call(s,'planet:enter',{planetId:reading.planetId});
 for(const planetId of [reading.planetId,diary.planetId]){
  const rejected=await call(s,'planet:join',{planetId});
  assert.equal(rejected.ok,false);
  assert.equal(rejected.error,'광장에서만 행성에 가입할 수 있어요.');
 }
 const exited=await call(s,'planet:exit',{});
 assert.equal(exited.ok,true);
 assert.equal(p.mapId,PLAZA_ID);
 assert.ok(p.y>175+PLANET.radius);
 assert.ok(Math.abs(p.x-190)<100);
});
test('a student inside a planet can leave, returning to the plaza with membership cleared',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const reading=await call(teacher,'planet:create',{name:'독서행성',description:'',x:190,y:175,color:PLANET_COLORS[0],templateId:'reading'});
 const s=await connect(),joined=await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const p=game.store.rooms.get(r.room.code).players.get(joined.selfId);
 await call(s,'planet:join',{planetId:reading.planetId});
 p.x=190;p.y=175+PLANET.radius;
 await call(s,'planet:enter',{planetId:reading.planetId});
 assert.equal(p.mapId,interiorIdOf(reading.planetId));
 const left=await call(s,'planet:leave',{planetId:reading.planetId});
 assert.equal(left.ok,true);
 assert.equal(p.mapId,PLAZA_ID);
 assert.equal(p.avatar.departmentId,null);
});
test('only the teacher can set a planet rules; valid rules broadcast and announce, invalid ones are rejected',async t=>{
 const {connect}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const reading=await call(teacher,'planet:create',{name:'독서행성',description:'',x:190,y:175,color:PLANET_COLORS[0],templateId:'reading'});
 const s=await connect();await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const states=[];teacher.on('room:state',st=>states.push(st));
 const sysMsgs=[];teacher.on('chat:message',m=>sysMsgs.push(m));
 assert.equal((await call(s,'planet:rules:set',{planetId:reading.planetId,rules:['안전 규칙']})).error,'선생님만 할 수 있어요.');
 const newRules=['첫째 줄','둘째 줄'];
 const ok=await call(teacher,'planet:rules:set',{planetId:reading.planetId,rules:newRules});
 assert.equal(ok.ok,true);
 await sleep(30);
 assert.ok(states.some(st=>JSON.stringify(st.planets.find(pl=>pl.id===reading.planetId).rules)===JSON.stringify(newRules)));
 assert.ok(sysMsgs.some(m=>m.text==='선생님이 독서행성의 규칙을 바꿨어요.'));
 const tooMany=await call(teacher,'planet:rules:set',{planetId:reading.planetId,rules:Array.from({length:9},(_,i)=>'줄'+i)});
 assert.equal(tooMany.ok,false);assert.equal(tooMany.error,'규칙은 1~8줄, 한 줄 40자 이내로 적어주세요.');
 const tooLong=await call(teacher,'planet:rules:set',{planetId:reading.planetId,rules:['a'.repeat(41)]});
 assert.equal(tooLong.ok,false);
 const control=await call(teacher,'planet:rules:set',{planetId:reading.planetId,rules:['줄'+String.fromCharCode(7)+'바꿈']});
 assert.equal(control.ok,false);
 const empty=await call(teacher,'planet:rules:set',{planetId:reading.planetId,rules:[]});
 assert.equal(empty.ok,false);
});
test('rename vote passes immediately with a single member',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const created=await call(teacher,'planet:create',{name:'독서행성',description:'',x:190,y:175,color:PLANET_COLORS[0],templateId:'reading'});
 const s=await connect();await call(s,'room:join',{code:r.room.code,nickname:'1'});
 await call(s,'planet:join',{planetId:created.planetId});
 const sysMsgs=[];teacher.on('chat:message',m=>sysMsgs.push(m));
 const proposed=await call(s,'planet:rename:propose',{planetId:created.planetId,name:'책읽기행성'});
 assert.equal(proposed.ok,true);
 await sleep(20);
 assert.ok(sysMsgs.some(m=>m.text==='"독서행성" 행성 친구들이 이름을 "책읽기행성"으로 바꿀지 투표를 시작했어요.'));
 assert.ok(sysMsgs.some(m=>m.text==='"독서행성" 행성의 이름이 "책읽기행성"으로 바뀌었어요!'));
 const planet=game.store.rooms.get(r.room.code).planets.get(created.planetId);
 assert.equal(planet.name,'책읽기행성');assert.equal(planet.rename,null);
});
test('rename announcements pick the Korean particle 로/으로 from the new name ending',async t=>{
 const {connect}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const created=await call(teacher,'planet:create',{name:'교과행성',description:'',x:1010,y:565,color:PLANET_COLORS[3],templateId:'subject'});
 const s=await connect();await call(s,'room:join',{code:r.room.code,nickname:'1'});
 await call(s,'planet:join',{planetId:created.planetId});
 const sysMsgs=[];teacher.on('chat:message',m=>sysMsgs.push(m));
 // 받침 없이 끝나는 이름은 '로', ㄹ 받침도 '로', 그 밖의 받침은 '으로'가 붙어야 합니다.
 assert.equal((await call(s,'planet:rename:propose',{planetId:created.planetId,name:'급식나라'})).ok,true);
 await sleep(20);
 assert.ok(sysMsgs.some(m=>m.text==='"교과행성" 행성 친구들이 이름을 "급식나라"로 바꿀지 투표를 시작했어요.'));
 assert.ok(sysMsgs.some(m=>m.text==='"교과행성" 행성의 이름이 "급식나라"로 바뀌었어요!'));
 assert.equal((await call(teacher,'planet:rename:set',{planetId:created.planetId,name:'급식별'})).ok,true);
 await sleep(20);
 assert.ok(sysMsgs.some(m=>m.text==='선생님이 "급식나라" 행성의 이름을 "급식별"로 바꿨어요.'));
 assert.equal((await call(teacher,'planet:rename:set',{planetId:created.planetId,name:'급식행성'})).ok,true);
 await sleep(20);
 assert.ok(sysMsgs.some(m=>m.text==='선생님이 "급식별" 행성의 이름을 "급식행성"으로 바꿨어요.'));
});
test('rename vote is rejected when a second member votes no (2 members)',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const created=await call(teacher,'planet:create',{name:'일기행성',description:'',x:1010,y:175,color:PLANET_COLORS[1],templateId:'diary'});
 const s1=await connect(),s2=await connect();
 await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 await call(s1,'planet:join',{planetId:created.planetId});
 await call(s2,'planet:join',{planetId:created.planetId});
 const sysMsgs=[];teacher.on('chat:message',m=>sysMsgs.push(m));
 const proposed=await call(s1,'planet:rename:propose',{planetId:created.planetId,name:'기록행성'});
 assert.equal(proposed.ok,true);
 assert.equal((await call(teacher,'planet:rename:vote',{planetId:created.planetId,agree:false})).error,'일기행성 소속 친구만 투표할 수 있어요.');
 const voted=await call(s2,'planet:rename:vote',{planetId:created.planetId,agree:false});
 assert.equal(voted.ok,true);
 await sleep(20);
 assert.ok(sysMsgs.some(m=>m.text==='"기록행성" 이름 바꾸기가 부결되었어요.'));
 const planet=game.store.rooms.get(r.room.code).planets.get(created.planetId);
 assert.equal(planet.name,'일기행성');assert.equal(planet.rename,null);
});
test('rename vote passes once 2 of 3 members agree, without waiting for the third',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const created=await call(teacher,'planet:create',{name:'청소행성',description:'',x:190,y:565,color:PLANET_COLORS[2],templateId:'cleaning'});
 const s1=await connect(),s2=await connect(),s3=await connect();
 await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 await call(s3,'room:join',{code:r.room.code,nickname:'3'});
 for(const s of [s1,s2,s3]) await call(s,'planet:join',{planetId:created.planetId});
 const sysMsgs=[];teacher.on('chat:message',m=>sysMsgs.push(m));
 assert.equal((await call(s1,'planet:rename:propose',{planetId:created.planetId,name:'청소행성'})).error,'지금 이름과 같아요.');
 const proposed=await call(s1,'planet:rename:propose',{planetId:created.planetId,name:'청결행성'});
 assert.equal(proposed.ok,true);
 assert.equal((await call(s1,'planet:rename:propose',{planetId:created.planetId,name:'또다른'})).error,'이미 이름 바꾸기 투표가 진행 중이에요.');
 const voted=await call(s2,'planet:rename:vote',{planetId:created.planetId,agree:true});
 assert.equal(voted.ok,true);
 await sleep(20);
 assert.ok(sysMsgs.some(m=>m.text==='"청소행성" 행성의 이름이 "청결행성"으로 바뀌었어요!'));
 const planet=game.store.rooms.get(r.room.code).planets.get(created.planetId);
 assert.equal(planet.name,'청결행성');
 assert.equal((await call(s3,'planet:rename:vote',{planetId:created.planetId,agree:true})).error,'진행 중인 투표가 없어요.');
});
test('a non-member cannot vote on a planet rename',async t=>{
 const {connect}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const created=await call(teacher,'planet:create',{name:'교과행성',description:'',x:1010,y:565,color:PLANET_COLORS[3],templateId:'subject'});
 const s1=await connect(),s2=await connect(),outsider=await connect();
 await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 await call(outsider,'room:join',{code:r.room.code,nickname:'3'});
 await call(s1,'planet:join',{planetId:created.planetId});
 await call(s2,'planet:join',{planetId:created.planetId});
 // 멤버가 2명이라 제안자 혼자 찬성한 상태로는 즉시 통과하지 않고 투표가 진행 중으로 남습니다.
 await call(s1,'planet:rename:propose',{planetId:created.planetId,name:'수업행성'});
 const rejected=await call(outsider,'planet:rename:vote',{planetId:created.planetId,agree:true});
 assert.equal(rejected.ok,false);assert.equal(rejected.error,'교과행성 소속 친구만 투표할 수 있어요.');
});
test('rename re-evaluates when membership shrinks (a member leaving the planet can flip a pending vote to pass)',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const created=await call(teacher,'planet:create',{name:'독서행성',description:'',x:190,y:175,color:PLANET_COLORS[0],templateId:'reading'});
 const s1=await connect(),s2=await connect();
 await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 await call(s1,'planet:join',{planetId:created.planetId});
 await call(s2,'planet:join',{planetId:created.planetId});
 const proposed=await call(s1,'planet:rename:propose',{planetId:created.planetId,name:'책읽기행성'});
 assert.equal(proposed.ok,true);
 let planet=game.store.rooms.get(r.room.code).planets.get(created.planetId);
 assert.ok(planet.rename);
 const sysMsgs=[];teacher.on('chat:message',m=>sysMsgs.push(m));
 const left=await call(s2,'planet:leave',{planetId:created.planetId});
 assert.equal(left.ok,true);
 await sleep(20);
 planet=game.store.rooms.get(r.room.code).planets.get(created.planetId);
 assert.equal(planet.name,'책읽기행성');assert.equal(planet.rename,null);
 assert.ok(sysMsgs.some(m=>m.text==='"독서행성" 행성의 이름이 "책읽기행성"으로 바뀌었어요!'));
});
test('a member leaving the classroom entirely also re-evaluates a pending rename vote',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const created=await call(teacher,'planet:create',{name:'독서행성',description:'',x:190,y:175,color:PLANET_COLORS[0],templateId:'reading'});
 const s1=await connect(),s2=await connect();
 await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 await call(s1,'planet:join',{planetId:created.planetId});
 await call(s2,'planet:join',{planetId:created.planetId});
 await call(s1,'planet:rename:propose',{planetId:created.planetId,name:'책읽기행성'});
 const sysMsgs=[];teacher.on('chat:message',m=>sysMsgs.push(m));
 assert.ok((await call(s2,'room:leave')).ok);
 await sleep(20);
 const planet=game.store.rooms.get(r.room.code).planets.get(created.planetId);
 assert.equal(planet.name,'책읽기행성');assert.equal(planet.rename,null);
 assert.ok(sysMsgs.some(m=>m.text==='"독서행성" 행성의 이름이 "책읽기행성"으로 바뀌었어요!'));
});
test('teacher can rename a planet directly, clearing any pending vote',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const created=await call(teacher,'planet:create',{name:'일기행성',description:'',x:1010,y:175,color:PLANET_COLORS[1],templateId:'diary'});
 const s1=await connect(),s2=await connect();
 await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 await call(s1,'planet:join',{planetId:created.planetId});
 await call(s2,'planet:join',{planetId:created.planetId});
 await call(s1,'planet:rename:propose',{planetId:created.planetId,name:'기록행성'});
 assert.equal((await call(s1,'planet:rename:set',{planetId:created.planetId,name:'새이름'})).error,'선생님만 할 수 있어요.');
 const sysMsgs=[];teacher.on('chat:message',m=>sysMsgs.push(m));
 const set=await call(teacher,'planet:rename:set',{planetId:created.planetId,name:'새이름'});
 assert.equal(set.ok,true);
 await sleep(20);
 const planet=game.store.rooms.get(r.room.code).planets.get(created.planetId);
 assert.equal(planet.name,'새이름');assert.equal(planet.rename,null);
 assert.ok(sysMsgs.some(m=>m.text==='선생님이 "일기행성" 행성의 이름을 "새이름"으로 바꿨어요.'));
 assert.equal((await call(teacher,'planet:rename:set',{planetId:created.planetId,name:'새이름'})).error,'지금 이름과 같아요.');
});
test('planet system messages do not leak to another classroom',async t=>{
 const {connect}=await fixture(t),teacherA=await connect(),teacherB=await connect();
 const ra=await create(teacherA),rb=await create(teacherB);
 const a1=await connect(),b1=await connect();
 await call(a1,'room:join',{code:ra.room.code,nickname:'1'});
 await call(b1,'room:join',{code:rb.room.code,nickname:'1'});
 let leaked=false;teacherB.on('chat:message',()=>{leaked=true;});b1.on('chat:message',()=>{leaked=true;});
 const proposed=await call(a1,'planet:propose',{name:'독서행성',description:'',x:190,y:175,color:PLANET_COLORS[0],templateId:'reading'});
 assert.equal(proposed.ok,true);
 assert.equal((await call(teacherA,'planet:approve',{proposalId:proposed.proposalId})).ok,true);
 await sleep(60);
 assert.equal(leaked,false);
});
test('resume preserves the player mapId and department after reconnecting',async t=>{
 const {connect,game}=await fixture(t,{reconnectMs:500}),teacher=await connect(),r=await create(teacher);
 const created=await call(teacher,'planet:create',{name:'독서행성',description:'',x:190,y:175,color:PLANET_COLORS[0],templateId:'reading'});
 const s=await connect(),joined=await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const p=game.store.rooms.get(r.room.code).players.get(joined.selfId);
 await call(s,'planet:join',{planetId:created.planetId});
 p.x=190;p.y=175+PLANET.radius;
 await call(s,'planet:enter',{planetId:created.planetId});
 assert.equal(p.mapId,interiorIdOf(created.planetId));
 s.disconnect();await sleep(60);
 const resumed=await connect();
 const result=await call(resumed,'session:resume',{token:joined.token});
 assert.ok(result.ok);
 assert.equal(p.mapId,interiorIdOf(created.planetId));
 assert.equal(p.avatar.departmentId,created.planetId);
 const rp=result.room.players.find(x=>x.id===joined.selfId);
 assert.equal(rp.mapId,interiorIdOf(created.planetId));
 assert.equal(rp.departmentId,created.planetId);
});
test('resume includes recent chat history, trimmed to the configured size from the oldest end',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s=await connect(),joined=await call(s,'room:join',{code:r.room.code,nickname:'1'});
 await call(s,'chat:send',{text:'재접속 전 인사'});
 s.disconnect();await sleep(60);
 const resumedSocket=await connect();
 const result=await call(resumedSocket,'session:resume',{token:joined.token});
 assert.ok(result.ok);assert.ok(result.chat.messages.some(m=>m.text==='재접속 전 인사'));
 const room=game.store.rooms.get(r.room.code);
 for(let i=0;i<60;i++) game.store.pushChat(room,{playerId:null,nickname:'안내',role:'system',text:'채움'+i,flagged:false});
 assert.equal(room.chat.history.length,50);
 resumedSocket.disconnect();await sleep(60);
 const resumedAgain=await connect();
 const result2=await call(resumedAgain,'session:resume',{token:joined.token});
 assert.equal(result2.chat.messages.length,50);
 assert.equal(result2.chat.messages[0].text,'채움10');
 assert.equal(result2.chat.messages[49].text,'채움59');
});
test('map:travel requires a nearby gate to a real map; success moves the player to the arrival point',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s=await connect(),joined=await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const p=game.store.rooms.get(r.room.code).players.get(joined.selfId);
 const invalidTo=await call(s,'map:travel',{to:'nowhere'});
 assert.equal(invalidTo.ok,false);assert.equal(invalidTo.error,'그런 곳은 없어요.');
 const tooFar=await call(s,'map:travel',{to:STREET_ID});
 assert.equal(tooFar.ok,false);assert.equal(tooFar.error,'문에 더 가까이 가주세요.');
 const gate=MAP.objects.find(o=>o.kind==='gate');
 p.x=gate.x;p.y=gate.y;
 const travelled=await call(s,'map:travel',{to:STREET_ID});
 assert.equal(travelled.ok,true);
 assert.equal(p.mapId,STREET_ID);
 assert.ok(Math.hypot(p.x-gate.arrival.x,p.y-gate.arrival.y)<400);
 const streetGate=STREET.objects.find(o=>o.kind==='gate');
 const stillFar=await call(s,'map:travel',{to:PLAZA_ID});
 assert.equal(stillFar.ok,false);assert.equal(stillFar.error,'문에 더 가까이 가주세요.');
 p.x=streetGate.x;p.y=streetGate.y;
 const back=await call(s,'map:travel',{to:PLAZA_ID});
 assert.equal(back.ok,true);assert.equal(p.mapId,PLAZA_ID);
 const created=await call(teacher,'planet:create',{name:'독서행성',description:'',x:190,y:175,color:PLANET_COLORS[0],templateId:'reading'});
 await call(s,'planet:join',{planetId:created.planetId});
 p.x=190;p.y=175+PLANET.radius;
 await call(s,'planet:enter',{planetId:created.planetId});
 const insideTravel=await call(s,'map:travel',{to:STREET_ID});
 assert.equal(insideTravel.ok,false);assert.equal(insideTravel.error,'여기서는 그곳으로 갈 수 없어요.');
});
// 행성 자리는 광장 좌표라, 광장 밖(별빛 거리·행성 안)에서 신청·생성하면 보이지 않는 곳에 행성이 생깁니다.
// 화면에서는 버튼을 숨기지만 서버도 같은 규칙을 지켜야 합니다.
test('new planets can only be proposed or created from the plaza, not from the star street or inside a planet',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s=await connect(),joined=await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const room=game.store.rooms.get(r.room.code);
 const p=room.players.get(joined.selfId);
 const tp=[...room.players.values()].find(x=>x.role==='teacher');
 const gate=MAP.objects.find(o=>o.kind==='gate');
 p.x=gate.x;p.y=gate.y;
 assert.equal((await call(s,'map:travel',{to:STREET_ID})).ok,true);
 const fromStreet=await call(s,'planet:propose',{name:'몰래행성',description:'',x:600,y:420,color:PLANET_COLORS[0]});
 assert.equal(fromStreet.ok,false);
 assert.equal(fromStreet.error,'광장에서만 새 행성을 만들 수 있어요. 먼저 우주 광장으로 돌아와주세요.');
 assert.equal(room.proposals.size,0);
 const base=await call(teacher,'planet:create',{name:'기준행성',description:'',x:190,y:175,color:PLANET_COLORS[1],templateId:'meal'});
 assert.equal(base.ok,true);
 tp.x=190;tp.y=175+PLANET.radius;
 assert.equal((await call(teacher,'planet:enter',{planetId:base.planetId})).ok,true);
 const fromInside=await call(teacher,'planet:create',{name:'내부행성',description:'',x:1010,y:565,color:PLANET_COLORS[2]});
 assert.equal(fromInside.ok,false);
 assert.equal(fromInside.error,'광장에서만 새 행성을 만들 수 있어요. 먼저 우주 광장으로 돌아와주세요.');
 assert.equal(room.planets.size,1);
});
test('teacher gives or takes star shards from one student or everyone; amounts are validated, clamped, and privately whispered',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s1=await connect(),s2=await connect();
 const j1=await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 const j2=await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 const p1=game.store.rooms.get(r.room.code).players.get(j1.selfId);
 const p2=game.store.rooms.get(r.room.code).players.get(j2.selfId);
 assert.equal((await call(s1,'shards:give',{playerId:j1.selfId,amount:10})).error,'선생님만 할 수 있어요.');
 for(const amount of [0,1000,1.5,-1000])
  assert.equal((await call(teacher,'shards:give',{playerId:j1.selfId,amount})).error,'별 파편 개수는 1~999 사이 정수로 적어주세요.');
 assert.equal((await call(teacher,'shards:give',{playerId:'nope',amount:5})).error,'친구를 찾지 못했어요.');
 // 별 파편 지급/회수는 더 이상 공개 채팅에 나가지 않고, 받는 학생에게만 개인 안내(private)가 갑니다.
 const teacherMsgs=[];teacher.on('chat:message',m=>teacherMsgs.push(m));
 const msgs1=[];s1.on('chat:message',m=>msgs1.push(m));
 const msgs2=[];s2.on('chat:message',m=>msgs2.push(m));
 assert.equal((await call(teacher,'shards:give',{playerId:j1.selfId,amount:10})).ok,true);
 assert.equal(p1.starShards,10);
 assert.equal((await call(teacher,'shards:give',{playerId:j1.selfId,amount:-3})).ok,true);
 assert.equal(p1.starShards,7);
 assert.equal((await call(teacher,'shards:give',{playerId:j1.selfId,amount:-100})).ok,true);
 assert.equal(p1.starShards,0);
 p1.starShards=SHARDS.max-5;
 assert.equal((await call(teacher,'shards:give',{playerId:j1.selfId,amount:SHARDS.giveMax})).ok,true);
 assert.equal(p1.starShards,SHARDS.max);
 assert.equal((await call(teacher,'shards:give',{playerId:'all',amount:5})).ok,true);
 assert.equal(p2.starShards,5);
 assert.equal((await call(teacher,'shards:give',{playerId:'all',amount:-2})).ok,true);
 assert.equal(p2.starShards,3);
 await sleep(20);
 assert.equal(teacherMsgs.length,0);
 assert.ok(msgs1.some(m=>m.text==='선생님이 나에게 별 파편 10개를 주었어요.' && m.private===true && m.playerId===null));
 assert.ok(msgs1.some(m=>m.text==='선생님이 내 별 파편 3개를 거두었어요.'));
 assert.ok(msgs1.some(m=>m.text==='선생님이 내 별 파편 100개를 거두었어요.'));
 assert.ok(msgs1.some(m=>m.text==='선생님이 나에게 별 파편 '+SHARDS.giveMax+'개를 주었어요.'));
 // playerId:'all'은 학생 전원(1과 2 모두)에게 개인 안내가 갑니다.
 assert.ok(msgs1.some(m=>m.text==='선생님이 나에게 별 파편 5개를 주었어요.'));
 assert.ok(msgs1.some(m=>m.text==='선생님이 내 별 파편 2개를 거두었어요.'));
 assert.ok(msgs2.some(m=>m.text==='선생님이 나에게 별 파편 5개를 주었어요.'));
 assert.ok(msgs2.some(m=>m.text==='선생님이 내 별 파편 2개를 거두었어요.'));
 // 1에게만 보낸 개별 지급/회수 안내는 2에게 새지 않습니다.
 assert.equal(msgs2.filter(m=>m.text==='선생님이 나에게 별 파편 10개를 주었어요.').length,0);
 assert.equal(msgs2.filter(m=>m.text==='선생님이 내 별 파편 3개를 거두었어요.').length,0);
 assert.equal(msgs2.filter(m=>m.text==='선생님이 내 별 파편 100개를 거두었어요.').length,0);
 assert.equal(msgs2.filter(m=>m.text==='선생님이 나에게 별 파편 '+SHARDS.giveMax+'개를 주었어요.').length,0);
});
test('star shards and star-street purchases stay isolated per classroom',async t=>{
 const {connect,game}=await fixture(t),teacherA=await connect(),teacherB=await connect();
 const ra=await create(teacherA),rb=await create(teacherB);
 const a1=await connect(),b1=await connect();
 const ja=await call(a1,'room:join',{code:ra.room.code,nickname:'1'});
 const jb=await call(b1,'room:join',{code:rb.room.code,nickname:'1'});
 assert.equal((await call(teacherA,'shards:give',{playerId:ja.selfId,amount:20})).ok,true);
 const pa=game.store.rooms.get(ra.room.code).players.get(ja.selfId);
 const pb=game.store.rooms.get(rb.room.code).players.get(jb.selfId);
 assert.equal(pa.starShards,20);assert.equal(pb.starShards,0);
 assert.equal((await call(teacherB,'shards:give',{playerId:ja.selfId,amount:5})).error,'친구를 찾지 못했어요.');
});
test('star shop enforces location, funds, stack and bag limits; buying and selling update shards and inventory together',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s=await connect(),joined=await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const p=game.store.rooms.get(r.room.code).players.get(joined.selfId);
 const item=SHOP.items[0];
 const fromPlaza=await call(s,'shop:buy',{itemId:item.id,quantity:1});
 assert.equal(fromPlaza.ok,false);assert.equal(fromPlaza.error,'별상점은 별빛 거리에 있어요.');
 const gate=MAP.objects.find(o=>o.kind==='gate');
 p.x=gate.x;p.y=gate.y;
 assert.equal((await call(s,'map:travel',{to:STREET_ID})).ok,true);
 const farBuy=await call(s,'shop:buy',{itemId:item.id,quantity:1});
 assert.equal(farBuy.ok,false);assert.equal(farBuy.error,'별상점에 더 가까이 가주세요.');
 const shop=STREET.objects.find(o=>o.kind==='shop');
 p.x=shop.x;p.y=shop.y;
 const noFunds=await call(s,'shop:buy',{itemId:item.id,quantity:1});
 assert.equal(noFunds.ok,false);assert.equal(noFunds.error,'별 파편이 부족해요. (필요 '+item.price+'개, 지금 0개)');
 assert.equal((await call(teacher,'shards:give',{playerId:joined.selfId,amount:100})).ok,true);
 const bought=await call(s,'shop:buy',{itemId:item.id,quantity:2});
 assert.equal(bought.ok,true);
 assert.equal(bought.starShards,100-item.price*2);
 assert.equal(p.starShards,bought.starShards);
 assert.deepEqual(bought.inventory,[{id:item.id,quantity:2}]);
 assert.deepEqual(p.inventory,[{id:item.id,quantity:2}]);
 const badItem=await call(s,'shop:buy',{itemId:'nope',quantity:1});
 assert.equal(badItem.ok,false);assert.equal(badItem.error,'그런 물건은 없어요.');
 for(const quantity of [0,11]){
  const res=await call(s,'shop:buy',{itemId:item.id,quantity});
  assert.equal(res.ok,false);assert.equal(res.error,'1~10개씩 사고팔 수 있어요.');
 }
 p.starShards=SHARDS.max;
 p.inventory=[{id:item.id,quantity:95}];
 const overStack=await call(s,'shop:buy',{itemId:item.id,quantity:5});
 assert.equal(overStack.ok,false);assert.equal(overStack.error,'한 종류는 99개까지만 가질 수 있어요.');
 const otherItem=SHOP.items[1];
 p.inventory=SHOP.items.filter(it=>it.id!==otherItem.id).map(it=>({id:it.id,quantity:1}))
   .concat(Array.from({length:SHOP.maxKinds-(SHOP.items.length-1)},(_,i)=>({id:'filler'+i,quantity:1})));
 assert.equal(p.inventory.length,SHOP.maxKinds);
 const fullBag=await call(s,'shop:buy',{itemId:otherItem.id,quantity:1});
 assert.equal(fullBag.ok,false);assert.equal(fullBag.error,'가방이 가득 찼어요.');
 p.inventory=[{id:item.id,quantity:4}];p.starShards=0;
 const sellTooMany=await call(s,'shop:sell',{itemId:item.id,quantity:5});
 assert.equal(sellTooMany.ok,false);assert.equal(sellTooMany.error,'그만큼 가지고 있지 않아요.');
 const sold=await call(s,'shop:sell',{itemId:item.id,quantity:4});
 assert.equal(sold.ok,true);
 assert.equal(sold.starShards,Math.floor(item.price*SHOP.sellRate)*4);
 assert.equal(p.starShards,sold.starShards);
 assert.deepEqual(sold.inventory,[]);
 assert.deepEqual(p.inventory,[]);
});
test('resume after reconnecting keeps star shards, inventory and the star-street map',async t=>{
 const {connect,game}=await fixture(t,{reconnectMs:500}),teacher=await connect(),r=await create(teacher);
 const s=await connect(),joined=await call(s,'room:join',{code:r.room.code,nickname:'1'});
 const p=game.store.rooms.get(r.room.code).players.get(joined.selfId);
 const gate=MAP.objects.find(o=>o.kind==='gate');
 p.x=gate.x;p.y=gate.y;
 assert.equal((await call(s,'map:travel',{to:STREET_ID})).ok,true);
 assert.equal((await call(teacher,'shards:give',{playerId:joined.selfId,amount:30})).ok,true);
 const shop=STREET.objects.find(o=>o.kind==='shop');
 p.x=shop.x;p.y=shop.y;
 const item=SHOP.items[0];
 assert.equal((await call(s,'shop:buy',{itemId:item.id,quantity:1})).ok,true);
 s.disconnect();await sleep(60);
 const resumed=await connect();
 const result=await call(resumed,'session:resume',{token:joined.token});
 assert.ok(result.ok);
 assert.equal(p.mapId,STREET_ID);
 assert.equal(p.starShards,30-item.price);
 assert.deepEqual(p.inventory,[{id:item.id,quantity:1}]);
 const rp=result.room.players.find(x=>x.id===joined.selfId);
 assert.equal(rp.mapId,STREET_ID);
 assert.equal(rp.starShards,30-item.price);
 assert.deepEqual(rp.inventory,[{id:item.id,quantity:1}]);
});
test("whisper reaches only the target's own socket as a private system message, and survives reconnect merged into chat history",async t=>{
 const {connect,game}=await fixture(t,{reconnectMs:500}),teacher=await connect(),r=await create(teacher);
 const s1=await connect(),s2=await connect();
 const j1=await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 let leaked=false;s2.on('chat:message',()=>{leaked=true;});teacher.on('chat:message',()=>{leaked=true;});
 const msgs1=[];s1.on('chat:message',m=>msgs1.push(m));
 assert.equal((await call(teacher,'shards:give',{playerId:j1.selfId,amount:7})).ok,true);
 await sleep(20);
 assert.equal(leaked,false);
 assert.ok(msgs1.some(m=>m.text==='선생님이 나에게 별 파편 7개를 주었어요.' && m.private===true && m.role==='system' && m.nickname==='안내' && m.playerId===null));
 s1.disconnect();await sleep(60);
 const resumed=await connect();
 const result=await call(resumed,'session:resume',{token:j1.token});
 assert.ok(result.ok);
 assert.ok(result.chat.messages.some(m=>m.text==='선생님이 나에게 별 파편 7개를 주었어요.' && m.private===true));
});
test('item:use lets a player use an owned item on themself or a friend: it is consumed and applies a timed effect that a later use refreshes instead of duplicating',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s1=await connect(),s2=await connect(),s3=await connect(),s4=await connect();
 const j1=await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 const j2=await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 const j3=await call(s3,'room:join',{code:r.room.code,nickname:'3'});
 const j4=await call(s4,'room:join',{code:r.room.code,nickname:'4'});
 const room=game.store.rooms.get(r.room.code);
 const p1=room.players.get(j1.selfId),p3=room.players.get(j3.selfId);
 const sticker=SHOP.items.find(i=>i.id==='star-sticker');
 p1.inventory=[{id:sticker.id,quantity:1}];
 const selfUse=await call(s1,'item:use',{itemId:sticker.id,targetId:j1.selfId});
 assert.equal(selfUse.ok,true);
 assert.deepEqual(selfUse.inventory,[]);
 assert.equal(p1.inventory.length,0);
 assert.equal(p1.effects.length,1);
 assert.equal(p1.effects[0].itemId,sticker.id);
 assert.equal(p1.effects[0].icon,sticker.effect.icon);
 assert.equal(p1.effects[0].label,sticker.effect.label);
 assert.ok(p1.effects[0].until>Date.now());
 assert.ok(!('fromId' in selfUse.effects[0])); // 학생 ack에는 선생님이 아니므로 누가 썼는지 정보가 없음
 room.players.get(j2.selfId).inventory=[{id:sticker.id,quantity:1}];
 const otherUse=await call(s2,'item:use',{itemId:sticker.id,targetId:j3.selfId});
 assert.equal(otherUse.ok,true);
 assert.equal(p3.effects.length,1);
 const firstUntil=p3.effects[0].until;
 room.players.get(j4.selfId).inventory=[{id:sticker.id,quantity:1}];
 const refreshed=await call(s4,'item:use',{itemId:sticker.id,targetId:j3.selfId});
 assert.equal(refreshed.ok,true);
 assert.equal(p3.effects.length,1); // 같은 아이템이므로 새로 추가되지 않고 시간만 갱신됩니다.
 assert.ok(p3.effects[0].until>=firstUntil);
});
test('item:use caps a player at 3 active effects, dropping the one closest to expiring when a 4th distinct item lands',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const sockets=await Promise.all(Array.from({length:4},()=>connect()));
 const joins=await Promise.all(sockets.map((s,i)=>call(s,'room:join',{code:r.room.code,nickname:String(i+1)})));
 const room=game.store.rooms.get(r.room.code);
 const target=room.players.get(joins[0].selfId);
 const give=(i,itemId)=>{room.players.get(joins[i].selfId).inventory=[{id:itemId,quantity:1}];};
 give(1,'space-snack'); // 5분(가장 짧음)
 give(2,'firefly-lamp'); // 10분
 give(3,'star-sticker'); // 30분
 assert.equal((await call(sockets[1],'item:use',{itemId:'space-snack',targetId:joins[0].selfId})).ok,true);
 assert.equal((await call(sockets[2],'item:use',{itemId:'firefly-lamp',targetId:joins[0].selfId})).ok,true);
 assert.equal((await call(sockets[3],'item:use',{itemId:'star-sticker',targetId:joins[0].selfId})).ok,true);
 assert.equal(target.effects.length,3);
 give(0,'asteroid-helmet'); // 4번째(30분), 대상 스스로 자기에게 씀(쿨다운 문제 없음)
 const fourth=await call(sockets[0],'item:use',{itemId:'asteroid-helmet',targetId:joins[0].selfId});
 assert.equal(fourth.ok,true);
 assert.equal(target.effects.length,3);
 assert.ok(!target.effects.some(e=>e.itemId==='space-snack')); // 가장 먼저 끝나는 효과가 사라짐
 assert.ok(target.effects.some(e=>e.itemId==='firefly-lamp'));
 assert.ok(target.effects.some(e=>e.itemId==='star-sticker'));
 assert.ok(target.effects.some(e=>e.itemId==='asteroid-helmet'));
});
test('item:use validates ownership, level gates, target existence/connection, and self-only items',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s1=await connect(),s2=await connect(),s3=await connect();
 const j1=await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 const j2=await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 const j3=await call(s3,'room:join',{code:r.room.code,nickname:'3'});
 const room=game.store.rooms.get(r.room.code);
 const p1=room.players.get(j1.selfId),p3=room.players.get(j3.selfId);
 assert.equal((await call(s1,'item:use',{itemId:'nope',targetId:j1.selfId})).error,'그런 물건은 없어요.');
 assert.equal((await call(s1,'item:use',{itemId:'star-sticker',targetId:j1.selfId})).error,'가방에 그 물건이 없어요.');
 p1.inventory=[{id:'rainbow-tail',quantity:1}];
 assert.equal((await call(s1,'item:use',{itemId:'rainbow-tail',targetId:j1.selfId})).error,'LV 2부터 쓸 수 있어요.');
 p1.inventory=[{id:'star-sticker',quantity:1}];
 assert.equal((await call(s1,'item:use',{itemId:'star-sticker',targetId:'nope'})).error,'그 친구는 지금 없어요.');
 p3.connected=false;
 assert.equal((await call(s1,'item:use',{itemId:'star-sticker',targetId:j3.selfId})).error,'그 친구는 지금 없어요.');
 p3.connected=true;
 assert.equal((await call(s1,'item:use',{itemId:'star-sticker',targetId:r.selfId})).error,'나보다 레벨이 높은 친구에게는 쓸 수 없어요.');
 p1.avatar.level=2;p1.inventory=[{id:'rainbow-tail',quantity:1}];
 assert.equal((await call(s1,'item:use',{itemId:'rainbow-tail',targetId:j2.selfId})).error,'이 물건은 나에게만 쓸 수 있어요.');
 assert.equal((await call(s1,'item:use',{itemId:'rainbow-tail',targetId:j1.selfId})).ok,true);
});
test('item:use enforces a per-actor cooldown between uses',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s1=await connect();
 const j1=await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 const p1=game.store.rooms.get(r.room.code).players.get(j1.selfId);
 p1.inventory=[{id:'star-sticker',quantity:2}];
 assert.equal((await call(s1,'item:use',{itemId:'star-sticker',targetId:j1.selfId})).ok,true);
 const second=await call(s1,'item:use',{itemId:'star-sticker',targetId:j1.selfId});
 assert.equal(second.ok,false);assert.equal(second.error,'조금 천천히 써요.');
 assert.equal(p1.inventory[0].quantity,1); // 실패한 시도는 소비되지 않음
});
test('item:use announces the user and target in public chat, keeps secret-item users anonymous except to the teacher, and logs every use for the teacher only',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s1=await connect(),s2=await connect();
 const j1=await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 const j2=await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 const room=game.store.rooms.get(r.room.code);
 const p1=room.players.get(j1.selfId);
 p1.inventory=[{id:'star-sticker',quantity:2},{id:'space-snack',quantity:2}];
 const publicToS2=[];s2.on('chat:message',m=>publicToS2.push(m));
 const teacherMsgs=[];teacher.on('chat:message',m=>teacherMsgs.push(m));
 const teacherStates=[];teacher.on('room:state',st=>teacherStates.push(st));
 const s2States=[];s2.on('room:state',st=>s2States.push(st));
 assert.equal((await call(s1,'item:use',{itemId:'star-sticker',targetId:j1.selfId})).ok,true); // 일반 아이템, 자기 대상
 p1.lastItemUseAt=0;
 assert.equal((await call(s1,'item:use',{itemId:'star-sticker',targetId:j2.selfId})).ok,true); // 일반 아이템, 타인 대상
 p1.lastItemUseAt=0;
 assert.equal((await call(s1,'item:use',{itemId:'space-snack',targetId:j1.selfId})).ok,true); // 비밀 아이템, 자기 대상
 p1.lastItemUseAt=0;
 assert.equal((await call(s1,'item:use',{itemId:'space-snack',targetId:j2.selfId})).ok,true); // 비밀 아이템, 타인 대상
 await sleep(30);
 assert.ok(publicToS2.some(m=>m.text==='1 친구가 반짝 별 스티커를 썼어요.'));
 assert.ok(publicToS2.some(m=>m.text==='1 친구가 2 친구에게 반짝 별 스티커를 썼어요.'));
 assert.ok(publicToS2.some(m=>m.text==='1 친구에게 우주 간식이 조용히 생겼어요.'));
 assert.ok(publicToS2.some(m=>m.text==='누군가 2 친구에게 우주 간식을 썼어요.'));
 assert.ok(!publicToS2.some(m=>m.text.includes('선생님만')));
 assert.ok(teacherMsgs.some(m=>m.text==='(선생님만) 1 친구가 1 친구에게 우주 간식을 썼어요.' && m.private===true));
 assert.ok(teacherMsgs.some(m=>m.text==='(선생님만) 1 친구가 2 친구에게 우주 간식을 썼어요.'));
 assert.equal(room.itemLog.length,4);
 assert.ok(teacherStates.some(st=>st.itemLog && st.itemLog.length===4));
 assert.ok(s2States.every(st=>!('itemLog' in st)));
});
test('an expired item effect is cleared by the periodic tick and the room is refreshed',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s1=await connect();
 const j1=await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 const p1=game.store.rooms.get(r.room.code).players.get(j1.selfId);
 p1.inventory=[{id:'star-sticker',quantity:1}];
 assert.equal((await call(s1,'item:use',{itemId:'star-sticker',targetId:j1.selfId})).ok,true);
 assert.equal(p1.effects.length,1);
 p1.effects[0].until=Date.now()-1000; // durationMs를 짧게 만들기 어려우므로 이미 끝난 것처럼 바꿔둡니다.
 const states=[];s1.on('room:state',st=>states.push(st));
 await sleep(1200);
 assert.equal(p1.effects.length,0);
 assert.ok(states.some(st=>st.players.find(p=>p.id===j1.selfId).effects.length===0));
});
test('trade:propose validates the give/want shapes, requires a real connected student target, and rejects teachers',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s1=await connect(),s2=await connect(),s3=await connect();
 const j1=await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 const j2=await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 const j3=await call(s3,'room:join',{code:r.room.code,nickname:'3'});
 const room=game.store.rooms.get(r.room.code);
 const p1=room.players.get(j1.selfId);
 const empty={shards:0,items:[]};
 assert.equal((await call(teacher,'trade:propose',{targetId:j1.selfId,give:{shards:1,items:[]},want:empty})).error,'선생님은 거래하지 않아요.');
 assert.equal((await call(s1,'trade:propose',{targetId:r.selfId,give:{shards:1,items:[]},want:empty})).error,'친구를 찾지 못했어요.');
 assert.equal((await call(s1,'trade:propose',{targetId:j1.selfId,give:{shards:1,items:[]},want:empty})).error,'친구를 찾지 못했어요.');
 assert.equal((await call(s1,'trade:propose',{targetId:'nope',give:{shards:1,items:[]},want:empty})).error,'친구를 찾지 못했어요.');
 room.players.get(j3.selfId).connected=false;
 assert.equal((await call(s1,'trade:propose',{targetId:j3.selfId,give:{shards:1,items:[]},want:empty})).error,'그 친구는 지금 없어요.');
 for(const bad of [{shards:-1,items:[]},{shards:1.5,items:[]},{shards:TRADE.maxShards+1,items:[]},
   {shards:0,items:[{id:'nope',quantity:1}]},{shards:0,items:[{id:'star-sticker',quantity:0}]},
   {shards:0,items:[{id:'star-sticker',quantity:100}]},
   {shards:0,items:[{id:'star-sticker',quantity:1},{id:'star-sticker',quantity:1}]},
   {shards:0,items:Array.from({length:TRADE.maxItemKinds+1},()=>({id:'star-sticker',quantity:1}))}])
  assert.equal((await call(s1,'trade:propose',{targetId:j2.selfId,give:bad,want:empty})).error,'거래 내용을 확인해주세요.');
 assert.equal((await call(s1,'trade:propose',{targetId:j2.selfId,give:empty,want:empty})).error,'주거나 받을 것을 하나는 적어주세요.');
 assert.equal((await call(s1,'trade:propose',{targetId:j2.selfId,give:{shards:5,items:[]},want:empty})).error,
   '주려는 것을 충분히 가지고 있지 않아요.');
 p1.starShards=5;
 assert.equal((await call(s1,'trade:propose',{targetId:j2.selfId,give:{shards:5,items:[]},want:empty})).ok,true);
});
test('trade:propose blocks a second trade while one is pending for either side, and enforces the room-wide pending limit',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const count=TRADE.maxPending*2+2;
 const sockets=await Promise.all(Array.from({length:count},()=>connect()));
 const joins=await Promise.all(sockets.map((s,i)=>call(s,'room:join',{code:r.room.code,nickname:String(i+1)})));
 const room=game.store.rooms.get(r.room.code);
 for(const j of joins) room.players.get(j.selfId).starShards=10;
 const give={shards:1,items:[]},empty={shards:0,items:[]};
 const first=await call(sockets[0],'trade:propose',{targetId:joins[1].selfId,give,want:empty});
 assert.equal(first.ok,true);
 assert.equal((await call(sockets[0],'trade:propose',{targetId:joins[2].selfId,give,want:empty})).error,
   '진행 중인 거래가 있어요. 먼저 끝내주세요.');
 assert.equal((await call(sockets[2],'trade:propose',{targetId:joins[1].selfId,give,want:empty})).error,
   '진행 중인 거래가 있어요. 먼저 끝내주세요.');
 for(let i=2;i<TRADE.maxPending*2;i+=2){
  const res=await call(sockets[i],'trade:propose',{targetId:joins[i+1].selfId,give,want:empty});
  assert.equal(res.ok,true,'pair '+i+' failed: '+res.error);
 }
 assert.equal(room.trades.size,TRADE.maxPending);
 const overflow=await call(sockets[TRADE.maxPending*2],'trade:propose',
   {targetId:joins[TRADE.maxPending*2+1].selfId,give,want:empty});
 assert.equal(overflow.ok,false);assert.equal(overflow.error,'기다리는 거래가 너무 많아요.');
});
test('trade:respond lets only the recipient answer; declining removes the trade and whispers the proposer',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s1=await connect(),s2=await connect(),s3=await connect();
 const j1=await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 const j2=await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 await call(s3,'room:join',{code:r.room.code,nickname:'3'});
 const room=game.store.rooms.get(r.room.code);
 room.players.get(j1.selfId).starShards=10;
 const propose=await call(s1,'trade:propose',{targetId:j2.selfId,give:{shards:5,items:[]},want:{shards:0,items:[]}});
 assert.equal(propose.ok,true);
 assert.equal((await call(s3,'trade:respond',{tradeId:propose.tradeId,accept:true})).error,'내가 받은 제안이 아니에요.');
 assert.equal((await call(s1,'trade:respond',{tradeId:propose.tradeId,accept:true})).error,'내가 받은 제안이 아니에요.');
 const msgs1=[];s1.on('chat:message',m=>msgs1.push(m));
 const declined=await call(s2,'trade:respond',{tradeId:propose.tradeId,accept:false});
 assert.equal(declined.ok,true);
 assert.equal(room.trades.size,0);
 await sleep(20);
 assert.ok(msgs1.some(m=>m.text==='2 친구가 거래를 거절했어요.' && m.private===true));
 assert.equal((await call(s2,'trade:respond',{tradeId:propose.tradeId,accept:true})).error,'내가 받은 제안이 아니에요.');
});
test('trade:respond accept requires the recipient really has what they promise; teacher approval swaps shards and items atomically and logs it for the teacher',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s1=await connect(),s2=await connect();
 const j1=await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 const j2=await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 const room=game.store.rooms.get(r.room.code);
 const p1=room.players.get(j1.selfId),p2=room.players.get(j2.selfId);
 p1.starShards=20;p1.inventory=[{id:'star-sticker',quantity:3}];
 p2.starShards=3;p2.inventory=[{id:'firefly-lamp',quantity:1}];
 const propose=await call(s1,'trade:propose',
   {targetId:j2.selfId,give:{shards:10,items:[{id:'star-sticker',quantity:2}]},want:{shards:5,items:[{id:'firefly-lamp',quantity:1}]}});
 assert.equal(propose.ok,true);
 const insufficientWant=await call(s2,'trade:respond',{tradeId:propose.tradeId,accept:true});
 assert.equal(insufficientWant.ok,false);assert.equal(insufficientWant.error,'받고 싶다는 것을 내가 충분히 가지고 있지 않아요.');
 assert.equal(room.trades.get(propose.tradeId).status,'proposed');
 p2.starShards=5;
 const teacherStates=[];teacher.on('room:state',st=>teacherStates.push(st));
 const msgs1=[];s1.on('chat:message',m=>msgs1.push(m));
 const teacherMsgs=[];teacher.on('chat:message',m=>teacherMsgs.push(m));
 const accepted=await call(s2,'trade:respond',{tradeId:propose.tradeId,accept:true});
 assert.equal(accepted.ok,true);
 assert.equal(room.trades.get(propose.tradeId).status,'accepted');
 await sleep(20);
 assert.ok(msgs1.some(m=>m.text==='2 친구가 수락했어요. 선생님 승인을 기다려요.'));
 assert.ok(teacherMsgs.some(m=>m.text==='거래 승인 요청: 1 ↔ 2. 선생님 도구에서 확인해주세요.' && m.private===true));
 const msgs2=[];s2.on('chat:message',m=>msgs2.push(m));
 assert.equal((await call(s1,'trade:approve',{tradeId:propose.tradeId})).error,'선생님만 할 수 있어요.');
 const done=await call(teacher,'trade:approve',{tradeId:propose.tradeId});
 assert.equal(done.ok,true);
 assert.equal(room.trades.size,0);
 assert.equal(p1.starShards,20-10+5);assert.equal(p2.starShards,5-5+10);
 assert.equal(p1.inventory.find(i=>i.id==='star-sticker').quantity,1);
 assert.equal(p1.inventory.find(i=>i.id==='firefly-lamp').quantity,1);
 assert.equal(p2.inventory.find(i=>i.id==='star-sticker').quantity,2);
 assert.ok(!p2.inventory.some(i=>i.id==='firefly-lamp'));
 await sleep(20);
 assert.ok(msgs1.some(m=>m.text==='선생님이 거래를 승인했어요. 가방을 확인해보세요.'));
 assert.ok(msgs2.some(m=>m.text==='선생님이 거래를 승인했어요. 가방을 확인해보세요.'));
 assert.ok(teacherStates.some(st=>st.tradeLog && st.tradeLog.some(tl=>tl.result==='approved')));
});
test('trade:approve rejects and logs the trade when holdings changed since acceptance, or when the swap would overflow shards or the bag',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s1=await connect(),s2=await connect();
 const j1=await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 const j2=await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 const room=game.store.rooms.get(r.room.code);
 const p1=room.players.get(j1.selfId),p2=room.players.get(j2.selfId);
 p1.starShards=10;p2.starShards=10;
 const propose=await call(s1,'trade:propose',{targetId:j2.selfId,give:{shards:10,items:[]},want:{shards:5,items:[]}});
 assert.equal((await call(s2,'trade:respond',{tradeId:propose.tradeId,accept:true})).ok,true);
 p1.starShards=0; // 승인 전에 1이 가진 것을 다 써버림
 const msgs1a=[];s1.on('chat:message',m=>msgs1a.push(m));
 const msgs2a=[];s2.on('chat:message',m=>msgs2a.push(m));
 const failed=await call(teacher,'trade:approve',{tradeId:propose.tradeId});
 assert.equal(failed.ok,false);assert.equal(failed.error,'가진 것이 바뀌어서 거래할 수 없어요.');
 assert.equal(room.trades.size,0);
 assert.equal(p1.starShards,0);assert.equal(p2.starShards,10);
 await sleep(20);
 assert.ok(msgs1a.some(m=>m.text==='가진 것이 바뀌어서 거래할 수 없어요.'));
 assert.ok(msgs2a.some(m=>m.text==='가진 것이 바뀌어서 거래할 수 없어요.'));
 // 별 파편 상한 넘침
 p1.starShards=SHARDS.max-2;p2.starShards=10;
 const overflowShards=await call(s1,'trade:propose',{targetId:j2.selfId,give:{shards:0,items:[]},want:{shards:5,items:[]}});
 assert.equal((await call(s2,'trade:respond',{tradeId:overflowShards.tradeId,accept:true})).ok,true);
 const shardFail=await call(teacher,'trade:approve',{tradeId:overflowShards.tradeId});
 assert.equal(shardFail.ok,false);assert.equal(shardFail.error,'별 파편이 넘쳐서 거래할 수 없어요.');
 assert.equal(p1.starShards,SHARDS.max-2);assert.equal(p2.starShards,10);
 // 가방 종류 한도(SHOP.maxKinds) 넘침: 1의 가방을 반딧불 램프만 빼고 꽉 채운 뒤 2에게서 반딧불 램프를 받으면 한도를 넘깁니다.
 p1.starShards=10;p2.starShards=10;
 p1.inventory=SHOP.items.filter(it=>it.id!=='firefly-lamp').map(it=>({id:it.id,quantity:1}))
   .concat(Array.from({length:SHOP.maxKinds-(SHOP.items.length-1)},(_,i)=>({id:'filler'+i,quantity:1})));
 assert.equal(p1.inventory.length,SHOP.maxKinds);
 p2.inventory=[{id:'firefly-lamp',quantity:1}];
 const overflowBag=await call(s2,'trade:propose',{targetId:j1.selfId,give:{shards:0,items:[{id:'firefly-lamp',quantity:1}]},want:{shards:0,items:[]}});
 assert.equal(overflowBag.ok,true);
 assert.equal((await call(s1,'trade:respond',{tradeId:overflowBag.tradeId,accept:true})).ok,true);
 const bagFail=await call(teacher,'trade:approve',{tradeId:overflowBag.tradeId});
 assert.equal(bagFail.ok,false);assert.equal(bagFail.error,'가방이 가득 차서 거래할 수 없어요.');
 assert.equal(p1.inventory.length,SHOP.maxKinds);assert.equal(p2.inventory.length,1);
});
test('trade:cancel lets either party withdraw before teacher approval, notifying the other side only',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s1=await connect(),s2=await connect(),s3=await connect();
 const j1=await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 const j2=await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 await call(s3,'room:join',{code:r.room.code,nickname:'3'});
 const room=game.store.rooms.get(r.room.code);
 room.players.get(j1.selfId).starShards=10;
 const propose=await call(s1,'trade:propose',{targetId:j2.selfId,give:{shards:1,items:[]},want:{shards:0,items:[]}});
 assert.equal((await call(s3,'trade:cancel',{tradeId:propose.tradeId})).error,'내 거래가 아니에요.');
 const msgs1=[];s1.on('chat:message',m=>msgs1.push(m));
 assert.equal((await call(s2,'trade:cancel',{tradeId:propose.tradeId})).ok,true);
 assert.equal(room.trades.size,0);
 await sleep(20);
 assert.ok(msgs1.some(m=>m.text==='2 친구가 거래를 취소했어요.'));
 room.players.get(j1.selfId).starShards=10;
 const propose2=await call(s1,'trade:propose',{targetId:j2.selfId,give:{shards:1,items:[]},want:{shards:0,items:[]}});
 const msgs2=[];s2.on('chat:message',m=>msgs2.push(m));
 assert.equal((await call(s1,'trade:cancel',{tradeId:propose2.tradeId})).ok,true);
 await sleep(20);
 assert.ok(msgs2.some(m=>m.text==='1 친구가 거래를 취소했어요.'));
});
test('trade:reject works even on a merely proposed trade, and trades stay invisible to non-parties',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s1=await connect(),s2=await connect(),s3=await connect();
 const j1=await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 const j2=await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 await call(s3,'room:join',{code:r.room.code,nickname:'3'});
 const room=game.store.rooms.get(r.room.code);
 room.players.get(j1.selfId).starShards=10;
 const propose=await call(s1,'trade:propose',{targetId:j2.selfId,give:{shards:1,items:[]},want:{shards:0,items:[]}});
 assert.equal(propose.ok,true); // 아직 'proposed' 상태
 const msgs1=[];s1.on('chat:message',m=>msgs1.push(m));
 const msgs2=[];s2.on('chat:message',m=>msgs2.push(m));
 const states3=[];s3.on('room:state',st=>states3.push(st));
 assert.equal((await call(s2,'trade:reject',{tradeId:propose.tradeId})).error,'선생님만 할 수 있어요.');
 const rejected=await call(teacher,'trade:reject',{tradeId:propose.tradeId});
 assert.equal(rejected.ok,true);
 assert.equal(room.trades.size,0);
 await sleep(30);
 assert.ok(msgs1.some(m=>m.text==='선생님이 거래를 돌려보냈어요.'));
 assert.ok(msgs2.some(m=>m.text==='선생님이 거래를 돌려보냈어요.'));
 room.players.get(j1.selfId).starShards=10;
 const states1=[];s1.on('room:state',st=>states1.push(st));
 const propose2=await call(s1,'trade:propose',{targetId:j2.selfId,give:{shards:1,items:[]},want:{shards:0,items:[]}});
 assert.equal(propose2.ok,true);
 await sleep(30);
 assert.ok(states1.some(st=>st.trades.some(tr=>tr.id===propose2.tradeId)));
 assert.ok(states3.every(st=>st.trades.length===0)); // 3은 당사자가 아니므로 거래를 보지 못함
});
test('a pending trade is cancelled and the other side notified when either party leaves the classroom entirely',async t=>{
 const {connect,game}=await fixture(t),teacher=await connect(),r=await create(teacher);
 const s1=await connect(),s2=await connect();
 const j1=await call(s1,'room:join',{code:r.room.code,nickname:'1'});
 const j2=await call(s2,'room:join',{code:r.room.code,nickname:'2'});
 const room=game.store.rooms.get(r.room.code);
 room.players.get(j1.selfId).starShards=10;
 const propose=await call(s1,'trade:propose',{targetId:j2.selfId,give:{shards:1,items:[]},want:{shards:0,items:[]}});
 assert.equal(propose.ok,true);
 const msgs2=[];s2.on('chat:message',m=>msgs2.push(m));
 assert.equal((await call(s1,'room:leave')).ok,true);
 await sleep(20);
 assert.equal(room.trades.size,0);
 assert.ok(msgs2.some(m=>m.text.includes('나가서 거래가 취소되었어요.')));
});
test('trades never leak between classrooms',async t=>{
 const {connect,game}=await fixture(t),teacherA=await connect(),teacherB=await connect();
 const ra=await create(teacherA),rb=await create(teacherB);
 const a1=await connect(),a2=await connect(),b1=await connect(),b2=await connect();
 const ja1=await call(a1,'room:join',{code:ra.room.code,nickname:'1'});
 const ja2=await call(a2,'room:join',{code:ra.room.code,nickname:'2'});
 await call(b1,'room:join',{code:rb.room.code,nickname:'1'});
 await call(b2,'room:join',{code:rb.room.code,nickname:'2'});
 const roomA=game.store.rooms.get(ra.room.code),roomB=game.store.rooms.get(rb.room.code);
 roomA.players.get(ja1.selfId).starShards=10;
 let leaked=false;b1.on('chat:message',()=>{leaked=true;});teacherB.on('chat:message',()=>{leaked=true;});
 const propose=await call(a1,'trade:propose',{targetId:ja2.selfId,give:{shards:1,items:[]},want:{shards:0,items:[]}});
 assert.equal(propose.ok,true);
 assert.equal((await call(teacherB,'trade:approve',{tradeId:propose.tradeId})).error,'거래를 찾지 못했어요.');
 await sleep(30);
 assert.equal(leaked,false);
 assert.equal(roomB.trades.size,0);
 assert.equal(roomA.trades.size,1);
});
