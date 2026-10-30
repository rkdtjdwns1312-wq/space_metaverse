import test from 'node:test';
import assert from 'node:assert/strict';
import {castCorona,advanceCorona} from '../server/corona-skills.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals,playerVitals} from '../server/vitals.js';
import {coronaSkillOf} from '../shared/corona-skills.js';
import {characterAbilities} from '../shared/character-skills.js';
const now=Date.now();
function fixture(level=4){
 const player={id:'crown',role:'student',connected:true,away:false,mapId:'star-origin-1',x:500,y:450,facing:{x:1,y:0},avatar:{level,constellationId:'corona-borealis'}};
 const room={players:new Map([[player.id,player]]),planets:new Map()},base=monstersOf(room,now).get('star-crab');
 const enemy={...base,id:'target',x:550,y:450,hp:1000,maxHp:1000,attackers:new Map(),contributors:new Map()};room.monsters=new Map([[enemy.id,enemy]]);
 return {room,player,enemy};
}
test('왕관 Lv2/3/4/5는 활성 Q와 낙검의 실제 몬스터 명중마다 각각2/3/4/5 회복한다',()=>{
 for(const level of [2,3,4,5]){
  const {room,player}=fixture(level);castCorona(room,player,now);ensureVitals(player).hp=1;
  assert.equal(coronaSkillOf(player).hitHealing,level);assert.match(characterAbilities(player).find(s=>s.slot==='skill').description,new RegExp(`체력 ${level} 회복`));
  const q=castCorona(room,player,now+1,{basic:true});assert.equal(q.targets.length,1);assert.equal(q.vitals.hp.current,1+level);
  assert.equal(advanceCorona(room,now+300).healed.length,0);
  const fall=advanceCorona(room,now+301);assert.equal(fall.hits.length,1);assert.equal(fall.healed[0].amount,level);assert.equal(fall.healed[0].vitals.hp.current,1+level*2);
  assert.equal(advanceCorona(room,now+302).healed.length,0);
 }
});
test('여러 몬스터를 맞히면 각각 회복하고 최대HP·처치 명중을 올바르게 처리한다',()=>{
 const {room,player,enemy}=fixture();castCorona(room,player,now);ensureVitals(player).hp=1;
 room.monsters.set('second',{...enemy,id:'second',x:570,attackers:new Map(),contributors:new Map()});enemy.hp=1;
 const result=castCorona(room,player,now+1,{basic:true});assert.equal(result.targets.length,2);assert.equal(ensureVitals(player).hp,9);assert.equal(result.falls.length,1);
 ensureVitals(player).hp=playerVitals(player).hp.max-1;const fall=advanceCorona(room,now+301);assert.equal(fall.healed[0].amount,1);assert.equal(ensureVitals(player).hp,playerVitals(player).hp.max);
});
test('비활성·빗나감·아군·이미 죽은 몬스터에는 회복하지 않는다',()=>{
 for(const mode of ['inactive','miss','friendly','dead']){
  const {room,player,enemy}=fixture();if(mode!=='inactive')castCorona(room,player,now);ensureVitals(player).hp=1;
  if(mode==='miss')enemy.x=1500;if(mode==='dead')enemy.hp=0;
  if(mode==='friendly'){room.monsters.clear();room.players.set('friend',{...player,id:'friend',x:550,avatar:{level:4,constellationId:'taurus'},battleVitals:undefined});}
  castCorona(room,player,now+1,{basic:true});assert.equal(ensureVitals(player).hp,1,mode);
 }
});
test('반사로 피해0인 명중·사망·이탈·맵 변경·오라 만료 뒤 낙검에는 회복하지 않는다',()=>{
 const f=fixture();Object.assign(f.enemy,{typeId:'noksera',moonAura:{mapId:f.enemy.mapId,fullStartsAt:now,fullEndsAt:now+1000}});castCorona(f.room,f.player,now);ensureVitals(f.player).hp=playerVitals(f.player).hp.max;
 const hp=ensureVitals(f.player).hp,hit=castCorona(f.room,f.player,now+1,{basic:true});assert.equal(hit.targets[0].damage,0);assert.equal(ensureVitals(f.player).hp,hp-hit.targets[0].reflectedDamage);
 for(const mode of ['dead','away','map','expired','ghost']){
  const {room,player}=fixture();castCorona(room,player,now);castCorona(room,player,now+1,{basic:true});ensureVitals(player).hp=1;
  if(mode==='dead')ensureVitals(player).hp=0;if(mode==='away')player.away=true;if(mode==='map')player.mapId='space-plaza';if(mode==='expired')player.coronaAura.endsAt=now+301;if(mode==='ghost')player.avatar.blackStar=true;
  const before=ensureVitals(player).hp,result=advanceCorona(room,now+301);assert.equal(result.healed.length,0,mode);assert.equal(ensureVitals(player).hp,before,mode);
 }
});
