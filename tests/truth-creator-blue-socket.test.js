import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {monstersOf} from '../server/monsters.js';
import {TRUTH_CREATOR} from '../shared/truth-creator.js';
import {tryTruthCreatorBlue,truthCreatorBlueProtected} from '../server/truth-creator-blue.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {ensureVitals} from '../server/vitals.js';
const initial=Date.parse('2026-11-02T12:00:00+09:00');
async function fixture(t){
  let now=initial;const teacherKey='isolated-truth-blue',game=createClassroomServer({teacherKey,studentHours:false,clock:()=>now}),sockets=[];
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});const {port}=await game.listen();
  async function connect(){const s=io('http://127.0.0.1:'+port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;}
  const call=(socket,event,data={})=>socket.timeout(4000).emitWithAck(event,data),teacher=await connect();
  const made=await call(teacher,'room:create',{teacherKey,title:'파란구체검사',allowedNames:['1','2']});assert(made.ok,made.error);
  const students=[];
  for(const nickname of ['1','2']){const s=await connect(),joined=await call(s,'room:join',{code:made.room.code,nickname,pin:'1234'});assert(joined.ok,joined.error);students.push(s);}
  const room=game.store.rooms.get(made.room.code),players=[...room.players.values()].filter(p=>p.role==='student');
  room.truthCreator={state:'active',monsterId:TRUTH_CREATOR.monsterId,respawnAt:null};const boss=monstersOf(room,now).get(TRUTH_CREATOR.monsterId);
  for(const p of players){p.avatar={...p.avatar,level:4};chargeHuntingStation(p,'math',now);Object.assign(p,{mapId:boss.mapId,x:boss.x+300,y:boss.y});p.statGrowth={bonuses:{hp:1000,mp:0,attack:0,defense:0},lastPurchaseDay:null};ensureVitals(p);}
  assert(tryTruthCreatorBlue(room,boss,players[0],now,()=>.25));const orbs=[...boss.truthCreatorBlue.orbs];
  return {game,room,boss,players,students,orbs,call,connect,setNow:value=>{now=value;},get now(){return now;}};
}
const input=(opened,action=opened.orb.sequence[opened.orb.progress])=>({orbId:opened.orb.id,action,revision:opened.orb.revision,interactionToken:opened.interactionToken});
test('each student starts protection only on the first authorized open of a given orb',async t=>{
  const f=await fixture(t),[p,q]=f.players,[s]=f.students,[first,second]=f.orbs;
  const open=orb=>f.call(s,'truth-creator:blue-open',{orbId:orb.id});
  const protectedAt=(player,at)=>truthCreatorBlueProtected(f.boss,player,at);
  f.setNow(first.landsAt);
  Object.assign(p,{x:first.x+600,y:first.y});assert.equal((await open(first)).ok,false);
  assert.equal(protectedAt(p,f.now),false);
  Object.assign(p,{x:first.x,y:first.y});assert((await open(first)).ok);
  assert(protectedAt(p,f.now));assert.equal(protectedAt(q,f.now),false);
  f.setNow(first.landsAt+5900);assert((await open(first)).ok);
  assert(protectedAt(p,first.landsAt+5999));assert.equal(protectedAt(p,first.landsAt+6000),false);
  f.setNow(first.landsAt+6100);assert((await open(first)).ok);assert.equal(protectedAt(p,f.now),false);
  Object.assign(p,{x:second.x,y:second.y});assert((await open(second)).ok);
  assert(protectedAt(p,f.now+5999));assert.equal(protectedAt(p,f.now+6000),false);
});
test('real sockets authorize each read/key, preserve reopened progress, ignore replay/concurrent revisions, and defuse all three individually',async t=>{
  const f=await fixture(t),[p,q]=f.players,[s,other]=f.students,[orb]=f.orbs,anonymous=await f.connect();
  assert.equal((await f.call(anonymous,'truth-creator:blue-open',{orbId:orb.id})).ok,false);
  Object.assign(p,{x:orb.x,y:orb.y});assert.equal((await f.call(s,'truth-creator:blue-open',{orbId:orb.id})).ok,false,'still flying');
  f.setNow(orb.landsAt);Object.assign(p,{x:orb.x,y:orb.y});Object.assign(q,{x:orb.x,y:orb.y});
  let opened=await f.call(s,'truth-creator:blue-open',{orbId:orb.id});assert(opened.ok,opened.error);assert.equal(opened.serverNow,orb.landsAt);
  const request=input(opened),[first,retry]=await Promise.all([f.call(s,'truth-creator:blue-input',request),f.call(s,'truth-creator:blue-input',request)]);
  assert(first.ok&&retry.ok);assert.equal([first,retry].filter(reply=>reply.stale).length,1);assert.equal(orb.progress,1);
  assert.equal((await f.call(other,'truth-creator:blue-input',{...request,revision:orb.revision})).ok,false,'another socket cannot borrow the token');
  const reopened=await f.call(s,'truth-creator:blue-open',{orbId:orb.id});assert.equal(reopened.orb.progress,1);assert.notEqual(reopened.interactionToken,opened.interactionToken);
  assert.equal((await f.call(s,'truth-creator:blue-input',{...request,revision:1})).ok,false,'superseded token');
  opened=reopened;const wrong=opened.orb.sequence[1]==='attack'?'skill':'attack';
  const reset=await f.call(s,'truth-creator:blue-input',input(opened,wrong));assert.equal(reset.orb.progress,0);assert.equal(orb.endsAt,f.orbs[1].endsAt);
  p.x+=500;assert.equal((await f.call(s,'truth-creator:blue-input',{...input(opened),revision:2})).ok,false);p.x=orb.x;
  for(const current of f.orbs){Object.assign(p,{x:current.x,y:current.y});opened=await f.call(s,'truth-creator:blue-open',{orbId:current.id});assert(opened.ok,opened.error);
    for(let i=0;i<8;i++){const result=await f.call(s,'truth-creator:blue-input',input(opened));assert(result.ok,result.error);assert.equal(result.disarmed,i===7);opened={...result,interactionToken:opened.interactionToken};}}
  assert.equal(f.boss.truthCreatorBlue.orbs.length,0);assert.equal((await f.call(s,'truth-creator:blue-open',{orbId:orb.id})).ok,false);
});
test('late socket input cannot defer a deadline or forge completion, and the server executes the map-wide blast',async t=>{
  const f=await fixture(t),p=f.players[0],s=f.students[0],orb=f.orbs[0];f.setNow(orb.endsAt-1000);Object.assign(p,{x:orb.x,y:orb.y});
  const opened=await f.call(s,'truth-creator:blue-open',{orbId:orb.id});assert(opened.ok,opened.error);
  assert(truthCreatorBlueProtected(f.boss,p,orb.endsAt));
  f.setNow(orb.endsAt);
  const late=await f.call(s,'truth-creator:blue-input',{...input(opened),progress:8,disarmed:true,endsAt:orb.endsAt+100000});assert.equal(late.ok,false);
  const until=Date.now()+2000;while(p.battleVitals.hp>0&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(p.battleVitals.hp,0);assert.equal(f.players[1].battleVitals.hp,0);
  assert.equal((await f.call(s,'truth-creator:blue-open',{orbId:orb.id})).ok,false);
});
