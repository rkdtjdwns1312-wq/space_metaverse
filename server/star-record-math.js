import {GameError} from './pin-auth.js';
import {ensureVitals} from './vitals.js';
import {defeatRecordPlayer} from './star-record-challenge.js';
import {STATIC_MAPS} from '../shared/config.js';
import {onOriginFloor} from '../shared/origin-floor.js';

export const STAR_RECORD_MATH=Object.freeze({mana:20,cooldownMs:60000,durationMs:30000,decisionMs:3000,chance:.45,reach:94});
const operators=['+','−','×','÷'];
const solves=(star,operator)=>({'+':()=>star.left+star.right,'−':()=>star.left-star.right,'×':()=>star.left*star.right,'÷':()=>star.right!==0?star.left/star.right:NaN})[operator]()===star.result;
const pick=(random,length)=>Math.min(length-1,Math.max(0,Math.floor((Number(random())||0)*length)));
function question(random){
  const operator=operators[pick(random,4)],one=()=>1+pick(random,9);
  let left,right,result;
  if(operator==='+'){left=1+pick(random,49);right=1+pick(random,50);result=left+right;}
  else if(operator==='−'){left=1+pick(random,99);right=1+pick(random,left);result=left-right;}
  else if(operator==='×'){left=one();right=one();result=left*right;}
  else{right=one();result=one();left=right*result;}
  return {left,right,result,operator};
}
// Include the book's painted width and the number star's glow, not just its hitbox.
export const starRecordNumberClearance=boss=>(boss.radius||150)*1.2+66;
export function starRecordNumberBodies(boss){
 return (boss.recordMath?.stars||[]).filter(s=>!s.solved).map(s=>({x:s.x,y:s.y,
  gapSquared:starRecordNumberClearance(boss)**2,currentSquared:(boss.x-s.x)**2+(boss.y-s.y)**2}));
}
const positions=(boss)=>{const map=STATIC_MAPS[boss.mapId],cx=(map?.width??boss.x*2)/2,cy=(map?.height??boss.y*2)/2;
 const candidates=[[-440,-240],[-280,340],[0,-480],[280,340],[440,-240]];
 for(let dy=-480;dy<=480;dy+=160)for(let dx=-640;dx<=640;dx+=160)candidates.push([dx,dy]);
 const result=[];
 for(const [dx,dy] of candidates){
  const x=cx+dx,y=cy+dy;
  if(!map||!onOriginFloor(map,x,y,64)||Math.hypot(x-boss.x,y-boss.y)<starRecordNumberClearance(boss)||
     result.some(s=>Math.hypot(x-s.x,y-s.y)<280)||
     map.objects.some(o=>o.kind==='gate'&&Math.hypot(x-o.x,y-o.y)<180))continue;
  result.push({id:'record-number-'+(result.length+1),x,y});
  if(result.length===5)return result;
 }
 return null;
};
export function tryStarRecordMath(room,boss,now=Date.now(),random=Math.random){
  const rule=STAR_RECORD_MATH;
  if(boss.typeId!=='star-record'||boss.hp<=0||boss.recordMath||boss.recordChallenge||boss.recordFlow||boss.starRecordCast||
    now<(boss.recordMathReadyAt||0)||now<(boss.recordMathDecisionAt||0)||boss.mp<rule.mana)return false;
  boss.recordMathDecisionAt=now+rule.decisionMs;
  if((Number(random())||0)>=rule.chance||![...room.players.values()].some(player=>player.connected&&!player.away&&player.mapId===boss.mapId&&ensureVitals(player)?.hp>0))return false;
  const sites=positions(boss);if(!sites)return false;
  boss.mp-=rule.mana;boss.recordMathReadyAt=now+rule.cooldownMs;
  boss.recordMath={startsAt:now,endsAt:now+rule.durationMs,stars:sites.map(position=>({...position,...question(random),solved:false}))};
  return true;
}
export function answerStarRecordMath(room,player,starId,operator,now=Date.now()){
  const boss=room.monsters?.get('star-record-boss'),math=boss?.recordMath;
  if(!math||now>=math.endsAt||boss.hp<=0||player.mapId!==boss.mapId||!player.connected||player.away||ensureVitals(player)?.hp<=0)
    throw new GameError('지금은 숫자 별을 풀 수 없어요.');
  const star=math.stars.find(item=>item.id===starId&&!item.solved);
  if(!star||Math.hypot(player.x-star.x,player.y-star.y)>STAR_RECORD_MATH.reach)throw new GameError('숫자 별 가까이에서 다시 시도해 주세요.');
  if(!operators.includes(operator))throw new GameError('연산 기호를 선택해 주세요.');
  if(!solves(star,operator)){
    const hit=defeatRecordPlayer(room,player,now);
    return {correct:false,hit:{monsterId:boss.id,mapId:boss.mapId,x:player.x,y:player.y,skillKind:'star-record-math-wrong',targetId:player.id,...hit}};
  }
  star.solved=true;
  if(math.stars.every(item=>item.solved))boss.recordMath=null;
  return {correct:true,remaining:math.stars.filter(item=>!item.solved).length};
}
export function tickStarRecordMath(room,boss,now=Date.now()){
  const math=boss.recordMath;if(!math)return {busy:false,hits:[]};
  if(now<math.endsAt)return {busy:true,hits:[]};
  boss.recordMath=null;
  if(math.stars.every(item=>item.solved))return {busy:true,hits:[]};
  const hits=[...room.players.values()].filter(player=>player.connected&&!player.away&&player.mapId===boss.mapId&&ensureVitals(player)?.hp>0)
    .map(player=>({monsterId:boss.id,mapId:boss.mapId,x:player.x,y:player.y,skillKind:'star-record-math-timeout',targetId:player.id,
      ...defeatRecordPlayer(room,player,now)}));
  return {busy:true,hits};
}
export function starRecordMathView(boss,now=Date.now()){
  const math=boss.recordMath;if(!math||now>=math.endsAt)return null;
  return {line:'세계를 구성하는 위대한 숫자에 감탄하라',endsAt:math.endsAt,
    stars:math.stars.filter(star=>!star.solved).map(({id,x,y,left,right,result})=>({id,x,y,left,right,result}))};
}
