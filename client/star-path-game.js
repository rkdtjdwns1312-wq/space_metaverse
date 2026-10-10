const LEVELS=[
  {stars:[20,12,4],rocks:[6,8,16,18]},
  {stars:[24,12,0],rocks:[6,8,16,18,22]},
  {stars:[20,14,4],rocks:[7,9,16,18]}
];
const adjacent=(a,b)=>Math.abs(Math.floor(a/5)-Math.floor(b/5))+Math.abs(a%5-b%5)===1;

export function createStarPathGame({board,setScore}={}){
  let level=0,path=[],nextStar=1,seconds=90,playing=false,finished=false,tick=null,advance=null;
  const root=document.createElement('section');root.className='star-path-game';
  const start=document.createElement('button');start.className='arcade-go';start.textContent='별길 시작하기';
  const help=document.createElement('p');help.className='star-path-help';help.textContent='빛나는 별을 1 → 2 → 3 순서로 이어 주세요. 옆 칸으로만 갈 수 있어요.';
  const grid=document.createElement('div');grid.className='star-path-grid';grid.setAttribute('aria-label','별길 5칸 격자');
  root.append(start,help,grid);board.append(root);
  const update=message=>setScore(`단계 ${Math.min(level+1,3)}/3 · ${seconds}초 남음${message?' · '+message:''}`);
  function draw(){
    const focused=grid.contains(document.activeElement)?document.activeElement.dataset.cell:null;
    const {stars,rocks}=LEVELS[level];grid.replaceChildren();
    for(let i=0;i<25;i++){
      const cell=document.createElement('button');cell.type='button';cell.className='star-path-cell';cell.dataset.cell=String(i);
      const mark=stars.indexOf(i),isRock=rocks.includes(i);
      cell.textContent=isRock?'◆':mark>=0?String(mark+1):path.includes(i)?'✦':'·';
      cell.setAttribute('aria-label',`${Math.floor(i/5)+1}행 ${i%5+1}열${isRock?' 바위':mark>=0?' 별 '+(mark+1):''}`);
      if(isRock)cell.classList.add('rock');
      cell.disabled=isRock||!playing;
      if(mark>=0)cell.classList.add('star');
      if(path.includes(i))cell.classList.add('path');
      if(path.at(-1)===i)cell.classList.add('head');
      cell.onclick=()=>choose(i);grid.append(cell);
    }
    if(playing){
      const nextFocus=grid.querySelector(`[data-cell="${focused??path.at(-1)}"]`);
      (nextFocus&&!nextFocus.disabled?nextFocus:grid.querySelector('.head'))?.focus({preventScroll:true});
    }
  }
  function finish(won){
    playing=false;finished=true;clearInterval(tick);clearTimeout(advance);grid.querySelectorAll('button').forEach(b=>b.disabled=true);
    setScore(won?`성공! 별길 3개 완성 · ${seconds}초 남음`:'게임 종료 · 다음에는 별길을 찾아봐요');
  }
  function choose(i){
    if(!playing||finished)return;
    const {stars,rocks}=LEVELS[level];if(rocks.includes(i))return;
    const last=path.at(-1);
    if(path.length>1&&i===path.at(-2)){path.pop();nextStar=stars.findIndex(s=>!path.includes(s));draw();update('한 칸 되돌렸어요');return;}
    if(path.includes(i)||!adjacent(last,i)){update('바로 옆 칸을 골라요');return;}
    const mark=stars.indexOf(i);
    if(mark>=0&&mark!==nextStar){update(`${nextStar+1}번 별부터 찾아요`);return;}
    path.push(i);if(mark===nextStar)nextStar++;
    draw();
    if(nextStar===stars.length){
      if(level===LEVELS.length-1){finish(true);return;}
      playing=false;update('좋아요! 다음 별길');
      advance=setTimeout(()=>{level++;path=[LEVELS[level].stars[0]];nextStar=1;playing=true;draw();update();},750);
    }else update();
  }
  start.onclick=()=>{
    clearInterval(tick);clearTimeout(advance);level=0;seconds=90;path=[LEVELS[0].stars[0]];nextStar=1;playing=true;finished=false;
    start.hidden=true;draw();update();
    tick=setInterval(()=>{if(finished)return;seconds--;if(seconds<=0)finish(false);else update();},1000);
  };
  path=[LEVELS[0].stars[0]];draw();setScore('시작 전 · 별길을 차례대로 이어 주세요');
  return {destroy(){clearInterval(tick);clearTimeout(advance);root.remove();}};
}
