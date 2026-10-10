// 발전소 문제는 클라이언트 연습 전용입니다. 재화·성적을 바꾸지 않습니다.
const WORDS=Object.freeze([
  ['apple','사과'],['banana','바나나'],['bread','빵'],['water','물'],['milk','우유'],
  ['school','학교'],['teacher','선생님'],['student','학생'],['friend','친구'],['family','가족'],
  ['mother','어머니'],['father','아버지'],['sister','자매'],['brother','형제'],['home','집'],
  ['book','책'],['pencil','연필'],['desk','책상'],['chair','의자'],['door','문'],
  ['window','창문'],['garden','정원'],['flower','꽃'],['tree','나무'],['leaf','잎'],
  ['sun','태양'],['moon','달'],['star','별'],['sky','하늘'],['rain','비'],
  ['snow','눈'],['wind','바람'],['river','강'],['mountain','산'],['ocean','바다'],
  ['happy','행복한'],['kind','친절한'],['brave','용감한'],['small','작은'],['large','큰'],
  ['morning','아침'],['evening','저녁'],['today','오늘'],['tomorrow','내일'],['yesterday','어제'],
  ['read','읽다'],['write','쓰다'],['listen','듣다'],['speak','말하다'],['learn','배우다'],
  ['walk','걷다'],['run','달리다'],['jump','뛰다'],['play','놀다'],['help','돕다'],
  ['color','색깔'],['number','숫자'],['music','음악'],['picture','그림'],['story','이야기']
]);
export const ENGLISH_WORDS=WORDS;
const pick=(rng,n)=>Math.min(n-1,Math.max(0,Math.floor(rng()*n)));
const shuffle=(items,rng)=>{const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=pick(rng,i+1);[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;};
function numberChoices(answer,rng){
  const choices=new Set([answer]);
  for(const offset of [1,-1,2,-2,5,-5,10,-10,answer>20?20:3])if(answer+offset>=0)choices.add(answer+offset);
  return shuffle([answer,...shuffle([...choices].filter(value=>value!==answer),rng).slice(0,3)],rng);
}
export function mathQuestion(level='basic',rng=Math.random){
  const n=(min,max)=>min+pick(rng,max-min+1),type=pick(rng,4);let a,b,answer,prompt;
  if(level==='challenge'){
    if(type===0){a=n(120,790);b=n(35,190);answer=a+b;prompt=`${a} + ${b} = ?`;}
    else if(type===1){a=n(210,900);b=n(40,a-30);answer=a-b;prompt=`${a} − ${b} = ?`;}
    else if(type===2){a=n(12,29);b=n(3,12);answer=a*b;prompt=`${a} × ${b} = ?`;}
    else{answer=n(8,35);b=n(3,12);a=answer*b;prompt=`${a} ÷ ${b} = ?`;}
  }else{
    if(type===0){a=n(10,70);b=n(8,29);answer=a+b;prompt=`${a} + ${b} = ?`;}
    else if(type===1){a=n(30,99);b=n(5,a-2);answer=a-b;prompt=`${a} − ${b} = ?`;}
    else if(type===2){a=n(2,9);b=n(2,9);answer=a*b;prompt=`${a} × ${b} = ?`;}
    else{answer=n(2,9);b=n(2,9);a=answer*b;prompt=`${a} ÷ ${b} = ?`;}
  }
  return {prompt,answer,choices:numberChoices(answer,rng)};
}
export function englishQuestion(rng=Math.random,used=new Set()){
  const available=WORDS.filter(([word])=>!used.has(word));
  const pool=available.length?available:WORDS;
  const [word,answer]=pool[pick(rng,pool.length)];
  const others=WORDS.filter(([,meaning])=>meaning!==answer).map(([,meaning])=>meaning);
  return {prompt:word,answer,choices:shuffle([answer,...shuffle(others,rng).slice(0,3)],rng)};
}
