import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {characterAbilities} from '../shared/character-skills.js';
import {aquariusSkillOf,aquariusAreaAt,aquariusFrameAt} from '../shared/aquarius-skills.js';
import {waterSkillOf} from '../shared/water-skills.js';
import {swanSkillOf} from '../shared/swan-skills.js';
import {ariesSkillOf} from '../shared/aries-skills.js';
import {herculesSkillOf} from '../shared/hercules-skills.js';
import {libraSkillOf} from '../shared/libra-skills.js';
import {coronaSkillOf} from '../shared/corona-skills.js';
import {capricornSkillOf} from '../shared/capricorn-skills.js';
import {leoSkillOf} from '../shared/leo-skills.js';
import {ophiuchusSkillOf} from '../shared/ophiuchus-skills.js';
import {taurusSkillOf} from '../shared/taurus-skills.js';
import {castAquarius,advanceAquarius,aquariusViews} from '../server/aquarius-skills.js';
import {castWater,advanceWaterAuras,waterAuraViews} from '../server/water-skills.js';
import {castSwan,advanceSwanAuras,swanAuraViews} from '../server/swan-skills.js';
import {castAries,advanceAriesClouds,ariesCloudViews} from '../server/aries-skills.js';
import {castHercules,advanceHerculesShields,herculesShieldViews} from '../server/hercules-skills.js';
import {castLibra,advanceLibraAuras,libraAuraViews} from '../server/libra-skills.js';
import {castCorona,advanceCorona,coronaAuraViews} from '../server/corona-skills.js';
import {castCapricorn,advanceCapricorn,capricornBlessingViews} from '../server/capricorn-skills.js';
import {castLeo,advanceLeoRoars,advanceLeoCourage} from '../server/leo-skills.js';
import {castOphiuchus,advanceOphiuchusVenoms,advanceOphiuchusPoison} from '../server/ophiuchus-skills.js';
import {startTransformation} from '../server/transformation.js';
import {monstersOf} from '../server/monsters.js';
import {playerEffectsView} from '../server/rooms.js';

const badge=['asteroid-badge',null,null];
function setup(id,level=4,equipped=true){
  const player={id:'caster',role:'student',connected:true,away:false,mapId:'star-origin-1',x:500,y:450,
    facing:{x:1,y:0},avatar:{level,constellationId:id},equipmentSlots:equipped?[...badge]:[null,null,null]};
  const room={players:new Map([[player.id,player]]),planets:new Map()};
  const original=[...monstersOf(room).values()][0],size=avatarSizeOf(player);
  const monster={...original,id:'target',x:player.x+size,y:player.y,hp:100000,maxHp:100000,
    radius:15,attackers:new Map(),contributors:new Map()};
  room.monsters=new Map([[monster.id,monster]]);
  return {room,player,monster};
}
const specs={aquarius:aquariusSkillOf,cancer:waterSkillOf,cetus:waterSkillOf,cygnus:swanSkillOf,
  aries:ariesSkillOf,hercules:herculesSkillOf,libra:libraSkillOf,'corona-borealis':coronaSkillOf,
  capricorn:capricornSkillOf,leo:leoSkillOf,ophiuchus:ophiuchusSkillOf};
test('지속형 11종 LV2~5·초월: 지속만 +1초, 쿨다운/마나/주기/횟수 그대로, 설명도 실제 수치',()=>{
  for(const [id,specOf] of Object.entries(specs))for(const level of [2,3,4,5])for(const active of [false,true]){
    const {player}=setup(id,level,false);player.transformation={active};
    const base=specOf(player),oldLines=characterAbilities(player)[1].description.split('\n');
    player.equipmentSlots=[...badge];const equipped=specOf(player);
    const keys=id==='aquarius'?['durationMs','holdMs']:id==='ophiuchus'?['poisonMs']:['durationMs'];
    const expected={...base};for(const key of keys)expected[key]+=1000;
    assert.deepEqual(equipped,expected,`${id} LV${level} transformed=${active}`);
    const lines=characterAbilities(player)[1].description.split('\n');assert.equal(lines.length,4);
    assert.deepEqual(lines.slice(2),oldLines.slice(2));
    const seconds=equipped[id==='aquarius'?'holdMs':id==='ophiuchus'?'poisonMs':'durationMs']/1000;
    assert.ok(lines[1].includes(`${seconds}초`),`${id} ${lines[1]}`);
  }
});

