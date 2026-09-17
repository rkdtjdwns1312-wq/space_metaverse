import {CHAT} from '../shared/config.js';
import {ensure} from './rooms.js';

// 채널·연결 소켓이 아니라 학생 객체에 기록하여 채널 전환/재접속으로 우회하지 못하게 합니다.
// 성공한 메시지만 기록하며 짧은 시간 창만 유지하므로 저장되는 기록 수는 작습니다.
export function checkChatRate(player,text,now=Date.now()) {
  ensure(now-(player.lastChatAt||0)>=CHAT.cooldownMs,'조금 천천히 말해요.');
  const recent=(player.recentChats||[]).filter(m=>now-m.at<Math.max(CHAT.rateWindowMs,CHAT.repeatWindowMs));
  ensure(recent.filter(m=>now-m.at<CHAT.rateWindowMs).length<CHAT.maxPerWindow,'10초 동안 5번까지 말할 수 있어요. 잠시 기다려주세요.');
  // 공백·대소문자만 바꿔 같은 말을 반복하는 경우도 막습니다.
  const signature=text.replace(/\s/gu,'').toLocaleLowerCase('ko-KR');
  ensure(!recent.some(m=>now-m.at<CHAT.repeatWindowMs&&m.text===signature),'같은 말은 10초 뒤에 다시 보내주세요.');
  return [...recent,{at:now,text:signature}];
}
