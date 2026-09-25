// 세 단계 모두 행·열·작은 구역에 1~N이 한 번씩 들어가는 같은 규칙입니다.
export const SUDOKU_LEVELS = Object.freeze({
  low: Object.freeze({size: 6, boxRows: 2, boxCols: 3, holes: 18}),
  medium: Object.freeze({size: 9, boxRows: 3, boxCols: 3, holes: 42}),
  high: Object.freeze({size: 12, boxRows: 3, boxCols: 4, holes: 70})
});
function validConfig(config) {
  return Object.values(SUDOKU_LEVELS).some(c => c.size === config?.size && c.boxRows === config.boxRows && c.boxCols === config.boxCols);
}
const boxOf = (row, col, c) => Math.floor(row / c.boxRows) * (c.size / c.boxCols) + Math.floor(col / c.boxCols);

export function findConflicts(values, config) {
  if (!validConfig(config) || !Array.isArray(values) || values.length !== config.size ** 2) throw new Error('스도쿠 판의 크기가 올바르지 않습니다.');
  const n = config.size, conflicts = new Set(), groups = Array.from({length: n * 3}, () => new Map());
  for (let i = 0; i < values.length; i++) {
    const value = values[i]; if (value === 0) continue;
    if (!Number.isInteger(value) || value < 1 || value > n) {conflicts.add(i); continue;}
    const row = Math.floor(i / n), col = i % n;
    for (const groupId of [row, n + col, n * 2 + boxOf(row, col, config)]) {
      const group = groups[groupId];
      if (group.has(value)) {conflicts.add(group.get(value)); conflicts.add(i);}
      else group.set(value, i);
    }
  }
  return conflicts;
}
export function isSudokuComplete(values, config) {
  return validConfig(config) && Array.isArray(values) && values.length === config.size ** 2 &&
    values.every(v => Number.isInteger(v) && v >= 1 && v <= config.size) && findConflicts(values, config).size === 0;
}

// 해를 두 개 찾으면 중단합니다. 탐색 상한 초과도 별도로 반환하여 유일한 해로 오판하지 않습니다.
export function countSudokuSolutions(values, config, maxNodes = 4000) {
  if (!validConfig(config) || !Array.isArray(values) || values.length !== config.size ** 2 ||
      !Number.isSafeInteger(maxNodes) || maxNodes < 1) throw new Error('스도쿠 검사 입력이 올바르지 않습니다.');
  if (findConflicts(values, config).size) return {count: 0, exhausted: false};
  const n = config.size, full = (1 << n) - 1, board = [...values];
  const rows = Array(n).fill(0), cols = Array(n).fill(0), boxes = Array(n).fill(0);
  for (let i = 0; i < board.length; i++) if (board[i]) {
    const r = Math.floor(i / n), c = i % n, bit = 1 << (board[i] - 1);
    rows[r] |= bit; cols[c] |= bit; boxes[boxOf(r, c, config)] |= bit;
  }
  let count = 0, nodes = 0, exhausted = false;
  function visit() {
    if (count >= 2 || exhausted) return;
    if (++nodes > maxNodes) {exhausted = true; return;}
    let selected = -1, candidates = 0, best = n + 1;
    for (let i = 0; i < board.length; i++) if (!board[i]) {
      const r = Math.floor(i / n), c = i % n;
      const bits = full & ~(rows[r] | cols[c] | boxes[boxOf(r, c, config)]);
      let bitsLeft = bits, size = 0; while (bitsLeft) {bitsLeft &= bitsLeft - 1; size++;}
      if (!size) return;
      if (size < best) {selected = i; candidates = bits; best = size; if (size === 1) break;}
    }
    if (selected < 0) {count++; return;}
    const row = Math.floor(selected / n), col = selected % n, box = boxOf(row, col, config);
    while (candidates && count < 2 && !exhausted) {
      const bit = candidates & -candidates; candidates ^= bit;
      board[selected] = 32 - Math.clz32(bit); rows[row] |= bit; cols[col] |= bit; boxes[box] |= bit;
      visit(); rows[row] ^= bit; cols[col] ^= bit; boxes[box] ^= bit; board[selected] = 0;
    }
  }
  visit(); return {count, exhausted};
}
function shuffled(values, random) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const value = random(); if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('난수는 0 이상 1 미만이어야 합니다.');
    const j = Math.floor(value * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export function generateSudoku(difficulty = 'low', random = Math.random) {
  const config = SUDOKU_LEVELS[difficulty]; if (!config) throw new Error('스도쿠 난이도를 골라주세요.');
  const {size: n, boxRows, boxCols} = config, range = length => Array.from({length}, (_, i) => i);
  const rows = shuffled(range(n / boxRows), random).flatMap(b => shuffled(range(boxRows), random).map(r => b * boxRows + r));
  const cols = shuffled(range(n / boxCols), random).flatMap(b => shuffled(range(boxCols), random).map(c => b * boxCols + c));
  const digits = shuffled(range(n).map(i => i + 1), random);
  const solution = rows.flatMap(r => cols.map(c => digits[((r % boxRows) * boxCols + Math.floor(r / boxRows) + c) % n]));
  const puzzle = [...solution]; let removed = 0;
  for (const index of shuffled(range(n * n), random)) {
    const value = puzzle[index]; puzzle[index] = 0;
    const result = countSudokuSolutions(puzzle, config);
    if (result.count !== 1 || result.exhausted) puzzle[index] = value;
    else if (++removed >= config.holes) break;
  }
  return {difficulty, size: n, boxRows, boxCols, puzzle, solution};
}
