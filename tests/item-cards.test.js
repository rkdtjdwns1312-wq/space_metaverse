import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createClassroomServer} from '../server/app.js';
import {MAP,SHOP,BLACK_HOLE_ID,PLAZA_ID} from '../shared/config.js';
import {nextKoreaMidnight} from '../server/item-cards.js';
import {warningCount} from '../server/warnings.js';
import {RABBIT_DRAW_CATALOG,RABBIT_DRAW_COUNT,RABBIT_REWARD_WEIGHTS,rabbitReward} from '../server/rabbit-draw.js';

const key='ppt-item-card-test-private-key';
const call=(socket,event,data={})=>socket.timeout(4000).emitWithAck(event,data);
async function fixture(t){
  const game=createClassroomServer({teacherKey:key,studentHours:false}),address=await game.listen(),sockets=[];
  t.after(async()=>{for(const socket of sockets)socket.disconnect();await game.close();});
  const connect=async()=>{const socket=io('http://127.0.0.1:'+address.port,{transports:['websocket'],forceNew:true,reconnection:false});
    sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;};
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:key,title:'카드 실험',allowedNames:['별이','달이']});
  const first=await connect(),second=await connect();
  const a=await call(first,'room:join',{code:created.room.code,nickname:'별이'});
  const b=await call(second,'room:join',{code:created.room.code,nickname:'달이'});
  assert.ok(created.ok&&a.ok&&b.ok);
  const room=game.store.rooms.get(created.room.code);
  return {game,room,teacher,first,second,a,b};
}

test('PPT의 서로 다른 Lv1 카드 8종이 지정 가격과 그림·설명을 가진다',()=>{
  const cards=SHOP.items.filter(item=>item.art&&item.level===1&&item.type==='tool');
  assert.equal(cards.length,8);assert.ok(cards.every(item=>item.level===1&&item.description&&item.special));
  assert.deepEqual(Object.fromEntries(cards.map(item=>[item.id,item.price])),{
    'space-food-card':2,'space-robot-card':2,'alien-card':4,'space-suit-card':2,
    'meteor-fragment-card':3,'little-sun-card':1,'little-moon-card':2,'moon-rabbit-card':3});
  assert.deepEqual(new Set(cards.map(item=>item.mode)),new Set(['manual','meteor','uv','moon','draw']));
  assert.equal(nextKoreaMidnight(Date.parse('2026-09-18T14:59:59Z')),Date.parse('2026-09-18T15:00:00Z'));
  assert.equal(nextKoreaMidnight(Date.parse('2026-09-18T15:00:00Z')),Date.parse('2026-09-19T15:00:00Z'));
});

test('현실 교실 카드는 대상 이름과 함께 기둥에 남고 선생님만 처리 완료한다',async t=>{
  const {room,teacher,first,a}=await fixture(t),student=room.players.get(a.selfId);
  student.inventory=[{id:'alien-card',quantity:1}];
  const used=await call(first,'item:use',{itemId:'alien-card',targetId:a.selfId});assert.ok(used.ok,used.error);
  assert.equal(student.cardMarkers.length,1);assert.equal(student.cardMarkers[0].until,null);
  const pillar=MAP.objects.find(object=>object.id==='pillar-effects');
  const teacherPlayer=[...room.players.values()].find(player=>player.role==='teacher');teacherPlayer.x=pillar.x;teacherPlayer.y=pillar.y;
  student.x=pillar.x;student.y=pillar.y;
  const board=await call(teacher,'temple:read',{objectId:pillar.id});assert.ok(board.ok,board.error);
  const row=board.rows.find(entry=>entry.itemId==='alien-card');assert.equal(row.nickname,'별이');assert.ok(row.markerId);
  assert.equal((await call(first,'item:complete',{objectId:pillar.id,targetId:a.selfId,markerId:row.markerId})).ok,false);
  assert.ok((await call(teacher,'item:complete',{objectId:pillar.id,targetId:a.selfId,markerId:row.markerId})).ok);
  assert.equal((await call(teacher,'temple:read',{objectId:pillar.id})).rows.some(entry=>entry.itemId==='alien-card'),false);
});

