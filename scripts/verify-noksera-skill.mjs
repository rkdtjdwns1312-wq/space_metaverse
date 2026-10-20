import assert from 'node:assert/strict';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {monstersOf,moveMonsters,damageMonster} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {JOURNEY_VERSION} from '../shared/tutorial-journey.js';
import {NOKSERA_HORN_BURST as SKILL} from '../shared/boss-skills.js';
const out='.local/671-noksera',dir=await mkdtemp(join(tmpdir(),'noksera-skill-'));
const key='noksera-isolated-check',game=createClassroomServer({teacherKey:key,studentHours:false,teacherManagedAccounts:false,dataDir:dir});
let browser,teacher;const errors=[];
try{
  await mkdir(out,{recursive:true});const url=`http://127.0.0.1:${(await game.listen()).port}`;
  teacher=io(url,{transports:['websocket'],reconnection:false});await new Promise((resolve,reject)=>{teacher.once('connect',resolve);teacher.once('connect_error',reject);});
  const made=await teacher.timeout(5000).emitWithAck('room:create',{teacherKey:key,allowedNames:['연출검사']});assert(made.ok);
  const room=game.store.rooms.get(made.room.code);
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),args:['--no-proxy-server']});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);await page.goto(url);
  const art=await page.evaluate(async()=>{
    const {preloadNokseraSkill,nokseraSkillPose,drawNokseraSkill,NOKSERA_SKILL_ART}=await import('/noksera-skill.js');
    await preloadNokseraSkill();const c=Object.assign(document.createElement('canvas'),{width:1200,height:600}),ctx=c.getContext('2d');
    ctx.fillStyle='#182e4a';ctx.fillRect(0,0,c.width,c.height);
    const now=Date.now(),warning={kind:'noksera-horn-burst',startsAt:now,endsAt:now+3000},poses=[];
    for(let i=0;i<8;i++){
      ctx.save();ctx.translate(i%4*300,Math.floor(i/4)*300);
      const elapsed=i<5?i*250:1000+(i-4)*1600/3;
      const m={shape:'noksera',x:150,y:165,radius:110,facingX:-1,warning:{...warning,startsAt:now-elapsed,endsAt:now+3000-elapsed}};
      poses.push(nokseraSkillPose(m,100,null,now));drawNokseraSkill(ctx,m,100,null);
      ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.fillText(String(i+1),10,28);ctx.restore();
    }
    const probe=Object.assign(document.createElement('canvas'),{width:500,height:500}),pc=probe.getContext('2d');
    const m={shape:'noksera',x:250,y:270,radius:160,warning:{...warning,startsAt:now-2700,endsAt:now+300}};
    drawNokseraSkill(pc,{...m,facingX:-1},100,null);const a=pc.getImageData(0,0,500,500).data;pc.clearRect(0,0,500,500);
    drawNokseraSkill(pc,{...m,facingX:1},100,null);const b=pc.getImageData(0,0,500,500).data;
    let mirrorError=0;for(let y=0;y<500;y++)for(let x=0;x<500;x++)mirrorError+=Math.abs(a[(y*500+x)*4+3]-b[(y*500+499-x)*4+3]);
    const image=new Image();image.src=NOKSERA_SKILL_ART.src;await image.decode();
    return {sheet:c.toDataURL(),poses,mirrorError:mirrorError/250000,width:image.naturalWidth,height:image.naturalHeight,
      idle:nokseraSkillPose({...m,warning:null},100,null,now),released:nokseraSkillPose(m,500,{skillKind:'noksera-horn-burst',startedAt:100},now)};
  });
  await writeFile(`${out}/poses.png`,Buffer.from(art.sheet.split(',')[1],'base64'));delete art.sheet;
  assert.equal(art.idle,null);assert.equal(art.released,3.5);assert(art.mirrorError<1);assert.equal(Math.round(art.poses.at(-1)),7);
  // Discard the preview's module state and disable HTTP cache for a true first entry.
  const devtools=await context.newCDPSession(page);await devtools.send('Network.enable');await devtools.send('Network.setCacheDisabled',{cacheDisabled:true});
  const fetched=new Set();page.on('response',response=>{if(response.ok()&&/noksera-(horn-burst|moon-summon)\.png/.test(response.url()))fetched.add(response.url().split('/').at(-1));});
  await page.reload();
  await page.locator('#student-tab').click();await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill('연출검사');await page.locator('#student-pin').fill('1234');
  await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  if(await page.locator('#password-offer-dialog').isVisible())await page.locator('#password-offer-no').click();await page.locator('#tutorial-later').click();
  const p=[...room.players.values()].find(p=>p.role==='student'),t=[...room.players.values()].find(p=>p.role==='teacher');
  p.journey={version:JOURNEY_VERSION,stage:6,goals:[],claimedAt:Array(5).fill(Date.now()),practiceUntil:0};
  Object.assign(p.avatar,{level:4,constellationId:'hercules'});const m=monstersOf(room).get('noksera-boss');
  Object.assign(m,{dx:0,dy:0,moving:false,patrolStartedAt:Date.now()+60000,hornReadyAt:Infinity,moonReadyAt:Infinity,nextAttackAt:Infinity});
  Object.assign(p,{mapId:m.mapId,x:m.x+400,y:m.y});t.mapId=m.mapId;
  const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));publish();
  await page.waitForFunction(()=>document.querySelector('#world').dataset.monsterMaxMp==='50');
  await page.waitForTimeout(500);assert.equal(fetched.size,2,'both skill sheets load on map entry, before either skill is cast');
  const coldReady=await page.evaluate(async()=>{
    const {drawNokseraSkill}=await import('/noksera-skill.js'),{drawNokseraMoonCast}=await import('/noksera-moon.js');
    const ctx=document.createElement('canvas').getContext('2d'),now=Date.now(),m={shape:'noksera',x:100,y:100,radius:20,facingX:1};
    return [drawNokseraSkill(ctx,{...m,warning:{kind:'noksera-horn-burst',startsAt:now,endsAt:now+3000}},0,null),
      drawNokseraMoonCast(ctx,{...m,moonCast:{startsAt:now,endsAt:now+2000}},now)];
  });assert.deepEqual(coldReady,[true,true],'decoded poses are ready before the first cast');
  const hp=ensureVitals(p).hp,events=[];teacher.on('combat:monster-hit',h=>{if(h.skillKind===SKILL.kind)events.push({at:Date.now(),...h});});
  m.attackers.set(p.id,1);m.hornReadyAt=0;m.hornDecisionAt=0;m.nextManaRegenAt=Date.now()+10000;
  const began=Date.now();moveMonsters(room,began,()=>0);assert(m.pendingAttack);assert.equal(m.mp,35);publish();
  await page.waitForFunction(()=>document.querySelector('#world').dataset.monsterWarningCount==='1');
  await page.waitForTimeout(1250);assert.equal(ensureVitals(p).hp,hp);await page.screenshot({path:`${out}/warning.png`});
  await page.waitForFunction(()=>document.querySelector('#world').dataset.lastMonsterDamage!=='undefined'&&Number(document.querySelector('#world').dataset.lastMonsterDamage)>0);
  await page.screenshot({path:`${out}/burst.png`});
  assert.equal(events.length,1);assert(events[0].at-began>=3000);assert.equal(events[0].warningRadius,m.radius*2.05*1.5);assert.equal(events[0].damage,40-4);assert.equal(ensureVitals(p).hp,hp-36);
  m.attackers.clear();m.hornReadyAt=Infinity;m.nextAttackAt=Infinity;
  await page.waitForTimeout(900);await page.screenshot({path:`${out}/recovered.png`});assert.equal(events.length,1);
  assert.equal(await page.locator('#world').getAttribute('data-monster-mp'),'35');
  m.nextManaRegenAt=Date.now();moveMonsters(room,Date.now(),()=>.9);publish();await page.waitForFunction(()=>document.querySelector('#world').dataset.monsterMp==='40');
  // Second skill: observe its entire real 22-second lifecycle in the running game.
  Object.assign(m,{mp:50,nextAttackAt:Infinity,hornReadyAt:Infinity,moonReadyAt:0,moonDecisionAt:0});m.attackers.set(p.id,1);
  const moonBegan=Date.now();moveMonsters(room,moonBegan,()=>0);assert(m.moonCast);assert.equal(m.mp,25);publish();
  const waitUntil=async elapsed=>{const remaining=moonBegan+elapsed-Date.now();if(remaining>0)await page.waitForTimeout(remaining);};
  const initialPoint={x:m.x,y:m.y};
  await waitUntil(1000);assert.equal(m.x,initialPoint.x);assert.equal(m.y,initialPoint.y);await page.screenshot({path:`${out}/moon-descending.png`});
  await waitUntil(3300);assert.equal(m.moonCast,null);assert(m.moonAura);assert(Math.hypot(m.x-initialPoint.x,m.y-initialPoint.y)>0);await page.screenshot({path:`${out}/moon-crescent.png`});
  const moonPictures=await page.evaluate(async()=>{
    const {preloadNokseraMoon,drawNokseraMoon,drawNokseraMoonCast,nokseraMoonPhase}=await import('/noksera-moon.js');
    const {nokseraMoonTimeline}=await import('/shared/boss-skills.js');await preloadNokseraMoon();
    const c=Object.assign(document.createElement('canvas'),{width:1200,height:600}),ctx=c.getContext('2d');ctx.fillStyle='#172c49';ctx.fillRect(0,0,1200,600);
    const phases=[];
    for(const [i,now] of [2000,3000,6500,10000,15999,16000,19500,22999].entries()){
      ctx.save();ctx.translate(i%4*300,Math.floor(i/4)*300);
      const m={shape:'noksera',x:150,y:235,radius:80,facingX:-1,moonAura:nokseraMoonTimeline(1000),moonCast:now<3000?{startsAt:1000,endsAt:3000}:null};
      drawNokseraMoon(ctx,m,now);ctx.fillStyle='#fff';ctx.font='17px sans-serif';ctx.fillText(`${(now-1000)/1000}s`,115,285);ctx.restore();phases.push(nokseraMoonPhase(m,now));
    }
    return {png:c.toDataURL(),phases};
  });
  await writeFile(`${out}/moon-phases.png`,Buffer.from(moonPictures.png.split(',')[1],'base64'));
  await waitUntil(9250);assert(m.moonAura);const bossHp=m.hp,playerHp=ensureVitals(p).hp;
  const reflected=damageMonster(room,m,p,25,Date.now());assert.equal(reflected.damage,0);assert.equal(m.hp,bossHp);assert.equal(reflected.reflectedDamage,20);assert.equal(ensureVitals(p).hp,playerHp-20);publish();
  await page.screenshot({path:`${out}/moon-full-reflection.png`});
  await waitUntil(15250);const normal=damageMonster(room,m,p,25,Date.now());assert.equal(normal.damage,20);assert.equal(m.hp,bossHp-20);publish();await page.screenshot({path:`${out}/moon-waning.png`});
  await waitUntil(22200);assert.equal(m.moonAura,null);await page.screenshot({path:`${out}/moon-ended.png`});
  assert.deepEqual(errors,[]);await context.close();
  const report={art,coldFirstEntryReady: coldReady,warningMs:events[0].at-began,damage:events[0].damage,manaAfterCast:35,manaAfterRecovery:40,oneHit:true,moon:{castMana:25,totalMs:22200,heldDuringCast:true,resumedMovement:true,reflected:20,normalAfterFull:20,cleared:true,phases:moonPictures.phases},errors};
  await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{teacher?.disconnect();await browser?.close();await game.close();await rm(dir,{recursive:true,force:true});}
