import {HUNTING_STATION_LIMIT,HUNTING_STATION_MS} from '/shared/hunting-time.js';
const STATIONS={math:'별 수학 발전소',english:'별 영어 발전소',history:'별 역사 발전소',science:'별 과학 발전소',culture:'별 교양 발전소',art:'별 예술 발전소'};
const minutes=HUNTING_STATION_MS/60000;
export function createHuntingTimeUI({clock,stop=()=>{}}){
 const button=document.createElement('button');button.id='hunting-time';button.className='hunting-time';button.type='button';button.hidden=true;button.setAttribute('aria-haspopup','dialog');const row=document.createElement('div');row.id='mobile-hunting-row';clock.after(row);row.append(button);
 const dialog=document.createElement('dialog');dialog.className='hunting-time-dialog';dialog.setAttribute('aria-label','사냥터 시간 충전 안내');dialog.innerHTML=`<h2>사냥터 이용 시간</h2><p>여섯 발전소 중 원하는 네 곳에서 충전해요.</p><p class="hunting-time-guide">하루에 각 발전소에서 한 번씩 ${minutes}분을 받아요. 최대 ${minutes*HUNTING_STATION_LIMIT}분이에요. 수학·영어는 10문제 중 9개 이상 맞히고, 교양·역사·과학은 읽음 보상을 받아요. 예술은 직접 그린 작품을 저장하면 돼요.</p><strong data-charge-count></strong><ul></ul><p class="hunting-time-guide">시간은 사냥터에 있을 때만 줄어요. 밤 10시에 남은 시간과 충전 횟수가 초기화돼요. 사냥 중 시간이 끝나면 별빛 쉼터로 돌아가요.</p><button type="button" class="secondary">확인</button>`;document.body.append(dialog);
 let state=null,received=0,connected=true;
 const remaining=()=>{if(!state)return 0;const elapsed=Math.max(0,performance.now()-received);if(Number.isFinite(state.resetAt)&&Number.isFinite(state.serverNow)&&state.serverNow+elapsed>=state.resetAt)return 0;return Math.max(0,(Number(state.remainingMs)||0)-(state.running&&connected?elapsed:0));};
 function details(){
  const charged=state?.chargedStations??[],count=Math.min(charged.length,HUNTING_STATION_LIMIT);
  dialog.querySelector('[data-charge-count]').textContent=charged.length>HUNTING_STATION_LIMIT?`이전 규칙으로 ${charged.length}곳 충전 · 오늘 한도 도달`:`오늘 충전한 발전소 ${count} / ${HUNTING_STATION_LIMIT}`;
  const list=dialog.querySelector('ul');
  list.replaceChildren(...Object.entries(STATIONS).map(([id,name])=>{
   const li=document.createElement('li');
   const status=charged.includes(id)?'오늘 충전 완료':count>=HUNTING_STATION_LIMIT?'오늘 충전 한도 도달':`완료하면 +${minutes}분`;
   li.textContent=`${name} · ${status}`;return li;
  }));
 }
 function render(){button.hidden=!state;if(!state)return;if(state.exempt){button.textContent='사냥터 시간 제한 없음';button.classList.remove('empty','running');return;}const ms=remaining(),seconds=Math.ceil(ms/1000);button.classList.toggle('empty',ms<=0);button.classList.toggle('running',!!state.running&&ms>0);button.textContent=ms<=0?'사냥터 입장 시간이 부족합니다':'사냥터 '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+(state.running?' · 이용 중':' · 대기');button.title='누르면 사냥터 시간 충전 방법을 확인해요';}
 function align(){const top=clock.offsetTop+clock.offsetHeight+5;button.style.top=top+'px';row.style.top=top+'px';clock.parentElement.style.setProperty('--hunting-bottom',(top+(button.hidden?0:button.offsetHeight))+'px');}
 const observer=new ResizeObserver(align);observer.observe(clock);observer.observe(button);window.addEventListener('resize',align);align();
 button.onclick=()=>{stop();details();if(!dialog.open)dialog.showModal();};dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('cancel',()=>stop());
 const interval=setInterval(render,250);
 return {update(value){state=value?{...value}:null;received=performance.now();connected=true;render();if(dialog.open)details();align();},pause(){if(state){state={...state,remainingMs:remaining(),running:false};received=performance.now();}connected=false;render();},reset(){state=null;button.hidden=true;if(dialog.open)dialog.close();},destroy(){clearInterval(interval);observer.disconnect();window.removeEventListener('resize',align);row.remove();dialog.remove();}};
}
