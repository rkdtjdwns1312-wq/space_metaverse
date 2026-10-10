import {createArcadeRanking} from './arcade-ranking.js';

const COLORS=['','#a9daf7','#ffe2a3','#d7bef6','#aeead7','#f5c6da','#bbc9ff','#fbd6b3'];

export function createTetrisGame({board,setScore,request,footer,subscribeRanking,toast=()=>{}}={}){
  const root=document.createElement('section');root.className='tetris-game';
  root.innerHTML='<div class="tetris-top"><button id="tetris-start" class="arcade-go" type="button">별 테트리스 시작</button><p id="tetris-status" role="status">시작 버튼을 눌러요.</p></div><div class="tetris-play"><div id="tetris-grid" class="tetris-grid" role="img" aria-label="별 테트리스 10칸 20줄"></div><div class="tetris-side"><p id="tetris-lines">지운 줄 0</p><p id="tetris-speed">내려오는 속도 0.85초</p><p>시간이 지나면 새 블록이 더 빨리 나오고 내려와요.</p><div class="tetris-controls"><button type="button" data-move="left" aria-label="왼쪽">◀ 왼쪽</button><button type="button" data-move="rotate" aria-label="블록 돌리기">⟳ 돌리기</button><button type="button" data-move="right" aria-label="오른쪽">오른쪽 ▶</button></div><p class="tetris-key-help">키보드 A·D 또는 ←·→ 이동, F 또는 ↑·↓ 돌리기</p></div></div><section id="tetris-ranking-panel" hidden><h3>이번 주 별 테트리스 순위</h3><p>지운 줄이 많은 순서, 같은 줄 수면 먼저 완성한 순서예요. 월요일 0시 새로 시작해요.</p><ol id="tetris-ranking"></ol></section>';
  board.append(root);
  const $=selector=>root.querySelector(selector),grid=$('#tetris-grid'),buttons=[...root.querySelectorAll('[data-move]')];
  const rankingUI=createArcadeRanking({game:'tetris',prefix:'tetris',root,footer,request,subscribe:subscribeRanking,toast});
  const cells=Array.from({length:200},()=>{const cell=document.createElement('span');cell.className='tetris-cell';grid.append(cell);return cell;});
  let runId=null,active=true,busy=false,finalizing=false,poller=null,lastState=null;
  function paint(state){
    if(!active)return;lastState=state;
    const picture=state.board.flat();
    if(state.current)for(const [dx,dy] of state.current.cells){
      const x=state.current.x+dx,y=state.current.y+dy;if(x>=0&&x<10&&y>=0&&y<20)picture[y*10+x]=state.current.type+1;
    }
    for(let i=0;i<cells.length;i++){cells[i].style.setProperty('--block-color',COLORS[picture[i]]);cells[i].classList.toggle('filled',picture[i]>0);}
    $('#tetris-lines').textContent=`지운 줄 ${state.lines}`;
    $('#tetris-speed').textContent=`내려오는 속도 ${(state.speedMs/1000).toFixed(2)}초`;
    setScore(`지운 줄 ${state.lines} · ${Math.floor(state.elapsedMs/1000)}초 진행`);
    if(state.done&&!finalizing){finalizing=true;clearInterval(poller);poller=null;finish();}
  }
  async function finish(){
    try{
      const result=await request('tetris:finish',{runId});if(!active)return;
      rankingUI.render({ranking:result.ranking});
      $('#tetris-status').textContent=`게임 끝! ${result.lines}줄을 지웠어요.`;
      setScore(`게임 종료 · ${result.lines}줄 완성`);
    }catch(error){if(active)toast(error.message);}
    finally{runId=null;busy=false;buttons.forEach(button=>button.disabled=true);$('#tetris-start').hidden=false;$('#tetris-start').disabled=false;}
  }
  async function command(move){
    if(!runId||busy||finalizing)return;
    busy=true;
    try{const result=await request('tetris:move',{runId,move});paint(result);}
    catch(error){if(active)toast(error.message);}
    finally{busy=false;}
  }
  async function poll(){
    if(!runId||busy||finalizing)return;
    busy=true;
    try{paint(await request('tetris:state',{runId}));}
    catch(error){if(active)toast(error.message);}
    finally{busy=false;}
  }
  $('#tetris-start').onclick=async()=>{
    $('#tetris-start').disabled=true;
    try{
      const state=await request('tetris:start',{});if(!active)return;
      runId=state.runId;finalizing=false;paint(state);
      $('#tetris-status').textContent='줄을 가득 채워 지워 보세요!';
      $('#tetris-start').hidden=true;buttons.forEach(button=>button.disabled=false);
      poller=setInterval(poll,220);
    }catch(error){if(active){toast(error.message);$('#tetris-start').disabled=false;}}
  };
  for(const button of buttons){button.disabled=true;button.onclick=()=>command(button.dataset.move);}
  function onKeyDown(event){
    if(!active||!runId||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    const move=({a:'left',ArrowLeft:'left',d:'right',ArrowRight:'right',f:'rotate',ArrowUp:'rotate',ArrowDown:'rotate'})[event.key];
    if(move){event.preventDefault();command(move);}
  }
  document.addEventListener('keydown',onKeyDown);
  return {destroy(){active=false;clearInterval(poller);document.removeEventListener('keydown',onKeyDown);rankingUI.destroy();root.remove();}};
}
