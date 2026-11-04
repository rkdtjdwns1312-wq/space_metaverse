import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {STREET} from '../shared/config.js';
const teacherKey='isolated-angel-ui',game=createClassroomServer({teacherKey,studentHours:false}),errors=[];
const {port}=await game.listen(),browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
mkdirSync('.local/star-angel',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900},hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}`);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(teacherKey);
 await fillNewClass(page,['축복검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 for(let n=0;n<12&&await page.locator('dialog[open]').count();n++)await page.keyboard.press('Escape');
 const code=await page.locator('#room-code').textContent(),room=game.store.rooms.get(code),p=[...room.players.values()].find(p=>p.role==='teacher');
 const statue=STREET.objects.find(o=>o.kind==='star-angel-statue');Object.assign(p,{mapId:STREET.id,x:statue.x,y:statue.y+100,input:{x:0,y:0,at:0}});
 game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 await page.locator('#interact-prompt').filter({hasText:'천사'}).waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#world').dataset.artStatus==='ready');
 await page.locator('#world').focus();await page.keyboard.press('f');
 await page.getByText('5분 동안 10초마다 체력 1·마나 1을 추가로 회복해요.',{exact:false}).first().waitFor({state:'visible'});
 assert.equal(p.effects.filter(e=>e.statusId==='star-angel-recovery').length,1);
 await page.screenshot({path:'.local/star-angel/statue-pc.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('#interact-prompt').filter({hasText:'천사'}).waitFor({state:'visible'});
 await page.locator('#interact-prompt').click();assert.equal(p.effects.filter(e=>e.statusId==='star-angel-recovery').length,1);
 await page.screenshot({path:'.local/star-angel/statue-mobile.png'});assert.deepEqual(errors,[]);
 console.log('PASS actual statue F interaction, HP1 MP1/10sec 5min message, no stacking, PC/mobile prompt and screenshot, errors0');
}finally{await browser.close();await game.close();}
