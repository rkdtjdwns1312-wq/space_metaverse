import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {attackPowerOf} from '../shared/combat.js';
import {geminiSkillOf} from '../shared/gemini-skills.js';
import {advanceProjectiles} from '../server/projectiles.js';
import {combatEnemies,damageTargets} from '../server/sagittarius-skills.js';

test('실제 소켓: E 장비 피해는 서버 장착값만 사용·위조 무시·Q 제외·발동 뒤 해제해도 유지',async t=>{
  let now=1000000;const key='skill-damage-isolated',game=createClassroomServer({teacherKey:key,studentHours:false,clock:()=>now});
  const {port}=await game.listen(),sockets=[];
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});
  const connect=async()=>{const s=io(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false,autoConnect:false});
    sockets.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);s.connect();});return s;};
  const call=(s,event,data={})=>s.timeout(3000).emitWithAck(event,data),teacher=await connect(),student=await connect();
  const created=await call(teacher,'room:create',{teacherKey:key,allowedNames:['검사']});
  const joined=await call(student,'room:join',{code:created.room.code,nickname:'검사'});
  const room=game.store.rooms.get(created.room.code),p=room.players.get(joined.selfId);
  Object.assign(p,{x:1800,y:1320,facing:{x:1,y:0}});Object.assign(p.avatar,{level:4,constellationId:'gemini'});
  room.monsters=new Map();
  for(const equipped of [false,true]){
    p.equipmentSlots=equipped?['star-pattern-gloves','asteroid-badge',null]:[null,null,null];
    const base=attackPowerOf(4,'gemini',p),spec=geminiSkillOf(p);
    const result=await call(student,'combat:skill',{power:99999,skillDamage:99,skillDamageFactor:100,equipmentSlots:['star-pattern-gloves']});
    assert.equal(result.ok,true);const expected=Math.round(base*spec.multiplier*spec.effectAmount*(equipped?1.2:1));
    assert.equal(result.hit.power,expected);assert.equal(result.cooldowns[0],now+spec.cooldownMs);
    const projectiles=room.projectiles.filter(c=>!c.basic);assert.equal(projectiles.length,2);
    p.equipmentSlots=[];assert.ok(projectiles.every(c=>c.power===expected));
    // 장착한 상태에서도 Q는 기본 공격 수치입니다.
    p.equipmentSlots=equipped?['star-pattern-gloves',null,null]:[];
    const q=await call(student,'combat:attack',{skillDamage:99});assert.equal(q.ok,true);assert.equal(q.hit.power,base);
    advanceProjectiles(room,now+2000,combatEnemies,damageTargets);now+=10000;
  }
});
