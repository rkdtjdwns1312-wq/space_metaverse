import fs from 'node:fs';
import path from 'node:path';

// 서버가 죽어 남은 잠금만 명시적 복구 명령으로 해제합니다. 실행 중이거나 판단할 수 없으면 거절합니다.
export function unlockStoppedStore(directory){
  const filename=path.join(path.resolve(directory),'.writer.lock');
  if(!fs.existsSync(filename))return false;
  const text=fs.readFileSync(filename,'utf8');let owner;
  try{owner=JSON.parse(text);}catch{throw new Error('잠금 정보를 읽을 수 없습니다. 파일을 보존하고 관리자에게 확인해주세요.');}
  if(!Number.isSafeInteger(owner.pid)||owner.pid<=0)throw new Error('잠금의 프로세스 번호를 확인할 수 없습니다.');
  let stopped=false;
  try{process.kill(owner.pid,0);}catch(error){if(error.code==='ESRCH')stopped=true;else throw new Error('서버 종료 여부를 확인할 수 없습니다.');}
  if(!stopped)throw new Error('저장소를 사용 중인 서버가 있습니다. 먼저 서버를 정상 종료해주세요.');
  if(fs.readFileSync(filename,'utf8')!==text)throw new Error('잠금 정보가 바뀌었습니다. 다시 확인해주세요.');
  fs.unlinkSync(filename);return true;
}
