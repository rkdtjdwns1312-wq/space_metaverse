import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {avatarFitsFloor} from '../shared/avatar-boundary.js';
import {STATIC_MAPS} from '../shared/config.js';

test('경계에 접한 서버 원좌표를 위치 패킷에도 그대로 전송한다',async t=>{
  const key='edge-isolated-test',game=createClassroomServer({teacherKey:key,studentHours:false});
  const {port}=await game.listen();
  const socket=io(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false,autoConnect:false});
  t.after(async()=>{socket.disconnect();await game.close();});
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);socket.connect();});
  const made=await socket.timeout(3000).emitWithAck('room:create',{teacherKey:key,allowedNames:['경계검사']});
  assert.equal(made.ok,true);
  const room=game.store.rooms.get(made.room.code),p=room.players.get(made.selfId);
  room.unattended=true;
  Object.assign(p,{role:'student',mapId:'space-plaza',x:1480.0799999999977,y:888.5416796675065});
  p.avatar={...p.avatar,level:5};p.input={x:0,y:0,at:0};
  const map=STATIC_MAPS[p.mapId];
  assert.equal(avatarFitsFloor(map,p.x,p.y,p),true);
  assert.equal(avatarFitsFloor(map,Math.round(p.x*10)/10,Math.round(p.y*10)/10,p),false,
    '이전 반올림 패킷은 서버와 달리 바닥 밖으로 판정됨');
  const expected={x:p.x,y:p.y};
  const packet=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('위치 패킷 대기 시간 초과')),3000);
    socket.on('world:positions',data=>{
      const point=data.positions.find(point=>point[0]===p.id);
      if(point){clearTimeout(timer);resolve(point);}
    });
  });
  assert.equal(packet[1],expected.x);assert.equal(packet[2],expected.y);
  assert.equal(avatarFitsFloor(map,packet[1],packet[2],p),true);
});
