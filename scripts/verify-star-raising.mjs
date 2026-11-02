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


 const noTraits=async tab=>assert.equal(await tab.locator('.raising-traits,.raising-axis,.raising-type').count(),0,'traits shown only in final result');
 const setup=async(tab,species,name)=>{await tab.locator('[data-pet-page="setup"]').click();await tab.locator('.cozy-panel [data-name]').waitFor();await noTraits(tab);if(name!==undefined)await tab.locator('.cozy-panel [data-name]').fill(name);if(species)await tab.locator('[data-species="'+species+'"]').click();};
 const confirm=async tab=>{await tab.locator('[data-raising-confirm]').click();await tab.locator('.raising-story').waitFor();assert.equal(await tab.locator('.raising-welcome').count(),0);await noTraits(tab);};
 const choose=async(tab,activity,choice)=>{await tab.locator('[data-raising-story-confirm]').click();await tab.locator('[data-raising-activity="'+activity+'"]').click();await tab.locator('.raising-method').waitFor();await noTraits(tab);await tab.locator('[data-raising-choice="'+choice+'"]').click();};
 const fit=async(tab,label)=>{await assertDialogFits(tab,label);const m=await tab.locator('.cozy-dialog').evaluate(el=>{const r=el.getBoundingClientRect(),c=el.querySelector('.cozy-close').getBoundingClientRect();return {width:r.width,height:r.height,x:r.x,y:r.y,vw:innerWidth,vh:innerHeight,closeVisible:c.y>=0&&c.bottom<=innerHeight&&c.x>=r.x&&c.right<=r.right};});assert(m.width<=900&&m.width<m.vw,label+' bounded width');assert(m.height<=m.vh*.92+1,label+' bounded height');assert(m.x>=0&&m.y>=0&&m.closeVisible,label+' centered and close visible');};
 await at('pet');assert.equal(await page.locator('.cozy-panel button').count(),2);assert.equal(await page.locator('.cozy-panel').innerText(),'✦\n별 돌보기 시작하기\n▤\n직업결말 도감 보기');await noTraits(page);
 await capture(page,'.local/cozy-activities/raising-home-desktop.png');
 await page.locator('[data-pet-page="book"]').click();await page.locator('.raising-career-group>summary').first().click();assert.equal(await page.locator('.raising-career-grid article').count(),48);assert.equal(player.cozyActivities?.pet?.species??null,null);await noTraits(page);await page.locator('.raising-back').click();assert.equal(await page.locator('[data-pet-page="setup"]').evaluate(el=>el.tabIndex),0);await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');assert.equal(await page.locator('[data-pet-page="setup"]').evaluate(el=>document.activeElement===el),true,'home start remains keyboard reachable');
 await setup(page,'moon','꿈별이');assert.equal(player.cozyActivities?.pet?.species??null,null,'selection stays unsaved before confirmation');assert(await page.locator('[data-accessory="ribbon"]').isDisabled());await capture(page,'.local/cozy-activities/raising-setup-desktop.png');
 await page.setViewportSize({width:390,height:844});await fit(page,'setup mobile');await capture(page,'.local/cozy-activities/raising-setup-mobile.png');await confirm(page);const runId=player.cozyActivities.pet.raising.run.id;assert.equal(player.cozyActivities.pet.name,'꿈별이');
 for(let i=0;i<12;i++){
  await page.waitForFunction(n=>document.querySelector('.raising-story-heading')?.textContent.includes('성장 이야기 '+n+' /'),i+1);await noTraits(page);
  if(i===0){
   for(const [label,width,height] of [['desktop',1280,900],['tablet',768,1024],['portrait',390,844],['landscape',844,390],['small',320,568]]){
    await page.setViewportSize({width,height});await fit(page,label);await page.locator('.raising-story').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.raising-story').evaluate(el=>!!el.closest('.raising-map-overlay')),true,'story on map');
    assert(await page.locator('.raising-story p').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=18));
    await page.screenshot({path:'.local/cozy-activities/raising-story-'+label+'.png'});
    await page.locator('[data-raising-story-confirm]').click();assert.equal(await page.locator('.raising-story').count(),0);assert.equal(await page.locator('.raising-place').count(),6);
    await page.locator('.raising-map-picture img').evaluate(img=>img.decode());await page.locator('[data-raising-activity="science"]').scrollIntoViewIfNeeded();await page.screenshot({path:'.local/cozy-activities/raising-village-'+label+'.png'});
    await page.locator('[data-raising-activity="science"]').click();assert.equal(await page.locator('.raising-choice').count(),2);assert(await page.locator('.raising-choice b').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=18));await page.locator('.raising-choice').last().scrollIntoViewIfNeeded();await page.screenshot({path:'.local/cozy-activities/raising-method-'+label+'.png'});await noTraits(page);
    await page.keyboard.press('Escape');assert.equal(await page.locator('.raising-method').count(),0);assert.equal(await page.locator('.cozy-dialog[open]').count(),1);
    await page.locator('.cozy-close').click();await page.setViewportSize({width:1280,height:900});await at('pet');await setup(page,null);await confirm(page);assert.equal(player.cozyActivities.pet.raising.run.id,runId);assert.equal(player.cozyActivities.pet.raising.run.turns.length,0);
   }
   await page.setViewportSize({width:1280,height:900});
  }
  if(i===5){await page.locator('.cozy-close').click();await at('pet');assert.equal(await page.locator('.cozy-panel button').count(),2);await setup(page,null);assert(await page.locator('[data-species="flower"]').isDisabled());assert.equal(await page.locator('.cozy-panel [data-name]').inputValue(),'꿈별이');await confirm(page);assert.equal(player.cozyActivities.pet.raising.run.turns.length,5);assert.equal(player.cozyActivities.pet.raising.run.id,runId);}
  await choose(page,'science','0');
 }
 await page.locator('.raising-ending').waitFor();assert.equal(await page.locator('.raising-type').innerText(),'ISFP');assert.equal(await page.locator('.raising-axis').count(),4);assert.equal(player.cozyActivities.pet.raising.album.length,1);assert.equal(player.cosmicEnergy,startEnergy+unit*3);assert.equal(player.cozyActivities.pet.careCount,3);
 await capture(page,'.local/cozy-activities/raising-ending.png');await page.setViewportSize({width:390,height:844});await fit(page,'ending mobile');await capture(page,'.local/cozy-activities/raising-ending-mobile.png');
 await page.locator('[data-pet-page="book"]').click();await noTraits(page);await page.locator('.raising-career-group>summary').first().click();assert.equal(await page.locator('.raising-career-grid article.collected').count(),1);await page.locator('.raising-back').click();await page.locator('.raising-ending').waitFor();
 await setup(page,'cloud');assert.equal(await page.locator('.cozy-panel [data-name]').inputValue(),'꿈별이');await page.locator('[data-accessory="ribbon"]').click();await confirm(page);assert.equal(player.cozyActivities.pet.accessory,'ribbon');assert.equal(player.cozyActivities.pet.species,'cloud');assert.equal(player.cozyActivities.pet.raising.album.length,1);
 for(let i=0;i<12;i++){await page.waitForFunction(n=>document.querySelector('.raising-story-heading')?.textContent.includes('성장 이야기 '+n+' /'),i+1);await choose(page,'art','1');}await page.locator('.raising-ending').waitFor();assert.equal(await page.locator('.raising-type').innerText(),'ENTJ');assert.equal(player.cosmicEnergy,startEnergy+unit*3);assert.equal(player.cozyActivities.pet.raising.album.length,2);
 await moveTo(teacherPlayer,teacher,'pet');await teacher.locator('#interact-prompt').click();await teacher.locator('.cozy-dialog[open]').waitFor();await setup(teacher,'flower');await confirm(teacher);const te=teacherPlayer.cosmicEnergy;for(let i=0;i<12;i++){await teacher.waitForFunction(n=>document.querySelector('.raising-story-heading')?.textContent.includes('성장 이야기 '+n+' /'),i+1);await choose(teacher,'care','1');}await teacher.locator('.raising-ending').waitFor();assert.equal(teacherPlayer.cosmicEnergy,te);
 assert.deepEqual(errors,[]);console.log('PASS bounded home/setup/map/story/place/choice/endings/book PC/mobile 5 sizes; 36 choices; first two actions; album before adoption; atomic setup; resume; traits final only; rewards/accessory/teacher; JS/CSP errors0');

}finally{await browser.close();await game.close();}
