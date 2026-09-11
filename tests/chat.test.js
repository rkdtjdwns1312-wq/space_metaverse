import test from 'node:test';
import assert from 'node:assert/strict';
import { filterChat, BLOCKED_WORDS } from '../server/chat-filter.js';
test('filterChat masks blocked words in place with same-length circles, case-insensitively',()=>{
 const r=filterChat('너 진짜 병신 같다');assert.equal(r.flagged,true);assert.equal(r.text,'너 진짜 ○○ 같다');
 const r2=filterChat('You are such a FUCK');assert.equal(r2.flagged,true);assert.ok(r2.text.endsWith('○○○○'));
 const r3=filterChat('바보바보');assert.equal(r3.flagged,true);assert.equal(r3.text,'○○○○');
});
test('filterChat masks words hidden with punctuation or symbols, but leaves plain spacing alone',()=>{
 const r=filterChat('시.발!!');assert.equal(r.flagged,true);assert.equal(r.text,'○○○!!');
 const r2=filterChat('바~보');assert.equal(r2.flagged,true);assert.equal(r2.text,'○○○');
 const r3=filterChat('바 보');assert.equal(r3.flagged,false);assert.equal(r3.text,'바 보');
 const r4=filterChat('선생님 오늘 시 발표 언제 해요?');assert.equal(r4.flagged,false);
 const r5=filterChat('우리 개 새끼를 낳았어요');assert.equal(r5.flagged,false);
});
test('filterChat leaves ordinary sentences untouched',()=>{
 for(const text of ['안녕하세요! 오늘 우주 탐험 재밌었어요','청소행성에서 걸레로 책상을 닦았어요','식물이 죽어요','개구리가 죽어가는 이유']){
  const r=filterChat(text);assert.equal(r.flagged,false,text);assert.equal(r.text,text);
 }
});
test('filterChat normalizes NFKC before comparing (fullwidth letters spell a blocked word)',()=>{
 const fullwidth='ｆｕｃｋ';
 const r=filterChat(fullwidth);assert.equal(r.flagged,true);assert.equal(r.text,'○○○○');
});
test('BLOCKED_WORDS stays a small, directly editable list',()=>{
 assert.ok(BLOCKED_WORDS.length>=15 && BLOCKED_WORDS.length<=30);
 assert.ok(BLOCKED_WORDS.includes('바보'));assert.ok(BLOCKED_WORDS.includes('fuck'));
});
