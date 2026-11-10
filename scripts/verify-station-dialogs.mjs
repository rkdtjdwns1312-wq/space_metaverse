import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {STAR_STATION} from '../shared/config.js';
const inspect=process.argv.includes('--inspect'),key='station-dialog-test',game=createClassroomServer({teacherKey:key,studentHours:false});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;let browser,socket;
try{
 browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});socket=io(url,{transports:['websocket'],reconnection:false});await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
 const created=await socket.timeout(5000).emitWithAck('room:create',{teacherKey:key,title:'발전소 화면 검사',allowedNames:['화면 학생']});assert.ok(created.ok);
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.locator('#student-tab').click();await page.locator('#join-code').fill(created.room.code);await page.locator('#nickname').fill('화면 학생');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});if(await page.locator('#tutorial-later').isVisible())await page.locator('#tutorial-later').click();
 const room=game.store.rooms.get(created.room.code),student=[...room.players.values()].find(p=>p.role==='student');
 await mkdir('.local/station-dialogs',{recursive:true});
 const ids={math:'learning-station-dialog',english:'learning-station-dialog',history:'history-library-dialog',science:'science-library-dialog',culture:'culture-library-dialog',art:'art-studio-dialog'};
 for(const size of (inspect?[{width:1280,height:900}]:[{width:1280,height:900},{width:390,height:844},{width:844,height:390}])){
  await page.setViewportSize(size);
  for(const kind of ['english','math','history','science','culture','art']){
   const object=STAR_STATION.objects.find(o=>o.kind===kind+'-station');Object.assign(student,{mapId:STAR_STATION.id,x:object.x,y:object.y+110,input:{x:0,y:0,at:0}});game.io.to(student.socketId).emit('room:state',game.store.snapshot(room,student));
   await page.waitForFunction(id=>document.getElementById('interact-prompt').dataset.objectId===id,object.id);await page.locator('#world').focus();await page.keyboard.press('f');const dialog=page.locator('#'+ids[kind]);await dialog.waitFor({state:'visible'});await dialog.locator('.dialog-pinned-close').waitFor();
   await page.screenshot({path:`.local/station-dialogs/${inspect?'before-':''}${kind}-${size.width}.png`});
   if(!inspect){
    async function checkHeader(){
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     const close=dialog.locator('.dialog-pinned-close'),heading=dialog.locator('h2').first(),before=await close.boundingBox(),title=await heading.boundingBox();
     assert.ok(before.x>=title.x+title.width-1,kind+' close stays right of title');assert.ok(Math.abs((before.y+before.height/2)-(title.y+title.height/2))<45,kind+' title row');
     await dialog.locator(':scope > .dialog-scroll-body').evaluate(e=>e.scrollTop=e.scrollHeight);await page.waitForTimeout(40);const after=await close.boundingBox();assert.ok(Math.abs(after.y-before.y)<2,kind+' close remains fixed');
     assert.ok(after.x>=0&&after.y>=0&&after.x+after.width<=size.width&&after.y+after.height<=size.height,kind+' close within viewport');
     assert.ok(await close.evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;}),kind+' close clickable');
     assert.ok(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),kind+' no horizontal overflow');
     await dialog.locator(':scope > .dialog-scroll-body').evaluate(e=>e.scrollTop=0);
    }
    await checkHeader();
    if(kind==='math'||kind==='english'){
     assert.equal(await page.locator('#learning-change-level').count(),0);assert.equal(await page.locator('#learning-prompt').isVisible(),false);
     await page.locator('#learning-start').click();await page.locator('.learning-answer').first().waitFor();await checkHeader();assert.equal(await page.locator('.learning-answer').count(),4);
     let question=student[kind+'Run'].question;const wrong=question.choices.find(answer=>answer!==question.answer);
     await page.getByRole('button',{name:String(wrong),exact:true}).click();await page.locator('#learning-next').waitFor({state:'visible'});
     assert.equal(await page.locator('.learning-answer.incorrect').textContent(),String(wrong));assert.equal(await page.locator('.learning-answer.correct').textContent(),String(question.answer));
     assert.ok((await page.locator('#learning-feedback').textContent()).includes(`오답이에요. 정답은 ${question.answer}예요`));
     await page.waitForFunction(()=>getComputedStyle(document.querySelector('.learning-answer.correct')).backgroundColor==='rgb(224, 239, 255)'&&getComputedStyle(document.querySelector('.learning-answer.incorrect')).backgroundColor==='rgb(252, 229, 233)');
     await page.screenshot({path:`.local/station-dialogs/${kind}-${size.width}-wrong.png`});await page.locator('#learning-next').click();await page.waitForFunction(()=>document.querySelectorAll('.learning-answer:disabled').length===0);
     question=student[kind+'Run'].question;await page.getByRole('button',{name:String(question.answer),exact:true}).click();await page.locator('.learning-answer.correct').waitFor();assert.equal(await page.locator('.learning-answer.incorrect').count(),0);assert.match(await page.locator('#learning-feedback').textContent(),/정답이에요/);
    }
    if(kind==='history'||kind==='culture'){await dialog.locator('.culture-title').first().click();await dialog.locator('.culture-paper').waitFor({state:'visible'});await checkHeader();}
    if(kind==='science'){await dialog.locator('.science-start').click();await dialog.locator('.science-memo').waitFor({state:'visible'});await checkHeader();}
    if(kind==='art'){await dialog.locator('[data-art-tab=mine]').click();await dialog.locator('[data-art=canvas]').waitFor({state:'visible'});await checkHeader();}
    await page.screenshot({path:`.local/station-dialogs/${kind}-${size.width}-content.png`});
   }
   await dialog.locator('.dialog-pinned-close').click();await dialog.waitFor({state:'hidden'});
   if(!inspect&&(kind==='math'||kind==='english')){await page.locator('#world').focus();await page.keyboard.press('f');await page.locator('#learning-start').waitFor({state:'visible'});assert.equal(await page.locator('#learning-level').isVisible(),true);assert.equal(await page.locator('#learning-choices').isVisible(),false);await page.locator('#learning-close').click();await dialog.waitFor({state:'hidden'});}
  }
 }
 assert.deepEqual(errors,[]);console.log(inspect?'PASS station baseline captured':'PASS six actual stations × desktop/mobile/landscape, fixed title-right close, scroll, questions/answers, reading and drawing content');
}finally{socket?.disconnect();await browser?.close();await game.close();}
