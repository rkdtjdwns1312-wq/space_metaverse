import test from 'node:test';
import assert from 'node:assert/strict';
import {MONSTER_TYPES} from '../shared/monsters.js';
import {drawBabyStar} from '../client/baby-star-art.js';
import {drawWaterMonster} from '../client/water-monster-art.js';
import {drawLv2Monster} from '../client/lv2-monster-art.js';
import {drawSunMonster} from '../client/sun-monster-art.js';
import {drawCelestialMonster} from '../client/celestial-monster-art.js';
import {drawBossMonster} from '../client/boss-monster-art.js';
import {drawGuardianMonster} from '../client/guardian-monster-art.js';
import {prepareMonsterArt} from '../client/monster-art-ready.js';

test('map preload only loads the requested species and reuses its promise',async()=>{
  const sources=[];
  globalThis.Image=class{set src(src){sources.push(src);}decode(){return Promise.resolve();}};
  try{
    await prepareMonsterArt();assert.deepEqual(sources,[]);
    const a=prepareMonsterArt('star-phoenix'),b=prepareMonsterArt('star-phoenix');
    assert.equal(a,b);await a;
    assert.deepEqual(sources.sort(),['/assets/monsters/star-phoenix-poses.png','/assets/monsters/star-phoenix-walk.png']);
  }finally{delete globalThis.Image;}
});

test('cold images keep all 16 painted species out of legacy fallback, including first attack',async()=>{
  const images=[];
  globalThis.Image=class{complete=false;naturalWidth=0;constructor(){images.push(this);}decode(){return Promise.resolve();}};
  try{
    const texts=[],ctx={save(){},restore(){},strokeText(){},fillText(text){texts.push(text);}};
    const drawers=[drawBossMonster,drawGuardianMonster,drawBabyStar,drawCelestialMonster,drawSunMonster,drawLv2Monster,drawWaterMonster];
    for(const type of MONSTER_TYPES)for(const attack of [null,{startedAt:0,durationMs:600,dx:1,dy:0}]){
      const before=texts.length;
      assert(drawers.some(draw=>draw(ctx,{...type,x:100,y:100,radius:40},100,attack)),type.id);
      assert.equal(texts.length,before+1,type.id);assert.equal(texts.at(-1),'그림 불러오는 중');
    }
    for(const image of images)image.complete=true;
    assert(drawSunMonster(ctx,{shape:'warm-star',x:100,y:100,radius:40},0));
    assert.equal(texts.at(-1),'그림 로딩 실패');
    assert.equal(drawers.some(draw=>draw(ctx,{shape:'unknown'},0)),false);
  }finally{delete globalThis.Image;}
});
