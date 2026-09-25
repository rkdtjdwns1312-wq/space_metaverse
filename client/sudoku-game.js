import {SUDOKU_LEVELS, generateSudoku, findConflicts, isSudokuComplete} from '/shared/sudoku.js';

const LEVELS = [
  ['low', '하 · 6×6'],
  ['medium', '중 · 9×9'],
  ['high', '상 · 12×12']
];

export function createSudokuGame({board, toast = () => {}} = {}) {
  if (!board) throw new TypeError('board가 필요합니다.');

  const styleUrl = new URL('./sudoku-game.css', import.meta.url).href;
  let styleLink = [...document.querySelectorAll('link[rel="stylesheet"]')].find(link => link.href === styleUrl);
  const ownsStyleLink = !styleLink;
  if (!styleLink) {
    styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = styleUrl;
    styleLink.dataset.sudokuGameStyle = '';
    document.head.append(styleLink);
  }

  let difficulty = 'low';
  let game = null;
  let selected = -1;
  let conflicts = new Set();
  let destroyed = false;
  let busy = false;
  let finished = false;
  let startTimer = null;

  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const button = (text, className, handler) => {
    const node = element('button', text, className);
    node.type = 'button';
    if (handler) node.addEventListener('click', handler);
    return node;
  };

  const root = element('section', undefined, 'sudoku-game');
  root.setAttribute('aria-label', '스도쿠');
  const levelLabel = element('p', '난이도를 골라요.', 'sudoku-label');
  const levels = element('div', undefined, 'sudoku-levels');
  const help = element('p', '가로줄·세로줄·굵은 테두리 안에 같은 숫자가 겹치지 않게 채워요. 처음 숫자는 바꿀 수 없어요. 10·11·12는 숫자 단추 또는 키보드 A·B·C로 넣어요.', 'sudoku-help');
  const startButton = button('새 스도쿠 시작', 'sudoku-start', start);
  const status = element('p', '난이도를 고르고 시작을 눌러요.', 'sudoku-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const gameArea = element('div', undefined, 'sudoku-area');
  root.append(levelLabel, levels, help, startButton, status, gameArea);
  board.replaceChildren(root);

  for (const [value, label] of LEVELS) {
    const choice = button(label, 'sudoku-difficulty', () => {
      if (destroyed || busy) return;
      difficulty = value;
      updateLevelSelection();
      if (game) start();
      else status.textContent = `${label} 난이도를 골랐어요. 시작을 눌러 새 판을 만들어요.`;
    });
    choice.dataset.difficulty = value;
    choice.setAttribute('aria-pressed', 'false');
    levels.append(choice);
  }

  function updateLevelSelection() {
    for (const choice of levels.children) {
      const active = choice.dataset.difficulty === difficulty;
      choice.classList.toggle('selected', active);
      choice.setAttribute('aria-pressed', String(active));
    }
  }

  function start() {
    if (destroyed || busy) return;
    const config = SUDOKU_LEVELS[difficulty];
    if (!config) {
      status.textContent = '이 난이도를 준비하지 못했어요. 다른 난이도를 골라 주세요.';
      return;
    }
    busy = true;
    startButton.disabled = true;
    status.textContent = '새 스도쿠 판을 만들고 있어요…';
    gameArea.replaceChildren();
    selected = -1;
    conflicts = new Set();
    finished = false;
    startTimer = setTimeout(() => {
      startTimer = null;
      if (destroyed) return;
      try {
        const generated = generateSudoku(difficulty);
        if (!generated || generated.size !== config.size || !Array.isArray(generated.puzzle) || !Array.isArray(generated.solution)) {
          throw new Error('스도쿠 판을 만들지 못했어요.');
        }
        game = {...generated, values: [...generated.puzzle]};
        renderGame();
        status.textContent = `${config.size}×${config.size} 판이에요. 빈 칸을 고르고 숫자를 넣어 보세요.`;
      } catch {
        game = null;
        gameArea.replaceChildren();
        status.textContent = '스도쿠 판을 만들지 못했어요. 다시 시작해 주세요.';
        toast('스도쿠 판을 만들지 못했어요. 다시 시도해 주세요.');
      } finally {
        busy = false;
        if (!destroyed) startButton.disabled = false;
      }
    }, 0);
  }

  function renderGame() {
    const grid = element('div', undefined, 'sudoku-grid');
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', `${game.size} 곱하기 ${game.size} 스도쿠 판`);
    grid.style.setProperty('--sudoku-size', game.size);
    grid.style.setProperty('--sudoku-box-rows', game.boxRows);
    grid.style.setProperty('--sudoku-box-cols', game.boxCols);
    const cells = [];
    for (let index = 0; index < game.size * game.size; index++) {
      const value = game.puzzle[index];
      const cell = button(value ? digitLabel(value) : '', 'sudoku-cell', () => selectCell(index));
      cell.dataset.index = String(index);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', value ? `칸 ${index + 1}, ${digitLabel(value)}, 처음 숫자` : `칸 ${index + 1}, 빈칸`);
      cell.setAttribute('aria-pressed', 'false');
      cell.disabled = Boolean(value);
      if (value) cell.classList.add('sudoku-given');
      if ((index % game.size) % game.boxCols === game.boxCols - 1 && index % game.size !== game.size - 1) cell.classList.add('sudoku-box-right');
      if (Math.floor(index / game.size) % game.boxRows === game.boxRows - 1 && Math.floor(index / game.size) !== game.size - 1) cell.classList.add('sudoku-box-bottom');
      grid.append(cell);
      cells.push(cell);
    }

    const keypad = element('div', undefined, 'sudoku-keypad');
    keypad.setAttribute('aria-label', '숫자 키패드');
    for (let value = 1; value <= game.size; value++) {
      const key = button(digitLabel(value), 'sudoku-key', () => enterValue(value));
      key.dataset.value = String(value);
      key.setAttribute('aria-label', `숫자 ${digitLabel(value)} 입력`);
      keypad.append(key);
    }
    keypad.append(button('지우기', 'sudoku-key sudoku-clear', clearSelected));

    const actions = element('div', undefined, 'sudoku-actions');
    actions.append(button('정답 확인', 'sudoku-check', checkAnswer));
    gameArea.replaceChildren(grid, keypad, actions);
    game.cells = cells;
    refreshCells();
  }

  function digitLabel(value) {
    return String(value);
  }

  function selectCell(index) {
    if (!game || destroyed || game.puzzle[index]) return;
    selected = index;
    refreshCells();
    status.textContent = `칸 ${index + 1}을 골랐어요. 아래 숫자를 누르거나 키보드로 입력해요.`;
  }

  function refreshCells() {
    if (!game?.cells) return;
    conflicts = findConflicts(game.values ?? [...game.puzzle], game);
    game.cells.forEach((cell, index) => {
      const value = game.values[index];
      cell.textContent = value ? digitLabel(value) : '';
      cell.classList.toggle('sudoku-conflict', conflicts.has(index));
      cell.classList.toggle('sudoku-selected', selected === index);
      cell.setAttribute('aria-pressed', String(selected === index));
      cell.setAttribute('aria-label', game.puzzle[index]
        ? `칸 ${index + 1}, ${digitLabel(game.puzzle[index])}, 처음 숫자`
        : `칸 ${index + 1}, ${value ? digitLabel(value) : '빈칸'}${conflicts.has(index) ? ', 겹치는 숫자' : ''}`);
    });
  }

  function values() {
    if (!game) return [];
    return game.values;
  }

  function enterValue(value) {
    if (!game || destroyed || finished || selected < 0 || game.puzzle[selected]) return;
    values()[selected] = value;
    refreshCells();
    status.textContent = conflicts.size
      ? '같은 줄이나 굵은 테두리 안에 숫자가 겹쳐요. 겹친 칸을 살펴봐요.'
      : '숫자를 넣었어요. 계속 채워 보세요.';
    if (!conflicts.size && isSudokuComplete(values(), game)) complete();
  }

  function clearSelected() {
    if (!game || destroyed || finished || selected < 0 || game.puzzle[selected]) return;
    values()[selected] = 0;
    refreshCells();
    status.textContent = '고른 칸을 비웠어요.';
  }

  function checkAnswer() {
    if (finished) return;
    if (!game || destroyed) {
      status.textContent = '먼저 난이도를 고르고 스도쿠를 시작해 주세요.';
      return;
    }
    if (conflicts.size) {
      status.textContent = '겹치는 숫자가 있어요. 빨갛게 표시된 칸을 확인해 보세요.';
      return;
    }
    if (isSudokuComplete(values(), game)) {
      complete();
      return;
    }
    status.textContent = '아직 빈 칸이 있어요. 모든 칸을 채운 뒤 다시 확인해요.';
  }

  function complete() {
    if (finished) return;
    finished = true;
    status.textContent = '모두 맞게 채웠어요! 스도쿠를 완성했어요. 축하해요!';
    toast('스도쿠를 완성했어요! 정말 잘했어요!');
  }

  function onKeyDown(event) {
    if (destroyed || !game || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    const key = event.key.toUpperCase();
    if (key === 'ARROWRIGHT' || key === 'ARROWDOWN' || key === 'ARROWLEFT' || key === 'ARROWUP') {
      event.preventDefault();
      moveSelection(key);
      return;
    }
    if (key === 'DELETE' || key === 'BACKSPACE') {
      event.preventDefault();
      clearSelected();
      return;
    }
    const value = /^[1-9]$/.test(key) ? Number(key) : /^[ABC]$/.test(key) ? key.charCodeAt(0) - 55 : 0;
    if (value >= 1 && value <= game.size) {
      event.preventDefault();
      enterValue(value);
    }
  }

  function moveSelection(key) {
    if (selected < 0) {
      selectCell(game.puzzle.findIndex(value => value === 0));
      return;
    }
    const row = Math.floor(selected / game.size);
    const col = selected % game.size;
    const rowDelta = key === 'ARROWDOWN' ? 1 : key === 'ARROWUP' ? -1 : 0;
    const colDelta = key === 'ARROWRIGHT' ? 1 : key === 'ARROWLEFT' ? -1 : 0;
    for (let step = 1; step <= game.size; step++) {
      const nextRow = (row + rowDelta * step + game.size) % game.size;
      const nextCol = (col + colDelta * step + game.size) % game.size;
      const next = nextRow * game.size + nextCol;
      if (!game.puzzle[next]) {
        selectCell(next);
        game.cells[next].focus();
        return;
      }
    }
  }

  document.addEventListener('keydown', onKeyDown);
  updateLevelSelection();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (startTimer !== null) clearTimeout(startTimer);
      document.removeEventListener('keydown', onKeyDown);
      root.remove();
      if (ownsStyleLink) styleLink.remove();
    }
  };
}
