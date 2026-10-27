import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {STREET} from '../shared/config.js';
import {fillNewClass} from './class-setup.mjs';
const key='isolated-control-verification',game=createClassroomServer({teacherKey:key,studentHours:false}),events=[],errors=[];
game.io.on('connection',socket=>socket.onAny(name=>{if(['combat:attack','combat:skill','shop:energy:open'].includes(name))events.push(name);}));
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'msedge':undefined,args:['--no-proxy-server']});
const close=async page=>{for(let i=0;i<12&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');};
try{
 const context=await browser.newContext({viewport:{width:1280,height:900},hasTouch:true}),page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['키검증']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});await close(page);
 const room=game.store.rooms.get(await page.locator('#room-code').textContent()),player=[...room.players.values()].find(p=>p.role==='teacher'),shop=STREET.objects.find(o=>o.kind==='energy-shop');Object.assign(player,{mapId:STREET.id,x:shop.x+200,y:shop.y});game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));await page.locator('#interact-prompt').filter({hasText:'우주에너지'}).waitFor({state:'visible'});
 await page.locator('#control-settings-open').click();await page.locator('#control-key-attack').selectOption('KeyJ');await page.locator('#control-key-skill').selectOption('KeyJ');await page.locator('#control-settings-save').click();await page.locator('#control-settings-message').filter({hasText:'서로 다른 키'}).waitFor();assert.equal(await page.locator('#touch-attack .combat-key-badge').textContent(),'Q');
 await page.locator('#control-key-skill').selectOption('KeyK');await page.locator('#control-key-interact').selectOption('KeyL');await page.locator('#control-settings-save').click();await page.locator('#control-settings-message').filter({hasText:'저장했어요'}).waitFor();await page.locator('#control-settings-close').click();assert.equal(await page.locator('#touch-attack .combat-key-badge').textContent(),'J');assert.equal(await page.locator('#touch-skill .combat-key-badge').textContent(),'K');assert.equal(await page.locator('#interact-key').textContent(),'L');
 await page.locator('#world').focus();events.length=0;await page.keyboard.press('q');await page.keyboard.press('e');await page.keyboard.press('f');await page.waitForTimeout(100);assert.deepEqual(events,[]);
 await page.keyboard.press('j');await page.waitForTimeout(100);assert(events.includes('combat:attack'));await page.keyboard.press('k');await page.waitForTimeout(100);assert(events.includes('combat:skill'));await page.keyboard.press('l');await page.locator('#energy-shop-dialog').waitFor({state:'visible'});assert(events.includes('shop:energy:open'));await close(page);
 console.log('PASS new J/K/L actions, old Q/E/F inactive, duplicate rejection, shop interaction at distance200 (old140)');
 await page.locator('#control-settings-open').click();
 for(const [action,code] of [['attack','Digit1'],['skill','Digit2'],['interact','Digit6']])await page.locator('#control-key-'+action).selectOption(code);
 await page.locator('#control-settings-save').click();await page.locator('#control-settings-close').click();
 assert.equal(await page.locator('#touch-attack .combat-key-badge').textContent(),'1');assert.equal(await page.locator('#interact-key').textContent(),'6');
 await page.locator('#world').focus();await page.waitForTimeout(1100);events.length=0;await page.keyboard.press('1');await page.waitForTimeout(100);assert(events.includes('combat:attack'));await page.keyboard.press('2');await page.waitForTimeout(100);assert(events.includes('combat:skill'));await page.keyboard.press('6');await page.locator('#energy-shop-dialog').waitFor({state:'visible'});assert(events.includes('shop:energy:open'));await close(page);
 console.log('PASS top-row 1/2/6 settings invoke attack, skill and interaction');
 await page.locator('#control-settings-open').click();
 for(const [action,code] of [['attack','KeyJ'],['skill','KeyK'],['interact','KeyL']])await page.locator('#control-key-'+action).selectOption(code);
 await page.locator('#control-settings-save').click();await page.locator('#control-settings-close').click();
 const student=await context.newPage();student.setDefaultTimeout(15000);student.on('pageerror',e=>errors.push(e.message));await student.goto(url);await student.locator('#student-tab').click();await student.locator('#join-code').fill(room.code);await student.locator('#nickname').fill('키검증');await student.locator('#student-pin').fill('1234');await student.locator('#student-form .submit').click();await student.locator('#lobby').waitFor({state:'hidden'});await close(student);
 for(const layoutPage of [page,student]){const page=layoutPage;
 for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:844,height:390},{width:801,height:900},{width:820,height:900},{width:640,height:360},{width:320,height:568}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(250);
  const [gear,interact,dock]=await Promise.all(['#control-settings-open','#touch-interact','#bottom-dock'].map(s=>page.locator(s).boundingBox()));assert(Math.abs(gear.width-gear.height)<1,JSON.stringify({viewport,gear,interact,dock}));assert(gear.x>=interact.x+interact.width);assert(gear.x+gear.width<=viewport.width);
  const overlap=(a,b)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y);assert.equal(overlap(gear,dock),false,JSON.stringify({viewport,gear,dock}));assert.equal(overlap(interact,dock),false,JSON.stringify({viewport,interact,dock}));
  const [attack,skill,chat]=await Promise.all(['#touch-attack','#touch-skill','#chat-window-toggle'].map(s=>page.locator(s).boundingBox()));
  for(const control of [gear,interact,attack,skill]){assert(control.y>=0&&control.y+control.height<=viewport.height,JSON.stringify({viewport,control}));assert.equal(overlap(control,chat),false,JSON.stringify({viewport,control,chat}));assert.equal(overlap(control,dock),false,JSON.stringify({viewport,control,dock}));}
  for(const control of [gear,interact])for(const combat of [attack,skill])assert.equal(overlap(control,combat),false,JSON.stringify({viewport,control,combat}));
  await page.screenshot({path:`.local/controls-${page===student?'student-':''}${viewport.width}.png`});await page.locator('#control-settings-open').click();await page.locator('#control-settings-dialog').waitFor({state:'visible'});await page.locator('#control-settings-close').click();
  if(page===student){await page.locator('#journey-details').click();await page.locator('#tutorial-dialog').waitFor({state:'visible'});await page.locator('#tutorial-later').click();}
 }
 }
 console.log('PASS teacher and student: square gear right of interaction, no combat/chat/dock overlap, seven desktop/portrait/landscape viewports');
 await page.reload();assert.equal(await page.locator('#touch-attack .combat-key-badge').textContent(),'J');assert.equal(await page.locator('#interact-key').textContent(),'L');console.log('PASS custom keys survive refresh');
 await student.locator('#control-settings-open').click();await student.locator('#control-settings-default').click();await student.locator('#control-settings-save').click();await student.locator('#control-settings-close').click();assert.equal(await student.locator('#touch-attack .combat-key-badge').textContent(),'Q');assert.equal(await student.locator('#touch-skill .combat-key-badge').textContent(),'E');assert.equal(await student.locator('#interact-key').textContent(),'F');await page.reload();assert.equal(await page.locator('#touch-attack .combat-key-badge').textContent(),'Q');console.log('PASS default button restores and persists Q/E/F');
 await page.evaluate(()=>localStorage.setItem('woozooclass-control-keys-v1','{"attack":"KeyW","skill":"KeyW","interact":"F5"}'));await page.reload();assert.equal(await page.locator('#touch-attack .combat-key-badge').textContent(),'Q');assert.equal(await page.locator('#interact-key').textContent(),'F');console.log('PASS invalid saved controls safely fall back to defaults');
 assert.deepEqual(errors,[]);console.log('PASS browser errors 0');
}finally{await browser.close();await game.close();}