test('꼬마 해 자외선은 자정까지 사용을 막고 꼬마 달은 해제·보호한다',async t=>{
  const {room,first,second,a,b}=await fixture(t),sunUser=room.players.get(a.selfId),target=room.players.get(b.selfId);
  sunUser.inventory=[{id:'little-sun-card',quantity:2}];target.inventory=[{id:'star-sticker',quantity:1},{id:'little-moon-card',quantity:1}];
  assert.equal((await call(first,'item:use',{itemId:'little-sun-card',targetId:a.selfId})).ok,false);
  assert.ok((await call(first,'item:use',{itemId:'little-sun-card',targetId:b.selfId})).ok);
  assert.equal(target.cardMarkers.find(marker=>marker.itemId==='little-sun-card').until,nextKoreaMidnight(Date.now()));
  assert.match((await call(second,'item:use',{itemId:'star-sticker',targetId:b.selfId})).error,/자외선/);
  assert.ok((await call(second,'item:use',{itemId:'little-moon-card',targetId:b.selfId})).ok);
  assert.equal(target.cardMarkers.some(marker=>marker.itemId==='little-sun-card'),false);
  assert.equal(target.cardMarkers.some(marker=>marker.itemId==='little-moon-card'),true);
  sunUser.lastItemUseAt=0;
  assert.match((await call(first,'item:use',{itemId:'little-sun-card',targetId:b.selfId})).error,/꼬마 달/);
  assert.equal(sunUser.inventory[0].quantity,1);
});

test('운석 파편은 선택한 다른 부서의 내 활성 경고만 해제한다',async t=>{
  const {room,first,a,b}=await fixture(t),student=room.players.get(a.selfId),other=room.players.get(b.selfId);
  const planet={id:'dept-other',name:'다른부서',description:'테스트 부서',x:400,y:400,radius:60,color:'#aabbcc',rules:[],
    createdBy:null,templateId:null,interiorDecor:{},warnings:{threshold:1,entries:[
    {id:'w1',targetId:student.id,actorId:other.id,reason:'테스트',at:Date.now(),active:true},
    {id:'w2',targetId:other.id,actorId:student.id,reason:'테스트',at:Date.now(),active:true}
  ]}};
  room.planets.set(planet.id,planet);student.avatar.blackStar={planetId:planet.id,at:Date.now()};student.mapId=BLACK_HOLE_ID;
  student.inventory=[{id:'meteor-fragment-card',quantity:1}];
  const options=await call(first,'item:meteor:options');assert.equal(options.planets[0].id,planet.id);
  assert.ok((await call(first,'item:use',{itemId:'meteor-fragment-card',targetId:a.selfId,planetId:planet.id})).ok);
  assert.equal(warningCount(planet,student.id),0);assert.equal(warningCount(planet,other.id),1);
  assert.equal(student.avatar.blackStar,null);assert.equal(student.mapId,PLAZA_ID);
});

test('이전 달토끼 숫자 보상 가중치는 유지된다',()=>{
  assert.equal(RABBIT_REWARD_WEIGHTS.reduce((sum,count)=>sum+count,0),100);
  assert.equal(RABBIT_REWARD_WEIGHTS.reduce((sum,count,index)=>sum+count*(index+1),0),300);
  assert.deepEqual(Array.from({length:100},(_,roll)=>rabbitReward(roll)).reduce((counts,reward)=>{counts[reward-1]++;return counts;},Array(10).fill(0)),RABBIT_REWARD_WEIGHTS);
});

test('달토끼 54장 보상 객체 뽑기는 하루 한 번만 사용한다',async t=>{
  assert.equal(RABBIT_DRAW_COUNT,54);
  assert.equal(RABBIT_DRAW_CATALOG.length,54);
  const {room,first,a}=await fixture(t),student=room.players.get(a.selfId);
  student.inventory=[{id:'moon-rabbit-card',quantity:2}];
  const start=await call(first,'draw:start');assert.ok(start.ok,start.error);
  assert.equal(start.draw.cards.length,RABBIT_DRAW_COUNT);assert.equal(start.draw.cards[0].reward,undefined);
  assert.equal(student.inventory[0].quantity,1);
  const again=await call(first,'draw:start');assert.equal(again.draw.id,start.draw.id);
  const status=await call(first,'draw:status');assert.equal(status.draw.id,start.draw.id);
  assert.equal((await call(first,'item:use',{itemId:'moon-rabbit-card',targetId:a.selfId})).ok,false);
  const serverKnownShards4Card=student.rabbitDraw.cards.find(card=>card.reward.kind==='shards'&&card.reward.amount===4);
  assert.ok(serverKnownShards4Card);
  const result=await call(first,'draw:pick',{drawId:start.draw.id,cardId:serverKnownShards4Card.id});
  assert.ok(result.ok,result.error);assert.deepEqual(result.reward,serverKnownShards4Card.reward);
  assert.equal(student.starShards,4);
  assert.equal((await call(first,'draw:pick',{drawId:start.draw.id,cardId:start.draw.cards[0].id})).ok,false);
  assert.match((await call(first,'draw:start')).error,/하루에 한 번/);
  assert.equal(student.inventory[0].quantity,1);
  assert.match(student.cardMarkers[0].note,/당첨/);
});

