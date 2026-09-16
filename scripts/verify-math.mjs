// 실제 교실 서버의 정적 경로와 임시 부품 페이지에서 숫자놀이터를 검증합니다.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';

const operations = {
  plus: '덧셈 ＋',
  minus: '뺄셈 −',
  multiply: '곱셈 ×',
  divide: '나눗셈 ÷'
};
const difficulties = {
  low: '하 (초2)',
  medium: '중 (초3)',
  high: '상 (초4)'
};
const checks = [];
const errors = [];
const game = createClassroomServer({teacherKey: 'math-browser-test-only-private', studentHours: false});
let browser;

const check = text => {
  checks.push(text);
  console.log(text);
};
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

function parsePrompt(text) {
  const sharing = text.match(/^별 (\d+)개를 (\d+)명에게 똑같이 나누면 한 명당 몇 개\?$/);
  if (sharing) {
    const a = Number(sharing[1]);
    const b = Number(sharing[2]);
    return {a, b, symbol: '÷', answer: a / b};
  }
  const expression = text.match(/^(\d+)\s*([+−×÷])\s*(\d+)\s*=\s*\?$/);
  assert.ok(expression, `문제 문구를 읽을 수 없음: ${text}`);
  const a = Number(expression[1]);
  const b = Number(expression[3]);
  const symbol = expression[2];
  const answer = symbol === '+' ? a + b : symbol === '−' ? a - b : symbol === '×' ? a * b : a / b;
  return {a, b, symbol, answer};
}

function assertRange(problem, operation, difficulty) {
  const {a, b, answer} = problem;
  assert.equal(Number.isInteger(answer), true);
  if (operation === 'plus') {
    assert.equal(answer, a + b);
    if (difficulty === 'low') {
      between(a, 0, 99, '하 덧셈 a');
      between(b, 0, 99, '하 덧셈 b');
      between(answer, 0, 99, '하 덧셈 결과');
    } else if (difficulty === 'medium') {
      between(a, 100, 899, '중 덧셈 a');
      between(b, 100, 999 - a, '중 덧셈 b');
    } else {
      between(a, 100, 999, '상 덧셈 a');
      between(b, 100, 999, '상 덧셈 b');
      between(answer, 200, 999, '상 덧셈 결과');
      assert.equal(carryCount(a, b), 2);
    }
  } else if (operation === 'minus') {
    assert.equal(answer, a - b);
    if (difficulty === 'low') {
      between(a, 0, 99, '하 뺄셈 a');
      between(b, 0, a, '하 뺄셈 b');
    } else if (difficulty === 'medium') {
      between(a, 100, 999, '중 뺄셈 a');
      between(b, 100, a, '중 뺄셈 b');
    } else {
      between(a, 100, 999, '상 뺄셈 a');
      between(b, 100, 999, '상 뺄셈 b');
      assert.equal(borrowCount(a, b), 2);
    }
    assert.ok(answer >= 0);
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
    assert.equal(a % b, 0);
    assert.equal(answer, a / b);
    if (difficulty === 'low') {
      between(a, 2, 20, '하 나눗셈 피제수');
      between(b, 2, 5, '하 나눗셈 나누는 수');
    } else if (difficulty === 'medium') {
      between(a, 10, 99, '중 나눗셈 피제수');
      between(b, 2, 9, '중 나눗셈 나누는 수');
    } else {
      between(a, 10, 999, '상 나눗셈 피제수');
      between(b, 10, 99, '상 나눗셈 나누는 수');
    }
  }
}

