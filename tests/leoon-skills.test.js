import test from 'node:test';
import assert from 'node:assert/strict';
import {monstersOf,monsterViews,moveMonsters} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {LEOON_ROAR,LEOON_CHARGE} from '../shared/boss-skills.js';

const START=1000;
function fixture(){
  const room={players:new Map(),planets:new Map()},boss=monstersOf(room,START,()=>0).get('leoon-boss');
  room.monsters=new Map([[boss.id,boss]]);
  const player={id:'hero',role:'student',connected:true,away:false,mapId:boss.mapId,x:boss.x+boss.radius+20,y:boss.y,
    avatar:{level:4,constellationId:'taurus'},equipmentSlots:[],inventory:[]};
  room.players.set(player.id,player);boss.attackers.set(player.id,1);boss.targetId=player.id;
  return {room,boss,player,tick:(at,roll=0)=>moveMonsters(room,at,()=>roll)};
}
test('레오온 포효는 1초 발광 뒤 5곳에 2초 경고하고 200%를 한 번만 적용한다',()=>{
  const f=fixture(),{boss,player}=f;boss.chargeReadyAt=Infinity;boss.roarDecisionAt=START;
  const hp=ensureVitals(player).hp;f.tick(START);
  assert.equal(boss.mp,40);assert.equal(boss.roarReadyAt,START+15000);
  assert.equal(monsterViews(f.room,START)[0].leoonSkill.stage,'glow');
  const area=boss.leoonSkill.areas[1];player.x=area.x;player.y=area.y;
  f.tick(START+999);assert.equal(ensureVitals(player).hp,hp);
  f.tick(START+1000);assert.equal(boss.leoonSkill.stage,'warning');assert.equal(boss.leoonSkill.stageEndsAt,START+3000);
  assert.equal(boss.leoonSkill.areas.length,5);
  f.tick(START+2999);assert.equal(ensureVitals(player).hp,hp);
  const hits=f.tick(START+3000);assert.equal(hits.filter(hit=>hit.attackOnly).length,5);
  assert.equal(hits.filter(hit=>hit.targetId===player.id).length,1);
  assert.equal(hits.find(hit=>hit.targetId===player.id).skillKind,LEOON_ROAR.kind);
  assert.equal(boss.leoonSkill,null);assert.ok(ensureVitals(player).hp<hp);
});

test('레오온 돌진은 3번 발구르기·2초 직선 경고·돌진을 세 차례 반복하며 방향을 갱신한다',()=>{
  const f=fixture(),{boss,player}=f;boss.roarReadyAt=Infinity;boss.chargeDecisionAt=START;
  f.tick(START);assert.equal(boss.mp,30);assert.equal(boss.chargeReadyAt,START+30000);
  for(let repeat=0;repeat<3;repeat++){
    const start=boss.leoonSkill.startsAt;
    const direction=repeat===1?-1:1;
    player.x=boss.x+direction*(boss.radius+60);player.y=boss.y;
    f.tick(start+LEOON_CHARGE.stompMs-1);assert.equal(boss.leoonSkill.stage,'stomp');
    f.tick(start+LEOON_CHARGE.stompMs);assert.equal(boss.leoonSkill.stage,'warning');
    const warning=monsterViews(f.room,start+LEOON_CHARGE.stompMs)[0].leoonSkill;
    assert.ok((warning.toX-warning.fromX)*direction>0,JSON.stringify({repeat,fromX:warning.fromX,toX:warning.toX,fromY:warning.fromY,toY:warning.toY}));
    player.y=boss.y+boss.radius*2;
    f.tick(warning.stageEndsAt-1);assert.equal(boss.leoonSkill.stage,'warning');
    f.tick(warning.stageEndsAt);assert.equal(boss.leoonSkill.stage,'dash');
    const hits=f.tick(warning.stageEndsAt+LEOON_CHARGE.dashMs);
    assert.equal(hits.filter(hit=>hit.attackOnly&&hit.skillKind===LEOON_CHARGE.kind).length,1);
    if(repeat<2)assert.equal(boss.leoonSkill.repeat,repeat+1);
  }
  assert.equal(boss.leoonSkill,null);
});

test('레오온 스킬은 쿨타임이 끝나도 확률 판정에 실패하면 마나를 쓰지 않는다',()=>{
  const f=fixture();f.boss.chargeDecisionAt=START;f.boss.roarDecisionAt=START;
  f.tick(START,.99);assert.equal(f.boss.mp,50);assert.equal(f.boss.leoonSkill,null);
  f.tick(START+1000,.99);assert.equal(f.boss.mp,50);
});
