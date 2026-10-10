import {randomUUID} from 'node:crypto';
import {BASEBALL_LEVELS,generateBaseballAnswer,scoreBaseballQuestion,validateBaseballInput} from '../shared/baseball.js';
import {ensure} from './rooms.js';

export function createBaseballRuns(){
  return {
    start(player,difficulty){
      const level=BASEBALL_LEVELS.find(value=>value.id===difficulty);
      ensure(level,'숫자야구 난이도를 골라 주세요.');
      const run={runId:randomUUID(),level,answer:generateBaseballAnswer(level.digits),attempts:0};
      player.baseballRun=run;
      return {runId:run.runId,difficulty:level.id,digits:level.digits,attempts:0};
    },
    submit(player,data){
      const run=player.baseballRun;
      ensure(run&&run.runId===data?.runId,'숫자야구를 다시 시작해 주세요.');
      ensure(['question','guess'].includes(data?.mode),'숫자 질문 또는 정답 도전을 골라 주세요.');
      const validation=validateBaseballInput(data?.value,run.level.digits);
      ensure(validation.valid,validation.message);
      run.attempts++;
      const score=scoreBaseballQuestion(run.answer,validation.value);
      const won=data.mode==='guess'&&validation.value===run.answer;
      const done=won||run.attempts>=20;
      if(done)delete player.baseballRun;
      return {attempts:run.attempts,score,won,done,difficulty:run.level.id,
        ...(done?{answer:run.answer}:{})};
    }
  };
}
