import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {MAP,PLAZA_ID} from '../shared/config.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'moon-self-ui-'));
const key='moon-self-ui-isolated-key';
const game=createClassroomServer({teacherKey:key,studentHours:false,dataDir:dir});const {port}=await game.listen();
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[];
try{
 const teacher=await browser.newPage(),page=await browser.newPage({viewport:{width:1440,height:960}});
 for(const p of [teacher,page]){p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));}
 const url='http://127.0.0.1:'+port;
 await teacher.goto(url,{waitUntil:"domcontentloaded",timeout:20000});await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);
 await fillNewClass(teacher,['별이']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0];
 await page.goto(url+'/?class='+room.code,{waitUntil:'domcontentloaded',timeout:20000});await page.waitForFunction(()=>document.getElementById('join-code').hidden);await page.locator('#nickname').fill('별이');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 await page.locator('#password-offer-no').click();
 const p=[...room.players.values()].find(p=>p.role==='student');
 p.inventory=[{id:'space-food-card',quantity:2},{id:'little-moon-card',quantity:1}];
 const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));publish();
 const use=async id=>{
   await page.locator('#bag-list li[data-item-id="'+id+'"] .slot-btn').click();
   await page.locator('#bag-detail .use').click();await page.locator('#use-dialog').waitFor({state:'visible'});
   await page.locator('#use-confirm').click();
   try{await page.locator('#use-dialog').waitFor({state:'hidden',timeout:3000});}
   catch(e){console.log('사용 실패:',await page.locator('#toast').textContent());throw e;}
 };
 await page.locator('#dock-inventory').click();await use('space-food-card');
 assert.equal(p.cardMarkers.filter(m=>m.itemId==='space-food-card').length,1);
 p.lastItemUseAt=0;await use('little-moon-card');p.lastItemUseAt=0;
 await use('space-food-card');
 assert.equal(p.cardMarkers.filter(m=>m.itemId==='space-food-card').length,2);
 assert.ok(p.cardMarkers.some(m=>m.itemId==='little-moon-card'));
 assert.equal(p.inventory.some(i=>i.id==='space-food-card'),false);
 await page.locator('[data-close="inventory-dialog"]').click();
 const pillar=MAP.objects.find(o=>o.id==='pillar-effects');Object.assign(p,{mapId:PLAZA_ID,x:pillar.x,y:pillar.y});publish();
 await page.locator('#interact-prompt').filter({hasText:pillar.name}).waitFor();await page.locator('#touch-interact').click();
 await page.locator('#temple-dialog').waitFor({state:'visible'});
 assert.equal(await page.locator('[data-effect-row]').filter({hasText:'우주 식량'}).count(),2);
 await page.screenshot({path:'.local/235-food-moon-board.png'});assert.deepEqual(errors,[]);
 await page.locator('#temple-close').click();p.inventory.push({id:'moon-rabbit-card',quantity:1});p.lastItemUseAt=0;publish();
 await page.locator('#dock-inventory').click();await page.locator('#bag-list li[data-item-id="moon-rabbit-card"] .slot-btn').click();await page.locator('#bag-detail .use').click();
 await page.locator('#draw-spread .draw-deck').waitFor();assert.equal(await page.locator('#draw-spread button').count(),1);
 await page.screenshot({path:'.local/236-rabbit-deck.png'});await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'.local/236-rabbit-deck-mobile.png'});
 await page.locator('#draw-spread .draw-deck').evaluate(button=>{button.click();button.click();});
 await page.locator('#draw-spread .revealed').waitFor();assert.equal(p.rabbitDraw,null);assert.equal(p.inventory.some(i=>i.id==='moon-rabbit-card'),false);
 await page.screenshot({path:'.local/236-rabbit-result.png'});assert.deepEqual(errors,[]);
 console.log('PASS: 달 보호 중에도 카드 더미 하나 클릭으로 뽑기·보상, 연속 클릭 중복 소모 없음, 390px 화면');
 console.log('PASS: 실제 가방 우주식량 사용 → 꼬마달 → 우주식량 재사용, 수량소모·보호유지·기둥2건·오류0');
}finally{await browser.close();await game.close();await rm(dir,{recursive:true,force:true});}
