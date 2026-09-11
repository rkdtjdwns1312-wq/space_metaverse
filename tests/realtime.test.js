import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { createClassroomServer } from '../server/app.js';
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
 for(const text of ['','   ','a'.repeat(121),'hithere',123]){
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
