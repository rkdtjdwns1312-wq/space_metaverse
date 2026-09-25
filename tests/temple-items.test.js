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

test('게시판은 아이템명, 공개 사용자, 대상 순으로 정렬하며 원본 기록을 바꾸지 않는다',()=>{
 const now=Date.now(),players=new Map();
 for(const [id,nickname] of [['b','나래'],['a','가람']])players.set(id,{id,nickname,cardMarkers:[],effects:[
  {itemId:'space-snack',until:now+60000,fromNickname:id==='b'?'가사용자':'하사용자',secret:true},
  ...['나사용자','가사용자'].map(fromNickname=>({itemId:'star-sticker',until:now+60000,fromNickname}))
 ]});
 const room={players},before=structuredClone(room);
 const rows=templeItemRows(room,{role:'student'},now);
 assert.deepEqual(rows.map(r=>[r.itemId,r.fromNickname,r.nickname]),[
 ['star-sticker','가사용자','가람'],['star-sticker','가사용자','나래'],
 ['star-sticker','나사용자','가람'],['star-sticker','나사용자','나래'],
 ['space-snack',undefined,'가람'],['space-snack',undefined,'나래']]);
 assert.deepEqual(room,before);
 const teacher=templeItemRows(room,{role:'teacher'},now);
 assert.deepEqual(teacher.slice(-2).map(r=>r.nickname),['나래','가람']);
});
