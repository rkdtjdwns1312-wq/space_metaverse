import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {STREET,STREET_ID,VALLEY,VALLEY_ID,SHARDS,createAvatar,itemOf} from '../shared/config.js';
import {formatShards,hasUnlimitedShards} from '../shared/economy.js';
import {growthInfo,buyExperience} from '../server/evolution.js';
import {collectSunTax} from '../server/lv2-item-effects.js';

// 실제 비공개 조합법과 무관한 검사 전용 조합입니다.
const recipes=[{ingredients:[{id:'space-food-card',quantity:2}],output:{id:'android-card',quantity:1}}];
async function fixture(t){
  const teacherKey='teacher-economy-isolated-test-key';
  const game=createClassroomServer({teacherKey,studentHours:false,craftingRecipes:recipes});
  const {port}=await game.listen(),sockets=[];
  t.after(async()=>{for(const socket of sockets)socket.disconnect();await game.close();});
  const connect=async()=>{
    const socket=io('http://127.0.0.1:'+port,{transports:['websocket'],reconnection:false,forceNew:true});sockets.push(socket);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;
  };
  const call=(socket,event,data={})=>socket.timeout(4000).emitWithAck(event,data);
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey,title:'무료 운영 검사',allowedNames:['1']});
  assert.equal(created.ok,true);
  const student=await connect(),joined=await call(student,'room:join',{code:created.room.code,nickname:'1',role:'teacher',unlimitedShards:true});
  assert.equal(joined.ok,true);
  const room=game.store.rooms.get(created.room.code),tp=room.players.get(created.selfId),sp=room.players.get(joined.selfId);
  const at=(p,kind)=>{const o=STREET.objects.find(o=>o.kind===kind);Object.assign(p,{mapId:STREET_ID,x:o.x,y:o.y});};
  return {game,room,teacher,student,tp,sp,call,connect,at};
}

test('교사 잔액0 무료 구매·판매, 학생 비용과 위조/수량/거리 검증 유지',async t=>{
  const f=await fixture(t),{teacher,student,tp,sp,call,at}=f;
  assert.equal(hasUnlimitedShards(tp),true);assert.equal(hasUnlimitedShards(sp),false);
  assert.match(formatShards(tp),/∞/);assert.equal(formatShards(sp),'0');
  at(tp,'shop');at(sp,'shop');
  const request={itemId:'space-food-card',quantity:2,role:'teacher',unlimitedShards:true,cost:0};
  assert.equal((await call(student,'shop:buy',request)).ok,false);
  assert.equal(sp.starShards,0);assert.deepEqual(sp.inventory,[]);
  const bought=await call(teacher,'shop:buy',request);
  assert.equal(bought.ok,true);assert.equal(bought.cost,0);assert.equal(tp.starShards,0);
  assert.equal(tp.inventory.find(i=>i.id===request.itemId).quantity,2);
  assert.equal((await call(teacher,'shop:buy',{...request,quantity:0})).ok,false);
  const anonymous=await f.connect();assert.equal((await call(anonymous,'shop:buy',request)).ok,false);
  sp.starShards=10;const price=itemOf(request.itemId).price;
  assert.equal((await call(student,'shop:buy',request)).ok,true);assert.equal(sp.starShards,10-price*2);
  tp.starShards=SHARDS.max;
  assert.equal((await call(teacher,'shop:sell',{itemId:request.itemId,quantity:2})).ok,true);
  assert.equal(tp.starShards,SHARDS.max);
  tp.x=0;tp.y=0;assert.equal((await call(teacher,'shop:buy',request)).ok,false);
  assert.ok(Number.isSafeInteger(JSON.parse(JSON.stringify(f.game.store.snapshot(f.room,tp))).players.find(p=>p.id===tp.id).starShards));
});

test('교사 무료 구매는 초신성 할인권을 소모하지 않는다',async t=>{
  const {teacher,tp,call,at}=await fixture(t);at(tp,'shop');
  tp.inventory=[{id:'supernova-alpha-card',quantity:1}];
  const before=structuredClone(tp.lv3State);
  const reply=await call(teacher,'shop:buy',{itemId:'space-food-card',quantity:1});
  assert.equal(reply.ok,true);assert.equal(reply.cost,0);assert.equal(reply.discounted,0);
  assert.deepEqual(tp.lv3State,before);
});

test('교사 조합 성공/실패 모두 수수료0, 학생은 잔액 검증 후1 차감',async t=>{
  const {teacher,student,tp,sp,call,at}=await fixture(t);
  for(const p of [tp,sp]){at(p,'crafting');p.inventory=[{id:'space-food-card',quantity:3}];}
  assert.equal((await call(teacher,'crafting:open')).fee,0);
  assert.equal((await call(student,'crafting:open')).fee,1);
  const good={ingredients:recipes[0].ingredients,role:'teacher',fee:0,unlimitedShards:true};
  assert.equal((await call(student,'crafting:combine',good)).ok,false);
  const made=await call(teacher,'crafting:combine',good);
  assert.equal(made.ok,true);assert.equal(made.success,true);assert.equal(tp.starShards,0);
  const before=structuredClone(tp.inventory);
  const wrong=await call(teacher,'crafting:combine',{ingredients:[{id:'space-food-card',quantity:1}]});
  assert.equal(wrong.ok,true);assert.equal(wrong.success,false);assert.equal(tp.starShards,0);assert.deepEqual(tp.inventory,before);
  sp.starShards=1;
  assert.equal((await call(student,'crafting:combine',good)).success,true);assert.equal(sp.starShards,0);
});

test('성장 비용은 교사만 면제하고 XP 상한과 LV6 최고단계를 유지한다',()=>{
  const star=VALLEY.objects.find(o=>o.id==='growth-star');
  const p={role:'teacher',mapId:VALLEY_ID,x:star.x,y:star.y,avatar:createAvatar(),starShards:0};
  const room={players:new Map()};
  assert.equal(growthInfo(room,p).maxBuy,15);
  assert.throws(()=>buyExperience(room,p,{amount:16}),/최대/);
  assert.equal(buyExperience(room,p,{amount:15}).avatar.xp,15);assert.equal(p.starShards,0);
  p.role='student';p.avatar=createAvatar();p.unlimitedShards=true;
  assert.equal(growthInfo(room,p).maxBuy,0);assert.throws(()=>buyExperience(room,p,{amount:1}),/부족/);
  p.role='teacher';p.avatar.level=6;
  assert.equal(growthInfo(room,p).maxBuy,0);assert.equal(growthInfo(room,p).unlimitedShards,true);
  assert.throws(()=>buyExperience(room,p,{amount:1}),/초월체/);assert.equal(p.avatar.level,6);
});

test('해 효과 사용료도 교사 면제이며 학생 비용과 수령인 지급은 유지한다',()=>{
  const now=Date.now(),owner={id:'owner',role:'student',starShards:0};
  const actor={id:'actor',role:'teacher',starShards:0,cardMarkers:[{itemId:'sun-card',until:now+60000,fromId:owner.id,fromLevel:2,at:now}]};
  const room={players:new Map([[owner.id,owner],[actor.id,actor]])};
  assert.equal(collectSunTax(room,actor,now).amount,0);assert.equal(owner.starShards,0);
  actor.role='student';assert.throws(()=>collectSunTax(room,actor,now),/사용료/);
  actor.starShards=1;assert.equal(collectSunTax(room,actor,now).amount,1);
  assert.equal(actor.starShards,0);assert.equal(owner.starShards,1);
});
