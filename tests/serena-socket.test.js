import {chargeHuntingStation} from '../server/hunting-time.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {damageMonster} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {summonSerena} from '../server/serena.js';
import {beginSerenaSkill} from '../server/serena-skills.js';
import {nextBossRespawnAt} from '../server/boss-lifecycle.js';
import {SERENA} from '../shared/serena.js';
import {mapOf} from '../shared/config.js';
const key='serena-test-only-key',call=(s,event,data={})=>s.timeout(3000).emitWithAck(event,data);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){for(let i=0;i<100;i++){if(check())return;await pause(20);}assert.ok(check(),'서버 상태 전파 제한 시간');}
const statue=mapOf(SERENA.mapId).objects.find(o=>o.id===SERENA.statueId);
async function fixture(t){
  const dir=mkdtempSync(join(tmpdir(),'serena-socket-')),sockets=[];let now=Date.now();
  const game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false,unattended:false,teacherManagedAccounts:false,clock:()=>now});
  t.after(async()=>{for(const s of sockets)s.disconnect();await game.close();rmSync(dir,{recursive:true,force:true});});
  const address=await game.listen();
  async function connect(){const s=io('http://127.0.0.1:'+address.port,{transports:['websocket'],reconnection:false,forceNew:true});sockets.push(s);
    await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;}
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:key,title:'세레나 검사',allowedNames:['1','2']});
  assert.equal(created.ok,true,created.error);const code=created.room.code;
  const a=await connect(),ja=await call(a,'room:join',{code,nickname:'1',pin:'1234'});
  const b=await connect(),jb=await call(b,'room:join',{code,nickname:'2',pin:'2345'});
  assert.ok(ja.ok,ja.error);assert.ok(jb.ok,jb.error);
  return {game,a,b,teacher,ja,jb,code,connect,get now(){return now;},set now(value){now=value;},
    get room(){return game.store.rooms.get(code);},get pa(){return game.store.rooms.get(code).players.get(ja.selfId);},
    get pb(){return game.store.rooms.get(code).players.get(jb.selfId);},disk:()=>JSON.parse(readFileSync(join(dir,code+'.json'),'utf8'))};
}
function qualify(f,p){f.game.store.transact(()=>{chargeHuntingStation(p,'math',f.now);
  Object.assign(p.avatar,{level:5,form:'transcendent',constellationId:'taurus'});
  p.serenaProgress={highestLevel:5,bossKills:['leoon','noksera']};
});Object.assign(p,{mapId:SERENA.mapId,x:statue.x,y:statue.y+90});}

test('세레나 별 표식 스냅샷과 실제 서버 틱의 즉사·활력 이벤트가 일치하며 다른 맵에는 피해를 보내지 않는다',async t=>{
  const f=await fixture(t);qualify(f,f.pa);assert.ok((await call(f.a,'serena:summon')).ok);
  const boss=f.room.monsters.get(SERENA.monsterId),hits=[],vitals=[],otherHits=[];let ownTick,otherTick;
  f.a.on('world:positions',v=>ownTick=v);f.b.on('world:positions',v=>otherTick=v);
  f.a.on('combat:monster-hit',v=>hits.push(v));f.a.on('combat:vitals',v=>vitals.push(v));
  f.b.on('combat:monster-hit',v=>otherHits.push(v));
  assert.equal(beginSerenaSkill(f.room,boss,'black',f.now,()=>0),true);
  await until(()=>ownTick?.monsters.some(m=>m.serenaSkillEffects?.marks.length)&&otherTick);
  const mark=ownTick.monsters.find(m=>m.id===boss.id).serenaSkillEffects.marks[0];
  assert.equal(mark.kind,'black');assert.equal(mark.remaining,5);assert.equal(mark.playerId,f.pa.id);assert.equal(Object.hasOwn(mark,'contacts'),false);
  // 기존 몬스터 위치는 교실 전체에 공유하고 클라이언트가 mapId로 그림을 제한합니다.
  const otherBoss=otherTick.monsters.find(m=>m.id===boss.id);
  assert.notEqual(otherBoss.mapId,f.pb.mapId);assert.equal(otherBoss.serenaSkillEffects.marks.some(m=>m.playerId===f.pb.id),false);
  f.now+=10000;
  await until(()=>hits.some(h=>h.skillKind==='serena-black')&&vitals.some(v=>v.playerId===f.pa.id&&v.vitals.defeated));
  assert.equal(ensureVitals(f.pa).hp,0);assert.equal(hits.filter(h=>h.skillKind==='serena-black').length,1);
  assert.equal(otherHits.length,0);
  await until(()=>!ownTick.monsters.find(m=>m.id===boss.id)?.serenaSkillEffects?.marks.length);
});

