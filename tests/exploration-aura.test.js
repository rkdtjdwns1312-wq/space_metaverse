import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPLORATION_AURA_FRAMES,explorationAuraFrame,explorationAuraStars} from '../client/exploration-aura.js';
test('탐사 장치 별빛은 24프레임 동안 장치 중심에서 3배 반경으로 퍼진다',()=>{
  assert.equal(EXPLORATION_AURA_FRAMES,24);
  assert.deepEqual([explorationAuraFrame(0),explorationAuraFrame(125),explorationAuraFrame(2875),explorationAuraFrame(3000)],[0,1,23,0]);
  const radius=168;
  for(let frame=0;frame<24;frame++){
    const stars=explorationAuraStars(frame,radius);assert.equal(stars.length,12);
    assert.ok(stars.every(star=>Number.isFinite(star.x)&&Number.isFinite(star.y)&&star.alpha>=0&&star.alpha<=.8));
    assert.ok(stars.every(star=>Math.hypot(star.x,star.y)<=radius+.01));
  }
  const first=explorationAuraStars(0,radius)[0],last=explorationAuraStars(23,radius)[0];
  assert.ok(Math.hypot(first.x,first.y)<Math.hypot(last.x,last.y));
});
