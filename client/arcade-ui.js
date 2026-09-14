const GAMES={memory:{title:'별자리 짝맞추기',instructions:'카드를 두 장씩 눌러 같은 별자리를 찾아요.',score:'0쌍 / 4쌍'},sequence:{title:'별빛 순서 잇기',instructions:'1부터 9까지 순서대로 눌러요.',score:'0 / 9'},stars:{title:'반짝별 누르기',instructions:'별이 나타나는 칸을 열 번 눌러요. 서두르지 않아도 괜찮아요.',score:'0 / 10'},addition:{title:'우주 덧셈',instructions:'두 수를 더한 답을 골라요.',score:'1 / 5'},reaction:{title:'초록 별 반응 게임',instructions:'시작을 누르고 초록 버튼이 나타나면 가장 빠르게 눌러요.',score:'1 / 3'}};

export function createArcadeUI({stop=()=>{},toast=()=>{}}={}){
  const dialog=document.createElement('dialog');dialog.id='arcade-dialog';dialog.setAttribute('aria-labelledby','arcade-title');
  const header=document.createElement('header'),title=document.createElement('h2');title.id='arcade-title';
  const closeBtn=document.createElement('button');closeBtn.id='arcade-close';closeBtn.type='button';closeBtn.textContent='닫기';header.append(title,closeBtn);
  const instructions=document.createElement('p');instructions.id='arcade-instructions';const score=document.createElement('p');score.id='arcade-score';score.setAttribute('aria-live','polite');
  const board=document.createElement('div');board.id='arcade-board';board.setAttribute('role','region');board.setAttribute('aria-label','미니게임판');
  const restart=document.createElement('button');restart.id='arcade-restart';restart.type='button';restart.textContent='다시하기';dialog.append(header,instructions,score,board,restart);document.body.append(dialog);
  let timers=new Set(),intervals=new Set(),rafs=new Set(),generation=0,current=null;
  const later=(fn,ms,g=generation)=>{const id=setTimeout(()=>{timers.delete(id);if(g===generation&&dialog.open)fn()},ms);timers.add(id);return id};
  const cleanup=()=>{generation++;for(const id of timers)clearTimeout(id);for(const id of intervals)clearInterval(id);for(const id of rafs)cancelAnimationFrame(id);timers.clear();intervals.clear();rafs.clear();board.replaceChildren()};
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
  const button=(text,index,fn)=>{const b=el('button',text);b.type='button';if(index!==undefined)b.dataset.index=String(index);b.addEventListener('click',fn);return b};
  function setScore(text){score.textContent=text}
  function memory(){let cards=['🌙','🌙','⭐','⭐','🪐','🪐','☄️','☄️'].sort(()=>Math.random()-.5),open=[],matched=0,locked=false;
    cards.forEach((v,i)=>{const b=button('카드 '+(i+1),i,()=>{if(locked||b.dataset.state==='matched'||open.includes(i))return;b.textContent=v;b.dataset.state='open';open.push(i);if(open.length===2){locked=true;const [a,c]=open;if(cards[a]===cards[c]){[a,c].forEach(x=>{board.children[x].dataset.state='matched';board.children[x].disabled=true});matched++;open=[];locked=false;setScore(`${matched}쌍 / 4쌍`);if(matched===4)toast('짝을 모두 찾았어요!')}else later(()=>{[a,c].forEach(x=>{board.children[x].textContent='카드 '+(x+1);board.children[x].dataset.state='hidden'});open=[];locked=false},600)}});b.dataset.state='hidden';board.append(b)})}
  function sequence(){const nums=[1,2,3,4,5,6,7,8,9].sort(()=>Math.random()-.5);let next=1;nums.forEach((n,i)=>board.append(button(String(n),i,e=>{if(n!==next){toast('순서대로 눌러 보세요.');return}e.currentTarget.disabled=true;e.currentTarget.dataset.state='done';next++;setScore(`${next-1} / 9`);if(next===10)toast('순서 성공!')})))}
  function stars(){let target=-1,count=0;const draw=()=>{board.replaceChildren();target=Math.floor(Math.random()*9);for(let i=0;i<9;i++)board.append(button(i===target?'⭐':'',i,()=>{if(i!==target)return;count++;setScore(`${count} / 10`);if(count===10){board.replaceChildren();toast('별빛을 열 개 모았어요!')}else draw()}))};draw()}
  function addition(){let q=0,used=new Set();const next=()=>{if(q===5){board.replaceChildren();toast('다섯 문제를 모두 풀었어요!');return}let a=Math.floor(Math.random()*11),b=Math.floor(Math.random()*11),answer=a+b,choices=new Set([answer]);while(choices.size<4){const x=Math.floor(Math.random()*21);if(!used.has(x))choices.add(x)}used.add(answer);q++;setScore(`${q} / 5`);board.replaceChildren(el('p',`${a} + ${b} = ?`));[...choices].sort(()=>Math.random()-.5).forEach(x=>board.append(button(String(x),x,()=>{if(x!==answer){toast('다시 생각해 봐요!');return}next()})))};next()}
  function reaction(){
    let round=0,start=0,best=Infinity;
    const begin=()=>{
      start=0;const target=button('기다려요…',0,()=>{
        if(!start){instructions.textContent='아직이에요! 초록색으로 바뀌면 눌러요.';return;}
        best=Math.min(best,Math.round(performance.now()-start));start=0;round++;
        setScore(`${round} / 3 · 가장 빠른 기록 ${best}ms`);
        if(round===3){board.replaceChildren(el('p','세 번 모두 성공했어요!'));return;}begin();
      });target.dataset.state='waiting';board.replaceChildren(target);
      later(()=>{target.textContent='지금 눌러요!';target.className='arcade-go';target.dataset.state='ready';start=performance.now();},1000+Math.random()*2000);
    };
    board.append(button('시작',0,begin));
  }
  function render(id){const g=GAMES[id];title.textContent=g.title;instructions.textContent=g.instructions;setScore(g.score);board.replaceChildren();({memory,sequence,stars,addition,reaction}[id])()}
  function close(){cleanup();if(dialog.open)dialog.close();stop()}
  closeBtn.onclick=close;restart.onclick=()=>{cleanup();render(current)};dialog.addEventListener('cancel',e=>{e.preventDefault();close()});dialog.addEventListener('close',cleanup);
  return {open(gameId){if(!GAMES[gameId])return;stop();cleanup();current=gameId;render(gameId);if(!dialog.open)dialog.showModal()}};
}
