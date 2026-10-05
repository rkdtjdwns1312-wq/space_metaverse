import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

// 교실 담당 선생님에게 주는 긴 무작위 코드입니다. 저장소에는 원문 대신 검증값만 남깁니다.
export function issueTeacherCode(masterKey){
  const code='T-'+randomBytes(15).toString('base64url');
  return {code,digest:teacherCodeDigest(masterKey,code)};
}

export function teacherCodeDigest(masterKey,code){
  return createHmac('sha256',masterKey).update('teacher-room-v1:').update(code).digest('hex');
}

export function matchesTeacherCode(masterKey,code,access){
  if(typeof code!=='string'||!/^T-[A-Za-z0-9_-]{20}$/.test(code)||!access?.digest)return false;
  const expected=Buffer.from(access.digest,'hex');
  if(expected.length!==32)return false;
  return timingSafeEqual(Buffer.from(teacherCodeDigest(masterKey,code),'hex'),expected);
}
