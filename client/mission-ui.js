// 별 미션 게시판: 선생님이 조건을 확인한 뒤 학생이 직접 보상을 받습니다.
import {RULES} from '/shared/config.js';
export function createMissionUI({request,stop,toast,getRoom,getSelfId,onTutorial}){
  const $=id=>document.getElementById(id);
  const dialog=document.createElement('dialog');dialog.id='mission-board-dialog';
  dialog.innerHTML='<h2>별 미션 게시판</h2><p id="mission-board-intro" class="muted">미션을 받고 조건을 달성해 보세요. 자동미션은 게임 안에서 달성되며, 일반 미션은 선생님이 확인해요.</p><section id="mission-create" hidden><h3>새 미션 만들기</h3><label for="mission-title">미션 이름</label><input id="mission-title" maxlength="40" placeholder="예: 오늘의 별빛 약속"><label for="mission-description">완료 조건</label><textarea id="mission-description" maxlength="240" rows="3" placeholder="어떤 일을 하면 완료되는지 적어 주세요."></textarea><label for="mission-reward">보상 · 별 파편</label><input id="mission-reward" type="number" min="1" max="10" value="1"><label for="mission-distribution">나누는 방법</label><select id="mission-distribution"><option value="all">교실 친구 모두에게 나누기</option><option value="board">친구들이 게시판에서 직접 받기</option></select><button id="mission-create-button" class="primary" type="button">미션 만들기</button></section><section id="mission-auto-create" hidden><h3>자동미션 만들기</h3><label for="mission-auto-title">미션 이름</label><input id="mission-auto-title" maxlength="40" placeholder="예: 별빛 여행자"><label for="mission-auto-objective">게임 안의 완료 조건</label><select id="mission-auto-objective"><option value="map-travel">다른 맵으로 이동하기</option><option value="energy-collect">우주에너지 줍기</option><option value="stars-win">반짝별 찾기 성공하기</option><option value="memory-win">별그림 짝맞추기 성공하기</option><option value="english-success">별 영어 발전소 성공하기</option></select><p id="mission-auto-guide" class="muted">맵의 문을 지나 다른 맵으로 이동할 때 1회로 셉니다.</p><label for="mission-auto-goal">목표 횟수</label><input id="mission-auto-goal" type="number" min="1" max="10" value="1"><label for="mission-auto-reward">보상 · 별 파편</label><input id="mission-auto-reward" type="number" min="1" max="10" value="1"><label for="mission-auto-distribution">나누는 방법</label><select id="mission-auto-distribution"><option value="all">교실 친구 모두에게 나누기</option><option value="board">친구들이 게시판에서 직접 받기</option></select><button id="mission-auto-create-button" class="primary" type="button">자동미션 만들기</button></section><h3 id="mission-board-list-title">받을 수 있는 미션</h3><div id="mission-board-list" class="mission-list"></div><p id="mission-board-error" role="alert"></p><div class="dialog-actions"><button id="mission-board-close" class="secondary" type="button">닫기</button></div>';
  document.body.append(dialog);
  for(const prefix of ['mission','mission-auto']){
    $(`${prefix}-create-button`).insertAdjacentHTML('beforebegin',`<div class="mission-limits"><label for="${prefix}-capacity">선착순 수령 인원</label><input id="${prefix}-capacity" type="number" min="1" max="${RULES.maxStudents}" step="1" placeholder="제한 없음"><p class="muted">게시판에서 직접 받는 미션에 설정할 수 있어요.</p><label for="${prefix}-hours">유효기간 · 시간</label><input id="${prefix}-hours" type="number" min="1" max="8760" step="1" placeholder="제한 없음"><p class="muted">만든 시각부터 계산해요. 시간이 끝나면 받기·완료·보상 수령이 모두 마감돼요.</p></div>`);
    const distribution=$(`${prefix}-distribution`),capacity=$(`${prefix}-capacity`);
    distribution.onchange=()=>{capacity.disabled=distribution.value!=='board';if(capacity.disabled)capacity.value='';};distribution.onchange();
  }
  const limitsData=prefix=>({maxRecipients:$(`${prefix}-capacity`).disabled||!$(`${prefix}-capacity`).value.trim()?null:Number($(`${prefix}-capacity`).value),
    validityHours:!$(`${prefix}-hours`).value.trim()?null:Number($(`${prefix}-hours`).value)});
  dialog.querySelector('label[for="mission-auto-distribution"]').insertAdjacentHTML('beforebegin','<label for="mission-auto-repeat">반복하기</label><select id="mission-auto-repeat"><option value="">한 번만 나누기</option><option value="daily">매일 반복해서 나누기</option></select><p id="mission-daily-guide" class="muted" hidden>매일 한국시간 자정에 새로 시작해요. 오늘 받지 않은 보상은 사라져요.</p>');
  $('mission-auto-reward').insertAdjacentHTML('afterend','<fieldset id="mission-auto-rewards"><legend>보상 선택</legend><label><input type="checkbox" data-reward-type="star-crumb"> 별 부스러기</label><input type="number" data-reward-quantity="star-crumb" min="1" max="10" step="1" value="1" aria-label="별 부스러기 수량"><label><input type="checkbox" data-reward-type="star-shard" checked> 별 파편</label><input type="number" data-reward-quantity="star-shard" min="1" max="10" step="1" value="1" aria-label="별 파편 수량"><label><input type="checkbox" data-reward-type="cosmic-energy"> 우주에너지</label><input type="number" data-reward-quantity="cosmic-energy" min="1" max="10" step="1" value="1" aria-label="우주에너지 수량"></fieldset>');
  const autoRewards=$('mission-auto-rewards');
  $('mission-auto-reward').previousElementSibling.hidden=true;
  $('mission-auto-reward').hidden=true;
  for(const checkbox of autoRewards.querySelectorAll('[data-reward-type]')){
    const quantity=autoRewards.querySelector(`[data-reward-quantity="${checkbox.dataset.rewardType}"]`);
    checkbox.onchange=()=>{quantity.disabled=!checkbox.checked;};checkbox.onchange();
  }
  const selectedRewards=()=>[...autoRewards.querySelectorAll('[data-reward-type]:checked')].map(input=>{
    const type=input.dataset.rewardType,quantity=Number(autoRewards.querySelector(`[data-reward-quantity="${type}"]`).value);
    if(!Number.isSafeInteger(quantity)||quantity<1||quantity>10)throw new Error('선택한 보상 수량은 1~10개로 정해 주세요.');
    return {type,quantity};
  });
  $('mission-auto-repeat').onchange=()=>{
    const daily=$('mission-auto-repeat').value==='daily',distribution=$('mission-auto-distribution');
    distribution.disabled=daily;if(daily)distribution.value='all';distribution.onchange();
    $('mission-daily-guide').hidden=!daily;$('mission-auto-hours').max=daily?'24':'8760';
    $('mission-auto-hours').placeholder=daily?'오늘 자정까지':'제한 없음';
    if(daily&&Number($('mission-auto-hours').value)>24)$('mission-auto-hours').value='24';
    const tutorialOption=$('mission-auto-objective').querySelector('[value="tutorial-complete"]');if(tutorialOption)tutorialOption.disabled=daily;
    if(daily&&$('mission-auto-objective').value==='tutorial-complete'){$('mission-auto-objective').value='timetable-read';$('mission-auto-objective').onchange();}
  };
  const rewardNames={'star-crumb':'별 부스러기','star-shard':'별 파편','cosmic-energy':'우주에너지'};
  const rewardText=mission=>mission.rewards?.length?mission.rewards.map(reward=>`${rewardNames[reward.type]} ${reward.quantity}개`).join(' · '):
    `${mission.rewardItem==='star-crumb'?'별 부스러기':'별 파편'} ${mission.rewardQuantity??mission.rewardShards}개`;
  $('mission-auto-guide').insertAdjacentHTML('afterend','<div id="mission-auto-grade-row" hidden><label for="mission-auto-grade">수학 단계</label><select id="mission-auto-grade"><option value="1">기초 1학년</option><option value="2">기초 2학년</option><option value="3">중급 3학년</option><option value="4">중급 4학년</option><option value="5">고급 5학년</option><option value="6">고급 6학년</option></select></div><div id="mission-auto-item-level-row" hidden><label for="mission-auto-item-level">완성 아이템 레벨</label><select id="mission-auto-item-level"><option value="2">LV2</option><option value="3">LV3</option><option value="4">LV4</option><option value="5">LV5</option></select></div>');
  const mineDialog=$('student-missions-dialog'),mine=$('my-missions'),mineEmpty=$('my-missions-empty');
  const notice=document.createElement('button');notice.id='new-mission-notice';notice.type='button';notice.className='secondary';notice.hidden=true;
  notice.innerHTML='<span role="status" aria-live="polite"></span>';document.body.append(notice);
  const newBadge=document.createElement('span');newBadge.className='mission-new-badge';newBadge.hidden=true;newBadge.textContent='새 미션';$('dock-chat').append(newBadge);
  let seenKey='',seen=new Set();
  function missionNotice(markRead=false){
    const room=getRoom(),me=room?.players.find(p=>p.id===getSelfId());
    if(me?.role!=='student'){notice.hidden=true;newBadge.hidden=true;return;}
    const key=`space-class-missions-seen:${room.code}:${me.id}`;
    if(seenKey!==key){seenKey=key;seen=new Set();try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))seen=new Set(saved.filter(id=>typeof id==='string'));}catch{}}
    const missions=room.missions||[],current=missions.filter(m=>['active','ready'].includes(m.status));
    if(markRead){
      seen=new Set(missions.filter(m=>seen.has(m.id)||current.some(n=>n.id===m.id)).map(m=>m.id));
      try{localStorage.setItem(key,JSON.stringify([...seen]));}catch{}
    }
    const count=current.filter(m=>!seen.has(m.id)).length;
    notice.hidden=!count;newBadge.hidden=!count;
    const text=`새 미션 ${count}개가 있어요 · 확인하기`;
    if(notice.firstElementChild.textContent!==text)notice.firstElementChild.textContent=text;
  }
  notice.onclick=()=>{openMine();category='active';selectedId=null;update();};
  let category=null,selectedId=null,lastView='';
  const pending=new Set();
  const dateFormat=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  function openMine(){
    if(getRoom()?.players.find(p=>p.id===getSelfId())?.role!=='student')return;
    stop();category=null;selectedId=null;lastView='';
    missionNotice(true);
    if(!mineDialog.open)mineDialog.showModal();update();
  }
  for(const [id,value] of [['missions-completed','claimed'],['missions-active','active']])$(id).onclick=()=>{category=value;selectedId=null;update();};
  $('missions-back').onclick=()=>{if(selectedId)selectedId=null;else category=null;update();};
  $('missions-close').onclick=()=>mineDialog.close();
  mineDialog.addEventListener('close',()=>{$('world').focus();});
  function card(mission){
    const node=document.createElement('section');node.className='mission-card';
    const title=document.createElement('h4');title.textContent=mission.title;
    const condition=document.createElement('p');condition.textContent=mission.description;
    const reward=document.createElement('p');reward.className='mission-reward';reward.textContent=`보상 · ${rewardText(mission)}`;
    node.append(title,condition,reward);
    const limits=document.createElement('p');limits.className='mission-status';
    limits.textContent=[mission.maxRecipients?`선착순 ${mission.acceptedCount} / ${mission.maxRecipients}명`:'',mission.expiresAt?`마감 ${dateFormat.format(new Date(mission.expiresAt))}`:'',mission.expired?'기간 만료':mission.full?'선착순 마감':''].filter(Boolean).join(' · ');
    if(limits.textContent)node.append(limits);return node;
  }
  function update(){
    missionNotice(mineDialog.open);
    if(!mineDialog.open)return;
    const me=getRoom()?.players.find(p=>p.id===getSelfId());
    if(me?.role!=='student'){mineDialog.close();return;}
    const missions=getRoom()?.missions||[],selected=missions.find(m=>m.id===selectedId);
    if(selectedId&&!selected)selectedId=null;
    if(selected)category=selected.status==='claimed'?'claimed':'active';
    const signature=JSON.stringify([missions,category,selectedId,[...pending]]);
    if(signature===lastView)return;lastView=signature;
    const completed=category==='claimed';
    $('student-missions-title').textContent=selected?selected.title:category?(completed?'완료한 미션보기':'진행중인 미션보기'):'미션 확인하기';
    $('mission-categories').hidden=category!==null;
    $('missions-back').hidden=category===null;
    $('missions-back').textContent=selected?'목록으로':'이전';
    mine.hidden=category===null||!!selected;mine.replaceChildren();
    const detail=$('mission-detail');detail.hidden=!selected;detail.replaceChildren();
    mineEmpty.hidden=true;
    if(selected){
      const fields=document.createElement('dl');fields.className='mission-detail-fields';
      const field=(label,value)=>{const term=document.createElement('dt'),text=document.createElement('dd');term.textContent=label;text.textContent=value;fields.append(term,text);};
      field(completed?'완료내용':'달성조건',selected.description);
      if(completed)field('완료한날짜',Number.isSafeInteger(selected.claimedAt)?dateFormat.format(new Date(selected.claimedAt)):'기록 없음');
      if(selected.expiresAt)field('유효기간',`${dateFormat.format(new Date(selected.expiresAt))}까지`);
      if(selected.repeat==='daily')field('반복',`매일 반복${selected.day?' · '+selected.day:''}`);
      field('보상',rewardText(selected));detail.append(fields);
      if(!completed){
        const status=document.createElement('p');status.className='muted';
        status.textContent=selected.status==='expired'?'기간이 끝나 완료와 보상 수령이 마감됐어요.':selected.status==='ready'?'조건 달성 · 완료를 눌러 보상을 받으세요.':selected.objective?`진행 중 · ${selected.progress} / ${selected.goal}회`:selected.kind==='tutorial'?'화살표 안내를 따라 이번 미션의 행동을 완료해 보세요.':'선생님의 달성 확인을 기다려요.';detail.append(status);
        if(selected.kind==='tutorial'&&selected.status==='active'){
          const start=document.createElement('button');start.type='button';start.className='secondary';start.textContent='첫 여행 안내 시작하기';start.onclick=()=>{mineDialog.close();onTutorial();};detail.append(start);
        }
        if(selected.status==='ready'){
          const button=document.createElement('button');button.id='mission-claim';button.type='button';button.className='primary';button.textContent='완료';button.disabled=pending.has(selected.id);
          button.onclick=async()=>{
            if(pending.has(selected.id))return;pending.add(selected.id);update();
            try{const result=await request('mission:claim',{missionId:selected.id});toast(`미션 완료! ${rewardText(result)}를 받았어요.`);}
            catch(error){toast(error.message);}
            finally{pending.delete(selected.id);update();}
          };detail.append(button);
        }
      }
    }else if(category){
      const visible=missions.filter(m=>completed?m.status==='claimed':['active','ready','expired'].includes(m.status));
      mineEmpty.hidden=visible.length>0;mineEmpty.textContent=completed?'아직 완료한 미션이 없어요.':'진행 중인 미션이 없어요.';
      for(const mission of visible){
        const button=document.createElement('button');button.type='button';button.className='secondary mission-title-row';button.textContent=mission.title+(mission.status==='expired'?' · 기간 만료':'');button.title=mission.title;button.dataset.missionId=mission.id;
        button.onclick=()=>{selectedId=mission.id;update();};mine.append(button);
      }
    }
  }
  async function refreshBoard(){
    const me=getRoom()?.players.find(p=>p.id===getSelfId());
    const result=await request('mission:board:read',{});
    $('mission-create').hidden=true;$('mission-auto-create').hidden=true;
    $('mission-board-list-title').textContent=me?.role==='teacher'?'교실 미션':'받을 수 있는 미션';
    const list=$('mission-board-list');list.replaceChildren();
    if(!result.missions.length){const p=document.createElement('p');p.className='muted';p.textContent=me?.role==='teacher'?'아직 만든 미션이 없어요.':'지금 받을 수 있는 미션이 없어요.';list.append(p);return;}
    for(const mission of result.missions){
      const node=card(mission);
      if(me?.role==='teacher'){
        const tag=document.createElement('p');tag.className='mission-status';tag.textContent=(mission.repeat==='daily'?'매일 반복 · ':mission.objective?'자동미션 · ':'일반 미션 · ')+(mission.distribution==='all'?'전체 배포':'게시판에서 직접 받기');node.append(tag);
        if(mission.repeat==='daily'&&mission.templateId&&mission.templateId!=='builtin-timetable'&&!mission.repeatStopped){
          const pause=document.createElement('button');pause.type='button';pause.className='small secondary';pause.textContent='내일부터 반복 중지';
          pause.onclick=async()=>{pause.disabled=true;try{await request('mission:repeat:stop',{templateId:mission.templateId});await refreshBoard();toast('오늘 미션은 유지하고 내일부터 반복을 중지했어요.');}catch(error){toast(error.message);pause.disabled=false;}};node.append(pause);
        }
        const students=document.createElement('div');students.className='mission-students';
        for(const student of mission.students){
          const row=document.createElement('div'),name=document.createElement('span');name.textContent=student.nickname;
          const button=document.createElement('button');button.type='button';button.className='small secondary';
          button.textContent=student.status==='claimed'?'보상 받음':student.status==='expired'?'기간 만료':student.status==='ready'?'확인 완료':mission.objective?`${student.progress} / ${mission.goal}회`:'달성 확인';button.disabled=student.status!=='active'||!!mission.objective;
          button.onclick=async()=>{button.disabled=true;try{await request('mission:confirm',{missionId:mission.id,studentId:student.id});await refreshBoard();toast(`${student.nickname} 친구의 달성을 확인했어요.`);}catch(error){toast(error.message);button.disabled=false;}};
          row.append(name,button);students.append(row);
        }
        if(mission.students.length)node.append(students);
      }else{
        const button=document.createElement('button');button.type='button';button.className='primary';button.textContent=mission.expired?'기간 만료':mission.full?'선착순 마감':'미션 받기';button.disabled=!!(mission.expired||mission.full);
        button.onclick=async()=>{button.disabled=true;try{await request('mission:accept',{missionId:mission.id});await refreshBoard();toast('미션을 받았어요. 소통 → 미션 확인하기 → 진행중인 미션보기에서 확인할 수 있어요.');}catch(error){toast(error.message);button.disabled=false;}};
        node.append(button);
      }
      list.append(node);
    }
  }
  $('mission-create-button').onclick=async()=>{
    const button=$('mission-create-button');button.disabled=true;$('mission-board-error').textContent='';
    try{await request('mission:create',{title:$('mission-title').value,description:$('mission-description').value,
      rewardShards:Number($('mission-reward').value),distribution:$('mission-distribution').value,...limitsData('mission')});
      $('mission-title').value='';$('mission-description').value='';await refreshBoard();$('mission-create').hidden=false;toast('새 미션을 만들었어요.');}
    catch(error){$('mission-board-error').textContent=error.message;}
    finally{button.disabled=false;}
  };
  $('mission-auto-objective').insertAdjacentHTML('beforeend','<option value="math-correct">별 수학 발전소 학년별 정답</option><option value="craft-level">레벨별 아이템 조합 성공</option><option value="baseball-win">숫자야구 난이도별 성공</option><option value="sudoku-win">별빛 스도쿠 난이도별 성공</option><option value="signal-stage">우주 신호 목표 단계 성공</option><option value="tutorial-complete">첫 여행 안내 완료</option><option value="life-star-complete">생명의별 회복 완료</option>');
  const starOption=$('mission-auto-objective').querySelector('[value="stars-win"]');starOption.value='tetris-lines';starOption.textContent='별 테트리스 줄 지우기';
  $('mission-auto-objective').querySelector('[value="memory-win"]').textContent='별그림 짝맞추기 상 성공';
  starOption.insertAdjacentHTML('afterend','<option value="dodge-record">별 피하기 내 신기록 달성</option>');
  $('mission-auto-item-level-row').insertAdjacentHTML('afterend','<div id="mission-auto-difficulty-row" hidden><label for="mission-auto-difficulty">게임 난이도</label><select id="mission-auto-difficulty"><option value="low">하</option><option value="medium">중</option><option value="high">상</option></select></div><div id="mission-auto-stage-row" hidden><label for="mission-auto-stage">목표 단계</label><select id="mission-auto-stage"><option value="1">1단계</option><option value="2">2단계</option><option value="3">3단계</option><option value="4">4단계</option><option value="5">5단계</option><option value="6">6단계</option></select></div>');
  $('mission-auto-goal').max='100';
  const objectiveText={'map-travel':'다른 맵으로 이동하기','energy-collect':'우주에너지 줍기','tetris-lines':'별 테트리스 줄 지우기','dodge-record':'별 피하기 내 신기록 달성하기','memory-win':'별그림 짝맞추기 상 난이도 성공하기','english-success':'별 영어 발전소 10문제 중 7문제 이상 맞히기','tutorial-complete':'첫 여행 안내 완료하기','life-star-complete':'생명의별 회복 완료하기'};
  const objectiveGuide={'map-travel':'맵의 문을 지나 다른 맵으로 이동할 때 1회로 셉니다.','energy-collect':'우주에너지 드랍을 직접 주울 때 1회로 셉니다.','tetris-lines':'한 판이 끝나면 그 판에서 지운 줄 수를 더해요.','dodge-record':'이전 나의 기록보다 더 오래 별을 피하면 1회입니다. 첫 기록도 신기록으로 셉니다.','memory-win':'별그림 짝맞추기 상 난이도를 성공하면 1회로 셉니다.','english-success':'영어 문제 10개 중 7개 이상 맞히면 성공 1회입니다.','math-correct':'선택한 학년 단계의 문제를 맞힐 때마다 1회로 셉니다.','craft-level':'선택한 레벨의 아이템 조합에 성공할 때마다 1회로 셉니다.','baseball-win':'선택한 난이도에서 숫자야구를 이기면 1회입니다.','sudoku-win':'선택한 난이도의 스도쿠를 완성하면 1회입니다.','signal-stage':'선택한 단계에 도달하면 달성합니다.','tutorial-complete':'첫 여행 안내의 모든 단계를 마치면 달성합니다.','life-star-complete':'광장에서 생명의별을 조사하고 회복을 끝내면 달성합니다.'};
  $('mission-auto-objective').insertAdjacentHTML('beforeend','<option value="timetable-read">오늘의 시간표 확인하기</option>');
  objectiveText['timetable-read']='시간표 기둥에서 오늘의 시간표 확인하기';
  objectiveGuide['timetable-read']='광장의 오늘의 시간표 기둥과 상호작용하면 달성합니다.';
  for(const [id,label,guide] of [
    ['culture-read','별 교양 발전소 책 읽기','책을 읽고 다 읽음을 눌러 보상을 받을 때 1회입니다. 같은 책은 하루 한 번, 하루 10권까지 셉니다.'],
    ['history-read','별 역사 발전소 역사 글 읽기','역사 글을 읽고 다 읽음을 눌러 보상을 받을 때 1회입니다. 같은 글은 하루 한 번, 하루 10편까지 셉니다.'],
    ['science-read','별 과학 발전소 상식 읽기','과학 상식을 읽고 읽음을 눌러 보상을 받을 때 1회입니다. 하루 2편까지 셉니다.'],
    ['one-stroke-win','별 길 한번에 그리기 성공','선택한 난이도에서 모든 선을 한 번씩 이어 완성하면 1회입니다.']]){
    $('mission-auto-objective').append(new Option(label,id));objectiveText[id]=label;objectiveGuide[id]=guide;
  }
  $('mission-auto-objective').onchange=()=>{const objective=$('mission-auto-objective').value;
    $('mission-auto-guide').textContent=objectiveGuide[objective];
    $('mission-auto-grade-row').hidden=objective!=='math-correct';
    $('mission-auto-item-level-row').hidden=objective!=='craft-level';
    $('mission-auto-difficulty-row').hidden=!['baseball-win','sudoku-win','one-stroke-win'].includes(objective);
    $('mission-auto-stage-row').hidden=objective!=='signal-stage';
    const oneTime=['signal-stage','tutorial-complete','life-star-complete','timetable-read'].includes(objective);
    $('mission-auto-goal').disabled=oneTime;if(oneTime)$('mission-auto-goal').value='1';
  };
  $('mission-auto-create-button').onclick=async()=>{
    const button=$('mission-auto-create-button');button.disabled=true;$('mission-board-error').textContent='';
    try{const objective=$('mission-auto-objective').value,goal=Number($('mission-auto-goal').value),
      grade=Number($('mission-auto-grade').value),itemLevel=Number($('mission-auto-item-level').value),
      difficulty=$('mission-auto-difficulty').value,stage=Number($('mission-auto-stage').value),
      description=['tutorial-complete','life-star-complete'].includes(objective)?objectiveText[objective]
        :objective==='math-correct'?`별 수학 발전소 ${grade}학년 단계 정답 ${goal}회 맞히기`
        :objective==='craft-level'?`LV${itemLevel} 아이템 조합 ${goal}회 성공하기`
        :objective==='signal-stage'?`우주 신호 따라하기 ${stage}단계 성공하기`
        :['baseball-win','sudoku-win','one-stroke-win'].includes(objective)?`${objective==='baseball-win'?'숫자야구':objective==='one-stroke-win'?'별 길 한번에 그리기':'별빛 스도쿠'} ${difficulty==='high'?'상':difficulty==='medium'?'중':'하'} ${goal}회 성공하기`
        :`${objectiveText[objective]} ${objective==='tetris-lines'?goal+'줄':goal+'회'}`;
      const daily=$('mission-auto-repeat').value==='daily',rewards=selectedRewards();
      if(!rewards.length)throw new Error('보상을 하나 이상 선택해 주세요.');
      await request('mission:auto:create',{title:$('mission-auto-title').value,description,objective,goal,
        ...(objective==='math-correct'?{grade}:{}),...(objective==='craft-level'?{itemLevel}:{}),
        ...(['baseball-win','sudoku-win','one-stroke-win'].includes(objective)?{difficulty}:{}),...(objective==='signal-stage'?{stage}:{}),
        ...(daily?{repeat:'daily',rewards,rewardShards:rewards.find(reward=>reward.type==='star-shard')?.quantity||0}:
          {rewardShards:rewards.find(reward=>reward.type==='star-shard')?.quantity||0,rewards}),
        distribution:$('mission-auto-distribution').value,...limitsData('mission-auto')});
      $('mission-auto-title').value='';await refreshBoard();$('mission-auto-create').hidden=false;toast('자동미션을 만들었어요.');}
    catch(error){$('mission-board-error').textContent=error.message;}
    finally{button.disabled=false;}
  };
  $('mission-board-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>$('world')?.focus());
  async function openBoard(mode){stop();$('mission-board-error').textContent='';try{await refreshBoard();
    if(mode==='manual')$('mission-create').hidden=false;
    if(mode==='auto')$('mission-auto-create').hidden=false;
    dialog.showModal();}catch(error){toast(error.message);}}
  return {update,openMine,openBoard,openCreate:openBoard};
}
