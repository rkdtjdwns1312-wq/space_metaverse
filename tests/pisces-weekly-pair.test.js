import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {weeklyAbilityFor} from '../shared/constellation-weekly-abilities.js';
import {constellationAbilityStatus} from '../server/constellation-weekly-abilities.js';
import {partyOf,settlePiscesPairs} from '../server/party.js';
import {addPlanet} from '../server/world.js';
import {departmentSlots} from '../shared/plaza-layout.js';
import {issueWarning,warningCount} from '../server/warnings.js';

const DAY=86400000;
const setPisces=(f,level)=>f.mutate(p=>{p.avatar.constellationId='pisces';p.avatar.level=level;p.avatar.form='constellation';});

test('물고기자리 Lv2~5 신청은 수락 때만 주간 사용되며 짝 파티·기간이 저장된다',async t=>{
  for(const level of [2,3,4,5]){
    await t.test(`Lv${level}`,async t=>{
      const f=await readingFixture(t);await setPisces(f,level);
      const days=weeklyAbilityFor('pisces',level).days;
      const first=ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id}));
      assert.equal(first.used,false);assert.equal(first.invitation.days,days);
      assert.equal((await call(f.student,'constellation-ability:use',{targetId:f.q.id})).ok,false);
      assert.equal((await call(f.student,'constellation-ability:pair-respond',{requestId:first.invitation.id,accept:true})).ok,false,'신청자는 직접 수락할 수 없다');
      const accepted=ok(await call(f.other,'constellation-ability:pair-respond',{requestId:first.invitation.id,accept:true}));
      assert.equal(accepted.endsAt,f.now+days*DAY);assert.equal(constellationAbilityStatus(f.p,f.now).used,true);
      assert.deepEqual(partyOf(f.room,f.p.id).memberIds,[f.p.id,f.q.id]);
      assert(f.game.store.snapshot(f.room,f.p,f.now).players.find(p=>p.id===f.p.id).effects.some(effect=>effect.statusId==='pair'));
      assert.equal((await call(f.student,'party:leave')).ok,false);assert.equal((await call(f.other,'party:leave')).ok,false);
      assert.equal((await call(f.student,'party:invite',{targetId:f.q.id})).ok,false);
      await f.restart();assert.equal(f.p.piscesPair?.partnerId,f.q.id);assert.equal(partyOf(f.room,f.q.id)?.piscesPair,true);
      f.advance(days*DAY+1);await f.mutate((_,room)=>settlePiscesPairs(room,f.now));
      assert.equal(f.p.piscesPair,null);assert.equal(f.q.piscesPair,null);assert.equal(partyOf(f.room,f.p.id),null);
    });
  }
});

test('거절과 저장 실패는 능력 사용을 소모하지 않으며 대상 외 수락을 막는다',async t=>{
  const f=await readingFixture(t);await setPisces(f,3);
  assert.equal((await call(f.student,'constellation-ability:use',{targetId:f.p.id})).ok,false);
  assert.equal((await call(f.other,'constellation-ability:use',{targetId:f.p.id})).ok,false);
  const first=ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id}));
  ok(await call(f.other,'constellation-ability:pair-respond',{requestId:first.invitation.id,accept:false}));
  assert.equal(constellationAbilityStatus(f.p,f.now).used,false);
  assert.equal((await call(f.student,'constellation-ability:use',{targetId:f.q.id})).ok,false);
  f.advance(5*60000+1);
  const second=ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id}));
  await f.fail(async()=>assert.equal((await call(f.other,'constellation-ability:pair-respond',{requestId:second.invitation.id,accept:true})).ok,false));
  assert.equal(constellationAbilityStatus(f.p,f.now).used,false);assert.equal(f.p.piscesPair,null);
  ok(await call(f.other,'constellation-ability:pair-respond',{requestId:second.invitation.id,accept:true}));
  assert.equal(constellationAbilityStatus(f.p,f.now).used,true);
});

test('Lv3·4만 짝 친구의 새 경고를 일방 공유하고 원본 삭제 시 공유 경고도 해제한다',async t=>{
  for(const level of [2,3,4,5]){
    await t.test(`Lv${level}`,async t=>{
      const f=await readingFixture(t);await setPisces(f,level);
      const invite=ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id})).invitation;
      ok(await call(f.other,'constellation-ability:pair-respond',{requestId:invite.id,accept:true}));
      let planetId;
      await f.mutate((_,room)=>{const planet=addPlanet(room,{name:'경고 시험',description:'',...departmentSlots()[0],color:'#c5c9f7',rules:['공평하게'],templateId:'rules'});planetId=planet.id;});
      const first=f.mutate((_,room)=>issueWarning(room,room.planets.get(planetId),f.teacherPlayer,f.q,'시험 경고',f.now));
      assert.equal(warningCount(f.room.planets.get(planetId),f.q.id),1);
      assert.equal(warningCount(f.room.planets.get(planetId),f.p.id),level===3||level===4?1:0);
      await f.restart();
      assert.equal(warningCount(f.room.planets.get(planetId),f.p.id),level===3||level===4?1:0);
      ok(await call(f.teacher,'warning:teacher:delete',{warningId:first.entry.id}));
      assert.equal(warningCount(f.room.planets.get(planetId),f.p.id),0);
      f.mutate((_,room)=>issueWarning(room,room.planets.get(planetId),f.teacherPlayer,f.p,'신청자 경고',f.now));
      assert.equal(warningCount(f.room.planets.get(planetId),f.q.id),0,'신청자가 받은 경고는 상대에게 복사하지 않는다');
    });
  }
});
