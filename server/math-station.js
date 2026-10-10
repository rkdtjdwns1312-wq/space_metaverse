import {randomUUID} from 'node:crypto';
import {mathQuestion} from '../shared/learning-questions.js';
import {ensure} from './rooms.js';

export function createMathStation(){
  function setQuestion(run){
    run.question=mathQuestion(`grade-${run.grade}`);
    run.questionId=randomUUID();run.answered=false;
    return {questionId:run.questionId,prompt:run.question.prompt,choices:run.question.choices,round:run.round,correct:run.correct,grade:run.grade};
  }
  return {
    start(player,grade){
      ensure(Number.isSafeInteger(grade)&&grade>=1&&grade<=6,'수학 학년 단계를 골라 주세요.');
      const run={grade,round:0,correct:0,answered:false};
      player.mathRun=run;return setQuestion(run);
    },
    answer(player,data){
      const run=player.mathRun;
      ensure(run&&run.questionId===data?.questionId&&!run.answered,'지금 문제를 다시 확인해 주세요.');
      ensure(run.question.choices.includes(data?.answer),'보기에서 답을 골라 주세요.');
      run.answered=true;
      const right=data.answer===run.question.answer;
      if(right)run.correct++;
      run.round++;
      return {right,answer:run.question.answer,round:run.round,correct:run.correct,grade:run.grade,done:run.round===10};
    },
    next(player){
      const run=player.mathRun;
      ensure(run&&run.answered&&run.round<10,'다음 문제를 열 수 없어요.');
      return setQuestion(run);
    }
  };
}
