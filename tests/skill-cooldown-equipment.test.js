import test from 'node:test';
import assert from 'node:assert/strict';
import {characterAbilities,TRANSFORMATION} from '../shared/character-skills.js';
import {transformationBonus} from '../shared/transformation.js';
import {equipmentBonus} from '../shared/equipment.js';
import {skillDamageFactor} from '../shared/skill-damage.js';
import {attackPowerOf,ATTACK_VISUAL} from '../shared/combat.js';
import {SAGITTARIUS_ATTACK} from '../shared/sagittarius-skills.js';
import {aquariusSkillOf} from '../shared/aquarius-skills.js';
import {swanSkillOf} from '../shared/swan-skills.js';
import {castAquarius} from '../server/aquarius-skills.js';
import {castWater} from '../server/water-skills.js';
import {castSwan,advanceSwanAuras,swanCooldowns} from '../server/swan-skills.js';
import {castAries} from '../server/aries-skills.js';
import {castHercules} from '../server/hercules-skills.js';
import {castLibra} from '../server/libra-skills.js';
import {castCorona} from '../server/corona-skills.js';
import {castCapricorn} from '../server/capricorn-skills.js';
import {castLeo} from '../server/leo-skills.js';
import {castOphiuchus} from '../server/ophiuchus-skills.js';
import {castTaurus} from '../server/taurus-skills.js';
import {castCorvus} from '../server/corvus-skills.js';
import {castGemini} from '../server/gemini-skills.js';
import {castSagittarius} from '../server/sagittarius-skills.js';
import {startTransformation} from '../server/transformation.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';

const casts={aquarius:castAquarius,cancer:castWater,cetus:castWater,pisces:castWater,cygnus:castSwan,
  aries:castAries,hercules:castHercules,libra:castLibra,'corona-borealis':castCorona,capricorn:castCapricorn,
  leo:castLeo,ophiuchus:castOphiuchus,taurus:castTaurus,corvus:castCorvus,gemini:castGemini,
  sagittarius:(room,player,now)=>castSagittarius(room,player,0,now)};
