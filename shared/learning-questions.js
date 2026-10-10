// 수학은 브라우저 연습용, 영어는 서버가 같은 문제 목록에서 출제·채점합니다.
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
function numberChoices(answer,rng,step=1){
  const choices=new Set([answer]);
  for(const offset of [1,-1,2,-2,5,-5,10,-10,20]){
    const value=Math.round((answer+offset*step)*100)/100;
    if(value>=0)choices.add(value);
  }
  return shuffle([answer,...shuffle([...choices].filter(value=>value!==answer),rng).slice(0,3)],rng);
}
const gcd=(a,b)=>b?gcd(b,a%b):a;
const fraction=(num,den)=>{const divisor=gcd(num,den);return den/divisor===1?String(num/divisor):`${num/divisor}/${den/divisor}`;};
function fractionQuestion(prompt,num,den,rng){
  const answer=fraction(num,den),choices=new Set([answer]);
  for(const offset of [1,-1,2,-2,3,-3,4,-4,5])if(num+offset>0)choices.add(fraction(num+offset,den));
  return {prompt,answer,choices:shuffle([answer,...shuffle([...choices].filter(value=>value!==answer),rng).slice(0,3)],rng)};
}
export function mathQuestion(level='grade-1',rng=Math.random){
  const n=(min,max)=>min+pick(rng,max-min+1),type=pick(rng,level==='grade-1'?2:level==='grade-2'?3:4);
  let a,b,answer,prompt,step=1;
  if(level==='grade-1'){
    if(type===0){a=n(1,10);b=n(1,20-a);answer=a+b;prompt=`${a} + ${b} = ?`;}
    else{a=n(2,20);b=n(1,a);answer=a-b;prompt=`${a} − ${b} = ?`;}
  }else if(level==='grade-2'){
    if(type===0){a=n(10,79);b=n(10,100-a);answer=a+b;prompt=`${a} + ${b} = ?`;}
    else if(type===1){a=n(30,99);b=n(10,a);answer=a-b;prompt=`${a} − ${b} = ?`;}
    else{a=n(2,5);b=n(2,9);answer=a*b;prompt=`${a} × ${b} = ?`;}
  }else if(level==='grade-3'){
    if(type===0){a=n(100,799);b=n(100,999-a);answer=a+b;prompt=`${a} + ${b} = ?`;}
    else if(type===1){a=n(200,999);b=n(100,a);answer=a-b;prompt=`${a} − ${b} = ?`;}
    else if(type===2){a=n(2,9);b=n(2,9);answer=a*b;prompt=`${a} × ${b} = ?`;}
    else{answer=n(2,9);b=n(2,9);a=answer*b;prompt=`${a} ÷ ${b} = ?`;}
  }else if(level==='grade-4'){
    if(type===0){a=n(1000,7999);b=n(1000,9999-a);answer=a+b;prompt=`${a} + ${b} = ?`;}
    else if(type===1){a=n(2000,9999);b=n(1000,a);answer=a-b;prompt=`${a} − ${b} = ?`;}
    else if(type===2){a=n(12,49);b=n(3,19);answer=a*b;prompt=`${a} × ${b} = ?`;}
    else{answer=n(12,49);b=n(11,29);a=answer*b;prompt=`${a} ÷ ${b} = ?`;}
  }else if(level==='grade-5'){
    if(type<2){a=n(20,300)/10;b=n(10,type===0?200:Math.round(a*10))/10;answer=Math.round((type===0?a+b:a-b)*10)/10;prompt=`${a} ${type===0?'+':'−'} ${b} = ?`;step=.1;}
    else if(type===2){a=n(21,79);b=n(11,39);answer=a*b;prompt=`${a} × ${b} = ?`;}
    else{const den=n(4,10),left=n(1,den-2),right=n(1,den-left-1);return fractionQuestion(`${left}/${den} + ${right}/${den} = ?`,left+right,den,rng);}
  }else if(level==='grade-6'){
    if(type===0){a=n(12,95)/10;b=n(12,95)/10;answer=Math.round(a*b*100)/100;prompt=`${a} × ${b} = ?`;step=.01;}
    else if(type===1){answer=n(12,95)/10;b=n(2,9)/10;a=Math.round(answer*b*100)/100;prompt=`${a} ÷ ${b} = ?`;step=.1;}
    else{const d1=n(3,9),d2=n(3,9),p1=n(1,d1-1),p2=n(1,d2-1);
      return type===2?fractionQuestion(`${p1}/${d1} × ${p2}/${d2} = ?`,p1*p2,d1*d2,rng)
        :fractionQuestion(`${p1}/${d1} ÷ ${p2}/${d2} = ?`,p1*d2,d1*p2,rng);}
  }else throw new RangeError(`알 수 없는 수학 단계: ${level}`);
  return {prompt,answer,choices:numberChoices(answer,rng,step)};
}
export function englishQuestion(rng=Math.random,used=new Set()){
  const available=WORDS.filter(([word])=>!used.has(word));
  const pool=available.length?available:WORDS;
  const [word,answer]=pool[pick(rng,pool.length)];
  const others=WORDS.filter(([,meaning])=>meaning!==answer).map(([,meaning])=>meaning);
  return {prompt:word,answer,choices:shuffle([answer,...shuffle(others,rng).slice(0,3)],rng)};
}