try {
  const address = await game.listen();
  const url = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({headless: true, ...(process.platform === 'win32' ? {channel: 'msedge'} : {})});
  const page = await browser.newPage({viewport: {width: 390, height: 844}});
  const requests = new Set();
  page.on('request', request => requests.add(new URL(request.url()).pathname));
  page.on('pageerror', error => errors.push(error.message));
  await page.route(`${url}/__math_fixture__/page`, route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: `<!doctype html>
      <html lang="ko"><head><meta charset="utf-8"><base href="/잘못된-상대-기준/"><title>숫자놀이터 검사</title></head>
      <body><button id="fixture-close" type="button">닫기</button><main id="board"></main>
      <script type="module">
        import {createMathGame} from '/math-game.js';
        const board = document.querySelector('#board');
        window.mathToasts = [];
        window.mathGame = createMathGame({board, toast: text => window.mathToasts.push(text)});
        document.querySelector('#fixture-close').addEventListener('click', () => {
          window.mathGame.destroy();
          board.replaceChildren();
        });
        window.fixtureReady = true;
      </script></body></html>`
  }));
  await page.goto(`${url}/__math_fixture__/page`, {waitUntil: 'domcontentloaded', timeout: 25000});
  await page.waitForFunction(() => window.fixtureReady === true);
  await page.waitForFunction(() => [...document.styleSheets].some(sheet => sheet.href?.endsWith('/math-game.css')));
  assert.ok(requests.has('/math-game.js'));
  assert.ok(requests.has('/shared/math-problems.js'));
  assert.ok(requests.has('/math-game.css'));
  check('실제 교실 서버·상대 base에서도 /shared 모듈과 math-game.css 경로 로드');

  for (const label of Object.values(operations)) await page.getByRole('button', {name: label, exact: true}).waitFor();
  for (const label of Object.values(difficulties)) await page.getByRole('button', {name: label, exact: true}).waitFor();
  const divideLabelLayout = await page.getByRole('button', {name: operations.divide, exact: true}).evaluate(button => {
    const range = document.createRange();
    range.selectNodeContents(button);
    return {lines: range.getClientRects().length, whiteSpace: getComputedStyle(button).whiteSpace};
  });
  assert.deepEqual(divideLabelLayout, {lines: 1, whiteSpace: 'nowrap'});
  assert.equal(await page.getByRole('button', {name: operations.plus, exact: true}).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', {name: difficulties.low, exact: true}).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', {name: difficulties.high, exact: true}).click();
  assert.match(await page.locator('.math-guide').textContent(), /초4.*3자리 수 복습.*심화/);
  await page.getByRole('button', {name: operations.divide, exact: true}).click();
  await page.getByRole('button', {name: difficulties.low, exact: true}).click();
  assert.match(await page.locator('.math-guide').textContent(), /정식 나눗셈은 초등 3학년부터.*20개 이하.*2~5명/);
  check('한글 연산명+기호를 한 줄로 표시하고 하중상·선택 상태·학년군 안내 표시');

  const chooseAndStart = async (operation, difficulty) => {
    await page.getByRole('button', {name: operations[operation], exact: true}).click();
    await page.getByRole('button', {name: difficulties[difficulty], exact: true}).click();
    await page.getByRole('button', {name: '시작', exact: true}).click();
    await page.locator('.math-progress').filter({hasText: '1 / 5'}).waitFor();
  };
  const currentProblem = async () => parsePrompt((await page.locator('.math-question').textContent()).trim());

  await chooseAndStart('plus', 'low');
  await page.locator('#math-answer').fill('');
  await page.getByRole('button', {name: '확인', exact: true}).click();
  assert.equal((await page.locator('.math-progress').textContent()).trim(), '1 / 5');
  assert.match(await page.locator('.math-feedback').textContent(), /정답을 숫자로 입력/);
  await page.locator('#math-answer').fill('999999');
  await page.getByRole('button', {name: '확인', exact: true}).click();
  assert.equal((await page.locator('.math-progress').textContent()).trim(), '1 / 5');
  assert.match(await page.locator('.math-feedback').textContent(), /다시 시도/);
  check('빈 입력은 0으로 처리하지 않고 오답도 같은 문제에서 재시도');

  await chooseAndStart('plus', 'low');
  const rapidAnswer = await currentProblem();
  await page.locator('#math-answer').fill(String(rapidAnswer.answer));
  await page.getByRole('button', {name: '확인', exact: true}).evaluate(button => {
    for (let i = 0; i < 12; i++) button.dispatchEvent(new MouseEvent('click', {bubbles: true}));
  });
  await page.waitForTimeout(80);
  assert.equal((await page.locator('.math-progress').textContent()).trim(), '1 / 5');
  await page.locator('.math-progress').filter({hasText: '2 / 5'}).waitFor();
  assert.equal((await page.locator('.math-progress').textContent()).trim(), '2 / 5');
  check('정답 확인 12회 연타에도 다음 한 문제만 생성');

  for (const operation of Object.keys(operations)) {
    for (const difficulty of Object.keys(difficulties)) {
      await chooseAndStart(operation, difficulty);
      for (let index = 0; index < 5; index++) {
        const problem = await currentProblem();
        assertRange(problem, operation, difficulty);
        await page.locator('#math-answer').fill(String(problem.answer));
        await page.getByRole('button', {name: '확인', exact: true}).click();
        if (index < 4) {
          await page.locator('.math-progress').filter({hasText: `${index + 2} / 5`}).waitFor();
        } else {
          await page.locator('.math-complete').waitFor();
        }
      }
    }
  }
  check('12개 연산·난이도 조합의 생성 범위와 정답을 실제 UI에서 각 5문제 풀이');

  await chooseAndStart('divide', 'low');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const boxes = await Promise.all([
    page.locator('.math-game').boundingBox(),
    page.locator('#math-answer').boundingBox(),
    page.getByRole('button', {name: '확인', exact: true}).boundingBox()
  ]);
  for (const box of boxes) assert.ok(box && box.x >= 0 && box.x + box.width <= 390.5);
  check('390px 화면에서 연산·입력·확인 UI 가로 넘침 없음');

  const closingAnswer = await currentProblem();
  await page.locator('#math-answer').fill(String(closingAnswer.answer));
  await page.getByRole('button', {name: '확인', exact: true}).click();
  await page.locator('#fixture-close').click();
  assert.equal(await page.locator('#board').evaluate(board => board.childElementCount), 0);
  await page.waitForTimeout(350);
  assert.equal(await page.locator('#board').evaluate(board => board.childElementCount), 0);
  assert.equal(await page.locator('.math-game').count(), 0);
  assert.equal(await page.locator('link[data-math-game-style]').count(), 0);
  check('닫기 destroy가 대기 타이머·게임판·전용 스타일을 정리하고 재삽입하지 않음');

  assert.deepEqual(errors, []);
} finally {
  if (browser) await browser.close();
  await game.close();
}

console.log(JSON.stringify({checks: checks.length, errors}));