test('소켓은 클라이언트 자격 위조를 무시하고 동시 예 두 요청 중 하나만 소환한다',async t=>{
  const f=await fixture(t);
  assert.deepEqual(await call(f.a,'serena:summon',{serenaEligible:true,serenaProgress:{highestLevel:5,bossKills:['leoon','noksera']}}),{ok:false,error:'자격이 충분하지 않습니다'});
  assert.match((await call(f.teacher,'serena:summon')).error,/석상 가까이/);
  qualify(f,f.pa);qualify(f,f.pb);
  let snapshot,tick;f.a.on('room:state',r=>snapshot=r);f.a.on('world:positions',r=>tick=r);
  const results=await Promise.all([call(f.a,'serena:summon'),call(f.b,'serena:summon')]);
  assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.filter(r=>!r.ok).length,1);
  assert.deepEqual(results.find(r=>r.ok).serena,{state:'active',monsterId:SERENA.monsterId,respawnAt:null});
  await until(()=>snapshot?.serena.state==='active'&&tick?.serena.state==='active');
  const me=snapshot.players.find(p=>p.id===f.pa.id),other=snapshot.players.find(p=>p.id===f.pb.id);
  assert.equal(me.serenaEligible,true);assert.deepEqual(me.serenaEligibility,{reachedLv5:true,defeatedLeoon:true,defeatedNoksera:true});
  assert.equal(Object.hasOwn(other,'serenaEligible'),false);
  assert.equal(tick.monsters.filter(m=>m.typeId==='serena').length,1);assert.equal(f.disk().serena.state,'active');
});

test('빨간별의 숫자·5초 만료·대상 200% 피해가 실제 소켓 스냅샷과 활력에 반영된다',async t=>{
  const f=await fixture(t);qualify(f,f.pa);assert.ok((await call(f.a,'serena:summon')).ok);
  const boss=f.room.monsters.get(SERENA.monsterId),hits=[];let state;
  f.a.on('world:positions',value=>state=value);f.a.on('combat:monster-hit',value=>hits.push(value));
  f.pa.accountKind='master';ensureVitals(f.pa).hp=500;f.pa.x+=600;
  assert(beginSerenaSkill(f.room,boss,'red',f.now,()=>0));boss.stunUntil=f.now+20000;
  await until(()=>state?.monsters.find(monster=>monster.id===boss.id)?.serenaSkillEffects?.marks[0]?.requiredFriends===1);
  const mark=state.monsters.find(monster=>monster.id===boss.id).serenaSkillEffects.marks[0];
  assert.equal(mark.endsAt-mark.startsAt,5000);assert.equal(mark.nearbyFriends,0);
  f.now+=4999;await pause(100);assert.equal(hits.filter(hit=>hit.skillKind==='serena-red').length,0);
  f.pa.x+=100;f.now++;await until(()=>hits.some(hit=>hit.skillKind==='serena-red'));
  assert.deepEqual(hits.filter(hit=>hit.skillKind==='serena-red').map(hit=>[hit.targetId,hit.damage]),[[f.pa.id,60]]);
  assert.equal(ensureVitals(f.pa).hp,440);await pause(100);assert.equal(hits.filter(hit=>hit.skillKind==='serena-red').length,1);
});

test('선생님은 학생 자격 기록 없이 석상 앞에서 세레나를 소환한다',async t=>{
  const f=await fixture(t);
  const teacher=[...f.room.players.values()].find(p=>p.role==='teacher');
  assert.ok(teacher);
  Object.assign(teacher,{mapId:SERENA.mapId,x:statue.x,y:statue.y+90});
  const result=await call(f.teacher,'serena:summon');
  assert.equal(result.ok,true,result.error);
  assert.equal(f.room.serena.state,'active');
});

test('소켓 소환 저장 실패는 성공 응답과 active 알림을 보내지 않는다',async t=>{
  const f=await fixture(t);qualify(f,f.pa);const states=[];f.a.on('room:state',r=>states.push(r.serena.state));
  const save=f.game.store.files.save.bind(f.game.store.files);f.game.store.files.save=()=>{throw Error('simulated save failure');};
  let result;try{result=await call(f.a,'serena:summon');}finally{f.game.store.files.save=save;}
  assert.equal(result.ok,false);assert.match(result.error,/저장/);await pause(100);
  assert.ok(!states.includes('active'));assert.equal(f.disk().serena.state,'dormant');
  assert.equal(f.room.monsters.has(SERENA.monsterId),false);
  assert.equal((await call(f.a,'serena:summon')).ok,true);
});

