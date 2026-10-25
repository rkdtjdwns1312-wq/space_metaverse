import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTER_ATTACK_ART,monsterAttackPose,drawPaintedMonsterFrame} from '../client/monster-attack-frames.js';
import {bossMonsterBounds} from '../client/boss-monster-art.js';
test('8개 공격 포즈가 준비부터 복귀까지 순서대로 재생되고 종료한다',()=>{
 const a={startedAt:100,durationMs:600};
 assert.deepEqual([30,90,150,215,295,390,475,560].map(t=>monsterAttackPose(100+t,a).frame),[0,1,2,3,4,5,6,7]);
 for(const time of [0,99,700,Infinity,NaN])assert.equal(monsterAttackPose(time,a).active,false);
 assert.equal(monsterAttackPose(200,null).active,false);
 assert.equal(monsterAttackPose(130,{startedAt:100,durationMs:NaN}).frame,0);
});
test('새 시트 9종의 프레임 영역과 발 기준점이 실제 PNG 셀 범위 안이다',()=>{
 assert.equal(Object.keys(MONSTER_ATTACK_ART).length,9);
 for(const [id,art]of Object.entries(MONSTER_ATTACK_ART)){
  const png=readFileSync('client'+(art.src||`/assets/monsters/${id}-attack.png`));
  assert.equal(png.readUInt32BE(16),1774);assert.equal(png.readUInt32BE(20),887);
  assert.equal(art.bounds.length,8);for(const [l,t,r,b]of art.bounds)assert(l>=0&&t>=0&&r>l&&b>t&&r<=443&&b<=443,id);
 }
 assert.equal(drawPaintedMonsterFrame({},'unknown',0,40),false);
});
test('성령왕 이름 기준은 공격/보행의 가장 높은 지팡이보다 위에 고정된다',()=>{
 const r=80,b=bossMonsterBounds({shape:'spirit-king',radius:r,y:200});
 for(const id of ['spirit-king','spirit-king-walk']){
  const art=MONSTER_ATTACK_ART[id],scale=r*art.height/(art.bounds[0][3]-art.bounds[0][1]);
  for(const [,top,,bottom]of art.bounds)assert(b.top<=b.bottom-(bottom-top)*scale);
 }
 assert.deepEqual(b,bossMonsterBounds({shape:'spirit-king',radius:r,y:200},true));
});
