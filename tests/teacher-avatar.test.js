import test from 'node:test';
import assert from 'node:assert/strict';
import {TEACHER_AVATAR} from '../shared/teacher-avatar.js';
import {attackPowerOf, defensePowerOf} from '../shared/combat.js';
import {vitalsOf} from '../shared/vitals.js';
import {avatarLabel} from '../shared/avatar-label.js';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';

test('교사 전용 능력은 role로만 적용되고 학생의 LV6 위조는 차단된다', () => {
  const teacher={role:'teacher',nickname:'선생님',avatar:{level:TEACHER_AVATAR.level}};
  const forged={role:'student',nickname:'학생',avatar:{level:6}};
  assert.equal(attackPowerOf(teacher.avatar.level,null,teacher),99999);
  assert.equal(defensePowerOf(teacher.avatar.level,null,teacher),3);
  assert.deepEqual(vitalsOf(teacher.avatar.level,teacher),{hp:{current:99999,max:99999},mp:{current:40,max:40}});
  assert.equal(attackPowerOf(6,null,forged),null);
  assert.equal(vitalsOf(6,forged),null);
  assert.deepEqual(avatarLabel(teacher),{name:'선생님',detail:'LV6 별의수호자'});
});

test('실제 소켓 스냅샷은 교사 LV6 능력·HP를 보장하고 학생 role 위조를 무시한다', async t => {
  const game=createClassroomServer({teacherKey:'teacher-avatar-test-secret',studentHours:false});
  const address=await game.listen(),url='http://127.0.0.1:'+address.port,sockets=[];
  t.after(async()=>{for(const socket of sockets)socket.disconnect();await game.close();});
  const connect=async()=>{const socket=io(url,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;};
  const call=(socket,event,data)=>socket.timeout(3000).emitWithAck(event,data);
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:'teacher-avatar-test-secret',title:'교사',allowedNames:['1']});
  const student=await connect(),joined=await call(student,'room:join',{code:created.room.code,nickname:'1',role:'teacher',level:6});
  const teacherView=created.room.players.find(player=>player.role==='teacher');
  const studentView=joined.room.players.find(player=>player.id===joined.selfId);
  assert.equal(teacherView.avatar.level,6);assert.equal(teacherView.combat.attackPower,99999);assert.deepEqual(teacherView.vitals.hp,{current:99999,max:99999});
  assert.equal(studentView.role,'student');assert.equal(studentView.avatar.level,1);assert.equal(studentView.combat.attackPower,null);
});
