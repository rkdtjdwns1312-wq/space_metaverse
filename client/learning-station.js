import {ENGLISH_LEVELS,ENGLISH_WORDS} from '/shared/english-vocabulary.js';

export function createLearningStation({request}){
  const dialog=document.getElementById('learning-station-dialog');
  const $=id=>document.getElementById(id);
  let subject='math',level='grade-1',round=0,correct=0,question=null,answered=false,generation=0,learningReward=null;
  const title=$('learning-station-title'),intro=$('learning-intro'),prompt=$('learning-prompt');
  const choices=$('learning-choices'),feedback=$('learning-feedback'),next=$('learning-next');
  const levelSelect=$('learning-level'),levelLabel=$('learning-level-row').querySelector('label');
  const vocabularyCount=document.createElement('p');vocabularyCount.className='muted';vocabularyCount.hidden=true;
  const rewardInfo=document.createElement('p');rewardInfo.className='learning-reward-info';rewardInfo.textContent='10문제 중 9문제 이상 맞히면 하루 한 번 보상!\n별자리 캐릭터 Lv에 따라 보상을 다르게 받아요.\n단계가 달라도 같은 발전소 보상은 하루에 한 번이에요.';intro.insertAdjacentElement('afterend',rewardInfo);
  const start=document.createElement('button');start.id='learning-start';start.type='button';start.className='secondary';start.textContent='시작하기';next.before(start);
  const questionElements=[$('learning-progress'),$('learning-question-label'),prompt,choices];
  function prepare(){
    generation++;round=0;correct=0;question=null;answered=false;learningReward=null;
    choices.replaceChildren();prompt.textContent='';feedback.textContent='단계를 고른 뒤 시작하기를 눌러 주세요.';
    for(const el of questionElements)el.hidden=true;
    next.hidden=true;next.disabled=false;start.hidden=false;start.disabled=false;
  }
  levelSelect.insertAdjacentElement('afterend',vocabularyCount);
  function updateLevelInfo(){
    if(subject!=='english'){vocabularyCount.hidden=true;intro.textContent='10문제를 풀어 봐요. 맞힌 문제는 해당 학년 자동미션에 반영돼요.';return;}
    const selected=ENGLISH_LEVELS.find(item=>item.id===level);
    vocabularyCount.hidden=false;
    vocabularyCount.textContent=`전체 ${ENGLISH_WORDS.length}개 · 선택 단계 ${selected?.label||level} ${selected?.words.length||0}개`;
    const guidance=level==='grade-1'?'영어 입문 단계예요. 쉬운 낱말부터 뜻을 익혀요.':
      level==='grade-2'?'기초 어휘를 넓히는 단계예요. 익숙한 낱말부터 연습해요.':'';
    intro.textContent=[guidance,'10문제를 풀며 새로운 단어를 익혀 봐요.'].filter(Boolean).join(' ');
  }
  function renderQuestion(){
    // Changing the level starts a fresh run, so keep the selector available throughout.
    levelSelect.disabled=false;
    $('learning-progress').textContent=`${Math.min(round+1,10)} / 10 · 맞힌 문제 ${correct}`;
    if(round>=10){
      prompt.textContent=`10문제 중 ${correct}문제를 맞혔어요!`;
      choices.replaceChildren();
      feedback.textContent=[correct>=9?'잘했어요! 9문제 이상 맞혔어요.':'조금 더 연습해 봐요. 9문제 이상 맞히면 오늘의 보상을 받을 수 있어요.',learningReward?.message].filter(Boolean).join(' ');
      next.textContent='다시 연습하기';next.hidden=false;return;
    }
    answered=false;prompt.textContent=question.prompt;feedback.textContent='';next.hidden=true;
    choices.replaceChildren(...question.choices.map(value=>{
      const button=document.createElement('button');button.type='button';button.className='learning-answer';button.textContent=String(value);
      button.onclick=async()=>{
        if(answered)return;answered=true;
        const current=generation,activeQuestion=question;
        let right,answer;
        try{const result=await request(`learning:${subject}:answer`,{questionId:activeQuestion.questionId,answer:value});
          if(current!==generation)return;
          right=result.right;answer=result.answer;correct=result.correct;if(result.learningReward)learningReward=result.learningReward;
        }catch(error){if(current===generation){answered=false;feedback.textContent=error.message;}return;}
        feedback.textContent=[right?'정답이에요! ✨':`아쉬워요. 정답은 ${answer}예요.`,round===9?learningReward?.message:null].filter(Boolean).join(' ');
        for(const option of choices.children){option.disabled=true;if(option.textContent===String(answer))option.classList.add('correct');else if(option===button)option.classList.add('incorrect');}
        next.textContent=round===9?'결과 보기':'다음 문제';next.hidden=false;next.focus();
      };
      return button;
    }));
  }
  async function restart(){
    if(start.disabled)return;
    const current=++generation;round=0;correct=0;question=null;answered=false;learningReward=null;choices.replaceChildren();next.disabled=false;next.hidden=true;start.disabled=true;feedback.textContent='문제를 준비하고 있어요…';
    let result;
    try{result=await request(`learning:${subject}:start`,subject==='math'?{grade:Number(level.slice(-1))}:subject==='english'?{level}:{});}
    catch(error){if(current===generation){feedback.textContent=error.message;start.disabled=false;}return;}
    if(current!==generation)return;
    question=result;
    start.hidden=true;start.disabled=false;for(const el of questionElements)el.hidden=false;
    renderQuestion();
  }
  start.onclick=restart;
  levelSelect.onchange=()=>{level=levelSelect.value;updateLevelInfo();prepare();};
  next.onclick=async()=>{
    if(round>=10){prepare();start.focus();return;}
    const current=generation,activeSubject=subject;
    next.disabled=true;
    try{
      const result=round<9?await request(`learning:${activeSubject}:next`,{}):null;
      if(current!==generation)return;
      if(result)question=result;
      round++;renderQuestion();
    }
    catch(error){if(current===generation)feedback.textContent=error.message;}
    finally{if(current===generation)next.disabled=false;}
  };
  $('learning-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{generation++;document.getElementById('world')?.focus();});
  return {open(kind){
    subject=kind==='english-station'?'english':'math';
    title.textContent=subject==='math'?'별 수학 발전소':'별 영어 발전소';
    intro.textContent=subject==='math'?'10문제를 풀어 봐요. 맞힌 문제는 해당 학년 자동미션에 반영돼요.':'기초 영단어 10문제 중 7문제 이상 맞히면 성공이에요.';
    $('learning-level-row').hidden=false;
    levelLabel.textContent=subject==='math'?'연산 단계':'영어 단어 단계';
    if(subject==='english'){
      levelSelect.replaceChildren(...ENGLISH_LEVELS.map(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.label;return option;}));
      if(!ENGLISH_LEVELS.some(item=>item.id===level))level='grade-1';
    }else{levelSelect.replaceChildren(...Array.from({length:6},(_,index)=>{const grade=index+1,option=document.createElement('option');option.value=`grade-${grade}`;option.textContent=`${grade<3?'기초':grade<5?'중급':'고급'} ${grade}학년`;return option;}));level='grade-1';}
    levelSelect.value=level;levelSelect.disabled=false;updateLevelInfo();
    $('learning-question-label').textContent=subject==='math'?'계산해 볼까요?':'이 단어의 뜻은 무엇일까요?';
    prepare();dialog.showModal();
  }};
}