const auras=[
  ['cancer',castWater,advanceWaterAuras,waterAuraViews,'waterAura','waterCooldownUntil','crab-empowerment'],
  ['cetus',castWater,advanceWaterAuras,waterAuraViews,'waterAura','waterCooldownUntil','whale-defense'],
  ['cygnus',castSwan,advanceSwanAuras,swanAuraViews,'swanAura','swanCooldownUntil','swan-wings'],
  ['hercules',castHercules,advanceHerculesShields,herculesShieldViews,'herculesShield','herculesCooldownUntil','hercules-shield'],
  ['libra',castLibra,advanceLibraAuras,libraAuraViews,'libraAura','libraCooldownUntil','libra-reflect'],
  ['corona-borealis',castCorona,advanceCorona,coronaAuraViews,'coronaAura','coronaCooldownUntil','crown-aura'],
  ['capricorn',castCapricorn,advanceCapricorn,capricornBlessingViews,'capricornBlessing','capricornCooldownUntil','capricorn-blessing']
];
for(const [id,cast,advance,views,key,cooldown,statusId] of auras)test(`${id}: 장착 해제해도 +1초 상태·화면 유지, 정확한 종료와 기존 쿨다운`,()=>{
  for(const level of [2,3,4])for(const equipped of [false,true]){
    const {room,player,monster}=setup(id,level,equipped),now=Date.now(),spec=specs[id](player);
    cast(room,player,now);const end=now+spec.durationMs;
    player.equipmentSlots=equipped?[null,null,null]:[...badge];
    assert.equal(player[key].endsAt,end,'시전 시점 스냅샷');
    for(const at of [end-1000,end-1]){
      advance(room,at);assert.ok(player[key]);
      const view=views(room,player.mapId,at)[0];assert.equal(view.durationMs,spec.durationMs);
      assert.equal(view.elapsedMs,at-now);
      assert.ok(playerEffectsView(player,false,at).some(s=>s.statusId===statusId&&s.until===end));
    }
    if(id==='capricorn')assert.equal(monster.capricornCurses.get(player.id).endsAt,end);
    advance(room,end);assert.equal(player[key],null);assert.equal(views(room,player.mapId,end).length,0);
    assert.ok(!playerEffectsView(player,false,end).some(s=>s.statusId===statusId));
    assert.equal(player[cooldown],id==='cygnus'?end+10000:now+spec.cooldownMs);
    if(id==='libra')assert.equal(player.libraBuff,null);
    if(id==='capricorn')assert.equal(monster.capricornCurses.size,0);
  }
});

test('물병: 2초 성장·11초 유지(물방울 구간)·2초 소멸, 14틱과 고정된 종료/범위',()=>{
  const {room,player,monster}=setup('aquarius'),now=Date.now();
  monster.x=player.x;monster.y=player.y+avatarSizeOf(player)*.25;
  castAquarius(room,player,now);player.equipmentSlots=[];
  const [view]=aquariusViews(room,player.mapId,now);assert.equal(view.durationMs,15000);
  for(const [at,scale] of [[0,0],[1000,.5],[2000,1],[12000,1],[12999,1],[13000,1],[14000,.5],[15000,0]])
    assert.equal(aquariusAreaAt(view,at).scale,scale);
  assert.ok(aquariusFrameAt(12500,false,view)<18);assert.equal(aquariusFrameAt(13000,false,view),18);
  const [state]=room.aquariusCasts.values();
  assert.equal(advanceAquarius(room,now+14999).length,14);
  assert.equal(monster.hp,100000-Math.floor(state.power*14/5));assert.equal(room.aquariusCasts.size,1);
  assert.equal(aquariusViews(room,player.mapId,now+14999).length,1);
  assert.deepEqual(advanceAquarius(room,now+15000),[]);assert.equal(room.aquariusCasts.size,0);
  assert.equal(player.aquariusCooldownUntil,now+20000);
  const plain=setup('aquarius',4,false);castAquarius(plain.room,plain.player,now);plain.player.equipmentSlots=[...badge];
  advanceAquarius(plain.room,now+14000);assert.equal(plain.room.aquariusCasts.size,0,'발동 후 장착은 연장하지 않음');
});

test('양: 수면과 구름/마지막 타격이 6초 경계까지 유지되며 발동 뒤 장비 변경 무관',()=>{
  for(const equipped of [false,true]){
    const {room,player,monster}=setup('aries',4,equipped),now=Date.now(),duration=equipped?6000:5000;
    castAries(room,player,now);player.equipmentSlots=equipped?[]:[...badge];
    assert.equal(monster.sleepUntil,now+duration);
    assert.deepEqual(advanceAriesClouds(room,now+duration-1),[]);assert.equal(monster.hp,100000);
    assert.equal(ariesCloudViews(room,player.mapId,now+duration-1)[0].durationMs,duration);
    assert.equal(advanceAriesClouds(room,now+duration).length,1);assert.ok(monster.hp<100000);
    assert.equal(room.ariesClouds.size,0);assert.equal(ariesCloudViews(room,player.mapId,now+duration).length,0);
    assert.equal(player.ariesCooldownUntil,now+20000);
  }
});

