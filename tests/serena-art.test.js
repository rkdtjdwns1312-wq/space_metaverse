import test from 'node:test';
import assert from 'node:assert/strict';
import {serenaPose,serenaBounds} from '../client/serena-art.js';
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
