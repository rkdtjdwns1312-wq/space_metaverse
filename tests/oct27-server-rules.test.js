import {chargeHuntingStation} from '../server/hunting-time.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {buyStatGrowth,statGrowthInfo,validateStatGrowth} from '../server/stat-growth.js';
import {vitalsOf} from '../shared/vitals.js';
import {attackPowerOf,defensePowerOf} from '../shared/combat.js';
import {STREET,STREET_ID,VALLEY,VALLEY_ID,PROGRESSION,BLACK_HOLE_ID,WHALE_STOMACH_ID,PLAZA_ID,PLANET_COLORS,interiorIdOf} from '../shared/config.js';
import {departmentSlots} from '../shared/plaza-layout.js';
import {buyExperience} from '../server/evolution.js';
import {teacherInventoryView,adjustTeacherInventory,grantTeacherResources} from '../server/teacher-inventory.js';
import {combatEnemies,damageTargets,attackSagittarius} from '../server/sagittarius-skills.js';
import {advanceProjectiles} from '../server/projectiles.js';
import {resolveWaterHit} from '../server/water-skills.js';
import {ensureVitals} from '../server/vitals.js';
import {damagePlayersInArea} from '../server/area-combat.js';
import {saveNotice,assignmentById} from '../server/temple.js';
import {setTaskStatus} from '../server/tasks.js';

test('공개 파일은 재검증 캐시를 쓰고 상태 응답은 저장·조합법 내용 노출을 막는다',async t=>{
  const recipes=[{output:{id:'test-private-output'},ingredients:[{id:'test-private-ingredient',quantity:1}]}];
  const game=createClassroomServer({teacherKey:'oct27-cache-teacher-key',craftingRecipes:recipes});
  t.after(()=>game.close());await game.listen();const base=`http://127.0.0.1:${game.http.address().port}`;
  for(const path of ['/app.js','/shared/config.js','/assets/maps/star-gate.png']){
    const response=await fetch(base+path);assert.equal(response.status,200,path);assert.equal(response.headers.get('cache-control'),'no-cache');
    assert.ok(response.headers.get('last-modified'));const etag=response.headers.get('etag');assert.ok(etag);
    const cached=await fetch(base+path,{headers:{'If-None-Match':etag,'Cache-Control':'max-age=0'}});assert.equal(cached.status,304,path);assert.equal(await cached.text(),'');
  }
  const health=await fetch(base+'/health');assert.equal(health.headers.get('cache-control'),'no-store');
  const text=await health.text();assert.deepEqual(JSON.parse(text).crafting,{ready:true,privateRecipeCount:1});assert.equal(text.includes('test-private'),false);
  for(const path of ['/api/public-config','/data/crafting-recipes.json','/.env']){
    const response=await fetch(base+path);assert.equal(response.headers.get('cache-control'),'no-store');
    if(path!=='/api/public-config')assert.equal(response.status,404);
  }
});

