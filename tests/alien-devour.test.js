import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {MAP,itemOf,SHOP,SHARDS} from '../shared/config.js';
import {addCardMarker,validateCardMarkers} from '../server/item-cards.js';
import {devourItem,devourOptions} from '../server/alien-devour.js';
import {GameError} from '../server/rooms.js';

const DAY=86_400_000,HOUR=3_600_000;
const call=(socket,event,data={})=>socket.timeout(5000).emitWithAck(event,data);

test('포식 기록은 하루 대기와 12시간 종료 시각을 저장할 수 있다',()=>{
  const now=Date.now(),marker={id:'m',itemId:'alien-creature-card',fromId:'a',fromNickname:'a',startsAt:now+DAY,
    until:now+DAY+12*HOUR,note:'포식 대기'};
  assert.deepEqual(validateCardMarkers([marker]),[marker]);
  assert.throws(()=>validateCardMarkers([{...marker,startsAt:marker.until}]),/기록/);
});

test('교사만 기둥에서 포식하고 서버 가격으로 절반을 반환하며 같은 효과를 두 번 먹지 못한다',async t=>{
  let now=Date.now()+1000;
  const game=createClassroomServer({teacherKey:'alien-devour-test-key',studentHours:false,clock:()=>now});
  const address=await game.listen(),sockets=[];
  t.after(async()=>{for(const socket of sockets)socket.disconnect();await game.close();});
  const connect=async()=>{const socket=io(`http://127.0.0.1:${address.port}`,{transports:['websocket'],reconnection:false,forceNew:true});
    sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;};
  const teacher=await connect(),made=await call(teacher,'room:create',{teacherKey:'alien-devour-test-key',allowedNames:['1','2']});
  assert.ok(made.ok,made.error);
  const eaterSocket=await connect(),victimSocket=await connect();
  const a=await call(eaterSocket,'room:join',{code:made.room.code,nickname:'1'});
  const b=await call(victimSocket,'room:join',{code:made.room.code,nickname:'2'});
  assert.ok(a.ok&&b.ok);
  const room=game.store.rooms.get(made.room.code),eater=room.players.get(a.selfId),victim=room.players.get(b.selfId);
  const teacherPlayer=room.players.get(made.selfId),pillar=MAP.objects.find(entry=>entry.id==='pillar-effects');
  Object.assign(teacherPlayer,{mapId:MAP.id,x:pillar.x,y:pillar.y});
  eater.avatar.level=3;eater.inventory=[{id:'alien-creature-card',quantity:1}];
  const used=await call(eaterSocket,'item:use',{itemId:'alien-creature-card',targetId:eater.id});
  assert.ok(used.ok,used.error);
  const marker=eater.cardMarkers.find(entry=>entry.itemId==='alien-creature-card'&&entry.startsAt);
  assert.ok(marker);assert.equal(marker.startsAt,now+DAY);assert.equal(marker.until,now+DAY+12*HOUR);
  const victimMarker=addCardMarker(victim,itemOf('asteroid-card'),victim,null);
  const params={objectId:pillar.id,eaterId:eater.id,markerId:marker.id};
  assert.equal((await call(teacher,'item:devour:options',params)).ok,false);
  assert.equal((await call(victimSocket,'item:devour:options',params)).ok,false);
  now+=DAY+1;
  const choices=await call(teacher,'item:devour:options',params);assert.ok(choices.ok,choices.error);
  const choice=choices.rows.find(entry=>entry.recordId===victimMarker.id);
  assert.equal(choice.refund,Math.floor(itemOf('asteroid-card').price/2));
  const attempt={...params,victimId:victim.id,kind:'marker',recordId:victimMarker.id,refund:999};
  assert.equal((await call(victimSocket,'item:devour',attempt)).ok,false);
  const eaten=await call(teacher,'item:devour',attempt);assert.ok(eaten.ok,eaten.error);
  assert.equal(victim.starShards,choice.refund);
  assert.equal(eater.inventory.find(entry=>entry.id==='asteroid-card').quantity,1);
  assert.equal(victim.cardMarkers.some(entry=>entry.id===victimMarker.id),false);
  assert.equal((await call(teacher,'item:devour',attempt)).ok,false);
  now=marker.until;
  assert.equal((await call(teacher,'item:devour:options',params)).ok,false);
});

test('가방과 별 파편 상한으로 실패하면 효과·소유물·잔액을 보존한다',()=>{
  const now=Date.now(),teacher={role:'teacher'},eater={id:'e',nickname:'e',role:'student',inventory:[],
    cardMarkers:[{id:'eat',itemId:'alien-creature-card',startsAt:now-1,until:now+HOUR}]},
    victim={id:'v',nickname:'v',role:'student',starShards:SHARDS.max,cardMarkers:[{id:'item',itemId:'asteroid-card',until:null}],effects:[]};
  const room={players:new Map([[eater.id,eater],[victim.id,victim]])},data={eaterId:'e',markerId:'eat',victimId:'v',kind:'marker',recordId:'item'};
  assert.throws(()=>devourItem(room,teacher,data,now),GameError);
  assert.equal(victim.cardMarkers.length,1);assert.equal(eater.inventory.length,0);
  victim.starShards=0;
  eater.inventory=Array.from({length:SHOP.maxKinds},(_,index)=>({id:`placeholder-${index}`,quantity:1}));
  assert.throws(()=>devourItem(room,teacher,data,now),GameError);
  assert.equal(victim.cardMarkers.length,1);
  assert.equal(devourOptions(room,teacher,{eaterId:'e',markerId:'eat'},now).rows.length,1);
});
