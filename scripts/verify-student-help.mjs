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
 for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:640,height:360}]){
  await page.setViewportSize(viewport);await page.locator('#dock-help').click();
  assert.equal(await page.locator('#classroom-help-content .help-answer').count(),6);
  await page.screenshot({path:`.local/student-help/home-${viewport.width}.png`});
  for(const [query,id] of [['숙제는 어떻게 내요?','homework'],['레벨업','level'],['장비는 어떻게 껴요?','equipment'],['별부스러기','crumbs'],['미션 보상','mission-reward'],['조합 실패','craft-failed']]){
   await page.locator('#classroom-help-search').fill(query);
   const results=await page.locator('.help-answer').evaluateAll(els=>els.slice(0,3).map(e=>e.dataset.answerId));assert(results.includes(id),JSON.stringify({query,results}));
   const answer=page.locator(`[data-answer-id="${id}"]`);if(!await answer.evaluate(el=>el.open))await answer.locator('summary').click();
   assert(await answer.locator('.help-answer-body').isVisible());
  }
  await page.locator('#classroom-help-search').fill('숙제');await page.screenshot({path:`.local/student-help/search-${viewport.width}.png`});
  const bounds=await page.locator('#classroom-help-close').boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.y+bounds.height<=viewport.height);
  assert(await page.locator('#classroom-help-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.locator('#classroom-help-search').fill('퀀텀바나나');assert.equal(await page.locator('.help-answer').count(),0);await page.getByRole('button',{name:'자주 묻는 질문 보기',exact:true}).click();assert.equal(await page.locator('.help-answer').count(),6);
  await page.locator('#classroom-help-search').fill('<script>alert(42)</script>');assert.equal(await page.locator('#classroom-help-dialog script').count(),0);await page.locator('#classroom-help-clear').click();
  await page.locator('#help-tab-craft').click();assert.equal(await page.locator('#help-tab-craft').getAttribute('aria-pressed'),'true');
  await page.locator('#classroom-help-close').click();
  await page.locator('#dock-inventory').click();await page.locator('#inventory-dialog [data-student-help]').click();await page.locator('#classroom-help-close').click();assert(await page.locator('#inventory-dialog').isVisible());assert.equal(await page.evaluate(()=>document.activeElement.dataset.studentHelp),'items');await close(page);
  console.log(`PASS ${viewport.width}: common questions, natural/alias search, answer disclosure, no-result reset, text safety, bounds, context help and focus return`);
 }
 await page.setViewportSize({width:1280,height:900});await page.locator('#map-guide-bar').click();await page.screenshot({path:'.local/student-help/map-guide.png'});
 await page.locator('#map-guide-dialog .map-help-links button').first().click();assert(await page.locator('#classroom-help-dialog').isVisible());assert.equal(await page.locator('#map-guide-dialog').isVisible(),false);await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log('PASS map-context link and browser errors 0; no real class data used');
}finally{await browser.close();await game.close();}