test('영구 능력치는 정확한 40/40/10/10 구간·KST 자정·중복/실패 무차감을 지킨다',()=>{
  const now=Date.parse('2026-10-27T14:59:59Z'),counts={hp:0,mp:0,attack:0,defense:0};
  for(let roll=0;roll<100;roll++){
    const p={role:'student',cosmicEnergy:300,avatar:{level:2,constellationId:'sagittarius'}},before=vitalsOf(2,p),attack=attackPowerOf(2,'sagittarius',p),defense=defensePowerOf(2,'sagittarius',p);
    const result=buyStatGrowth(p,now,()=>roll);counts[result.stat]++;
    assert.equal(p.cosmicEnergy,200);assert.equal(result.dayKey,'2026-10-27');assert.equal(result.purchasedToday,true);
    assert.equal(vitalsOf(2,p).hp.max,before.hp.max+(result.stat==='hp'?1:0));
    assert.equal(vitalsOf(2,p).mp.max,before.mp.max+(result.stat==='mp'?1:0));
    assert.equal(attackPowerOf(2,'sagittarius',p),attack+(result.stat==='attack'?1:0));
    assert.equal(defensePowerOf(2,'sagittarius',p),defense+(result.stat==='defense'?1:0));
    const copy=structuredClone(p);assert.throws(()=>buyStatGrowth(p,now,()=>0),/이미/);assert.deepEqual(p,copy);
    assert.equal(statGrowthInfo(p,now+1000).canBuy,true);buyStatGrowth(p,now+1000,()=>0);assert.equal(p.cosmicEnergy,100);
    assert.equal(statGrowthInfo(p,now-86400_000).canBuy,false);
  }
  assert.deepEqual(counts,{hp:40,mp:40,attack:10,defense:10});
  for(const [balance,draw] of [[99,()=>0],[100,()=>100],[100,()=>NaN],[100,()=>{throw Error('rng');}]]){
    const p={role:'student',cosmicEnergy:balance},copy=structuredClone(p);assert.throws(()=>buyStatGrowth(p,now,draw));assert.deepEqual(p,copy);
  }
  assert.throws(()=>validateStatGrowth({bonuses:{hp:-1,mp:0,attack:0,defense:0},lastPurchaseDay:null}));
  assert.throws(()=>buyStatGrowth({role:'teacher',cosmicEnergy:100},now));
  const master={role:'student',accountKind:'master',cosmicEnergy:0};assert.equal(statGrowthInfo(master,now).cost,0);
  buyStatGrowth(master,now,()=>0);assert.equal(master.cosmicEnergy,0);assert.throws(()=>buyStatGrowth(master,now,()=>0),/이미/);
  const asteroid={role:'student',cosmicEnergy:100,avatar:{level:1}};buyStatGrowth(asteroid,now,()=>99);assert.equal(defensePowerOf(1,null,asteroid),1);assert.equal(attackPowerOf(1,null,asteroid),null);
});

test('경험치가 이미 가득 차면 0/누락 입력에도 명확한 안내를 하고 차감하지 않는다',()=>{
  const star=VALLEY.objects.find(o=>o.kind==='growth'),p={role:'student',mapId:VALLEY_ID,x:star.x,y:star.y,starShards:10,avatar:{level:2,xp:PROGRESSION.nextLevelXp[1]}};
  for(const data of [{},{amount:0},{amount:1}])assert.throws(()=>buyExperience({},p,data),/모두 채웠어요/);
  assert.equal(p.starShards,10);
});

test('교사 지급에서 옛 8종은 제거하지만 보유품 제거·일괄 원자성은 유지한다',()=>{
  const teacher={id:'t',role:'teacher',connected:true},a={id:'a',role:'student',nickname:'A',starShards:0,cosmicEnergy:0,inventory:[]},b={...structuredClone(a),id:'b',nickname:'B'};
  const room={players:new Map([teacher,a,b].map(p=>[p.id,p])),recipeDropOutputIds:['galaxy-card']};
  const retired=['star-sticker','space-snack','asteroid-helmet','firefly-lamp','rainbow-tail','mini-satellite','starlight-cape','meteor-board'];
  assert.ok(teacherInventoryView(room,teacher).catalog.every(i=>!retired.includes(i.id)));
  for(const id of retired){assert.throws(()=>adjustTeacherInventory(room,teacher,{playerId:'a',itemIds:[id]},'give'));assert.throws(()=>grantTeacherResources(room,teacher,{playerIds:['a'],items:[{id,quantity:1}]}));}
  a.inventory=[{id:'star-sticker',quantity:1}];adjustTeacherInventory(room,teacher,{playerId:'a',itemId:'star-sticker'},'remove');assert.deepEqual(a.inventory,[]);
  for(const data of [{playerIds:['a','foreign'],starShards:1},{playerIds:['a','a'],starShards:1},{playerIds:['a'],cosmicEnergy:-1},{playerIds:['a'],items:[{id:'galaxy-card',quantity:99}]}]){
    const copy=structuredClone(a);assert.throws(()=>grantTeacherResources(room,teacher,data));assert.deepEqual(a,copy);
  }
  b.starShards=9999;assert.throws(()=>grantTeacherResources(room,teacher,{playerIds:['a','b'],starShards:1}));assert.equal(a.starShards,0);
  b.starShards=0;grantTeacherResources(room,teacher,{playerIds:['a','b'],starShards:5,cosmicEnergy:100,items:[{id:'recipe:galaxy-card',quantity:2}]});
  assert.deepEqual([a.starShards,b.cosmicEnergy,a.inventory[0].quantity],[5,100,2]);
  assert.throws(()=>grantTeacherResources(room,a,{playerIds:['b'],starShards:1}));
});

