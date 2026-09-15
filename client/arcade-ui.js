import {createMemoryGame} from './memory-game.js';
import {createBaseballGame} from './baseball-game.js';
import {createStarGame} from './star-game.js';
import {createMathGame} from './math-game.js';
import {createDodgeGame} from './dodge-game.js';

const GAMES={
  memory:{title:'별 그림 짝 맞추기',instructions:'난이도를 고른 뒤 시작을 눌러요. 60초 안에 같은 그림을 찾아요.',score:'난이도를 선택하세요 · 시작 전'},
  baseball:{title:'숫자야구',instructions:'숫자 질문과 정답 도전을 합쳐 20번 안에 맞혀요.',score:'난이도를 선택하세요 · 시작 전'},
  stars:{title:'반짝별 찾기',instructions:'4×4 칸에서 별을 열 번 찾아요. 기록은 우리 교실에서 함께 봐요.',score:''},
  addition:{title:'숫자놀이터',instructions:'연산과 난이도를 고르고 문제를 풀어요.',score:''},
  dodge:{title:'별 피하기',instructions:'움직여서 날아오는 별을 피하고 오래 살아남아요.',score:''}
};

export function createArcadeUI({
  stop=()=>{},toast=()=>{},request=()=>Promise.resolve({}),subscribeStarRanking=()=>()=>{},
  sendDodgeInput=()=>{},subscribeDodgeState=()=>()=>{},subscribeDodgeRanking=()=>()=>{}
}={}){
  const dialog=document.createElement('dialog');dialog.id='arcade-dialog';dialog.setAttribute('aria-labelledby','arcade-title');
  const header=document.createElement('header'),title=document.createElement('h2');title.id='arcade-title';
  const closeButton=document.createElement('button');closeButton.id='arcade-close';closeButton.type='button';closeButton.textContent='닫기';header.append(title,closeButton);
  const instructions=document.createElement('p');instructions.id='arcade-instructions';
  const score=document.createElement('p');score.id='arcade-score';score.setAttribute('aria-live','polite');
  const board=document.createElement('div');board.id='arcade-board';board.setAttribute('role','region');board.setAttribute('aria-label','미니게임판');
  const restartButton=document.createElement('button');restartButton.id='arcade-restart';restartButton.type='button';restartButton.textContent='다시하기';
  dialog.append(header,instructions,score,board,restartButton);document.body.append(dialog);

  let current=null,activeGame=null;
  const setScore=text=>{score.textContent=text;};
  const cleanup=()=>{activeGame?.destroy();activeGame=null;board.replaceChildren();};
  const factories={
    memory:()=>createMemoryGame({board,setScore,toast}),
    baseball:()=>createBaseballGame({board,setScore,toast}),
    stars:()=>createStarGame({board,request,subscribeStarRanking,toast}),
    addition:()=>createMathGame({board,toast}),
    dodge:()=>createDodgeGame({board,request,sendInput:sendDodgeInput,subscribeState:subscribeDodgeState,subscribeRanking:subscribeDodgeRanking,toast})
  };
  const render=id=>{
    const game=GAMES[id];title.textContent=game.title;instructions.textContent=game.instructions;setScore(game.score);board.replaceChildren();
    activeGame=factories[id]();
  };
  const close=()=>{cleanup();if(dialog.open)dialog.close();stop();};

  closeButton.addEventListener('click',close);
  restartButton.addEventListener('click',()=>{cleanup();render(current);});
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',cleanup);

  return {open(gameId){if(!GAMES[gameId])return;stop();cleanup();current=gameId;render(gameId);if(!dialog.open)dialog.showModal();}};
}
