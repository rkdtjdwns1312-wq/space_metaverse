import {randomUUID} from 'node:crypto';
import {generateSudoku,isSudokuComplete} from '../shared/sudoku.js';
import {ensure} from './rooms.js';

export function createSudokuRuns(){
  const runFor=(player,data)=>{
    const run=player.sudokuRun;ensure(run&&run.runId===data?.runId,'스도쿠를 다시 시작해 주세요.');
    ensure(Array.isArray(data.values)&&data.values.length===run.game.puzzle.length&&
      data.values.every((value,index)=>Number.isSafeInteger(value)&&value>=0&&value<=run.game.size&&
        (!run.game.puzzle[index]||value===run.game.puzzle[index])),'스도쿠 판을 확인해 주세요.');
    return run;
  };
  return {
    start(player,difficulty){
      const game=generateSudoku(difficulty),runId=randomUUID();player.sudokuRun={runId,game};
      const {solution,...publicGame}=game;return {runId,...publicGame};
    },
    check(player,data){
      const {game}=runFor(player,data);
      return {incorrectIndices:data.values.flatMap((value,index)=>value&&!game.puzzle[index]&&value!==game.solution[index]?[index]:[])};
    },
    complete(player,data){
      const {game}=runFor(player,data);
      ensure(isSudokuComplete(data.values,game)&&data.values.every((value,index)=>value===game.solution[index]),'아직 맞지 않는 칸이 있어요. 다시 살펴봐요.');
      delete player.sudokuRun;return {won:true,difficulty:game.difficulty};
    }
  };
}
