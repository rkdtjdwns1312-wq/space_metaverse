import test from 'node:test';
import assert from 'node:assert/strict';
import {CONSTELLATIONS} from '../shared/constellations.js';
import {attackPowerOf,defensePowerOf} from '../shared/combat.js';
import {vitalsOf} from '../shared/vitals.js';
import {MONSTER_LEVEL_STATS,MONSTER_TYPES} from '../shared/monsters.js';
import {damageMonster} from '../server/monsters.js';
import {addRecipeDrop} from '../server/energy-drops.js';
import {recipeItemId} from '../shared/recipe-items.js';

const player=(id,level)=>({id,role:'student',connected:true,mapId:'star-origin-1',
  avatar:{level,constellationId:id}});

test('LV2~5 능력치와 다섯 계열 보정은 단계별 반올림·0 하한을 지킨다',()=>{
  const base={2:{hp:20,mp:20,attack:5,defense:0},3:{hp:40,mp:30,attack:7,defense:1},
    4:{hp:60,mp:40,attack:10,defense:2},5:{hp:60,mp:40,attack:10,defense:2}};
  const offsets={'수호계':{hp:1.5,mp:0,attack:-2,defense:2},
    '특수계':{hp:1,mp:0,attack:0,defense:0},
    '공격계':{hp:.5,mp:0,attack:1,defense:-2},
    '생산계':{hp:1,mp:10,attack:-1,defense:0},
    '제작계':{hp:1,mp:10,attack:-1,defense:0}};
  for(const c of CONSTELLATIONS)for(const level of [2,3,4,5]){
    const p=player(c.id,level),b=base[level],o=offsets[c.type];
    assert.equal(vitalsOf(level,p).hp.max,Math.round(b.hp*o.hp),c.name+' HP LV'+level);
    assert.equal(vitalsOf(level,p).mp.max,b.mp+o.mp,c.name+' MP LV'+level);
    assert.equal(attackPowerOf(level,c.id,p),Math.max(0,b.attack+o.attack));
    assert.equal(defensePowerOf(level,c.id,p),Math.max(0,b.defense+o.defense));
  }
});

test('몬스터 LV1~4·LV6 공격·방어·체력과 최소 피해 1',()=>{
  assert.deepEqual(MONSTER_LEVEL_STATS,{
    1:{hp:50,power:3,defense:0},2:{hp:100,power:6,defense:1},
    3:{hp:300,power:10,defense:2},4:{hp:1000,power:15,defense:4},
    6:{hp:10000,power:30,defense:0}});
  for(const level of [1,2,3,4,6]){
    const monster={id:'m',typeId:null,level,mapId:'star-origin-1',x:0,y:0,
      hp:MONSTER_LEVEL_STATS[level].hp,maxHp:MONSTER_LEVEL_STATS[level].hp,
      attackers:new Map(),contributors:new Map(),attackOrder:0,mapExitCount:0};
    const attacker=player('gemini',4),room={players:new Map([['gemini',attacker]])};
    const result=damageMonster(room,monster,attacker,MONSTER_LEVEL_STATS[level].defense,100);
    assert.equal(result.damage,1,'LV'+level+' 방어 후 피해');
    assert.equal(monster.hp,monster.maxHp-1);
  }
  assert.equal(MONSTER_TYPES.some(type=>type.level===4),true,'성장한 낙원 몬스터는 LV4로 배치한다');
});

test('LV4 몬스터도 1% 조합 레시피 드랍을 사용할 수 있다',()=>{
  const id='solar-system-card',owner=player('gemini',4);
  const room={players:new Map([['gemini',owner]]),recipeDropOutputIds:[id]};
  const monster={typeId:'future-level-4',level:4,mapId:'future-map',x:10,y:20};
  const contributors=new Map([['gemini',3]]);
  assert.equal(addRecipeDrop(room,monster,contributors,100,()=>1),null);
  const drop=addRecipeDrop(room,monster,contributors,100,()=>0);
  assert.equal(drop.itemId,recipeItemId(id));
  assert.equal(drop.shares.get('gemini'),1);
});
