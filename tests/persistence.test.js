import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { io } from 'socket.io-client';
import { createClassroomServer } from '../server/app.js';
import { PersistentRoomStore } from '../server/persistent-rooms.js';
import { evolveAvatar, gainExperience } from '../server/progression.js';
import { unlockStoppedStore } from '../server/store-lock.js';
import { PLAZA_ID, STREET_ID, STREET, SHOP, interiorIdOf, mapOf } from '../shared/config.js';

const key='persistence-tests-private-teacher-key';
const call=(s,event,data={})=>s.timeout(5000).emitWithAck(event,data);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fixture(t,options={}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'class-persistence-'));
  let game,url,closed=false;const sockets=[];
  const start=async()=>{
    game=createClassroomServer({studentHours:false,unattended:false,teacherManagedAccounts:false,teacherKey:key,dataDir:dir,...options});
    const address=await game.listen();url='http://127.0.0.1:'+address.port;closed=false;
  };
  await start();
  t.after(async()=>{for(const s of sockets)s.disconnect();if(!closed)await game.close();fs.rmSync(dir,{recursive:true,force:true});});
  return {get game(){return game;},get url(){return url;},dir,
    async connect(){const s=io(url,{transports:['websocket'],reconnection:false,forceNew:true});sockets.push(s);
      await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;},
    async restart(){await game.close();closed=true;await start();}
  };
}
async function classroom(f){
  const teacher=await f.connect(),created=await call(teacher,'room:create',{teacherKey:key,title:'계속 우주',allowedNames:['1','2','3'],seedPlanets:true});
  assert.equal(created.ok,true,created.error);return {teacher,code:created.room.code};
}
const join=(s,code,nickname='1',pin='1234')=>call(s,'room:join',{code,nickname,pin});
const open=(s,code)=>call(s,'room:open',{teacherKey:key,code});

test('초월체 단계와 경험치가 서버 재시작 뒤에도 복원된다',async t=>{
  const f=await fixture(t),{code}=await classroom(f),s=await f.connect();
  const joined=await join(s,code);assert.ok(joined.ok);
  const p=f.game.store.rooms.get(code).players.get(joined.selfId);
  f.game.store.transact(()=>{
    for(const amount of [15,20,25,30]){
      p.avatar=gainExperience(p.avatar,amount);
      p.avatar=evolveAvatar(p.avatar);
    }
  });
  await f.restart();await open(await f.connect(),code);
  const back=await join(await f.connect(),code);assert.ok(back.ok,back.error);
  const avatar=back.room.players.find(p=>p.id===back.selfId).avatar;
  assert.equal(avatar.level,5);assert.equal(avatar.form,'transcendent');assert.equal(avatar.xp,0);
});

test('요청을 보내지 않은 브라우저 사전 연결이 있어도 서버 종료와 저장 잠금 해제가 끝난다',async t=>{
  const f=await fixture(t);const connection=net.connect(Number(new URL(f.url).port),'127.0.0.1');
  await once(connection,'connect');t.after(()=>connection.destroy());
  const started=Date.now();
  // 실패할 때에도 테스트 프로세스를 남기지 않으면서 종료 지연을 명확하게 검출합니다.
  const fallback=setTimeout(()=>connection.destroy(),2000);
  try{await f.restart();}finally{clearTimeout(fallback);}
  assert.ok(Date.now()-started<1500,'사용하지 않은 TCP 연결 때문에 서버 종료가 지연됐습니다.');
});

