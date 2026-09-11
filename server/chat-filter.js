// 초등학생 채팅용 욕설/비속어 필터입니다. 다른 로직에 의존하지 않는 순수 함수만 둡니다.
// 금지어를 추가하거나 빼고 싶으면 아래 BLOCKED_WORDS 배열만 고치면 됩니다.
export const BLOCKED_WORDS=[
  '바보','멍청이','멍청아','병신','씨발','시발','씨팔','개새끼','개자식','좆','좆같','존나','존나게',
  '미친놈','미친년','미친새끼','꺼져','닥쳐','닥치고','죽어','죽일놈','썅','걸레',
  'fuck','fucking','shit','bitch','asshole'
];
const SORTED=[...BLOCKED_WORDS].filter(Boolean).sort((a,b)=>b.length-a.length);
export function filterChat(text) {
  const normalized=String(text).normalize('NFKC');
  let masked=normalized,flagged=false;
  for(const word of SORTED) {
    const needle=word.toLowerCase();
    let hay=masked.toLowerCase(),from=0;
    while(true) {
      const idx=hay.indexOf(needle,from);
      if(idx===-1)break;
      masked=masked.slice(0,idx)+'○'.repeat(needle.length)+masked.slice(idx+needle.length);
      hay=masked.toLowerCase();from=idx+needle.length;flagged=true;
    }
  }
  if(flagged)return {text:masked,flagged:true};
  const stripped=normalized.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  if(SORTED.some(word=>stripped.includes(word.toLowerCase())))return {text:'○○○',flagged:true};
  return {text:normalized,flagged:false};
}
