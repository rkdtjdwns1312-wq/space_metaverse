import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {avatarRenderPoint} from '../shared/avatar-boundary.js';
import {mapOf} from '../shared/config.js';
import {freshJourney} from '../server/tutorial-journey.js';
import {WALL_CASES} from './helpers/boss-wall-fixture.js';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const call=(s,event,data={})=>s.timeout(3000).emitWithAck(event,data);
async function until(check,details=()=>null){for(let i=0;i<150&&!check();i++)await wait(20);assert(check(),'서버 위치 전파 제한 시간: '+JSON.stringify(details()));}
for(const completed of [false,true])test(`실제 소켓: ${completed?'첫 여행 완료·전송 불가 뒤 재동기화':'첫 여행 중·전체 상태와 델타'}에서도 벽 끼임 탈출 좌표를 두 관찰자에게 전달한다`,async t=>{
  const sockets=[],key='wall-escape-test',game=createClassroomServer({teacherKey:key,dataDir:null,studentHours:false});
  const {port}=await game.listen();let heartbeat,unblock=()=>{};
  t.after(async()=>{unblock();clearInterval(heartbeat);for(const socket of sockets)socket.disconnect();await game.close();});
  async function connect(){const socket=io(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false,forceNew:true});sockets.push(socket);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;}
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:key,title:'벽 끼임 검사',allowedNames:['1','2']});
  assert(created.ok,created.error);const code=created.room.code,student=await connect(),observer=await connect();
  const joined=await call(student,'room:join',{code,nickname:'1'}),observed=await call(observer,'room:join',{code,nickname:'2'});
  assert(joined.ok,joined.error);assert(observed.ok,observed.error);
  const room=game.store.rooms.get(code),player=room.players.get(joined.selfId),friend=room.players.get(observed.selfId);
  const boss=monstersOf(room).get('leoon-boss'),place=WALL_CASES.leoon,map=mapOf(boss.mapId);
  room.monsters=new Map([[boss.id,boss]]);
  Object.assign(boss,place.boss,{dx:0,dy:0,patrolStartedAt:Date.now(),patrolCycle:0,nextDirectionAt:Infinity,nextManaRegenAt:Infinity});
  Object.assign(player,place.player,{mapId:boss.mapId,avatar:{...player.avatar,level:5,constellationId:'taurus'},input:{x:0,y:0,at:Date.now()}});
  Object.assign(friend,{mapId:boss.mapId,x:map.width/2,y:map.height/2,input:{x:0,y:0,at:Date.now()}});
  if(completed)for(const p of [player,friend])p.journey={...freshJourney(),stage:6,claimedAt:Array(5).fill(Date.now())};
  ensureVitals(player);chargeHuntingStation(player,'math',Date.now());chargeHuntingStation(friend,'math',Date.now());
  // 실제 클라이언트처럼 reliable 전체 상태와 volatile 위치 델타를 모두 적용합니다.
  const track=socket=>{
    const state={positions:new Map(),worldPositions:new Map(),monsters:new Map(),frame:null};
    socket.on('room:state',data=>{
      state.positions=new Map(data.players.map(p=>[p.id,[p.id,p.x,p.y,p.facingX]]));
      state.monsters=new Map(data.monsters.map(m=>[m.id,m]));
    });
    socket.on('world:positions',data=>{
      state.frame=data;state.monsters=new Map(data.monsters.map(m=>[m.id,m]));
      for(const point of data.positions){state.positions.set(point[0],point);state.worldPositions.set(point[0],point);}
    });
    return state;
  };
  const mine=track(student),other=track(observer);
  await wait(150);assert.equal(boss.y,place.boss.y);assert.equal(player.y,place.player.y);
  student.emit('player:input',{x:10000,y:-10000,bossX:0,bossY:0});await wait(100);
  assert.equal(boss.y,place.boss.y);assert.equal(player.y,place.player.y);
  let gated=false;const serverSockets=[student,observer].map(s=>game.io.sockets.sockets.get(s.id));
  if(completed){
    // 전송 가능 여부만 잠깐 막아 실제 마지막 이동 델타 유실과 다음 빈 델타를 재현합니다.
    gated=true;
    for(const socket of serverSockets){
      const transport=socket.conn.transport;let writable=transport.writable;
      Object.defineProperty(transport,'writable',{configurable:true,get:()=>!gated&&writable,set:value=>{writable=value;}});
    }
    unblock=()=>{gated=false;};
  }
  const send=()=>student.emit('player:input',{x:0,y:-1,bossX:0,bossY:0});send();heartbeat=setInterval(send,50);
  await until(()=>player.y<place.player.y);clearInterval(heartbeat);student.emit('player:input',{x:0,y:0});
  assert.equal(place.boss.y-boss.y,32);assert.equal(player.y,place.player.y-7.75);
  if(completed){
    await until(()=>serverSockets.every(s=>s.data.worldPositionResync));
    assert([mine,other].every(state=>state.positions.get(player.id)?.[2]!==player.y),'전송이 막힌 동안 새 좌표를 받은 것으로 간주하지 않는다');
    unblock();
  }
  const receivedFinal=()=>[mine,other].every(state=>state.monsters.get(boss.id)?.x===boss.x&&state.monsters.get(boss.id)?.y===boss.y&&
    state.positions.get(player.id)?.[1]===player.x&&state.positions.get(player.id)?.[2]===player.y);
  await until(receivedFinal,()=>({server:{x:player.x,y:player.y,bossY:boss.y},
    received:[mine,other].map(state=>({player:state.positions.get(player.id),bossY:state.monsters.get(boss.id)?.y}))}));
  if(completed)await until(()=>[mine,other].every(state=>state.worldPositions.get(player.id)?.[1]===player.x&&state.worldPositions.get(player.id)?.[2]===player.y));
  // 다음 빈 델타가 도착해도 두 관찰자가 실제 수신한 탈출 좌표를 잃지 않습니다.
  await until(()=>[mine,other].every(state=>state.frame&&!state.frame.positions.some(point=>point[0]===player.id)));
  assert(receivedFinal());
  const visual=avatarRenderPoint(map,player,player,player,[...mine.monsters.values()],place.player);
  assert.equal(visual.y,player.y);assert.equal(boss.wallEscape.used,32);
  const y=boss.y;await wait(150);assert.equal(boss.y,y);assert.equal(boss.wallEscape.used,32);
});
