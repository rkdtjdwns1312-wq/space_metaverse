import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentBonus} from '../shared/equipment.js';
import {skillDamageFactor} from '../shared/skill-damage.js';
import {attackPowerOf} from '../shared/combat.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {characterAbilities} from '../shared/character-skills.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals,damagePlayer} from '../server/vitals.js';
import {advanceProjectiles} from '../server/projectiles.js';
import {combatEnemies,damageTargets,castSagittarius,attackSagittarius} from '../server/sagittarius-skills.js';
import {castCorvus} from '../server/corvus-skills.js';
import {castGemini} from '../server/gemini-skills.js';
import {castWater,advanceWaterAuras,resolveWaterHit} from '../server/water-skills.js';
import {castSwan} from '../server/swan-skills.js';
import {castAquarius,advanceAquarius} from '../server/aquarius-skills.js';
import {castAries,advanceAriesClouds} from '../server/aries-skills.js';
import {castOphiuchus,advanceOphiuchusVenoms,advanceOphiuchusPoison} from '../server/ophiuchus-skills.js';
import {castTaurus} from '../server/taurus-skills.js';
import {castHercules,advanceHerculesShields} from '../server/hercules-skills.js';
import {castCorona,advanceCorona} from '../server/corona-skills.js';
import {castCapricorn,advanceCapricorn} from '../server/capricorn-skills.js';
import {castLeo,advanceLeoRoars} from '../server/leo-skills.js';
import {castLibra} from '../server/libra-skills.js';
import {reflectLibraDamage} from '../server/area-combat.js';

