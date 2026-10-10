import test from 'node:test';
import assert from 'node:assert/strict';
import {ENGLISH_WORDS,englishQuestion,mathQuestion} from '../shared/learning-questions.js';

test('수학 발전소의 기초·도전 문제는 정수 정답과 서로 다른 보기 네 개를 낸다',()=>{
  for(const level of ['basic','challenge'])for(let i=0;i<400;i++){
    const q=mathQuestion(level,()=>((i*37%401)+.5)/401);
    assert.match(q.prompt,/^[0-9]+ [+-−×÷] [0-9]+ = \?$/);
    assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4);
    assert.ok(q.choices.includes(q.answer));assert.ok(q.choices.every(Number.isInteger));
    const [a,operator,b]=q.prompt.split(' ');
    const calculated=operator==='+'?+a+(+b):operator==='−'?a-b:operator==='×'?a*b:a/b;
    assert.equal(q.answer,calculated);
  }
});

test('영어 발전소는 쉬운 어휘를 중복 없이 고르고 정답을 포함한다',()=>{
  const used=new Set();
  for(let i=0;i<10;i++){
    const q=englishQuestion(()=>.41,used);
    assert.ok(!used.has(q.prompt));used.add(q.prompt);
    assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4);
    assert.ok(q.choices.includes(q.answer));
    assert.ok(ENGLISH_WORDS.some(([word,meaning])=>word===q.prompt&&meaning===q.answer));
  }
});
