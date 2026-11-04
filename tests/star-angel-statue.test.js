import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {STREET} from '../shared/config.js';
import {blessAtStarAngel,advanceStarAngelRecovery} from '../server/star-angel-statue.js';
import {STAR_GUARDIAN_MS} from '../server/shelter-fountain.js';
import {ensureVitals,playerVitals} from '../server/vitals.js';
import {playerEffectsView} from '../server/rooms.js';

const statue=STREET.objects.find(o=>o.kind==='star-angel-statue');
function fixture(){
 const p={id:'angel-test',role:'student',avatar:{level:5,constellationId:'leo'},connected:true,away:false,mapId:STREET.id,x:statue.x,y:statue.y+100,effects:[]};
 const value=ensureVitals(p);value.hp=5;value.mp=3;
 return {p,value,room:{players:new Map([[p.id,p]])},now:Date.now()};
}
test('석상은 최대치를 바꾸거나 즉시 회복하지 않고 5분간 10초마다 체력·마나 1씩 회복한다',()=>{
 const {p,value,room,now}=fixture(),before=playerVitals(p);
 const result=blessAtStarAngel(p,now);assert.equal(result.until,now+STAR_GUARDIAN_MS);
 assert.deepEqual([value.hp,value.mp],[5,3]);assert.equal(playerVitals(p).hp.max,before.hp.max);
 assert.equal(playerVitals(p).mp.max,before.mp.max);
 assert.deepEqual(advanceStarAngelRecovery(room,now+9999),[]);
 assert.equal(advanceStarAngelRecovery(room,now+10000)[0].playerId,p.id);
 assert.deepEqual([value.hp,value.mp],[6,4]);
 advanceStarAngelRecovery(room,now+300000);assert.deepEqual([value.hp,value.mp],[35,33]);
 assert.deepEqual(advanceStarAngelRecovery(room,now+310000),[]);
 const status=playerEffectsView(p,false,now).find(e=>e.statusId==='star-angel-recovery');
 assert.equal(status.until,result.until);assert.equal(status.nextTickAt,undefined);
});
test('반복 상호작용은 효과 한 개·기존 다음 회복 시각을 유지하고 기간만 갱신한다',()=>{
 const {p,value,room,now}=fixture();blessAtStarAngel(p,now);blessAtStarAngel(p,now+9000);
 assert.equal(p.effects.length,1);assert.equal(p.effects[0].until,now+309000);
 advanceStarAngelRecovery(room,now+10000);assert.deepEqual([value.hp,value.mp],[6,4]);
 blessAtStarAngel(p,now+10001);advanceStarAngelRecovery(room,now+19999);
 assert.deepEqual([value.hp,value.mp],[6,4]);advanceStarAngelRecovery(room,now+20000);
 assert.deepEqual([value.hp,value.mp],[7,5]);
});
test('최대치를 넘지 않으며 맵을 옮겨도 축복은 유지된다',()=>{
 const {p,value,room,now}=fixture();blessAtStarAngel(p,now);p.mapId='star-plaza';
 const limits=playerVitals(p);value.hp=limits.hp.max;value.mp=limits.mp.max-1;
 advanceStarAngelRecovery(room,now+20000);assert.equal(value.hp,limits.hp.max);assert.equal(value.mp,limits.mp.max);
 assert.deepEqual(advanceStarAngelRecovery(room,now+30000),[]);
});
test('미접속·자리비움·쓰러짐 중 회복을 누적하거나 부활시키지 않는다',()=>{
 for(const state of ['offline','away','dead']){
  const {p,value,room,now}=fixture();blessAtStarAngel(p,now);
  if(state==='offline')p.connected=false;if(state==='away')p.away=true;if(state==='dead')value.hp=0;
  advanceStarAngelRecovery(room,now+100000);assert.equal(value.hp,state==='dead'?0:5);assert.equal(value.mp,3);
  p.connected=true;p.away=false;if(!value.hp)value.hp=5;
  advanceStarAngelRecovery(room,now+109999);assert.deepEqual([value.hp,value.mp],[5,3]);
  advanceStarAngelRecovery(room,now+110000);assert.deepEqual([value.hp,value.mp],[6,4]);
 }
});
test('원격·다른 맵·미접속·자리비움·사망 상태는 석상 사용을 거부한다',()=>{
 for(const change of [{x:0,y:0},{mapId:'star-plaza'},{connected:false},{away:true}]){
  const {p}=fixture();Object.assign(p,change);assert.throws(()=>blessAtStarAngel(p),/가까이/);assert.equal(p.effects.length,0);
 }
 const {p,value}=fixture();value.hp=0;assert.throws(()=>blessAtStarAngel(p),/쓰러진/);
});
test('실제 상호작용 요청은 위치를 확인하고 축복 회복을 같은 맵에 전송한다',async t=>{
 let now=Date.now();const key='isolated-statue-test',game=createClassroomServer({teacherKey:key,studentHours:false,clock:()=>now}),{port}=await game.listen(),sockets=[];
 t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});
 const connect=async()=>{const s=io(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;};
 const call=(s,event,data={})=>s.timeout(4000).emitWithAck(event,data);
 const teacher=await connect(),student=await connect(),created=await call(teacher,'room:create',{teacherKey:key,allowedNames:['석상검사']});
 assert(created.ok,created.error);const joined=await call(student,'room:join',{code:created.room.code,nickname:'석상검사'});assert(joined.ok,joined.error);
 assert.equal((await call(student,'star-angel:bless')).ok,false);
 const p=game.store.rooms.get(created.room.code).players.get(joined.selfId);
 Object.assign(p,{mapId:STREET.id,x:statue.x,y:statue.y+100});p.avatar.level=2;
 const value=ensureVitals(p);value.hp=1;value.mp=0;value.nextPassiveRecoveryAt=now+600000;
 const blessed=await call(student,'star-angel:bless');assert(blessed.ok,blessed.error);
 const update=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('석상 회복 전송 없음')),3000);student.on('combat:vitals',data=>{if(data.playerId===p.id&&data.vitals.hp.current===2){clearTimeout(timer);resolve(data);}});});
 now+=10000;const result=await update;assert.deepEqual([result.vitals.hp.current,result.vitals.mp.current],[2,1]);
});