test('우주복은 두 명을 지정해야 하며 양쪽 사용 기록에 상대 이름이 남는다',async t=>{
  const {room,first,a,b}=await fixture(t),student=room.players.get(a.selfId),other=room.players.get(b.selfId);
  student.inventory=[{id:'space-suit-card',quantity:1}];
  assert.equal((await call(first,'item:use',{itemId:'space-suit-card',targetId:a.selfId})).ok,false);
  const result=await call(first,'item:use',{itemId:'space-suit-card',targetId:a.selfId,secondTargetId:b.selfId});
  assert.ok(result.ok,result.error);
  assert.match(student.cardMarkers[0].note,/달이/);assert.match(other.cardMarkers[0].note,/별이/);
  assert.equal(student.inventory.length,0);
});

test('자외선과 현실 교실 처리 대기 카드는 교실 재시작 뒤에도 남는다',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'class-item-cards-')),sockets=[];
  let game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false}),address=await game.listen();
  t.after(async()=>{for(const socket of sockets)socket.disconnect();await game.close();await rm(dir,{recursive:true,force:true});});
  async function connect(){const socket=io('http://127.0.0.1:'+address.port,{transports:['websocket'],forceNew:true,reconnection:false});
    sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;}
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:key,title:'보존 실험',studentAccounts:[
    {nickname:'별이',pin:'1234'},{nickname:'달이',pin:'5678'}]});assert.ok(created.ok,created.error);
  const first=await connect(),second=await connect();
  const a=await call(first,'room:join',{code:created.room.code,nickname:'별이',pin:'1234'});
  const b=await call(second,'room:join',{code:created.room.code,nickname:'달이',pin:'5678'});
  const room=game.store.rooms.get(created.room.code),sender=room.players.get(a.selfId),target=room.players.get(b.selfId);
  sender.inventory=[{id:'little-sun-card',quantity:1}];target.inventory=[{id:'alien-card',quantity:1}];
  assert.ok((await call(second,'item:use',{itemId:'alien-card',targetId:b.selfId})).ok);
  assert.ok((await call(first,'item:use',{itemId:'little-sun-card',targetId:b.selfId})).ok);
  sender.inventory=[{id:'moon-rabbit-card',quantity:2}];sender.lastItemUseAt=0;
  const pending=await call(first,'draw:start');assert.ok(pending.ok,pending.error);
  await game.close();game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false});address=await game.listen();
  assert.ok((await call(await connect(),'room:open',{teacherKey:key,code:created.room.code})).ok);
  const rabbitSocket=await connect(),rabbitJoined=await call(rabbitSocket,'room:join',{code:created.room.code,nickname:'별이',pin:'1234'});
  assert.ok(rabbitJoined.ok,rabbitJoined.error);
  const resumed=await call(rabbitSocket,'draw:status');assert.equal(resumed.draw.id,pending.draw.id);
  assert.deepEqual(resumed.draw.cards,pending.draw.cards);
  const picked=await call(rabbitSocket,'draw:pick',{drawId:pending.draw.id,cardId:pending.draw.cards[1].id});
  assert.ok(picked.ok,picked.error);assert.match((await call(rabbitSocket,'draw:start')).error,/하루에 한 번/);
  const returning=await connect(),joined=await call(returning,'room:join',{code:created.room.code,nickname:'달이',pin:'5678'});
  assert.ok(joined.ok,joined.error);
  const markers=game.store.rooms.get(created.room.code).players.get(joined.selfId).cardMarkers;
  assert.deepEqual(new Set(markers.map(marker=>marker.itemId)),new Set(['alien-card','little-sun-card']));
  assert.match((await call(returning,'item:use',{itemId:'star-sticker',targetId:joined.selfId})).error,/가방에/);
  const back=game.store.rooms.get(created.room.code).players.get(joined.selfId);back.inventory=[{id:'star-sticker',quantity:1}];
  assert.match((await call(returning,'item:use',{itemId:'star-sticker',targetId:joined.selfId})).error,/자외선/);
});
