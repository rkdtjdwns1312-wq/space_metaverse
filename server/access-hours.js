// 서버 PC의 지역 설정과 학생 브라우저 시계에 관계없이 한국 시간을 사용합니다.
export const STUDENT_HOURS_MESSAGE='학생은 한국 시간 오전 7시부터 오후 9시 전까지 입장할 수 있어요. 내일 다시 만나요!';
// 테스트 때만 false로 끄고 정식 운영은 true로 복원합니다. 오타로 제한이 풀리지 않게 검증합니다.
export function studentHoursFromEnv(value=process.env.STUDENT_HOURS){
  const setting=String(value??'').trim().toLowerCase();
  if(setting===''||setting==='true')return true;
  if(setting==='false')return false;
  throw new Error('STUDENT_HOURS는 true 또는 false여야 합니다.');
}
export function studentAccessOpen(now=Date.now()) {
  const hour=new Date(now+9*60*60*1000).getUTCHours();
  return hour>=7&&hour<21;
}
