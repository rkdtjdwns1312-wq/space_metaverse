import test from 'node:test';
import assert from 'node:assert/strict';
import {GameError} from '../server/pin-auth.js';
import {answerStarRecordMath} from '../server/star-record-math.js';
import {disarmSpiritBlueStar} from '../server/spirit-blue-stars.js';
import {readingFixture,call} from './helpers/reading-fixture.js';

test('expired, distant and invalid boss interactions are normal GameError rejections',()=>{
 const player={id:'student',role:'student',connected:true,away:false,mapId:'sleeping-stars-2',x:0,y:0,avatar:{level:5,constellationId:'leo'}};
 const boss={id:'star-record-boss',hp:100,mapId:player.mapId},room={players:new Map([[player.id,player]]),monsters:new Map([[boss.id,boss]])};
 assert.throws(()=>answerStarRecordMath(room,player,'number','+',1),e=>e instanceof GameError&&e.message==='지금은 숫자 별을 풀 수 없어요.');
 boss.recordMath={endsAt:100,stars:[{id:'number',x:500,y:500,left:1,right:1,result:2,solved:false}]};
 assert.throws(()=>answerStarRecordMath(room,player,'number','+',1),e=>e instanceof GameError&&e.message==='숫자 별 가까이에서 다시 시도해 주세요.');
 player.x=player.y=500;
 assert.throws(()=>answerStarRecordMath(room,player,'number','?',1),e=>e instanceof GameError&&e.message==='연산 기호를 선택해 주세요.');
 assert.throws(()=>disarmSpiritBlueStar(room,player,'gone',1),e=>e instanceof GameError&&e.message==='해체할 별이 이미 사라졌어요.');
 room.spiritBlueStars=[{id:'blue',bossId:boss.id,mapId:boss.mapId,x:0,y:0,radius:30,endsAt:100}];
 assert.throws(()=>disarmSpiritBlueStar(room,player,'blue',1),e=>e instanceof GameError&&e.message==='푸른 별 가까이에서 해체해 주세요.');
});

test('persistent boss socket denials return actionable messages and leave the connection usable',async t=>{
 const f=await readingFixture(t);
 for(const [event,data,message]of [
  ['star-record:math',{starId:'missing',operator:'+'},'지금은 숫자 별을 풀 수 없어요.'],
  ['spirit-star:disarm',{starId:'missing'},'해체할 별이 이미 사라졌어요.']
 ]){const response=await call(f.student,event,data);assert.equal(response.ok,false);assert.equal(response.error,message);assert(f.student.connected);}
});
