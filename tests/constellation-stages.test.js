import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClassroomServer} from '../server/app.js';
import {CONSTELLATIONS,constellationOf} from '../shared/constellations.js';
import {MAP,STREET,STREET_ID,VALLEY,VALLEY_ID,SHARDS} from '../shared/config.js';
import {freshAbilityState,validateAbilityState} from '../server/constellation-abilities.js';
import {toRecord,fromRecord,pinHash} from '../server/persistent-rooms.js';

const savedPending=(f,pending)=>{f.p.abilityState={...freshAbilityState(),usedWeek:'2026-09-14',usedCount:1,pending:{week:'2026-09-14',...pending}};};
const call=(socket,event,data={})=>socket.timeout(4000).emitWithAck(event,data);
test('Lv2 고래·게 이미지가 서로 뒤바뀌지 않는다 (원본 대조 후 확정한 그림)',()=>{
  // 경로 문자열 검사만으로는 내용이 뒤바뀐 PNG를 찾을 수 없어 시각 검수한 두 파일을 고정합니다.
  // 그림을 새로 제작할 때는 원본 카드와 대조한 뒤 이 해시도 함께 갱신하세요.
  for(const [id,hash] of [
    ['cetus','726344231d5225ce76903965ba9df7c6ea4abdc7fc2a0335b02153b3be8be774'],
    ['cancer','d8e0ee6e029fef1a0cc3534ac21cc045c1c4e990db63b49f7fc0e432e9dce106']
  ])assert.equal(createHash('sha256').update(readFileSync('client'+constellationOf(id,2).sprite)).digest('hex'),hash,id);
});
async function fixture(t){
  let now=Date.parse('2026-09-18T04:00:00Z'),dice=[];
  const game=createClassroomServer({teacherKey:'stage-test-private-key',studentHours:false,clock:()=>now,abilityDie:()=>{
    assert.ok(dice.length,'예정한 주사위만 사용해야 한다');return dice.shift();
  }});
  const {port}=await game.listen(),sockets=[];
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});
  async function connect(){const socket=io('http://127.0.0.1:'+port,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(socket);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;}
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:'stage-test-private-key',title:'진화 단계 시험',allowedNames:['별이','달이']});
  const student=await connect(),joined=await call(student,'room:join',{code:created.room.code,nickname:'별이'});
  const room=game.store.rooms.get(created.room.code),p=room.players.get(joined.selfId);
  const as=(id,level)=>{Object.assign(p.avatar,{constellationId:id,form:'constellation',level,xp:0});p.abilityState=freshAbilityState();delete p.constellationAbilityState;};
  return {game,room,p,student,teacher,as,rolls:(...values)=>{dice=values;},setNow:value=>now=value};
}

test('16 계보의 Lv2/3/4 그림과 능력은 각각 다르고 PNG 파일이 실제 존재한다',()=>{
  for(const value of CONSTELLATIONS){
    const sprites=new Set(),cards=new Set(),descriptions=new Set();
    for(const level of [2,3,4]){
      const stage=constellationOf(value.id,level);assert.equal(stage.assetLevel,level);
      for(const [field,hashes] of [['sprite',sprites],['art',cards]]){
        const bytes=readFileSync(new URL('../client'+stage[field],import.meta.url));
        assert.equal(bytes.subarray(1,4).toString(),'PNG');hashes.add(createHash('sha256').update(bytes).digest('hex'));
      }
      descriptions.add(stage.ability.description);
    }
    assert.equal(sprites.size,3,value.id);assert.equal(cards.size,3,value.id);assert.equal(descriptions.size,3,value.id);
  }
  assert.equal(constellationOf('leo',5).assetLevel,5);assert.equal(constellationOf('orion',4).legacy,true);
});