const gloves=['star-pattern-gloves',null,null];
function setup(id,{equipped=false,level=4,transformed=false}={}){
  const player={id:'caster',role:'student',connected:true,away:false,mapId:'star-origin-1',x:500,y:450,
    facing:{x:1,y:0},avatar:{level,constellationId:id},transformation:{active:transformed},equipmentSlots:equipped?[...gloves]:[]};
  const room={players:new Map([[player.id,player]]),planets:new Map()},size=avatarSizeOf(player);
  const original=[...monstersOf(room).values()][0];
  // 실제 피해를 반올림까지 직접 비교할 수 있게 방어력 0인 시작점 몬스터를 사용합니다.
  const monster={...original,id:'target',typeId:'test-no-art',level:1,x:500+size,y:450,hp:100000,maxHp:100000,
    radius:15,attackers:new Map(),contributors:new Map()};
  room.monsters=new Map([[monster.id,monster]]);
  return {room,player,monster};
}
function toggle(player,equipped){player.equipmentSlots=equipped?[]:[...gloves];}
const powers={
  corvus:(room,p,now)=>{castCorvus(room,p,now);return room.projectiles[0].power;},
  gemini:(room,p,now)=>{castGemini(room,p,now);return room.projectiles[0].power;},
  sagittarius:(room,p,now)=>{castSagittarius(room,p,0,now);return room.projectiles[0].power;},
  pisces:(room,p,now)=>{castWater(room,p,now);return room.projectiles[0].power;},
  aquarius:(room,p,now)=>{castAquarius(room,p,now);return [...room.aquariusCasts.values()][0].power;},
  aries:(room,p,now)=>{castAries(room,p,now);return [...room.ariesClouds.values()][0].power;},
  taurus:(room,p,now)=>{castTaurus(room,p,now);return p.taurusDash.power;},
  leo:(room,p,now)=>{castLeo(room,p,now);return room.leoRoars[0].power;}
};
test('장갑은 공격력 stat 대신 E 피해20%만 추가하며 지속 배지와 독립',()=>{
  const {player}=setup('gemini');const base=attackPowerOf(4,'gemini',player);
  player.equipmentSlots=[...gloves];assert.equal(equipmentBonus(player).skillDamage,.2);
  assert.equal(skillDamageFactor(player),1.2);assert.equal(attackPowerOf(4,'gemini',player),base);
  player.equipmentSlots=['star-pattern-gloves','asteroid-badge',null];
  assert.equal(skillDamageFactor(player),1.2);assert.equal(equipmentBonus(player).durationMs,1000);
});
test('직접 E 8종 LV2~5: 변신 보정 뒤 피해1.2배, 마나·쿨다운·Q 설명은 동일',()=>{
  for(const [id,castPower] of Object.entries(powers))for(const level of [2,3,4,5]){
    const plain=setup(id,{level,transformed:level===5}),boosted=setup(id,{level,transformed:level===5,equipped:true}),now=Date.now();
    const base=castPower(plain.room,plain.player,now),power=castPower(boosted.room,boosted.player,now);
    assert.equal(power,Math.round(base*1.2),`${id} LV${level}`);
    assert.equal(ensureVitals(plain.player).mp,ensureVitals(boosted.player).mp);
    const [q,e]=characterAbilities(boosted.player),[oldQ,oldE]=characterAbilities(plain.player);
    assert.deepEqual(q,oldQ);assert.equal(e.description.split('\n').length,4);
    assert.ok(e.description.includes('×1.2'));assert.deepEqual(e.description.split('\n').slice(2),oldE.description.split('\n').slice(2));
  }
});
test('E 투사체는 서버 시전 시 피해 스냅샷, 이후 장착/해제는 비행 중 피해에 영향 없음',()=>{
  for(const id of ['corvus','gemini','sagittarius','pisces'])for(const equipped of [false,true]){
    const {room,player,monster}=setup(id,{equipped}),now=Date.now();powers[id](room,player,now);
    const expected=room.projectiles.reduce((sum,p)=>sum+p.power,0);toggle(player,equipped);
    advanceProjectiles(room,now+3000,combatEnemies,damageTargets);
    assert.equal(100000-monster.hp,expected,id);
  }
});
test('일반 및 E로 강화된 게·고래·백조·왕관 Q 원타격은 장갑 보정 없음',()=>{
  const basicCasts={corvus:castCorvus,gemini:castGemini,aquarius:castAquarius,aries:castAries,ophiuchus:castOphiuchus,
    taurus:castTaurus,hercules:castHercules,libra:castLibra,capricorn:castCapricorn,leo:castLeo,
    cancer:castWater,cetus:castWater,cygnus:castSwan,'corona-borealis':castCorona};
  for(const [id,cast] of Object.entries(basicCasts)){
    const outcomes=[];
    for(const equipped of [false,true]){
      const {room,player,monster}=setup(id,{equipped}),now=Date.now();
      if(['cancer','cetus','cygnus','corona-borealis'].includes(id))cast(room,player,now);
      const hit=cast(room,player,now+100,{basic:true});
      outcomes.push(room.projectiles?.length?room.projectiles.map(p=>p.power):hit.targets.map(t=>t.damage));
    }
    assert.deepEqual(outcomes[1],outcomes[0],id);
  }
  for(const equipped of [false,true]){
    const {room,player}=setup('sagittarius',{equipped});attackSagittarius(room,player,Date.now());
    assert.equal(room.projectiles[0].power,attackPowerOf(4,'sagittarius',player));
  }
});
test('물병 피해만 증가하고 기존 회복 총량·주기는 그대로',()=>{
  const healed=[];
  for(const equipped of [false,true]){
    const {room,player,monster}=setup('aquarius',{equipped}),now=Date.now();monster.x=player.x;monster.y=player.y+avatarSizeOf(player)*.25;
    ensureVitals(player).hp=1;castAquarius(room,player,now);const cast=[...room.aquariusCasts.values()][0];
    toggle(player,equipped);advanceAquarius(room,now+5000);
    assert.equal(100000-monster.hp,cast.power);healed.push(ensureVitals(player).hp);
  }
  assert.equal(healed[1],healed[0]);
});
test('게 강화 Q의 아군 회복은 장갑과 무관',()=>{
  const healed=[];
  for(const equipped of [false,true]){
    const {room,player}=setup('cancer',{equipped}),now=Date.now();castWater(room,player,now);
    const ally={...player,id:'friend',battleVitals:undefined};ensureVitals(ally).hp=1;
    castWater(room,player,now+1,{basic:true});const cast=room.projectiles[0];
    resolveWaterHit(room,player,[{kind:'player',entity:ally}],cast.power,now+2,cast);healed.push(ensureVitals(ally).hp);
  }
  assert.equal(healed[1],healed[0]);
});
test('고래 자동 E는 발동 당시 피해 배율, 방어력은 동일',()=>{
  for(const equipped of [false,true]){
    const {room,player,monster}=setup('cetus',{equipped}),now=Date.now();
    const power=attackPowerOf(4,'cetus',player);castWater(room,player,now);toggle(player,equipped);
    assert.equal(player.waterAura.defenseBonus,3);advanceWaterAuras(room,now+1000);
    assert.equal(100000-monster.hp,Math.round(power*(equipped?1.2:1)));
  }
});
test('뱀 직접 피해와 독틱 모두 시전 스냅샷, 염소 저주만 증가하고 축복 회복 유지',()=>{
  const heals=[];
  for(const equipped of [false,true]){
    const snake=setup('ophiuchus',{equipped}),now=Date.now(),factor=equipped?1.2:1;
    const power=attackPowerOf(4,'ophiuchus',snake.player);castOphiuchus(snake.room,snake.player,now);toggle(snake.player,equipped);
    advanceOphiuchusVenoms(snake.room,now+1000);assert.equal(100000-snake.monster.hp,Math.round(power*3*factor));
    const before=snake.monster.hp;advanceOphiuchusPoison(snake.room,now+2000);assert.equal(before-snake.monster.hp,Math.round(power*factor));
    const goat=setup('capricorn',{equipped});ensureVitals(goat.player).hp=1;
    const cursePower=attackPowerOf(4,'capricorn',goat.player);castCapricorn(goat.room,goat.player,now);toggle(goat.player,equipped);
    advanceCapricorn(goat.room,now+2000);assert.equal(100000-goat.monster.hp,Math.round(cursePower*factor));
    advanceCapricorn(goat.room,now+5000);heals.push(ensureVitals(goat.player).hp);
  }
  assert.equal(heals[1],heals[0]);
});
test('헤라클레스: 흡수한 피해를 포함한 폭발 전체에 1회만 보정, 보호막HP는 동일',()=>{
  for(const equipped of [false,true]){
    const {room,player,monster}=setup('hercules',{equipped}),now=Date.now();castHercules(room,player,now);
    const shield=player.herculesShield;assert.equal(shield.hp,ensureVitals(player).hp);
    damagePlayer(player,20,now+1);assert.ok(shield.absorbed>0);
    const expected=Math.round((shield.power+shield.absorbed)*(equipped?1.2:1));toggle(player,equipped);
    advanceHerculesShields(room,shield.endsAt);assert.equal(100000-monster.hp,expected);
  }
});
test('왕관: 원Q 제외, 추가 낙검과 종료 검기만 시전 시 배율 적용',()=>{
  for(const equipped of [false,true]){
    const {room,player,monster}=setup('corona-borealis',{equipped}),now=Date.now();castCorona(room,player,now);
    const end=player.coronaAura.endsAt;toggle(player,equipped);
    const power=attackPowerOf(4,'corona-borealis',player),boosted=Math.round(power*(equipped?1.2:1));
    castCorona(room,player,now+1,{basic:true});assert.equal(100000-monster.hp,power);
    advanceCorona(room,now+301);assert.equal(100000-monster.hp,power+boosted);
    advanceCorona(room,end);assert.equal(room.projectiles[0].power,boosted);
    advanceProjectiles(room,end+650,combatEnemies,damageTargets);assert.equal(100000-monster.hp,power+boosted*2);
  }
});
test('천칭 반사만20% 증가하고 천칭·사자 공격력 버프 증가는 그대로',()=>{
  for(const equipped of [false,true]){
    const {room,player,monster}=setup('libra',{equipped}),now=Date.now();castLibra(room,player,now);
    assert.equal(player.libraAura.attackBonus,3);const base={...player,libraAura:{...player.libraAura,skillDamageFactor:1}};
    const original=damagePlayer(base,20,now+1).reflectedDamage;toggle(player,equipped);
    const reflected=damagePlayer(player,20,now+1).reflectedDamage;
    assert.equal(reflected,Math.round(original*(equipped?1.2:1)));
    reflectLibraDamage(room,player,{sourceMonsterId:monster.id},reflected,now+1);assert.equal(100000-monster.hp,reflected);
    const lion=setup('leo',{equipped});castLeo(lion.room,lion.player,now);toggle(lion.player,equipped);
    advanceLeoRoars(lion.room,now+1600);assert.equal(lion.player.leoCourage.bonus,4);
  }
});
