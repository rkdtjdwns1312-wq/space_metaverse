import { randomUUID } from 'node:crypto';
import { ensure } from './rooms.js';
import { planetIdOfMap, STATIC_MAPS, BLACK_HOLE_ID } from '../shared/config.js';
import { arrivePosition } from './world.js';

export const SOCIAL = { rejectMs:24*60*60*1000, requestMs:60_000, cooldownMs:5000 };
// 화면 선택이나 클라이언트가 보낸 맵/소속 값은 믿지 않습니다.
export function chatScope(room, player, data) {
  const channel=data.channel??'map';
  ensure(['map','department','direct'].includes(channel),'대화 종류를 골라주세요.');
  if(channel==='map')return {channel,mapId:player.mapId};
  if(channel==='department'){
    const departmentId=player.avatar.departmentId;
    ensure(departmentId&&room.planets.has(departmentId),'부서행성에 가입하면 행성 대화를 할 수 있어요.');
    return {channel,departmentId};
  }
  const target=room.players.get(data.targetId);
  ensure(target&&target.id!==player.id,'대화할 친구를 골라주세요.');
  return {channel,targetId:target.id};
}
export function canReadChat(player,msg) {
  if(msg.role==='system')return true; // 공통 운영 안내, 개인 안내는 별도 notes에 보관
  if(msg.channel==='map')return msg.mapId===player.mapId;
  if(msg.channel==='department')return !!player.avatar.departmentId&&msg.departmentId===player.avatar.departmentId;
  if(msg.channel==='direct')return msg.playerId===player.id||msg.targetId===player.id;
  // 구버전에는 발신 맵이 없었습니다. 맵을 추정해 학생에게 보내지 않습니다.
  return player.role==='teacher';
}
export function visibleHistory(room,player) {
  return [...room.chat.history.filter(m=>canReadChat(player,m)),...player.notes].sort((a,b)=>a.at-b.at);
}
function state(room,now) {
  room.summons??=new Map();room.summonCooldowns??=new Map();
  for(const [id,r] of room.summons)if(r.expiresAt<=now)room.summons.delete(id);
  for(const [key,until] of room.summonCooldowns)if(until<=now)room.summonCooldowns.delete(key);
}
function canTravel(room,target,host) {
  ensure(!target.avatar.blackStar || host.mapId===BLACK_HOLE_ID,'현재 검은별 상태입니다');
  const planetId=planetIdOfMap(host.mapId);
  ensure(planetId?room.planets.has(planetId):!!STATIC_MAPS[host.mapId],'친구가 있는 맵을 찾지 못했어요.');
  ensure(!planetId||target.role==='teacher'||target.avatar.departmentId===planetId,'가입한 부서행성으로만 이동할 수 있어요.');
  ensure(!target.movementLocked,'선생님이 이동을 잠시 멈췄어요.');
}
export function requestSummon(room,player,targetId,now=Date.now()) {
  state(room,now);
  const target=room.players.get(targetId);
  ensure(target&&target.id!==player.id&&target.connected,'현재 접속 중인 친구를 골라주세요.');
  ensure(room.unattended||[...room.players.values()].some(p=>p.role==='teacher'&&p.connected),'선생님이 다시 연결할 때까지 기다려주세요.');
  ensure((room.summonCooldowns.get(player.id+':'+target.id)||0)<=now,'이 친구가 거절했어요. 거절한 때부터 24시간 뒤에 다시 요청할 수 있어요.');
  ensure(now-(player.lastSummonAt||0)>=SOCIAL.cooldownMs,'조금 기다린 뒤 요청해주세요.');
  ensure(![...room.summons.values()].some(r=>r.fromId===player.id),'이미 보낸 요청의 답을 기다리고 있어요.');
  canTravel(room,target,player);
  const r={id:randomUUID(),fromId:player.id,toId:target.id,fromNickname:player.nickname,expiresAt:now+SOCIAL.requestMs};
  room.summons.set(r.id,r);player.lastSummonAt=now;return r;
}
export function respondSummon(room,player,id,accept,now=Date.now()) {
  state(room,now);
  const r=room.summons.get(id);
  ensure(r&&r.toId===player.id,'요청이 끝났거나 나에게 온 요청이 아니에요.');
  ensure(typeof accept==='boolean','예 또는 아니오를 골라주세요.');
  if(!accept){room.summons.delete(id);room.summonCooldowns.set(r.fromId+':'+r.toId,now+SOCIAL.rejectMs);return r;}
  const host=room.players.get(r.fromId);
  ensure(host?.connected,'요청한 친구가 연결되어 있지 않아요.');
  ensure(room.unattended||[...room.players.values()].some(p=>p.role==='teacher'&&p.connected),'선생님이 다시 연결할 때까지 기다려주세요.');
  canTravel(room,player,host);
  // 수락 시점의 서버 위치에서 충돌 없는 빈자리만 선택합니다.
  const pos=arrivePosition(room,host.mapId,host);
  Object.assign(player,pos,{mapId:host.mapId,input:{x:0,y:0,at:0}});
  room.summons.delete(id);return r;
}
