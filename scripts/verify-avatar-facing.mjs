import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {CONSTELLATIONS,constellationOf} from '../shared/constellations.js';
const LV2_LEFT_FACING=new Set(['corvus','taurus','leo','ophiuchus','cancer','cygnus','aries']);
const LV3_LEFT_FACING=new Set(['taurus','leo','cancer']);
const LV4_LEFT_FACING=new Set(['ophiuchus','corvus']);
const key='facing-layout-isolated-key',game=createClassroomServer({teacherKey:key,studentHours:false});
const url=`http://127.0.0.1:${(await game.listen()).port}`;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),errors=[];
try{
 await mkdir('.local',{recursive:true});
 const teacher=await browser.newPage(),page=await browser.newPage({viewport:{width:1440,height:960}});
 page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const old=CanvasRenderingContext2D.prototype.drawImage;window.spriteTransforms={};CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(this.canvas.id==='world'&&image?.src)window.spriteTransforms[new URL(image.src).pathname]=this.getTransform().a;return old.call(this,image,...args);};});
 await teacher.goto(url);await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);await fillNewClass(teacher,['1']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0];await page.goto(url);await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill('1');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const p=[...room.players.values()].find(p=>p.role==='student');
 const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 await teacher.evaluate(()=>{const old=CanvasRenderingContext2D.prototype.drawImage;window.spriteTransforms={};CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(this.canvas.id==='world'&&image?.src)window.spriteTransforms[new URL(image.src).pathname]=this.getTransform().a;return old.call(this,image,...args);};});
 for(const c of CONSTELLATIONS)for(const level of [2,3,4,5])for(const sign of [-1,1]){
  p.avatar.level=level;p.avatar.constellationId=c.id;p.facingX=sign;const stage=constellationOf(c.id,level),sprite=stage.sprite;
  const expectedSign=sign*(((level===2&&LV2_LEFT_FACING.has(c.id))||(level===3&&LV3_LEFT_FACING.has(c.id))||(level===4&&LV4_LEFT_FACING.has(c.id)))?-1:1);
  await page.evaluate(path=>{delete window.spriteTransforms[path]},sprite);publish();
  await page.waitForFunction(({sprite,expectedSign})=>Math.sign(window.spriteTransforms[sprite])===expectedSign,{sprite,expectedSign});
 }
 console.log('PASS: all 16 constellations × LV2-5 × left/right: actual canvas drawImage transform matches independent LV2/LV3/LV4 golden sets');
 Object.assign(p,{x:1100,y:1150,facingX:1});p.avatar.level=5;p.avatar.constellationId='aries';publish();const observer=[...room.players.values()].find(p=>p.role==='teacher');game.io.to(observer.socketId).emit('room:state',game.store.snapshot(room,observer));
 await page.locator('#world').focus();await page.keyboard.down('a');await page.waitForTimeout(160);await page.keyboard.up('a');await page.waitForFunction(()=>document.getElementById('world').dataset.selfFacingX==='-1');
 await teacher.waitForFunction(path=>Math.sign(window.spriteTransforms[path])===-1,constellationOf('aries',5).sprite);
 await page.keyboard.down('w');await page.waitForTimeout(100);await page.keyboard.up('w');assert.equal(p.facingX,-1);await page.waitForTimeout(100);assert.equal(await page.locator('#world').getAttribute('data-self-facing-x'),'-1');
 await page.keyboard.down('d');await page.waitForTimeout(160);await page.keyboard.up('d');await page.waitForFunction(()=>document.getElementById('world').dataset.selfFacingX==='1');
 await teacher.waitForFunction(path=>Math.sign(window.spriteTransforms[path])===1,constellationOf('aries',5).sprite);
 await page.keyboard.press('q');await page.waitForFunction(()=>Math.abs(Number(document.getElementById('world').dataset.lastAttackReach)-94.29425)<.0001);
 assert.ok(Math.abs(Number(await page.locator('#world').getAttribute('data-last-attack-radius'))-54.7515)<.0001);
 await page.keyboard.press('e');await page.waitForFunction(()=>Math.abs(Number(document.getElementById('world').dataset.lastSkillOrigin)-60.835)<.0001);
 await page.screenshot({path:'.local/217-right.png'});
 await page.keyboard.down('a');await page.waitForTimeout(160);await page.keyboard.up('a');await page.waitForFunction(()=>document.getElementById('world').dataset.selfFacingX==='-1');await page.screenshot({path:'.local/217-left.png'});
 console.log('PASS: actual A/D movement changes facing in self and peer canvas; W/idle preserve; Q radius54.7515; LV5 Q reach94.29425 and E origin60.835');
 assert.deepEqual(errors,[]);
}finally{await browser.close();await game.close();}
