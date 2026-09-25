import assert from 'node:assert/strict';
import {INTERIOR,interiorIdOf} from '../shared/config.js';
// 이름 투표 등 다른 기능의 준비 단계도 실제 승인 경로를 거칩니다.
export async function approveJoinFixture(game,approver,applicant,planetId){
 const room=[...game.store.rooms.values()].find(r=>[...r.players.values()].some(p=>p.socketId===approver.id));
 const actor=[...room.players.values()].find(p=>p.socketId===approver.id),target=[...room.players.values()].find(p=>p.socketId===applicant.id);
 const previous={mapId:actor.mapId,x:actor.x,y:actor.y};const box=INTERIOR.objects.find(o=>o.kind==='mailbox');
 Object.assign(actor,{mapId:interiorIdOf(planetId),x:box.x,y:box.y+60});
 const result=await approver.timeout(3000).emitWithAck('planet:mailbox:decide',{planetId,playerId:target.id,accept:true});
 Object.assign(actor,previous);assert.equal(result.ok,true,result.error);return result;
}
