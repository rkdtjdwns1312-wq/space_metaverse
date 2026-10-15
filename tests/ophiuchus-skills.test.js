import test from 'node:test';
import assert from 'node:assert/strict';
import {castOphiuchus,advanceOphiuchusVenoms,advanceOphiuchusPoison,ophiuchusViews} from '../server/ophiuchus-skills.js';
import {advanceProjectiles} from '../server/projectiles.js';
import {combatEnemies,damageTargets} from '../server/sagittarius-skills.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {attackPowerOf} from '../shared/combat.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {aquariusAreaAt,aquariusTimingOf} from '../shared/aquarius-skills.js';
import {OPHIUCHUS_VFX,OPHIUCHUS_NAMES,ophiuchusSkillOf,ophiuchusAreaAt,ophiuchusTimingOf} from '../shared/ophiuchus-skills.js';

const now=Date.now();
function setup(level=4){
  const player={id:'snake',role:'student',connected:true,away:false,mapId:'star-origin-1',x:500,y:450,
    facing:{x:1,y:0},avatar:{level,constellationId:'ophiuchus'},effects:[]};
  const room={players:new Map([[player.id,player]]),planets:new Map()};
  const size=avatarSizeOf(player),base=[...monstersOf(room).values()][0];
  const monster={...base,id:'target',typeId:'test-no-art',level:1,mapId:player.mapId,x:player.x,y:player.y+size*.25,
    hp:10000,maxHp:10000,radius:15,attackers:new Map(),contributors:new Map(),attackOrder:0};
  room.monsters=new Map([[monster.id,monster]]);
  return {room,player,size,monster,power:attackPowerOf(level,'ophiuchus',player)};
}
function companion(room,player,id,level=player.avatar.level){
  const other={...player,id,avatar:{...player.avatar,level},battleVitals:undefined,ophiuchusCooldownUntil:0,equipmentSlots:[]};
  room.players.set(id,other);return other;
}
const poisonHits=result=>result.events.flatMap(e=>e.targets);

test('검은 수정 Q는 기존 사거리4배·첫 몬스터 종료 및 PvP 유지',()=>{
  const {room,player,size,monster,power}=setup();
  monster.x=player.x+size*1.2;monster.y=player.y;
  const farther={...monster,id:'far',x:player.x+size*2.8};room.monsters.set(farther.id,farther);
  const result=castOphiuchus(room,player,now,{basic:true});
  assert.equal(result.hit.range,size*4);assert.equal(result.hit.projectiles.length,1);
  advanceProjectiles(room,now+700,combatEnemies,damageTargets);
  assert.equal(monster.hp,10000-power);assert.equal(farther.hp,10000);
  const other=companion(room,player,'friend');other.x=player.x+size;other.y=player.y;
  room.monsters.clear();const hp=ensureVitals(other).hp;
  castOphiuchus(room,player,now+1000,{basic:true});
  advanceProjectiles(room,now+1700,combatEnemies,damageTargets);
  assert.ok(ensureVitals(other).hp<hp);assert.equal(other.combatPoison,undefined);
});

