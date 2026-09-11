// 초등학생 채팅용 욕설/비속어 필터입니다. 다른 로직에 의존하지 않는 순수 함수만 둡니다.
// 금지어를 추가하거나 빼고 싶으면 아래 BLOCKED_WORDS 배열만 고치면 됩니다.
// 동작: 금지어가 그대로 들어 있거나 구두점·기호를 끼워 넣어 숨긴 경우("시.발", "바~보")에 그 구간을 ○로 바꿉니다.
// 띄어쓰기로 나눈 경우("바 보")는 "시 발표" 같은 정상 문장을 잘못 가리는 일이 많아 걸러내지 않습니다.
// 그런 경우는 선생님의 채팅 금지·지우기 기능으로 보완합니다.
export const BLOCKED_WORDS=[
  '바보','멍청이','멍청아','병신','씨발','시발','씨팔','개새끼','개자식','좆','좆같','존나','존나게',
  '미친놈','미친년','미친새끼','꺼져','닥쳐','닥치고','죽어라','죽일놈','썅',
  'fuck','fucking','shit','bitch','asshole'
];
const WORDS=BLOCKED_WORDS.filter(Boolean).map(w=>[...w.normalize('NFKC').toLowerCase()]).sort((a,b)=>b.length-a.length);
const isSkippable=ch=>/[\p{P}\p{S}]/u.test(ch); // 구두점·기호는 건너뛰고 비교합니다. 공백은 건너뛰지 않습니다.
export function filterChat(text) {
  const chars=[...String(text).normalize('NFKC')];
  const kept=[];for(let i=0;i<chars.length;i++)if(!isSkippable(chars[i]))kept.push(i);
  const view=kept.map(i=>chars[i].toLowerCase());
  const mask=new Array(chars.length).fill(false);let flagged=false;
  for(const word of WORDS){
    for(let j=0;j+word.length<=view.length;j++){
      let k=0;while(k<word.length&&view[j+k]===word[k])k++;
      if(k<word.length)continue;
      for(let i=kept[j];i<=kept[j+word.length-1];i++)mask[i]=true;
      flagged=true;j+=word.length-1;
    }
  }
  if(!flagged)return {text:chars.join(''),flagged:false};
  return {text:chars.map((ch,i)=>mask[i]?'○':ch).join(''),flagged:true};
}
