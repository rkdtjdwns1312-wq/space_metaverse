import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureVitals} from '../server/vitals.js';
import {STAR_RECORD_CHALLENGE,tryStarRecordChallenge,answerStarRecordChallenge,tickStarRecordChallenge,starRecordChallengeView} from '../server/star-record-challenge.js';
import {STAR_RECORD_MATH,tryStarRecordMath,answerStarRecordMath,tickStarRecordMath,starRecordMathView} from '../server/star-record-math.js';
import {STAR_RECORD_FLOW,tryStarRecordFlow,recordStarRecordMovement,tickStarRecordFlow,starRecordFlowView} from '../server/star-record-flow.js';
import {STAR_RECORD,starRecordMap} from '../shared/star-record.js';
import {mapOf} from '../shared/config.js';
import {monsterType} from '../shared/monsters.js';
import {summonStarRecord} from '../server/star-record.js';
import {monsterViews,damageMonster,advanceStarRecordAttack,moveMonsters,selectMonsterTarget} from '../server/monsters.js';
import {starRecordView,restoreStarRecordStatue,nextBossRespawnAt} from '../server/boss-lifecycle.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {BOSS_DIALOGUES} from '../shared/boss-dialogues.js';

const make=()=>{
  const player={id:'student',role:'student',connected:true,away:false,mapId:'sleeping-stars-2',x:600,y:600,
    avatar:{level:5,constellationId:'leo'},input:{x:0,y:0,at:0}};
  ensureVitals(player);
  const boss={id:'star-record-boss',typeId:'star-record',mapId:player.mapId,x:600,y:600,hp:10000,mp:100};
  const room={players:new Map([[player.id,player]]),monsters:new Map([[boss.id,boss]])};
  return {room,player,boss};
};
test('보스의 마지막 공격자가 이탈해도 남은 참가자의 패턴은 유지된다',()=>{
  for(const start of [tryStarRecordChallenge,tryStarRecordMath,tryStarRecordFlow]){
    const {room,player,boss}=make(),now=100000;
    const friend={...player,id:'friend',nickname:'친구',battleVitals:undefined};ensureVitals(friend);room.players.set(friend.id,friend);
    Object.assign(boss,{maxHp:10000,attackers:new Map([[player.id,1]]),contributors:new Map(),mapExitCount:0});
    assert.equal(start(room,boss,now,()=>0),true);
    player.mapId='plaza';
    selectMonsterTarget(room,boss);
    assert.ok(boss.recordChallenge||boss.recordMath||boss.recordFlow,'남은 참가자 패턴 유지');
    assert.equal(advanceStarRecordAttack(room,boss,now+1000,()=>0).busy,true);
  }
});
test('행성 두 문제는 서로 다르고 총 10초, 마나 10, 쿨타임 40초',()=>{
  const {room,player,boss}=make(),now=100000;
  assert.equal(tryStarRecordChallenge(room,boss,now,()=>0),true);
  assert.equal(boss.mp,90);assert.equal(boss.recordChallengeReadyAt,now+40000);
  assert.equal(boss.recordChallenge.endsAt,now+10000);
  const [first,second]=boss.recordChallenge.participants.get(player.id).planets;
  assert.notEqual(first,second);assert.equal(starRecordChallengeView(boss,now).prompts[0].planet,first);
  assert.equal(answerStarRecordChallenge(room,player,first,now+1000),true);
  assert.equal(starRecordChallengeView(boss,now+1000).prompts[0].planet,second);
  assert.equal(answerStarRecordChallenge(room,player,second,now+6000),true);
  assert.deepEqual(tickStarRecordChallenge(room,boss,now+6000).hits,[]);
  assert.equal(boss.recordChallenge,null);assert.equal(tryStarRecordChallenge(room,boss,now+39999,()=>0),false);
  assert.equal(STAR_RECORD_CHALLENGE.totalMs,10000);
});
test('첫 행성도 전체 제한 10초 안에 답할 수 있고 기한이 지나면 즉사한다',()=>{
  const {room,player,boss}=make(),now=100000;
  tryStarRecordChallenge(room,boss,now,()=>0);
  const [first,second]=boss.recordChallenge.participants.get(player.id).planets;
  assert.equal(answerStarRecordChallenge(room,player,first,now+9000),true);
  assert.equal(answerStarRecordChallenge(room,player,second,now+10000),false);
  assert.equal(tickStarRecordChallenge(room,boss,now+10000).hits.length,1);
  assert.equal(ensureVitals(player).hp,0);
});
test('숫자 별 다섯 개는 두 자리 안의 사칙연산이며 오답자만 즉사',()=>{
  const {room,player,boss}=make(),other={...player,id:'friend',x:700,y:700,battleVitals:undefined};
  ensureVitals(other);room.players.set(other.id,other);
  const now=100000;assert.equal(tryStarRecordMath(room,boss,now,()=>0),true);
  assert.equal(boss.mp,80);assert.equal(boss.recordMathReadyAt,now+60000);
  assert.equal(boss.recordMath.stars.length,5);assert.equal(boss.recordMath.endsAt,now+30000);
  for(const star of boss.recordMath.stars){
    assert(star.left>=0&&star.left<=99);assert(star.right>=0&&star.right<=99);assert(star.result>=0&&star.result<=99);
  }
  const star=boss.recordMath.stars[0];player.x=star.x;player.y=star.y;
  const wrong=answerStarRecordMath(room,player,star.id,'−',now+1000);
  assert.equal(wrong.correct,false);assert.equal(ensureVitals(player).hp,0);
  assert(ensureVitals(other).hp>0);assert.equal(star.solved,false);
  assert.equal(starRecordMathView(boss,now+1000).stars.length,5);
  const timeout=tickStarRecordMath(room,boss,now+30000);
  assert.equal(timeout.hits.length,1);assert.equal(ensureVitals(other).hp,0);
  assert.equal(boss.recordMath,null);assert.equal(STAR_RECORD_MATH.durationMs,30000);
});
test('둘 이상의 연산이 같은 결과를 내면 어느 정답을 눌러도 살아남는다',()=>{
  const {room,player,boss}=make(),now=100000;
  assert.equal(tryStarRecordMath(room,boss,now,()=>0),true);
  const star=boss.recordMath.stars[0];Object.assign(star,{left:1,right:1,result:1,operator:'×'});
  player.x=star.x;player.y=star.y;
  assert.equal(answerStarRecordMath(room,player,star.id,'÷',now+1000).correct,true);
  assert.equal(star.solved,true);assert(ensureVitals(player).hp>0);
});
test('다섯 별을 맞히면 맵 전체 즉사를 중단한다',()=>{
  const {room,player,boss}=make(),now=100000;
  assert.equal(tryStarRecordMath(room,boss,now,()=>0),true);
  for(const star of boss.recordMath.stars){player.x=star.x;player.y=star.y;
    assert.equal(answerStarRecordMath(room,player,star.id,star.operator,now+1000).correct,true);}
  assert.equal(boss.recordMath,null);assert(ensureVitals(player).hp>0);
  assert.deepEqual(tickStarRecordMath(room,boss,now+30000).hits,[]);
});
test('방향 네 글자를 차례로 움직이면 성공하고 머리 위에는 남은 방향만 표시한다',()=>{
  const {room,player,boss}=make(),now=100000;
  assert.equal(tryStarRecordFlow(room,boss,now,()=>0),true);
  assert.equal(boss.mp,90);assert.equal(boss.recordFlowReadyAt,now+30000);
  assert.equal(boss.recordFlow.endsAt,now+10000);
  const sequence=boss.recordFlow.participants.get(player.id).sequence;
  assert.deepEqual(new Set(sequence),new Set(['동','서','남','북']));
  const vector={동:[1,0],서:[-1,0],남:[0,1],북:[0,-1]};
  for(let i=0;i<4;i++){
    const [x,y]=vector[sequence[i]];
    assert.equal(recordStarRecordMovement(room,player,x,y,now+1000+i*1000).correct,true);
    if(i<3)assert.equal(starRecordFlowView(boss,now+1000+i*1000).prompts[0].remaining.length,3-i);
  }
  assert.deepEqual(tickStarRecordFlow(room,boss,now+5000).hits,[]);
  assert.equal(boss.recordFlow,null);assert(ensureVitals(player).hp>0);
  assert.equal(STAR_RECORD_FLOW.durationMs,10000);
});
test('방향을 틀리면 처음부터 다시 시작하고 공격력 100% 피해, 제한 시간은 그대로',()=>{
  const {room,player,boss}=make(),now=100000;
  tryStarRecordFlow(room,boss,now,()=>0);
  const entry=boss.recordFlow.participants.get(player.id),wrong=entry.sequence[1],vector={동:[1,0],서:[-1,0],남:[0,1],북:[0,-1]};
  const before=ensureVitals(player).hp,[x,y]=vector[wrong],result=recordStarRecordMovement(room,player,x,y,now+1000);
  assert.equal(result.correct,false);assert.equal(result.hit.damage,25);assert.equal(ensureVitals(player).hp,before-25);
  assert.equal(entry.index,0);assert.equal(boss.recordFlow.endsAt,now+10000);
  assert.equal(recordStarRecordMovement(room,player,x,y,now+1100),null,'계속 누르는 방향 중복 판정 방지');
  assert.equal(tickStarRecordFlow(room,boss,now+10000).hits.length,1);
  assert.equal(ensureVitals(player).hp,0);
});
test('2구역 석상은 소환과 처치 후 복구되며 보스 크기와 능력이 검은별과 같다',()=>{
  const at=Date.parse('2026-11-01T12:00:00+09:00'),statue=mapOf(STAR_RECORD.mapId).objects.find(o=>o.id===STAR_RECORD.statueId);
  const {room,player}=make();room.monsters.clear();player.x=statue.x;player.y=statue.y+90;
  chargeHuntingStation(player,'math',at);
  assert.equal(starRecordView(room).state,'dormant');
  assert.equal(summonStarRecord(room,player,at).starRecord.state,'active');
  assert.equal(starRecordMap(mapOf(STAR_RECORD.mapId),room.starRecord).objects.some(o=>o.id===statue.id),false);
  const boss=room.monsters.get(STAR_RECORD.monsterId);
  assert.deepEqual([boss.maxHp,boss.maxMp,boss.radius,monsterType('star-record').power],[10000,100,150,30]);
  assert.deepEqual(monsterType('star-record').combat,monsterType('dark-star').combat);
  assert.equal(monsterViews(room,at).find(m=>m.id===boss.id).typeId,'star-record');
  damageMonster(room,boss,player,10000,at,{energyRoll:()=>1500});
  assert.equal(room.starRecord.state,'recovering');
  const rewards=[...room.energyDrops.values()].map(drop=>drop.itemId).filter(Boolean);
  assert(rewards.includes('origin-star-record'));assert(rewards.includes('gold-big-bang-card'));
  assert([1,2].includes(rewards.filter(id=>id==='exploration-ticket').length));
  assert.equal([...room.energyDrops.values()].find(drop=>!drop.kind).total,1500);
  assert.equal(restoreStarRecordStatue(room,nextBossRespawnAt(at)-1),false);
  assert.equal(restoreStarRecordStatue(room,nextBossRespawnAt(at)),true);
  assert.equal(BOSS_DIALOGUES['star-record'].lines.length,3);
});
test('기본 공격은 대상 쪽 3개 직선 예고 뒤 1초에 100% 피해를 준다',()=>{
  const {room,player,boss}=make(),now=100000;
  boss.x=600;boss.y=600;player.x=760;player.y=600;
  const before=ensureVitals(player).hp;
  assert.equal(advanceStarRecordAttack(room,boss,now,()=>.25).busy,true);
  assert.equal(boss.starRecordCast.rays.length,3);
  assert.equal(boss.starRecordCast.endsAt-now,1000);
  assert.equal(advanceStarRecordAttack(room,boss,now+999,()=>.25).hits.length,0);
  const hits=advanceStarRecordAttack(room,boss,now+1000,()=>.25).hits;
  assert.equal(hits.length,1);assert.equal(hits[0].targetId,player.id);
  assert(ensureVitals(player).hp<before);
});

