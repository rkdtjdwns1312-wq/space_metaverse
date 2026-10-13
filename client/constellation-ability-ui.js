import {constellationOf} from '/shared/constellations.js';
import {itemOf} from '/shared/config.js';

const PIPS={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
const FACE={1:'rotateX(0deg) rotateY(0deg)',2:'rotateY(-90deg)',3:'rotateX(90deg)',4:'rotateX(-90deg)',5:'rotateY(90deg)',6:'rotateY(180deg)'};

export function createConstellationAbilityUI({request,getPlayer,stop,toast}){
  const $=id=>document.getElementById(id),panel=$('self-ability-panel'),use=$('self-ability-use');
  const dialog=$('ability-dialog'),cube=$('ability-cube'),dice=$('ability-dice'),resultText=$('ability-dice-result');
  let status=null,signature='',snapshotSignature='',revision=0,busy=false,animation=null,finishTimer=null,resetTimer=null,reminderTimer=null,messageTimer=null;
  const choices=document.createElement('section');choices.id='ability-item-choices';choices.hidden=true;dice.after(choices);
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
    if(!value)return;
    if(!value.roll){resultText.textContent='';$('ability-outcome').textContent=outcome(value);return;}
    $('ability-outcome').textContent='';
    cube.style.transform=FACE[value.roll];
    const finish=()=>{
      dice.classList.remove('rolling');animation=null;finishTimer=null;
      cube.setAttribute('aria-label',`주사위 ${value.roll}`);
      resultText.textContent=`주사위 ${value.roll} · ${outcome(value)}`;renderChoices();
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
    const note=!status?'능력 정보를 확인하고 있어요.':status.pending?`능력효과를 눌러 ${status.pending.mode==='copy'?'복사할':'만들'} 아이템을 골라 주세요.`:!status.configured?'이 별자리의 능력은 준비 중이에요.':p?.role==='teacher'?'선생님은 효과를 확인할 수 있어요. 능력 사용은 학생 전용이에요.':status.used?'이번 주 능력을 사용했어요.':status.message||'이번 주 능력을 사용할 수 있어요.';
    const passiveNote=status?.blockedByChange?status.message:status?.passive?`자동 패시브 · 부서 경고 ${status.warningUsed||0}/${status.warningLimit||1}회${status.blackLimit?` · 검은별 ${status.blackUsed||0}/${status.blackLimit}회`:''}`:note;
    $('self-ability-status').textContent=passiveNote;
    $('ability-status').textContent=passiveNote+'\n매주 일요일 오전 0시(한국 시간)에 다시 사용할 수 있어요.\n별자리를 바꾸거나 진화해도 사용 기록은 유지돼요.';
    if(status?.used&&status.lastResult&&!animation)showResult(status.lastResult);
    if(!status?.used){dice.hidden=true;$('ability-outcome').textContent='';}
    renderChoices();updateReminder();
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
  $('self-ability-effect').onclick=()=>{open();void refresh();};
  $('ability-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{stopAnimation();scheduleReset();});
  use.onclick=async()=>{
    if(busy||!status?.canUse)return;
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
      if(next!==signature){signature=next;++revision;busy=false;status=null;stopAnimation();clearTimeout(resetTimer);dice.hidden=true;$('ability-outcome').textContent='';render();
        if(panel.hidden&&dialog.open)dialog.close();else if(visible())void refresh();}
      const incoming=p?.constellationAbility,nextSnapshot=JSON.stringify(incoming||null);
      if(incoming&&!busy&&!animation&&nextSnapshot!==snapshotSignature){snapshotSignature=nextSnapshot;++revision;status=incoming;panel.setAttribute('aria-busy','false');render();scheduleReset();}
    },
    reset(){++revision;signature='';snapshotSignature='';busy=false;status=null;stopAnimation();clearTimeout(resetTimer);clearTimeout(reminderTimer);clearTimeout(messageTimer);reminder.hidden=true;reminderMessage.hidden=true;panel.hidden=true;if(dialog.open)dialog.close();}
  };
}
