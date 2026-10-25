import {createArcadeRanking} from './arcade-ranking.js';

// Each signal has a distinct silhouette as well as a colour, so the order is
// recognisable even before a child learns the names of the four symbols.
const SIGNALS=[
  ['달',`<svg viewBox="0 0 72 72" aria-hidden="true" focusable="false"><defs><linearGradient id="signal-moon" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffdf2"/><stop offset=".45" stop-color="#a9e9ff"/><stop offset="1" stop-color="#4289e7"/></linearGradient></defs><path d="M32 8C19 12 11 23 11 36c0 15 12 27 27 27 10 0 19-5 24-14-16 6-35-1-40-17-3-9 1-18 10-24Z" fill="#163e80" stroke="#e6f8ff" stroke-width="2.5" stroke-linejoin="round"/><path d="M33 11C20 15 14 25 14 36c0 13 11 24 24 24 7 0 13-3 18-8-17 2-31-6-36-20-2-8 2-16 13-21Z" fill="url(#signal-moon)"/><path d="M22 43c4 9 13 13 22 12" fill="none" stroke="#fffef4" stroke-width="3" stroke-linecap="round"/><path d="m49 12 1.5 4.5L55 18l-4.5 1.5L49 24l-1.5-4.5L43 18l4.5-1.5Z" fill="#fff7c7"/><circle cx="59" cy="32" r="2" fill="#bceaff"/></svg>`],
  ['별',`<svg viewBox="0 0 72 72" aria-hidden="true" focusable="false"><defs><linearGradient id="signal-star" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff4cd"/><stop offset=".5" stop-color="#e7a6ff"/><stop offset="1" stop-color="#8b50d1"/></linearGradient></defs><path d="M36 5 44 26l22 1-17 14 6 22-19-12-19 12 6-22L6 27l22-1Z" fill="#56308e" stroke="#fff0c8" stroke-width="2.5" stroke-linejoin="round"/><path d="M36 9 43 29l18 1-15 12 5 17-15-10-15 10 5-17-15-12 18-1Z" fill="url(#signal-star)"/><path d="M36 10v39M14 30l22 19 22-19" fill="none" stroke="#fff4dc" stroke-opacity=".75" stroke-width="2" stroke-linejoin="round"/><circle cx="36" cy="34" r="5" fill="#fff9db"/><circle cx="36" cy="34" r="2" fill="#fff"/></svg>`],
  ['보석',`<svg viewBox="0 0 72 72" aria-hidden="true" focusable="false"><defs><linearGradient id="signal-gem" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e4fff7"/><stop offset=".45" stop-color="#61e4c4"/><stop offset="1" stop-color="#148c99"/></linearGradient></defs><path d="m36 5 23 17-3 26-20 19-20-19-3-26Z" fill="#086875" stroke="#f4e9bc" stroke-width="2.5" stroke-linejoin="round"/><path d="m36 9 19 15-3 22-16 16-16-16-3-22Z" fill="url(#signal-gem)"/><path d="M17 24h38L36 62 17 24ZM36 9 27 24l9 38 9-38Z" fill="none" stroke="#e5fff2" stroke-opacity=".82" stroke-width="2" stroke-linejoin="round"/><path d="m36 10-9 14h18Z" fill="#f1fff6"/><path d="m20 29 7-5 5 16Z" fill="#b8fff0" fill-opacity=".85"/><path d="m45 24 7 5-12 11Z" fill="#087f91" fill-opacity=".45"/></svg>`],
  ['태양',`<svg viewBox="0 0 72 72" aria-hidden="true" focusable="false"><defs><radialGradient id="signal-sun"><stop stop-color="#fff9be"/><stop offset=".6" stop-color="#ffc65a"/><stop offset="1" stop-color="#f07832"/></radialGradient></defs><path d="M36 3 42 17 53 7 53 22 67 18 58 31 70 36 58 42 67 55 52 51 53 66 42 56 36 70 30 56 19 66 19 51 5 55 14 42 2 36 14 31 5 18 19 22 19 7 30 17Z" fill="#d6752d" stroke="#fff2bf" stroke-width="2" stroke-linejoin="round"/><path d="M36 7 41 22 51 13 50 26 61 23 54 34 65 36 54 40 61 50 49 47 50 59 41 51 36 64 31 51 22 59 23 47 11 50 18 40 7 36 18 34 11 23 22 26 21 13 31 22Z" fill="#ffcb61"/><circle cx="36" cy="36" r="20" fill="#9b4d24" stroke="#ffe9a0" stroke-width="2"/><circle cx="36" cy="36" r="17" fill="url(#signal-sun)"/><path d="M23 35c2-8 7-13 14-14" fill="none" stroke="#fffce8" stroke-width="3" stroke-linecap="round"/><circle cx="36" cy="36" r="8" fill="#ffed9b" fill-opacity=".55"/></svg>`]
];

export function createSpaceSignalGame({board,setScore,request,footer,subscribeRanking,onCue=()=>{},toast=()=>{}}={}){
  let round=0,sequence=[],lives=3,accepting=false,finished=false,runId=null;
  const timers=new Set();
  const schedule=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);};
  const root=document.createElement('section');root.className='space-signal-game';
  const start=document.createElement('button');start.className='arcade-go';start.textContent='우주 신호 시작하기';
  const help=document.createElement('p');help.textContent='빛나는 순서를 보고 그대로 눌러요. 틀려도 두 번 더 도전할 수 있어요.';
  const cue=document.createElement('p');cue.className='space-signal-cue';cue.setAttribute('role','status');cue.setAttribute('aria-live','assertive');
  const pad=document.createElement('div');pad.className='space-signal-pad';pad.setAttribute('aria-label','우주 신호 네 칸');
  const buttons=SIGNALS.map(([name,art],i)=>{
    const button=document.createElement('button');button.type='button';button.className='space-signal-cell';button.dataset.signal=String(i);
    button.innerHTML=`<span class="space-signal-art">${art}</span><span class="space-signal-name">${name}</span>`;
    button.setAttribute('aria-label',`${i+1}번 ${name}`);button.disabled=true;button.onclick=()=>choose(i);pad.append(button);return button;
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
