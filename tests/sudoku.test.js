import test from 'node:test';
import assert from 'node:assert/strict';
import {SUDOKU_LEVELS, generateSudoku, countSudokuSolutions, findConflicts, isSudokuComplete} from '../shared/sudoku.js';
function rng(seed) {return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);}
for (const [difficulty, config] of Object.entries(SUDOKU_LEVELS)) {
  test(`${difficulty}: generated grids respect rows, columns, boxes and have one solution`, () => {
    const signatures = new Set();
    for (let seed = 1; seed <= 12; seed++) {
      const game = generateSudoku(difficulty, rng(seed));
      assert.equal(game.puzzle.length, config.size ** 2);
      assert.equal(isSudokuComplete(game.solution, game), true);
      assert.equal(isSudokuComplete(game.puzzle, game), false);
      assert.equal(findConflicts(game.puzzle, game).size, 0);
      assert.ok(game.puzzle.filter(n => n === 0).length >= config.size);
      assert.ok(game.puzzle.every((n, i) => n === 0 || n === game.solution[i]));
      assert.deepEqual(countSudokuSolutions(game.puzzle, game), {count: 1, exhausted: false});
      signatures.add(game.puzzle.join(','));
    }
    assert.equal(signatures.size, 12);
  });
}
test('duplicate values and out-of-range entries are rejected and input is not mutated', () => {
  const c = SUDOKU_LEVELS.low, blank = Array(36).fill(0);
  for (const other of [1, 6, 8]) {
    const values = [...blank]; values[0] = values[other] = 1;
    assert.ok(findConflicts(values, c).has(0)); assert.ok(findConflicts(values, c).has(other));
    assert.deepEqual(countSudokuSolutions(values, c), {count: 0, exhausted: false});
  }
  for (const bad of [-1, 7, 1.5, NaN, '1']) {const b = [...blank]; b[0] = bad; assert.equal(findConflicts(b, c).has(0), true);}
  const before = [...blank]; assert.equal(countSudokuSolutions(blank, c).count, 2); assert.deepEqual(blank, before);
  assert.equal(countSudokuSolutions(blank, c, 1).exhausted, true);
});
test('bad size, difficulty and randomness fail explicitly', () => {
  assert.throws(() => generateSudoku('missing'));
  assert.throws(() => generateSudoku('low', () => 1));
  assert.throws(() => findConflicts([], SUDOKU_LEVELS.low));
  assert.throws(() => countSudokuSolutions([], {}));
});
