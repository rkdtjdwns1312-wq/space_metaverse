import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/rooms.js';
import { advance, isFree } from '../server/world.js';
import { MAP, PLAZA_ID, RULES } from '../shared/config.js';

const roomData={title:'겹침 테스트 교실',allowedNames:['1','2']};

test('advance lets both student and teacher pass through another player',()=>{
  const store=new RoomStore(), {room,player:teacher}=store.create(roomData,'teacher');
  const student=store.join({code:room.code,nickname:'1'},'student').player;
  teacher.x=400; teacher.y=400; student.x=400+RULES.radius*2; student.y=400;
  teacher.input={x:1,y:0,at:0}; student.input={x:-1,y:0,at:0};
  advance(room,0);
  assert.ok(teacher.x>400);
  assert.ok(student.x<400+RULES.radius*2);
});

test('isFree still blocks boundaries and solid objects when player collision is disabled',()=>{
  const store=new RoomStore(), {room}=store.create(roomData,'teacher');
  const star=MAP.objects.find(o=>o.kind==='pillar');
  assert.equal(isFree(room,RULES.radius-1,400,null,PLAZA_ID,false),false);
  assert.equal(isFree(room,star.x,star.y,null,PLAZA_ID,false),false);
});

test('player collision remains isolated by map when player avoidance is enabled',()=>{
  const store=new RoomStore(), {room,player}=store.create(roomData,'teacher');
  player.x=400; player.y=400; player.mapId='other-map';
  assert.equal(isFree(room,400,400,null,PLAZA_ID),true);
});