test('수업 마치기/서버 재시작 후 코드·학생 id·행성·소속·규칙·잔액·가방·채팅·개인 안내를 복원한다',async t=>{
  const f=await fixture(t),{teacher,code}=await classroom(f),student=await f.connect();
  const j=await join(student,code);assert.equal(j.ok,true,j.error);
  let room=f.game.store.rooms.get(code),p=room.players.get(j.selfId);
  const planet=[...room.planets.values()][0];
  assert.equal((await call(student,'planet:join',{planetId:planet.id})).ok,true);
  const board=mapOf(interiorIdOf(planet.id)).objects.find(o=>o.kind==='board');assert.ok(board);
  const teacherPlayer=[...room.players.values()].find(x=>x.role==='teacher');
  teacherPlayer.mapId=interiorIdOf(planet.id);teacherPlayer.x=board.x;teacherPlayer.y=board.y;
  const initialRules=structuredClone(planet.rules);
  const openedRules=await call(teacher,'planet:rules:open',{planetId:planet.id});
  assert.equal(openedRules.ok,true);assert.deepEqual(openedRules,{ok:true,rules:initialRules,planetId:planet.id,name:planet.name});
  assert.equal((await call(teacher,'planet:rules:set',{planetId:planet.id,rules:['책은 소중히'],expectedRules:initialRules})).ok,true);
  assert.equal((await call(teacher,'shards:give',{playerId:p.id,amount:100})).ok,true);
  // 위치만 테스트에서 상점 앞으로 옮깁니다. 구매 자체는 실제 서버 요청으로 검사합니다.
  p.mapId=STREET_ID;const shop=STREET.objects.find(o=>o.kind==='shop');
  assert.ok(shop);p.x=shop.x;p.y=shop.y+shop.radius+20;
  const item=SHOP.items[0];assert.equal((await call(student,'shop:buy',{itemId:item.id,quantity:2})).ok,true);
  assert.equal((await call(student,'chat:send',{text:'내일도 만나요'})).ok,true);
  const balance=p.starShards,bag=structuredClone(p.inventory),oldToken=j.token;
  const persisted=JSON.parse(fs.readFileSync(path.join(f.dir,code+'.json'),'utf8'));
  assert.equal(persisted.students[0].id,p.id);
  assert.equal(persisted.students[0].pin.hash.length,64);
  for(const field of ['socketId','token','x','y','mapId','connected','effects'])assert.equal(field in persisted.students[0],false,field);
  assert.equal((await call(teacher,'room:close')).ok,true);assert.equal(f.game.store.rooms.size,0);
  assert.equal((await join(await f.connect(),code)).ok,false);
  await f.restart();
  assert.equal(f.game.store.rooms.size,0);
  const nextTeacher=await f.connect();
  assert.equal((await call(nextTeacher,'room:list',{teacherKey:'wrong'})).ok,false);
  assert.equal((await call(nextTeacher,'room:list',{teacherKey:key})).classes[0].code,code);
  const reopened=await open(nextTeacher,code);assert.equal(reopened.ok,true,reopened.error);
  assert.equal(reopened.room.planets[0].memberCount,1);
  assert.deepEqual(reopened.room.planets[0].rules,['책은 소중히']);
  const nextStudent=await f.connect();
  assert.equal((await call(nextStudent,'session:resume',{token:oldToken})).ok,false);
  assert.equal((await join(nextStudent,code,'1','9999')).ok,false);
  const back=await join(nextStudent,code);assert.equal(back.ok,true,back.error);assert.equal(back.selfId,j.selfId);
  const me=back.room.players.find(p=>p.id===back.selfId);
  assert.equal(me.starShards,balance);assert.deepEqual(me.inventory,bag);assert.equal(me.departmentId,planet.id);
  assert.equal(me.mapId,PLAZA_ID);assert.ok(!back.chat.messages.some(m=>m.text==='내일도 만나요'));
  assert.ok(f.game.store.rooms.get(code).chat.history.some(m=>m.text==='내일도 만나요'&&m.mapId===STREET_ID));
  assert.ok(back.chat.messages.some(m=>m.private));
  assert.equal((await call(nextStudent,'room:list',{teacherKey:key})).ok,false);
  const stranger=await join(await f.connect(),code,'2','2222');
  const other=stranger.room.players.find(p=>p.id===j.selfId);
  assert.equal('starShards' in other,false);assert.equal('inventory' in other,false);
  const wire=JSON.stringify(stranger);assert.equal(wire.includes(persisted.students[0].pin.hash),false);
  assert.equal(wire.includes('"salt"'),false);assert.equal(wire.includes('"pin"'),false);
  assert.equal((await fetch(f.url+'/data/classes/'+code+'.json')).status,404);
});

