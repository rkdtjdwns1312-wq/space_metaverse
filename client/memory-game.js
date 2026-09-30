import {createArcadeRanking} from './arcade-ranking.js';

const LEVELS=Object.freeze([
  Object.freeze({id:'high',name:'상',rows:6,columns:6}),
  Object.freeze({id:'medium',name:'중',rows:4,columns:6}),
  Object.freeze({id:'low',name:'하',rows:3,columns:4})
]);

const SYMBOLS=Object.freeze(['🌙','⭐','🪐','☄️','🌌','🌟','🛰️','🌠','🔭','✨','🛸','💫','🌍','🌞','🚀','👽','🌈','🌸']);

function randomIndex(random,size){
  const value=Number(random());
  if(!Number.isFinite(value))return 0;
  return Math.min(size-1,Math.max(0,Math.floor(value*size)));
}

export function createMemoryDeck(pairCount,random=Math.random){
  if(!Number.isInteger(pairCount)||pairCount<1||pairCount>SYMBOLS.length)throw new RangeError(`짝 수는 1~${SYMBOLS.length} 사이여야 합니다.`);
  const cards=SYMBOLS.slice(0,pairCount).flatMap(symbol=>[symbol,symbol]);
  for(let i=cards.length-1;i>0;i--){
    const j=randomIndex(random,i+1);
    [cards[i],cards[j]]=[cards[j],cards[i]];
  }
  return cards;
}