test('단계별 14초 고정 지대·물병 공용 타원·공개 필드·새 아이콘과 이름',()=>{
  assert.equal(ophiuchusAreaAt,aquariusAreaAt);assert.equal(ophiuchusTimingOf,aquariusTimingOf);
  for(const level of [2,3,4]){
    const {room,player,size}=setup(level),spec=ophiuchusSkillOf(player),mp=ensureVitals(player).mp;
    const result=castOphiuchus(room,player,now),view=ophiuchusViews(room,player.mapId,now)[0];
    assert.equal(result.hit,undefined);assert.equal(mp-ensureVitals(player).mp,5);
    assert.equal(player.ophiuchusCooldownUntil,now+5000);
    assert.deepEqual(Object.keys(view).sort(),['id','playerId','mapId','kind','stage','vfxId','x','y','rx','ry','size','durationMs','elapsedMs'].sort());
    assert.equal(view.kind,'ophiuchus-zone');assert.equal(view.stage,level);
    assert.equal(view.durationMs,14000);assert.equal(view.y,player.y+size*.25);
    assert.ok(Math.abs(view.rx-size*({2:1.8,3:2.4,4:3})[level])<1e-9);assert.equal(view.ry,view.rx*.5);
    assert.deepEqual(ophiuchusTimingOf(view),{growMs:2000,holdMs:10000,fadeMs:2000,durationMs:14000});
    for(const [elapsed,scale] of [[-1,0],[0,0],[1000,.5],[2000,1],[12000,1],[13000,.5],[14000,0]])
      assert.equal(ophiuchusAreaAt(view,elapsed).scale,scale);
    const start={x:view.x,y:view.y};player.x+=200;player.y+=100;
    assert.equal(ophiuchusViews(room,player.mapId,now+2500)[0].x,start.x);
    assert.equal(ophiuchusViews(room,player.mapId,now+2500)[0].y,start.y);
    assert.deepEqual(ophiuchusViews(room,'star-origin-2',now+2500),[]);
    assert.deepEqual(ophiuchusViews(room,player.mapId,now+14000),[]);
    assert.equal(spec.poisonMs,({2:3000,3:5000,4:8000})[level]);
    assert.equal(OPHIUCHUS_VFX[`skill-lv${level}`].iconUrl,`/assets/skills/ophiuchus/poison-lv${level}-icon.png`);
  }
  assert.equal(OPHIUCHUS_VFX.attack.iconUrl,'/assets/skills/ophiuchus/attack-icon.png');
  assert.deepEqual([OPHIUCHUS_NAMES[2],OPHIUCHUS_NAMES[3],OPHIUCHUS_NAMES[4]],['독안개의 지대','맹독의 지대','심연의 독무']);
});

test('최초 직접피해100/200/300%, 중독3/5/8회·초당100%, 정확한 마지막 틱과 지연 중복 방지',()=>{
  for(const level of [2,3,4]){
    const {room,player,monster,power}=setup(level),seconds=({2:3,3:5,4:8})[level];
    castOphiuchus(room,player,now);
    assert.deepEqual(advanceOphiuchusVenoms(room,now),[],'크기0에서는 접촉 없음');
    assert.equal(advanceOphiuchusVenoms(room,now+1000)[0].targets.length,1);
    assert.equal(monster.hp,10000-power*(level-1));
    assert.equal(monster.combatPoison.stacks,1);
    assert.equal(monster.combatPoison.expiresAt,now+1000+seconds*1000);
    const hits=poisonHits(advanceOphiuchusPoison(room,now+1000+seconds*1000));
    assert.equal(hits.length,seconds);assert.ok(hits.every(h=>h.damage===power));
    assert.equal(monster.hp,10000-power*(level-1+seconds));assert.equal(monster.combatPoison,null);
    assert.deepEqual(advanceOphiuchusPoison(room,now+20000).events,[]);
  }
});

test('머무름은 만료만 갱신, 다음 틱 유지·재진입 직접피해 없음',()=>{
  const {room,player,monster,power}=setup(2);
  castOphiuchus(room,player,now);advanceOphiuchusVenoms(room,now+1000);
  for(const ms of [1250,1500,1750]){
    advanceOphiuchusVenoms(room,now+ms);assert.equal(monster.combatPoison.nextTickAt,now+2000);
  }
  advanceOphiuchusVenoms(room,now+2000);
  assert.equal(monster.hp,10000-power*2);assert.equal(monster.combatPoison.nextTickAt,now+3000);
  const x=monster.x;monster.x+=1000;advanceOphiuchusVenoms(room,now+2500);
  assert.equal(monster.combatPoison.expiresAt,now+5000);
  advanceOphiuchusPoison(room,now+6000);assert.equal(monster.combatPoison,null);
  const before=monster.hp;monster.x=x;
  assert.deepEqual(advanceOphiuchusVenoms(room,now+7000),[]);
  assert.equal(monster.hp,before);assert.equal(monster.combatPoison.nextTickAt,now+8000);
  assert.equal(monster.combatPoison.expiresAt,now+10000);
});

