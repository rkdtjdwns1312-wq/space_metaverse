import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {MAP,STREET} from '../shared/config.js';
const key='isolated-portrait-review',game=createClassroomServer({teacherKey:key,studentHours:false,dataDir:null});let browser,teacher;
try{
 const {port}=await game.listen(),url='http://127.0.0.1:'+port;
 teacher=io(url,{transports:['websocket']});await new Promise(r=>teacher.once('connect',r));
 const made=await teacher.timeout(3000).emitWithAck('room:create',{teacherKey:key,allowedNames:['모바일검사']});assert(made.ok);
 const room=game.store.rooms.get(made.room.code);browser=await chromium.launch({headless:true,channel:'msedge'});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.locator('#student-tab').click();await page.locator('#join-code').fill(made.room.code);await page.locator('#nickname').fill('모바일검사');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 for(let i=0;i<12&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');
 const p=[...room.players.values()].find(p=>p.role==='student');Object.assign(p.avatar,{level:5,constellationId:'hercules'});p.battleVitals=null;
 const initialPosition={mapId:p.mapId,x:p.x,y:p.y};
 assert.equal(await page.locator('#minimap-toggle').getAttribute('aria-expanded'),'false','mobile map starts collapsed');
 game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p,Date.now()));
 mkdirSync('.local/mobile-portrait',{recursive:true});
 const box=async s=>page.locator(s).boundingBox();
 for(const [width,height]of [[390,844],[320,568],[430,932],[768,1024]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(250);
  if(await page.locator('#minimap-toggle').getAttribute('aria-expanded')==='true')await page.locator('#minimap-toggle').click();
  const c=await box('#classroom-clock'),mute=await box('#mobile-audio-mute'),chat=await box('#chat-window-toggle'),hunt=await box('#hunting-time'),map=await box('#minimap-toggle');
  assert(c.y<chat.y&&mute.x>=c.x&&mute.x+mute.width<=c.x+c.width+1);
  assert(Math.abs(chat.y-hunt.y)<1&&Math.abs(hunt.y-map.y)<1);assert(chat.x+chat.width<hunt.x&&hunt.x+hunt.width<map.x);assert.equal(chat.height,44);
  const hp=await box('.vitals-hp'),mp=await box('.vitals-mp'),hud=await box('#vitals-hud'),attack=await box('#touch-attack'),skill=await box('#touch-skill'),interact=await box('#touch-interact'),settings=await box('#control-settings-open'),stick=await box('#joystick');
  assert.equal(hp.y,mp.y);assert(hp.x<mp.x);assert(hud.y+hud.height<=height-7&&hud.y+hud.height>=height-10);
  const centers=[attack,skill,stick].map(b=>b.y+b.height/2);assert(Math.max(...centers)-Math.min(...centers)<1);assert(interact.y+interact.height<settings.y);assert.equal(interact.x,settings.x);
  assert(attack.x+attack.width<skill.x&&skill.x+skill.width<interact.x&&settings.x+settings.width<stick.x);
  assert.equal(interact.width,44);assert.equal(settings.width,44);assert.equal(stick.width,96);assert(stick.x+stick.width<=width-11);
  if(width>=390)assert.equal(attack.width,88);
  assert(await page.locator('.combat-key-badge').first().isHidden());assert(await page.locator('#interact-key').isHidden());assert(await page.locator('#dock-avatar').isHidden());
  const original=await page.locator('#mobile-audio-mute').getAttribute('aria-pressed');await page.locator('#mobile-audio-mute').click();assert.notEqual(await page.locator('#mobile-audio-mute').getAttribute('aria-pressed'),original);await page.locator('#mobile-audio-mute').click();
  await page.screenshot({path:`.local/mobile-portrait/${width}-closed.png`});
  await page.locator('#mobile-functions-toggle').click();assert.equal(await page.locator('#mobile-functions-toggle').getAttribute('aria-expanded'),'true');
  const labels=await page.locator('#bottom-dock>.dock-button').allTextContents();assert.equal(labels.length,6);
  for(const button of await page.locator('#bottom-dock>.dock-button').all()){await button.scrollIntoViewIfNeeded();assert((await button.boundingBox()).height>=44,'menu keeps finger-sized targets');}
  await page.locator('#dock-avatar').scrollIntoViewIfNeeded();
  await page.screenshot({path:`.local/mobile-portrait/${width}-open.png`});
  await page.locator('#dock-inventory').click();assert(await page.locator('#inventory-dialog').isVisible());assert(await page.locator('#dock-avatar').isHidden());await page.keyboard.press('Escape');
  const transform=await box('[data-skill-slot="transformation"]');assert.equal(transform.width,44);assert(transform.x>=52&&transform.y+transform.height<=skill.y-6,'LV5 transform clears statuses and attacks');
  console.log('PASS portrait '+width+' clock/3 buttons/speaker/HP MP/combat/finger targets/scrolling menu/LV5');
 }

 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
 // Actual two-finger input, in both orders; releasing the other finger must
 // neither cancel the steering pointer nor transfer ownership to a third one.
 const cdp=await context.newCDPSession(page),ab=await box('#touch-attack'),jb=await box('#joystick');
 const a={id:1,x:ab.x+ab.width/2,y:ab.y+ab.height/2},j={id:2,x:jb.x+jb.width-8,y:jb.y+jb.height/2};
 await page.evaluate(()=>{window.touchTrace=[];for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,e=>window.touchTrace.push([type,e.target.id,e.pointerId,e.isPrimary]),true);});
 for(const first of ['attack','joystick']){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first==='attack'?a:j]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a,j]});await page.waitForTimeout(150);assert(p.input.x>.5,'two fingers steer, first='+first);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[a]});await page.waitForTimeout(80);if(!(p.input.x>.5))console.log('touch trace',first,await page.evaluate(()=>window.touchTrace));assert(p.input.x>.5,'attack finger release preserves steering');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(80);assert.equal(p.input.x,0);
 }
 await page.locator('#control-settings-open').click();assert.equal(await page.locator('#control-keyboard-options').getAttribute('open'),null);assert(await page.locator('#render-quality-select').isVisible());
 await page.locator('#control-keyboard-options summary').click();assert(await page.locator('#control-key-attack').isVisible());await page.keyboard.press('Escape');
 await page.locator('#chat-window-toggle').click();await page.locator('#chat-input').fill('작성 중인 글 유지');
 // Simulate the VisualViewport contract of an on-screen keyboard. This is
 // geometry coverage, not a claim of testing an actual iOS keyboard.
 await page.evaluate(()=>{const v=visualViewport;Object.defineProperty(v,'height',{configurable:true,value:360});Object.defineProperty(v,'offsetTop',{configurable:true,value:40});v.dispatchEvent(new Event('resize'));});
 await page.waitForTimeout(100);assert(await page.locator('body.mobile-keyboard-open').count());
 const chatBox=await box('#chat-dialog'),send=await box('#chat-form button[type=submit]');assert(chatBox.y>=48&&chatBox.y+chatBox.height<=392);assert(send.y+send.height<=392);assert.equal(await page.locator('#chat-input').inputValue(),'작성 중인 글 유지');
 await page.evaluate(()=>{delete visualViewport.height;delete visualViewport.offsetTop;visualViewport.dispatchEvent(new Event('resize'));});await page.locator('#chat-window-close').click();
 assert.equal(await page.locator('#chat-input').inputValue(),'작성 중인 글 유지');
 console.log('PASS two-finger input in both orders, keyboard settings disclosure, writing viewport and draft preservation');
 await page.locator('#new-mission-notice').click();assert(await page.locator('#student-missions-dialog').isVisible());await page.keyboard.press('Escape');
 const snooze=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.endsWith(':snoozed-until')).map(k=>Number(localStorage.getItem(k))));assert(snooze.some(t=>t>Date.now()+29*60*1000));
 const sendState=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p,Date.now()));
 await page.evaluate(()=>{window.originalNow=Date.now;Date.now=()=>window.originalNow()+29*60*1000;});sendState();await page.waitForTimeout(150);assert(await page.locator('#new-mission-notice').isHidden());
 await page.evaluate(()=>{Date.now=()=>window.originalNow()+31*60*1000;});sendState();await page.waitForTimeout(150);assert(await page.locator('#new-mission-notice').isVisible());
 await page.evaluate(()=>{Date.now=window.originalNow;});
 Object.assign(p,initialPosition);p.avatar.level=2;p.battleVitals=null;sendState();await page.waitForTimeout(250);
 const inputs=[];game.io.sockets.sockets.get(p.socketId).on('player:input',v=>inputs.push(v));
 const beforeTap={x:p.x,y:p.y};await page.touchscreen.tap(260,410);await page.waitForTimeout(250);assert(inputs.some(v=>Math.hypot(v.x,v.y)>0),'floor touch sends movement');assert(Math.hypot(p.x-beforeTap.x,p.y-beforeTap.y)>1,'server moves avatar after floor touch');
 await page.locator('#mobile-functions-toggle').tap();await page.waitForTimeout(150);assert.equal(p.input.x,0);assert.equal(p.input.y,0);
 await page.locator('#mobile-functions-toggle').tap();
 const joy=await box('#joystick');await page.mouse.move(joy.x+joy.width/2,joy.y+joy.height/2);await page.mouse.down();await page.mouse.move(joy.x+joy.width-4,joy.y+joy.height/2);await page.waitForTimeout(120);await page.mouse.up();await page.waitForTimeout(100);assert(inputs.some(v=>v.x>0));assert.equal(p.input.x,0);
 await page.locator('#touch-attack').tap();await page.locator('#control-settings-open').tap();assert(await page.locator('#control-settings-dialog').isVisible());await page.keyboard.press('Escape');
 console.log('PASS mission notice 30-minute snooze, floor touch, UI cancellation, joystick release and settings');
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(150);assert(await page.locator('#mobile-functions-toggle').isHidden());assert(await page.locator('#dock-avatar').isVisible());assert.equal(await page.locator('#dock-statuses').evaluate(el=>el.parentElement.id),'bottom-dock');
 await page.locator('#chat-window-toggle').click();const landscapeChat=await box('#chat-dialog'),landscapeSend=await box('#chat-form button[type=submit]');assert(landscapeChat.y<12&&landscapeSend.y+landscapeSend.height<390);assert(await page.locator('#chat-window-close').isVisible());await page.locator('#chat-window-close').click();
 const desktop=await browser.newContext({viewport:{width:1280,height:900}}),d=await desktop.newPage();await d.goto(url);await d.evaluate(()=>document.body.classList.add('joined'));assert(await d.locator('#mobile-functions-toggle').isHidden());assert(await d.locator('#mobile-audio-mute').isHidden());assert(await d.locator('#audio-toggle').isVisible());
 console.log('PASS landscape menu restored and desktop controls unchanged');
 await page.setViewportSize({width:390,height:844});p.journey={...p.journey,stage:6,goals:[],claimedAt:Array(5).fill(0),practiceUntil:0};
 async function approach(map,object){Object.assign(p,{mapId:map.id,x:object.x,y:object.y+(object.radius||40)+30,input:{x:0,y:0,at:0}});sendState();await page.waitForFunction(id=>document.querySelector('#interact-prompt')?.dataset.objectId===id,object.id);}
 for(const [kind,id]of [['shop','#shop-dialog'],['energy-shop','#energy-shop-dialog'],['crafting','#crafting-dialog'],['cozy-room','.cozy-dialog']]){
  await approach(STREET,STREET.objects.find(o=>o.kind===kind));const prompt=await box('#interact-prompt'),combat=await box('#touch-attack');assert(prompt.y>110&&prompt.y+prompt.height<combat.y,'prompt stays out of combat and top HUD');
  await page.locator('#interact-prompt').click();await page.locator(id+'[open]').waitFor();await page.waitForTimeout(100);await page.screenshot({path:'.local/mobile-portrait/interaction-'+kind+'.png'});await page.locator(id+'[open] .dialog-pinned-close').click();await page.locator(id+'[open]').waitFor({state:'hidden'});
 }
 await approach(MAP,MAP.objects.find(o=>o.kind==='starlight-archive'));await page.locator('#interact-prompt').click();await page.locator('[data-archive-new]').click();await page.locator('.star-archive [name=title]').fill('모바일 입력 검사');await page.locator('.star-archive [name=body]').fill('키보드가 있어도 글을 보며 작성해요.');
 await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:360});Object.defineProperty(visualViewport,'offsetTop',{configurable:true,value:24});visualViewport.dispatchEvent(new Event('resize'));});await page.waitForTimeout(100);
 await page.locator('.archive-save').scrollIntoViewIfNeeded();const save=await box('.archive-save');assert(save.y>=32&&save.y+save.height<=376);assert.equal(await page.locator('.star-archive [name=body]').inputValue(),'키보드가 있어도 글을 보며 작성해요.');
 await page.screenshot({path:'.local/mobile-portrait/archive-keyboard.png'});await page.evaluate(()=>{delete visualViewport.height;delete visualViewport.offsetTop;visualViewport.dispatchEvent(new Event('resize'));});
 page.once('dialog',d=>d.dismiss());await page.locator('.star-archive .dialog-pinned-close').click();assert(await page.locator('.star-archive').isVisible(),'unsaved close guard retained');
 page.once('dialog',d=>d.accept());await page.locator('.star-archive .dialog-pinned-close').click();assert(await page.locator('.star-archive').isHidden());
 console.log('PASS nearby shops/crafting/room close controls, archive keyboard/save visibility and unsaved-close guard');
 assert.deepEqual(errors,[]);
 console.log('PASS browser errors 0');
}finally{await browser?.close();teacher?.disconnect();await game.close();}
