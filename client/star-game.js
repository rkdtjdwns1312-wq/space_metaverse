export function createStarGame({board,request,subscribeStarRanking,toast=()=>{}}){
  board.classList.add('star-game');
  const wrap=document.createElement('section');wrap.innerHTML='<div class="game-start-actions"><button id="star-start" type="button">시작</button><button id="star-ranking-toggle" type="button" aria-expanded="false">랭킹 보기</button></div><p id="star-timer">0.00초 · 0 / 10</p><div id="star-grid" aria-label="4행 4열 별 찾기"></div><p id="star-result" role="status"></p><section id="star-ranking-panel" hidden><h3>우리 교실 빠른 기록 TOP 10</h3><p>매주 월요일 0시 새로 시작해요.</p><ol id="star-ranking"></ol></section>';
  board.append(wrap);const $=id=>wrap.querySelector('#star-'+id);let active=true,run=null,pending=false,anchor=0,elapsed=0,frame=null;
  const cells=Array.from({length:16},(_,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',(i+1)+'번 칸');b.disabled=true;b.onclick=()=>hit(i);$('grid').append(b);return b;});
  function ranking({ranking=[]}){
    if(!active)return;$('ranking').replaceChildren(...ranking.map(r=>{const li=document.createElement('li');li.textContent=r.rank+'위 · '+r.nickname+' · '+(r.elapsedMs/1000).toFixed(2)+'초';return li;}));
    if(!ranking.length){const li=document.createElement('li');li.textContent='아직 기록이 없어요. 첫 기록에 도전해요!';$('ranking').append(li);}
  }
  const unsubscribe=subscribeStarRanking?.(ranking)||(()=>{});
  $('ranking-toggle').onclick=()=>{const open=$('ranking-panel').hidden;$('ranking-panel').hidden=!open;$('ranking-toggle').setAttribute('aria-expanded',String(open));$('ranking-toggle').textContent=open?'랭킹 닫기':'랭킹 보기';if(open)request('stars:ranking',{}).then(ranking).catch(e=>{if(active)$('result').textContent=e.message;});};
  request('stars:ranking',{}).then(ranking).catch(e=>{if(active)$('result').textContent=e.message;});
  function paint(){
    for(const [i,b] of cells.entries()){const target=run&&i===run.target;b.textContent=target?'⭐':'';b.disabled=!run||pending;b.setAttribute('aria-label',target?'⭐':(i+1)+'번 칸');}
  }
  function tick(){
    if(!active)return;
    $('timer').textContent=((elapsed+(run?performance.now()-anchor:0))/1000).toFixed(2)+'초 · '+(run?.step||0)+' / 10';
    if(run)frame=requestAnimationFrame(tick);
  }
  async function hit(i){
    if(!run||pending||!active)return;if(i!==run.target){toast('빛나는 별을 찾아요!');return;}
    pending=true;paint();
    try{
      const result=await request('stars:click',{runId:run.runId,step:run.step,target:i});if(!active)return;
      elapsed=result.elapsedMs;anchor=performance.now();
      if(result.done){
        run=null;cancelAnimationFrame(frame);$('timer').textContent=(elapsed/1000).toFixed(2)+'초 · 10 / 10';
        $('result').textContent='별 10개 찾기 성공! '+(result.rank?result.rank+'위에 올랐어요.':'다음에는 TOP 10에 도전해요!');ranking(result);$('start').disabled=false;$('start').textContent='다시 시작';
      }else run={...run,...result};
    }catch(e){if(active){$('result').textContent=e.message;cancelAnimationFrame(frame);run=null;$('start').disabled=false;}}
    finally{pending=false;if(active)paint();}
  }
  $('start').onclick=async()=>{
    if(pending||!active)return;pending=true;$('start').disabled=true;$('result').textContent='';
    try{
      const result=await request('stars:start',{});
      if(!active){request('stars:cancel',{runId:result.runId}).catch(()=>{});return;}
      run=result;elapsed=0;anchor=performance.now();tick();
    }catch(e){if(active){$('result').textContent=e.message;$('start').disabled=false;}}
    finally{pending=false;if(active)paint();}
  };
  return {destroy(){active=false;unsubscribe();cancelAnimationFrame(frame);board.classList.remove('star-game');if(run)request('stars:cancel',{runId:run.runId}).catch(()=>{});run=null;}};
}
