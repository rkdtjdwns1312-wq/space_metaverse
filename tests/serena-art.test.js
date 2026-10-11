import test from 'node:test';
import assert from 'node:assert/strict';
import {serenaPose,serenaBounds,drawSerena} from '../client/serena-art.js';
test('세레나는 경고 중 기도하고 폭발 후 팔을 펼치며 이동 속도에 무관하게 걷는다',()=>{
 const boss={radius:150,x:0,y:0,warning:{startsAt:1000,endsAt:3000}};
 assert.equal(serenaPose(boss,0,null,1000),4);
 assert.equal(serenaPose(boss,0,null,2350),9);
 assert.equal(serenaPose(boss,0,null,2999),9);
 delete boss.warning;
 assert.equal(serenaPose(boss,3000,{startedAt:3000},3000),9);
 assert.equal(serenaPose(boss,3400,{startedAt:3000},3400),10);
 assert.equal(serenaPose(boss,3800,{startedAt:3000},3800),0);
 boss.moving=true;assert.equal(serenaPose(boss,1200,null),0);assert.equal(serenaPose(boss,1500,null),1);
 const bounds=serenaBounds(boss);assert.equal(bounds.width,202.5);assert.equal(bounds.height,405);
});

test('세레나는 이동·기도·복귀 모두 반투명 중첩 없이 한 자세만 그린다',()=>{
 const OriginalImage=globalThis.Image;
 globalThis.Image=class{complete=true;naturalWidth=1024;decode(){return Promise.resolve();}};
 try{
  const boss={shape:'serena',x:400,y:500,radius:150,moving:true};
  for(const time of [0,150,300,450,750,1050,1199]){
   const calls=[];drawSerena({drawImage:(...args)=>calls.push(args)},boss,time);
   assert.equal(calls.length,1);assert.equal(calls[0][2],0,'이동은 첫 행만 사용');
   assert.equal(calls[0][3],256);assert.equal(calls[0][4],512);
  }
  boss.warning={startsAt:Date.now()-650,endsAt:Date.now()+1350};
  const prayer=[];drawSerena({drawImage:(...args)=>prayer.push(args)},boss,500);
  assert.equal(prayer.length,1);assert.ok(prayer[0][2]>=512);
  delete boss.warning;const returning=[];
  drawSerena({drawImage:(...args)=>returning.push(args)},boss,450,{startedAt:0});
  assert.equal(returning.length,1);assert.equal(returning[0][2],1024);
 }finally{globalThis.Image=OriginalImage;}
});