test('같은 시전자 여러 지대는 지대별 최초피해, 독틱은 하나·시계 유지',()=>{
  const {room,player,monster,power}=setup(2);
  castOphiuchus(room,player,now);advanceOphiuchusVenoms(room,now+1000);
  for(const ms of [2000,3000,4000,5000])advanceOphiuchusVenoms(room,now+ms);
  castOphiuchus(room,player,now+5000);
  advanceOphiuchusVenoms(room,now+5500);
  assert.equal(monster.hp,10000-power*6,'최초피해2회+독4틱');
  assert.equal(monster.combatPoison.candidates.size,2);
  assert.equal(monster.combatPoison.nextTickAt,now+6000);
  assert.equal(poisonHits(advanceOphiuchusPoison(room,now+6000)).length,1);
  assert.equal(monster.hp,10000-power*7);
});

test('강한 독 하나만 선택·기여도도 한 명, 강한 시전자 퇴장 시 약한 독으로 이어짐',()=>{
  const {room,player,monster,power}=setup(2),strong=companion(room,player,'strong',4);
  const strongPower=attackPowerOf(4,'ophiuchus',strong);
  castOphiuchus(room,player,now);castOphiuchus(room,strong,now);
  advanceOphiuchusVenoms(room,now+1000);
  assert.equal(monster.hp,10000-power-strongPower*3);
  const weakCredit=monster.contributors.get(player.id),strongCredit=monster.contributors.get(strong.id);
  const hits=poisonHits(advanceOphiuchusPoison(room,now+2000));
  assert.equal(hits.length,1);assert.equal(hits[0].damage,strongPower);
  assert.equal(monster.contributors.get(player.id),weakCredit);
  assert.equal(monster.contributors.get(strong.id),strongCredit+strongPower);
  strong.mapId='star-origin-2';
  const before=monster.hp;advanceOphiuchusVenoms(room,now+3000);
  assert.equal(before-monster.hp,power);
  assert.equal(monster.combatPoison.candidates.size,1);
});

test('동일 피해 독의 기여자는 순서와 무관하게 ID 순으로 결정',()=>{
  for(const reverse of [false,true]){
    const {room,player,monster,power}=setup(2),other=companion(room,player,'alpha');
    for(const caster of reverse?[other,player]:[player,other])castOphiuchus(room,caster,now);
    advanceOphiuchusVenoms(room,now+1000);
    const first=monster.contributors.get(player.id),second=monster.contributors.get(other.id);
    advanceOphiuchusPoison(room,now+2000);
    assert.equal(monster.contributors.get(player.id),first);
    assert.equal(monster.contributors.get(other.id),second+power);
  }
});

test('지연된 약한 독틱을 새 강한 접촉으로 소급 강화하지 않음',()=>{
  const {room,player,monster,power}=setup(2);
  castOphiuchus(room,player,now);advanceOphiuchusVenoms(room,now+1000);
  const strong=companion(room,player,'strong',4),strongPower=attackPowerOf(4,'ophiuchus',strong);
  castOphiuchus(room,strong,now+3000);
  const before=monster.hp;advanceOphiuchusVenoms(room,now+3500);
  assert.equal(before-monster.hp,power*2+strongPower*3);
  assert.equal(monster.combatPoison.nextTickAt,now+4000);
  assert.equal(poisonHits(advanceOphiuchusPoison(room,now+4000))[0].damage,strongPower);
});

