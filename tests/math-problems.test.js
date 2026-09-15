import test from 'node:test';
import assert from 'node:assert/strict';
import {generateProblem} from '../shared/math-problems.js';

const operations = ['plus', 'minus', 'multiply', 'divide'];
const difficulties = ['low', 'medium', 'high'];
const rng = (seed = 17) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const between = (value, min, max, label) => assert.ok(value >= min && value <= max, `${label}: ${value} ∉ ${min}..${max}`);

function carryCount(a, b) {
  let carry = 0;
  let count = 0;
  while (a > 0 || b > 0) {
    carry = (a % 10) + (b % 10) + carry >= 10 ? 1 : 0;
    count += carry;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return count;
}

function borrowCount(a, b) {
  let borrow = 0;
  let count = 0;
  for (let place = 0; place < 3; place++) {
    const needsBorrow = (a % 10) - borrow < b % 10;
    borrow = needsBorrow ? 1 : 0;
    count += borrow;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return count;
}

function checkProblem(problem, operation, difficulty) {
  const {a, b, answer, prompt} = problem;
  assert.equal(problem.operation, operation);
  assert.equal(problem.difficulty, difficulty);
  assert.equal(Number.isInteger(a) && Number.isInteger(b) && Number.isInteger(answer), true);
  assert.match(prompt, /\S/);

  if (operation === 'plus') {
    assert.equal(answer, a + b);
    if (difficulty === 'low') {
      between(a, 0, 99, '하 덧셈 a');
      between(b, 0, 99, '하 덧셈 b');
      between(answer, 0, 99, '하 덧셈 결과');
    } else if (difficulty === 'medium') {
      between(a, 100, 899, '중 덧셈 a');
      between(b, 100, 999 - a, '중 덧셈 b');
      between(answer, 200, 999, '중 덧셈 결과');
    } else {
      between(a, 100, 999, '상 덧셈 a');
      between(b, 100, 999, '상 덧셈 b');
      between(answer, 200, 999, '상 덧셈 결과');
      assert.equal(carryCount(a, b), 2, `${a} + ${b}의 받아올림 횟수`);
    }
  } else if (operation === 'minus') {
    assert.equal(answer, a - b);
    if (difficulty === 'low') {
      between(a, 0, 99, '하 뺄셈 a');
      between(b, 0, 99, '하 뺄셈 b');
      between(answer, 0, 99, '하 뺄셈 결과');
    } else if (difficulty === 'medium') {
      between(a, 100, 999, '중 뺄셈 a');
      between(b, 100, a, '중 뺄셈 b');
      between(answer, 0, 899, '중 뺄셈 결과');
    } else {
      between(a, 100, 999, '상 뺄셈 a');
      between(b, 100, 999, '상 뺄셈 b');
      between(answer, 0, 899, '상 뺄셈 결과');
      assert.equal(borrowCount(a, b), 2, `${a} − ${b}의 받아내림 횟수`);
    }
  } else if (operation === 'multiply') {
    assert.equal(answer, a * b);
    if (difficulty === 'low') {
      between(a, 2, 9, '하 곱셈 a');
      between(b, 2, 9, '하 곱셈 b');
    } else if (difficulty === 'medium') {
      between(a, 10, 99, '중 곱셈 a');
      between(b, 2, 9, '중 곱셈 b');
    } else {
      between(a, 10, 999, '상 곱셈 a');
      between(b, 10, 99, '상 곱셈 b');
    }
  } else {
    assert.notEqual(b, 0);
    assert.equal(a % b, 0);
    assert.equal(answer, a / b);
    if (difficulty === 'low') {
      between(a, 2, 20, '하 나눗셈 피제수');
      between(b, 2, 5, '하 나눗셈 나누는 수');
      assert.match(prompt, /^별 \d+개를 \d+명에게 똑같이 나누면 한 명당 몇 개\?$/);
    } else if (difficulty === 'medium') {
      between(a, 10, 99, '중 나눗셈 피제수');
      between(b, 2, 9, '중 나눗셈 나누는 수');
    } else {
      between(a, 10, 999, '상 나눗셈 피제수');
      between(b, 10, 99, '상 나눗셈 나누는 수');
    }
  }
}

for (const operation of operations) {
  for (const difficulty of difficulties) {
    test(`${operation}/${difficulty}: 범위와 정답 250개`, () => {
      const random = rng(operations.indexOf(operation) * 1000 + difficulties.indexOf(difficulty) + 1);
      for (let i = 0; i < 250; i++) checkProblem(generateProblem(operation, difficulty, random), operation, difficulty);
    });
  }
}

test('고정 난수 0과 0.999999에서도 12개 조합이 유한하게 생성된다', () => {
  for (const value of [0, 0.999999]) {
    for (const operation of operations) {
      for (const difficulty of difficulties) {
        const problem = generateProblem(operation, difficulty, () => value);
        checkProblem(problem, operation, difficulty);
      }
    }
  }
});

test('잘못된 인자와 난수 값을 거부한다', () => {
  assert.throws(() => generateProblem('power', 'low'), RangeError);
  assert.throws(() => generateProblem('plus', 'expert'), RangeError);
  assert.throws(() => generateProblem('plus', 'low', null), TypeError);
  assert.throws(() => generateProblem('plus', 'low', () => 1), RangeError);
  assert.throws(() => generateProblem('plus', 'low', () => Number.NaN), RangeError);
});