test('세 패턴이 미완료인 동안 기본 공격이 패턴을 끝내지 못한다',()=>{
  for(const [name,start,answerOne] of [
    ['받아쓰기',tryStarRecordChallenge,(room,player,boss,now)=>{
      const first=boss.recordChallenge.participants.get(player.id).planets[0];
      answerStarRecordChallenge(room,player,first,now+1000);
      assert.equal(boss.recordChallenge.participants.get(player.id).round,1);
    }],
    ['숫자 별',tryStarRecordMath,(room,player,boss,now)=>{
      const star=boss.recordMath.stars[0];player.x=star.x;player.y=star.y;
      answerStarRecordMath(room,player,star.id,star.operator,now+1000);
      assert.equal(boss.recordMath.stars.filter(item=>item.solved).length,1);
    }],
    ['동서남북',tryStarRecordFlow,(room,player,boss,now)=>{
      const first=boss.recordFlow.participants.get(player.id).sequence[0];
      const [x,y]={동:[1,0],서:[-1,0],남:[0,1],북:[0,-1]}[first];
      recordStarRecordMovement(room,player,x,y,now+1000);
      assert.equal(boss.recordFlow.participants.get(player.id).index,1);
    }]
  ]){
    const {room,player,boss}=make(),now=100000;
    assert.equal(start(room,boss,now,()=>0),true,name);
    answerOne(room,player,boss,now);
    const before=ensureVitals(player).hp;
    assert.equal(advanceStarRecordAttack(room,boss,now+2000,()=>0).busy,true,name);
    assert.equal(boss.starRecordCast.rays.length,3,name);
    assert.equal(ensureVitals(player).hp,before,name);
    assert(boss.recordChallenge||boss.recordMath||boss.recordFlow,name);
  }
});