test('PIN은 필수이며 5회 오류 잠금은 새 소켓/재시작에도 유지되고 교사만 새 PIN을 지정한다',async t=>{
  const f=await fixture(t),{teacher,code}=await classroom(f),s=await f.connect();
  assert.equal((await call(s,'room:join',{code,nickname:'1'})).ok,false);
  assert.equal((await join(s,code,'1','abcd')).ok,false);
  const j=await join(s,code);assert.ok(j.ok);await call(s,'room:leave');
  for(let i=0;i<5;i++)assert.equal((await join(await f.connect(),code,'1','9999')).ok,false);
  const locked=await join(await f.connect(),code);assert.equal(locked.ok,false);assert.match(locked.error,/1분/);
  await f.restart();const tr=await f.connect();assert.ok((await open(tr,code)).ok);
  assert.match((await join(await f.connect(),code)).error,/1분/);
  const intruder=await f.connect();assert.equal((await call(intruder,'student:pin:set',{playerId:j.selfId,pin:'7777'})).ok,false);
  assert.ok((await call(tr,'student:pin:set',{playerId:j.selfId,pin:'7777'})).ok);
  const back=await join(await f.connect(),code,'1','7777');assert.ok(back.ok);assert.equal(back.selfId,j.selfId);
  assert.equal((await call(tr,'student:pin:set',{playerId:j.selfId,pin:'x'})).ok,false);
  assert.ok((await call(tr,'student:pin:set',{playerId:j.selfId,pin:'8888'})).ok);
  assert.equal((await call(await f.connect(),'session:resume',{token:back.token})).ok,false);
  assert.ok((await join(await f.connect(),code,'1','8888')).ok);
});

test('저장 오류는 성공 응답/알림 없이 지급과 수업 마치기를 취소하고 재시도할 수 있다',async t=>{
  const f=await fixture(t),{teacher,code}=await classroom(f),s=await f.connect(),j=await join(s,code);
  const original=fs.readFileSync(path.join(f.dir,code+'.json'),'utf8');
  const realSave=f.game.store.files.save.bind(f.game.store.files);
  f.game.store.files.save=()=>{throw new Error('simulated disk full');};
  let messages=0,closed=false;s.on('chat:message',()=>messages++);s.on('room:closed',()=>closed=true);
  try{
    const result=await call(teacher,'shards:give',{playerId:j.selfId,amount:10});
    assert.equal(result.ok,false);assert.match(result.error,/저장/);
    assert.equal(f.game.store.rooms.get(code).players.get(j.selfId).starShards,0);
    assert.equal(fs.readFileSync(path.join(f.dir,code+'.json'),'utf8'),original);
    assert.equal(messages,0);
    // 닫기는 저장된 내용과 동일하면 디스크 쓰기가 불필요합니다. 미저장 변경을 주어 실패 경로를 검증합니다.
    f.game.store.rooms.get(code).title='변경된 이름';
    assert.equal((await call(teacher,'room:close')).ok,false);assert.equal(closed,false);
    assert.equal(f.game.store.rooms.has(code),true);
  }finally{f.game.store.files.save=realSave;}
  assert.ok((await call(teacher,'shards:give',{playerId:j.selfId,amount:7})).ok);
  assert.equal(f.game.store.rooms.get(code).players.get(j.selfId).starShards,7);
  assert.ok((await call(teacher,'room:close')).ok);
});

