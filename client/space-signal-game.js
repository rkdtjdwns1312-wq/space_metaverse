const SIGNALS=[['달','☾'],['별','✦'],['보석','◇'],['태양','☀']];

export function createSpaceSignalGame({board,setScore,random=Math.random,onCue=()=>{}}={}){
  let round=0,sequence=[],index=0,lives=3,accepting=false,finished=false;
  const timers=new Set();
  const schedule=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);};
  const root=document.createElement('section');root.className='space-signal-game';
  const start=document.createElement('button');start.className='arcade-go';start.textContent='우주 신호 시작하기';
  const help=document.createElement('p');help.textContent='빛나는 순서를 보고 그대로 눌러요. 틀려도 두 번 더 도전할 수 있어요.';
  const cue=document.createElement('p');cue.className='space-signal-cue';cue.setAttribute('role','status');cue.setAttribute('aria-live','assertive');
  const pad=document.createElement('div');pad.className='space-signal-pad';pad.setAttribute('aria-label','우주 신호 네 칸');
  const buttons=SIGNALS.map(([name,symbol],i)=>{
    const button=document.createElement('button');button.type='button';button.className='space-signal-cell';button.dataset.signal=String(i);
    button.textContent=symbol;button.setAttribute('aria-label',`${i+1}번 ${name}`);button.disabled=true;button.onclick=()=>choose(i);pad.append(button);return button;
  });
  root.append(start,help,cue,pad);board.append(root);
  const update=message=>setScore(`단계 ${round}/6 · 기회 ${lives}번${message?' · '+message:''}`);
  function end(won){
    finished=true;accepting=false;buttons.forEach(b=>b.disabled=true);
    setScore(won?'성공! 우주 신호 6단계 완성':'게임 종료 · 다시 도전해 봐요');
  }
  function showSequence(){
    if(finished)return;
    accepting=false;index=0;buttons.forEach(b=>b.disabled=true);cue.textContent='우주 신호를 보여 줄게요.';update('빛을 잘 보세요');
    let current=0;
    const next=()=>{
      if(finished)return;
      if(current>=sequence.length){accepting=true;buttons.forEach(b=>b.disabled=false);cue.textContent='방금 들은 순서대로 눌러요.';update('순서대로 누르세요');return;}
      const signalIndex=sequence[current++],button=buttons[signalIndex];
      button.classList.add('lit');cue.textContent=`${current}번째 신호: ${SIGNALS[signalIndex][0]}`;onCue(signalIndex);
      schedule(()=>{button.classList.remove('lit');schedule(next,240);},490);
    };
    schedule(next,600);
  }
  function choose(i){
    if(!accepting||finished)return;
    const button=buttons[i];button.classList.add('lit');schedule(()=>button.classList.remove('lit'),220);
    if(i!==sequence[index]){
      lives--;accepting=false;buttons.forEach(b=>b.disabled=true);
      if(lives===0){end(false);return;}
      update('다시 보여 줄게요');schedule(showSequence,900);return;
    }
    index++;
    if(index===sequence.length){
      accepting=false;buttons.forEach(b=>b.disabled=true);
      if(round===6){end(true);return;}
      round++;sequence.push(Math.min(3,Math.floor(random()*4)));update('잘했어요!');schedule(showSequence,850);
    }else update('좋아요, 계속!');
  }
  start.onclick=()=>{start.hidden=true;round=1;lives=3;finished=false;sequence=[Math.min(3,Math.floor(random()*4)),Math.min(3,Math.floor(random()*4))];showSequence();};
  setScore('시작 전 · 빛의 순서를 기억해요');
  return {destroy(){finished=true;for(const id of timers)clearTimeout(id);timers.clear();root.remove();}};
}
