import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {addPlanet} from '../server/world.js';
import {INTERIOR,interiorIdOf} from '../shared/config.js';
import {fillNewClass} from './class-setup.mjs';
const key='isolated-interior-v2',game=createClassroomServer({teacherKey:key,studentHours:false});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`,errors=[];
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),args:['--no-proxy-server']});
await mkdir('.local/interior-v2',{recursive:true});
try{
 const teacher=await browser.newPage({viewport:{width:1440,height:1000}});teacher.on('pageerror',e=>errors.push(e.message));
 await teacher.goto(url);await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);await fillNewClass(teacher,['꾸미기검사']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0],tp=[...room.players.values()].find(p=>p.role==='teacher');
 const student=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});student.on('pageerror',e=>errors.push(e.message));
 await student.goto(url+'/?class='+room.code);await student.locator('#student-tab').click();await student.locator('#join-code').fill(room.code);await student.locator('#nickname').fill('꾸미기검사');await student.locator('#student-pin').fill('1234');await student.locator('#student-form .submit').click();await student.locator('#lobby').waitFor({state:'hidden'});
 const sp=[...room.players.values()].find(p=>p.role==='student');
 const planet=addPlanet(room,{name:'미술행성',description:'',x:2940,y:2070,color:'#d5c4f3',rules:['친구를 존중하고 함께 안전하게 생활해요.','서로의 작품을 소중히 여겨요.'],templateId:'art'});sp.avatar.departmentId=planet.id;
 const publish=p=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 const move=(p,id)=>{const o=INTERIOR.objects.find(o=>o.id===id);Object.assign(p,{mapId:interiorIdOf(planet.id),x:o.x,y:o.y+o.radius+20,input:{x:0,y:0,at:0}});publish(p);};
 for(const [page,p] of [[teacher,tp],[student,sp]]){
  for(let n=0;n<12&&await page.locator('dialog[open]').count();n++)await page.keyboard.press('Escape');
  move(p,'department-control-machine');await page.waitForTimeout(1200);console.log('control',p.role,p.mapId,p.x,p.y,await page.locator('#interact-object').textContent());await page.screenshot({path:`.local/interior-v2/control-${p.role}.png`});await page.locator('#touch-interact').click();await page.locator('#interior-decor-dialog').waitFor({state:'visible'});
  const tabs=page.locator('#interior-decor-targets [role=tab]');assert.equal(await tabs.count(),5);
  for(let i=0;i<5;i++){await tabs.nth(i).click();assert.equal(await page.locator('#interior-decor-shapes input').count(),6);assert.equal(await page.locator('#interior-decor-shapes input:disabled').count(),p.role==='teacher'?0:3);assert.equal(await page.locator('#interior-decor-shapes img').count(),6);await page.waitForFunction(()=>[...document.querySelectorAll('#interior-decor-shapes img')].every(i=>i.complete&&i.naturalWidth));}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`.local/interior-v2/picker-${p.role}.png`});await page.keyboard.press('Escape');
 }
 await teacher.evaluate(async()=>{const {preloadInteriorArt}=await import('/interior-art.js');await preloadInteriorArt();});
 const variants={room:['default','star','grid','tier1','tier2','tier3'],mailbox:['default','star','moon','tier1','tier2','tier3'],board:['default','tablet','scroll','tier1','tier2','tier3'],'report-board':['default','hex','star','tier1','tier2','tier3'],'warning-rock':['default','crystal','meteor','tier1','tier2','tier3']};
 for(let i=0;i<6;i++){
  planet.interiorDecor=Object.fromEntries(Object.entries(variants).map(([id,shapes])=>[id,{colorId:'default',shapeId:shapes[i]}]));
  move(tp,'board');await teacher.waitForTimeout(300);await teacher.locator('#interior-board-content').waitFor({state:'visible'});
  assert.equal(await teacher.locator('#interior-board-rules').evaluate(e=>e.scrollWidth>e.clientWidth),false);
  await teacher.screenshot({path:`.local/interior-v2/room-${i}.png`});
 }
 // Use production canvas renderers to inspect every complete room and prop at once.
 await teacher.evaluate(async()=>{
  const art=await import('/interior-art.js'),{INTERIOR}=await import('/shared/config.js'),{INTERIOR_VARIANT_ART}=await import('/interior-visuals.js');
  const canvas=document.createElement('canvas');canvas.id='art-review';canvas.width=1800;canvas.height=900;canvas.style='position:fixed;inset:0;z-index:99999;width:100vw;height:100vh;background:#eee';document.body.append(canvas);const c=canvas.getContext('2d');
  for(let i=0;i<6;i++){const planet={interiorDecor:Object.fromEntries(Object.entries(INTERIOR_VARIANT_ART).map(([kind,variants])=>[kind,{shapeId:Object.keys(variants)[i],colorId:'original'}]))};c.save();c.translate((i%3)*600,Math.floor(i/3)*450);c.scale(.5,.5);art.drawInteriorFloor(c,INTERIOR,planet);for(const o of INTERIOR.objects)art.drawInteriorProp(c,o,planet);c.restore();}
 });
 await teacher.locator('#art-review').screenshot({path:'.local/interior-v2/all-six-rooms.png'});
 assert.deepEqual(errors,[]);console.log('PASS interior 5 targets × 6 loaded variants, teacher/student picker, mobile overflow, six room board layouts; JS errors 0');
}finally{await browser.close();await game.close();}
