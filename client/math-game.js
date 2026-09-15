import {generateProblem} from '/shared/math-problems.js';

const OPERATIONS = [
  ['plus', '덧셈 ＋'],
  ['minus', '뺄셈 −'],
  ['multiply', '곱셈 ×'],
  ['divide', '나눗셈 ÷']
];
const DIFFICULTIES = [
  ['low', '하 (초2)'],
  ['medium', '중 (초3)'],
  ['high', '상 (초4)']
];
const TOTAL_PROBLEMS = 5;
const NEXT_DELAY_MS = 220;

export function createMathGame({board, toast = () => {}} = {}) {
  if (!board) throw new TypeError('board가 필요합니다.');

  const styleUrl = new URL('./math-game.css', import.meta.url).href;
  let styleLink = [...document.querySelectorAll('link[rel="stylesheet"]')].find(link => link.href === styleUrl);
  const ownsStyleLink = !styleLink;
  if (!styleLink) {
    styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = styleUrl;
    styleLink.dataset.mathGameStyle = '';
    document.head.append(styleLink);
  }

  let operation = 'plus';
  let difficulty = 'low';
  let problem = null;
  let question = 0;
  let pendingTimer = null;
  let generation = 0;
  let resolving = false;
  let destroyed = false;

  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const button = (text, handler, className) => {
    const node = element('button', text, className);
    node.type = 'button';
    node.addEventListener('click', handler);
    return node;
  };

  const root = element('section', undefined, 'math-game');
  root.setAttribute('aria-label', '숫자놀이터');
  const operationLabel = element('p', '연산을 골라요.', 'math-control-label');
  const operations = element('div', undefined, 'math-ops');
  const difficultyLabel = element('p', '난이도를 골라요.', 'math-control-label');
  const difficulties = element('div', undefined, 'math-levels');
  const guide = element('p', '', 'math-note math-guide');
  const startButton = button('시작', start, 'math-start');
  const content = element('div', undefined, 'math-content');
  root.append(operationLabel, operations, difficultyLabel, difficulties, guide, startButton, content);
  board.replaceChildren(root);

  for (const [value, label] of OPERATIONS) {
    const choice = button(label, () => {
      if (destroyed) return;
      cancelPending();
      operation = value;
      question = 0;
      problem = null;
      updateSelections();
      showReady();
    }, 'math-choice');
    choice.dataset.operation = value;
    choice.setAttribute('aria-pressed', 'false');
    operations.append(choice);
  }
  for (const [value, label] of DIFFICULTIES) {
    const choice = button(label, () => {
      if (destroyed) return;
      cancelPending();
      difficulty = value;
      question = 0;
      problem = null;
      updateSelections();
      showReady();
    }, 'math-choice');
    choice.dataset.difficulty = value;
    choice.setAttribute('aria-pressed', 'false');
    difficulties.append(choice);
  }

  function cancelPending() {
    generation++;
    if (pendingTimer !== null) clearTimeout(pendingTimer);
    pendingTimer = null;
    resolving = false;
  }

  function updateSelections() {
    for (const choice of operations.children) {
      const selected = choice.dataset.operation === operation;
      choice.classList.toggle('selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    }
    for (const choice of difficulties.children) {
      const selected = choice.dataset.difficulty === difficulty;
      choice.classList.toggle('selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    }
    if (operation === 'divide') {
      guide.textContent = difficulty === 'low'
        ? '정식 나눗셈은 초등 3학년부터 배워요. 하는 20개 이하 물건을 2~5명에게 똑같이 나누는 기초예요.'
        : '정식 나눗셈은 초등 3학년부터 배워요.';
    } else if (difficulty === 'high' && (operation === 'plus' || operation === 'minus')) {
      guide.textContent = '초4 덧셈·뺄셈은 3자리 수 복습을 바탕으로, 받아올림·받아내림이 두 번 있는 심화 문제로 구성했어요.';
    } else {
      guide.textContent = '연산과 난이도를 고른 뒤 시작을 눌러 5문제를 풀어요.';
    }
  }

  function start() {
    if (destroyed) return;
    cancelPending();
    question = 0;
    problem = null;
    showNextProblem();
  }

  function showReady() {
    content.replaceChildren(element('p', '준비되면 시작을 눌러요.', 'math-ready'));
  }

  function finish() {
    problem = null;
    content.replaceChildren(
      element('p', '다섯 문제를 모두 풀었어요!', 'math-question math-complete'),
      button('같은 단계 다시하기', start, 'math-restart')
    );
    toast('다섯 문제를 모두 풀었어요!');
  }

  function showNextProblem() {
    if (destroyed) return;
    resolving = false;
    if (question >= TOTAL_PROBLEMS) {
      finish();
      return;
    }

    problem = generateProblem(operation, difficulty);
    question++;
    const questionText = element('p', problem.prompt, 'math-question');
    const form = element('form', undefined, 'math-answer-form');
    const input = element('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.id = 'math-answer';
    input.setAttribute('aria-label', '정답 입력');
    const feedback = element('p', '', 'math-feedback');
    feedback.setAttribute('aria-live', 'polite');
    const checkButton = button('확인', checkAnswer, 'math-check');

    function checkAnswer() {
      if (destroyed || resolving) return;
      const raw = input.value.trim();
      if (!/^\d+$/.test(raw)) {
        feedback.textContent = '정답을 숫자로 입력해 주세요.';
        feedback.className = 'math-feedback wrong';
        toast('정답을 입력해 주세요.');
        input.focus();
        return;
      }
      if (Number(raw) !== problem.answer) {
        feedback.textContent = '아직 아니에요. 다시 시도해 보세요.';
        feedback.className = 'math-feedback wrong';
        toast('오답이에요. 다시 시도해 보세요.');
        input.select();
        return;
      }

      resolving = true;
      input.disabled = true;
      checkButton.disabled = true;
      feedback.textContent = '정답이에요!';
      feedback.className = 'math-feedback correct';
      const scheduledGeneration = ++generation;
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        if (destroyed || generation !== scheduledGeneration) return;
        showNextProblem();
      }, NEXT_DELAY_MS);
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      checkAnswer();
    });
    form.append(input, checkButton);
    content.replaceChildren(
      questionText,
      form,
      feedback,
      element('p', `${question} / ${TOTAL_PROBLEMS}`, 'math-note math-progress')
    );
    input.focus();
  }

  updateSelections();
  showReady();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelPending();
      root.remove();
      if (ownsStyleLink) styleLink.remove();
    }
  };
}