test('학생 퇴장·만료가 행성 소속을 지우지 않고 교사 연결 만료도 저장된 교실을 보존한다',async t=>{
  const f=await fixture(t,{reconnectMs:140}),{teacher,code}=await classroom(f),s=await f.connect(),j=await join(s,code);
  const planet=[...f.game.store.rooms.get(code).planets.values()][0];
  assert.ok((await call(s,'planet:join',{planetId:planet.id})).ok);
  s.disconnect();await sleep(230);
  const p=f.game.store.rooms.get(code).players.get(j.selfId);
  assert.equal(p.away,true);assert.equal(p.avatar.departmentId,planet.id);
  const next=await f.connect();assert.equal((await join(next,code)).selfId,j.selfId);
  teacher.disconnect();await sleep(230);
  assert.equal(f.game.store.rooms.size,0);assert.ok(f.game.store.records.has(code));
  assert.ok((await open(await f.connect(),code)).ok);
  assert.equal((await join(await f.connect(),code)).selfId,j.selfId);
});

test('승인/잔액변경으로 거부된 거래는 양쪽 잔액과 기록을 함께 저장하고 미승인 거래는 재시작시 취소한다',async t=>{
  const f=await fixture(t),{teacher,code}=await classroom(f),a=await f.connect(),b=await f.connect();
  const ja=await join(a,code),jb=await join(b,code,'2','2222');
  assert.ok((await call(teacher,'shards:give',{playerId:'all',amount:20})).ok);
  const proposal=()=>call(a,'trade:propose',{targetId:jb.selfId,give:{shards:10,items:[]},want:{shards:3,items:[]}});
  let tr=await proposal();assert.ok(tr.ok);assert.ok((await call(b,'trade:respond',{tradeId:tr.tradeId,accept:true})).ok);
  // 쓰기가 실패하면 양쪽 교환과 알림을 함께 취소합니다. 메모리상의 거래도 재시도 가능한 상태입니다.
  const save=f.game.store.files.save.bind(f.game.store.files);f.game.store.files.save=()=>{throw new Error('trade write failed');};
  try{assert.equal((await call(teacher,'trade:approve',{tradeId:tr.tradeId})).ok,false);}
  finally{f.game.store.files.save=save;}
  assert.equal(f.game.store.rooms.get(code).players.get(ja.selfId).starShards,20);
  assert.equal(f.game.store.rooms.get(code).players.get(jb.selfId).starShards,20);
  assert.ok((await call(teacher,'trade:approve',{tradeId:tr.tradeId})).ok);
  assert.equal(f.game.store.rooms.get(code).players.get(ja.selfId).starShards,13);
  assert.equal(f.game.store.rooms.get(code).players.get(jb.selfId).starShards,27);
  tr=await proposal();assert.ok((await call(b,'trade:respond',{tradeId:tr.tradeId,accept:true})).ok);
  assert.ok((await call(teacher,'shards:give',{playerId:ja.selfId,amount:-13})).ok);
  assert.equal((await call(teacher,'trade:approve',{tradeId:tr.tradeId})).ok,false);
  assert.equal(f.game.store.rooms.get(code).trades.size,0);
  const stored=JSON.parse(fs.readFileSync(path.join(f.dir,code+'.json'),'utf8'));
  assert.deepEqual(stored.tradeLog.map(t=>t.result),['approved','rejected']);
  assert.ok((await call(teacher,'shards:give',{playerId:ja.selfId,amount:15})).ok);
  assert.ok((await proposal()).ok);await f.restart();
  const teacher2=await f.connect(),reopened=await open(teacher2,code);assert.ok(reopened.ok);
  assert.equal(reopened.room.trades.length,0);assert.equal(reopened.room.tradeLog.length,2);
  assert.equal(reopened.room.players.find(p=>p.id===ja.selfId).starShards,15);
  assert.equal(reopened.room.players.find(p=>p.id===jb.selfId).starShards,27);
});

