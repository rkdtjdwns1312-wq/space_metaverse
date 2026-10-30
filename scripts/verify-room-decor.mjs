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


 await at('room');await page.locator('.room-background').waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.room-theme-list img,.room-furniture-tray img')].every(i=>i.complete&&i.naturalWidth>0));assert.equal(await page.locator('[data-room-tray]').count(),24);
 const sc=()=>page.locator('.room-decor-scene');
 async function drag(id,rx,ry){const from=page.locator('[data-room-tray="'+id+'"]');await from.scrollIntoViewIfNeeded();let b=await from.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await sc().scrollIntoViewIfNeeded();b=await sc().boundingBox();await page.mouse.move(b.x+b.width*rx,b.y+b.height*ry,{steps:8});await page.mouse.up();await page.waitForTimeout(400);await page.locator('[data-room-piece="'+id+'"]').waitFor();}
 await drag('bed',.27,.72);await drag('piano',.65,.63);await drag('table',.55,.86);
 await page.locator('[data-room-color="1"]').click();await page.locator('[data-room-scale="1.25"]').click();await page.locator('[data-room-rotate]').click();
 const piece=page.locator('[data-room-piece="table"]');let bb=await piece.boundingBox();await page.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await page.mouse.down();let target=await sc().boundingBox();await page.mouse.move(target.x+target.width*.72,target.y+target.height*.88,{steps:8});await page.mouse.up();await page.waitForTimeout(400);await sc().focus();await page.keyboard.press('ArrowLeft');
 await page.locator('[data-room-save]').click();await page.waitForFunction(()=>document.querySelector('.room-save-state')?.textContent==='저장된 방');assert.equal(player.cosmicEnergy,startEnergy+unit*3);assert.equal(player.cozyActivities.room.layout.length,3);const table=player.cozyActivities.room.layout.find(p=>p.id==='table');assert.equal(table.palette,1);assert.equal(table.scale,1.25);assert.equal(table.rotation,1);assert(table.x>2.5);assert(player.cozyActivities.room.layout.some(p=>!Number.isInteger(p.x)));
 await capture(page,'.local/cozy-activities/room-drag-moon.png');
 for(const theme of ['cloud','study']){await page.locator('[data-room-theme="'+theme+'"]').click();await page.waitForFunction(t=>document.querySelector('.room-background')?.src.endsWith('room-'+t+'.webp')&&document.querySelector('.room-background')?.complete,theme);await capture(page,'.local/cozy-activities/room-drag-'+theme+'.png');}
 await page.locator('[data-room-save]').click();await page.waitForFunction(()=>document.querySelector('.room-save-state')?.textContent==='저장된 방');await page.keyboard.press('Escape');await at('room');assert.equal(player.cozyActivities.room.theme,'study');assert.equal(await page.locator('[data-room-piece]').count(),3);
 await page.setViewportSize({width:390,height:844});await assertDialogFits(page,'room drag mobile');await capture(page,'.local/cozy-activities/room-drag-mobile.png');await page.locator('[data-room-tray="globe"]').click();await sc().focus();await page.keyboard.press('Enter');await page.locator('[data-room-piece="globe"]').waitFor();await page.locator('[data-room-scale="0.75"]').click();await page.locator('[data-room-save]').click();await page.waitForFunction(()=>document.querySelector('.room-save-state')?.textContent==='저장된 방');assert.equal(player.cozyActivities.room.layout.length,4);assert.equal(player.cosmicEnergy,startEnergy+unit*3);
 await page.locator('[data-room-tray="easel"]').click();await sc().focus();await page.keyboard.press('Enter');await page.locator('[data-room-piece="easel"]').waitFor();
 await page.locator('[data-room-tray="pendant"]').click();await sc().focus();await page.keyboard.press('Enter');await page.locator('[data-room-piece="pendant"]').waitFor();
 // Delay acknowledgement to verify keyboard edits cannot mutate an in-flight save.
 let held=false;game.io.sockets.sockets.get(player.socketId).use((packet,next)=>{if(!held&&packet[0]==='cozy:act'){held=true;const ack=packet[packet.length-1];assert.equal(typeof ack,'function');packet[packet.length-1]=(...args)=>setTimeout(()=>ack(...args),650);}next();});
 await page.locator('[data-room-save]').click();await sc().focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('.room-save-state')?.textContent==='저장된 방');
 assert.equal(player.cozyActivities.room.layout.length,6);const anchors=player.cozyActivities.room.layout.map(p=>p.x+','+p.y);assert.equal(new Set(anchors).size,6);const last=player.cozyActivities.room.layout.find(p=>p.id==='pendant');assert(last.x<3);await capture(page,'.local/cozy-activities/room-last-item-mobile.png');
 assert.deepEqual(errors,[]);console.log('PASS room 3backgrounds/24assets, traydrag/reposition, fractionalcoordinates, colors/scales/rotation, keyboardplacement, save/reopen/cap, mobilewidth, JS/CSP errors0');
}finally{await browser.close();await game.close();}
