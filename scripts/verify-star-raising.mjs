import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {STREET,STREET_ID} from '../shared/config.js';
import {cozyRewardUnit} from '../shared/cozy-activities.js';

let now=Date.now();
const key='isolated-cozy-activities',game=createClassroomServer({teacherKey:key,studentHours:false,clock:()=>now}),errors=[],checks=[];
const {port}=await game.listen(),browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
mkdirSync('.local/cozy-activities',{recursive:true});
const check=label=>checks.push(label);
const assertDialogFits=async(page,label)=>{const box=await page.locator('.cozy-dialog').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert.ok(box.scroll<=box.client+1,`${label} dialog horizontal overflow: ${JSON.stringify(box)}`);};
const capture=async(page,path)=>{await page.locator('.cozy-dialog').evaluate(el=>{el.scrollTop=0;});await page.screenshot({path,fullPage:true});};
try{
 const teacherContext=await browser.newContext({viewport:{width:1280,height:900}}),studentContext=await browser.newContext({viewport:{width:1280,height:900}}),teacher=await teacherContext.newPage(),page=await studentContext.newPage();for(const p of [teacher,page]){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/content security policy|refused to apply inline style|violat(?:e|ion).*csp/i.test(m.text()))errors.push(`CSP: ${m.text()}`);});}
 await teacher.goto(`http://127.0.0.1:${port}`);await teacher.locator('#connection').filter({hasText:'연결되었어요'}).waitFor({state:'attached'});await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);await fillNewClass(teacher,['학생1']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
 for(let n=0;n<12&&await teacher.locator('dialog[open]').count();n++)await teacher.keyboard.press('Escape');
 const code=await teacher.locator('#room-code').textContent(),room=game.store.rooms.get(code),teacherPlayer=[...room.players.values()].find(p=>p.role==='teacher');
 await page.goto(`http://127.0.0.1:${port}`);await page.locator('#connection').filter({hasText:'연결되었어요'}).waitFor({state:'attached'});await page.locator('#student-tab').click();await page.locator('#join-code').fill(code);await page.locator('#nickname').fill('학생1');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});for(let n=0;n<12&&await page.locator('dialog[open]').count();n++)await page.keyboard.press('Escape');
 const player=[...room.players.values()].find(p=>p.role==='student'),startEnergy=player.cosmicEnergy,unit=cozyRewardUnit(player.avatar?.level);
 const moveTo=async(who,tab,kind)=>{const prop=STREET.objects.find(o=>o.kind===`cozy-${kind}`);assert.ok(prop,`missing cozy-${kind} street prop`);Object.assign(who,{mapId:STREET_ID,x:prop.x,y:prop.y,input:{x:0,y:0,at:0}});game.io.to(who.socketId).emit('room:state',game.store.snapshot(room,who,now));await tab.waitForFunction(()=>!document.querySelector('#interact-prompt').hidden);};
 const at=async(kind)=>{await moveTo(player,page,kind);await page.locator('#interact-prompt').click();await page.locator('.cozy-dialog[open]').waitFor();await page.waitForFunction(()=>{const img=document.querySelector('.cozy-hero img');return img?.complete&&img.naturalWidth>0;});await assertDialogFits(page,kind+' desktop');};

 await at('pet');await page.locator('.cozy-choice').first().waitFor();await page.locator('.cozy-panel [data-name]').fill('꿈별이');await page.locator('[data-species="moon"]').click();await page.locator('[data-raising-start]').click();
 for(let i=0;i<12;i++){
  await page.waitForFunction(n=>document.querySelector('.raising-story-heading')?.textContent.includes('성장 이야기 '+n+' /'),i+1);
  if(i===0){
   for(const [label,width,height] of [['desktop',1280,900],['tablet',768,1024],['portrait',390,844],['landscape',844,390],['small',320,568]]){
    await page.setViewportSize({width,height});await assertDialogFits(page,label);
    const metrics=await page.locator('.cozy-dialog').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,story:parseFloat(getComputedStyle(el.querySelector('.raising-story p')).fontSize),choice:parseFloat(getComputedStyle(el.querySelector('.raising-choice b')).fontSize),activities:[...el.querySelectorAll('.raising-activity')].map(b=>b.getBoundingClientRect().height),choiceOpacity:getComputedStyle(el.querySelector('.raising-choice')).opacity}));
    assert.ok(Math.abs(metrics.width-width)<=1&&Math.abs(metrics.height-height)<=1,label+' fills viewport');assert.ok(metrics.story>=18&&metrics.choice>=18,label+' readable text');assert.ok(metrics.activities.every(h=>h>=48),label+' touch targets');assert.equal(metrics.choiceOpacity,'1');
    await page.locator('.raising-choice').last().scrollIntoViewIfNeeded();const bounds=await page.locator('.raising-choice').last().boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,label+' full choice width');
    await page.screenshot({path:'.local/cozy-activities/raising-readable-'+label+'.png'});
   }
   await page.setViewportSize({width:320,height:568});const original=await page.locator('.raising-choice b').last().textContent();await page.locator('.raising-choice b').last().evaluate(el=>{el.textContent='친구들과 천천히 이야기를 나누며 서로의 생각을 끝까지 들어보고, 새로운 방법을 함께 찾아보아요. '.repeat(4);});await assertDialogFits(page,'long choice');await page.locator('.raising-choice').last().scrollIntoViewIfNeeded();const long=await page.locator('.raising-choice').last().evaluate(el=>({scroll:el.scrollHeight,client:el.clientHeight}));assert.ok(long.scroll<=long.client+1,'long choice has no clipped text');await page.locator('.raising-choice b').last().evaluate((el,text)=>el.textContent=text,original);
   await page.setViewportSize({width:1280,height:900});await capture(page,'.local/cozy-activities/raising-desktop.png');await page.setViewportSize({width:390,height:844});await assertDialogFits(page,'raising mobile');await capture(page,'.local/cozy-activities/raising-mobile.png');await page.setViewportSize({width:844,height:390});await assertDialogFits(page,'raising landscape');await page.setViewportSize({width:1280,height:900});}
  if(i===5){await page.keyboard.press('Escape');await at('pet');assert.equal(player.cozyActivities.pet.raising.run.turns.length,5);}
  await page.locator('[data-raising-activity="science"]').click();await page.locator('[data-raising-choice="0"]').click();
 }
 await page.locator('.raising-ending').waitFor();assert.equal(await page.locator('.raising-type').innerText(),'ISFP');assert.equal(player.cozyActivities.pet.raising.album.length,1);assert.equal(player.cosmicEnergy,startEnergy+unit*3);assert.equal(player.cozyActivities.pet.careCount,3);
 await capture(page,'.local/cozy-activities/raising-ending.png');await page.setViewportSize({width:390,height:844});await assertDialogFits(page,'ending mobile');await capture(page,'.local/cozy-activities/raising-ending-mobile.png');await page.setViewportSize({width:1280,height:900});
 await page.locator('.raising-book>summary').click();await page.locator('.raising-career-group>summary').first().click();assert.equal(await page.locator('.raising-career-grid article').count(),48);await page.locator('.raising-wardrobe>summary').click();await page.locator('[data-accessory="ribbon"]').click();assert.equal(player.cozyActivities.pet.accessory,'ribbon');
 await page.locator('[data-raising-start]').click();for(let i=0;i<12;i++){await page.waitForFunction(n=>document.querySelector('.raising-story-heading')?.textContent.includes('성장 이야기 '+n+' /'),i+1);await page.locator('[data-raising-activity="art"]').click();await page.locator('[data-raising-choice="1"]').click();}await page.locator('.raising-ending').waitFor();assert.equal(await page.locator('.raising-type').innerText(),'ENTJ');assert.equal(player.cosmicEnergy,startEnergy+unit*3);assert.equal(player.cozyActivities.pet.raising.album.length,2);
 await moveTo(teacherPlayer,teacher,'pet');await teacher.locator('#interact-prompt').click();await teacher.locator('.cozy-dialog[open]').waitFor();await teacher.locator('[data-species="flower"]').click();await teacher.locator('[data-raising-start]').click();const te=teacherPlayer.cosmicEnergy;for(let i=0;i<12;i++){await teacher.waitForFunction(n=>document.querySelector('.raising-story-heading')?.textContent.includes('성장 이야기 '+n+' /'),i+1);await teacher.locator('[data-raising-activity="care"]').click();await teacher.locator('[data-raising-choice="1"]').click();}await teacher.locator('.raising-ending').waitFor();assert.equal(teacherPlayer.cosmicEnergy,te);
 assert.deepEqual(errors,[]);console.log('PASS raising real student 2 endings, saved midrun, 48career book, accessory, dailycap, teacher preview, desktop/tablet/portrait/landscape/320px fullscreen, readable18px+ choices, longtext scroll, JS/CSP errors0');
}finally{await browser.close();await game.close();}
