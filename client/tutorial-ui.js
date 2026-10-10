const STEPS=[
  {icon:'✦',title:'우주를 걸어볼까요?',body:'방향키나 WASD로 움직여 보세요. 휴대전화에서는 화면의 조이스틱을 밀면 돼요.'},
  {icon:'✧',title:'별빛 물체 살펴보기',body:'물체 가까이에서 F를 누르거나 화면의 조사하기 버튼을 눌러 보세요. 새로운 공간과 이야기를 만날 수 있어요.'},
  {icon:'✉',title:'알림장과 과제',body:'광장에서 알림장을 읽고 내 과제를 확인하세요. 과제별서고에서 작성중·제출 상태를 고르면 선생님이 확인해 주세요.'},
  {icon:'☄',title:'친구와 이야기하기',body:'접속 중인 친구를 누르면 함께할 수 있어요. 채팅에서는 서로 기분 좋은 말을 건네 주세요.'},
  {icon:'★',title:'가방과 별상점',body:'가방에서 물건을 살펴보고 별상점에서 정보를 읽어 보세요. 안내를 마치면 별 파편 1개를 받고 자유롭게 탐험할 수 있어요.'}
];

export function createTutorialUI({request,stop,toast}){
  const dialog=document.createElement('dialog');dialog.id='tutorial-dialog';
  dialog.innerHTML='<div id="tutorial-mark" class="tutorial-mark" aria-hidden="true"></div><p id="tutorial-progress"></p><h2 id="tutorial-title"></h2><p id="tutorial-body"></p><p id="tutorial-error" role="alert"></p><div class="dialog-actions"><button id="tutorial-later" class="secondary" type="button">나중에 보기</button><button id="tutorial-back" class="secondary" type="button">이전</button><button id="tutorial-next" class="primary" type="button">다음</button></div>';
  document.body.append(dialog);
  const $=id=>dialog.querySelector('#tutorial-'+id);
  let index=0,busy=false;
  function render(){const step=STEPS[index];$('mark').textContent=step.icon;$('progress').textContent=`첫 여행 안내 · ${index+1} / ${STEPS.length}`;$('title').textContent=step.title;$('body').textContent=step.body;$('back').hidden=index===0;$('next').textContent=index===STEPS.length-1?'탐험 시작하기':'다음';}
  function open(){index=0;$('error').textContent='';render();stop();if(!dialog.open)dialog.showModal();}
  $('later').onclick=()=>dialog.close();$('back').onclick=()=>{if(index>0){index--;render();}};
  $('next').onclick=async()=>{
    if(busy)return;
    if(index<STEPS.length-1){index++;render();return;}
    busy=true;$('next').disabled=true;
    try{const result=await request('tutorial:complete',{});dialog.close();toast(result.rewarded?'첫 여행 안내 완료! 별 파편 1개를 받았어요.':'첫 여행 안내를 다시 읽었어요. 즐거운 탐험 되세요!');}
    catch(error){$('error').textContent=error.message;}
    finally{busy=false;$('next').disabled=false;}
  };
  dialog.addEventListener('close',()=>document.getElementById('world').focus());
  function startIfNeeded(result){
    const me=result.room.players.find(player=>player.id===result.selfId);
    if(me?.role!=='student'||me.tutorialCompleted)return;
    const offer=document.getElementById('password-offer-dialog');
    if(offer.open)offer.addEventListener('close',()=>{if(document.getElementById('lobby').hidden)open();},{once:true});
    else open();
  }
  return {open,startIfNeeded,reset(){if(dialog.open)dialog.close();}};
}
