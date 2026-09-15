import {BASEBALL_LEVELS,generateBaseballAnswer,scoreBaseballQuestion,validateBaseballInput} from '../shared/baseball.js';

export function createBaseballGame({board,setScore=()=>{},toast=()=>{},random=Math.random}={}){
  if(!board)throw new TypeError('board가 필요합니다.');
  const root=document.createElement('section');root.className='baseball-game';root.setAttribute('aria-label','숫자야구');
  const levelGroup=document.createElement('div');levelGroup.className='baseball-levels';levelGroup.setAttribute('role','group');levelGroup.setAttribute('aria-label','난이도 선택');
  const form=document.createElement('form');form.className='baseball-form';
  const input=document.createElement('input');input.id='baseball-input';input.type='text';input.inputMode='numeric';input.autocomplete='off';input.spellcheck=false;input.disabled=true;input.setAttribute('aria-label','중복 없는 숫자 입력');
  const actions=document.createElement('div');actions.className='baseball-actions';
  const askButton=document.createElement('button');askButton.type='button';askButton.textContent='숫자 질문하기';askButton.disabled=true;
  const guessButton=document.createElement('button');guessButton.type='button';guessButton.textContent='정답 맞추기';guessButton.disabled=true;
  actions.append(askButton,guessButton);form.append(input,actions);
  const feedback=document.createElement('p');feedback.className='baseball-feedback';feedback.setAttribute('role','status');
  const historyTitle=document.createElement('h3');historyTitle.textContent='시도 목록';
  const history=document.createElement('ol');history.id='baseball-attempts';history.setAttribute('aria-label','시도 목록');
  root.append(levelGroup,form,feedback,historyTitle,history);board.replaceChildren(root);

  let level=null,answer='',attempts=0,ended=false,destroyed=false;
  const remaining=()=>20-attempts;
  const updateScore=()=>setScore(`${level?.name??''} · ${attempts}/20회 · 남은 기회 ${remaining()}회`);
  const setEnabled=enabled=>{input.disabled=!enabled;askButton.disabled=!enabled;guessButton.disabled=!enabled;};
  const finish=(won,message)=>{
    ended=true;setEnabled(false);
    feedback.textContent=`${message} 정답은 ${answer}입니다.`;
    setScore(`${won?'성공':'종료'} · ${attempts}/20회 · 남은 기회 ${remaining()}회 · 정답 ${answer}`);
    toast(won?'숫자야구 정답을 맞혔어요!':`기회가 끝났어요. 정답은 ${answer}입니다.`);
  };
  const selectLevel=next=>{
    level=next;answer=generateBaseballAnswer(level.digits,random);attempts=0;ended=false;
    for(const button of levelGroup.children)button.setAttribute('aria-pressed',String(button.dataset.level===level.id));
    history.replaceChildren();feedback.textContent=`${level.digits}자리 숫자가 준비됐어요.`;input.value='';input.maxLength=level.digits;input.placeholder=`${level.digits}자리 숫자`;
    setEnabled(true);updateScore();input.focus();
  };
  const appendAttempt=(value,mode,result,correct)=>{
    const item=document.createElement('li');item.dataset.mode=mode;item.dataset.value=value;
    const outcome=mode==='question'?`${result.strikes}S ${result.balls}B`:(correct?'정답':'오답');
    item.textContent=`${attempts}회 · ${value} · ${mode==='question'?'질문':'정답 도전'} · ${outcome} · 남은 기회 ${remaining()}회`;
    history.append(item);item.scrollIntoView({block:'nearest'});
  };
  const submit=mode=>{
    if(ended||destroyed||!level)return;
    const validation=validateBaseballInput(input.value,level.digits);
    if(!validation.valid){feedback.textContent=validation.message;toast(validation.message);input.focus();return;}
    attempts++;
    const result=scoreBaseballQuestion(answer,validation.value);
    const correct=mode==='guess'&&validation.value===answer;
    appendAttempt(validation.value,mode,result,correct);
    if(correct){finish(true,'정답이에요!');return;}
    if(attempts===20){finish(false,mode==='guess'?'마지막 정답 도전이 틀렸어요.':'마지막 질문까지 사용했어요.');return;}
    feedback.textContent=mode==='question'?`${result.strikes}스트라이크 ${result.balls}볼이에요.`:'오답이에요. 질문 결과를 살펴보고 다시 도전하세요.';
    updateScore();input.select();
  };

  for(const item of BASEBALL_LEVELS){
    const button=document.createElement('button');button.type='button';button.className='baseball-level';button.dataset.level=item.id;button.setAttribute('aria-pressed','false');button.textContent=`${item.name} (${item.digits}자리)`;button.addEventListener('click',()=>selectLevel(item));levelGroup.append(button);
  }
  askButton.addEventListener('click',()=>submit('question'));guessButton.addEventListener('click',()=>submit('guess'));
  form.addEventListener('submit',event=>{event.preventDefault();submit('question');});
  setScore('난이도를 선택하세요 · 시작 전');

  return {destroy(){if(destroyed)return;destroyed=true;root.remove();}};
}
