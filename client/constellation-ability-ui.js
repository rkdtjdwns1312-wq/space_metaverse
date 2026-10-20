import {constellationOf} from '/shared/constellations.js';
import {itemOf} from '/shared/config.js';

const PIPS={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
const FACE={1:'rotateX(0deg) rotateY(0deg)',2:'rotateY(-90deg)',3:'rotateX(90deg)',4:'rotateX(-90deg)',5:'rotateY(90deg)',6:'rotateY(180deg)'};

export function createConstellationAbilityUI({request,getPlayer,getRoom,stop,toast}){
  const $=id=>document.getElementById(id),panel=$('self-ability-panel'),use=$('self-ability-use');
  const dialog=$('ability-dialog'),cube=$('ability-cube'),dice=$('ability-dice'),resultText=$('ability-dice-result');
  const rollFaces=document.createElement('div');rollFaces.className='ability-roll-faces';rollFaces.hidden=true;cube.after(rollFaces);
  let status=null,signature='',snapshotSignature='',pairSignature='',revision=0,busy=false,animation=null,finishTimer=null,resetTimer=null,pairTimer=null,reminderTimer=null,messageTimer=null;
  const choices=document.createElement('section');choices.id='ability-item-choices';choices.hidden=true;dice.after(choices);
  const pairChoices=document.createElement('section');pairChoices.id='ability-pair-choices';pairChoices.hidden=true;choices.after(pairChoices);
  const huntChoices=document.createElement('section');huntChoices.id='ability-hunt-choices';huntChoices.hidden=true;pairChoices.after(huntChoices);
  const swanChoices=document.createElement('section');swanChoices.id='ability-swan-choices';swanChoices.hidden=true;huntChoices.after(swanChoices);
  const coronaChoices=document.createElement('section');coronaChoices.id='ability-corona-choices';coronaChoices.hidden=true;swanChoices.after(coronaChoices);
  let huntOptions=null;
  const reminder=document.createElement('button');reminder.id='ability-unused-reminder';reminder.type='button';reminder.textContent='!';reminder.hidden=true;reminder.setAttribute('aria-label','아직 사용하지 않은 별자리 능력 안내');$('bottom-dock').append(reminder);
  const reminderMessage=document.createElement('div');reminderMessage.id='ability-reminder-message';reminderMessage.setAttribute('role','status');reminderMessage.hidden=true;
  reminderMessage.textContent='아직 별자리 캐릭터 능력을 사용하지 않았습니다\n별자리 능력은 1주일 마다 다시 사용할 수 있습니다.';document.body.append(reminderMessage);
  reminder.onclick=()=>{clearTimeout(messageTimer);reminderMessage.hidden=false;messageTimer=setTimeout(()=>{reminderMessage.hidden=true;},4500);};
  function positionReminder(){const b=$('dock-avatar');reminder.style.left=`${b.offsetLeft+(b.offsetWidth-28)/2}px`;reminder.style.top=`${b.offsetTop-18}px`;}
  new ResizeObserver(positionReminder).observe($('bottom-dock'));
  function updateReminder(){
    reminder.hidden=getPlayer()?.role!=='student'||!status?.remindUnused;
    positionReminder();clearTimeout(reminderTimer);
    if(getPlayer()){
      const now=Date.now(),kst=now+9*3600000,untilMidnight=86400000-kst%86400000;
      reminderTimer=setTimeout(()=>void refresh(),untilMidnight+100);
    }
  }
  for(let face=1;face<=6;face++){
    const side=document.createElement('div');side.className='die-face';side.dataset.face=String(face);
    for(const cell of PIPS[face]){
      const pip=document.createElement('span');pip.className='die-pip';pip.textContent='✦';
      pip.style.gridArea=`${Math.ceil(cell/3)} / ${(cell-1)%3+1}`;side.append(pip);
    }
    cube.append(side);
  }
  const identity=()=>{const p=getPlayer();return [p?.id,p?.role,p?.avatar?.constellationId,p?.avatar?.level,p?.avatar?.teacherPreview].join(':');};
  const visible=()=>panel.hidden===false&&($('avatar-dialog').open||dialog.open);
  function stopAnimation(){animation?.cancel();animation=null;clearTimeout(finishTimer);finishTimer=null;dice.classList.remove('rolling');}
  function rewardLabel(reward){return reward>0?`별 파편 ${reward}개를 만들었어요!`:reward<0?`별 파편 ${-reward}개를 반납했어요.`:'이번에는 별 파편이 나오지 않았어요. 이번 주 능력은 사용 완료예요.';}
  function outcome(value){
    if(status?.constellationId==='libra'&&status.level===2)return '선생님이 주차를 확인하면 경험치를 받아요.';
    if(status?.constellationId==='libra'&&status.level>=4&&value.itemId)return `${itemOf(value.itemId)?.name||'카드'} 1장을 받았어요!`;
    if(status?.constellationId==='pisces'&&value.targetId)return `${getRoom()?.players.find(p=>p.id===value.targetId)?.nickname||'친구'}와 짝 상태가 되었어요!`;
    if(status?.constellationId==='sagittarius')return value.mode==='warning'?'내 경고 1개를 삭제했어요.':value.mode==='black-star'?'내 검은별 상태를 해제했어요.':'고른 부서의 내 경고를 모두 삭제했어요.';
    if(status?.constellationId==='cygnus'&&status.level===2)return `칭찬 메시지 ${value.uses||1}/2회 · 별 파편 1개를 받았어요.`;
    if(status?.constellationId==='cygnus'&&status.level===3)return value.approved?'푯말이 광장에 세워졌어요. 별 파편 3개를 받았어요.':'선생님의 푯말 승인을 기다리고 있어요.';
    if(status?.constellationId==='corona-borealis')return value.choice==='trial'?'Lv1 체험을 시작했어요. 다음 주 월요일에 돌아와요.':'왕관 전용 기간제 아이템을 받았어요.';
    if(value.itemId)return `${itemOf(value.itemId)?.name||'아이템'} 1개를 ${value.mode==='copy'?'복사했어요':'만들었어요'}!`;
    if(Number.isFinite(value.budget))return value.budget>0?`별 파편 ${value.budget}개 가치 이하의 아이템 1개를 고를 수 있어요.`:'이번에는 만들 수 있는 아이템이 없어요. 이번 주 능력은 사용 완료예요.';
    return rewardLabel(value.reward);
  }
  function renderChoices(){
    choices.hidden=!status?.pending||!!animation;choices.replaceChildren();
    if(!status?.pending)return;
    const copy=status.pending.mode==='copy';
    const heading=document.createElement('h3');heading.textContent=`별 파편 ${status.pending.budget}개 가치 이하 · ${copy?'복사할 아이템':'만들 아이템'} 하나 선택`;choices.append(heading);
    const grid=document.createElement('div');grid.className='ability-item-grid';choices.append(grid);
    for(const choice of status.choices||[]){
      const item=itemOf(choice.id)||choice,button=document.createElement('button');button.type='button';button.className='secondary ability-item-choice';button.disabled=busy||choice.available===false;
      if(item.art){const image=document.createElement('img');image.src=item.art;image.alt='';button.append(image);}
      const label=document.createElement('span');label.textContent=`${choice.name||item.name} · Lv${choice.level||item.level}`;
      const value=document.createElement('small');value.textContent=`별 파편 ${choice.value}개 가치 · ${copy?'복사하기':'만들기'}`;
      button.append(label,value);button.onclick=()=>void chooseItem(choice.id);grid.append(button);
    }
    const note=document.createElement('p');note.className='muted';note.textContent=copy?'가방에 있는 원래 아이템은 그대로 두고 같은 아이템 1개를 복사해요. 다음 일요일 0시 전까지 선택해 주세요.':'고른 아이템 1개만 만들어요. 남는 가치는 돌려받지 않아요. 다음 일요일 0시 전까지 선택해 주세요.';choices.append(note);
  }
  function renderPairChoices(){
    clearTimeout(pairTimer);
    const p=getPlayer(),room=getRoom?.(),pending=room?.piscesInvites?.find(i=>i.fromId===p?.id&&i.expiresAt>Date.now());
    pairChoices.hidden=status?.constellationId!=='pisces'||!status?.canUse;
    pairChoices.replaceChildren();if(pairChoices.hidden)return;
    const heading=document.createElement('h3');heading.textContent='짝이 될 친구 선택';pairChoices.append(heading);
    if(pending){const wait=document.createElement('p');wait.textContent=`${room.players.find(friend=>friend.id===pending.toId)?.nickname||'친구'}의 답을 기다리고 있어요. 거절하면 이번 주 능력은 남아요.`;pairChoices.append(wait);
      if(dialog.open)pairTimer=setTimeout(renderPairChoices,Math.max(100,pending.expiresAt-Date.now()+100));return;}
    const friends=(room?.players||[]).filter(friend=>friend.role==='student'&&friend.id!==p?.id&&friend.connected&&!friend.away);
    const select=document.createElement('select');select.setAttribute('aria-label','짝이 될 친구');
    for(const friend of friends){const option=document.createElement('option');option.value=friend.id;option.textContent=friend.nickname;select.append(option);}
    const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='짝 신청하기';button.disabled=!friends.length||busy;
    button.onclick=async()=>{
      if(busy||!select.value)return;
      busy=true;button.disabled=true;
      try{const response=await request('constellation-ability:use',{targetId:select.value});status=response;render();toast(response.message);}
      catch(error){toast(error.message);void refresh();}
      finally{busy=false;render();}
    };
    const note=document.createElement('p');note.className='muted';note.textContent='친구가 수락하면 기간 동안 둘만의 파티가 됩니다. 지금 파티에 있다면 먼저 탈퇴해 주세요.';
    pairChoices.append(select,button,note);
  }
  function renderHunterChoices(){
    huntChoices.hidden=status?.constellationId!=='sagittarius'||!status?.canUse;
    huntChoices.replaceChildren();if(huntChoices.hidden)return;
    const heading=document.createElement('h3');heading.textContent='내 경고·검은별 선택';huntChoices.append(heading);
    if(!huntOptions){const wait=document.createElement('p');wait.className='muted';wait.textContent='내 경고를 확인하고 있어요.';huntChoices.append(wait);return;}
    const button=(label,mode,payload={})=>{const element=document.createElement('button');element.type='button';element.className='secondary';element.textContent=label;element.disabled=busy;
      element.onclick=()=>void useHunter(mode,payload);return element;};
    if(status.level<=3&&huntOptions.warnings.length){
      const select=document.createElement('select');select.setAttribute('aria-label','삭제할 내 경고');
      for(const warning of huntOptions.warnings){const option=document.createElement('option');option.value=warning.id;option.textContent=`${warning.planetName} · ${warning.reason}`;select.append(option);}
      huntChoices.append(select,button('고른 경고 1개 삭제','warning',{get warningId(){return select.value;}}));
    }
    if(status.level>=4&&huntOptions.blackStarAt!==null)huntChoices.append(button('내 검은별 해제','black-star',{blackStarAt:huntOptions.blackStarAt}));
    if(status.level===5&&!status.lastResult?.mode&&huntOptions.departments.length){
      const select=document.createElement('select');select.setAttribute('aria-label','내 경고를 모두 삭제할 부서');
      for(const department of huntOptions.departments){const option=document.createElement('option');option.value=department.id;option.textContent=`${department.name} · 내 경고 ${department.count}개`;select.append(option);}
      huntChoices.append(select,button('이 부서의 내 경고 모두 삭제','department',{get planetId(){return select.value;}}));
    }
    if(!huntChoices.querySelector('button')){const empty=document.createElement('p');empty.className='muted';empty.textContent='지금 삭제할 내 경고나 검은별 상태가 없어요. 이번 주 능력은 남아 있어요.';huntChoices.append(empty);}
  }
  async function loadHunterChoices(){
    if(status?.constellationId!=='sagittarius')return;
    const key=identity();huntOptions=null;renderHunterChoices();
    try{const options=await request('constellation-ability:sagittarius-options',{});if(key!==identity())return;huntOptions=options;renderHunterChoices();}
    catch(error){toast(error.message);}
  }
  async function useHunter(mode,payload){
    if(busy)return;busy=true;renderHunterChoices();
    try{const response=await request('constellation-ability:use',{mode,...payload});status=response;huntOptions=null;render();toast(response.message);if(status.canUse)void loadHunterChoices();}
    catch(error){toast(error.message);void loadHunterChoices();}
    finally{busy=false;render();}
  }
  function renderSwanChoices(){
    swanChoices.replaceChildren();
    swanChoices.hidden=status?.constellationId!=='cygnus';if(swanChoices.hidden)return;
    const add=(tag,value)=>{const element=document.createElement(tag);element.textContent=value;swanChoices.append(element);return element;};
    if(status.level===2&&status.canUse){
      add('h3','칭찬할 친구');
      const friends=(getRoom()?.players||[]).filter(p=>p.role==='student'&&p.id!==getPlayer()?.id&&p.connected&&!p.away);
      const select=document.createElement('select');select.setAttribute('aria-label','칭찬할 친구');
      for(const friend of friends){const option=document.createElement('option');option.value=friend.id;option.textContent=friend.nickname;select.append(option);}
      swanChoices.append(select);
      const phrases=['언제나 친절하게 도와줘서 고마워!','함께할 때 정말 즐거워!','열심히 도전하는 모습이 멋져!','친구를 배려하는 마음이 참 좋아!'];
      const praise=document.createElement('select');praise.setAttribute('aria-label','칭찬 메시지');
      phrases.forEach((phrase,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=phrase;praise.append(option);});swanChoices.append(praise);
      const send=add('button','칭찬 보내기 · 별 파편 1개');send.type='button';send.className='secondary';send.disabled=!friends.length||busy;
      send.onclick=async()=>{if(busy)return;busy=true;renderSwanChoices();try{const response=await request('constellation-ability:use',{targetId:select.value,praiseIndex:Number(praise.value)});status=response;render();toast(response.message);}catch(error){toast(error.message);void refresh();}finally{busy=false;render();}};
    }else if(status.level===3){
      if(status.canUse){
        add('h3','우리 반을 위한 캠페인');
        const input=document.createElement('textarea');input.rows=3;input.maxLength=80;input.placeholder='친구들과 함께 지키고 싶은 약속을 적어 주세요.';input.setAttribute('aria-label','캠페인 푯말 문구');swanChoices.append(input);
        const send=add('button','선생님께 푯말 신청하기');send.type='button';send.className='secondary';send.disabled=busy;
        send.onclick=async()=>{if(busy)return;busy=true;send.disabled=true;try{const response=await request('constellation-ability:use',{campaignText:input.value});status=response;render();toast(response.message);}catch(error){toast(error.message);send.disabled=false;}finally{busy=false;}};
      }else if(status.lastResult?.campaignText)add('p',`신청한 문구: ${status.lastResult.campaignText}\n${status.lastResult.approved?'광장에 게시되었어요.':'선생님 승인을 기다리고 있어요.'}`);
    }else if(status.level>=4){
      const ledger=status.swanDaily;
      add('p',`이번 주 오후 3시 보상: ${ledger?Array.from({length:status.level===4?5:4},(_,i)=>ledger.awardedMask&(1<<(i+1))?'★':'○').join(' '):'아직 판정 전'}`);
      if(status.level===5){
        add('p',status.swanCardOffer?'월~목 무경고! 이번 주 별 카드 1장을 별 파편 4개에 살 수 있어요.':ledger?.cardBought?'이번 주 별 카드 구매를 마쳤어요.':'금요일에 월~목 무경고 여부를 확인해요.');
        if(status.swanCardOffer){const buy=add('button','별 카드 1장 사기 · 별 파편 4개');buy.type='button';buy.className='secondary';buy.disabled=busy;buy.onclick=async()=>{if(busy)return;busy=true;buy.disabled=true;try{const response=await request('constellation-ability:swan-card-buy',{});status=response;render();toast(response.message);}catch(error){toast(error.message);void refresh();}finally{busy=false;}};}
      }
    }
  }
  function renderCoronaChoices(){
    coronaChoices.replaceChildren();coronaChoices.hidden=status?.constellationId!=='corona-borealis';
    if(coronaChoices.hidden)return;
    if(status.level===5){const note=document.createElement('p');note.textContent='선생님 도구에서 왕관자리 Lv5 우선권 대상자로 확인할 수 있어요.';coronaChoices.append(note);return;}
    if(status.lastResult?.expiresAt){
      const note=document.createElement('p');note.textContent=`이번 주 선택: ${status.lastResult.choice==='trial'?'Lv1 체험':'기간제 아이템'} · ${new Date(status.lastResult.expiresAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}까지`;coronaChoices.append(note);
    }
    if(status.level!==4||!status.canUse)return;
    const heading=document.createElement('h3');heading.textContent='이번 주 능력 선택';coronaChoices.append(heading);
    for(const [choice,label] of [['trial','① 이번 주 Lv1 체험 → 다음 주 월요일 별 파편 5개·경험치 5'],['both','② 우주 식량·우주복 각 2개 (5일 이내·일요일 0시 만료)']]){
      const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=label;button.disabled=busy;
      button.onclick=async()=>{if(busy)return;busy=true;button.disabled=true;
        try{const response=await request('constellation-ability:use',{choice});toast(response.message);if(choice==='trial'){dialog.close();void refresh();}else{status=response;render();}}
        catch(error){toast(error.message);button.disabled=false;void refresh();}finally{busy=false;}
      };coronaChoices.append(button);
    }
  }
  async function chooseItem(itemId){
    if(busy)return;busy=true;const token=++revision,key=identity();renderChoices();
    let failed=false;
    try{
      const response=await request('constellation-ability:choose-item',{itemId});
      if(token!==revision||key!==identity())return;
      status=response;showResult(response.lastResult||{itemId});render();
    }catch(error){failed=true;if(token===revision&&key===identity())toast(error.message);}
    finally{if(token===revision){busy=false;renderChoices();if(failed)void refresh();}}
  }
  function showResult(value,animate=false){
    stopAnimation();dice.hidden=!value?.roll;
    dice.classList.toggle('multi-roll',!!(value?.rolls?.length>1));
    rollFaces.hidden=true;rollFaces.replaceChildren();
    if(!value)return;
    if(!value.roll){resultText.textContent='';$('ability-outcome').textContent=outcome(value);return;}
    $('ability-outcome').textContent='';
    cube.style.transform=FACE[value.roll];
    const finish=()=>{
      dice.classList.remove('rolling');animation=null;finishTimer=null;
      cube.setAttribute('aria-label',`주사위 ${value.roll}`);
      if(value.rolls?.length>1){
        rollFaces.hidden=false;
        for(const roll of value.rolls){
          const face=document.createElement('span');face.className='ability-roll-face';face.setAttribute('role','img');face.setAttribute('aria-label',`주사위 ${roll}`);
          for(const cell of PIPS[roll]){const pip=document.createElement('span');pip.className='die-pip';pip.textContent='✦';pip.style.gridArea=`${Math.ceil(cell/3)} / ${(cell-1)%3+1}`;face.append(pip);}
          rollFaces.append(face);
        }
      }
      resultText.textContent=`주사위 ${(value.rolls||[value.roll]).join(' · ')} · ${outcome(value)}`;renderChoices();
    };
    if(!animate||matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
    cube.setAttribute('aria-label','주사위 굴리는 중');resultText.textContent='별 주사위가 굴러가요…';dice.classList.add('rolling');
    animation=cube.animate([
      {transform:'translateY(-12px) rotateX(-28deg) rotateY(28deg)'},
      {transform:'translateY(-22px) rotateX(400deg) rotateY(470deg)',offset:.42},
      {transform:`translateY(0) rotateX(720deg) rotateY(720deg) ${FACE[value.roll]}`}
    ],{duration:1500,easing:'cubic-bezier(.18,.7,.24,1)'});
    finishTimer=setTimeout(finish,1500);renderChoices();
  }
  function render(){
    use.textContent=status?.passive?(status.used?'사용 완료':'자동 적용'):status?.used?'사용 완료':'능력 사용';
    use.disabled=busy||!!status?.passive||!status?.canUse;
    use.setAttribute('aria-busy',String(busy));
    const p=getPlayer(),name=constellationOf(p?.avatar?.constellationId,p?.avatar?.level)?.name||'별자리';
    $('ability-title').textContent=`${name} Lv${p?.avatar?.level||1} · 별자리 능력`;
    $('ability-description').textContent=status?.description||'능력 정보를 불러오는 중이에요.';
    const note=!status?'능력 정보를 확인하고 있어요.':status.pending?`능력효과를 눌러 ${status.pending.mode==='copy'?'복사할':'만들'} 아이템을 골라 주세요.`:!status.configured?'이 별자리의 능력은 준비 중이에요.':p?.role==='teacher'?'선생님은 효과를 확인할 수 있어요. 능력 사용은 학생 전용이에요.':status.used?'이번 주 능력을 사용했어요.':['sagittarius','cygnus'].includes(status.constellationId)&&status.uses?`이번 주 ${status.uses}/${status.useLimit}회 사용했어요.`:status.message||'이번 주 능력을 사용할 수 있어요.';
    const passiveNote=status?.blockedByChange?status.message:status?.constellationId==='corona-borealis'&&status?.level===5?'상시 우선권 · 선생님이 자리 바꾸기와 급식 자리 선택에서 확인해 주세요.':status?.constellationId==='cygnus'&&status?.level>=4?'매일 오후 3시 자동 판정 · 능력효과에서 이번 주 기록을 볼 수 있어요.':status?.passive?`자동 패시브 · 부서 경고 ${status.warningUsed||0}/${status.warningLimit||1}회${status.blackLimit?` · 검은별 ${status.blackUsed||0}/${status.blackLimit}회`:''}`:note;
    $('self-ability-status').textContent=passiveNote;
    $('ability-status').textContent=passiveNote+'\n매주 일요일 오전 0시(한국 시간)에 다시 사용할 수 있어요.\n별자리를 바꾸거나 진화해도 사용 기록은 유지돼요.';
    if(status?.used&&status.lastResult&&!animation)showResult(status.lastResult);
    if(!status?.used){dice.hidden=true;$('ability-outcome').textContent='';}
    renderChoices();renderPairChoices();renderHunterChoices();renderSwanChoices();renderCoronaChoices();updateReminder();
  }
  function scheduleReset(){
    clearTimeout(resetTimer);
    if(visible()&&Number.isFinite(status?.nextResetAt)){
      const delay=Math.max(250,Math.min(2147483647,status.nextResetAt-Date.now()+100));
      resetTimer=setTimeout(()=>{if(visible())void refresh();},delay);
    }
  }
  async function refresh(){
    if(panel.hidden||busy)return;
    const token=++revision,key=identity();
    panel.setAttribute('aria-busy','true');use.disabled=true;
    try{
      const response=await request('constellation-ability:status',{});
      if(token!==revision||key!==identity())return;
      status=response;render();scheduleReset();
    }catch(error){
      if(token!==revision||key!==identity())return;
      status=null;render();$('self-ability-status').textContent='정보를 확인하지 못했어요. 능력효과 버튼을 다시 눌러 주세요.';
      $('ability-status').textContent=error.message;
    }finally{if(token===revision)panel.setAttribute('aria-busy','false');}
  }
  function open(){stop();window.dispatchEvent(new Event('game-ui-focus'));if(!dialog.open)dialog.showModal();}
  $('self-ability-effect').onclick=()=>{open();void refresh().then(()=>{if(status?.constellationId==='sagittarius')void loadHunterChoices();});};
  $('ability-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{stopAnimation();clearTimeout(pairTimer);scheduleReset();});
  use.onclick=async()=>{
    if(busy||!status?.canUse)return;
    if(status.constellationId==='pisces'){open();renderPairChoices();return;}
    if(status.constellationId==='sagittarius'){open();void loadHunterChoices();return;}
    if(status.constellationId==='cygnus'){open();renderSwanChoices();return;}
    if(status.constellationId==='corona-borealis'&&status.level===4){open();renderCoronaChoices();return;}
    const token=++revision,key=identity();busy=true;render();let failed=false;
    try{
      const response=await request('constellation-ability:use',{});
      if(token!==revision||key!==identity())return;
      status=response;render();open();showResult(response.lastResult||{roll:response.roll,reward:response.reward,budget:response.pending?.budget},true);scheduleReset();
    }catch(error){failed=true;if(token===revision&&key===identity())toast(error.message);}
    finally{if(token===revision){busy=false;render();if(failed)void refresh();}}
  };
  new MutationObserver(()=>{if($('avatar-dialog').open)void refresh();else scheduleReset();}).observe($('avatar-dialog'),{attributes:true,attributeFilter:['open']});
  window.addEventListener('focus',()=>{if(visible())void refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&visible())void refresh();});
  return {
    update(){
      const p=getPlayer(),next=identity();
      panel.dataset.constellation=p?.avatar?.constellationId||'';panel.dataset.level=String(p?.avatar?.level||1);
      panel.hidden=!(p?.avatar?.level>=2&&constellationOf(p.avatar.constellationId)?.type);
      if(next!==signature){signature=next;++revision;busy=false;status=null;huntOptions=null;stopAnimation();clearTimeout(resetTimer);dice.hidden=true;$('ability-outcome').textContent='';render();
        if(panel.hidden&&dialog.open)dialog.close();else if(visible())void refresh();}
      const incoming=p?.constellationAbility,nextSnapshot=JSON.stringify(incoming||null);
      if(incoming&&!busy&&!animation&&nextSnapshot!==snapshotSignature){snapshotSignature=nextSnapshot;++revision;status=incoming;panel.setAttribute('aria-busy','false');render();scheduleReset();}
      const pairState=getRoom?.(),nextPair=JSON.stringify({invites:pairState?.piscesInvites||[],friends:(pairState?.players||[]).map(friend=>[friend.id,friend.connected,friend.away])});
      if(nextPair!==pairSignature){pairSignature=nextPair;if(status?.constellationId==='pisces')renderPairChoices();}
    },
    reset(){++revision;signature='';snapshotSignature='';pairSignature='';busy=false;status=null;huntOptions=null;stopAnimation();clearTimeout(resetTimer);clearTimeout(pairTimer);clearTimeout(reminderTimer);clearTimeout(messageTimer);reminder.hidden=true;reminderMessage.hidden=true;panel.hidden=true;if(dialog.open)dialog.close();}
  };
}