test('실제 서버 틱은 처치 저장 실패를 재시도하고 다음 날 07시 경계에서 석상만 복원한다',async t=>{
  const f=await fixture(t);qualify(f,f.pa);assert.ok((await call(f.a,'serena:summon')).ok);
  const dialogues=[],elsewhere=[];f.a.on('combat:boss-defeated',e=>dialogues.push(e));f.b.on('combat:boss-defeated',e=>elsewhere.push(e));
  const drops=[],states=[];f.a.on('energy:drops',r=>drops.push(r));f.a.on('world:positions',r=>states.push(r.serena));
  const save=f.game.store.files.save.bind(f.game.store.files);f.game.store.files.save=()=>{throw Error('simulated death save failure');};
  try{
    damageMonster(f.room,f.room.monsters.get(SERENA.monsterId),f.pa,10000,f.now);
    await until(()=>f.room.bossSaveRetryAt>f.now);
    assert.equal(f.disk().serena.state,'active');assert.equal(f.room.energyDrops?.size||0,0);
    assert.ok(drops.every(r=>r.drops.length===0));
    assert.equal(dialogues.length,0);
  }finally{f.game.store.files.save=save;}
  // 60초 넘게 지연된 재시도에서도 보상은 새 정산 시각부터 온전히 유지됩니다.
  const deathAt=f.now;f.now+=65001;
  await until(()=>f.room.serena.state==='recovering');
  await until(()=>drops.some(r=>r.drops.some(d=>d.itemId==='radiant-star-origin')));
  await until(()=>dialogues.length===1);assert.equal(dialogues[0].bossId,'serena');assert.equal(elsewhere.length,0);
  const untilAt=nextBossRespawnAt(deathAt);assert.equal(f.disk().serena.respawnAt,untilAt);
  assert.equal([...f.room.energyDrops.values()].filter(d=>d.itemId==='radiant-star-origin').length,1);
  assert.ok([...f.room.energyDrops.values()].every(d=>d.publicAt===f.now+30000&&d.expiresAt===f.now+60000));
  f.now=untilAt-1;await pause(120);assert.equal(f.room.serena.state,'recovering');
  assert.equal(dialogues.length,1,'다음 틱에도 반복 대화 없음');
  f.now=untilAt;await until(()=>f.room.serena.state==='dormant');
  await until(()=>states.some(s=>s.state==='dormant'));
  assert.equal(f.disk().serena.state,'dormant');assert.equal(f.room.monsters.has(SERENA.monsterId),false);
});

test('보스 저장 재시도 대기 중에도 위치 전파·자연 회복·만료 드랍 정리를 계속한다',async t=>{
  const f=await fixture(t);qualify(f,f.pa);assert.ok((await call(f.a,'serena:summon')).ok);
  damageMonster(f.room,f.room.monsters.get(SERENA.monsterId),f.pa,10000,f.now);
  f.room.bossSaveRetryAt=f.now+1000;
  const vitals=ensureVitals(f.pa);vitals.hp=1;vitals.mp=0;vitals.nextPassiveRecoveryAt=f.now;
  f.room.energyDrops=new Map([['expired',{id:'expired',expiresAt:Date.now()-1}]]);
  let ticks=0;f.a.on('world:positions',()=>ticks++);
  await until(()=>ticks>=2&&ensureVitals(f.pa).hp>1&&!f.room.energyDrops.has('expired'));
  assert.equal(f.room.pendingBossDeaths.size,1);assert.equal(f.room.serena.state,'active');
  assert.equal(ensureVitals(f.pa).mp,2);assert.equal(f.disk().serena.state,'active');
});

test('첫 교실 보스 저장 롤백 뒤 다음 교실은 교체된 Map의 참조로 다음 틱에 정산한다',async t=>{
  const f=await fixture(t);qualify(f,f.pa);assert.ok((await call(f.a,'serena:summon')).ok);
  const teacher2=await f.connect(),created=await call(teacher2,'room:create',{teacherKey:key,title:'두번째 교실',allowedNames:['1']});
  assert.ok(created.ok,created.error);const code2=created.room.code,peer2=await f.connect();
  const joined=await call(peer2,'room:join',{code:code2,nickname:'1',pin:'1234'});assert.ok(joined.ok,joined.error);
  const original2=f.game.store.rooms.get(code2),player2=original2.players.get(joined.selfId);qualify(f,player2);
  f.game.store.transact(()=>summonSerena(original2,player2,f.now));
  damageMonster(f.room,f.room.monsters.get(SERENA.monsterId),f.pa,10000,f.now);
  damageMonster(original2,original2.monsters.get(SERENA.monsterId),player2,10000,f.now);
  const save=f.game.store.files.save.bind(f.game.store.files);let failed=false;
  f.game.store.files.save=record=>{if(record.code===f.code&&!failed){failed=true;throw Error('first room rollback');}return save(record);};
  try{
    await until(()=>failed&&f.game.store.rooms.get(code2).serena.state==='recovering');
    assert.notEqual(f.game.store.rooms.get(code2),original2);
    assert.equal(original2.serena.state,'active','이전 Map에 있던 두 번째 교실은 더 이상 정산하지 않는다');
    assert.equal(original2.pendingBossDeaths.size,1);
    const current=f.game.store.rooms.get(code2);
    assert.equal(current.pendingBossDeaths.size,0);
    assert.equal([...current.energyDrops.values()].filter(d=>d.itemId==='radiant-star-origin').length,1);
    assert.equal(f.game.store.records.get(code2).serena.state,'recovering');
  }finally{f.game.store.files.save=save;}
});
