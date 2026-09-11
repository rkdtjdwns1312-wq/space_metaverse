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
