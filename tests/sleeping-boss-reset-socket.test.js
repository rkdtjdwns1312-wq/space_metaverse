import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {mapOf} from '../shared/config.js';
import {DARK_STAR} from '../shared/dark-star.js';
import {STAR_RECORD} from '../shared/star-record.js';
import {FORGOTTEN_CONSTELLATION} from '../shared/forgotten-constellation.js';
import {TRUTH_CREATOR} from '../shared/truth-creator.js';
const bosses=[['darkStar',DARK_STAR,'dark-star:summon'],['starRecord',STAR_RECORD,'star-record:summon'],
  ['forgottenConstellation',FORGOTTEN_CONSTELLATION,'forgotten-constellation:summon'],['truthCreator',TRUTH_CREATOR,'truth-creator:summon']];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('실제 서버는 KST07시 네 석상을 저장한 뒤 전투하고 저장실패를 재시도하며 재시작에도 하루 일정을 보존한다',async t=>{
  const f=await readingFixture(t),before=Date.parse('2026-11-12T06:59:59+09:00'),opening=before+1000;
  f.advance(before-f.now);
  async function summonAll(){for(const [key,spec,event] of bosses){
    const statue=mapOf(spec.mapId).objects.find(o=>o.id===spec.statueId);
    f.mutate(()=>Object.assign(f.teacherPlayer,{mapId:spec.mapId,x:statue.x,y:statue.y+90}));
    ok(await call(f.teacher,event));assert.equal(f.room[key].state,'active');
  }}
  await summonAll();
  const secondTeacher=await f.connect(),secondCode=ok(await call(secondTeacher,'room:create',{
    teacherKey:'reading-rewards-test',title:'다른 교실',allowedNames:['3']})).room.code;
  const secondBefore=f.game.store.rooms.get(secondCode),secondPlayer=[...secondBefore.players.values()].find(p=>p.role==='teacher');
  const statue=mapOf(DARK_STAR.mapId).objects.find(o=>o.id===DARK_STAR.statueId);
  f.game.store.transact(()=>Object.assign(secondPlayer,{mapId:DARK_STAR.mapId,x:statue.x,y:statue.y+90}));
  ok(await call(secondTeacher,'dark-star:summon'));
  await wait(100);for(const [key] of bosses)assert.equal(f.room[key].resetAt,opening);
  await f.fail(async()=>{
    f.advance(1000);
    for(let i=0;i<100&&!f.room.bossSaveRetryAt;i++)await wait(20);
    assert(f.room.bossSaveRetryAt>f.now);
    for(const [key,spec] of bosses){assert.equal(f.room[key].state,'active');assert(f.room.monsters.has(spec.monsterId));}
    assert.notEqual(f.game.store.rooms.get(secondCode),secondBefore,'전체 원복은 다른 교실 참조도 교체한다');
    assert.equal(secondBefore.darkStar.state,'active','실패한 틱은 다음 교실의 옛 참조를 수정하지 않는다');
    assert.equal(f.game.store.rooms.get(secondCode).darkStar.state,'active');
  });
  f.advance(1001);
  for(let i=0;i<100&&(f.room.darkStar.state!=='dormant'||f.game.store.rooms.get(secondCode).darkStar.state!=='dormant');i++)await wait(20);
  for(const [key,spec] of bosses){assert.equal(f.room[key].state,'dormant');assert(!f.room.monsters.has(spec.monsterId));}
  assert.equal(f.game.store.rooms.get(secondCode).darkStar.state,'dormant');
  assert.equal(f.game.store.records.get(secondCode).darkStar.state,'dormant');
  await summonAll();await f.restart();
  for(const [key] of bosses){assert.equal(f.room[key].state,'active');assert.equal(f.room[key].resetAt,opening+86400000);}
  await wait(100);for(const [key] of bosses)assert.equal(f.room[key].state,'active');
});
