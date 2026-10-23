import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ORIGIN_WALK_ART,originWalkFrame,drawOriginWalkFrame} from '../client/origin-monster-walk.js';

test('별의 기원 6종이 각각 4칸 투명 걷기 시트를 가진다',()=>{
  assert.deepEqual(Object.keys(ORIGIN_WALK_ART).sort(),[
    'chameleon-star','star-crab','star-dragon','star-phoenix','star-scorpion','water-star'
  ]);
  for(const [shape,src] of Object.entries(ORIGIN_WALK_ART)){
    assert.equal(src,`/assets/monsters/${shape}-walk.png`);
    const png=readFileSync('client'+src);
    assert.equal(png.subarray(1,4).toString(),'PNG');
    assert.equal(png.readUInt32BE(16),png.readUInt32BE(20));
    assert.equal(png.readUInt32BE(16)%2,0);
    assert.equal(png[25],6,'프레임 밖은 실제 RGBA 투명 배경');
  }
});

test('걷기 4프레임은 일정한 리듬으로 반복하고 원화가 아직 없으면 안전하게 대기한다',()=>{
  assert.deepEqual([0,159,160,319,320,479,480,639,640].map(originWalkFrame),[0,0,1,1,2,2,3,3,0]);
  assert.equal(originWalkFrame(-1),0);assert.equal(originWalkFrame(Infinity),0);
  assert.equal(drawOriginWalkFrame({},'star-crab',0,0,0,100),false);
});
