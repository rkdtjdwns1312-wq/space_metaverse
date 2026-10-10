export function createLearningStation({request}){
  const dialog=document.getElementById('learning-station-dialog');
  const $=id=>document.getElementById(id);
  let subject='math',level='grade-1',round=0,correct=0,question=null,answered=false,generation=0;
  const title=$('learning-station-title'),intro=$('learning-intro'),prompt=$('learning-prompt');
  const choices=$('learning-choices'),feedback=$('learning-feedback'),next=$('learning-next');
  function renderQuestion(){
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
        let right,answer;
        try{const result=await request(`learning:${subject}:answer`,{questionId:question.questionId,answer:value});
          right=result.right;answer=result.answer;correct=result.correct;
        }catch(error){answered=false;feedback.textContent=error.message;return;}
        feedback.textContent=right?'정답이에요! ✨':`아쉬워요. 정답은 ${answer}예요.`;
        for(const option of choices.children){option.disabled=true;if(option.textContent===String(answer))option.classList.add('correct');else if(option===button)option.classList.add('incorrect');}
        next.textContent=round===9?'결과 보기':'다음 문제';next.hidden=false;next.focus();
      };
      return button;
    }));
  }
  async function restart(){
    const current=++generation;round=0;correct=0;question=null;choices.replaceChildren();next.hidden=true;prompt.textContent='문제를 준비하고 있어요…';feedback.textContent='';
    try{question=await request(`learning:${subject}:start`,subject==='math'?{grade:Number(level.slice(-1))}:{});}
    catch(error){if(current===generation)feedback.textContent=error.message;return;}
    if(current!==generation)return;
    renderQuestion();
  }
  $('learning-level').onchange=()=>{level=$('learning-level').value;restart();};
  next.onclick=async()=>{
    if(round>=10){await restart();return;}
    next.disabled=true;
    try{if(round<9){question=await request(`learning:${subject}:next`,{});}round++;renderQuestion();}
    catch(error){feedback.textContent=error.message;}
    finally{next.disabled=false;}
  };
  $('learning-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{generation++;document.getElementById('world')?.focus();});
  return {open(kind){
    subject=kind==='english-station'?'english':'math';
    title.textContent=subject==='math'?'별 수학 발전소':'별 영어 발전소';
    intro.textContent=subject==='math'?'10문제를 풀어 봐요. 맞힌 문제는 해당 학년 자동미션에 반영돼요.':'기초 영단어 10문제 중 7문제 이상 맞히면 성공이에요.';
    $('learning-level-row').hidden=subject!=='math';
    $('learning-level').value='grade-1';level='grade-1';
    $('learning-question-label').textContent=subject==='math'?'계산해 볼까요?':'이 단어의 뜻은 무엇일까요?';
    dialog.showModal();restart();
  }};
}
