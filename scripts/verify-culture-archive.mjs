import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {MAP,STREET} from '../shared/config.js';
import {saveArchive} from '../server/starlight-archive.js';
const key='isolated-archive-ui',game=createClassroomServer({teacherKey:key,studentHours:false}),errors=[];
const {port}=await game.listen(),browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
mkdirSync('.local/culture-archive',{recursive:true});
try{
 const teacherContext=await browser.newContext({viewport:{width:1280,height:1000}}),studentContext=await browser.newContext({viewport:{width:1280,height:1000}}),teacher=await teacherContext.newPage(),page=await studentContext.newPage();for(const p of [teacher,page])p.on('pageerror',e=>errors.push(e.message));
 await teacher.goto(`http://127.0.0.1:${port}`);await teacher.locator('#connection').filter({hasText:'연결되었어요'}).waitFor({state:'attached'});await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);await fillNewClass(teacher,['학생1','학생2','학생3','학생4','학생5','학생6']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
 for(let n=0;n<12&&await teacher.locator('dialog[open]').count();n++)await teacher.keyboard.press('Escape');
 const code=await teacher.locator('#room-code').textContent(),room=game.store.rooms.get(code),teacherPlayer=[...room.players.values()].find(p=>p.role==='teacher');
 await page.goto(`http://127.0.0.1:${port}`);await page.locator('#connection').filter({hasText:'연결되었어요'}).waitFor({state:'attached'});await page.locator('#student-tab').click();await page.locator('#join-code').fill(code);await page.locator('#nickname').fill('학생1');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});for(let n=0;n<12&&await page.locator('dialog[open]').count();n++)await page.keyboard.press('Escape');

 const player=[...room.players.values()].find(p=>p.role==='student'),culture=STREET.objects.find(o=>o.kind==='culture-station');
 Object.assign(player,{mapId:STREET.id,x:culture.x,y:culture.y+100,input:{x:0,y:0,at:0}});
 game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player,Date.now()));
 await page.waitForFunction(()=>document.querySelector('#interact-prompt')?.textContent.includes('교양'));await page.keyboard.press('f');
 await page.locator('.culture-title').first().click();await page.locator('.culture-write-reading').waitFor();
 const title=await page.locator('#culture-library-dialog .culture-book-title').innerText();
 assert(await page.locator('.culture-write-reading').evaluate(e=>e.nextElementSibling.classList.contains('culture-recommend')));
 await page.locator('.culture-write-reading').click();const archive=page.locator('.star-archive[open]');await archive.locator('[name=body]').waitFor();
 assert.equal(await archive.locator('[name=bookTitle]').inputValue(),title);assert.equal(await archive.locator('[data-archive-kind=diary]').count(),0);
 await archive.locator('[name=body]').fill('책을 읽고 친구의 마음을 더 잘 이해하고 싶어졌어요.');await archive.locator('.archive-save').click();await archive.locator('.archive-status').filter({hasText:'안전하게'}).waitFor();
 assert.equal(player.starlightArchive.reading.length,1);await page.screenshot({path:'.local/culture-archive/reading-desktop.png'});
 await archive.locator('[data-archive-close]').click();assert(await page.locator('#culture-library-dialog').evaluate(e=>e.open));
 for(const width of [390,320,844]){await page.setViewportSize({width,height:width===844?390:844});await page.locator('.culture-write-reading').scrollIntoViewIfNeeded();const fits=await page.locator('#culture-library-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1);assert(fits,'culture footer fits '+width);await page.locator('.culture-write-reading').click();await archive.locator('[name=body]').waitFor();assert.equal(await archive.locator('[name=bookTitle]').inputValue(),title);assert(await archive.evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:'.local/culture-archive/reading-'+width+'.png'});await archive.locator('[data-archive-close]').click();}
 await page.locator('#culture-library-dialog .culture-header button').click();
 assert.deepEqual(errors,[]);console.log('PASS culture book title prefill, submit, return book, desktop and 320/390/844 responsive, errors0');
}finally{await browser.close();await game.close();}