for(const [id,module,fn] of [['corvus','corvus','castCorvus'],['aquarius','aquarius','castAquarius'],['cygnus','swan','castSwan'],['ophiuchus','ophiuchus','castOphiuchus'],['gemini','gemini','castGemini'],['aries','aries','castAries'],['taurus','taurus','castTaurus'],['hercules','hercules','castHercules'],['libra','libra','castLibra'],['corona-borealis','corona','castCorona'],['capricorn','capricorn','castCapricorn'],['leo','leo','castLeo'],['cetus','water','castWater'],['cancer','water','castWater'],['pisces','water','castWater'],['sagittarius',null,null]]){
  test(`${id} 기본 Q는 같은 위치 친구를 해치지 않는다`,async()=>{
    const p={id:'a',role:'student',connected:true,mapId:'star-origin-1',x:500,y:450,facing:{x:1,y:0},avatar:{level:4,constellationId:id}},friend={...structuredClone(p),id:'b',x:590,avatar:{level:4,constellationId:'aries'}};
    const room={players:new Map([[p.id,p],[friend.id,friend]]),planets:new Map(),monsters:new Map()},hp=ensureVitals(friend).hp;
    const result=module?(await import(`../server/${module}-skills.js`))[fn](room,p,1000,{basic:true}):attackSagittarius(room,p,1000);
    assert.deepEqual(result.playerTargets,[]);
    for(const now of [1100,1300,1800,2600])advanceProjectiles(room,now,combatEnemies,(r,p,list,power,time,cast)=>module==='water'?resolveWaterHit(r,p,list,power,time,cast):damageTargets(r,p,list,power,time));
    assert.equal(ensureVitals(friend).hp,hp);
  });
}
test('기본 공격 보호는 E 피해와 게자리 강화 Q 회복을 차단하지 않는다',async()=>{
  const p={id:'a',role:'student',connected:true,mapId:'star-origin-1',x:500,y:450,facing:{x:1,y:0},avatar:{level:4,constellationId:'corvus'}},friend={...structuredClone(p),id:'b',x:590,avatar:{level:4,constellationId:'aries'}};
  const room={players:new Map([[p.id,p],[friend.id,friend]]),planets:new Map(),monsters:new Map()},hp=ensureVitals(friend).hp;
  damagePlayersInArea(room,{sourceId:p.id,mapId:p.mapId,x:friend.x,y:friend.y,radius:50,basic:true},10,1000);assert.equal(ensureVitals(friend).hp,hp);
  damagePlayersInArea(room,{sourceId:p.id,mapId:p.mapId,x:friend.x,y:friend.y,radius:50},10,1000);assert.ok(ensureVitals(friend).hp<hp);
  const {castCorvus}=await import('../server/corvus-skills.js');castCorvus(room,p,2000,{basic:false});const before=ensureVitals(friend).hp;
  advanceProjectiles(room,3100,combatEnemies,damageTargets);assert.ok(ensureVitals(friend).hp<before);
  ensureVitals(friend).hp=10;
  const healed=resolveWaterHit(room,p,[{kind:'player',entity:friend}],10,4000,{basic:true,healing:true});assert.ok(healed.healed.length);assert.ok(ensureVitals(friend).hp>10);
});