test('별 기록의 근원이 기절해도 진행 중인 받아쓰기는 유지되고 시간 초과가 적용된다',()=>{
  const now=100000,{room,player,boss}=make();
  Object.assign(boss,{lastMoveAt:now,attackers:new Map([[player.id,1]]),teacherRetaliation:new Set(),
    contributors:new Map(),meleePresence:new Map(),targetId:player.id,moving:false});
  assert.equal(tryStarRecordChallenge(room,boss,now,()=>0),true);
  boss.stunUntil=now+12000;
  moveMonsters(room,now+1000,()=>1);
  assert(boss.recordChallenge,'기절 중에도 두 번째 문제는 남아야 함');
  assert.equal(boss.starRecordCast,null);
  const hits=moveMonsters(room,now+10000,()=>1);
  assert.equal(hits.filter(hit=>hit.skillKind==='star-record-challenge').length,1);
  assert.equal(ensureVitals(player).hp,0);
});

for(const [key,start] of [['recordChallenge',tryStarRecordChallenge],['recordMath',tryStarRecordMath],['recordFlow',tryStarRecordFlow]]){
  test(`${key} 중에도 실제 이동 틱에서 기본공격이 반복되고 패턴 마감시각은 유지된다`,()=>{
    const now=100000,{room,player,boss}=make();player.x=boss.x+160;
    Object.assign(boss,{lastMoveAt:now,maxHp:10000,radius:100,dx:1,dy:0,attackers:new Map([[player.id,1]]),teacherRetaliation:new Set(),
      contributors:new Map(),meleePresence:new Map(),targetId:player.id,moving:false});
    assert.equal(start(room,boss,now,()=>0),true);
    const pattern=boss[key],deadline=pattern.endsAt;
    const first=moveMonsters(room,now+100,()=>.99);
    assert.equal(first.filter(h=>h.skillKind==='star-record-burst').length,0);
    assert.equal(boss.starRecordCast.endsAt,now+1100);
    const hp=ensureVitals(player).hp;
    const hits=moveMonsters(room,now+1100,()=>.99);
    assert.ok(hits.some(h=>h.skillKind==='star-record-burst'&&h.targetId===player.id));
    assert.ok(ensureVitals(player).hp<hp);
    assert.equal(boss[key],pattern);assert.equal(pattern.endsAt,deadline);
    ensureVitals(player).hp=hp;
    moveMonsters(room,now+3100,()=>.99);
    assert.equal(boss.starRecordCast.endsAt,now+4100);
    assert.ok(moveMonsters(room,now+4100,()=>.99).some(h=>h.skillKind==='star-record-burst'));
    assert.equal(boss[key],pattern);assert.equal(pattern.endsAt,deadline);
  });
}