test('물병 Lv3/4 지급과 상한을 서버가 결정하고 진화/변경해도 주간 재사용 불가',async t=>{
  const f=await fixture(t);
  for(const [lv,reward] of [[3,2],[4,4]]){f.as('aquarius',lv);f.p.starShards=0;
    const r=await call(f.student,'ability:use',{level:99,reward:999});assert.ok(r.ok,r.error);assert.equal(r.reward,reward);assert.equal(f.p.starShards,reward);
    f.p.avatar.level=4;assert.equal((await call(f.student,'ability:use')).ok,false);
    f.p.avatar.constellationId='capricorn';assert.equal((await call(f.student,'ability:use')).ok,false);
  }
  f.as('aquarius',4);f.p.starShards=SHARDS.max-3;
  assert.equal((await call(f.student,'ability:use')).ok,false);assert.equal(f.p.abilityState.usedWeek,null);
  assert.equal((await call(f.teacher,'ability:use')).ok,false);
});

test('Lv3/4 염소·황소의 주사위 1~6 보상/차감은 카드 수치와 일치한다',async t=>{
  const f=await fixture(t);
  for(const [id,lv,expected] of [['capricorn',3,[0,0,2,2,4,4]],['capricorn',4,[2,2,4,4,6,6]],['taurus',3,[6,-2,6,-2,6,-2]],['taurus',4,[9,-3,9,-3,9,-3]]]){
    for(let roll=1;roll<=6;roll++){f.as(id,lv);f.p.starShards=20;f.rolls(roll);
      const r=await call(f.student,'ability:use',{roll:99});assert.ok(r.ok,r.error);assert.equal(r.roll,roll);assert.equal(f.p.starShards,20+expected[roll-1]);}
  }
  f.as('taurus',4);f.p.starShards=2;assert.equal((await call(f.student,'ability:use')).ok,false);
});

test('Lv3 쌍둥이는 레벨 대신 가격4 이하만 복사하며 대기 보상을 진화가 강화하지 않는다',async t=>{
  const f=await fixture(t);f.as('gemini',3);f.p.starShards=100;
  savedPending(f,{mode:'shop-copy',maxPrice:4});
  const shop=STREET.objects.find(o=>o.kind==='shop');Object.assign(f.p,{mapId:STREET_ID,x:shop.x,y:shop.y});
  f.p.avatar.level=4;
  assert.equal((await call(f.student,'shop:buy',{itemId:'meteor-fragment-card',quantity:1})).copiedItem,'운석 파편');
  assert.equal((await call(f.student,'shop:buy',{itemId:'alien-card',quantity:1})).copiedItem,null);
  assert.equal(f.p.inventory.find(i=>i.id==='alien-card').quantity,1);assert.equal(f.p.abilityState.pending,null);
});

test('Lv3/4 까마귀 제작은 가격·Lv·종류 수·중복 제작 제한과 주간 만료를 지킨다',async t=>{
  const f=await fixture(t);f.as('corvus',3);f.rolls(3);
  savedPending(f,{mode:'value-item',budget:3,maxLevel:2,picks:1,roll:3,selected:[]});
  assert.equal((await call(f.student,'ability:choose-item',{itemId:'alien-card',budget:100})).ok,false);
  assert.ok((await call(f.student,'ability:choose-item',{itemId:'space-food-card'})).ok);assert.equal(f.p.abilityState.pending,null);
  f.as('corvus',4);savedPending(f,{mode:'value-item',budget:12,maxLevel:5,picks:2,roll:6,selected:[]});assert.equal(f.p.abilityState.pending.budget,12);
  assert.equal((await call(f.student,'ability:choose-item',{itemId:'starlight-cape'})).ok,false);
  assert.ok((await call(f.student,'ability:choose-item',{itemId:'star-sticker'})).ok);
  assert.equal(f.p.abilityState.pending.budget,7);assert.equal(f.p.abilityState.pending.picks,1);
  assert.equal((await call(f.student,'ability:choose-item',{itemId:'star-sticker'})).ok,false);
  assert.ok((await call(f.student,'ability:choose-item',{itemId:'asteroid-helmet'})).ok);assert.equal(f.p.abilityState.pending,null);
  assert.equal((await call(f.student,'ability:choose-item',{itemId:'little-sun-card'})).ok,false);
  f.as('corvus',4);savedPending(f,{mode:'value-item',budget:4,maxLevel:5,picks:2,roll:2,selected:[]});f.setNow(Date.parse('2026-09-20T15:00:00Z'));
  assert.equal((await call(f.student,'ability:choose-item',{itemId:'little-sun-card'})).ok,false);
});

