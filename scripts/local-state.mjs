import {createClassroomServer} from '../server/app.js';
import {unlockStoppedStore} from '../server/store-lock.js';
// 저장소를 열기 전에 기존 교실 서버부터 확인합니다. 알 수 없는 프로그램이면 재사용하지 않습니다.
export async function runningClassroom(port) {
  let response;
  try {
    response=await fetch('http://127.0.0.1:'+port+'/health',{redirect:'error',signal:AbortSignal.timeout(2500)});
  } catch(error) {
    if(error.cause?.code==='ECONNREFUSED')return null;
    throw new Error('기존 서버 응답을 확인하지 못했어요. 잠시 뒤 다시 실행해주세요.');
  }
  let health;try{health=await response.json();}catch{}
  if(!response.ok||health?.service!=='space-classroom'||health.ok!==true)
    throw new Error(port+'번 포트를 다른 프로그램이 사용 중이에요. 해당 프로그램을 확인해주세요.');
  return health;
}

export async function startLocalClassroom({port,dataDir,teacherKey}) {
  const existing=await runningClassroom(port);
  if(existing)return {existing};
  // ESRCH(실제 종료) 확인이 된 소유자의 잠금만 해제합니다. 살아 있거나 알 수 없으면 실패합니다.
  const recovered=unlockStoppedStore(dataDir);
  const game=createClassroomServer({teacherKey,dataDir});
  try{await game.listen(port,'127.0.0.1');}
  catch(error){await game.close();if(error.code==='EADDRINUSE')throw new Error('교실 시작 중 다른 서버가 같은 포트를 사용했어요. 다시 실행해주세요.');throw error;}
  return {game,recovered};
}
