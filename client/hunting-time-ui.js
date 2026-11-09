import {HUNTING_STATION_LIMIT,HUNTING_STATION_MS,HUNTING_PLAYGROUND_LIMIT,HUNTING_PLAYGROUND_MS} from '/shared/hunting-time.js';
const STATIONS={math:'별 수학 발전소',english:'별 영어 발전소',history:'별 역사 발전소',science:'별 과학 발전소',culture:'별 교양 발전소',art:'별 예술 발전소'};
const PLAYGROUNDS={memory:'별 그림 짝 맞추기',path:'별 길 한번에 그리기',baseball:'숫자야구',signal:'우주 신호',sudoku:'별빛 스도쿠',tetris:'별 테트리스',dodge:'별 피하기','duel-memory':'별 그림 짝 맞추기 경쟁 게임','duel-omok':'별 오목 경쟁 게임'};
export function createHuntingTimeUI({clock,stop=()=>{}}){
 const button=document.createElement('button');button.id='hunting-time';button.className='hunting-time';button.type='button';button.hidden=true;button.setAttribute('aria-haspopup','dialog');const row=document.createElement('div');row.id='mobile-hunting-row';clock.after(row);row.append(button);
 const dialog=document.createElement('dialog');dialog.className='hunting-time-dialog';dialog.setAttribute('aria-label','사냥터 시간 충전 안내');dialog.innerHTML=`<h2>사냥터 이용 시간</h2><section><strong data-station-count></strong><p>1곳당 20분</p><ul data-stations></ul></section><section><strong data-playground-count></strong><p>1곳당 10분</p><ul data-playgrounds></ul></section><button type="button" class="secondary">확인</button>`;document.body.append(dialog);
 let state=null,received=0,connected=true;
 const remaining=()=>{if(!state)return 0;const elapsed=Math.max(0,performance.now()-received);if(Number.isFinite(state.resetAt)&&Number.isFinite(state.serverNow)&&state.serverNow+elapsed>=state.resetAt)return 0;return Math.max(0,(Number(state.remainingMs)||0)-(state.running&&connected?elapsed:0));};
 function details(){
  const expired=state&&Number.isFinite(state.resetAt)&&state.serverNow+Math.max(0,performance.now()-received)>=state.resetAt;
  const groups=[['station','발전소',expired?[]:state?.chargedStations??[],HUNTING_STATION_LIMIT,STATIONS,HUNTING_STATION_MS,'stations'],['playground','놀이터',expired?[]:state?.chargedPlaygrounds??[],HUNTING_PLAYGROUND_LIMIT,PLAYGROUNDS,HUNTING_PLAYGROUND_MS,'playgrounds']];
  for(const [id,label,charged,limit,names,ms,listId]of groups){
   dialog.querySelector('[data-'+id+'-count]').textContent='오늘 충전한 '+label+' '+Math.min(charged.length,limit)+'/'+limit;
   dialog.querySelector('[data-'+listId+']').replaceChildren(...charged.filter(key=>names[key]).map(key=>{
    const li=document.createElement('li');li.textContent=names[key]+' 이용완료 +'+ms/60000+'분';return li;
   }));
  }
 }
 function render(){button.hidden=!state;if(!state)return;if(state.exempt){button.textContent='사냥터 시간 제한 없음';button.classList.remove('empty','running');return;}const ms=remaining(),seconds=Math.ceil(ms/1000);button.classList.toggle('empty',ms<=0);button.classList.toggle('running',!!state.running&&ms>0);button.textContent=ms<=0?'사냥터 입장 시간이 부족합니다':'사냥터 '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+(state.running?' · 이용 중':' · 대기');button.title='누르면 사냥터 시간 충전 방법을 확인해요';}
 function align(){const top=clock.offsetTop+clock.offsetHeight+5;button.style.top=top+'px';row.style.top=top+'px';clock.parentElement.style.setProperty('--hunting-bottom',(top+(button.hidden?0:button.offsetHeight))+'px');}
 const observer=new ResizeObserver(align);observer.observe(clock);observer.observe(button);window.addEventListener('resize',align);align();
 button.onclick=()=>{stop();details();if(!dialog.open)dialog.showModal();};dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('cancel',()=>stop());
 const interval=setInterval(()=>{render();if(dialog.open)details();},250);
 return {update(value){state=value?{...value}:null;received=performance.now();connected=true;render();if(dialog.open)details();align();},pause(){if(state){state={...state,remainingMs:remaining(),running:false};received=performance.now();}connected=false;render();},reset(){state=null;button.hidden=true;if(dialog.open)dialog.close();},destroy(){clearInterval(interval);observer.disconnect();window.removeEventListener('resize',align);row.remove();dialog.remove();}};
}
