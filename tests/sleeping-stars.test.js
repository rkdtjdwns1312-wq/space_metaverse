import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {SLEEPING_STARS_MAPS,ORIGIN_MAPS,STREET,STATIC_MAPS,MAP,BLACK_HOLE,UNIVERSE_MAP_LAYOUT} from '../shared/config.js';
import {SLEEPING_STARS_SKY} from '../shared/sleeping-stars.js';
import {originFloor} from '../shared/origin-floor.js';
import {avatarPositionIsClear} from '../shared/avatar-boundary.js';
import {MONSTER_TYPES} from '../shared/monsters.js';

test('sleeping stars reuse all four origin dimensions/outlines with gates only and no monsters',()=>{
  assert.equal(SLEEPING_STARS_MAPS.length,4);
  for(const [index,map] of SLEEPING_STARS_MAPS.entries()){
    const origin=ORIGIN_MAPS[index];
    assert.equal(map.name,'별들이 잠드는 곳 '+(index+1));
    assert.deepEqual([map.width,map.height,map.spawn],[origin.width,origin.height,origin.spawn]);
    assert.deepEqual(originFloor(map),originFloor(origin));
    assert(map.objects.every(object=>object.kind==='gate'));
    assert.equal(Object.values(MONSTER_TYPES).filter(type=>type.mapId===map.id).length,0);
    assert.equal(STATIC_MAPS[map.id],map);
  }
});

test('all sleeping-star arrivals and north shelter path fit every avatar without hitting buildings',()=>{
  const maps=[STREET,...SLEEPING_STARS_MAPS];
  const avatars=[1,2,3,4,5].map(level=>({role:'student',avatar:{level}}));
  avatars.push({role:'teacher',avatar:{level:6}});
  for(const map of maps)for(const gate of map.objects.filter(object=>object.kind==='gate'&&(object.target.startsWith('sleeping-stars-')||map.theme==='sleeping-stars'))){
    const target=STATIC_MAPS[gate.target];
    assert(target.objects.some(object=>object.kind==='gate'&&object.target===map.id),'bidirectional '+map.id+' -> '+target.id);
    for(const avatar of avatars){
      assert(avatarPositionIsClear(map,gate.x,gate.y,avatar),map.id+' gate');
      assert(avatarPositionIsClear(target,gate.arrival.x,gate.arrival.y,avatar),map.id+' arrival '+target.id);
    }
  }
  const gate=STREET.objects.find(object=>object.target===SLEEPING_STARS_MAPS[0].id);
  assert(gate.y<Math.min(...STREET.objects.filter(object=>object.kind.endsWith('-station')).map(object=>object.y)));
  for(let y=gate.y;y<=550;y+=5)for(const avatar of avatars)assert(avatarPositionIsClear(STREET,gate.x,y,avatar),'north approach '+y);
  for(const map of SLEEPING_STARS_MAPS)for(const gate of map.objects)for(let step=0;step<=40;step++){
    const t=step/40,x=map.width/2+(gate.x-map.width/2)*t,y=map.height/2+(gate.y-map.height/2)*t;
    for(const avatar of avatars)assert(avatarPositionIsClear(map,x,y,avatar),map.id+' bridge '+step);
  }
});

test('sleeping-star map cards form a northbound chain above shelter; black hole remains a real hidden map',()=>{
  const shelter=UNIVERSE_MAP_LAYOUT.find(node=>node.id===STREET.id);
  SLEEPING_STARS_MAPS.forEach((map,index)=>{
    const node=UNIVERSE_MAP_LAYOUT.find(item=>item.id===map.id);
    assert.deepEqual([node.row,node.column],[shelter.row-index-1,shelter.column]);
  });
  assert(!UNIVERSE_MAP_LAYOUT.some(node=>node.id===BLACK_HOLE.id));
  assert.equal(STATIC_MAPS[BLACK_HOLE.id],BLACK_HOLE);
  assert(MAP.objects.some(object=>object.kind==='black-hole'&&object.target===BLACK_HOLE.id));
  assert(BLACK_HOLE.objects.some(object=>object.target===MAP.id));
});

test('night sky has strictly fewer stars and less light at each stage',()=>{
  for(let index=1;index<SLEEPING_STARS_SKY.length;index++){
    assert(SLEEPING_STARS_SKY[index].stars<SLEEPING_STARS_SKY[index-1].stars);
    assert(SLEEPING_STARS_SKY[index].brightness<SLEEPING_STARS_SKY[index-1].brightness);
  }
});

test('server gates travel shelter → 1 → 2 → 3 → 4 and back, rejects remote gates, and preserves black-hole portal',async t=>{
  const teacherKey='sleeping-stars-isolated-test',game=createClassroomServer({teacherKey,studentHours:false});
  const {port}=await game.listen(),socket=io('http://127.0.0.1:'+port,{transports:['websocket'],reconnection:false});
  t.after(async()=>{socket.disconnect();await game.close();});
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  const call=(event,data)=>socket.timeout(4000).emitWithAck(event,data);
  const made=await call('room:create',{teacherKey,title:'북쪽지도검사',allowedNames:['여행검사']});assert(made.ok,made.error);
  const room=game.store.rooms.get(made.room.code),player=[...room.players.values()].find(item=>item.role==='teacher');
  Object.assign(player,{mapId:STREET.id,...STREET.spawn,input:{x:0,y:0,at:0}});
  const refused=await call('map:travel',{to:SLEEPING_STARS_MAPS[0].id});assert.equal(refused.ok,false);
  const route=[...SLEEPING_STARS_MAPS.map(map=>map.id),...SLEEPING_STARS_MAPS.slice(0,3).reverse().map(map=>map.id),STREET.id];
  for(const to of route){
    const gate=STATIC_MAPS[player.mapId].objects.find(object=>object.kind==='gate'&&object.target===to);assert(gate);
    Object.assign(player,{x:gate.x,y:gate.y,input:{x:0,y:0,at:0}});
    const reply=await call('map:travel',{to});assert(reply.ok,reply.error);assert.equal(player.mapId,to);
    assert(avatarPositionIsClear(STATIC_MAPS[to],player.x,player.y,player));
  }
  const fast=await call('map:fast-travel',{to:SLEEPING_STARS_MAPS[3].id});assert(fast.ok,fast.error);
  const portal=MAP.objects.find(object=>object.kind==='black-hole');Object.assign(player,{mapId:MAP.id,x:portal.x,y:portal.y});
  const inside=await call('map:travel',{to:BLACK_HOLE.id});assert(inside.ok,inside.error);assert.equal(player.mapId,BLACK_HOLE.id);
  const exit=BLACK_HOLE.objects.find(object=>object.kind==='gate');Object.assign(player,{x:exit.x,y:exit.y});
  const outside=await call('map:travel',{to:MAP.id});assert(outside.ok,outside.error);assert.equal(player.mapId,MAP.id);
});
