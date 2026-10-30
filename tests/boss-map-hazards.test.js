import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceBossMapHazards as tick,activeHazardView,clearBossMapHazard} from '../server/boss-map-hazards.js';
import {ensureVitals} from '../server/vitals.js';
import {defensePowerOf} from '../shared/combat.js';

function fixture(typeId='leoon'){
  const mapId=typeId==='leoon'?'sun-paradise-3':'moon-paradise-3';
  const p={id:'p',role:'student',connected:true,mapId,x:500,y:500,avatar:{level:4,constellationId:'hercules'},equipmentSlots:[]};
  const boss={id:typeId+'-boss',typeId,mapId,hp:5000};
  const room={players:new Map([[p.id,p]]),monsters:new Map([[boss.id,boss]])};
  return {p,boss,room};
}
test('both living bosses: immediate status, first tick at 5000ms, repeated fixed 2 damage',()=>{
  for(const type of ['leoon','noksera']){
    const {room,p}=fixture(type),hp=ensureVitals(p).hp;
    assert.equal(activeHazardView(room,p,0)[0].statusId,type==='leoon'?'burn':'frost');
    assert.equal(tick(room,0).changed,true);
    assert.equal(tick(room,4999).hits.length,0);assert.equal(ensureVitals(p).hp,hp);
    assert.equal(tick(room,5000).hits[0].damage,2);assert.equal(tick(room,9999).hits.length,0);
    assert.equal(tick(room,10000).hits[0].damage,2);assert.equal(ensureVitals(p).hp,hp-4);
    assert.equal(tick(room,10000).hits.length,0);
  }
});
test('map exit/reentry and explicit between-tick round trip reset deadline without catchup',()=>{
  const {room,p}=fixture();tick(room,0);p.mapId='star-street';
  assert.deepEqual(activeHazardView(room,p,4999),[]);assert.equal(tick(room,4999).changed,true);
  p.mapId='sun-paradise-3';tick(room,20000);assert.equal(tick(room,24999).hits.length,0);
  assert.equal(tick(room,25000).hits[0].damage,2);
  clearBossMapHazard(room,p.id);tick(room,26000);assert.equal(tick(room,30000).hits.length,0);
  assert.equal(tick(room,31000).hits.length,1);
});
test('boss defeat immediately removes view and timer; respawn gets fresh delay',()=>{
  const {room,p,boss}=fixture();tick(room,0);boss.hp=0;
  assert.deepEqual(activeHazardView(room,p,5000),[]);assert.equal(tick(room,5000).hits.length,0);
  assert.equal(room.bossMapHazards.size,0);boss.hp=5000;tick(room,6000);
  assert.equal(tick(room,10999).hits.length,0);assert.equal(tick(room,11000).hits.length,1);
});
test('fixed damage bypasses defense and Hercules shield but live Libra aura blocks it',()=>{
  const {room,p}=fixture();p.statGrowth={bonuses:{defense:999}};p.herculesShield={hp:100,absorbed:0,endsAt:30000};
  assert.ok(defensePowerOf(p.avatar.level,p.avatar.constellationId,p)>=999);
  tick(room,0);assert.equal(tick(room,5000).hits[0].damage,2);assert.equal(p.herculesShield.hp,100);
  const ally={...p,id:'libra',avatar:{level:4,constellationId:'libra'},battleVitals:null,
    libraAura:{mapId:p.mapId,endsAt:20000,size:100,radius:500}};
  room.players.set(ally.id,ally);const hp=ensureVitals(p).hp;
  assert.equal(tick(room,10000).hits.find(h=>h.targetId===p.id).immune,true);assert.equal(ensureVitals(p).hp,hp);
  ally.mapId='star-street';assert.equal(tick(room,15000).hits.find(h=>h.targetId===p.id).damage,2);
});
test('offline, away, sleep, dead, LV1 and black-star players do not accumulate ticks',()=>{
  for(const disable of [p=>p.connected=false,p=>p.away=true,p=>p.constellationAbilityState={ariesSleep:{endsAt:30000}},
    p=>ensureVitals(p).hp=0,p=>p.avatar.level=1,p=>p.avatar.blackStar=true]){
    const {room,p}=fixture();tick(room,0);disable(p);
    assert.equal(tick(room,5000).hits.length,0);assert.deepEqual(activeHazardView(room,p,5000),[]);
    assert.equal(room.bossMapHazards.size,0);
  }
  const {room,p}=fixture();tick(room,0);p.connected=false;tick(room,5000);p.connected=true;tick(room,20000);
  assert.equal(tick(room,24999).hits.length,0);assert.equal(tick(room,25000).hits.length,1);
});
test('room/map isolation, master eligibility and teacher retaliation/ghost rules',()=>{
  const a=fixture(),b=fixture();tick(a.room,0);b.room.monsters.clear();
  assert.deepEqual(activeHazardView(b.room,b.p,5000),[]);assert.equal(tick(b.room,5000).hits.length,0);
  a.p.accountKind='master';assert.equal(tick(a.room,5000).hits.length,1);
  a.p.role='teacher';assert.deepEqual(activeHazardView(a.room,a.p,5000),[]);
  a.boss.teacherRetaliation=new Set([a.p.id]);assert.equal(activeHazardView(a.room,a.p,5000).length,1);
  a.p.teacherGhost=true;assert.deepEqual(activeHazardView(a.room,a.p,5000),[]);
  a.p.teacherGhost=false;a.p.avatar.teacherPreview=true;assert.deepEqual(activeHazardView(a.room,a.p,5000),[]);
});
test('stalled loop does not stack missed ticks, and lethal tick clears state',()=>{
  const {room,p}=fixture();tick(room,0);assert.equal(tick(room,50000).hits.length,1);
  assert.equal(tick(room,50001).hits.length,0);ensureVitals(p).hp=2;
  const result=tick(room,55000);assert.equal(result.hits[0].defeated,true);
  assert.deepEqual(result.state.get(p.id),[]);assert.equal(room.bossMapHazards.size,0);
});
