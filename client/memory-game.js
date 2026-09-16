const LEVELS=Object.freeze([
  Object.freeze({id:'low',name:'하',rows:3,columns:4}),
  Object.freeze({id:'medium',name:'중',rows:4,columns:6}),
  Object.freeze({id:'high',name:'상',rows:6,columns:6})
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

export function createMemoryGame({board,setScore=()=>{},toast=()=>{},random=Math.random}={}){
  if(!board)throw new TypeError('board가 필요합니다.');
  const root=document.createElement('section');root.className='memory-game';root.setAttribute('aria-label','별자리 짝맞추기');
  const levelGroup=document.createElement('div');levelGroup.className='memory-levels';levelGroup.setAttribute('role','group');levelGroup.setAttribute('aria-label','난이도 선택');
  const startButton=document.createElement('button');startButton.type='button';startButton.className='memory-start';startButton.textContent='시작';startButton.disabled=true;
  const controls=document.createElement('div');controls.className='memory-controls';controls.append(levelGroup,startButton);
  const grid=document.createElement('div');grid.className='memory-grid';grid.setAttribute('aria-label','난이도를 선택하세요');
  root.append(controls,grid);board.replaceChildren(root);

  let level=null,cards=[],openCards=[],matched=0,locked=false,ended=false,deadline=0;
  let tickId=null,deadlineId=null,mismatchId=null,destroyed=false;

  const clearRoundTimers=()=>{
    clearInterval(tickId);clearTimeout(deadlineId);clearTimeout(mismatchId);
    tickId=deadlineId=mismatchId=null;
  };
  const remainingSeconds=()=>Math.max(0,Math.ceil((deadline-performance.now())/1000));
  const updateScore=()=>setScore(`${matched}쌍 / ${cards.length/2}쌍 · 남은 시간 ${remainingSeconds()}초`);
  const finish=won=>{
    if(ended||destroyed)return;
    ended=true;locked=true;clearRoundTimers();
    grid.querySelectorAll('button').forEach(card=>{card.disabled=true;});
    setScore(`${won?'성공':'실패'} · ${matched}쌍 / ${cards.length/2}쌍 · 남은 시간 ${won?remainingSeconds():0}초`);
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
    clearRoundTimers();level=next;cards=[];openCards=[];matched=0;locked=false;ended=false;deadline=0;
    for(const button of levelGroup.children)button.setAttribute('aria-pressed',String(button.dataset.level===level.id));
    grid.replaceChildren();grid.removeAttribute('data-rows');grid.removeAttribute('data-columns');grid.setAttribute('aria-label',`${level.rows}행 ${level.columns}열, 시작 전`);
    startButton.disabled=false;startButton.textContent='시작';
    setScore(`${level.name} · 시작 전`);
  };
  const start=()=>{
    if(!level||destroyed)return;
    clearRoundTimers();cards=createMemoryDeck(level.rows*level.columns/2,random);openCards=[];matched=0;locked=false;ended=false;
    deadline=performance.now()+60000;
    grid.replaceChildren();grid.dataset.rows=String(level.rows);grid.dataset.columns=String(level.columns);
    grid.style.setProperty('--memory-rows',String(level.rows));grid.style.setProperty('--memory-columns',String(level.columns));
    grid.setAttribute('aria-label',`${level.rows}행 ${level.columns}열 짝맞추기 카드`);
    cards.forEach((symbol,index)=>{
      const card=document.createElement('button');card.type='button';card.className='memory-card';card.dataset.index=String(index);card.dataset.symbol=symbol;
      const picture=document.createElement('span');picture.className='memory-picture';picture.setAttribute('aria-hidden','true');picture.textContent=symbol;card.append(picture);hideCard(card);
      card.addEventListener('click',()=>{
        if(checkDeadline()||locked||card.disabled||card.dataset.state!=='hidden')return;
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
    deadlineId=setTimeout(()=>finish(false),60000);
  };

  for(const item of LEVELS){
    const button=document.createElement('button');button.type='button';button.className='memory-level';button.dataset.level=item.id;button.setAttribute('aria-pressed','false');button.textContent=item.name;button.addEventListener('click',()=>selectLevel(item));levelGroup.append(button);
  }
  startButton.addEventListener('click',start);setScore('난이도를 선택하세요 · 시작 전');

  return {destroy(){if(destroyed)return;destroyed=true;clearRoundTimers();root.remove();}};
}
