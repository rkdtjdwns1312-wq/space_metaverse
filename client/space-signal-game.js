import {createArcadeRanking} from './arcade-ranking.js';

const SIGNALS=[['달','☾'],['별','✦'],['보석','◇'],['태양','☀']];

export function createSpaceSignalGame({board,setScore,request,footer,subscribeRanking,onCue=()=>{},toast=()=>{}}={}){
  let round=0,sequence=[],lives=3,accepting=false,finished=false,runId=null;
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
  const rankingPanel=document.createElement('section');rankingPanel.id='signal-ranking-panel';rankingPanel.hidden=true;
  rankingPanel.innerHTML='<h3>이번 주 우주 신호 순위</h3><p>완성한 단계가 높은 순서, 같은 단계면 먼저 완성한 순서예요. 매주 월요일 0시 새로 시작해요.</p><ol id="signal-ranking"></ol>';
  root.append(start,help,cue,pad,rankingPanel);board.append(root);
  const rankingUI=createArcadeRanking({game:'signal',prefix:'signal',root,footer,request,subscribe:subscribeRanking,toast});
  const update=message=>setScore(`단계 ${round}/6 · 기회 ${lives}번${message?' · '+message:''}`);
  function end(won){
    finished=true;accepting=false;buttons.forEach(b=>b.disabled=true);
    setScore(won?'성공! 우주 신호 6단계 완성':'게임 종료 · 다시 도전해 봐요');
  }
  function showSequence(){
    if(finished)return;
    accepting=false;buttons.forEach(b=>b.disabled=true);cue.textContent='우주 신호를 보여 줄게요.';update('빛을 잘 보세요');
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
  async function choose(i){
    if(!accepting||finished)return;
    accepting=false;buttons.forEach(b=>b.disabled=true);
    const button=buttons[i];button.classList.add('lit');schedule(()=>button.classList.remove('lit'),220);
    try{const result=await request('signal:choose',{runId,signal:i});
      lives=result.lives;round=result.round;
      if(result.stageCleared)rankingUI.render({ranking:result.ranking});
      if(result.done){end(result.won);return;}
      if(result.sequence){sequence=result.sequence;update(result.correct?'잘했어요!':'다시 보여 줄게요');schedule(showSequence,result.correct?850:900);}
      else{accepting=true;buttons.forEach(b=>b.disabled=false);update('좋아요, 계속!');}
    }catch(error){cue.textContent=error.message;toast(error.message);end(false);}
  }
  start.onclick=async()=>{
    start.disabled=true;
    try{const result=await request('signal:start',{});
      runId=result.runId;round=result.round;lives=result.lives;sequence=result.sequence;finished=false;
      start.hidden=true;showSequence();
    }catch(error){cue.textContent=error.message;toast(error.message);start.disabled=false;}
  };
  setScore('시작 전 · 빛의 순서를 기억해요');
  return {destroy(){finished=true;for(const id of timers)clearTimeout(id);timers.clear();rankingUI.destroy();root.remove();}};
}
