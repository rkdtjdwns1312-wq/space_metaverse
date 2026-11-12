import test from 'node:test';
import assert from 'node:assert/strict';
import {CELESTIAL_MONSTER_ART,grownCoolMouth,drawCelestialMonster} from '../client/celestial-monster-art.js';
import {lv2MonsterPose} from '../client/lv2-monster-art.js';

test('cool breath follows each drawn mouth below the eyes, mirrored around the body',()=>{
 const art=CELESTIAL_MONSTER_ART['grown-cool-star'],m={x:200,y:200},r=72;
 for(const frame of [0,1,2,3]){
  const right=grownCoolMouth(m,r,1,frame),left=grownCoolMouth(m,r,-1,frame);
  assert.equal(right.y,left.y);assert.equal(right.x+left.x,2*m.x);
  const eyeY=365; // Both eye centers in the new 1280-coordinate sheet sit above y365.
  const [,,,,,footY]=art.attackFrames[frame];
  assert(right.y>m.y+r+(eyeY-footY)*r*3/640);
 }
 assert(grownCoolMouth(m,r,1,2).y>grownCoolMouth(m,r,1,1).y);
});

test('only active cool attacks use the new sheet; idle and attack duration remain unchanged',()=>{
 const previous=globalThis.Image,drawn=[];
 globalThis.Image=class{complete=true;naturalWidth=1254;naturalHeight=1254;};
 const ctx=new Proxy({globalAlpha:1,drawImage:(im)=>drawn.push(im.src),createRadialGradient:()=>({addColorStop(){}})}, {get:(target,key)=>key in target?target[key]:()=>{}});
 try{
  const m={shape:'grown-cool-star',x:200,y:200,radius:80};
  drawCelestialMonster(ctx,m,0,null);
  drawCelestialMonster(ctx,m,300,{startedAt:0,durationMs:600,dx:1,dy:0});
  drawCelestialMonster(ctx,m,600,{startedAt:0,durationMs:600,dx:1,dy:0});
  assert.deepEqual(drawn,['/assets/monsters/grown-cool-star-poses.png','/assets/monsters/grown-cool-star-attack.webp','/assets/monsters/grown-cool-star-poses.png']);
  assert.equal(lv2MonsterPose(599,{startedAt:0,durationMs:600}).active,true);
  assert.equal(lv2MonsterPose(600,{startedAt:0,durationMs:600}).active,false);
 }finally{globalThis.Image=previous;}
});
