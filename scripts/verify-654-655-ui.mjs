import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {activeStarCards,useStarCard} from '../server/star-cards.js';
import {MAP,PLAZA_ID} from '../shared/config.js';
import {fillNewClass} from './class-setup.mjs';

const key='request-654-655-ui-verification';
const dir=await mkdtemp(join(tmpdir(),'654-655-ui-'));
const checks=[],errors=[],sockets=[];
let game,browser;
try{
  await mkdir('.local',{recursive:true});
  game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false,starCardRandom:()=>0});
  const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),args:['--no-proxy-server']});
  const context=await browser.newContext({viewport:{width:1440,height:960}});context.setDefaultTimeout(12000);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['UI검증학생'],{pin:['1234']});await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  const code=[...game.store.rooms.keys()][0],room=()=>game.store.rooms.get(code);
  const studentContext=await browser.newContext({viewport:{width:390,height:844}});studentContext.setDefaultTimeout(12000);
  const student=await studentContext.newPage();student.on('pageerror',e=>errors.push(e.message));
  await student.goto(url);await student.locator('#student-tab').click();await student.locator('#join-code').fill(code);await student.locator('#nickname').fill('UI검증학생');await student.locator('#student-pin').fill('1234');await student.locator('#student-form .submit').click();await student.locator('#lobby').waitFor({state:'hidden'});
  if(await student.locator('#password-offer-dialog').isVisible())await student.locator('#password-offer-no').click();if(await student.locator('#tutorial-later').isVisible())await student.locator('#tutorial-later').click();
  const pupil=[...room().players.values()].find(p=>p.role==='student');assert.ok(pupil,'UI 검증용 학생 입장 완료');
  game.store.transact(()=>{pupil.inventory=[{id:'star-card',quantity:1}];});
  useStarCard(room(),pupil,Date.now(),()=>0);
  const card=activeStarCards(room())[0];Object.assign(pupil,{mapId:card.mapId,x:card.x,y:card.y+25,input:{x:0,y:0,at:0}});
  game.io.to(pupil.socketId).emit('room:state',game.store.snapshot(room(),pupil));
  await student.locator('#interact-prompt').filter({hasText:'별 카드 효과 보기'}).waitFor({state:'visible'});
  await student.locator('#world').focus();await student.keyboard.press('f');await student.locator('#star-card-dialog').waitFor({state:'visible'});
  const starCard=await student.evaluate(()=>{
    const dialog=document.querySelector('#star-card-dialog'),face=dialog.querySelector('.star-card-face');
    return {name:dialog.querySelector('.star-card-name').innerText.trim(),description:dialog.querySelector('.star-card-description').innerText.trim(),effect:dialog.querySelector('.star-card-effect').innerText.trim(),visible:[...face.children].filter(el=>getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'&&el.getBoundingClientRect().height>0).map(el=>el.className||el.tagName.toLowerCase()),choice:dialog.querySelector('.star-card-choice').hidden};
  });
  assert.ok(starCard.name&&starCard.description&&starCard.effect,JSON.stringify(starCard));
  assert.deepEqual(starCard.visible,['star-card-name','star-card-description','star-card-effect']);
  // 선택 효과가 없는 카드에는 별도 선택 단추가 나타나지 않습니다.
  await student.screenshot({path:'.local/654-student-star-card.png'});
  checks.push('학생 실제 별카드 화면: 이름·설명·효과만 기본 노출');
  await student.locator('#star-card-dialog button').filter({hasText:'닫기'}).click();
  await student.locator('#star-card-dialog').waitFor({state:'hidden'});

  const timetable=MAP.objects.find(o=>o.id==='pillar-timetable');assert.ok(timetable);
  Object.assign(pupil,{mapId:PLAZA_ID,x:timetable.x+(timetable.radius||0)+35,y:timetable.y,input:{x:0,y:0,at:0}});
  game.io.to(pupil.socketId).emit('room:state',game.store.snapshot(room(),pupil));
  await student.locator('#interact-prompt').filter({hasText:timetable.name}).waitFor({state:'visible'});
  await student.locator('#world').focus();await student.keyboard.press('f');await student.locator('#temple-dialog').waitFor({state:'visible'});
  await student.locator('#temple-title').filter({hasText:timetable.name}).waitFor();
  await student.waitForFunction(()=>{const c=document.querySelector('#temple-content');return c?.querySelector('.timetable-table')&&c.querySelectorAll('tbody tr').length===6;});
  const schedule=await student.evaluate(()=>({title:document.querySelector('#temple-title').innerText,description:document.querySelector('#temple-description').innerText.trim(),hasTable:!!document.querySelector('#temple-content .timetable-table'),rows:document.querySelectorAll('#temple-content tbody tr').length}));
  assert.equal(schedule.description,'');assert.equal(schedule.rows,6);assert.ok(schedule.hasTable);
  await student.screenshot({path:'.local/655-student-timetable.png'});
  checks.push('학생 실제 시간표 화면: 부연 설명 없음, 시간표 표 6행 표시');
  assert.deepEqual(errors,[]);
  await writeFile('.local/654-655-ui-browser.log',JSON.stringify({checks,starCard,schedule,errors},null,2)+'\n');
  console.log(JSON.stringify({checks,starCard,schedule,errors},null,2));
}catch(error){
  await writeFile('.local/654-655-ui-browser-failure.log',`${error.stack}\n${JSON.stringify(errors)}\n`);throw error;
}finally{
  sockets.forEach(s=>s.disconnect());if(browser)await browser.close();if(game)await game.close();
  assert.ok(dir.startsWith(join(tmpdir(),'654-655-ui-')));await rm(dir,{recursive:true,force:true});
}
