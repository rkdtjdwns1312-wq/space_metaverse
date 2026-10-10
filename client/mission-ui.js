// 별 미션 게시판: 선생님이 조건을 확인한 뒤 학생이 직접 보상을 받습니다.
export function createMissionUI({request,stop,toast,getRoom,getSelfId}){
  const $=id=>document.getElementById(id);
  const dialog=document.createElement('dialog');dialog.id='mission-board-dialog';
  dialog.innerHTML='<h2>별 미션 게시판</h2><p id="mission-board-intro" class="muted">미션을 받고 조건을 달성해 보세요. 자동미션은 게임 안에서 달성되며, 일반 미션은 선생님이 확인해요.</p><section id="mission-create" hidden><h3>새 미션 만들기</h3><label for="mission-title">미션 이름</label><input id="mission-title" maxlength="40" placeholder="예: 오늘의 별빛 약속"><label for="mission-description">완료 조건</label><textarea id="mission-description" maxlength="240" rows="3" placeholder="어떤 일을 하면 완료되는지 적어 주세요."></textarea><label for="mission-reward">보상 · 별 파편</label><input id="mission-reward" type="number" min="1" max="10" value="1"><label for="mission-distribution">나누는 방법</label><select id="mission-distribution"><option value="all">교실 친구 모두에게 나누기</option><option value="board">친구들이 게시판에서 직접 받기</option></select><button id="mission-create-button" class="primary" type="button">미션 만들기</button></section><section id="mission-auto-create" hidden><h3>자동미션 만들기</h3><label for="mission-auto-title">미션 이름</label><input id="mission-auto-title" maxlength="40" placeholder="예: 별빛 여행자"><label for="mission-auto-objective">게임 안의 완료 조건</label><select id="mission-auto-objective"><option value="map-travel">다른 맵으로 이동하기</option><option value="energy-collect">우주에너지 줍기</option><option value="stars-win">반짝별 찾기 성공하기</option><option value="memory-win">별그림 짝맞추기 성공하기</option><option value="english-success">별 영어 발전소 성공하기</option></select><p id="mission-auto-guide" class="muted">맵의 문을 지나 다른 맵으로 이동할 때 1회로 셉니다.</p><label for="mission-auto-goal">목표 횟수</label><input id="mission-auto-goal" type="number" min="1" max="10" value="1"><label for="mission-auto-reward">보상 · 별 파편</label><input id="mission-auto-reward" type="number" min="1" max="10" value="1"><label for="mission-auto-distribution">나누는 방법</label><select id="mission-auto-distribution"><option value="all">교실 친구 모두에게 나누기</option><option value="board">친구들이 게시판에서 직접 받기</option></select><button id="mission-auto-create-button" class="primary" type="button">자동미션 만들기</button></section><h3 id="mission-board-list-title">받을 수 있는 미션</h3><div id="mission-board-list" class="mission-list"></div><p id="mission-board-error" role="alert"></p><div class="dialog-actions"><button id="mission-board-close" class="secondary" type="button">닫기</button></div>';
  document.body.append(dialog);
  $('mission-auto-guide').insertAdjacentHTML('afterend','<div id="mission-auto-grade-row" hidden><label for="mission-auto-grade">수학 단계</label><select id="mission-auto-grade"><option value="1">기초 1학년</option><option value="2">기초 2학년</option><option value="3">중급 3학년</option><option value="4">중급 4학년</option><option value="5">고급 5학년</option><option value="6">고급 6학년</option></select></div><div id="mission-auto-item-level-row" hidden><label for="mission-auto-item-level">완성 아이템 레벨</label><select id="mission-auto-item-level"><option value="2">LV2</option><option value="3">LV3</option><option value="4">LV4</option><option value="5">LV5</option></select></div>');
  const mine=$('my-missions'),mineEmpty=$('my-missions-empty');
  function card(mission){
    const node=document.createElement('section');node.className='mission-card';
    const title=document.createElement('h4');title.textContent=mission.title;
    const condition=document.createElement('p');condition.textContent=mission.description;
    const reward=document.createElement('p');reward.className='mission-reward';reward.textContent=`보상 · 별 파편 ${mission.rewardShards}개`;
    node.append(title,condition,reward);return node;
  }
  function update(){
    const me=getRoom()?.players.find(p=>p.id===getSelfId());
    const missions=me?.role==='student'?(getRoom()?.missions||[]):[];
    $('class-missions').hidden=me?.role!=='student';
    mine.replaceChildren();mineEmpty.hidden=missions.length>0;
    for(const mission of missions){
      const node=card(mission),status=document.createElement('p'),button=document.createElement('button');
      status.className='mission-status';
      status.textContent=mission.status==='claimed'?'보상 받음':mission.status==='ready'?'조건 달성 · 보상을 받으세요.':mission.objective?`진행 중 · ${mission.progress} / ${mission.goal}회`:'진행 중 · 선생님 확인을 기다려요.';
      button.type='button';button.className='primary';button.textContent=mission.status==='claimed'?'보상 받음':'완료';
      button.disabled=mission.status!=='ready';
      button.onclick=async()=>{button.disabled=true;try{const result=await request('mission:claim',{missionId:mission.id});toast(`미션 완료! 별 파편 ${result.rewardShards}개를 받았어요.`);}catch(error){toast(error.message);button.disabled=false;}};
      node.append(status,button);mine.append(node);
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
        const tag=document.createElement('p');tag.className='mission-status';tag.textContent=(mission.objective?'자동미션 · ':'일반 미션 · ')+(mission.distribution==='all'?'전체 배포':'게시판에서 직접 받기');node.append(tag);
        const students=document.createElement('div');students.className='mission-students';
        for(const student of mission.students){
          const row=document.createElement('div'),name=document.createElement('span');name.textContent=student.nickname;
          const button=document.createElement('button');button.type='button';button.className='small secondary';
          button.textContent=student.status==='claimed'?'보상 받음':student.status==='ready'?'확인 완료':mission.objective?`${student.progress} / ${mission.goal}회`:'달성 확인';button.disabled=student.status!=='active'||!!mission.objective;
          button.onclick=async()=>{button.disabled=true;try{await request('mission:confirm',{missionId:mission.id,studentId:student.id});await refreshBoard();toast(`${student.nickname} 친구의 달성을 확인했어요.`);}catch(error){toast(error.message);button.disabled=false;}};
          row.append(name,button);students.append(row);
        }
        if(mission.students.length)node.append(students);
      }else{
        const button=document.createElement('button');button.type='button';button.className='primary';button.textContent='미션 받기';
        button.onclick=async()=>{button.disabled=true;try{await request('mission:accept',{missionId:mission.id});await refreshBoard();toast('미션을 받았어요. 소통 → 미션 보기에서 확인할 수 있어요.');}catch(error){toast(error.message);button.disabled=false;}};
        node.append(button);
      }
      list.append(node);
    }
  }
  $('mission-create-button').onclick=async()=>{
    const button=$('mission-create-button');button.disabled=true;$('mission-board-error').textContent='';
    try{await request('mission:create',{title:$('mission-title').value,description:$('mission-description').value,
      rewardShards:Number($('mission-reward').value),distribution:$('mission-distribution').value});
      $('mission-title').value='';$('mission-description').value='';await refreshBoard();$('mission-create').hidden=false;toast('새 미션을 만들었어요.');}
    catch(error){$('mission-board-error').textContent=error.message;}
    finally{button.disabled=false;}
  };
  $('mission-auto-objective').insertAdjacentHTML('beforeend','<option value="math-correct">별 수학 발전소 학년별 정답</option><option value="craft-level">레벨별 아이템 조합 성공</option><option value="baseball-win">숫자야구 난이도별 성공</option><option value="sudoku-win">별빛 스도쿠 난이도별 성공</option><option value="signal-stage">우주 신호 목표 단계 성공</option>');
  const starOption=$('mission-auto-objective').querySelector('[value="stars-win"]');starOption.value='tetris-lines';starOption.textContent='별 테트리스 줄 지우기';
  $('mission-auto-objective').querySelector('[value="memory-win"]').textContent='별그림 짝맞추기 상 성공';
  starOption.insertAdjacentHTML('afterend','<option value="dodge-record">별 피하기 내 신기록 달성</option>');
  $('mission-auto-item-level-row').insertAdjacentHTML('afterend','<div id="mission-auto-difficulty-row" hidden><label for="mission-auto-difficulty">게임 난이도</label><select id="mission-auto-difficulty"><option value="low">하</option><option value="medium">중</option><option value="high">상</option></select></div><div id="mission-auto-stage-row" hidden><label for="mission-auto-stage">목표 단계</label><select id="mission-auto-stage"><option value="1">1단계</option><option value="2">2단계</option><option value="3">3단계</option><option value="4">4단계</option><option value="5">5단계</option><option value="6">6단계</option></select></div>');
  $('mission-auto-goal').max='100';
  const objectiveText={'map-travel':'다른 맵으로 이동하기','energy-collect':'우주에너지 줍기','tetris-lines':'별 테트리스 줄 지우기','dodge-record':'별 피하기 내 신기록 달성하기','memory-win':'별그림 짝맞추기 상 난이도 성공하기','english-success':'별 영어 발전소 10문제 중 7문제 이상 맞히기'};
  const objectiveGuide={'map-travel':'맵의 문을 지나 다른 맵으로 이동할 때 1회로 셉니다.','energy-collect':'우주에너지 드랍을 직접 주울 때 1회로 셉니다.','tetris-lines':'한 판이 끝나면 그 판에서 지운 줄 수를 더해요.','dodge-record':'이전 나의 기록보다 더 오래 별을 피하면 1회입니다. 첫 기록도 신기록으로 셉니다.','memory-win':'별그림 짝맞추기 상 난이도를 성공하면 1회로 셉니다.','english-success':'영어 문제 10개 중 7개 이상 맞히면 성공 1회입니다.','math-correct':'선택한 학년 단계의 문제를 맞힐 때마다 1회로 셉니다.','craft-level':'선택한 레벨의 아이템 조합에 성공할 때마다 1회로 셉니다.','baseball-win':'선택한 난이도에서 숫자야구를 이기면 1회입니다.','sudoku-win':'선택한 난이도의 스도쿠를 완성하면 1회입니다.','signal-stage':'선택한 단계에 도달하면 달성합니다.'};
  $('mission-auto-objective').onchange=()=>{const objective=$('mission-auto-objective').value;
    $('mission-auto-guide').textContent=objectiveGuide[objective];
    $('mission-auto-grade-row').hidden=objective!=='math-correct';
    $('mission-auto-item-level-row').hidden=objective!=='craft-level';
    $('mission-auto-difficulty-row').hidden=!['baseball-win','sudoku-win'].includes(objective);
    $('mission-auto-stage-row').hidden=objective!=='signal-stage';
    $('mission-auto-goal').disabled=objective==='signal-stage';if(objective==='signal-stage')$('mission-auto-goal').value='1';
  };
  $('mission-auto-create-button').onclick=async()=>{
    const button=$('mission-auto-create-button');button.disabled=true;$('mission-board-error').textContent='';
    try{const objective=$('mission-auto-objective').value,goal=Number($('mission-auto-goal').value),
      grade=Number($('mission-auto-grade').value),itemLevel=Number($('mission-auto-item-level').value),
      difficulty=$('mission-auto-difficulty').value,stage=Number($('mission-auto-stage').value),
      description=objective==='math-correct'?`별 수학 발전소 ${grade}학년 단계 정답 ${goal}회 맞히기`
        :objective==='craft-level'?`LV${itemLevel} 아이템 조합 ${goal}회 성공하기`
        :objective==='signal-stage'?`우주 신호 따라하기 ${stage}단계 성공하기`
        :['baseball-win','sudoku-win'].includes(objective)?`${objective==='baseball-win'?'숫자야구':'별빛 스도쿠'} ${difficulty==='high'?'상':difficulty==='medium'?'중':'하'} ${goal}회 성공하기`
        :`${objectiveText[objective]} ${objective==='tetris-lines'?goal+'줄':goal+'회'}`;
      await request('mission:auto:create',{title:$('mission-auto-title').value,description,objective,goal,
        ...(objective==='math-correct'?{grade}:{}),...(objective==='craft-level'?{itemLevel}:{}),
        ...(['baseball-win','sudoku-win'].includes(objective)?{difficulty}:{}),...(objective==='signal-stage'?{stage}:{}),
        rewardShards:Number($('mission-auto-reward').value),distribution:$('mission-auto-distribution').value});
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
  return {update,openBoard,openCreate:openBoard};
}
