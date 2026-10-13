import {JOURNEY_STEPS,JOURNEY_ITEM_IDS} from '/shared/tutorial-journey.js';
import {avatarSizeOf} from '/shared/avatar-size.js';
import {journeyDestination,journeyRoute,journeySegmentClear} from './tutorial-directions.js';

const HELP={
 moved:'방향키나 WASD로 걸어 보세요. 휴대전화에서는 조이스틱을 밀어요. 그다음 화살표를 따라 네 기둥을 각각 조사해요.',
 'pillar-notice':'오늘의 알림장이에요. 기둥 가까이에서 F 또는 조사하기를 눌러요.',
 'pillar-effects':'사용 중인 아이템을 확인하는 기둥이에요. 가까이에서 조사해 보세요.',
 'pillar-timetable':'오늘의 시간표를 볼 수 있어요. 기둥 가까이에서 조사해 보세요.',
 'pillar-weekly':'이번 주 받은 별을 확인할 수 있어요. 기둥 가까이에서 조사해 보세요.',
 'black-hole':'블랙홀: 경고가 누적되어 검은별을 받은 친구들이 머무는 곳이에요. 이번에는 입구의 원형 광장만 살펴봐요.',
 department:'부서행성 광장: 부서행성을 만들어 함께 활동하는 곳이에요. 메뉴를 열면 행성 만들기 버튼이 있어요. 이번에는 연습으로 눌러 볼 거예요.',
 'department-menu':'메뉴를 열고 행성 만들기를 눌러 보세요. 연습 안내를 읽은 뒤 오른쪽 아래 닫기를 눌러요.',
 market:'별 시장: 친구와 서로 물건을 거래할 수 있는 공간이에요.',
 assignment:'과제별서고: 매일의 과제와 미션을 확인하는 공간이에요.',
 'world-map':'오른쪽 위 전체 우주 지도를 눌러 우리가 탐험할 곳들을 살펴봐요.',
 station:'별 발전소에는 나를 성장시킬 수 있는 다양한 발전소가 있어요. 발전소 활동으로 새로운 지식을 배우고, 추가 별 파편을 얻는 미션에도 도전할 수 있어요.',
 shops:'상점가에서는 별 파편과 우주에너지로 물건을 살펴보고 구입해요. 지금은 사지 않아도 돼요.',
 playground:'놀이터에는 여러 게임이 있어요. 추가 별 파편을 얻는 미션과 랭킹에도 도전할 수 있어요.',
 'growth-star':'성장의 별은 별 파편으로 경험치를 얻는 곳이에요. 경험치가 가득 차도 자동으로 진화하지는 않아요. 지금은 살펴보기만 해요.',
 'evolution-star':'진화의 별은 모은 경험치로 별자리를 진화시키거나 모습을 바꾸는 곳이에요. 지금은 살펴보기만 해요.',
 'bag-1':'가방은 모두 3페이지예요. 1, 2, 3 버튼을 차례로 눌러 살펴보세요.',
 'bag-2':'가방 위쪽의 2를 눌러 두 번째 페이지를 살펴보세요.',
 'bag-3':'가방 위쪽의 3을 눌러 세 번째 페이지를 살펴보세요.',
 'item-info':'연습용 아이템을 누른 다음 정보 보기를 눌러 설명을 읽어 보세요.',
 'practice-used':'연습용 소모품을 누르고 아이템 사용하기를 눌러 보세요. 실제 능력은 바뀌지 않고 1분 동안 사용 표시만 생겨요.',
 'effects-seen':'사용 중인 아이템 기둥으로 가서 연습용 아이템이 사용되었다는 표시를 확인해요. 1분이 지나면 가방에서 다시 사용할 수 있어요.',
 'practice-equipped':'연습용 장비를 누르고 장착하기를 눌러 보세요. 장착 아이템은 Lv2부터 쓸 수 있다는 안내를 확인해요.',
 'chat-open':'왼쪽 위 채팅창 열기를 눌러 보세요. 전체·행성·귓속말 탭이 있어요. 지금 글을 보내지 않아도 돼요.',
 'friends-open':'소통 → 친구 보기를 눌러요. 접속 중인 친구를 선택하면 대화·부르기·파티 초대를 할 수 있어요. 지금 친구를 부르거나 초대하지 않아도 돼요.'
};
const ARRIVALS=new Set(['black-hole','department','market','assignment','station','shops','playground','growth-star','evolution-star']);
export function createTutorialUI({request,stop,toast,getRoom,getSelfId,screenPoint}){
 const $=id=>document.getElementById(id),me=()=>getRoom()?.players.find(p=>p.id===getSelfId());
 const dialog=document.createElement('dialog');dialog.id='tutorial-dialog';dialog.setAttribute('aria-labelledby','tutorial-title');
 dialog.innerHTML='<p id="tutorial-progress"></p><h2 id="tutorial-title"></h2><p id="tutorial-body"></p><ol id="tutorial-goals"></ol><p class="journey-reward">미션 보상 · 별 파편 1개</p><p id="tutorial-error" role="alert"></p><div class="dialog-actions"><button id="tutorial-later" class="secondary" type="button">게임에서 진행하기</button><button id="tutorial-next" class="secondary" type="button">안내 시작하기</button></div>';
 document.body.append(dialog);
 const hud=document.createElement('aside');hud.id='journey-hud';hud.hidden=true;hud.setAttribute('aria-label','첫 여행 미션 안내');
 hud.innerHTML='<div class="journey-heading"><strong id="journey-heading"></strong><button id="journey-details" class="small secondary" type="button">미션 보기</button></div><p id="journey-instruction" aria-live="polite"></p><button id="journey-claim" class="secondary" type="button" hidden>완료 · 별 파편 1개 받기</button>';
 document.querySelector('.map-wrap').append(hud);
 const arrow=document.createElement('div');arrow.id='journey-arrow';arrow.hidden=true;arrow.setAttribute('aria-hidden','true');arrow.textContent='➜';document.body.append(arrow);
 const notice=document.createElement('dialog');notice.id='journey-place-dialog';notice.innerHTML='<h2>새로운 곳을 만났어요!</h2><p id="journey-place-text"></p><div class="dialog-actions"><button class="secondary" type="button">알겠어요</button></div>';document.body.append(notice);notice.querySelector('button').onclick=()=>notice.close();
 const practice=document.createElement('dialog');practice.id='journey-planet-practice-dialog';practice.setAttribute('aria-labelledby','journey-planet-practice-title');
 practice.innerHTML='<h2 id="journey-planet-practice-title">행성 만들기 연습</h2><p>지금은 연습시간이라 행성을 만들 수는 없어요</p><div class="dialog-actions"><button id="journey-planet-practice-close" class="secondary" type="button">닫기</button></div>';document.body.append(practice);
 let signature='',snapshot=null,goal=null,busy=false,highlight=null,route=null,routeKey='',lastRouteAt=0,lastRouteCheck=0,announcement=[],pending=new Set(),lastObserved=new Map();
 const goals=()=>me()?.journey?.goals||[];
 const current=()=>JOURNEY_STEPS.find(s=>s.stage===me()?.journey?.stage);
 const done=id=>goals().includes(id);
 function clearHighlight(){highlight?.classList.remove('journey-target');highlight=null;arrow.hidden=true;}
 function observe(goalId){
  if(!goalId||!current()?.goals.some(g=>g.id===goalId)||done(goalId)||pending.has(goalId))return;
  if(Date.now()-(lastObserved.get(goalId)||0)<1500)return;lastObserved.set(goalId,Date.now());pending.add(goalId);
  request('tutorial:observe',{goalId}).catch(()=>{}).finally(()=>pending.delete(goalId));
 }
 // Capture the real button before its placement handler. No planet or cost is created during this lesson.
 $('planet-new').addEventListener('click',event=>{
  if(me()?.role!=='student'||me()?.journey?.stage!==2)return;
  event.preventDefault();event.stopImmediatePropagation();stop();if(!practice.open)practice.showModal();
 },true);
 $('journey-planet-practice-close').onclick=()=>{observe('department-menu');practice.close();if($('menu-dialog').open)$('menu-dialog').close();$('world').focus();};
 practice.addEventListener('cancel',event=>{event.preventDefault();$('journey-planet-practice-close').focus();});
 async function claim(){if(busy)return;const mission=getRoom()?.missions?.find(m=>m.kind==='tutorial'&&m.stage===me()?.journey?.stage);if(mission?.status!=='ready')return;
  busy=true;render();try{await request('mission:claim',{missionId:mission.id});toast('잘했어요! 별 파편 1개를 받았어요.');}
  catch(error){$('tutorial-error').textContent=error.message;toast(error.message);}finally{busy=false;render();}
 }
 $('journey-claim').onclick=claim;$('journey-details').onclick=()=>open();
 $('tutorial-later').onclick=()=>dialog.close();$('tutorial-next').onclick=()=>{const step=current();if(step&&step.goals.every(g=>done(g.id)))claim();else dialog.close();};
 function render(){
  const p=me(),step=current(),journey=p?.journey;hud.hidden=p?.role!=='student'||!step;
  if(!step){clearHighlight();if(dialog.open){$('tutorial-progress').textContent='첫 여행 미션 · 모두 완료';$('tutorial-title').textContent='우주 교실의 탐험가가 되었어요!';$('tutorial-body').textContent='다섯 미션을 모두 마쳤어요. 이제 배운 기능으로 친구들과 즐겁게 활동해 보세요.';$('tutorial-goals').replaceChildren();$('tutorial-next').hidden=true;dialog.querySelector('.journey-reward').hidden=true;}return;}
  const ready=step.goals.every(g=>done(g.id));goal=step.goals.find(g=>!done(g.id))?.id||null;
  const key=JSON.stringify([journey,busy]);if(signature===key)return;signature=key;
  $('journey-heading').textContent=`첫 여행 ${step.stage}/5 · ${step.title}`;
  $('journey-instruction').textContent=ready?'조건을 모두 달성했어요. 완료 버튼으로 보상을 받으면 다음 미션이 열려요.':HELP[goal]||step.description;
  $('journey-claim').hidden=!ready;$('journey-claim').disabled=busy;
  $('tutorial-progress').textContent=`첫 여행 미션 · ${step.stage} / 5`;$('tutorial-title').textContent=step.title;$('tutorial-body').textContent=step.description;
  $('tutorial-goals').replaceChildren(...step.goals.map(g=>{const li=document.createElement('li');li.textContent=(done(g.id)?'완료 · ':'도전 · ')+g.label;li.classList.toggle('is-done',done(g.id));return li;}));
  $('tutorial-next').hidden=false;$('tutorial-next').disabled=busy;$('tutorial-next').textContent=ready?'완료 · 별 파편 1개 받기':'안내 시작하기';dialog.querySelector('.journey-reward').hidden=false;
  if(snapshot&&snapshot.stage===journey.stage)for(const id of goals())if(!snapshot.goals.includes(id)&&ARRIVALS.has(id))announcement.push(id);
  if(snapshot&&journey.stage!==snapshot.stage&&journey.stage<=5){announcement=[];toast(`${journey.stage}번째 미션이 열렸어요. ${step.title}`);}
  snapshot={stage:journey.stage,goals:[...goals()]};
 }
 function open(){render();$('tutorial-error').textContent='';stop();if(!dialog.open)dialog.showModal();}
 dialog.addEventListener('close',()=>$('world').focus());notice.addEventListener('close',()=>$('world').focus());
 function visible(el){return el&&el.getClientRects().length&&!el.hidden&&(!el.closest('dialog')||el.closest('dialog').open);}
 function buttonForGoal(){
  if(!goal)return $('journey-claim');
  if(goal==='world-map')return visible($('map-overview'))?$('map-overview'):$('minimap-toggle');
  if(goal==='department-menu')return $('menu-dialog').open?$('planet-new'):$('dock-menu');
  if(goal.startsWith('bag-'))return $('inventory-dialog').open?document.querySelectorAll('.inventory-page-tab')[Number(goal.slice(-1))-1]:$('dock-inventory');
  if(['item-info','practice-used','practice-equipped'].includes(goal)){
   if(!$('inventory-dialog').open)return $('dock-inventory');
   const id=goal==='practice-equipped'?JOURNEY_ITEM_IDS.equipment:JOURNEY_ITEM_IDS.consumable;
   const item=document.querySelector(`#journey-practice-items [data-item-id="${id}"]`);
   const action=$('bag-detail').querySelector(goal==='item-info'?'.item-info':'.use');
   return action&&$('bag-detail').dataset.itemId===id?action:item?.querySelector('button');
  }
  if(goal==='effects-seen'&&!(me()?.journey?.practiceUntil>Date.now())&&!done('effects-seen')){
   if(!$('inventory-dialog').open)return $('dock-inventory');
   const action=$('bag-detail').querySelector('.use');return $('bag-detail').dataset.itemId===JOURNEY_ITEM_IDS.consumable?action:document.querySelector(`#journey-practice-items [data-item-id="${JOURNEY_ITEM_IDS.consumable}"] button`);
  }
  if(goal==='chat-open')return $('chat-window-toggle');
  if(goal==='friends-open')return $('social-dialog').open?$('crew-button'):$('dock-chat');
  if(goal==='moved')return $('joystick');return null;
 }
 function pointButton(el){
  if(!visible(el)){clearHighlight();return;}
  const modal=el.closest('dialog');if(modal&&arrow.parentNode!==modal)modal.append(arrow);else if(!modal&&arrow.parentNode!==document.body)document.body.append(arrow);
  if(highlight!==el){clearHighlight();highlight=el;el.classList.add('journey-target');}
  const r=el.getBoundingClientRect();arrow.hidden=false;arrow.style.left=Math.max(5,Math.min(innerWidth-36,r.left+r.width/2-16))+'px';arrow.style.top=Math.max(5,r.top-36)+'px';arrow.style.transform='rotate(90deg)';
 }
 function frame(now){
  const p=me(),step=current();if(!step||p?.role!=='student'||document.body.classList.contains('placing')){clearHighlight();requestAnimationFrame(frame);return;}
  if(announcement.length&&!document.querySelector('dialog[open]')){const id=announcement.shift();$('journey-place-text').textContent=HELP[id];stop();notice.showModal();}
  const modal=practice.open?practice:[...document.querySelectorAll('dialog[open]')].at(-1),button=buttonForGoal();
  if(button&&(!modal||modal.contains(button)))pointButton(button);
  else if(modal){const close=modal.querySelector('button[data-close],button[id$="-close"],#tutorial-later');if(close&&visible(close))pointButton(close);else clearHighlight();}
  else if(journeyDestination(goal)){
   const key=`${p.mapId}:${goal}`,planets=getRoom()?.planets;
   const inspect=now-lastRouteCheck>250;if(inspect)lastRouteCheck=now;
   const blocked=inspect&&route?.points[0]&&!journeySegmentClear(p,p,route.points[0],planets);
   if(key!==routeKey||!route||blocked||now-lastRouteAt>2000){route=journeyRoute(p,goal,planets);routeKey=key;lastRouteAt=now;}
   while(route?.points.length>1&&Math.hypot(p.x-route.points[0].x,p.y-route.points[0].y)<30&&journeySegmentClear(p,p,route.points[1],planets))route.points.shift();
   const next=route?.points[0];if(next){
    const distance=Math.hypot(p.x-next.x,p.y-next.y);
    if(route.points.length===1&&distance<35&&route.target.interact&&visible($('touch-interact'))&&!$('touch-interact').disabled)pointButton($('touch-interact'));
    else{clearHighlight();if(arrow.parentNode!==document.body)document.body.append(arrow);const pos=screenPoint({...p,kind:'player'});arrow.hidden=false;arrow.style.left=Math.max(8,Math.min(innerWidth-40,pos.x-16))+'px';arrow.style.top=Math.max(8,pos.y-avatarSizeOf(p)*pos.scale*.65-35)+'px';arrow.style.transform=`rotate(${Math.atan2(next.y-p.y,next.x-p.x)}rad)`;}
   }else clearHighlight();
  }else clearHighlight();
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
 setInterval(()=>{
  render();if(!current())return;
  if($('universe-dialog').open)observe('world-map');
  const departmentMenu=me()?.journey?.stage===2&&$('menu-dialog').open&&visible($('planet-new'))&&done('department');
  let tip=$('journey-department-tip');
  if(departmentMenu){
   if(!tip){tip=document.createElement('p');tip.id='journey-department-tip';tip.textContent='행성 만들기를 눌러 연습 안내를 확인해 보세요. 실제 행성은 만들어지지 않아요.';$('planet-new').after(tip);}tip.hidden=false;
  }else{if(tip)tip.hidden=true;}
  if($('inventory-dialog').open){const tab=document.querySelector('.inventory-page-tab[aria-selected="true"]');if(tab)observe('bag-'+tab.textContent.trim());}
  if($('chat-dialog').open)observe('chat-open');if($('crew-dialog').open)observe('friends-open');
 },300);
 return {open,update:render,observe,steps:JOURNEY_STEPS.map(s=>s.title),startIfNeeded(result){const p=result.room.players.find(p=>p.id===result.selfId);if(p?.role!=='student'||p.journey?.stage===6)return;const offer=$('password-offer-dialog');if(offer.open)offer.addEventListener('close',()=>{if($('lobby').hidden)open();},{once:true});else open();},reset(){signature='';snapshot=null;goal=null;route=null;routeKey='';announcement=[];pending.clear();lastObserved.clear();hud.hidden=true;clearHighlight();if(dialog.open)dialog.close();if(notice.open)notice.close();if(practice.open)practice.close();}};
}