const cooldownOf=player=>Number(characterAbilities(player)[1].description.match(/쿨타임: (?:종료 후 )?([\d.]+)초/)[1])*1000;
test('달 귀걸이 30%와 장화10%는 합산, 얼음 목걸이의 피해·지속은 독립하며 시전 뒤 해제해도 유지',()=>{
  for(const id of Object.keys(casts)){
    const {player}=setup(id),base=cooldownOf(player);
    player.equipmentSlots=['moon-earring'];assert.equal(cooldownOf(player),Math.round(base*.7));
    player.equipmentSlots=['moon-earring','meteor-boots','burning-ice-necklace'];
    assert.equal(cooldownOf(player),Math.round(base*.6));
  }
  const {room,player}=setup('aquarius'),now=Date.now();
  player.equipmentSlots=['moon-earring','meteor-boots','burning-ice-necklace'];
  const spec=aquariusSkillOf(player),power=attackPowerOf(4,'aquarius',player);
  assert.equal(spec.holdMs,12000);assert.equal(spec.cooldownMs,12000);
  castAquarius(room,player,now);player.equipmentSlots=[];
  const cast=[...room.aquariusCasts.values()][0];
  assert.equal(cast.durationMs,16000);assert.equal(cast.power,Math.round(power*spec.multiplier*1.3));
  assert.equal(player.aquariusCooldownUntil,now+12000);
  player.equipmentSlots=['asteroid-badge','burning-ice-necklace'];assert.equal(aquariusSkillOf(player).holdMs,13000);
  assert.equal(characterAbilities(player)[2].description.includes('120초'),true);
});
function setup(id,level=4,equipped=false){
  const player={id:'caster',role:'student',connected:true,mapId:'star-origin-1',x:500,y:450,
    facing:{x:1,y:0},avatar:{level,constellationId:id},equipmentSlots:equipped?['meteor-boots',null,null]:[]};
  const room={players:new Map([[player.id,player]]),planets:new Map()};
  const original=[...monstersOf(room).values()][0];
  room.monsters=new Map([[original.id,{...original,x:600,y:450,hp:100000,maxHp:100000}]]);
  return {room,player};
}
test('유성 장화: 16종 E 설명에 10% 감소, 생산계 초월50%와 곱적용·Q/초월 제외',()=>{
  for(const id of Object.keys(casts))for(const level of [2,3,4,5]){
    const {player}=setup(id,level),base=cooldownOf(player),plain=characterAbilities(player);
    player.equipmentSlots=['meteor-boots',null,null];
    assert.equal(equipmentBonus(player).cooldownReduction,.1);
    assert.equal(equipmentBonus(player).speed,.2);
    assert.equal(cooldownOf(player),Math.round(base*.9),`${id} LV${level}`);
    assert.deepEqual(characterAbilities(player)[0],plain[0]);
    assert.deepEqual(characterAbilities(player)[2],plain[2]);
    player.transformation={active:true};
    assert.equal(cooldownOf(player),Math.round(base*transformationBonus(player).skillCooldownFactor*.9));
  }
  const {player}=setup('aquarius',5,true);player.transformation={active:true};
  assert.equal(aquariusSkillOf(player).cooldownMs,9000);
  assert.equal(ATTACK_VISUAL.cooldownMs,1000);assert.equal(SAGITTARIUS_ATTACK.cooldownMs,1000);
  assert.equal(TRANSFORMATION.cooldownMs,120000);
});
test('16종 E 서버 쿨타임은 시전 스냅샷·장착/해제 소급 없음·재시전 정확한 경계',()=>{
  for(const [id,cast] of Object.entries(casts))for(const equipped of [false,true]){
    const {room,player}=setup(id,4,equipped),now=Date.now(),duration=cooldownOf(player);
    const result=cast(room,player,now);let readyAt=now+(id==='capricorn'?Math.round(duration/2):duration);
    player.equipmentSlots=equipped?[]:['meteor-boots',null,null];
    if(id==='cygnus'){
      const end=player.swanAura.endsAt;assert.equal(player.swanAura.cooldownMs,duration);
      advanceSwanAuras(room,end);readyAt=end+duration;assert.equal(swanCooldowns(player,end)[0],readyAt);
    }else assert.equal(result.cooldowns[0],readyAt,id);
    assert.throws(()=>cast(room,player,readyAt-1),/기다려|스킬/,id);
    const nextDuration=cooldownOf(player),next=cast(room,player,readyAt);
    assert.equal(next.ready,true,id);
    if(id==='cygnus')assert.equal(player.swanAura.cooldownMs,nextDuration);
    else assert.equal(next.cooldowns[0],readyAt+(id==='capricorn'?Math.round(nextDuration/2):nextDuration),id);
  }
});
test('백조 10번째 Q/시간만료/취소 종료 모두 발동 당시 재사용 시간, 대기 중 변경도 무관',()=>{
  for(const ending of ['ten-attacks','timeout','cancel'])for(const equipped of [false,true]){
    const {room,player}=setup('cygnus',5,equipped),now=Date.now();player.transformation={active:true};
    const spec=swanSkillOf(player);castSwan(room,player,now);
    player.equipmentSlots=equipped?[]:['meteor-boots',null,null];player.transformation={active:false};
    const finish=ending==='timeout'?now+spec.durationMs:now+10000;
    if(ending==='ten-attacks')for(let i=1;i<=10;i++)castSwan(room,player,now+i*1000,{basic:true});
    else{if(ending==='cancel')player.away=true;advanceSwanAuras(room,finish);player.away=false;}
    assert.equal(player.swanAura,null);assert.equal(player.swanCooldownUntil,finish+spec.cooldownMs);
    player.equipmentSlots=equipped?['meteor-boots',null,null]:[];
    assert.throws(()=>castSwan(room,player,finish+spec.cooldownMs-1),/기다려/);
    ensureVitals(player).mp=30;assert.equal(castSwan(room,player,finish+spec.cooldownMs).ready,true);
  }
});
test('생산계 E 감소는 시전 후 초월 종료/장비 해제로 소급되지 않으며 초월120초 유지',()=>{
  const {room,player}=setup('aquarius',5,true),now=Date.now();startTransformation(player,now);
  assert.equal(player.transformation.cooldownUntil,now+120000);
  castAquarius(room,player,now);assert.equal(player.aquariusCooldownUntil,now+9000);
  player.transformation.active=false;player.equipmentSlots=[];
  assert.throws(()=>castAquarius(room,player,now+8999),/기다려/);
  castAquarius(room,player,now+9000);assert.equal(player.aquariusCooldownUntil,now+29000);
});
test('은하수 나침반 ATK+1과 E피해20%는 분리·장갑과 합산40%, Q는 ATK만 반영',()=>{
  const {room,player}=setup('gemini'),now=Date.now(),base=attackPowerOf(4,'gemini',player);
  player.equipmentSlots=['galaxy-compass',null,null];
  assert.equal(attackPowerOf(4,'gemini',player),base+1);assert.equal(skillDamageFactor(player),1.2);
  player.equipmentSlots=['galaxy-compass','star-pattern-gloves','meteor-boots'];
  assert.equal(attackPowerOf(4,'gemini',player),base+1);assert.equal(skillDamageFactor(player),1.4);
  const q=castGemini(room,player,now,{basic:true});assert.equal(q.hit.power,base+1);
  const e=castGemini(room,player,now);assert.equal(e.hit.power,Math.round((base+1)*6*1.4));
  assert.equal(e.cooldowns[0],now+7200);assert.ok(characterAbilities(player)[1].description.includes('×1.4'));
});
