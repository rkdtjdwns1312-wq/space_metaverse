import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {MAP,PLAZA_ID} from '../shared/config.js';
import {constellationOf} from '../shared/constellations.js';
import {isFree} from '../server/world.js';
function instrument(){
 const sources=new WeakMap(),proto=CanvasRenderingContext2D.prototype,draw=proto.drawImage,get=proto.getImageData,put=proto.putImageData;
 window.spriteTransforms={};window.walkTransforms={};
 proto.drawImage=function(image,...args){const paths=image?.src?new Set([new URL(image.src,location.href).pathname]):sources.get(image);
  if(paths&&this.canvas.id==='world')for(const path of paths){window.spriteTransforms[path]=this.getTransform().a;if(!image.src)window.walkTransforms[path]=this.getTransform().a;}
  else if(paths)sources.set(this.canvas,new Set([...(sources.get(this.canvas)||[]),...paths]));return draw.call(this,image,...args);};
 proto.getImageData=function(...args){const result=get.apply(this,args),paths=sources.get(this.canvas);if(paths)sources.set(result,new Set(paths));return result;};
 proto.putImageData=function(data,...args){const paths=sources.get(data);if(paths)sources.set(this.canvas,new Set(paths));return put.call(this,data,...args);};
}
const key='friend-walk-option-isolated',game=createClassroomServer({teacherKey:key,studentHours:false});
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']}),errors=[];
try{
 await mkdir('.local/performance',{recursive:true});const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
 const student=await browser.newPage({viewport:{width:1280,height:800}}),teacher=await browser.newPage({viewport:{width:1280,height:800}});
 for(const [label,page] of [['student',student],['teacher',teacher]]){page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(label+': '+e.message));await page.addInitScript(instrument);}
 await teacher.goto(url);await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);await fillNewClass(teacher,['1']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0];await student.goto(url);await student.locator('#student-tab').click();await student.locator('#join-code').fill(room.code);await student.locator('#nickname').fill('1');await student.locator('#student-pin').fill('1234');await student.locator('#student-form .submit').click();await student.locator('#lobby').waitFor({state:'hidden'});if(await student.locator('#tutorial-dialog').isVisible().catch(()=>false))await student.locator('#tutorial-later').click();if(await teacher.locator('#tutorial-dialog').isVisible().catch(()=>false))await teacher.locator('#tutorial-later').click();
 const self=[...room.players.values()].find(p=>p.role==='student'),peer=[...room.players.values()].find(p=>p.role==='teacher');
 self.avatar.level=5;self.avatar.constellationId='aries';self.mapId=PLAZA_ID;peer.mapId=PLAZA_ID;
 let safe;for(let y=250;y<MAP.height-250&&!safe;y+=80)for(let x=300;x<MAP.width-300&&!safe;x+=80)if([-180,0,180].every(dx=>[-140,0,140].every(dy=>isFree(room,x+dx,y+dy,self.id,PLAZA_ID,false,self))))safe={x,y};assert.ok(safe,'safe placement');
 Object.assign(self,safe,{facingX:1,input:{x:0,y:0,at:0}});Object.assign(peer,{x:safe.x+120,y:safe.y+100,facingX:1,input:{x:0,y:0,at:0}});
 const publish=()=>{for(const viewer of [self,peer])game.io.to(viewer.socketId).emit('room:state',game.store.snapshot(room,viewer,Date.now()));};publish();
 const ownSprite=constellationOf('aries',4).sprite,peerSprite='/assets/avatars/teacher/star-sovereign.png';
 await Promise.all([student,teacher].map(p=>p.waitForFunction(path=>!!window.spriteTransforms[path],ownSprite)));
 async function setMode(mode){await student.locator('#control-settings-open').click();await student.locator('#render-quality-select').selectOption(mode);await student.locator('#control-settings-save').click();await student.locator('#control-settings-close').click();await student.waitForFunction(mode=>document.querySelector('#world').dataset.renderMode===mode,mode);}
 async function setFriendReduction(enabled){await student.locator('#control-settings-open').click();const toggle=student.locator('#friend-walk-reduction-toggle');if(enabled)await toggle.check();else await toggle.uncheck();await student.locator('#control-settings-save').click();await student.locator('#control-settings-close').click();assert.equal(await student.evaluate(()=>localStorage.getItem('woozooclass-friend-walk-reduction-v1')),String(enabled));}
 async function moveAndObserve(label){
  Object.assign(self,{x:safe.x-150,y:safe.y,input:{x:0,y:0,at:0}});Object.assign(peer,{x:safe.x-150,y:safe.y+80,input:{x:0,y:0,at:0}});publish();await student.waitForTimeout(350);
  const before={selfX:self.x,peerX:peer.x};await student.evaluate(()=>window.walkTransforms={});await teacher.evaluate(()=>window.walkTransforms={});
  await Promise.all([student.locator('#world').focus(),teacher.locator('#world').focus()]);await Promise.all([student.keyboard.down('d'),teacher.keyboard.down('d')]);await student.waitForTimeout(360);await Promise.all([student.keyboard.up('d'),teacher.keyboard.up('d')]);await student.waitForTimeout(300);
  assert.ok(self.x>before.selfX+5,`${label}: self coordinate moved (${before.selfX}->${self.x})`);assert.ok(peer.x>before.peerX+5,`${label}: peer coordinate moved (${before.peerX}->${peer.x})`);
  const ownFrames=await student.evaluate(()=>Object.keys(window.walkTransforms));const peerFrames=ownFrames;
  const metrics={ownX:self.x,peerX:peer.x,ownFrames,peerFrames};
  return metrics;
 }
 await setMode('normal');let result=await moveAndObserve('normal, option off');assert.ok(result.ownFrames.includes(ownSprite),'normal/off self walk frame rendered');assert.ok(result.ownFrames.includes(peerSprite),'normal/off peer walk frame rendered');
 await setFriendReduction(true);await student.locator('#control-settings-open').click();assert.equal(await student.locator('#friend-walk-reduction-toggle').isChecked(),true,'reopen restores checkbox');await student.locator('#control-settings-close').click();result=await moveAndObserve('normal, option on');assert.ok(result.ownFrames.includes(ownSprite),'normal/on self walk frame rendered');assert.ok(!result.peerFrames.includes(peerSprite),'normal/on peer walk frame suppressed');
 await student.reload();assert.equal(await student.evaluate(()=>localStorage.getItem('woozooclass-friend-walk-reduction-v1')),'true','reload preserves preference');await student.locator('#student-tab').click();await student.locator('#join-code').fill(room.code);await student.locator('#nickname').fill('1');await student.locator('#student-pin').fill('1234');await student.locator('#student-form .submit').click();await student.locator('#lobby').waitFor({state:'hidden'});for(let i=0;i<12&&await student.locator('dialog[open]').count();i++)await student.keyboard.press('Escape');Object.assign(self,safe,{mapId:PLAZA_ID});Object.assign(peer,{x:safe.x+120,y:safe.y+100,mapId:PLAZA_ID});publish();await student.waitForFunction(()=>!!document.querySelector('#world').dataset.selfSprite);result=await moveAndObserve('reload, option on');assert.ok(result.ownFrames.includes(ownSprite));assert.ok(!result.peerFrames.includes(peerSprite));
 await setMode('low');result=await moveAndObserve('low, option on');assert.ok(result.ownFrames.includes(ownSprite),'low/on self walk frame rendered');assert.ok(!result.peerFrames.includes(peerSprite),'low/on peer walk frame suppressed');
 await setFriendReduction(false);result=await moveAndObserve('low, option off');assert.ok(!result.ownFrames.includes(ownSprite),'low/off self walk frame disabled');assert.ok(!result.peerFrames.includes(peerSprite),'low/off peer walk frame disabled');
 await setMode('normal');await setFriendReduction(true);await student.emulateMedia({reducedMotion:'reduce'});result=await moveAndObserve('reduced motion, option on');assert.ok(!result.ownFrames.includes(ownSprite),'OS reduced motion suppresses own walk frames');assert.ok(!result.peerFrames.includes(peerSprite),'OS reduced motion suppresses peer walk frames');
 assert.deepEqual(errors,[]);const report={checks:['normal option off: own+peer frames and coordinates move','normal option on: own frames remain, peer walk frames stop while coordinates move','checkbox save/reopen and page reload persist','low option on preserves own frames only; low option off restores default frame suppression','OS reduce-motion suppresses both'],result,errors};await import('node:fs/promises').then(({writeFile})=>writeFile('.local/performance/friend-walk-option.json',JSON.stringify(report,null,2)));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await game.close();}
