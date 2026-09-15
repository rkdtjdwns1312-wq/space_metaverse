export const BASEBALL_LEVELS=Object.freeze([
  Object.freeze({id:'low',name:'하',digits:3}),
  Object.freeze({id:'medium',name:'중',digits:4}),
  Object.freeze({id:'high',name:'상',digits:5})
]);

function randomIndex(random,size){
  const value=Number(random());
  if(!Number.isFinite(value))return 0;
  return Math.min(size-1,Math.max(0,Math.floor(value*size)));
}

export function generateBaseballAnswer(length,random=Math.random){
  if(!Number.isInteger(length)||length<1||length>10)throw new RangeError('자리 수는 1~10 사이여야 합니다.');
  const digits=[0,1,2,3,4,5,6,7,8,9];
  for(let i=digits.length-1;i>0;i--){
    const j=randomIndex(random,i+1);
    [digits[i],digits[j]]=[digits[j],digits[i]];
  }
  if(digits[0]===0){
    const replacement=digits.findIndex((digit,index)=>index>0&&digit!==0);
    [digits[0],digits[replacement]]=[digits[replacement],digits[0]];
  }
  return digits.slice(0,length).join('');
}

export function validateBaseballInput(raw,length){
  const value=String(raw??'').trim();
  if(!Number.isInteger(length)||value.length!==length)return {valid:false,value,message:`중복 없는 ${length}자리 숫자를 입력하세요.`};
  if(!/^\d+$/.test(value))return {valid:false,value,message:'숫자만 입력하세요.'};
  if(value[0]==='0')return {valid:false,value,message:'첫 숫자는 0이 될 수 없어요.'};
  if(new Set(value).size!==value.length)return {valid:false,value,message:'같은 숫자는 한 번만 쓸 수 있어요.'};
  return {valid:true,value,message:''};
}

export function scoreBaseballQuestion(answer,input){
  if(typeof answer!=='string'||typeof input!=='string'||answer.length!==input.length)throw new TypeError('같은 자리 수의 문자열이 필요합니다.');
  let strikes=0,balls=0;
  for(let index=0;index<input.length;index++){
    if(input[index]===answer[index])strikes++;
    else if(answer.includes(input[index]))balls++;
  }
  return {strikes,balls};
}
