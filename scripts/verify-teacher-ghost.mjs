import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
const out='.local/teacher-ghost',key='isolated-teacher-ghost-key',errors=[];
const game=createClassroomServer({teacherKey:key,studentHours:false});let browser;
await mkdir(out,{recursive:true});
try{
  const {port}=await game.listen(),url='http://127.0.0.1:'+port;
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),args:['--no-proxy-server']});
  const teacherPage=await browser.newPage({viewport:{width:1280,height:900}}),studentPage=await browser.newPage({viewport:{width:1280,height:900}});
  for(const page of [teacherPage,studentPage]){
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{window.teacherPaints=0;const fillText=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(this.canvas.id==='world'&&String(text).includes('선생님'))window.teacherPaints++;return fillText.call(this,text,...args);};});
  }
  await teacherPage.goto(url);await teacherPage.locator('#teacher-tab').click();await teacherPage.locator('#teacher-key').fill(key);
  await fillNewClass(teacherPage,['유령검사']);await teacherPage.locator('#teacher-form .submit').click();await teacherPage.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0],teacher=[...room.players.values()].find(p=>p.role==='teacher');
  await studentPage.goto(url);await studentPage.locator('#student-tab').click();await studentPage.locator('#join-code').fill(room.code);await studentPage.locator('#nickname').fill('유령검사');await studentPage.locator('#student-pin').fill('1234');await studentPage.locator('#student-form .submit').click();await studentPage.locator('#lobby').waitFor({state:'hidden'});
  const continueGame=studentPage.getByRole('button',{name:'게임에서 진행하기'});if(await continueGame.isVisible())await continueGame.click();
  const student=[...room.players.values()].find(p=>p.role==='student');Object.assign(teacher,{x:student.x+120,y:student.y});
  for(const p of room.players.values())game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
  await studentPage.waitForFunction(()=>window.teacherPaints>2);
  assert.equal(await studentPage.locator('#teacher-ghost-toggle').isVisible(),false);
  await teacherPage.locator('#teacher-ghost-toggle').waitFor({state:'visible'});
  const above=await teacherPage.evaluate(()=>{const a=document.getElementById('teacher-ghost-toggle').getBoundingClientRect(),b=document.getElementById('vitals-hud').getBoundingClientRect();return a.bottom<=b.top&&a.top>=0;});assert(above);
  await studentPage.screenshot({path:out+'/student-visible.png'});
  await teacherPage.locator('#teacher-ghost-toggle').click();await teacherPage.waitForFunction(()=>document.getElementById('teacher-ghost-toggle').getAttribute('aria-pressed')==='true');
  assert.equal(teacher.teacherGhost,true);await studentPage.waitForTimeout(180);await studentPage.evaluate(()=>window.teacherPaints=0);await studentPage.waitForTimeout(250);assert.equal(await studentPage.evaluate(()=>window.teacherPaints),0);
  await teacherPage.evaluate(()=>window.teacherPaints=0);await teacherPage.waitForTimeout(150);assert((await teacherPage.evaluate(()=>window.teacherPaints))>0);
  await studentPage.screenshot({path:out+'/student-hidden.png'});await teacherPage.screenshot({path:out+'/teacher-on.png'});
  await teacherPage.locator('#teacher-ghost-toggle').click();await studentPage.waitForFunction(()=>window.teacherPaints>2);assert.equal(teacher.teacherGhost,false);
  await studentPage.screenshot({path:out+'/student-restored.png'});
  await teacherPage.setViewportSize({width:390,height:844});await teacherPage.waitForTimeout(150);
  assert(await teacherPage.locator('#teacher-ghost-toggle').isVisible());assert.equal(await teacherPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await teacherPage.screenshot({path:out+'/teacher-mobile.png'});
  assert.deepEqual(errors,[]);console.log('PASS real student canvas visible→hidden→visible, teacher self stays, teacher-only button above HP/MP, mobile, JS errors0');
}finally{await browser?.close();await game.close();}
