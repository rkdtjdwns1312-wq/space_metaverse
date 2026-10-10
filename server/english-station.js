import {randomUUID} from 'node:crypto';
import {englishQuestion} from '../shared/learning-questions.js';
import {ensure} from './rooms.js';

export const ENGLISH_SUCCESS_SCORE=7;

// 한 번 연습에 10문제. 정답은 서버에만 두고 각 문제는 한 번만 제출할 수 있습니다.
export function createEnglishStation(){
  const questionView=run=>({questionId:run.questionId,prompt:run.question.prompt,choices:run.question.choices,round:run.round,correct:run.correct});
  function setQuestion(run){
    run.question=englishQuestion(Math.random,run.used);
    run.used.add(run.question.prompt);
    run.questionId=randomUUID();run.answered=false;
    return questionView(run);
  }
  return {
    start(player){
      const run={round:0,correct:0,used:new Set(),answered:false};
      player.englishRun=run;return setQuestion(run);
    },
    answer(player,data){
      const run=player.englishRun;
      ensure(run&&run.questionId===data?.questionId&&!run.answered,'지금 문제를 다시 확인해 주세요.');
      ensure(run.question.choices.includes(data?.answer),'보기에서 답을 골라 주세요.');
      run.answered=true;
      const right=data.answer===run.question.answer;
      if(right)run.correct++;
      run.round++;
      const done=run.round===10,success=done&&run.correct>=ENGLISH_SUCCESS_SCORE;
      return {right,answer:run.question.answer,round:run.round,correct:run.correct,done,success};
    },
    next(player){
      const run=player.englishRun;
      ensure(run&&run.answered&&run.round<10,'다음 문제를 열 수 없어요.');
      return setQuestion(run);
    }
  };
}
