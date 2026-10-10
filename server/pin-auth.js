import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
export class GameError extends Error {}

export const PIN_RULES={attempts:5,lockMs:60_000};

export function pinHash(pin){
  if(typeof pin!=='string'||!/^\d{4}$/.test(pin))throw new GameError('비밀번호는 숫자 4자리로 입력해주세요.');
  const salt=randomBytes(16).toString('hex');
  return {salt,hash:scryptSync(pin,salt,32).toString('hex'),failures:0,lockedUntil:0};
}

export function checkPin(player,pin){
  if(typeof pin!=='string'||!/^\d{4}$/.test(pin))throw new GameError('비밀번호는 숫자 4자리로 입력해주세요.');
  const auth=player.pin,now=Date.now();
  if(auth.lockedUntil>now)throw new GameError('비밀번호를 여러 번 틀렸어요. 1분 후 다시 시도해주세요.');
  const valid=timingSafeEqual(Buffer.from(auth.hash,'hex'),scryptSync(pin,auth.salt,32));
  if(!valid){
    auth.failures++;
    if(auth.failures>=PIN_RULES.attempts){auth.lockedUntil=now+PIN_RULES.lockMs;auth.failures=0;}
    const error=new GameError('비밀번호가 맞지 않아요. 잊었다면 선생님께 알려주세요.');
    error.commitOnError=true;throw error;
  }
  auth.failures=0;auth.lockedUntil=0;
}
