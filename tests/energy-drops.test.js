import test from 'node:test';
import assert from 'node:assert/strict';
import {createAvatar,STREET_ID} from '../shared/config.js';
import {ENERGY_DROPS} from '../shared/energy-drops.js';
import {addEnergyDrop,rewardRecipients,collectEnergyDrop,energyDropViews,pruneEnergyDrops} from '../server/energy-drops.js';
import {ensureVitals} from '../server/vitals.js';

const makePlayer=(id,overrides={})=>({id,nickname:id,role:'student',connected:true,away:false,mapId:'star-origin-1',x:100,y:100,
  avatar:{...createAvatar(),level:2},cosmicEnergy:0,...overrides});
const makeRoom=(players=[])=>({players:new Map(players.map(p=>[p.id,p]))});
const monster=typeId=>({id:'monster-1',typeId,mapId:'star-origin-1',x:100,y:100});
const fixedRoll=value=>(min,max)=>{assert.ok(value>=min&&value<max);return value;};

test('각 몬스터 단계 보상의 양끝을 만들고 0이면 드랍하지 않는다',()=>{
  const cases=[['star-crab',1,2],['lion',6,10],['bear',24,40]];
  for(const [typeId,min,max] of cases)for(const total of [min,max]){
    const p=makePlayer('p'),room=makeRoom([p]);
    const drop=addEnergyDrop(room,monster(typeId),new Map([['p',10]]),100,fixedRoll(total));
    assert.equal(drop.total,total);assert.equal([...drop.shares.values()].reduce((a,b)=>a+b,0),total);
    assert.equal(drop.expiresAt,100+ENERGY_DROPS.lifetimeMs);
  }
  const p=makePlayer('p'),room=makeRoom([p]);
  assert.equal(addEnergyDrop(room,monster('star-crab'),new Map([['p',10]]),100,fixedRoll(0)),null);
  assert.equal(room.energyDrops,undefined);
});

test('최대 누적 피해자가 단독 소유하고 동률이면 먼저 기여한 플레이어가 이긴다',()=>{
  const a=makePlayer('a'),b=makePlayer('b'),c=makePlayer('c'),room=makeRoom([a,b,c]),m=monster('lion');
  assert.deepEqual(rewardRecipients(room,m,new Map([['a',4],['b',9],['c',9]])),['b']);
  const drop=addEnergyDrop(room,m,new Map([['a',4],['b',9],['c',9]]),0,fixedRoll(6));
  assert.deepEqual([...drop.shares], [['b',6]]);
  assert.deepEqual(rewardRecipients(room,m,new Map([['a',10],['missing',500]])),['a']);
});

test('미래 파티 구성원에게 나머지를 앞 순서부터 나눠도 합계가 보존된다',()=>{
  const leader=makePlayer('leader'),second=makePlayer('second'),third=makePlayer('third',{mapId:STREET_ID}),offline=makePlayer('offline',{connected:false}),away=makePlayer('away',{away:true});
  const room=makeRoom([leader,second,third,offline,away]);
  room.parties=new Map([['party-1',{memberIds:['leader','second','second','third','offline','away']}]]);
  const drop=addEnergyDrop(room,monster('lion'),new Map([['leader',12]]),0,fixedRoll(10));
  assert.deepEqual([...drop.shares],[['leader',5],['second',5]]);
  assert.equal([...drop.shares.values()].reduce((a,b)=>a+b,0),10);
  const split=addEnergyDrop(room,monster('lion'),new Map([['leader',12]]),1,fixedRoll(7));
  assert.deepEqual([...split.shares],[['leader',4],['second',3]]);
});

test('자기 몫만 유효한 거리·맵에서 한 번 수령하고 동기 중복 수령은 한 번만 성공한다',()=>{
  const a=makePlayer('a'),b=makePlayer('b'),room=makeRoom([a,b]);
  const drop=addEnergyDrop(room,monster('lion'),new Map([['a',8],['b',3]]),0,fixedRoll(6));
  const id=drop.id;
  a.x=175;assert.throws(()=>collectEnergyDrop(room,a,id,1),/가까이/);a.x=100;
  a.mapId=STREET_ID;assert.throws(()=>collectEnergyDrop(room,a,id,1),/가까이/);a.mapId='star-origin-1';
  assert.throws(()=>collectEnergyDrop(room,{...a},id,1),/입장/);
  assert.throws(()=>collectEnergyDrop(room,b,id,1),/내 몫/);
  const first=collectEnergyDrop(room,a,id,1);
  assert.deepEqual(first,{amount:6,cosmicEnergy:6});assert.equal(a.cosmicEnergy,6);
  assert.throws(()=>collectEnergyDrop(room,a,id,1));
  assert.equal(b.cosmicEnergy,0);
  const secondDrop=addEnergyDrop(room,monster('lion'),new Map([['a',8],['b',3]]),2,fixedRoll(6));
  const outcomes=[a,b].map(p=>{try{return collectEnergyDrop(room,p,secondDrop.id,3).amount;}catch{return null;}});
  assert.deepEqual(outcomes,[6,null]);
});

test('만료 정리·가시성 필터와 잔액 overflow 실패 때 소유 몫을 보존한다',()=>{
  const p=makePlayer('p'),room=makeRoom([p]);
  const expired={id:'expired',mapId:'star-origin-1',x:100,y:100,total:6,shares:new Map([['p',6]]),expiresAt:5};
  const live={id:'live',mapId:'star-origin-1',x:100,y:100,total:6,shares:new Map([['p',6]]),expiresAt:10};
  room.energyDrops=new Map([[expired.id,expired],[live.id,live]]);
  assert.equal(pruneEnergyDrops(room,5),true);assert.equal(room.energyDrops.has('expired'),false);
  assert.deepEqual(energyDropViews(room,5).map(v=>v.id),['live']);
  p.cosmicEnergy=Number.MAX_SAFE_INTEGER-3;
  assert.throws(()=>collectEnergyDrop(room,p,'live',6),/더 담을 수/);
  assert.equal(p.cosmicEnergy,Number.MAX_SAFE_INTEGER-3);assert.equal(live.shares.get('p'),6);assert.equal(room.energyDrops.has('live'),true);
  p.cosmicEnergy=0;ensureVitals(p).hp=0;
  assert.throws(()=>collectEnergyDrop(room,p,'live',6));assert.equal(live.shares.get('p'),6);
  p.battleVitals=null;p.avatar.blackStar=true;
  assert.throws(()=>collectEnergyDrop(room,p,'live',6));assert.equal(live.shares.get('p'),6);
  p.avatar.blackStar=false;p.away=true;
  assert.throws(()=>collectEnergyDrop(room,p,'live',6));assert.equal(live.shares.get('p'),6);
});