test('서로 다른 위치의 지대에서 강한 독 만료 후 유효한 약한 독으로 이어짐',()=>{
  const {room,player,monster,power}=setup(2);
  const strong=companion(room,player,'strong',4);strong.x=900;
  const strongPower=attackPowerOf(4,'ophiuchus',strong);
  monster.x=900;monster.y=strong.y+avatarSizeOf(strong)*.25;
  castOphiuchus(room,strong,now);advanceOphiuchusVenoms(room,now+1000);
  monster.x=player.x;monster.y=player.y+avatarSizeOf(player)*.25;
  castOphiuchus(room,player,now+6000);advanceOphiuchusVenoms(room,now+7000);
  const before=monster.hp;const hits=poisonHits(advanceOphiuchusPoison(room,now+10000));
  assert.deepEqual(hits.map(h=>h.damage),[strongPower,strongPower,power]);
  assert.equal(before-monster.hp,strongPower*2+power);assert.equal(monster.combatPoison,null);
});

test('성장·유지·축소 타원 경계: 몸 반경 포함, X/Y 밖·대각선·다른 맵 제외',()=>{
  for(const level of [2,3,4])for(const elapsed of [1000,2000,13000])for(const axis of ['x','y']){
    const {room,player,monster}=setup(level);castOphiuchus(room,player,now);
    const cast=room.ophiuchusVenoms[0],area=ophiuchusAreaAt(cast,elapsed);
    const border=axis==='x'?area.rx:area.ry;
    monster[axis]=area[axis]+border+monster.radius+.001;
    assert.deepEqual(advanceOphiuchusVenoms(room,now+elapsed),[]);
    monster[axis]-=.002;
    assert.equal(advanceOphiuchusVenoms(room,now+elapsed)[0].targets.length,1);
  }
  const {room,player,monster}=setup();castOphiuchus(room,player,now);
  const c=room.ophiuchusVenoms[0];monster.x=c.x+c.rx;monster.y=c.y+c.ry;
  assert.deepEqual(advanceOphiuchusVenoms(room,now+2000),[]);
  monster.x=c.x;monster.y=c.y;monster.mapId='star-origin-2';
  assert.deepEqual(advanceOphiuchusVenoms(room,now+2000),[]);
});

test('E는 학생에게 직접/중독 피해 없음',()=>{
  const {room,player}=setup(),friend=companion(room,player,'friend');
  const hp=ensureVitals(friend).hp;castOphiuchus(room,player,now);
  for(const t of [1000,2000,5000,14000,22000]){
    const events=advanceOphiuchusVenoms(room,now+t);
    assert.ok(events.every(e=>e.playerTargets.length===0));
    assert.equal(ensureVitals(friend).hp,hp);assert.equal(friend.combatPoison,undefined);
  }
});

test('퇴장·자리비움·사망·블랙스타·별자리·레벨·초월·취소 시 지대와 해당 독 중단',()=>{
  const mutations=[
    ({player})=>{player.connected=false;},({player})=>{player.away=true;},
    ({player})=>{ensureVitals(player).hp=0;},({player})=>{player.avatar.blackStar=true;},
    ({player})=>{player.mapId='star-origin-2';},({player})=>{player.avatar.constellationId='aries';},
    ({player})=>{player.avatar.level=3;},({player})=>{player.transformation={active:true,endsAt:now+30000};},
    ({room})=>{room.ophiuchusVenoms[0].cancelled=true;},({room})=>{room.ophiuchusVenoms=[];},
    ({room,player})=>{room.players.delete(player.id);}
  ];
  for(const mutate of mutations){
    const state=setup();castOphiuchus(state.room,state.player,now);
    advanceOphiuchusVenoms(state.room,now+1000);const before=state.monster.hp;
    mutate(state);assert.deepEqual(ophiuchusViews(state.room,'star-origin-1',now+2000),[]);
    advanceOphiuchusVenoms(state.room,now+2000);advanceOphiuchusPoison(state.room,now+2000);
    assert.equal(state.monster.hp,before);assert.equal(state.monster.combatPoison,null);
    assert.equal(state.room.ophiuchusVenoms.length,0);
  }
});