test('사자: 3초 포효 연출 유지, 시전 때 정한 11초 용기를 시전자·아군에게 부여',()=>{
  for(const equipped of [false,true]){
    const {room,player}=setup('leo',4,equipped),now=Date.now();
    const friend={...player,id:'friend',avatar:{level:4,constellationId:'aries'},equipmentSlots:equipped?[]:[...badge]};
    room.players.set(friend.id,friend);
    const result=castLeo(room,player,now);assert.equal(result.visual.durationMs,3000);
    player.equipmentSlots=equipped?[]:[...badge];advanceLeoRoars(room,now+1600);
    const end=now+1600+(equipped?11000:10000);
    for(const target of [player,friend])assert.equal(target.leoCourage.endsAt,end);
    advanceLeoCourage(room,end-1);
    assert.ok(playerEffectsView(friend,false,end-1).some(s=>s.statusId==='leo-courage'&&s.until===end));
    advanceLeoCourage(room,end);assert.equal(player.leoCourage,null);assert.equal(friend.leoCourage,null);
    assert.equal(player.leoCooldownUntil,now+10000);
  }
});

test('뱀: 최초 중독만 +1초·초당 피해 유지, 재중독은 장비와 무관하게 기존 +3초',()=>{
  for(const level of [2,3,4])for(const equipped of [false,true]){
    const {room,player,monster}=setup('ophiuchus',level,equipped),now=Date.now();
    const result=castOphiuchus(room,player,now);assert.equal(result.hit.durationMs,4000);
    player.equipmentSlots=equipped?[]:[...badge];advanceOphiuchusVenoms(room,now+1000);
    const end=now+1000+level*2000+(equipped?1000:0);assert.equal(monster.combatPoison.expiresAt,end);
    advanceOphiuchusPoison(room,end-1);assert.ok(monster.combatPoison);
    const before=monster.hp;advanceOphiuchusPoison(room,end);assert.equal(monster.combatPoison,null);assert.ok(monster.hp<before);
    assert.equal(player.ophiuchusCooldownUntil,now+5000);
  }
  const {room,player,monster}=setup('ophiuchus'),now=Date.now();
  castOphiuchus(room,player,now);advanceOphiuchusVenoms(room,now+1000);const end=monster.combatPoison.expiresAt;
  for(const [index,equipped] of [false,true].entries()){
    const other={...player,id:`other-${index}`,equipmentSlots:equipped?[...badge]:[],ophiuchusCooldownUntil:0,battleVitals:undefined};
    room.players.set(other.id,other);castOphiuchus(room,other,now+2000+index*1000);
    advanceOphiuchusVenoms(room,now+3000+index*1000);
    assert.equal(monster.combatPoison.expiresAt,end+(index+1)*3000);
  }
});

test('백조: 연장해도 10회 Q에서 종료하고 그때부터 10초 재사용',()=>{
  const {room,player}=setup('cygnus'),now=Date.now();castSwan(room,player,now);player.equipmentSlots=[];
  assert.equal(player.swanAura.remainingAttacks,10);
  for(let i=1;i<=10;i++)castSwan(room,player,now+i*100,{basic:true});
  assert.equal(player.swanAura,null);assert.equal(player.swanCooldownUntil,now+11000);
  assert.throws(()=>castSwan(room,player,now+10999),/기다려/);
  castSwan(room,player,now+11000);assert.equal(player.swanAura.endsAt,now+31000);
});

test('황소 전체·순수 투사체 E·일반 공격·30초 초월은 지속 장비와 무관',()=>{
  for(const id of ['taurus','pisces','gemini','sagittarius','corvus']){
    const {player}=setup(id,4,false),plain=characterAbilities(player);
    const dash=id==='taurus'?taurusSkillOf(player):null;
    player.equipmentSlots=[...badge];assert.deepEqual(characterAbilities(player),plain);
    if(dash)assert.deepEqual(taurusSkillOf(player),dash);
  }
  for(const [id,cast] of [['aquarius',castAquarius],['cancer',castWater],['cygnus',castSwan],['ophiuchus',castOphiuchus]]){
    const {room,player}=setup(id);assert.equal(cast(room,player,Date.now(),{basic:true}).hit.durationMs,650);
  }
  const {player}=setup('hercules',5),now=Date.now();
  startTransformation(player,now);assert.equal(player.transformation.endsAt,now+30000);
});
