import {randomUUID} from 'node:crypto';
import {ensure} from './rooms.js';

const MAX_TASKS=100;
export function validateTasks(value){
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>MAX_TASKS||value.some(task=>
    !task||typeof task.id!=='string'||typeof task.assignmentId!=='string'||typeof task.text!=='string'||!task.text.trim()||task.text.length>2000||
    typeof task.sourceDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(task.sourceDate)||
    !Number.isInteger(task.lineIndex)||task.lineIndex<0||task.lineIndex>2000||
    !Number.isSafeInteger(task.at)||task.at<0)||new Set(value.map(task=>task.id)).size!==value.length)
    throw new Error('과제 저장 데이터가 올바르지 않습니다.');
  return structuredClone(value);
}
export function addTask(player,{assignmentId,text,sourceDate,lineIndex},now=Date.now()){
  player.tasks??=[];
  ensure(player.tasks.length<MAX_TASKS,'나의 과제가 가득 찼어요. 완료한 과제를 정리해주세요.');
  ensure(!player.tasks.some(task=>task.assignmentId===assignmentId),'이미 나의 과제로 가져왔어요.');
  const task={id:randomUUID(),assignmentId,text,sourceDate,lineIndex,at:now};player.tasks.push(task);
  return structuredClone(player.tasks);
}
export function completeTask(player,taskId){
  const index=player.tasks?.findIndex(task=>task.id===taskId)??-1;
  ensure(index>=0,'과제를 찾지 못했어요.');player.tasks.splice(index,1);
  return structuredClone(player.tasks);
}
