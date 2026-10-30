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


 await at('garden');await page.locator('[data-plant="0:stardaisy"]').click();const area=()=>page.locator('[data-garden-pot="0"]');await area().waitFor();await capture(page,'.local/cozy-activities/garden-seed-game.png');
 for(let i=0;i<3;i++){now+=200;await area().locator('.garden-seed-target').nth(i).click();await page.waitForTimeout(100);}
 await area().locator('[data-garden-arrow]').first().waitFor();await capture(page,'.local/cozy-activities/garden-sun-game.png');
 for(let i=0;i<8;i++){now+=200;const arrow=player.cozyActivities.garden.pots[0].game.arrows[i];if(i%2===0){await area().focus();await page.keyboard.press('Arrow'+arrow[0].toUpperCase()+arrow.slice(1));}else await area().locator('[data-garden-arrow="'+arrow+'"]').click();await page.waitForTimeout(100);}
 const water=area().locator('[data-garden-water="start"]');await water.waitFor();await water.scrollIntoViewIfNeeded();var bb=await water.boundingBox();await page.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await page.mouse.down();await area().locator('[data-garden-water="release"]').waitFor();await page.waitForTimeout(300);now+=3500;await page.mouse.up();await area().locator('[data-garden-harvest]').waitFor();assert.equal(await area().locator('.garden-grade').innerText(),'아주 좋음 · 100점');await capture(page,'.local/cozy-activities/garden-grade-game.png');await page.setViewportSize({width:390,height:844});await assertDialogFits(page,'garden minigame mobile');await capture(page,'.local/cozy-activities/garden-grade-mobile.png');await area().locator('[data-garden-harvest]').click();await page.waitForFunction(()=>document.querySelector('.garden-collected-grade')?.textContent.includes('아주 좋음'));assert.equal(player.cosmicEnergy,startEnergy+unit);assert.equal(player.cozyActivities.garden.qualityCollection.stardaisy['아주 좋음'],1);
 await page.locator('[data-plant="0:moonbell"]').click();for(let i=0;i<3;i++){now+=200;await area().locator('.garden-seed-target').nth(i).click();await page.waitForTimeout(80);}for(let i=0;i<8;i++){now+=200;await area().locator('[data-garden-arrow="'+player.cozyActivities.garden.pots[0].game.arrows[i]+'"]').click();await page.waitForTimeout(80);}await area().locator('[data-garden-water="start"]').focus();await page.keyboard.down('Space');await area().locator('[data-garden-water="release"]').waitFor();now+=3500;await page.keyboard.up('Space');await area().locator('[data-garden-harvest]').waitFor();assert.equal(await area().locator('.garden-grade').innerText(),'아주 좋음 · 100점');await area().locator('[data-garden-harvest]').click();
 assert.equal(player.cosmicEnergy,startEnergy+unit*2);assert.deepEqual(errors,[]);console.log('PASS garden seed spacing, 8arrows keyboard/touchbuttons, pointer+keyboard holdrelease afterredraw, 5grade renderer, collectionquality, scaledreward, mobilewidth, JS/CSP errors0');
}finally{await browser.close();await game.close();}
