import test from 'node:test';
import assert from 'node:assert/strict';
import {bossWallFixture,WALL_CASES} from './helpers/boss-wall-fixture.js';
import {advance,isFree} from '../server/world.js';
import {moveMonsters} from '../server/monsters.js';
import {avatarPositionIsClear,avatarRenderPoint,avatarFootprint} from '../shared/avatar-boundary.js';
import {monsterMovementFootprint} from '../shared/monster-geometry.js';
import {monsterMovementTerrainBlocked} from '../shared/monster-movement-boundary.js';
import {BOSS_WALL_ESCAPE,tryBossWallEscape,bossEscapeDestinationClear,releaseBossWallEscapeBudget} from '../server/boss-wall-escape.js';
import {LEOON_ROAR,LEOON_CHARGE} from '../shared/boss-skills.js';
import {ensureVitals} from '../server/vitals.js';

for(const type of Object.keys(WALL_CASES))test(`${type}: 실제 맵의 벽 끼임은 기존16방향 이동 불가, 작은 밀기 뒤 서버와 화면 모두 정상 탈출`,()=>{
  const {room,boss,player,map,place}=bossWallFixture(type),before={x:player.x,y:player.y};
  assert.equal(monsterMovementTerrainBlocked(map,boss,boss.x,boss.y),false);
  for(let i=0;i<16;i++)assert.equal(avatarPositionIsClear(map,player.x+Math.cos(i*Math.PI/8)*8,player.y+Math.sin(i*Math.PI/8)*8,player,[boss],player),false);
  assert.equal(isFree(room,player.x,player.y-7.75,player.id,player.mapId,false),false,'수정 전 이동축 판정으로는 빠져나갈 수 없다');
  const protectedState={hp:boss.hp,mp:boss.mp,nextAttackAt:boss.nextAttackAt};let render=before;
  for(let tick=0;tick<30&&player.y===before.y;tick++){
    const oldY=boss.y;player.input.at=1000+tick*50;advance(room,player.input.at);
    assert(boss.y>=oldY-2-1e-8);render=avatarRenderPoint(map,player,player,player,[boss],render);
    assert.equal(monsterMovementTerrainBlocked(map,boss,boss.x,boss.y),false);
  }
  assert.equal(place.boss.y-boss.y,place.push);assert.equal(player.y,before.y-7.75);assert.equal(render.y,player.y);
  assert.deepEqual({hp:boss.hp,mp:boss.mp,nextAttackAt:boss.nextAttackAt},protectedState);
  const pushed=place.boss.y-boss.y;player.input={x:0,y:0,at:3000};advance(room,3000);assert.equal(place.boss.y-boss.y,pushed);
});
test('개방된 곳의 중첩·일반몬스터·정지·만료입력·수면·사망·대시에는 밀기가 없다',()=>{
  const variants=[f=>{f.boss.x=f.map.width/2;f.boss.y=f.map.height/2;f.player.x=f.boss.x;f.player.y=f.boss.y+130;},
    f=>{f.boss.typeId='star-guardian';},f=>{f.player.input.y=0;},f=>{f.player.input.at=0;},
    f=>{f.player.constellationAbilityState={ariesSleep:{endsAt:2000}};},f=>{ensureVitals(f.player).hp=0;},f=>{f.player.taurusDash={endsAt:2000};}];
  for(const change of variants){const f=bossWallFixture();change(f);const before={x:f.boss.x,y:f.boss.y};advance(f.room,1000);
    assert.deepEqual({x:f.boss.x,y:f.boss.y},before);assert.equal(f.boss.wallEscape,undefined);}
});
test('벽·문·고정물·다른몬스터·숫자별·다른학생 쪽으로는 보스를 밀지 않는다',()=>{
  const {room,boss,map,player}=bossWallFixture();boss.x=map.width/2;boss.y=map.height/2;
  const x=boss.x,y=boss.y-2;
  assert.equal(bossEscapeDestinationClear(room,map,boss,0,0,player),false);
  for(const kind of ['gate','stone'])assert.equal(bossEscapeDestinationClear(room,{...map,objects:[{kind,x,y:boss.y-boss.radius-29,radius:30,passable:kind==='gate'}]},boss,x,y,player),false);
  room.monsters.set('other',{id:'other',mapId:map.id,typeId:'star-guardian',hp:100,x,y:boss.y-boss.radius-30.5,radius:20});
  assert.equal(bossEscapeDestinationClear(room,map,boss,x,y,player),false);room.monsters.delete('other');
  boss.recordMath={stars:[{id:1,x,y:boss.y-247,solved:false}]};assert.equal(bossEscapeDestinationClear(room,map,boss,x,y,player),false);delete boss.recordMath;
  const other={...player,id:'other',avatar:{level:1}},foot=avatarFootprint(other),body=monsterMovementFootprint(boss);
  other.x=body.x;other.y=body.y-body.ry-foot.radius-foot.offsetY+.5;room.players.set(other.id,other);
  assert.equal(bossEscapeDestinationClear(room,map,boss,x,y,player),false);other.away=true;
  assert.equal(bossEscapeDestinationClear(room,map,boss,x,y,player),true);
});
test('여러학생·같은틱·입력교체·시간경과는 보스공유48px 예산을 충전하지 않는다',()=>{
  const {room,boss,player,map}=bossWallFixture();assert.equal(tryBossWallEscape(room,map,player,0,-1,1000),true);
  const other={...player,id:'q'};room.players.set(other.id,other);
  assert.equal(tryBossWallEscape(room,map,other,0,-1,1000),false);assert.equal(boss.wallEscape.used,2);
  boss.wallEscape.used=46;assert.equal(tryBossWallEscape(room,map,other,0,-1,1050),true);assert.equal(boss.wallEscape.used,48);
  player.input={x:0,y:0,at:1100};advance(room,1100);assert.equal(boss.wallEscape.used,48);
  assert.equal(tryBossWallEscape(room,map,player,0,-1,100000),false);releaseBossWallEscapeBudget(room,boss,100000);assert.equal(boss.wallEscape.used,48);
  boss.x=boss.wallEscape.anchorX+97;player.mapId=other.mapId='space-plaza';
  releaseBossWallEscapeBudget(room,boss,100001);assert.equal(boss.wallEscape.used,48);
  releaseBossWallEscapeBudget(room,boss,101001);assert.equal(boss.wallEscape,undefined);
});
test('밀기 직후 같은틱 AI 보행은 되밀지 않으며 공격 패턴과 피해 처리는 계속된다',()=>{
  const {room,boss,player,map}=bossWallFixture('leoon');
  Object.assign(boss,{dx:0,dy:1,patrolStartedAt:0,patrolCycle:0,nextDirectionAt:5000,lastMoveAt:950});
  assert.equal(tryBossWallEscape(room,map,player,0,-1,1000),true);const y=boss.y;
  moveMonsters(room,1000,()=>.99);assert.equal(boss.y,y);
  boss.attackers.set(player.id,1);boss.pendingAttack={x:player.x,y:player.y,radius:100,startsAt:900,endsAt:1050,dx:0,dy:1,reach:10};
  const before=ensureVitals(player).hp,hits=moveMonsters(room,1050,()=>.99);
  assert(hits.some(hit=>hit.targetId===player.id));assert(ensureVitals(player).hp<before);assert.equal(boss.pendingAttack,null);assert.equal(boss.y,y);
});
test('제자리 포효는 끼임 탈출을 허용하고 이동 돌진 상태/쿨타임은 변경하지 않는다',()=>{
  for(const [kind,allowed] of [[LEOON_ROAR.kind,true],[LEOON_CHARGE.kind,false]]){
    const {room,boss,player,map}=bossWallFixture('leoon');boss.leoonSkill={kind,stage:'warning',stageEndsAt:2000};
    boss.roarReadyAt=3000;boss.chargeReadyAt=4000;const before=structuredClone(boss.leoonSkill);
    assert.equal(tryBossWallEscape(room,map,player,0,-1,1000),allowed);assert.deepEqual(boss.leoonSkill,before);
    assert.equal(boss.roarReadyAt,3000);assert.equal(boss.chargeReadyAt,4000);
  }
});
test('일반 보스 재생성은 지난 생명에서 소진한 밀기 예산을 초기화한다',()=>{
  const {room,boss,player,map}=bossWallFixture('leoon');boss.wallEscape={used:48,anchorX:boss.x,anchorY:boss.y};
  boss.hp=0;boss.respawnAt=1000;moveMonsters(room,1000,()=>0);
  assert.equal(boss.hp,boss.maxHp);assert.equal(boss.wallEscape,undefined);
  assert.equal(tryBossWallEscape(room,map,player,0,-1,1050),true);
});