export function createMemoryGame({board,setScore=()=>{},toast=()=>{},random=Math.random,request,footer,subscribeRanking}={}){
  if(!board)throw new TypeError('board가 필요합니다.');
  const root=document.createElement('section');root.className='memory-game';root.setAttribute('aria-label','별자리 짝맞추기');
  const levelGroup=document.createElement('div');levelGroup.className='memory-levels';levelGroup.setAttribute('role','group');levelGroup.setAttribute('aria-label','난이도 선택');
  const startButton=document.createElement('button');startButton.type='button';startButton.className='memory-start';startButton.textContent='시작';startButton.disabled=true;
  const controls=document.createElement('div');controls.className='memory-controls';controls.append(levelGroup,startButton);
  const grid=document.createElement('div');grid.className='memory-grid';grid.setAttribute('aria-label','난이도를 선택하세요');
  root.append(controls,grid);board.replaceChildren(root);
  const rankingPanel=document.createElement('section');rankingPanel.id='memory-ranking-panel';rankingPanel.hidden=true;
  rankingPanel.innerHTML='<h3>우리 교실 상 난이도 TOP 10</h3><p>상 난이도에 성공한 기록만 남은 시간이 많은 순으로 보여요. 매주 월요일 0시 새로 시작해요.</p><ol id="memory-ranking"></ol>';
  root.append(rankingPanel);
  const rankingUI=request?createArcadeRanking({game:'memory',prefix:'memory',root,footer,request,subscribe:subscribeRanking,toast}):null;

  let level=null,cards=[],openCards=[],matched=0,locked=false,ended=false,deadline=0;
  let tickId=null,deadlineId=null,mismatchId=null,destroyed=false;
  let serverRun=null,generation=0;
  const cancelRun=()=>{if(serverRun)request('memory:cancel',{runId:serverRun.runId}).catch(()=>{});serverRun=null;generation++;};

  const clearRoundTimers=()=>{
    clearInterval(tickId);clearTimeout(deadlineId);clearTimeout(mismatchId);
    tickId=deadlineId=mismatchId=null;
  };
  const remainingSeconds=()=>Math.max(0,Math.ceil((deadline-performance.now())/1000));
  const updateScore=()=>setScore(`${matched}쌍 / ${cards.length/2}쌍 · 남은 시간 ${remainingSeconds()}초`);
  const finish=(won,officialRemaining)=>{
    if(ended||destroyed)return;
    ended=true;locked=true;clearRoundTimers();
    grid.querySelectorAll('button').forEach(card=>{card.disabled=true;});
    setScore(`${won?'성공':'실패'} · ${matched}쌍 / ${cards.length/2}쌍 · 남은 시간 ${won?(officialRemaining===undefined?remainingSeconds():(officialRemaining/1000).toFixed(2)):0}초`);
    toast(won?'짝을 모두 찾았어요!':'60초가 끝났어요. 다시 도전해 보세요.');
    startButton.disabled=false;startButton.textContent='다시 시작';
  };
  const checkDeadline=()=>{
    if(!ended&&deadline&&performance.now()>=deadline){finish(false);return true;}
    return ended;
  };
  const hideCard=card=>{
    card.dataset.state='hidden';card.setAttribute('aria-label',`${Number(card.dataset.index)+1}번 카드, 뒤집기 전`);
  };
  const revealCard=card=>{
    card.dataset.state='open';card.setAttribute('aria-label',`${Number(card.dataset.index)+1}번 카드, ${card.dataset.symbol}`);
  };
  const selectLevel=next=>{
    cancelRun();
    clearRoundTimers();level=next;cards=[];openCards=[];matched=0;locked=false;ended=false;deadline=0;
    for(const button of levelGroup.children)button.setAttribute('aria-pressed',String(button.dataset.level===level.id));
    grid.replaceChildren();grid.removeAttribute('data-rows');grid.removeAttribute('data-columns');grid.setAttribute('aria-label',`${level.rows}행 ${level.columns}열, 시작 전`);
    startButton.disabled=false;startButton.textContent='시작';
    setScore(`${level.name} · 시작 전`);
  };
  const start=async()=>{
    if(!level||destroyed)return;
    cancelRun();const version=generation;
    clearRoundTimers();cards=[];openCards=[];matched=0;locked=true;ended=false;grid.replaceChildren();startButton.disabled=true;
    const beganAt=performance.now();
    if(level.id==='high'&&request){
      try{
        const result=await request('memory:start',{level:'high'});
        if(destroyed||version!==generation){request('memory:cancel',{runId:result.runId}).catch(()=>{});return;}
        if(!result.runId)throw new Error('서버에서 게임을 시작하지 못했어요.');
        serverRun=result;cards=Array(36).fill('');
      }catch(error){if(!destroyed&&version===generation){startButton.disabled=false;setScore(error.message);}return;}
    }else cards=createMemoryDeck(level.rows*level.columns/2,random);
    locked=false;startButton.disabled=false;
    deadline=beganAt+60000;
    grid.replaceChildren();grid.dataset.rows=String(level.rows);grid.dataset.columns=String(level.columns);
    grid.style.setProperty('--memory-rows',String(level.rows));grid.style.setProperty('--memory-columns',String(level.columns));
    grid.setAttribute('aria-label',`${level.rows}행 ${level.columns}열 짝맞추기 카드`);
    cards.forEach((symbol,index)=>{
      const card=document.createElement('button');card.type='button';card.className='memory-card';card.dataset.index=String(index);card.dataset.symbol=symbol;
      const picture=document.createElement('span');picture.className='memory-picture';picture.setAttribute('aria-hidden','true');picture.textContent=symbol;card.append(picture);hideCard(card);
      card.addEventListener('click',async()=>{
        if(checkDeadline()||locked||card.disabled||card.dataset.state!=='hidden')return;
        if(serverRun){
          locked=true;
          try{
            const result=await request('memory:flip',{runId:serverRun.runId,step:serverRun.step,index});
            if(destroyed||version!==generation)return;
            if(result.done&&!result.won){serverRun=null;finish(false);return;}
            serverRun.step=result.step;card.dataset.symbol=result.symbol;picture.textContent=result.symbol;revealCard(card);
            if(result.match){
              for(const i of result.pair){const found=grid.children[i];found.dataset.state='matched';found.disabled=true;found.setAttribute('aria-label',`${i+1}번 카드, ${found.dataset.symbol}, 짝 찾음`);}
              matched++;
            }
            if(result.won){serverRun=null;ended=false;finish(true,result.remainingMs);rankingUI?.render(result);return;}
            if(ended)return;
            if(result.pair&&!result.match){
              mismatchId=setTimeout(()=>{if(ended||destroyed||version!==generation)return;for(const i of result.pair)hideCard(grid.children[i]);locked=false;},600);
            }else locked=false;
            updateScore();
          }catch(error){
            if(!destroyed&&version===generation){toast(error.message);finish(false);cancelRun();}
          }
          return;
        }
        revealCard(card);openCards.push(card);
        if(openCards.length<2)return;
        locked=true;const [first,second]=openCards;
        if(first.dataset.symbol===second.dataset.symbol){
          for(const matchedCard of openCards){matchedCard.dataset.state='matched';matchedCard.disabled=true;matchedCard.setAttribute('aria-label',`${Number(matchedCard.dataset.index)+1}번 카드, ${matchedCard.dataset.symbol}, 짝 찾음`);}
          openCards=[];matched++;locked=false;
          if(checkDeadline())return;
          if(matched===cards.length/2)finish(true);else updateScore();
          return;
        }
        mismatchId=setTimeout(()=>{
          mismatchId=null;if(ended||destroyed)return;
          for(const opened of openCards)hideCard(opened);
          openCards=[];locked=false;
        },600);
      });
      grid.append(card);
    });
    startButton.textContent='처음부터 다시';updateScore();
    tickId=setInterval(()=>{if(!checkDeadline())updateScore();},100);
    deadlineId=setTimeout(()=>finish(false),Math.max(0,deadline-performance.now()));
  };

  for(const item of LEVELS){
    const button=document.createElement('button');button.type='button';button.className='memory-level';button.dataset.level=item.id;button.setAttribute('aria-pressed','false');button.textContent=item.name;button.addEventListener('click',()=>selectLevel(item));levelGroup.append(button);
  }
  startButton.addEventListener('click',start);setScore('난이도를 선택하세요 · 시작 전');

  return {destroy(){if(destroyed)return;destroyed=true;cancelRun();clearRoundTimers();rankingUI?.destroy();root.remove();}};
}
