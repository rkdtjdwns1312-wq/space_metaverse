import {mathQuestion,englishQuestion} from '/shared/learning-questions.js';

export function createLearningStation(){
  const dialog=document.getElementById('learning-station-dialog');
  const $=id=>document.getElementById(id);
  let subject='math',level='basic',round=0,correct=0,question=null,answered=false,used=new Set();
  const title=$('learning-station-title'),intro=$('learning-intro'),prompt=$('learning-prompt');
  const choices=$('learning-choices'),feedback=$('learning-feedback'),next=$('learning-next');
  function renderQuestion(){
    $('learning-progress').textContent=`${Math.min(round+1,10)} / 10 · 맞힌 문제 ${correct}`;
    if(round>=10){
      prompt.textContent=`10문제 중 ${correct}문제를 맞혔어요!`;
      choices.replaceChildren();feedback.textContent=correct===10?'별빛처럼 멋진 실력이에요!':'틀린 문제도 다시 풀면 실력이 자라요.';
      next.textContent='다시 연습하기';next.hidden=false;return;
    }
    question=subject==='math'?mathQuestion(level):englishQuestion(Math.random,used);
    if(subject==='english')used.add(question.prompt);
    answered=false;prompt.textContent=question.prompt;feedback.textContent='';next.hidden=true;
    choices.replaceChildren(...question.choices.map(value=>{
      const button=document.createElement('button');button.type='button';button.className='learning-answer';button.textContent=String(value);
      button.onclick=()=>{
        if(answered)return;answered=true;
        const right=value===question.answer;
        if(right)correct++;
        feedback.textContent=right?'정답이에요! ✨':`아쉬워요. 정답은 ${question.answer}예요.`;
        for(const option of choices.children){option.disabled=true;if(option.textContent===String(question.answer))option.classList.add('correct');else if(option===button)option.classList.add('incorrect');}
        next.textContent=round===9?'결과 보기':'다음 문제';next.hidden=false;next.focus();
      };
      return button;
    }));
  }
  function restart(){round=0;correct=0;used=new Set();renderQuestion();}
  $('learning-level').onchange=()=>{level=$('learning-level').value;restart();};
  next.onclick=()=>{if(round>=10){restart();return;}round++;renderQuestion();};
  $('learning-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>document.getElementById('world')?.focus());
  return {open(kind){
    subject=kind==='english-station'?'english':'math';
    title.textContent=subject==='math'?'별 수학 발전소':'별 영어 발전소';
    intro.textContent=subject==='math'?'10문제를 풀며 연산의 별빛을 밝혀 봐요.':'기초 영단어 10개의 뜻을 찾아봐요.';
    $('learning-level-row').hidden=subject!=='math';
    $('learning-level').value='basic';level='basic';
    $('learning-question-label').textContent=subject==='math'?'계산해 볼까요?':'이 단어의 뜻은 무엇일까요?';
    restart();dialog.showModal();
  }};
}
