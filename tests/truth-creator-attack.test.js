import test from 'node:test';
import assert from 'node:assert/strict';
import {mapOf,RULES} from '../shared/config.js';
import {ensureVitals} from '../server/vitals.js';
import {TRUTH_CREATOR_ATTACK as RULE,aimTruthCreator,tickTruthCreatorAttack,truthCreatorAttackView,clearTruthCreatorAttack} from '../server/truth-creator-attack.js';
import {TRUTH_CREATOR_CHASERS as CHASER,tryTruthCreatorChasers,tickTruthCreatorChasers,truthCreatorChaserViews} from '../server/truth-creator-chasers.js';
import {tryTruthCreatorSentry} from '../server/truth-creator-sentries.js';
const now=100000;
function fixture(){
  const map=mapOf('sleeping-stars-4'),boss={id:'truth-creator-boss',typeId:'truth-creator',hp:50000,mp:100,mapId:map.id,x:map.width/2,y:map.height/2,radius:150};
  const player={id:'a',role:'student',connected:true,away:false,mapId:map.id,x:boss.x+600,y:boss.y,avatar:{level:1},statGrowth:{bonuses:{hp:1000}},equipmentSlots:[null,null,null],inventory:[]};
  ensureVitals(player);player.battleVitals.hp=1000;
  return {boss,player,room:{players:new Map([[player.id,player]]),monsters:new Map([[boss.id,boss]]),planets:new Map()}};
}
function fire(f){aimTruthCreator(f.room,f.boss,f.player,now);assert.equal(aimTruthCreator(f.room,f.boss,f.player,now+3000).length,1);}
test('three-second aim follows the latest target direction, remains private, and emits one shot per interval without mana cost',()=>{
  const f=fixture();aimTruthCreator(f.room,f.boss,f.player,now);
  assert.equal(aimTruthCreator(f.room,f.boss,f.player,now+2999).length,0);
  f.player.x=f.boss.x;f.player.y=f.boss.y+600;
  const viewBefore=truthCreatorAttackView(f.boss,now+2999);assert.equal(viewBefore.aim,undefined);assert.deepEqual(viewBefore.projectiles,[]);
  aimTruthCreator(f.room,f.boss,f.player,now+3000);const shot=f.boss.truthCreatorAttack.shots[0];assert.equal(shot.dx,0);assert.equal(shot.dy,1);
  assert.equal(aimTruthCreator(f.room,f.boss,f.player,now+3000).length,0);assert.equal(f.boss.mp,100);
  aimTruthCreator(f.room,f.boss,f.player,now+9000);assert.equal(f.boss.truthCreatorAttack.shots.length,2,'delayed ticks do not burst missed shots');
});
test('swept orb collision deals 40 once, and the passed path stays for exactly ten seconds with a shared re-entry cooldown',()=>{
  const f=fixture();fire(f);const at=now+3000;
  f.player.y+=500;tickTruthCreatorAttack(f.room,f.boss,at+1000);
  const path=truthCreatorAttackView(f.boss,at+1000).paths[0];assert.equal(Math.round(path.x2-path.x1),RULE.speed);
  f.player.x=f.boss.x+210;f.player.y=f.boss.y;const hp=f.player.battleVitals.hp;
  assert.equal(tickTruthCreatorAttack(f.room,f.boss,at+1001)[0].damage,40);assert.equal(f.player.battleVitals.hp,hp-40);
  f.player.y+=200;tickTruthCreatorAttack(f.room,f.boss,at+1100);f.player.y-=200;
  assert.equal(tickTruthCreatorAttack(f.room,f.boss,at+1500).length,0);
  assert.equal(tickTruthCreatorAttack(f.room,f.boss,at+2001)[0].damage,40);
  // A second crossing trail still shares the same one-second player clock.
  f.boss.truthCreatorAttack.trails.push({...f.boss.truthCreatorAttack.trails[0],id:'overlap'});
  assert.equal(tickTruthCreatorAttack(f.room,f.boss,at+2500).length,0);
  f.player.y+=500;tickTruthCreatorAttack(f.room,f.boss,at+5000);
  const expiredTail=truthCreatorAttackView(f.boss,at+11000).paths[0];assert.equal(Math.round(expiredTail.x1-f.boss.x),RULE.speed);
  assert.deepEqual(truthCreatorAttackView(f.boss,at+15000).paths,[]);
  const g=fixture();fire(g);const hits=tickTruthCreatorAttack(g.room,g.boss,at+2000);
  assert.equal(hits.length,1);assert.equal(hits[0].damage,40);assert.equal(g.boss.truthCreatorAttack.shots.length,0);
  assert(g.boss.truthCreatorAttack.trails[0].distance<600,'orb stops at the body rather than jumping past it');
});
test('orb and light respect immunity and invalid participants, and death/map change clear every effect',()=>{
  const f=fixture();fire(f);f.player.taurusImmuneUntil=now+10000;
  assert.equal(tickTruthCreatorAttack(f.room,f.boss,now+5000)[0].immune,true);
  for(const change of [p=>p.connected=false,p=>p.away=true,p=>p.mapId='space-plaza',p=>p.avatar.blackStar=true,p=>p.battleVitals.hp=0,p=>{p.role='teacher';p.avatar.teacherPreview=true;}]){
    const g=fixture();fire(g);change(g.player);assert.deepEqual(tickTruthCreatorAttack(g.room,g.boss,now+4000),[]);assert.equal(g.boss.truthCreatorAttack,null);
  }
  for(const change of [boss=>boss.hp=0,boss=>boss.mapId='space-plaza']){const g=fixture();fire(g);change(g.boss);tickTruthCreatorAttack(g.room,g.boss,now+4000);assert.equal(g.boss.truthCreatorAttack,null);}
});
test('chaser cast snapshots one safe orb per eligible character, spends ten mana, cooldown thirty seconds and lasts twenty',()=>{
  const f=fixture();f.player.x=f.boss.x;f.player.y=f.boss.y;
  const b={...f.player,id:'b',x:f.player.x+100,battleVitals:{...f.player.battleVitals},avatar:{level:1}};f.room.players.set(b.id,b);
  for(const [id,change] of [['teacher',{role:'teacher'}],['offline',{connected:false}],['away',{away:true}],['other',{mapId:'space-plaza'}],['black',{avatar:{level:1,blackStar:true}}],['ghost',{role:'teacher',avatar:{level:6,teacherPreview:true}}]])f.room.players.set(id,{...b,id,...change});
  assert.equal(tryTruthCreatorChasers(f.room,f.boss,f.player,now),true);assert.equal(f.boss.mp,90);assert.equal(CHASER.speed,RULES.speed*.3);
  assert.equal(f.boss.truthCreatorChasers.orbs.length,2);
  for(const orb of f.boss.truthCreatorChasers.orbs){assert.equal(orb.endsAt-now,20000);for(const p of [f.player,b])assert(Math.hypot(orb.x-p.x,orb.y-p.y)>orb.radius+RULES.radius+80);}
  assert.equal(tryTruthCreatorChasers(f.room,f.boss,f.player,now+1),false);assert.equal(f.boss.mp,90);
  const late={...b,id:'late'};f.room.players.set(late.id,late);assert.equal(f.boss.truthCreatorChasers.orbs.length,2);
  assert.deepEqual(tickTruthCreatorChasers(f.room,f.boss,now+20000),[]);assert.equal(truthCreatorChaserViews(f.boss,now+20000).length,0);
  assert.equal(tryTruthCreatorChasers(f.room,f.boss,f.player,now+29999),false);assert.equal(tryTruthCreatorChasers(f.room,f.boss,f.player,now+30000),true);
});
test('red orb kills a bystander while pursuing its assigned target, respects Libra, and removes invalid targets',()=>{
  const f=fixture();f.player.x=f.boss.x;tryTruthCreatorChasers(f.room,f.boss,f.player,now);const orb=f.boss.truthCreatorChasers.orbs[0],x=orb.x;
  const b={...f.player,id:'b',x:orb.x-20,y:orb.y,battleVitals:{...f.player.battleVitals},avatar:{level:1}};f.room.players.set(b.id,b);
  const hits=tickTruthCreatorChasers(f.room,f.boss,now+100);assert(hits.some(hit=>hit.targetId==='b'&&hit.defeated));assert.equal(b.battleVitals.hp,0);
  assert(Math.abs(x-orb.x-CHASER.speed*.1)<.001);assert.equal(orb.targetId,'a');
  const g=fixture();g.player.x=g.boss.x;tryTruthCreatorChasers(g.room,g.boss,g.player,now);
  g.player.avatar.constellationId='libra';g.player.libraAura={mapId:g.player.mapId,endsAt:now+10000,size:100,radius:200};
  const immune=tickTruthCreatorChasers(g.room,g.boss,now+3000);assert(immune.some(hit=>hit.immune));assert(g.player.battleVitals.hp>0);
  for(const change of [p=>p.connected=false,p=>p.away=true,p=>p.mapId='space-plaza',p=>p.battleVitals.hp=0,p=>p.avatar.blackStar=true,p=>{p.role='teacher';p.avatar.teacherPreview=true;},p=>{p.role='teacher';p.teacherGhost=true;}]){
    const h=fixture();tryTruthCreatorChasers(h.room,h.boss,h.player,now);change(h.player);assert.deepEqual(tickTruthCreatorChasers(h.room,h.boss,now+100),[]);assert.equal(h.boss.truthCreatorChasers.orbs.length,0);
  }
  clearTruthCreatorAttack(g.boss);assert.equal(g.boss.truthCreatorChasers,null);
});
test('visual teacher ghost never changes retaliation: ordinary teachers are exempt until attacking, preview stays exempt',()=>{
  for(const ghost of [false,true]){
    const f=fixture();f.player.role='teacher';f.player.avatar={level:6};f.player.teacherGhost=ghost;f.boss.teacherRetaliation=new Set([f.player.id]);
    aimTruthCreator(f.room,f.boss,f.player,now);assert(f.boss.truthCreatorAttack.aim);
    assert.equal(tryTruthCreatorChasers(f.room,f.boss,f.player,now),true);assert(tryTruthCreatorSentry(f.room,f.boss,f.player,now));
    tickTruthCreatorChasers(f.room,f.boss,now+100);assert.equal(f.boss.truthCreatorChasers.orbs.length,1);
  }
  for(const preview of [false,true]){
    const f=fixture();f.player.role='teacher';f.player.avatar={level:6,teacherPreview:preview};f.player.teacherGhost=true;
    if(preview)f.boss.teacherRetaliation=new Set([f.player.id]);
    aimTruthCreator(f.room,f.boss,f.player,now);assert.equal(f.boss.truthCreatorAttack.aim,null);
    assert.equal(tryTruthCreatorChasers(f.room,f.boss,f.player,now),false);assert.equal(tryTruthCreatorSentry(f.room,f.boss,f.player,now),false);
  }
});