test('대기 행성 신청과 이름 투표 Map을 복원하며 수업 밖 소속 학생의 표도 유지한다',async t=>{
  const f=await fixture(t),{teacher,code}=await classroom(f),a=await f.connect(),b=await f.connect(),c=await f.connect();
  const ja=await join(a,code),jb=await join(b,code,'2','2222');await join(c,code,'3','3333');
  const planet=[...f.game.store.rooms.get(code).planets.values()][0];
  assert.ok((await call(a,'planet:join',{planetId:planet.id})).ok);
  assert.ok((await call(b,'planet:join',{planetId:planet.id})).ok);
  assert.ok((await call(a,'planet:rename:propose',{planetId:planet.id,name:'책읽는행성'})).ok);
  const proposed=await call(c,'planet:propose',{name:'새행성',description:'내일 이어서',x:1870,y:1050,color:'#98dfd2',templateId:'reading'});
  assert.equal(proposed.ok,true,proposed.error);
  await f.restart();const tr=await f.connect(),opened=await open(tr,code);assert.ok(opened.ok);
  const saved=opened.room.planets.find(p=>p.id===planet.id);
  assert.equal(saved.rename.yes,1);assert.equal(saved.memberCount,2);assert.equal(opened.room.proposals.length,1);
  const returning=await f.connect();assert.equal((await join(returning,code,'2','2222')).selfId,jb.selfId);
  assert.ok((await call(returning,'planet:rename:vote',{planetId:planet.id,agree:true})).ok);
  assert.equal(f.game.store.rooms.get(code).planets.get(planet.id).name,'책읽는행성');
  assert.equal(f.game.store.rooms.get(code).players.get(ja.selfId).away,true);
  assert.ok((await call(tr,'planet:approve',{proposalId:opened.room.proposals[0].id})).ok);
});

test('복원시 손상된 학생 데이터는 시작을 막고 원본을 그대로 보존하며 잠금을 돌려준다',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bad-class-'));let store;
  try{
    store=new PersistentRoomStore(dir);store.transact(()=>store.create({allowedNames:['1']},'teacher'));
    const record=[...store.records.values()][0],file=path.join(dir,record.code+'.json');store.close();
    record.students=[{id:'bad'}];const source=JSON.stringify(record);fs.writeFileSync(file,source);
    assert.throws(()=>new PersistentRoomStore(dir),/올바르지/);
    assert.equal(fs.readFileSync(file,'utf8'),source);assert.equal(fs.existsSync(path.join(dir,'.writer.lock')),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('강제 종료 직전 성공 응답을 받은 지급도 남고, 살아 있는 서버 잠금은 해제하지 않는다',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crash-class-'));
  const crashKey='crash-test-private-teacher-key';
  const child=fork(new URL('./helpers/persistence-child.mjs',import.meta.url),[],
    {env:{...process.env,TEST_DATA_DIR:dir},stdio:['ignore','ignore','inherit','ipc']});
  let teacher,student,loaded;
  try{
    const [{port}]=await once(child,'message');const url='http://127.0.0.1:'+port;
    teacher=io(url,{transports:['websocket'],reconnection:false});await once(teacher,'connect');
    const c=await call(teacher,'room:create',{teacherKey:crashKey,allowedNames:['1']});assert.ok(c.ok);
    student=io(url,{transports:['websocket'],reconnection:false});await once(student,'connect');
    const j=await join(student,c.room.code);assert.ok(j.ok);
    assert.ok((await call(teacher,'shards:give',{playerId:j.selfId,amount:37})).ok);
    assert.throws(()=>unlockStoppedStore(dir),/사용 중/);
    const exited=once(child,'exit');child.kill('SIGKILL');await exited;
    assert.throws(()=>new PersistentRoomStore(dir),/잠글/);
    assert.equal(unlockStoppedStore(dir),true);
    loaded=new PersistentRoomStore(dir);const record=loaded.records.get(c.room.code);
    assert.equal(record.students[0].starShards,37);assert.equal(record.students[0].id,j.selfId);
    assert.equal(record.students[0].pin.hash.length,64);
  }finally{
    teacher?.disconnect();student?.disconnect();loaded?.close();
    if(child.exitCode===null&&child.signalCode===null){const ended=once(child,'exit');child.kill();await ended;}
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
