import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
const key='isolated-student-help',game=createClassroomServer({teacherKey:key,studentHours:false});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`,errors=[];
const browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'msedge':undefined,args:['--no-proxy-server']});
const close=async page=>{for(let i=0;i<12&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');};
try{
 await mkdir('.local/student-help',{recursive:true});
 const context=await browser.newContext({viewport:{width:1280,height:900},hasTouch:true}),teacher=await context.newPage();
 await teacher.goto(url);await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);await fillNewClass(teacher,['도움검증']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});await close(teacher);
 const code=await teacher.locator('#room-code').textContent(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(url);await page.locator('#student-tab').click();await page.locator('#join-code').fill(code);await page.locator('#nickname').fill('도움검증');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});await close(page);
 for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:320,height:568},{width:640,height:360}]){
  await page.setViewportSize(viewport);await page.locator('#dock-help').click();
  assert.equal(await page.locator('#classroom-help-dialog').getAttribute('data-page'),'topics');
  const topics=await page.locator('#classroom-help-tabs button').evaluateAll(buttons=>buttons.map(b=>b.getAttribute('aria-label')));
  assert.equal(topics.length,16);assert.deepEqual(topics,[...topics].sort((a,b)=>a.localeCompare(b,'ko')));
  assert.equal(await page.locator('.help-question,.help-answer-body').count(),0);assert(await page.locator('#help-search-panel').isHidden());
  await page.screenshot({path:`.local/student-help/home-${viewport.width}.png`});
  await page.locator('#help-tab-craft').click();assert.equal(await page.locator('#classroom-help-dialog').getAttribute('data-page'),'questions');
  assert(await page.locator('#classroom-help-tabs').isHidden());assert(await page.locator('.help-question').count()>0);assert.equal(await page.locator('.help-question small').count(),0);
  const first=page.locator('.help-question').first(),questionId=await first.getAttribute('id');
  await page.screenshot({path:`.local/student-help/questions-${viewport.width}.png`});await first.click();
  assert.equal(await page.locator('.help-answer-body').count(),1);assert.equal(await page.locator('.help-question').count(),0);
  await page.screenshot({path:`.local/student-help/answer-${viewport.width}.png`});
  await page.locator('#classroom-help-back').click();assert.equal(await page.evaluate(()=>document.activeElement.id),questionId);
  await page.locator('#classroom-help-back').click();assert.equal(await page.locator('#classroom-help-dialog').getAttribute('data-page'),'topics');assert.equal(await page.evaluate(()=>document.activeElement.id),'help-tab-craft');
  await page.locator('#classroom-help-find').click();
  for(const [query,id] of [['숙제는 어떻게 내요?','homework'],['레벨업','level'],['장비는 어떻게 껴요?','equipment'],['별부스러기','crumbs'],['미션 보상','mission-reward'],['조합 실패','craft-failed'],['다른 색 카드','dark-star-card'],['파란 구체','truth-blue-input'],['댓글 확인','star-record-reply'],['별 제작소','station-playground-route']]){
   await page.locator('#classroom-help-search').fill(query);
   const results=await page.locator('.help-question').evaluateAll(els=>els.slice(0,3).map(e=>e.dataset.answerId));assert(results.includes(id),JSON.stringify({query,results}));
   await page.locator(`button[data-answer-id="${id}"]`).click();assert(await page.locator('.help-answer-body').isVisible());
   await page.locator('#classroom-help-back').click();assert.equal(await page.locator('#classroom-help-search').inputValue(),query);
  }
  for(const id of ['classroom-help-back','classroom-help-dialog .dialog-pinned-close']){const bounds=await page.locator('#'+id).boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.y+bounds.height<=viewport.height);}
  const back=await page.locator('#classroom-help-back').boundingBox(),closeButton=await page.locator('#classroom-help-dialog .dialog-pinned-close').boundingBox();assert(back.x<closeButton.x||back.y>closeButton.y);
  assert(await page.locator('#classroom-help-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.locator('#classroom-help-search').fill('퀀텀바나나');assert.equal(await page.locator('.help-question').count(),0);
  await page.locator('#classroom-help-search').fill('<script>alert(42)</script>');assert.equal(await page.locator('#classroom-help-dialog script').count(),0);await page.locator('#classroom-help-clear').click();assert.equal(await page.locator('#classroom-help-search').inputValue(),'');
  await page.locator('#classroom-help-back').click();assert.equal(await page.locator('#classroom-help-dialog').getAttribute('data-page'),'topics');
  await page.locator('#classroom-help-back').click();assert(await page.locator('#classroom-help-dialog').isHidden());assert.equal(await page.evaluate(()=>document.activeElement.id),'dock-help');
  await page.locator('#dock-inventory').click();await page.locator('#inventory-dialog [data-student-help]').click();assert.equal(await page.locator('#classroom-help-title').innerText(),'가방과 아이템');
  await page.locator('.help-question').first().click();await page.locator('#classroom-help-dialog .dialog-pinned-close').click();assert(await page.locator('#inventory-dialog').isVisible());assert.equal(await page.evaluate(()=>document.activeElement.dataset.studentHelp),'items');await close(page);
  console.log(`PASS ${viewport.width}: sorted topic grid, large question-only list, separate answer, back history/focus/search preservation, no tags, manual search, text safety, bounds and context return`);
 }
 await page.setViewportSize({width:1280,height:900});await page.locator('#map-overview').click();await page.locator('#map-info-current').click();await page.screenshot({path:'.local/student-help/map-guide.png'});
 await page.locator('#map-guide-dialog .map-help-links button').first().click();assert(await page.locator('#classroom-help-dialog').isVisible());assert.equal(await page.locator('#map-guide-dialog').isVisible(),false);await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log('PASS map-context link and browser errors 0; no real class data used');
}finally{await browser.close();await game.close();}
