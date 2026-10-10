import {createHmac,randomInt,timingSafeEqual} from 'node:crypto';

const CODE_CHARACTERS='abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@';
const SHORT_CODE=/^(?=.*[a-z])(?=.*[A-Z])(?=.*[2-9])(?=.*[!@])[A-Za-z2-9!@]{8}$/;
const LEGACY_CODE=/^T-[A-Za-z0-9_-]{20}$/;

// 헷갈리기 쉬운 0/1/O/I/l/o를 제외한 8자리 코드를 발급합니다.
// 저장소에는 원문 대신 검증값만 남깁니다.
export function issueTeacherCode(masterKey){
  let code;
  do { code=Array.from({length:8},()=>CODE_CHARACTERS[randomInt(CODE_CHARACTERS.length)]).join(''); }
  while(!SHORT_CODE.test(code));
  return {code,digest:teacherCodeDigest(masterKey,code)};
}

export function teacherCodeDigest(masterKey,code){
  return createHmac('sha256',masterKey).update('teacher-room-v1:').update(code).digest('hex');
}

export function matchesTeacherCode(masterKey,code,access){
  if(typeof code!=='string'||(!SHORT_CODE.test(code)&&!LEGACY_CODE.test(code))||!access?.digest)return false;
  const expected=Buffer.from(access.digest,'hex');
  if(expected.length!==32)return false;
  return timingSafeEqual(Buffer.from(teacherCodeDigest(masterKey,code),'hex'),expected);
}
