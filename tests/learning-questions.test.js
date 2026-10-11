import test from 'node:test';
import assert from 'node:assert/strict';
import {ENGLISH_WORDS,englishQuestion,mathQuestion} from '../shared/learning-questions.js';
import {ENGLISH_LEVELS} from '../shared/english-vocabulary.js';

const valueOf=text=>String(text).includes('/')?String(text).split('/').reduce((a,b)=>Number(a)/Number(b)):Number(text);
test('수학 발전소 6단계는 학년별 연산과 계산이 맞는 4지선다를 낸다',()=>{
  for(let grade=1;grade<=6;grade++)for(let i=0;i<400;i++){
    const q=mathQuestion(`grade-${grade}`,()=>((i*37%401)+.5)/401);
    assert.match(q.prompt,/^[0-9./]+ [+-−×÷] [0-9./]+ = \?$/);
    assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4);
    assert.ok(q.choices.includes(q.answer));
    const [a,operator,b]=q.prompt.split(' '),left=valueOf(a),right=valueOf(b);
    const calculated=operator==='+'?left+right:operator==='−'?left-right:operator==='×'?left*right:left/right;
    assert.ok(Math.abs(valueOf(q.answer)-calculated)<1e-9,`${grade}학년 ${q.prompt} → ${q.answer}`);
    if(grade===1){assert.ok(['+','−'].includes(operator));assert.ok(left<=20&&right<=20&&q.answer>=0&&q.answer<=20);}
    if(grade===2){assert.ok(['+','−','×'].includes(operator));assert.ok(q.answer>=0&&q.answer<=100);}
    if(grade<=4)assert.ok(Number.isInteger(q.answer));
    if(grade===5&&operator==='÷')assert.fail('5학년은 분수 덧셈·소수·곱셈 연습');
  }
  assert.throws(()=>mathQuestion('unknown'),RangeError);
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

test('영어 여섯 단계의 모든 단어를 중복·범위 이탈·겹치는 보기 없이 출제한다',()=>{
  assert.equal(ENGLISH_LEVELS.length,6);
  assert.equal(ENGLISH_WORDS.length,804);
  assert.equal(new Set(ENGLISH_WORDS.map(([word])=>word.toLowerCase())).size,804);
  for(const level of ENGLISH_LEVELS){
    assert.ok(level.words.length>=20,`${level.label} 문제 풀이용 어휘 부족`);
    const used=new Set();
    for(let i=0;i<level.words.length;i++){
      const q=englishQuestion(()=>0,used,level.id);
      assert.ok(!used.has(q.prompt));used.add(q.prompt);
      assert.ok(level.words.some(([word,meaning])=>word===q.prompt&&meaning===q.answer));
      assert.equal(new Set(q.choices).size,4);assert.equal(q.choices.filter(c=>c===q.answer).length,1);
      assert.ok(q.choices.every(c=>typeof c==='string'&&c.trim().length>0));
      const parts=text=>text.split(/[,;/·]/).map(p=>p.replace(/[~…\s]/g,''));
      for(const wrong of q.choices.filter(c=>c!==q.answer))assert.ok(!parts(wrong).some(p=>parts(q.answer).includes(p)));
    }
    assert.equal(used.size,level.words.length);
  }
  assert.throws(()=>englishQuestion(Math.random,new Set(),'grade-9'),RangeError);
});
