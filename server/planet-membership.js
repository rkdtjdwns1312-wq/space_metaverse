import {ensure} from './rooms.js';
// 계정이 잠시 접속하지 않아도 부원으로 셉니다. 신청 중에는 기존 소속을 유지합니다.
export const departmentMembers=(room,planetId)=>[...room.players.values()].filter(p=>p.role==='student'&&p.avatar.departmentId===planetId);
export function validateJoinRequests(value){
  if(value===undefined)return [];
  ensure(Array.isArray(value)&&value.length<=29&&value.every(r=>r&&typeof r.playerId==='string'&&Number.isSafeInteger(r.at)&&r.at>=0)&&new Set(value.map(r=>r.playerId)).size===value.length,'행성 가입 신청 저장 데이터가 올바르지 않습니다.');
  return value.map(({playerId,at})=>({playerId,at}));
}
export function clearJoinRequests(room,playerId){for(const planet of room.planets.values())planet.joinRequests=(planet.joinRequests||[]).filter(r=>r.playerId!==playerId);}
export function requestMembership(room,planet,player,now){
  if(!departmentMembers(room,planet.id).length)return {pending:false};
  if((planet.joinRequests||[]).some(r=>r.playerId===player.id))return {pending:true};
  clearJoinRequests(room,player.id);planet.joinRequests??=[];planet.joinRequests.push({playerId:player.id,at:now});return {pending:true};
}
export function mailboxView(room,planet){return {planetId:planet.id,name:planet.name,requests:(planet.joinRequests||[]).filter(r=>room.players.get(r.playerId)?.role==='student').map(r=>({...r,nickname:room.players.get(r.playerId).nickname}))};}
