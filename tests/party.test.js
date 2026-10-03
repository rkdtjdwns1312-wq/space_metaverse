import test from 'node:test';
import assert from 'node:assert/strict';
import {inviteParty,respondParty,leaveParty,partyOf,PARTY_REJECT_MS} from '../server/party.js';
import {addBossDrops,collectEnergyDrop,rerollPartyLoot,addEnergyDrop} from '../server/energy-drops.js';

const student=(id)=>({id,nickname:id,role:'student',connected:true,away:false,mapId:'sun-paradise-3',
  x:0,y:0,avatar:{level:4,constellationId:'gemini',blackStar:false},inventory:[],cosmicEnergy:0});
const room=()=>{const players=new Map(['a','b','c','d','e'].map(id=>[id,student(id)]));return {players,parties:new Map()};};

test('파티는 4명까지이고 거절하면 초대한 친구에게 5분 제한이 적용된다',()=>{
  const r=room(),a=r.players.get('a'),b=r.players.get('b'),now=1000;
  const first=inviteParty(r,a,b.id,now);
  assert.equal(respondParty(r,b,first.id,false,now+1).accepted,false);
  assert.throws(()=>inviteParty(r,a,b.id,now+2),/5분/);
  const accepted=inviteParty(r,a,b.id,now+PARTY_REJECT_MS+2);
  assert.equal(respondParty(r,b,accepted.id,true,now+PARTY_REJECT_MS+3).party.memberIds.length,2);
  for(const id of ['c','d']){const invitation=inviteParty(r,a,id,now+PARTY_REJECT_MS+4);
    respondParty(r,r.players.get(id),invitation.id,true,now+PARTY_REJECT_MS+5);}
  assert.equal(partyOf(r,a.id).memberIds.length,4);
  assert.throws(()=>inviteParty(r,a,'e',now+PARTY_REJECT_MS+6),/네 명/);
  leaveParty(r,'b');assert.equal(partyOf(r,a.id).memberIds.length,3);
});

test('보스 재료는 파티에 한 개만 떨어지고 동점끼리 R 재굴림해 최고 눈 한 명에게만 간다',()=>{
  const r=room(),a=r.players.get('a'),b=r.players.get('b');
  r.parties.set('p',{id:'p',leaderId:'a',memberIds:['a','b']});
  const monster={typeId:'leoon',mapId:'sun-paradise-3',x:0,y:0},contributions=new Map([['a',100]]);
  const [drop]=addBossDrops(r,monster,contributions,1000,()=>1);
  assert.deepEqual([...drop.shares.keys()],['a','b']);
  assert.equal(r.energyDrops.size,1,'파티 전체에 전용 재료 한 개');
  const first=collectEnergyDrop(r,a,drop.id,1100,()=>6);
  assert.equal(first.pendingRoll,true);assert.deepEqual(first.roll.tiedIds,['a','b']);
  assert.equal(a.inventory.length+b.inventory.length,0);
  let index=0;const second=rerollPartyLoot(r,b,drop.id,1200,()=>[2,5][index++]);
  assert.equal(second.roll.winnerId,'b');assert.equal(b.inventory[0].id,'leoon-claw');
  assert.equal(a.inventory.length,0);assert.equal(r.energyDrops.has(drop.id),false);
  assert.throws(()=>rerollPartyLoot(r,a,drop.id,1300),/대상이 아니에요/);
});

test('같은 맵의 파티원끼리 우주에너지 총량을 나누고 다른 맵 친구는 받지 않는다',()=>{
  const r=room();r.parties.set('p',{id:'p',leaderId:'a',memberIds:['a','b','c']});
  r.players.get('c').mapId='moon-paradise-3';
  const monster={typeId:'leoon',mapId:'sun-paradise-3',x:0,y:0};
  const drop=addEnergyDrop(r,monster,new Map([['a',100]]),1000,()=>400);
  assert.deepEqual([...drop.shares],[['a',200],['b',200]]);
  assert.equal(collectEnergyDrop(r,r.players.get('a'),drop.id,1100).amount,200);
  assert.equal(collectEnergyDrop(r,r.players.get('b'),drop.id,1100).amount,200);
  assert.equal(r.energyDrops.has(drop.id),false);
});
