import test from 'node:test';
import assert from 'node:assert/strict';
import {templeItemRows} from '../server/temple-items.js';
import {validateCardMarkers} from '../server/item-cards.js';

test('기둥은 공개 사용자·대상·기간·선택적 남은 횟수를 전달하고 비밀 사용자는 교사만 본다',()=>{
  const now=Date.now(),target={id:'b',nickname:'달이',cardMarkers:[],abilityState:{markers:[],blocks:[]},effects:[
    {itemId:'star-sticker',until:now+60000,fromId:'a',fromNickname:'별이',remainingUses:3},
    {itemId:'space-snack',until:now+60000,fromId:'a',fromNickname:'별이',secret:true},
    {itemId:'helmet',until:now+60000,remainingUses:0},
    {itemId:'lamp',until:now-1}
  ]},room={players:new Map([['b',target]])};
  const student=templeItemRows(room,{role:'student'},now),teacher=templeItemRows(room,{role:'teacher'},now);
  assert.equal(student.length,2);assert.equal(student[0].fromNickname,'별이');assert.equal(student[0].nickname,'달이');
  assert.equal(student[0].remainingUses,3);assert.equal(student[0].until,now+60000);assert.equal(student[0].fromId,undefined);
  assert.equal(student[1].fromNickname,undefined);assert.equal(teacher[1].fromNickname,'별이');
});

test('횟수형 카드 기록은 저장 검사와 기둥 표시를 통과하고 잘못된 횟수는 거절한다',()=>{
  const marker={id:'m',itemId:'alien-card',fromId:'a',fromNickname:'별이',until:null,remainingUses:2};
  assert.equal(validateCardMarkers([marker])[0].remainingUses,2);
  for(const remainingUses of [-1,1.5,'2'])assert.throws(()=>validateCardMarkers([{...marker,remainingUses}]));
  const p={id:'b',nickname:'달이',cardMarkers:[marker],effects:[],abilityState:{markers:[],blocks:[]}};
  const [row]=templeItemRows({players:new Map([['b',p]])},{role:'student'});
  assert.equal(row.remainingUses,2);assert.equal(row.until,null);assert.equal(row.fromNickname,'별이');assert.equal(row.markerId,undefined);
});