test('LV5 초월 시작/종료는 스냅샷 지대 취소, 초월 시간 만료도 별도 정리 없이 감지',()=>{
  for(const ended of [false,true]){
    const {room,player,monster}=setup(5);
    player.transformation={active:true,endsAt:now+2500};
    castOphiuchus(room,player,now);advanceOphiuchusVenoms(room,now+1000);const hp=monster.hp;
    if(ended)player.transformation.active=false;
    advanceOphiuchusVenoms(room,now+2500);
    assert.equal(monster.hp,hp);assert.equal(monster.combatPoison,null);assert.equal(room.ophiuchusVenoms.length,0);
  }
});

test('지대 정상 종료 뒤 마지막 접촉의 독은 지속, 종료 후 최초 접촉 소급 없음',()=>{
  const {room,player,monster,power}=setup(2);
  castOphiuchus(room,player,now);advanceOphiuchusVenoms(room,now+13000);
  const events=advanceOphiuchusVenoms(room,now+14000);
  assert.equal(events.length,1);assert.equal(room.ophiuchusVenoms.length,0);
  assert.ok(monster.combatPoison);
  advanceOphiuchusPoison(room,now+50000);
  assert.equal(monster.hp,10000-power*4);assert.equal(monster.combatPoison,null);
  const delayed=setup();castOphiuchus(delayed.room,delayed.player,now);
  assert.deepEqual(advanceOphiuchusVenoms(delayed.room,now+15000),[]);
  assert.equal(delayed.monster.hp,10000);assert.equal(delayed.monster.combatPoison,undefined);
});

test('지연 동안 미확인 접촉은 연장 소급하지 않고 재접촉 때 새 중독 시작',()=>{
  const {room,player,monster,power}=setup(2);
  castOphiuchus(room,player,now);advanceOphiuchusVenoms(room,now+1000);
  advanceOphiuchusVenoms(room,now+9000);
  assert.equal(monster.hp,10000-power*4);
  assert.equal(monster.combatPoison.nextTickAt,now+10000);
  assert.equal(monster.combatPoison.expiresAt,now+12000);
});

test('몬스터 사망/맵변경 중독 정리, 치명적 최초피해는 독 부착 없음',()=>{
  for(const change of [m=>{m.hp=0;},m=>{m.mapId='star-origin-2';}]){
    const {room,player,monster}=setup();castOphiuchus(room,player,now);
    advanceOphiuchusVenoms(room,now+1000);change(monster);
    assert.deepEqual(advanceOphiuchusPoison(room,now+2000).events,[]);
    assert.equal(monster.combatPoison,null);
  }
  const {room,player,monster}=setup();monster.hp=1;
  castOphiuchus(room,player,now);advanceOphiuchusVenoms(room,now+1000);
  assert.equal(monster.hp,0);assert.equal(monster.combatPoison,null);
  assert.deepEqual(advanceOphiuchusPoison(room,now+10000).events,[]);
});

test('LV1·마나 부족·쿨타임·잘못된 바닥은 추가 소모/지대 없이 거부',()=>{
  const {room,player}=setup();
  player.avatar.level=1;assert.throws(()=>castOphiuchus(room,player,now),/LV2/);
  player.avatar.level=4;ensureVitals(player).mp=4;assert.throws(()=>castOphiuchus(room,player,now),/마나/);
  assert.equal(player.ophiuchusCooldownUntil,undefined);
  ensureVitals(player).mp=30;player.x=-1;
  assert.throws(()=>castOphiuchus(room,player,now),/바닥/);
  assert.equal(ensureVitals(player).mp,30);assert.equal(room.ophiuchusVenoms,undefined);
  player.x=500;castOphiuchus(room,player,now);
  assert.throws(()=>castOphiuchus(room,player,now+4999),/기다려/);
  assert.equal(ensureVitals(player).mp,25);assert.equal(room.ophiuchusVenoms.length,1);
  castOphiuchus(room,player,now+5000);assert.equal(room.ophiuchusVenoms.length,2);
  assert.ok(Object.values(OPHIUCHUS_VFX).every(spec=>spec.frames===24));
});
