import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/rooms.js';
import { advance, isFree } from '../server/world.js';
import { MAP, PLAZA_ID, RULES } from '../shared/config.js';

const roomData={title:'겹침 테스트 교실',allowedNames:['1','2']};

test('advance lets both student and teacher pass through another player',()=>{
  const store=new RoomStore(), {room,player:teacher}=store.create(roomData,'teacher');
  const student=store.join({code:room.code,nickname:'1'},'student').player;
  const x=MAP.spawn.x+200,y=MAP.spawn.y+200;
  teacher.x=x; teacher.y=y; student.x=x+RULES.radius*2; student.y=y;
  teacher.input={x:1,y:0,at:0}; student.input={x:-1,y:0,at:0};
  advance(room,0);
  assert.ok(teacher.x>x);
  assert.ok(student.x<x+RULES.radius*2);
});

test('isFree still blocks boundaries and solid objects when player collision is disabled',()=>{
  const store=new RoomStore(), {room}=store.create(roomData,'teacher');
  const star=MAP.objects.find(o=>o.kind==='pillar');
  assert.equal(isFree(room,RULES.radius-1,400,null,PLAZA_ID,false),false);
  assert.equal(isFree(room,star.x,star.y,null,PLAZA_ID,false),false);
});

test('player collision remains isolated by map when player avoidance is enabled',()=>{
  const store=new RoomStore(), {room,player}=store.create(roomData,'teacher');
  player.x=MAP.spawn.x; player.y=MAP.spawn.y; player.mapId='other-map';
  assert.equal(isFree(room,MAP.spawn.x,MAP.spawn.y,null,PLAZA_ID),true);
});