test('기존 천칭 차이0 대기는 재시도 비용2와 일회 지급을 유지하고 신규 사용은 차단한다',async t=>{
 const f=await fixture(t);f.as('libra',3);f.p.starShards=10;f.rolls(6,1);savedPending(f,{mode:'dice-retry'});
 const retry=await call(f.student,'ability:retry');assert.ok(retry.ok,retry.error);assert.equal(f.p.starShards,13);assert.equal(f.p.abilityState.pending,null);
 assert.equal((await call(f.student,'ability:retry')).ok,false);assert.equal((await call(f.student,'ability:use')).ok,false);
});

test('수동 능력은 사용 당시 Lv로 교사 기둥에 남으며 Lv4 천칭에 Lv2 XP를 잘못 주지 않는다',async t=>{
  const f=await fixture(t);f.as('libra',4);f.p.abilityState.markers=[{id:'old-libra4',constellationId:'libra',level:4,at:0,note:'주사위 3번 · 별 카드 확인',targetName:''}];
  const marker=f.p.abilityState.markers[0];f.p.avatar.level=5;f.p.avatar.constellationId='leo';
  const pillar=MAP.objects.find(o=>o.id==='pillar-effects');const teacher=[...f.room.players.values()].find(p=>p.role==='teacher');Object.assign(teacher,{x:pillar.x,y:pillar.y});
  const board=await call(f.teacher,'temple:read',{objectId:pillar.id}),row=board.rows.find(r=>r.abilityMarkerId===marker.id);
  assert.equal(row.abilityLevel,4);assert.match(row.description,/3번/);
  const input={objectId:pillar.id,targetId:f.p.id,abilityMarkerId:marker.id};
  assert.equal((await call(f.student,'ability:complete',input)).ok,false);
  assert.equal((await call(f.teacher,'ability:complete',{...input,xpAmount:2})).ok,false);
  assert.ok((await call(f.teacher,'ability:complete',input)).ok);assert.equal(f.p.avatar.xp,0);
});

test('Lv3→4 진화는 경험치0·계보 유지, 저장/복원은 단계와 능력 대기를 보존한다',async t=>{
  const f=await fixture(t);f.as('corvus',3);f.p.avatar.xp=25;savedPending(f,{mode:'value-item',budget:5,maxLevel:2,picks:1,roll:5,selected:[]});
  const star=VALLEY.objects.find(o=>o.id==='evolution-star');Object.assign(f.p,{mapId:VALLEY_ID,x:star.x,y:star.y});
  const evolved=await call(f.student,'evolution:evolve',{constellationId:'corvus'});assert.ok(evolved.ok,evolved.error);
  assert.equal(evolved.avatar.level,4);assert.equal(evolved.avatar.xp,0);
  assert.match(evolved.options.find(o=>o.current).sprite,/lv4/);
  f.p.pin=pinHash('1234');f.room.createdAt=Date.parse('2026-09-18T04:00:00Z');
  const restored=fromRecord(toRecord(f.room)).players.get(f.p.id);
  assert.equal(restored.avatar.level,4);assert.deepEqual(restored.abilityState,f.p.abilityState);
  assert.equal(restored.abilityState.pending.maxLevel,2); // Lv3에서 획득한 제작 한도는 유지
  const invalid=structuredClone(restored.abilityState);invalid.pending.budget=999;assert.throws(()=>validateAbilityState(invalid));
  assert.deepEqual(validateAbilityState(undefined),freshAbilityState());
});
