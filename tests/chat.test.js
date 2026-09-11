import test from 'node:test';
import assert from 'node:assert/strict';
import { filterChat, BLOCKED_WORDS } from '../server/chat-filter.js';
test('filterChat masks blocked words in place with same-length circles, case-insensitively',()=>{
 const r=filterChat('너 진짜 병신 같다');assert.equal(r.flagged,true);assert.equal(r.text,'너 진짜 ○○ 같다');
 const r2=filterChat('You are such a FUCK');assert.equal(r2.flagged,true);assert.ok(r2.text.endsWith('○○○○'));
});
test('filterChat masks the whole message when a blocked word only appears after stripping spaces or punctuation',()=>{
 const r=filterChat('바 보');assert.equal(r.flagged,true);assert.equal(r.text,'○○○');
 const r2=filterChat('시.발!!');assert.equal(r2.flagged,true);assert.equal(r2.text,'○○○');
});
test('filterChat leaves ordinary sentences untouched',()=>{
 const text='안녕하세요! 오늘 우주 탐험 재밌었어요';
 const r=filterChat(text);assert.equal(r.flagged,false);assert.equal(r.text,text);
});
test('filterChat normalizes NFKC before comparing (fullwidth letters spell a blocked word)',()=>{
 const fullwidth='ｆｕｃｋ';
 const r=filterChat(fullwidth);assert.equal(r.flagged,true);
});
test('BLOCKED_WORDS stays a small, directly editable list',()=>{
 assert.ok(BLOCKED_WORDS.length>=15 && BLOCKED_WORDS.length<=30);
 assert.ok(BLOCKED_WORDS.includes('바보'));assert.ok(BLOCKED_WORDS.includes('fuck'));
});
