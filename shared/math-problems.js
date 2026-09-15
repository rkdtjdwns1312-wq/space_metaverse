const OPERATIONS = new Set(['plus', 'minus', 'multiply', 'divide']);
const DIFFICULTIES = new Set(['low', 'medium', 'high']);

function validate(operation, difficulty, random) {
  if (!OPERATIONS.has(operation) || !DIFFICULTIES.has(difficulty)) {
    throw new RangeError('잘못된 연산 또는 난이도입니다.');
  }
  if (typeof random !== 'function') throw new TypeError('random은 함수여야 합니다.');
}

function randomInt(random, min, max) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('random은 0 이상 1 미만의 수를 반환해야 합니다.');
  }
  return min + Math.floor(value * (max - min + 1));
}

function hardAddition(random) {
  // 일의 자리와 십의 자리에서 각각 받아올림이 생기고, 합은 세 자리를 넘지 않습니다.
  const hundredsA = randomInt(random, 1, 7);
  const hundredsB = randomInt(random, 1, 8 - hundredsA);
  const tensA = randomInt(random, 0, 9);
  const tensB = randomInt(random, 9 - tensA, 9);
  const onesA = randomInt(random, 1, 9);
  const onesB = randomInt(random, 10 - onesA, 9);
  const a = hundredsA * 100 + tensA * 10 + onesA;
  const b = hundredsB * 100 + tensB * 10 + onesB;
  return {a, b, answer: a + b};
}

function hardSubtraction(random) {
  // 일의 자리와 십의 자리에서 각각 받아내림이 생기고, 두 수는 모두 세 자리입니다.
  const hundredsA = randomInt(random, 2, 9);
  const hundredsB = randomInt(random, 1, hundredsA - 1);
  const tensA = randomInt(random, 0, 9);
  const tensB = randomInt(random, tensA, 9);
  const onesA = randomInt(random, 0, 8);
  const onesB = randomInt(random, onesA + 1, 9);
  const a = hundredsA * 100 + tensA * 10 + onesA;
  const b = hundredsB * 100 + tensB * 10 + onesB;
  return {a, b, answer: a - b};
}

function addition(difficulty, random) {
  if (difficulty === 'low') {
    const a = randomInt(random, 0, 99);
    const b = randomInt(random, 0, 99 - a);
    return {a, b, answer: a + b};
  }
  if (difficulty === 'medium') {
    const a = randomInt(random, 100, 899);
    const b = randomInt(random, 100, 999 - a);
    return {a, b, answer: a + b};
  }
  return hardAddition(random);
}

function subtraction(difficulty, random) {
  if (difficulty === 'low') {
    const a = randomInt(random, 0, 99);
    const b = randomInt(random, 0, a);
    return {a, b, answer: a - b};
  }
  if (difficulty === 'medium') {
    const a = randomInt(random, 100, 999);
    const b = randomInt(random, 100, a);
    return {a, b, answer: a - b};
  }
  return hardSubtraction(random);
}

function multiplication(difficulty, random) {
  if (difficulty === 'low') {
    const a = randomInt(random, 2, 9);
    const b = randomInt(random, 2, 9);
    return {a, b, answer: a * b};
  }
  if (difficulty === 'medium') {
    const a = randomInt(random, 10, 99);
    const b = randomInt(random, 2, 9);
    return {a, b, answer: a * b};
  }
  const a = randomInt(random, 10, 999);
  const b = randomInt(random, 10, 99);
  return {a, b, answer: a * b};
}

function division(difficulty, random) {
  if (difficulty === 'low') {
    const b = randomInt(random, 2, 5);
    const answer = randomInt(random, 1, Math.floor(20 / b));
    const a = b * answer;
    return {a, b, answer, prompt: `별 ${a}개를 ${b}명에게 똑같이 나누면 한 명당 몇 개?`};
  }
  if (difficulty === 'medium') {
    const b = randomInt(random, 2, 9);
    const answer = randomInt(random, Math.ceil(10 / b), Math.floor(99 / b));
    return {a: b * answer, b, answer};
  }
  const b = randomInt(random, 10, 99);
  const answer = randomInt(random, 1, Math.floor(999 / b));
  return {a: b * answer, b, answer};
}

export function generateProblem(operation, difficulty, random = Math.random) {
  validate(operation, difficulty, random);
  let problem;
  let symbol;

  if (operation === 'plus') {
    problem = addition(difficulty, random);
    symbol = '+';
  } else if (operation === 'minus') {
    problem = subtraction(difficulty, random);
    symbol = '−';
  } else if (operation === 'multiply') {
    problem = multiplication(difficulty, random);
    symbol = '×';
  } else {
    problem = division(difficulty, random);
    symbol = '÷';
  }

  const prompt = problem.prompt ?? `${problem.a} ${symbol} ${problem.b} = ?`;
  return {operation, difficulty, ...problem, prompt};
}
