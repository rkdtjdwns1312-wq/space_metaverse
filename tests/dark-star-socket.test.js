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
import {summonDarkStar} from '../server/dark-star.js';
import {beginDarkStarSkill} from '../server/dark-star-skills.js';

import {nextBossRespawnAt} from '../server/boss-lifecycle.js';
import {DARK_STAR} from '../shared/dark-star.js';
import {mapOf} from '../shared/config.js';
const key='darkStar-test-only-key',call=(s,event,data={})=>s.timeout(3000).emitWithAck(event,data);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){for(let i=0;i<100;i++){if(check())return;await pause(20);}assert.ok(check(),'서버 상태 전파 제한 시간');}
const statue=mapOf(DARK_STAR.mapId).objects.find(o=>o.id===DARK_STAR.statueId);
async function fixture(t){
  const dir=mkdtempSync(join(tmpdir(),'darkStar-socket-')),sockets=[];let now=Date.now();
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
function qualify(f,p){f.game.store.transact(()=>chargeHuntingStation(p,'math',f.now));Object.assign(p,{mapId:DARK_STAR.mapId,x:statue.x,y:statue.y+90});}
test('server ignores forged summon position, serializes concurrent confirmations, and broadcasts persisted state',async t=>{
 const f=await fixture(t);assert.equal((await call(f.a,'dark-star:summon',{mapId:DARK_STAR.mapId,x:statue.x,y:statue.y})).ok,false);
 qualify(f,f.pa);qualify(f,f.pb);let snapshot,tick;f.a.on('room:state',r=>snapshot=r);f.a.on('world:positions',r=>tick=r);
 const results=await Promise.all([call(f.a,'dark-star:summon'),call(f.b,'dark-star:summon')]);assert.equal(results.filter(r=>r.ok).length,1);
 assert.equal(results.find(r=>r.ok).darkStar.state,'active');await until(()=>snapshot?.darkStar.state==='active'&&tick?.darkStar.state==='active');
 assert.equal(tick.monsters.filter(m=>m.typeId==='dark-star').length,1);assert.equal(f.disk().darkStar.state,'active');
});
test('failed summon storage publishes neither success nor active state and permits retry',async t=>{
 const f=await fixture(t);qualify(f,f.pa);const states=[];f.a.on('room:state',r=>states.push(r.darkStar.state));
 const save=f.game.store.files.save.bind(f.game.store.files);f.game.store.files.save=()=>{throw Error('simulated save failure');};
 let result;try{result=await call(f.a,'dark-star:summon');}finally{f.game.store.files.save=save;}
 assert.equal(result.ok,false);await pause(100);assert(!states.includes('active'));assert.equal(f.disk().darkStar.state,'dormant');assert(!f.room.monsters.has(DARK_STAR.monsterId));
 assert.equal((await call(f.a,'dark-star:summon')).ok,true);
});
test('death settlement and next morning restore are propagated through the actual server tick',async t=>{
 const f=await fixture(t);qualify(f,f.pa);assert((await call(f.a,'dark-star:summon')).ok);let tick;f.a.on('world:positions',r=>tick=r);
 damageMonster(f.room,f.room.monsters.get(DARK_STAR.monsterId),f.pa,10000,f.now);
 await until(()=>f.disk().darkStar.state==='recovering'&&tick?.darkStar.state==='recovering');
 const untilTime=nextBossRespawnAt(f.now);f.now=untilTime;await until(()=>f.disk().darkStar.state==='dormant'&&tick?.darkStar.state==='dormant');
 assert(!f.room.monsters.has(DARK_STAR.monsterId));
});

test('card reveal validates socket position and broadcasts only temporarily revealed colors, never answer or HP',async t=>{
 const f=await fixture(t);qualify(f,f.pa);assert((await call(f.a,'dark-star:summon')).ok);
 const boss=f.room.monsters.get(DARK_STAR.monsterId);assert(beginDarkStarSkill(f.room,boss,'puzzle',f.now,()=>.5));
 const card=boss.darkStarSkills.cards[0];f.pa.x=boss.x;f.pa.y=boss.y;
 assert.equal((await call(f.a,'dark-star:reveal',{cardId:card.id,x:card.x,y:card.y})).ok,false);
 let tick;f.a.on('world:positions',r=>tick=r);
 await until(()=>tick?.monsters.find(m=>m.id===boss.id)?.darkStarEffects?.cards.length===5);
 const assertPrivate=()=>{
   for(const c of tick.monsters.find(m=>m.id===boss.id).darkStarEffects.cards)
     for(const key of ['correct','hp','maxHp'])assert(!Object.hasOwn(c,key));
   for(const c of tick.monsters.filter(m=>m.typeId==='dark-star-card'))
     for(const key of ['correct','color','hp','maxHp'])assert(!Object.hasOwn(c,key));
 };
 assertPrivate();assert(!Object.hasOwn(tick.monsters.find(m=>m.id===boss.id).darkStarEffects.cards[0],'color'));
 f.pa.x=card.x;f.pa.y=card.y;
 const result=await call(f.a,'dark-star:reveal',{cardId:card.id});assert(result.ok,result.error);assert(!Object.hasOwn(result,'color'));assert(!Object.hasOwn(result,'correct'));
 await until(()=>tick?.monsters.find(m=>m.id===boss.id)?.darkStarEffects?.cards[0]?.color===card.color);assertPrivate();
 f.now+=3000;await until(()=>!Object.hasOwn(tick.monsters.find(m=>m.id===boss.id).darkStarEffects.cards[0],'color'));assertPrivate();
});