test('소켓 구매·교사 지급·빠른 이동은 권한/저장실패/중복/재시작 경계를 지킨다',async t=>{
  const root=resolve(tmpdir()),dir=mkdtempSync(join(root,'oct27-rules-')),key='oct27-rules-teacher-key';let game,now=Date.parse('2026-10-27T14:59:59Z');const sockets=[];
  const start=async()=>{game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false,clock:()=>now,statGrowthDraw:()=>90,craftingRecipes:[]});await game.listen();};
  const connect=async()=>{const s=io(`http://127.0.0.1:${game.http.address().port}`,{transports:['websocket'],reconnection:false,autoConnect:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);s.connect();});return s;};
  const call=(s,event,data={})=>s.timeout(5000).emitWithAck(event,data);
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await game?.close();assert.equal(dirname(resolve(dir)),root);rmSync(dir,{recursive:true,force:true});});
  await start();const teacher=await connect(),anon=await connect();const made=await call(teacher,'room:create',{teacherKey:key,studentAccounts:[{nickname:'학생',pin:'1234'},{nickname:'친구',pin:'1234'}]});assert.ok(made.ok,made.error);
  const code=made.room.code,student=await connect(),joined=await call(student,'room:join',{code,nickname:'학생',pin:'1234'});assert.ok(joined.ok,joined.error);
  const id=joined.selfId,room=()=>game.store.rooms.get(code),p=()=>room().players.get(id),friend=[...room().players.values()].find(p=>p.nickname==='친구').id;chargeHuntingStation(p(),'math',now);
  const machine=STREET.objects.find(o=>o.kind==='crafting');Object.assign(p(),{mapId:STREET_ID,x:machine.x,y:machine.y,starShards:10,inventory:[{id:'star-crumb',quantity:5}]});
  const craftInfo=await call(student,'crafting:open');assert.equal(craftInfo.configured,false);assert.equal(craftInfo.privateRecipeCount,0);assert.equal(craftInfo.enabled,true);
  const craftBefore=structuredClone({inventory:p().inventory,starShards:p().starShards});
  const missingCraft=await call(student,'crafting:combine',{ingredients:[{id:'star-crumb',quantity:1}]});assert.equal(missingCraft.ok,false);assert.match(missingCraft.error,/일반 조합법 데이터가 준비되지/);
  assert.deepEqual({inventory:p().inventory,starShards:p().starShards},craftBefore);
  const publicCraft=await call(student,'crafting:combine',{ingredients:[{id:'star-crumb',quantity:5}]});assert.ok(publicCraft.ok,publicCraft.error);assert.equal(publicCraft.success,true);assert.equal(p().starShards,11);
  for(const client of [anon,student])assert.equal((await call(client,'teacher:resources:grant',{playerIds:[id],cosmicEnergy:100})).ok,false);
  assert.ok((await call(teacher,'teacher:resources:grant',{playerIds:[id,friend],cosmicEnergy:300})).ok);
  assert.equal((await call(student,'shop:energy:stat-buy')).ok,false);
  const atShop=()=>{const shop=STREET.objects.find(o=>o.kind==='energy-shop');Object.assign(p(),{mapId:STREET_ID,x:shop.x,y:shop.y+100});};atShop();
  const save=game.store.files.save.bind(game.store.files);game.store.files.save=()=>{throw Error('expected disk failure');};
  try{assert.equal((await call(student,'shop:energy:stat-buy')).ok,false);assert.equal((await call(teacher,'teacher:resources:grant',{playerIds:[id,friend],cosmicEnergy:100})).ok,false);}finally{game.store.files.save=save;}
  assert.equal(p().cosmicEnergy,300);assert.equal(p().statGrowth?.bonuses.defense??0,0);assert.equal(room().players.get(friend).cosmicEnergy,300);
  const attempts=await Promise.all([call(student,'shop:energy:stat-buy'),call(student,'shop:energy:stat-buy')]);assert.equal(attempts.filter(a=>a.ok).length,1);
  const bought=attempts.find(a=>a.ok);assert.equal(bought.stat,'defense');assert.equal(p().cosmicEnergy,200);
  assert.equal((await call(student,'shop:energy:stat-buy')).ok,false);
  assert.equal(game.store.snapshot(room(),p(),now).teacherActivity,undefined);assert.ok(game.store.snapshot(room(),room().players.get(made.selfId),now).teacherActivity);
  for(const to of ['unknown',WHALE_STOMACH_ID,BLACK_HOLE_ID,'__proto__'])assert.equal((await call(student,'map:fast-travel',{to})).ok,false);
  const design={version:1,background:'#123456',marks:Array.from({length:12},()=>({tool:'brush',color:'#ffffff',width:4,points:Array.from({length:256},()=>[123.45,234.56])}))};
  assert.ok(Buffer.byteLength(JSON.stringify(design))>32768);
  const planetData={name:'테스트행성',description:'',...departmentSlots()[0],color:PLANET_COLORS[0],templateId:'meal',customDesign:design};
  assert.equal((await call(student,'planet:create',planetData)).ok,false);
  assert.equal((await call(teacher,'planet:create',{...planetData,customDesign:{...design,url:'https://example.test/image'}})).ok,false);
  const created=await call(teacher,'planet:create',planetData);assert.ok(created.ok,created.error);
  const planet=room().planets.get(created.planetId);assert.deepEqual(planet.customDesign,design);
  assert.deepEqual(game.store.snapshot(room(),p(),now).planets.find(pl=>pl.id===planet.id).customDesign,design);
  assert.equal((await call(student,'map:fast-travel',{to:interiorIdOf(planet.id)})).ok,false);
  p().mapId=PLAZA_ID;
  const proposal=await call(student,'planet:propose',{...planetData,...departmentSlots()[1],name:'그림행성'});assert.ok(proposal.ok,proposal.error);
  const approved=await call(teacher,'planet:approve',{proposalId:proposal.proposalId});assert.ok(approved.ok,approved.error);assert.deepEqual(room().planets.get(approved.planetId).customDesign,design);
  atShop();
  Object.assign(room().players.get(made.selfId),{mapId:STREET_ID,x:500,y:500});
  assert.ok((await call(teacher,'assignment:read')).ok);assert.ok((await call(teacher,'assignment:incomplete')).ok);
  assert.equal((await call(student,'assignment:read')).ok,false);assert.equal((await call(student,'assignment:incomplete')).ok,false);
  const assignmentId=saveNotice(room(),'과제',[0],now).taskLines[0].assignmentId;setTaskStatus(p(),assignmentById(room(),assignmentId),'submitted',now);
  assert.ok(game.store.snapshot(room(),room().players.get(made.selfId),now).teacherActivity.tasks.some(t=>t.status==='submitted'));
  assert.equal((await call(student,'assignment:confirm',{studentId:id,assignmentId})).ok,false);
  assert.ok((await call(teacher,'assignment:confirm',{studentId:id,assignmentId})).ok);assert.equal(p().tasks.length,0);
  p().constellationAbilityState.ariesSleep={sourceId:friend,startsAt:now,endsAt:now+86400000,reward:1,wakeCost:1};
  assert.equal((await call(student,'map:fast-travel',{to:PLAZA_ID})).ok,false);p().constellationAbilityState.ariesSleep=null;
  p().constellationAbilityState.cetusStomach={sourceId:friend,level:4,startsAt:now,endsAt:now+86400000,returnMapId:PLAZA_ID,returnX:1000,returnY:1000};p().mapId=WHALE_STOMACH_ID;
  assert.equal((await call(student,'map:fast-travel',{to:PLAZA_ID})).ok,false);p().constellationAbilityState.cetusStomach=null;atShop();
  p().avatar.blackStar={planetId:planet.id,at:now};assert.equal((await call(student,'map:fast-travel',{to:PLAZA_ID})).ok,false);p().avatar.blackStar=null;
  ensureVitals(p()).hp=0;assert.equal((await call(student,'map:fast-travel',{to:PLAZA_ID})).ok,false);ensureVitals(p()).hp=1;
  const travel=await call(student,'map:fast-travel',{to:'star-origin-3'});assert.ok(travel.ok,travel.error);assert.equal(p().mapId,'star-origin-3');assert.deepEqual(p().input,{x:0,y:0,at:0});
  Object.assign(p(),{mapId:PLAZA_ID,x:300,y:300});p().avatar.level=2;
  assert.equal((await call(student,'combat:attack',{aim:{x:0,y:0}})).ok,false);
  assert.ok((await call(student,'combat:attack',{aim:{x:-3,y:4}})).ok);assert.deepEqual(p().facing,{x:-.6,y:.8});
  sockets.forEach(s=>s.disconnect());await game.close();await start();const reTeacher=await connect();assert.ok((await call(reTeacher,'room:open',{teacherKey:key,code})).ok);
  const reStudent=await connect();assert.ok((await call(reStudent,'room:join',{code,nickname:'학생',pin:'1234'})).ok);atShop();
  assert.deepEqual(room().planets.get(planet.id).customDesign,design);
  assert.equal(p().statGrowth.bonuses.defense,1);assert.equal((await call(reStudent,'shop:energy:stat-buy')).ok,false);
  now+=1000;atShop();const next=await call(reStudent,'shop:energy:stat-buy');assert.ok(next.ok,next.error);assert.equal(p().statGrowth.bonuses.defense,2);assert.equal(p().cosmicEnergy,100);
});
