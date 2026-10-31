import test from 'node:test';
import assert from 'node:assert/strict';
import {castCorona,advanceCorona,coronaAuraViews} from '../server/corona-skills.js';
import {advanceProjectiles} from '../server/projectiles.js';
import {combatEnemies,damageTargets} from '../server/sagittarius-skills.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {attackPowerOf} from '../shared/combat.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {coronaSkillOf} from '../shared/corona-skills.js';
import {characterAbilities} from '../shared/character-skills.js';

const now=Date.now();
function fixture(level=4){
  const player={id:'crown',role:'student',connected:true,away:false,mapId:'star-origin-1',x:500,y:450,facing:{x:1,y:0},avatar:{level,constellationId:'corona-borealis'}};
  const room={players:new Map([[player.id,player]]),planets:new Map()},base=monstersOf(room,now).get('star-crab');
  const enemy={...base,id:'target',x:570,y:450,hp:10000,maxHp:10000,attackers:new Map(),contributors:new Map()};
  room.monsters=new Map([[enemy.id,enemy]]);
  return {room,player,enemy};
}
test('왕관 Lv2/3/4/5: 마나5·쿨10초·다음 5회 각각 200/250/300% 강화',()=>{
  for(const [level,multiplier] of [[2,2],[3,2.5],[4,3],[5,3]]){
    const {room,player,enemy}=fixture(level),spec=coronaSkillOf(player),initialMp=ensureVitals(player).mp;
    assert.equal(spec.mana,5);assert.equal(spec.cooldownMs,10000);
    castCorona(room,player,now);assert.equal(ensureVitals(player).mp,initialMp-5);
    assert.throws(()=>castCorona(room,player,now+9999),/기다려/);
    const power=attackPowerOf(level,'corona-borealis',player);
    for(let i=1;i<=5;i++){
      castCorona(room,player,now+i,{basic:true});
      assert.equal(enemy.hp,10000-i*Math.round(power*multiplier));
      assert.equal(player.coronaAura?.remaining??0,Math.max(0,5-i));
    }
    assert.match(characterAbilities(player)[1].description,new RegExp(`${multiplier*100}%`));
    assert.equal(room.projectiles.length,1);
    assert.equal(room.projectiles[0].power,Math.round(power*5*spec.finaleMultiplier));
    assert.equal(room.projectiles[0].piercing,true);
    assert.equal(room.projectiles[0].visualScale,3);
    advanceProjectiles(room,now+655,combatEnemies,damageTargets);
    assert.equal(enemy.hp,10000-5*Math.round(power*multiplier)-Math.round(power*5*spec.finaleMultiplier));
  }
});
test('왕관 강화는 빗나간 공격도 소모하고 검기는 실제 명중 횟수만큼 계산한다',()=>{
  const {room,player,enemy}=fixture();castCorona(room,player,now);
  for(let i=1;i<=3;i++){enemy.x=1500;castCorona(room,player,now+i,{basic:true});}
  enemy.x=570;
  for(let i=4;i<=5;i++)castCorona(room,player,now+i,{basic:true});
  assert.equal(room.projectiles[0].power,attackPowerOf(4,'corona-borealis',player)*2*2);
  assert.equal(player.coronaAura,null);
  const before=enemy.hp;advanceProjectiles(room,now+655,combatEnemies,damageTargets);
  assert.equal(before-enemy.hp,attackPowerOf(4,'corona-borealis',player)*4);
});
test('강화는 시간이 지나도 5회까지 유지하며 사망·맵 이탈 시 정리된다',()=>{
  for(const mode of ['alive','dead','away','map']){
    const {room,player}=fixture();castCorona(room,player,now);
    if(mode==='dead')ensureVitals(player).hp=0;
    if(mode==='away')player.away=true;
    if(mode==='map')player.mapId='space-plaza';
    advanceCorona(room,now+3600000);
    assert.equal(!!player.coronaAura,mode==='alive');
    assert.equal(coronaAuraViews(room,'star-origin-1',now+3600000).length,mode==='alive'?1:0);
  }
});
test('큰 검기는 기존 검기 150% 시각 크기로 몬스터를 관통한다',()=>{
  const {room,player,enemy}=fixture(),size=avatarSizeOf(player);
  const other={...enemy,id:'far',x:enemy.x+size,attackers:new Map(),contributors:new Map()};room.monsters.set(other.id,other);
  castCorona(room,player,now);
  for(let i=1;i<=5;i++)castCorona(room,player,now+i,{basic:true});
  const first=enemy.hp,second=other.hp;
  assert.equal(room.projectiles[0].visualScale,3);
  advanceProjectiles(room,now+655,combatEnemies,damageTargets);
  assert.equal(first-enemy.hp,second-other.hp);
  assert.ok(first>enemy.hp);
});
