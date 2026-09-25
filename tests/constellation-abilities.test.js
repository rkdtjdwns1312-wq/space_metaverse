import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {MAP,STREET,STREET_ID} from '../shared/config.js';
import {CONSTELLATIONS} from '../shared/constellations.js';
import {weekStart} from '../server/temple.js';

const key='constellation-ability-test-private-key';
const call=(socket,event,data={})=>socket.timeout(4000).emitWithAck(event,data);
async function fixture(t){
  let now=Date.parse('2026-09-18T04:00:00Z');
  const game=createClassroomServer({teacherKey:key,studentHours:false,clock:()=>now});
  const address=await game.listen(),sockets=[];
  t.after(async()=>{for(const socket of sockets)socket.disconnect();await game.close();});
  const connect=async()=>{const socket=io('http://127.0.0.1:'+address.port,{transports:['websocket'],forceNew:true,reconnection:false});
    sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;};
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:key,title:'별자리 시험',allowedNames:['별이','달이']});
  const first=await connect(),second=await connect(),a=await call(first,'room:join',{code:created.room.code,nickname:'별이'}),b=await call(second,'room:join',{code:created.room.code,nickname:'달이'});
  assert.ok(created.ok&&a.ok&&b.ok);
  const room=game.store.rooms.get(created.room.code),student=room.players.get(a.selfId),friend=room.players.get(b.selfId);
  student.avatar.level=2;student.avatar.form='constellation';friend.avatar.level=2;friend.avatar.form='constellation';
  return {game,room,teacher,first,second,student,friend,setNow:value=>{now=value;}};
}

test('16종 PPT 별자리 모두 그림·작은 아바타·능력 설명과 사용 방식을 갖는다',()=>{
  assert.equal(CONSTELLATIONS.length,16);
  for(const constellation of CONSTELLATIONS){
    assert.match(constellation.art,/\.png$/);assert.match(constellation.sprite,/\.png$/);
    assert.ok(constellation.ability?.description&&constellation.ability?.mode);
  }
});

test('별자리 능력은 한 주 한 번이며 한국 시간 다음 월요일에만 다시 열린다',async t=>{
  const {first,student,setNow}=await fixture(t);student.avatar.constellationId='aquarius';
  const used=await call(first,'ability:use');assert.ok(used.ok,used.error);assert.equal(used.reward,1);assert.equal(student.starShards,1);
  assert.match((await call(first,'ability:use')).error,/다음 월요일/);
  setNow(Date.parse('2026-09-20T14:59:59Z'));assert.equal((await call(first,'ability:status')).used,true);
  setNow(Date.parse('2026-09-20T15:00:00Z'));assert.equal(weekStart(Date.parse('2026-09-20T15:00:00Z')),'2026-09-21');
  assert.equal((await call(first,'ability:status')).used,false);
  assert.ok((await call(first,'ability:use')).ok);assert.equal(student.starShards,2);
});

test('까마귀자리 별 주사위는 1~6이고 만들 수 있는 아이템 레벨을 서버가 검증한다',async t=>{
  const {first,student}=await fixture(t);student.avatar.constellationId='corvus';
  const result=await call(first,'ability:use');assert.ok(result.ok,result.error);assert.ok(result.roll>=1&&result.roll<=6);
  if(result.roll===1){assert.equal(result.pending,null);return;}
  const level=Math.floor(result.roll/2);assert.equal(result.pending.maxLevel,level);
  assert.equal((await call(first,'ability:choose-item',{itemId:'starlight-cape'})).ok,level>=3);
  if(level>=3)return;
  const created=await call(first,'ability:choose-item',{itemId:'space-food-card'});assert.ok(created.ok,created.error);
  assert.equal(student.inventory.find(item=>item.id==='space-food-card')?.quantity,1);
  assert.equal((await call(first,'ability:choose-item',{itemId:'space-food-card'})).ok,false);
});

