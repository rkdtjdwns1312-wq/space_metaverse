import test from 'node:test';
import assert from 'node:assert/strict';
import {propShadowProfile,drawPropShadow,clipPropShadowFloor,spriteShadowProfile} from '../client/prop-shadows.js';

test('shadow footprints follow the scaled visible feet, not collision radius',()=>{
  const o={kind:'crafting',x:120,y:250,radius:68};
  const large=propShadowProfile(o,{width:245,foot:70});
  const small=propShadowProfile(o,{width:147,foot:42});
  assert.ok(Math.abs(small.rx-large.rx*.6)<1e-9);
  assert.equal(small.y,287);
  assert.deepEqual(small,propShadowProfile({...o,radius:1000},{width:147,foot:42}));
  assert.ok(propShadowProfile({...o,kind:'planet'}).alpha<small.alpha);
});
test('existing ground art, gates and unknown objects never receive duplicate shadows',()=>{
  for(const kind of ['gate','pillar','shelter-fountain','cozy-garden','forgotten-constellation-statue','black-hole','market','life-star','unknown']){
    assert.equal(propShadowProfile({kind,x:0,y:0,radius:80}),null,kind);
  }
});
test('soft stamp and floor path are reused; invalid geometry does not draw',()=>{
  let canvases=0,gradients=0,draws=0,paths=0;
  const oldDocument=globalThis.document,oldPath=globalThis.Path2D;
  globalThis.document={createElement(){canvases++;return {getContext:()=>({beginPath(){},moveTo(){},bezierCurveTo(){},quadraticCurveTo(){},lineTo(){},fill(){},createLinearGradient(){gradients++;return {addColorStop(){}};}})};}};
  globalThis.Path2D=class{constructor(){paths++;}moveTo(){}lineTo(){}closePath(){}};
  let savedAlpha;
  const ctx={globalAlpha:.5,save(){savedAlpha=this.globalAlpha;},restore(){this.globalAlpha=savedAlpha;},drawImage(){draws++;assert.equal(this.globalAlpha,.12);},clip(path){this.path=path;}};
  try{
    const profile=propShadowProfile({kind:'mailbox',x:100,y:200});
    drawPropShadow(ctx,profile);drawPropShadow(ctx,profile);
    assert.deepEqual([canvases,gradients,draws],[1,1,2]);assert.equal(ctx.globalAlpha,.5);
    assert.equal(drawPropShadow(ctx,{...profile,rx:NaN}),false);assert.equal(draws,2);
    const floor=[[{x:0,y:0},{x:10,y:0},{x:0,y:10}]];
    clipPropShadowFloor(ctx,floor);const first=ctx.path;clipPropShadowFloor(ctx,floor);
    assert.equal(ctx.path,first);assert.equal(paths,1);
  }finally{globalThis.document=oldDocument;globalThis.Path2D=oldPath;}
});

test('sprite casts reuse their alpha cache, follow visible feet and preserve mirrored art',()=>{
  let reads=0,canvases=0;const oldDocument=globalThis.document;
  globalThis.document={createElement(){canvases++;return {getContext:()=>({drawImage(){},getImageData(){reads++;return {data:new Uint8ClampedArray([0,0,0,255,0,0,0,255,0,0,0,0,0,0,0,0])};},putImageData(){}})};}};
  const transforms=[],translations=[];
  const ctx={globalAlpha:1,save(){},restore(){this.globalAlpha=1;},translate(...args){translations.push(args);},transform(...args){transforms.push(args);},drawImage(){}};
  const image={complete:true,naturalWidth:2,naturalHeight:2};
  try{
    const p=spriteShadowProfile(image,{x:10,y:20,width:100,height:200},true);
    drawPropShadow(ctx,p);drawPropShadow(ctx,p);
    assert.equal(reads,1);assert.equal(canvases,1);
    assert.deepEqual(translations[0],[60,120]); // visible bottom, not transparent padding
    assert.equal(transforms[0][0],-1);
    assert.ok(transforms[0][2]<0);assert.ok(transforms[0][3]>0&&transforms[0][3]<1);
  }finally{globalThis.document=oldDocument;}
});
