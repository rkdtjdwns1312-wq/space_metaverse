import test from 'node:test';
import assert from 'node:assert/strict';
import {STREET} from '../shared/config.js';
import {GARDEN_RULES} from '../shared/garden-minigame.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
test('quality collection persists on successful harvest only, restores after failed save and survives restart',async t=>{
 const f=await readingFixture(t),at=()=>{const o=STREET.objects.find(o=>o.kind==='cozy-garden');Object.assign(f.p,{mapId:STREET.id,x:o.x,y:o.y+100,input:{x:0,y:0,at:0}});};at();
 const act=(action,data={})=>{const game=f.p.cozyActivities?.garden.pots[0]?.game;return call(f.student,'cozy:act',{kind:'garden',action,pot:0,generation:game?.generation,revision:game?.revision,...data});};
 ok(await act('plant',{seed:'moonbell'}));
 for(const point of GARDEN_RULES.seedTargets){f.advance(200);ok(await act('seed-place',point));}
 for(let i=0;i<8;i++){f.advance(200);ok(await act('sunlight',{arrow:f.p.cozyActivities.garden.pots[0].game.arrows[i]}));}
 f.advance(200);ok(await act('water-start'));f.advance(3500);ok(await act('water-release'));
 const before=structuredClone(f.p.cozyActivities),energy=f.p.cosmicEnergy;
 await f.fail(async()=>assert.equal((await act('harvest')).ok,false));assert.deepEqual(f.p.cozyActivities,before);assert.equal(f.p.cosmicEnergy,energy);
 const done=ok(await act('harvest',{grade:'아주 나쁨'}));assert.equal(done.state.qualityCollection.moonbell['아주 좋음'],1);assert.equal(done.state.collection.moonbell,1);
 assert.equal((await act('harvest')).ok,false);await f.restart();at();const view=ok(await call(f.student,'cozy:read',{kind:'garden'}));assert.equal(view.state.qualityCollection.moonbell['아주 좋음'],1);
});
