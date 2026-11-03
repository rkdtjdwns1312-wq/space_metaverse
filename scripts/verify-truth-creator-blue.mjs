import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {TRUTH_CREATOR} from '../shared/truth-creator.js';
import {mapOf,STREET_ID} from '../shared/config.js';
import {monstersOf} from '../server/monsters.js';
import {aimTruthCreator} from '../server/truth-creator-attack.js';
import {tryTruthCreatorBlue} from '../server/truth-creator-blue.js';
import {ensureVitals} from '../server/vitals.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {tryTruthCreatorGalaxy,tickTruthCreatorGalaxy} from '../server/truth-creator-galaxy.js';

let now=Date.now();
const key='isolated-blue-orb-ui',game=createClassroomServer({teacherKey:key,studentHours:false,clock:()=>now});
const {port}=await game.listen(),browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[],checks=[],check=label=>{checks.push(label);console.log(label);};
await mkdir('.local/truth-creator-blue',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900},hasTouch:true});page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
  await page.addInitScript(()=>{const original=Date.now;Date.now=()=>original()+86400000;});
  await page.goto('http://127.0.0.1:'+port);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  for(let i=0;i<12&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');
  const room=[...game.store.rooms.values()][0],player=[...room.players.values()].find(p=>p.role==='teacher');
  const studentPage=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});studentPage.on('pageerror',error=>errors.push(error.message));studentPage.setDefaultTimeout(10000);
  await studentPage.goto('http://127.0.0.1:'+port);await studentPage.locator('#student-tab').click();await studentPage.locator('#join-code').fill(room.code);await studentPage.locator('#nickname').fill('검사');await studentPage.locator('#student-pin').fill('1234');await studentPage.locator('#student-form .submit').click();await studentPage.locator('#lobby').waitFor({state:'hidden'});
  for(let i=0;i<12&&await studentPage.locator('dialog[open]').count();i++)await studentPage.keyboard.press('Escape');
  const student=[...room.players.values()].find(p=>p.role==='student');chargeHuntingStation(student,'math',now);student.mapId=TRUTH_CREATOR.mapId;student.x=1000;student.y=1100;
  room.truthCreator={state:'active',respawnAt:null,monsterId:TRUTH_CREATOR.monsterId};const boss=monstersOf(room,now).get(TRUTH_CREATOR.monsterId);room.monsters=new Map([[boss.id,boss]]);
  Object.assign(player,{mapId:boss.mapId,x:boss.x-250,y:boss.y,teacherGhost:true});(boss.teacherRetaliation??=new Set()).add(player.id);boss.attackers.set(player.id,1);boss.attackers.set(student.id,2);
  let seed=17;const random=()=>((seed=seed*48271%2147483647)/2147483647);
  assert(tryTruthCreatorBlue(room,boss,player,now,random));aimTruthCreator(room,boss,player,now);boss.sleepUntil=now+120000;
  const [first,second,third]=boss.truthCreatorBlue.orbs;assert.equal(boss.mp,95);assert.equal(first.endsAt-first.landsAt,20000);
  const publish=()=>{for(const actor of [player,student])game.io.to(actor.socketId).emit('room:state',game.store.snapshot(room,actor,now));};
  const move=async(orb)=>{Object.assign(player,{mapId:boss.mapId,x:orb.x,y:orb.y,input:{x:0,y:0,at:0}});publish();await page.waitForTimeout(180);};
  await move(first);assert.equal(await page.locator('#interact-prompt[data-object-id="'+first.id+'"]').count(),0);
  now=first.landsAt;publish();await page.locator('#interact-prompt[data-object-id="'+first.id+'"]').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.getElementById('world').dataset.artStatus==='ready');await page.screenshot({path:'.local/truth-creator-blue/orbs-desktop.png'});
  await page.keyboard.press('f');const dialog=page.locator('#truth-creator-blue-dialog');await dialog.waitFor({state:'visible'});await dialog.locator('li').nth(7).waitFor();
  assert.equal(await dialog.locator('li').count(),8);assert.equal(await dialog.locator('h2').innerText(),'차례대로 입력하세요');assert(await dialog.locator('li').evaluateAll(items=>items.every(item=>item.children.length===1&&['공격','스킬'].includes(item.innerText))));assert.equal(await dialog.locator('[data-time]').textContent(),'20초');
  for(let index=0;index<5;index++){await page.keyboard.press('Tab');assert(await dialog.evaluate(element=>element.contains(document.activeElement)));}
  const combat=[];game.io.sockets.sockets.get(player.socketId).onAny(event=>{if(event.startsWith('combat:'))combat.push(event);});const mana=ensureVitals(player).mp;
  const press=async(action,keys={attack:'q',skill:'e'})=>{const before=Number(await dialog.locator('[data-progress]').textContent().then(t=>t.split('/')[0]));await page.keyboard.press(keys[action]);await page.waitForFunction(expected=>Number(document.querySelector('#truth-creator-blue-dialog [data-progress]').textContent.split('/')[0])===expected,before+1);};
  await press(first.sequence[0]);assert.equal(first.progress,1);
  await page.evaluate(code=>window.dispatchEvent(new KeyboardEvent('keydown',{code,repeat:true,bubbles:true})),first.sequence[1]==='attack'?'KeyQ':'KeyE');await page.waitForTimeout(100);assert.equal(first.progress,1);
  await dialog.locator('[data-action="attack"]').dispatchEvent('keydown',{code:'Enter',repeat:true});assert.equal(first.progress,1);
  const deadline=first.endsAt;now+=3000;await page.keyboard.press(first.sequence[1]==='attack'?'e':'q');await page.waitForFunction(()=>document.querySelector('#truth-creator-blue-dialog [data-progress]').textContent==='0 / 8');assert.equal(first.progress,0);assert.equal(first.endsAt,deadline);assert.match(await dialog.locator('[data-message]').textContent(),/남은 시간은 그대로/);assert.equal(await dialog.locator('[data-time]').textContent(),'17초');
  await press(first.sequence[0]);await page.screenshot({path:'.local/truth-creator-blue/desktop.png'});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await page.locator('#world').evaluate(element=>element===document.activeElement),true);
  await page.keyboard.press('f');await dialog.waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#truth-creator-blue-dialog [data-progress]').textContent==='1 / 8');check('실제 F·8칸·서버시간20초/PC시계+24시간·오답0초기화/시간유지·repeat차단·ESC/재열기진행복원');
  // A concurrent authoritative change is synchronized without double advancement or a wrong-answer reset.
  first.progress=2;first.revision++;await page.keyboard.press(first.sequence[1]==='attack'?'q':'e');await page.waitForFunction(()=>document.querySelector('#truth-creator-blue-dialog [data-progress]').textContent==='2 / 8');assert.match(await dialog.locator('[data-message]').textContent(),/다른 입력/);
  await dialog.locator('[data-close]').click();await page.locator('#control-settings-open').click();await page.locator('#control-key-attack').selectOption('KeyZ');await page.locator('#control-key-skill').selectOption('Digit2');await page.locator('#control-key-interact').selectOption('KeyC');await page.locator('#control-settings-save').click();await page.locator('#control-settings-close').click();
  await page.keyboard.press('c');await dialog.waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#truth-creator-blue-dialog [data-progress]').textContent==='2 / 8');assert.deepEqual(await dialog.locator('kbd').allTextContents(),['Z','2']);
  await page.keyboard.press('q');await page.keyboard.press('e');await page.waitForTimeout(100);assert.equal(first.progress,2);
  for(let index=2;index<7;index++)await press(first.sequence[index],{attack:'z',skill:'2'});
  await page.keyboard.press(first.sequence[7]==='attack'?'z':'2');await dialog.waitFor({state:'hidden'});assert(!boss.truthCreatorBlue.orbs.includes(first));assert.deepEqual(combat,[]);assert.equal(ensureVitals(player).mp,mana);check('stale revision동기화·설정키Z/2/C·8개성공해제·게임Q/E요청0/MP유지');
  await page.setViewportSize({width:390,height:844});await move(second);await page.locator('#touch-interact').tap();await dialog.waitFor({state:'visible'});await dialog.locator('li').nth(7).waitFor();
  assert.deepEqual(await dialog.locator('.truth-blue-actions .truth-blue-label').allTextContents(),['공격','스킬']);
  const visible=async()=>page.evaluate(()=>{const d=document.querySelector('#truth-creator-blue-dialog'),elements=[d,...d.querySelectorAll('[data-time],[data-action],[data-close],li')];return elements.every(element=>{const r=element.getBoundingClientRect();return r.top>=0&&r.left>=0&&r.bottom<=innerHeight&&r.right<=innerWidth;})&&d.scrollWidth<=d.clientWidth&&[...d.querySelectorAll('.truth-blue-label')].every(label=>label.scrollWidth<=label.clientWidth);});assert(await visible());assert(await dialog.locator('li').evaluateAll(items=>new Set(items.map(item=>Math.round(item.getBoundingClientRect().top))).size===1));await page.screenshot({path:'.local/truth-creator-blue/mobile.png'});
  for(let index=0;index<3;index++){await dialog.locator('[data-action="'+second.sequence[index]+'"]').tap();await page.waitForFunction(expected=>document.querySelector('#truth-creator-blue-dialog [data-progress]').textContent===expected+' / 8',index+1);}
  await page.setViewportSize({width:320,height:568});assert(await visible());await page.screenshot({path:'.local/truth-creator-blue/small-mobile.png'});
  await page.setViewportSize({width:740,height:360});assert(await visible());await page.screenshot({path:'.local/truth-creator-blue/landscape.png'});
  for(let index=3;index<8;index++){await dialog.locator('[data-action="'+second.sequence[index]+'"]').tap();if(index<7)await page.waitForFunction(expected=>document.querySelector('#truth-creator-blue-dialog [data-progress]').textContent===expected+' / 8',index+1);}
  await dialog.waitFor({state:'hidden'});assert(!boss.truthCreatorBlue.orbs.includes(second));assert.deepEqual(combat,[]);check('390×844/740×360모바일 모든8칸/시간/버튼보임·네모버튼실제터치8개해제');
  await page.locator('#minimap-toggle').click();
  await move(third);await page.locator('#touch-interact').tap();await dialog.waitFor({state:'visible'});await dialog.locator('li').nth(7).waitFor();player.mapId='street';publish();await dialog.waitFor({state:'hidden'});assert.equal(third.progress,0);check('맵이탈시모달정리/서버진행보존');
  await move(third);boss.teacherRetaliation.add(player.id);boss.attackers.set(player.id,1);await page.locator('#touch-interact').tap();await dialog.waitFor({state:'visible'});await dialog.locator('li').nth(7).waitFor();await dialog.locator('[data-close]').click();
  Object.assign(student,{x:third.x,y:third.y});publish();await studentPage.locator('#interact-prompt[data-object-id="'+third.id+'"]').waitFor({state:'visible'});await studentPage.locator('#touch-interact').tap();const studentDialog=studentPage.locator('#truth-creator-blue-dialog');await studentDialog.locator('li').nth(7).waitFor();await studentPage.screenshot({path:'.local/truth-creator-blue/student-mobile.png'});
  const studentCombat=[];game.io.sockets.sockets.get(student.socketId).onAny(event=>{if(event.startsWith('combat:'))studentCombat.push(event);});
  for(let index=0;index<8;index++){await studentDialog.locator('[data-action="'+third.sequence[index]+'"]').tap();if(index<7)await studentPage.waitForFunction(expected=>document.querySelector('#truth-creator-blue-dialog [data-progress]').textContent===expected+' / 8',index+1);}
  await studentDialog.waitFor({state:'hidden'});assert.equal(boss.truthCreatorBlue.orbs.length,0);assert.deepEqual(studentCombat,[]);check('학생실제모바일F조사·8개터치성공해제·전투요청0');
  now=boss.truthCreatorBlue.readyAt;boss.sleepUntil=0;assert(tryTruthCreatorBlue(room,boss,player,now,random));boss.sleepUntil=now+120000;const timeoutOrb=boss.truthCreatorBlue.orbs[0];now=timeoutOrb.landsAt;await move(timeoutOrb);await page.locator('#touch-interact').tap();await dialog.locator('li').nth(7).waitFor();now=timeoutOrb.endsAt+1;await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('.vitals-hp .vitals-label').textContent.includes('HP 0/'));assert.equal(ensureVitals(player).hp,0);assert.equal(ensureVitals(student).hp,0);check('미해제20초서버폭발·교사/학생실제HP0·모달자동닫힘');
  // Render the real galaxy view while the test clock holds the projectile in place.
  ensureVitals(player).hp=1000;Object.assign(player,{mapId:boss.mapId,x:1000,y:1100});boss.sleepUntil=0;boss.mp=100;boss.teacherRetaliation.add(player.id);boss.attackers.set(player.id,1);
  aimTruthCreator(room,boss,player,now);assert(tryTruthCreatorGalaxy(room,boss,player,now,()=>0));boss.sleepUntil=now+60000;now+=700;tickTruthCreatorGalaxy(room,boss,now);const galaxy=boss.truthCreatorGalaxy.orbs[0];Object.assign(player,{x:galaxy.x,y:galaxy.y+200});publish();await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(4000);await page.screenshot({path:'.local/truth-creator-blue/galaxy-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await page.screenshot({path:'.local/truth-creator-blue/galaxy-mobile.png'});
  const art=await page.evaluate(async()=>{const {truthCreatorObjectLayers,preloadTruthCreatorArt}=await import('/truth-creator-art.js');await preloadTruthCreatorArt();const c=document.createElement('canvas');c.width=800;c.height=400;const ctx=c.getContext('2d');ctx.fillStyle='#10182c';ctx.fillRect(0,0,c.width,c.height);let draws=0;const draw=ctx.drawImage.bind(ctx);ctx.drawImage=(...args)=>{draws++;return draw(...args);};const layers=truthCreatorObjectLayers(ctx,{blueOrbs:[{x:150,y:180,radius:48,phase:'landed',endsAt:20000}],galaxies:[{x:480,y:180,radius:96,dx:1,dy:0,endsAt:5000}]},0);layers.forEach(layer=>layer.draw());return {draws,layers:layers.length,image:c.toDataURL()};});assert.equal(art.draws,2);assert.equal(art.layers,2);await writeFile('.local/truth-creator-blue/art-review.png',Buffer.from(art.image.split(',')[1],'base64'));check('파란구체+Lv3크기은하수PC/모바일실제렌더·각각단일sprite');
  const shop=mapOf(STREET_ID).objects.find(object=>object.kind==='energy-shop');Object.assign(student.avatar,{level:5,constellationId:'hercules'});ensureVitals(student).hp=60;Object.assign(student,{mapId:STREET_ID,x:shop.x,y:shop.y+shop.radius+25});publish();await studentPage.locator('#interact-prompt[data-object-id="'+shop.id+'"]').waitFor({state:'visible'});await studentPage.locator('#touch-interact').tap();await studentPage.locator('#energy-shop-level-tabs [data-level="5"]').click();const necklace=studentPage.locator('#energy-shop-list [data-item-id="truth-convergence"]');await necklace.scrollIntoViewIfNeeded();assert.match(await necklace.innerText(),/최대 체력 \+10.*최대 마나 \+10.*스킬 피해량 \+50%.*일반 스킬 쿨타임 -50%/);assert.match(await necklace.innerText(),/조합을 통해서만/);assert(await necklace.getByRole('button',{name:'구입 불가'}).isDisabled());await necklace.locator('img').evaluate(image=>image.decode());await necklace.screenshot({path:'.local/truth-creator-blue/necklace-student-shop.png'});check('학생LV5상점새목걸이그림·HP10/MP10/스킬50%/일반쿨50%감소·조합전용구입불가');
  assert.deepEqual(errors,[]);await writeFile('.local/truth-creator-blue/result.json',JSON.stringify({checks,errors},null,2));console.log('PASS truth creator blue orb real browser and socket flow; errors0');
}catch(error){for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'.local/truth-creator-blue/failure.png'}).catch(()=>{});throw error;}
finally{await browser.close();await game.close();}