test('쌍둥이자리 복사는 Lv2 이하 상점 구매 한 번에만 1개가 추가된다',async t=>{
  const {first,student}=await fixture(t);student.avatar.constellationId='gemini';student.starShards=30;
  assert.ok((await call(first,'ability:use')).ok);
  const shop=STREET.objects.find(object=>object.kind==='shop');student.mapId=STREET_ID;student.x=shop.x;student.y=shop.y;
  const copied=await call(first,'shop:buy',{itemId:'meteor-fragment-card',quantity:1});assert.ok(copied.ok,copied.error);assert.equal(copied.copiedItem,'운석 파편');
  assert.equal(student.inventory.find(item=>item.id==='meteor-fragment-card').quantity,2);
  const next=await call(first,'shop:buy',{itemId:'space-food-card',quantity:1});assert.ok(next.ok,next.error);
  assert.equal(next.copiedItem,null);
  assert.equal(student.inventory.find(item=>item.id==='space-food-card').quantity,1);
});

test('뱀주인자리 정지는 상대 아이템 사용을 차단하고 만료 시 보상 1개를 준다',async t=>{
  const {first,second,student,friend,setNow}=await fixture(t);student.avatar.constellationId='ophiuchus';friend.inventory=[{id:'star-sticker',quantity:1}];
  const start=Date.parse('2026-09-18T04:00:00Z');
  assert.ok((await call(first,'ability:use',{targetId:friend.id})).ok);
  assert.match((await call(second,'item:use',{itemId:'star-sticker',targetId:friend.id})).error,/아이템/);
  setNow(start+2*86400000+1000);
  assert.equal((await call(second,'ability:status')).ok,true);
  // 만료 정산은 교실 서버의 1초 tick에서 반영됩니다.
  // 고정1200ms 대신 실제 정산 완료를 기다립니다. 병렬 검사로 tick이 늦어져도 결과로 판정합니다.
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{clearInterval(poll);reject(new Error('만료 보상 정산이 완료되지 않았습니다'));},5000);
    const poll=setInterval(()=>{if(friend.starShards===1){clearInterval(poll);clearTimeout(timeout);resolve();}},25);
  });
  assert.equal(friend.starShards,1);
  assert.equal(friend.abilityState.blocks.length,0);
});

test('현실 교실에서 처리할 능력은 교사 기둥에 남고 학생은 완료할 수 없다',async t=>{
  const {room,first,teacher,student}=await fixture(t);student.avatar.constellationId='leo';
  assert.ok((await call(first,'ability:use')).ok);assert.equal(student.abilityState.markers.length,1);
  const pillar=MAP.objects.find(object=>object.id==='pillar-effects');
  for(const player of room.players.values()){player.x=pillar.x;player.y=pillar.y;}
  const board=await call(teacher,'temple:read',{objectId:pillar.id});assert.ok(board.ok,board.error);
  const row=board.rows.find(entry=>entry.abilityMarkerId);assert.equal(row.nickname,'별이');
  assert.equal((await call(first,'ability:complete',{objectId:pillar.id,targetId:student.id,abilityMarkerId:row.abilityMarkerId})).ok,false);
  assert.ok((await call(teacher,'ability:complete',{objectId:pillar.id,targetId:student.id,abilityMarkerId:row.abilityMarkerId})).ok);
  assert.equal(student.abilityState.markers.length,0);
});

test('천칭자리 주차별 XP는 교사가 0~2를 확인해 한 번만 적용하고 현재 레벨 기준을 넘지 않는다',async t=>{
  const {room,first,teacher,student}=await fixture(t);student.avatar.constellationId='libra';student.avatar.xp=19;
  assert.ok((await call(first,'ability:use')).ok);
  const pillar=MAP.objects.find(object=>object.id==='pillar-effects');
  const teacherPlayer=[...room.players.values()].find(player=>player.role==='teacher');teacherPlayer.x=pillar.x;teacherPlayer.y=pillar.y;
  const board=await call(teacher,'temple:read',{objectId:pillar.id});const row=board.rows.find(entry=>entry.constellationId==='libra');
  assert.ok(row?.abilityMarkerId);
  const input={objectId:pillar.id,targetId:student.id,abilityMarkerId:row.abilityMarkerId};
  assert.equal((await call(teacher,'ability:complete',input)).ok,false);
  assert.equal((await call(teacher,'ability:complete',{...input,xpAmount:3})).ok,false);
  assert.equal(student.avatar.xp,19);
  const settled=await call(teacher,'ability:complete',{...input,xpAmount:2});assert.ok(settled.ok,settled.error);
  assert.equal(student.avatar.xp,20);assert.equal(student.avatar.level,2);
  assert.equal((await call(teacher,'ability:complete',{...input,xpAmount:2})).ok,false);
});
