import test from 'node:test';
import assert from 'node:assert/strict';
import {walkCameraAxis} from '../client/walk-camera.js';

test('short walks and reversals leave the map still, a longer walk follows without drifting',()=>{
  const view=focus=>walkCameraAxis(focus,1000,3000,500,1);
  assert.equal(view(1000),500);
  assert.equal(view(1100),500);
  assert.equal(view(900),500);
  const moved=view(1200);
  assert.equal(moved,580);
  assert.equal(walkCameraAxis(1200,1000,3000,moved,1),moved);
});
test('camera centers a new location, stays within the map and aligns scrolling to output pixels',()=>{
  assert.equal(walkCameraAxis(2300,1000,3000,100,2),1800);
  assert.equal(walkCameraAxis(0,1000,3000,100,2),0);
  assert.equal(walkCameraAxis(3000,1000,3000,1500,2),2000);
  assert.equal(walkCameraAxis(10,1000,600,null,2),-200);
  assert.equal(walkCameraAxis(1000.4,1000,3000,null,1.5)*1.5,751);
});
