const WIDTH=600,HEIGHT=420,INPUT_INTERVAL_MS=100;

export function createDodgeGame({board,request,sendInput,subscribeState,subscribeRanking,toast=()=>{}}={}){
  if(!board)throw new TypeError('board가 필요합니다.');
  if(typeof request!=='function'||typeof sendInput!=='function')throw new TypeError('별 피하기 연결 함수가 필요합니다.');
  const stylesheet=document.head.querySelector('link[href="./dodge-game.css"]')||document.createElement('link');
  const ownsStylesheet=!stylesheet.isConnected;
  if(ownsStylesheet){stylesheet.rel='stylesheet';stylesheet.href='./dodge-game.css';document.head.append(stylesheet);}

  const root=document.createElement('section');root.className='dodge-game';root.setAttribute('aria-label','별 피하기');
  root.innerHTML=`
    <div class="dodge-toolbar">
      <button type="button" id="dodge-start">시작</button>
      <button type="button" id="dodge-ranking-toggle" aria-expanded="false">랭킹 보기</button>
      <strong id="dodge-stopwatch" aria-live="off">0.00초</strong>
    </div>
    <p class="dodge-help">방향키·WASD 또는 화면 속 소행성을 손가락으로 끌어 별을 피해요.</p>
    <canvas id="dodge-canvas" width="${WIDTH}" height="${HEIGHT}" tabindex="0" aria-label="600×420 별 피하기 경기장"></canvas>
    <p id="dodge-status" role="status">시작을 누르면 별이 사방에서 날아와요.</p>
    <section id="dodge-ranking-panel" class="dodge-ranking" hidden aria-label="별 피하기 주간 순위">
      <h3>우리 교실 주간 생존 TOP 10</h3>
      <p>매주 월요일 0시 새로 시작해요.</p>
      <ol id="dodge-ranking"></ol>
    </section>`;
  board.replaceChildren(root);board.classList.add('dodge-game-host');
  const find=id=>root.querySelector('#dodge-'+id),canvas=find('canvas'),context=canvas.getContext('2d');
  const startButton=find('start'),rankingButton=find('ranking-toggle'),rankingPanel=find('ranking-panel');
  let alive=true,running=false,runId=null,state=null,stateReceivedAt=0,frame=0,pointerId=null,touchTarget=null;
  const keys=new Set(),keyDirections={ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1],ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0]};

  function normalized(x,y){const length=Math.hypot(x,y);return length>1?{x:x/length,y:y/length}:{x,y};}
  function direction(){
    let x=0,y=0;for(const code of keys){const part=keyDirections[code];if(part){x+=part[0];y+=part[1];}}
    if(touchTarget&&state?.player){x+=touchTarget.x-state.player.x;y+=touchTarget.y-state.player.y;const distance=Math.hypot(x,y);if(distance<6)return {x:0,y:0};}
    return normalized(x,y);
  }
  function send(){if(!alive||!running||!runId)return;try{sendInput({runId,...direction()});}catch(error){toast(error.message);}}
  function stopInput(){keys.clear();touchTarget=null;pointerId=null;if(running&&runId){try{sendInput({runId,x:0,y:0});}catch{}}}

  function starPath(x,y,radius){
    context.beginPath();
    for(let i=0;i<10;i++){const angle=-Math.PI/2+i*Math.PI/5,r=i%2===0?radius:radius*.45;const px=x+Math.cos(angle)*r,py=y+Math.sin(angle)*r;i?context.lineTo(px,py):context.moveTo(px,py);}
    context.closePath();
  }
  function draw(){
    if(!alive)return;
    const gradient=context.createLinearGradient(0,0,WIDTH,HEIGHT);gradient.addColorStop(0,'#171233');gradient.addColorStop(1,'#382b68');context.fillStyle=gradient;context.fillRect(0,0,WIDTH,HEIGHT);
    context.fillStyle='#ffffff55';for(let i=0;i<32;i++)context.fillRect((i*83)%WIDTH,(i*47)%HEIGHT,2,2);
    for(const star of state?.stars||[]){context.save();context.shadowColor='#fff4a8';context.shadowBlur=12;context.fillStyle='#ffe98c';starPath(star.x,star.y,star.radius||10);context.fill();context.restore();}
    const player=state?.player||{x:WIDTH/2,y:HEIGHT/2,radius:14};
    context.save();context.shadowColor='#b7f3ff';context.shadowBlur=14;context.fillStyle='#9ce7f2';context.beginPath();context.arc(player.x,player.y,player.radius||14,0,Math.PI*2);context.fill();context.fillStyle='#d7f7fa';context.beginPath();context.arc(player.x-4,player.y-4,(player.radius||14)*.35,0,Math.PI*2);context.fill();context.restore();
    const shown=state?.elapsedMs||0,elapsed=running?shown+Math.max(0,performance.now()-stateReceivedAt):shown;
    find('stopwatch').textContent=(elapsed/1000).toFixed(2)+'초';
    frame=requestAnimationFrame(draw);
  }

  function renderRanking({ranking=[]}={}){
    if(!alive)return;const list=find('ranking');list.replaceChildren();
    if(!ranking.length){const item=document.createElement('li');item.className='dodge-ranking-empty';item.textContent='아직 이번 주 기록이 없어요.';list.append(item);return;}
    for(const record of ranking){const item=document.createElement('li');item.textContent=`${record.rank}위 · ${record.nickname} · ${(record.elapsedMs/1000).toFixed(2)}초`;list.append(item);}
  }
  function receive(event){
    if(!alive||!event?.state)return;if(runId&&event.state.runId!==runId)return;
    runId=event.state.runId;state=event.state;stateReceivedAt=performance.now();
    if(event.finished){
      stopInput();running=false;
      if(event.error){
        startButton.disabled=true;startButton.textContent='기록 저장 중';
        find('status').textContent=`별에 닿았어요. 기록 저장을 다시 시도하고 있어요. ${event.error}`;
        return;
      }
      startButton.disabled=false;startButton.textContent='다시 시작';
      const result=event.result;
      find('status').textContent=result?.rank?`별에 닿았어요. ${(result.elapsedMs/1000).toFixed(2)}초 생존, 이번 주 ${result.rank}위예요!`:
        `별에 닿았어요. ${((result?.elapsedMs??state.elapsedMs)/1000).toFixed(2)}초 생존했어요.`;
      if(result?.ranking)renderRanking(result);
    }
  }
  const unsubscribeState=typeof subscribeState==='function'?(subscribeState(receive)||(()=>{})):(()=>{});
  const unsubscribeRanking=typeof subscribeRanking==='function'?(subscribeRanking(renderRanking)||(()=>{})):(()=>{});

  async function refreshRanking(){try{renderRanking(await request('dodge:ranking',{}));}catch(error){if(alive)find('status').textContent=error.message;}}
  refreshRanking();
  startButton.addEventListener('click',async()=>{
    if(!alive||startButton.disabled)return;startButton.disabled=true;find('status').textContent='별을 불러오는 중…';stopInput();
    try{
      const result=await request('dodge:start',{});
      if(!alive){if(result?.runId)request('dodge:cancel',{runId:result.runId}).catch(()=>{});return;}
      runId=result.runId;state=result;stateReceivedAt=performance.now();running=true;startButton.textContent='진행 중';
      find('status').textContent='별을 피하세요! 5초마다 별이 하나씩 더 많이 나타나요.';canvas.focus();send();
    }catch(error){if(alive){startButton.disabled=false;find('status').textContent=error.message;}}
  });
  rankingButton.addEventListener('click',()=>{
    const opening=rankingPanel.hidden;rankingPanel.hidden=!opening;rankingButton.textContent=opening?'랭킹 닫기':'랭킹 보기';rankingButton.setAttribute('aria-expanded',String(opening));
    if(opening)refreshRanking();
  });

  function keyEvent(event,down){
    if(!keyDirections[event.code])return;event.preventDefault();event.stopPropagation();
    if(!running)return;down?keys.add(event.code):keys.delete(event.code);send();
  }
  root.addEventListener('keydown',event=>keyEvent(event,true));root.addEventListener('keyup',event=>keyEvent(event,false));
  const loseFocus=()=>{if(running){stopInput();send();}};window.addEventListener('blur',loseFocus);
  function point(event){const box=canvas.getBoundingClientRect();return {x:(event.clientX-box.left)*WIDTH/box.width,y:(event.clientY-box.top)*HEIGHT/box.height};}
  canvas.addEventListener('pointerdown',event=>{if(!running)return;event.preventDefault();event.stopPropagation();pointerId=event.pointerId;touchTarget=point(event);canvas.setPointerCapture?.(event.pointerId);send();});
  canvas.addEventListener('pointermove',event=>{if(event.pointerId!==pointerId)return;event.preventDefault();event.stopPropagation();touchTarget=point(event);send();});
  const release=event=>{if(event.pointerId!==pointerId)return;event.preventDefault();event.stopPropagation();touchTarget=null;pointerId=null;send();};
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);

  const heartbeat=setInterval(send,INPUT_INTERVAL_MS);draw();
  return {destroy(){
    if(!alive)return;const activeRun=running?runId:null;stopInput();alive=false;running=false;clearInterval(heartbeat);cancelAnimationFrame(frame);
    unsubscribeState();unsubscribeRanking();window.removeEventListener('blur',loseFocus);root.remove();board.classList.remove('dodge-game-host');if(ownsStylesheet)stylesheet.remove();
    if(activeRun)request('dodge:cancel',{runId:activeRun}).catch(()=>{});
    state=null;runId=null;
  }};
}
