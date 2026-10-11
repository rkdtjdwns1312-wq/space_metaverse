import {ENGLISH_LEVELS,ENGLISH_WORDS} from '/shared/english-vocabulary.js';

export function createLearningStation({request}){
  const dialog=document.getElementById('learning-station-dialog');
  const $=id=>document.getElementById(id);
  let subject='math',level='grade-1',round=0,correct=0,question=null,answered=false,generation=0;
  const title=$('learning-station-title'),intro=$('learning-intro'),prompt=$('learning-prompt');
  const choices=$('learning-choices'),feedback=$('learning-feedback'),next=$('learning-next');
  const levelSelect=$('learning-level'),levelLabel=$('learning-level-row').querySelector('label');
  const vocabularyCount=document.createElement('p');vocabularyCount.className='muted';vocabularyCount.hidden=true;
  levelSelect.insertAdjacentElement('afterend',vocabularyCount);
  function updateLevelInfo(){
    if(subject!=='english'){vocabularyCount.hidden=true;intro.textContent='10문제를 풀어 봐요. 맞힌 문제는 해당 학년 자동미션에 반영돼요.';return;}
    const selected=ENGLISH_LEVELS.find(item=>item.id===level);
    vocabularyCount.hidden=false;
    vocabularyCount.textContent=`전체 ${ENGLISH_WORDS.length}개 · 선택 단계 ${selected?.label||level} ${selected?.words.length||0}개`;
    const guidance=level==='grade-1'?'영어 입문 단계예요. 쉬운 낱말부터 뜻을 익혀요.':
      level==='grade-2'?'기초 어휘를 넓히는 단계예요. 익숙한 낱말부터 연습해요.':'';
    intro.textContent=[guidance,'10문제 중 7문제 이상 맞히면 성공이에요.'].filter(Boolean).join(' ');
  }
  function renderQuestion(){
    // Changing the level starts a fresh run, so keep the selector available throughout.
    levelSelect.disabled=false;
    $('learning-progress').textContent=`${Math.min(round+1,10)} / 10 · 맞힌 문제 ${correct}`;
    if(round>=10){
      prompt.textContent=`10문제 중 ${correct}문제를 맞혔어요!`;
      choices.replaceChildren();
      feedback.textContent=subject==='english'?(correct>=7?'성공! 영어 발전소에서 7문제 이상 맞혔어요.':'7문제 이상 맞히면 영어 발전소 성공이에요.')
        :correct===10?'별빛처럼 멋진 실력이에요!':'틀린 문제도 다시 풀면 실력이 자라요.';
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
          right=result.right;answer=result.answer;correct=result.correct;
        }catch(error){if(current===generation){answered=false;feedback.textContent=error.message;}return;}
        feedback.textContent=right?'정답이에요! ✨':`아쉬워요. 정답은 ${answer}예요.`;
        for(const option of choices.children){option.disabled=true;if(option.textContent===String(answer))option.classList.add('correct');else if(option===button)option.classList.add('incorrect');}
        next.textContent=round===9?'결과 보기':'다음 문제';next.hidden=false;next.focus();
      };
      return button;
    }));
  }
  async function restart(){
    const current=++generation;round=0;correct=0;question=null;answered=false;choices.replaceChildren();next.disabled=false;next.hidden=true;prompt.textContent='문제를 준비하고 있어요…';feedback.textContent='';
    let result;
    try{result=await request(`learning:${subject}:start`,subject==='math'?{grade:Number(level.slice(-1))}:subject==='english'?{level}:{});}
    catch(error){if(current===generation)feedback.textContent=error.message;return;}
    if(current!==generation)return;
    question=result;
    renderQuestion();
  }
  levelSelect.onchange=()=>{level=levelSelect.value;updateLevelInfo();restart();};
  next.onclick=async()=>{
    if(round>=10){await restart();return;}
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
    dialog.showModal();restart();
  }};
}
