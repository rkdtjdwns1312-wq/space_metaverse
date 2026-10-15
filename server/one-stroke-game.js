import {randomUUID,randomInt} from 'node:crypto';
import {oneStrokePuzzle} from '../shared/one-stroke.js';
import {ensure} from './rooms.js';
export function startOneStroke(player,difficulty){
 ensure(['low','medium','high'].includes(difficulty),'난이도를 골라 주세요.');
 const run={id:randomUUID(),difficulty,...oneStrokePuzzle(difficulty,()=>randomInt(1000000)/1000000)};
 player.oneStrokeRun=run;return {runId:run.id,difficulty,points:run.points,edges:run.edges};
}
export function completeOneStroke(player,{runId,path}={}){
 const run=player.oneStrokeRun;ensure(run&&run.id===runId,'한붓그리기를 새로 시작해 주세요.');
 ensure(Array.isArray(path)&&path.length===run.edges.length+1&&path.every(i=>Number.isSafeInteger(i)&&i>=0&&i<run.points.length),'모든 선을 한 번씩 이어 주세요.');
 const used=new Set();
 for(let i=1;i<path.length;i++){const edge=run.edges.findIndex(([a,b],n)=>!used.has(n)&&(a===path[i-1]&&b===path[i]||b===path[i-1]&&a===path[i]));ensure(edge>=0,'한 선은 한 번만 지나갈 수 있어요.');used.add(edge);}
 delete player.oneStrokeRun;return {won:true,difficulty:run.difficulty};
}
