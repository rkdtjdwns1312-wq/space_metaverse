import {createMemoryGame} from './memory-game.js';
import {createBaseballGame} from './baseball-game.js';
import {createTetrisGame} from './tetris-game.js';
import {createSudokuGame} from './sudoku-game.js';
import {createDodgeGame} from './dodge-game.js';
import {createStarPathGame} from './star-path-game.js';
import {createSpaceSignalGame} from './space-signal-game.js';

const GAMES={
  memory:{title:'별 그림 짝 맞추기',instructions:'난이도를 고른 뒤 시작을 눌러요. 60초 안에 같은 그림을 찾아요.',score:'난이도를 선택하세요 · 시작 전'},
  baseball:{title:'숫자야구',instructions:'숫자 질문과 정답 도전을 합쳐 20번 안에 맞혀요.',score:'난이도를 선택하세요 · 시작 전'},
  tetris:{title:'별 테트리스',instructions:'파스텔 별 블록을 좌우로 움직이고 돌려서 가로줄을 채워요.',score:''},
  sudoku:{title:'별빛 스도쿠',instructions:'가로·세로·굵은 테두리 안에 같은 숫자가 겹치지 않게 빈칸을 채워요.',score:''},
  dodge:{title:'별 피하기',instructions:'움직여서 날아오는 별을 피하고 오래 살아남아요.',score:''},
  path:{title:'별 길 한번에 그리기',instructions:'한 선을 두 번 쓰지 않고 모든 선을 이어 한붓그리기를 완성해요.',score:''},
  signal:{title:'우주 신호 따라하기',instructions:'네 가지 빛이 반짝이는 순서를 기억하고 따라 눌러요.',score:''}
};

export function createArcadeUI({
  stop=()=>{},toast=()=>{},request=()=>Promise.resolve({}),subscribeTetrisRanking=()=>()=>{},
  sendDodgeInput=()=>{},subscribeDodgeState=()=>()=>{},subscribeDodgeRanking=()=>()=>{},subscribeMemoryRanking=()=>()=>{},subscribeSignalRanking=()=>()=>{},
  onSound=()=>{}
}={}){
  const dialog=document.createElement('dialog');dialog.id='arcade-dialog';dialog.setAttribute('aria-labelledby','arcade-title');
  const header=document.createElement('header'),title=document.createElement('h2');title.id='arcade-title';
  const closeButton=document.createElement('button');closeButton.id='arcade-close';closeButton.type='button';closeButton.textContent='닫기';header.append(title);
  const footer=document.createElement('footer');footer.className='arcade-footer';
  const rankingActions=document.createElement('div');rankingActions.className='arcade-ranking-actions';footer.append(rankingActions,closeButton);
  const instructions=document.createElement('p');instructions.id='arcade-instructions';
  const score=document.createElement('p');score.id='arcade-score';score.setAttribute('aria-live','polite');
  const board=document.createElement('div');board.id='arcade-board';board.setAttribute('role','region');board.setAttribute('aria-label','미니게임판');
  const restartButton=document.createElement('button');restartButton.id='arcade-restart';restartButton.type='button';restartButton.textContent='다시하기';
  dialog.append(header,instructions,score,board,restartButton,footer);document.body.append(dialog);

  let current=null,activeGame=null;
  let lastOutcome='';
  const setScore=text=>{
    score.textContent=text;
    const outcome=/성공|정답|완성|승리/.test(text)?'win':/실패|패배|게임 종료/.test(text)?'lose':'';
    if(outcome&&outcome!==lastOutcome)onSound(current,outcome);
    if(outcome)lastOutcome=outcome;
  };
  const cleanup=()=>{activeGame?.destroy();activeGame=null;board.replaceChildren();};
  const factories={
    memory:()=>createMemoryGame({board,setScore,toast,request,footer:rankingActions,subscribeRanking:subscribeMemoryRanking}),
    baseball:()=>createBaseballGame({board,setScore,toast,request}),
    tetris:()=>createTetrisGame({board,setScore,request,subscribeRanking:subscribeTetrisRanking,toast,footer:rankingActions}),
    sudoku:()=>createSudokuGame({board,request,toast}),
    dodge:()=>createDodgeGame({board,request,sendInput:sendDodgeInput,subscribeState:subscribeDodgeState,subscribeRanking:subscribeDodgeRanking,toast,footer:rankingActions}),
    path:()=>createStarPathGame({board,setScore}),
    signal:()=>createSpaceSignalGame({board,setScore,request,footer:rankingActions,subscribeRanking:subscribeSignalRanking,toast,onCue:index=>onSound('signal','cue',index)})
  };
  board.addEventListener('click',event=>{if(event.target.closest('button,[role="button"],.cell,.card'))onSound(current,'move');});
  board.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')onSound(current,'move');});
  const render=id=>{
    lastOutcome='';
    const game=GAMES[id];title.textContent=game.title;instructions.textContent=game.instructions;setScore(game.score);board.replaceChildren();
    activeGame=factories[id]();
  };
  const close=()=>{cleanup();if(dialog.open)dialog.close();stop();};

  closeButton.addEventListener('click',close);
  restartButton.addEventListener('click',()=>{onSound(current,'start');cleanup();render(current);});
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',cleanup);

  return {open(gameId){if(!GAMES[gameId])return;stop();cleanup();current=gameId;onSound(current,'start');render(gameId);if(!dialog.open)dialog.showModal();}};
}
