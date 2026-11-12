import {GARDEN_RULES as R,GARDEN_ARROWS,sunlightStageAt} from '../shared/garden-minigame.js';
const symbols={up:'↑',right:'→',down:'↓',left:'←'};
export function renderGardenGame(pot,index){
 const g=pot.game;if(!g)return '';let content='';
 if(g.phase==='seed')content=`<p>① 씨앗 심기 · ${g.positions.length}/3<br>손이 ${g.positions.length+1}번 구역에 왔을 때 씨앗을 뿌려요.</p><div class="garden-seed-plot" aria-label="씨앗 심기판">${R.seedTargets.map((target,i)=>`<span class="garden-seed-zone target-${i} ${i===g.positions.length?'current':''}">${i+1}구역</span>`).join('')}${g.positions.map(p=>`<span class="garden-planted-seed" data-seed-x="${p.x}">🌱</span>`).join('')}<span class="garden-seed-hand" data-seed-elapsed="${g.seedElapsedMs||0}" aria-hidden="true">👆</span></div><button class="garden-sow-button" data-garden-seed type="button">씨앗 뿌리기</button>`;
 if(g.phase==='sunlight'){
  const stage=sunlightStageAt(g.hits.length),step=g.hits.length-stage.start;
  content=`<p>② 햇빛 춤 · ${stage.index+1}단계<br>방향키 ${stage.length}개를 10초 안에 눌러요.</p><div class="garden-sun-timer" role="timer">남은 시간 <b data-garden-sun-remaining>${Math.ceil((g.sunlightRemainingMs??R.sunlightStageMs)/1000)}</b>초</div><div class="garden-sun-sequence" aria-label="${stage.index+1}단계 화살표">${g.arrows.slice(stage.start,stage.end).map((arrow,i)=>`<span class="garden-sun-step ${i<step?(g.hits[stage.start+i]?'correct':'incorrect'):i===step?'current':''}">${symbols[arrow]}</span>`).join('')}</div><div class="garden-arrow-buttons">${GARDEN_ARROWS.map(a=>`<button data-garden-arrow="${a}" aria-label="${{up:'위',right:'오른쪽',down:'아래',left:'왼쪽'}[a]}">${symbols[a]}</button>`).join('')}</div><small>키보드 방향키도 쓸 수 있어요.</small>`;
 }
 if(g.phase==='water')content=`<p>③ 물 주기<br>누른 채로 ${R.waterTargetMs/1000}초, 표시선에서 손을 떼세요.</p><div class="garden-water-meter"><progress max="${R.waterTargetMs*2}" value="${g.waterElapsedMs||0}" aria-label="물의 양"></progress><span>목표</span></div><button data-garden-water="${g.waterStartedAt===null?'start':'release'}">${g.waterStartedAt===null?'꾹 누르고 물 주기':'손 떼기 · 물 주기 마치기'}</button><small>키보드의 공백 키나 확인 키로도 물을 줄 수 있어요.</small>`;
 if(g.phase==='ready')content=`<p class="garden-grade">${g.grade} · ${g.score}점</p><small>씨앗 ${g.phaseScores?.seed??0} · 햇빛 ${g.phaseScores?.sunlight??0} · 물 ${g.phaseScores?.water??0}점</small><button data-garden-harvest>꽃 수확하기</button>`;
 return `<section class="garden-minigame" data-garden-pot="${index}" tabindex="0" aria-label="${index+1}번 화분 가꾸기">${content}</section>`;
}
export function bindGardenGame(panel,{getPots,act,isActive=()=>true}){
 let selected=0,holding=null,starting=null,released=false,disposed=false;const abort=new AbortController(),opts={signal:abort.signal};
 const send=(i,action,payload={})=>{const g=getPots()?.[i]?.game;if(!g||disposed||!isActive())return Promise.resolve();return Promise.resolve(act(action,{pot:i,generation:g.generation,revision:g.revision,...payload}));};
 const release=()=>{if(holding===null)return;released=true;if(starting)return;const i=holding;holding=null;send(i,'water-release');};
 const start=i=>{if(holding!==null)return;holding=i;released=false;starting=send(i,'water-start');starting.finally(()=>{starting=null;if(released)release();});};
 panel.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-garden-water="start"]');if(!b||b.disabled)return;e.preventDefault();selected=Number(b.closest('[data-garden-pot]').dataset.gardenPot);start(selected);},opts);
 window.addEventListener('pointerup',release,opts);window.addEventListener('pointercancel',release,opts);window.addEventListener('blur',release,opts);
 panel.addEventListener('click',e=>{const area=e.target.closest('[data-garden-pot]');if(!area)return;selected=Number(area.dataset.gardenPot);const b=e.target.closest('button');if(b?.disabled)return;
  if(b?.hasAttribute('data-garden-seed'))send(selected,'seed-place');
  else if(b?.dataset.gardenArrow)send(selected,'sunlight',{arrow:b.dataset.gardenArrow});
  else if(b?.hasAttribute('data-garden-harvest'))send(selected,'harvest');
  else if(b?.dataset.gardenWater==='release')send(selected,'water-release');
 },opts);
 panel.addEventListener('focusin',e=>{const area=e.target.closest('[data-garden-pot]');if(area)selected=Number(area.dataset.gardenPot);},opts);
 const key=e=>{if(e.type==='keyup'&&(e.code==='Space'||e.key==='Enter')&&holding!==null){e.preventDefault();e.stopImmediatePropagation();release();return;}if(!isActive()||!panel.closest('dialog')?.open)return;const target=e.target,typing=target instanceof HTMLElement&&(target.isContentEditable||target.matches('input,textarea,select,[role="textbox"]'));if(typing)return;const arrow={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',KeyW:'up',KeyD:'right',KeyS:'down',KeyA:'left'}[e.code]||{ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];const g=getPots()?.[selected]?.game;if(!g)return;
  if(arrow){e.preventDefault();e.stopImmediatePropagation();if(e.type==='keydown'&&!e.repeat&&g.phase==='sunlight')send(selected,'sunlight',{arrow});}
  if((e.code==='Space'||e.key==='Enter')&&g.phase==='water'&&panel.contains(document.activeElement)){e.preventDefault();e.stopImmediatePropagation();if(e.type==='keyup')release();else if(!e.repeat){if(g.waterStartedAt===null)start(selected);else if(holding===null)send(selected,'water-release');}}
 };
 window.addEventListener('keydown',key,{capture:true,...opts});window.addEventListener('keyup',key,{capture:true,...opts});
 const clocks=new Map(),sunTimeouts=new Set();const timer=setInterval(()=>{if(!isActive())return;for(const area of panel.querySelectorAll('[data-garden-pot]')){
  const i=Number(area.dataset.gardenPot),g=getPots()?.[i]?.game;if(!g)continue;
  const id=`${i}:${g.generation}:${g.revision}`;if(!clocks.has(id))clocks.set(id,Date.now());
  const elapsed=Date.now()-clocks.get(id),meter=area.querySelector('progress');
  if(meter&&g.waterStartedAt!==null)meter.value=Math.min(R.waterMaxMs,(g.waterElapsedMs||0)+elapsed);
  const sun=area.querySelector('[data-garden-sun-remaining]');if(sun&&g.phase==='sunlight'){
   const remaining=Math.max(0,(g.sunlightRemainingMs??R.sunlightStageMs)-elapsed);sun.textContent=String(Math.ceil(remaining/1000));
   if(remaining===0&&!sunTimeouts.has(id)){sunTimeouts.add(id);send(i,'sunlight-timeout');}
  }
 }},50);
 return ()=>{disposed=true;abort.abort();clearInterval(timer);holding=null;};
}
