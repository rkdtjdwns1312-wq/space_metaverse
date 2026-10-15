import {createCipheriv,createDecipheriv,createHmac,hkdfSync,randomBytes,randomInt,timingSafeEqual} from 'node:crypto';

const CODE_CHARACTERS='abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@';
const SHORT_CODE=/^(?=.*[a-z])(?=.*[A-Z])(?=.*[2-9])(?=.*[!@])[A-Za-z2-9!@]{8}$/;
const LEGACY_CODE=/^T-[A-Za-z0-9_-]{20}$/;
const ENCRYPTION_VERSION=1;
const ENCRYPTION_SALT=Buffer.from('space-classroom:teacher-code:aes-gcm:v1');
const ENCRYPTION_INFO=Buffer.from('admin-code-storage');

function encryptionKey(masterKey){
  return Buffer.from(hkdfSync('sha256',Buffer.from(masterKey),ENCRYPTION_SALT,ENCRYPTION_INFO,32));
}

export function isEncryptedTeacherCode(value){
  if(!value||typeof value!=='object'||value.version!==ENCRYPTION_VERSION||
    typeof value.iv!=='string'||typeof value.tag!=='string'||typeof value.ciphertext!=='string')return false;
  const decode=encoded=>{
    if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))return null;
    const bytes=Buffer.from(encoded,'base64');return bytes.toString('base64')===encoded?bytes:null;
  };
  return decode(value.iv)?.length===12&&decode(value.tag)?.length===16&&decode(value.ciphertext)?.length>0;
}

export function encryptTeacherCode(masterKey,code){
  if(typeof code!=='string'||(!SHORT_CODE.test(code)&&!LEGACY_CODE.test(code)))throw new Error('교사 코드를 암호화할 수 없습니다.');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(masterKey),iv);
  const ciphertext=Buffer.concat([cipher.update(code,'utf8'),cipher.final()]);
  return {version:ENCRYPTION_VERSION,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
}

export function decryptTeacherCode(masterKey,encrypted){
  if(!isEncryptedTeacherCode(encrypted))throw new Error('암호화된 교사 코드 형식이 올바르지 않습니다.');
  const decipher=createDecipheriv('aes-256-gcm',encryptionKey(masterKey),Buffer.from(encrypted.iv,'base64'));
  decipher.setAuthTag(Buffer.from(encrypted.tag,'base64'));
  const code=Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext,'base64')),decipher.final()]).toString('utf8');
  if(!SHORT_CODE.test(code)&&!LEGACY_CODE.test(code))throw new Error('복호화된 교사 코드 형식이 올바르지 않습니다.');
  return code;
}

// 헷갈리기 쉬운 0/1/O/I/l/o를 제외한 8자리 코드를 발급합니다.
// 저장소에는 HMAC 검증값과 AES-GCM 암호문을 남깁니다. 원문은 반환 시점에만 존재합니다.
export function issueTeacherCode(masterKey){
  let code;
  do { code=Array.from({length:8},()=>CODE_CHARACTERS[randomInt(CODE_CHARACTERS.length)]).join(''); }
  while(!SHORT_CODE.test(code));
  return {code,digest:teacherCodeDigest(masterKey,code),encryptedCode:encryptTeacherCode(masterKey,code)};
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
