import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';

const dataDir=mkdtempSync(join(tmpdir(),'capacity-browser-')),teacherKey=randomBytes(32).toString('hex');
const game=createClassroomServer({teacherKey,dataDir,studentHours:false});
let browser;const errors=[],checks=[];
mkdirSync('.local',{recursive:true});
try{
  const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
  browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
  for(const count of [8,10,35]){
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
    page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(teacherKey);
    await fillNewClass(page,Array.from({length:count},(_,i)=>`학생${i+1}`));
    assert.equal(await page.locator('#student-count').getAttribute('max'),'35');
    assert.equal(await page.locator('.student-account-row').count(),count);
    if(count===35){
      await page.locator('#student-count').fill('36');
      assert.equal(await page.locator('#student-count').evaluate(el=>el.validity.rangeOverflow),true);
      await page.locator('#student-count').press('Tab');
      assert.equal(await page.locator('#student-count').inputValue(),'35');
      await page.locator('#student-count').scrollIntoViewIfNeeded();
      await page.screenshot({path:'.local/capacity-35-setup.png'});
      checks.push('36명 입력 경계와 35명 계정 입력 행');
    }
    await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
    const room=[...game.store.rooms.values()].find(r=>r.allowedNames.size===count);
    assert.ok(room);assert.equal([...room.players.values()].filter(p=>p.role==='student').length,count);
    checks.push(`${count}명 교실 실제 생성`);
    if(count===35){
      while(await page.locator('dialog[open]').count())await page.keyboard.press('Escape');
      await page.locator('#dock-chat').click();
      await page.locator('#player-count').filter({hasText:'1 / 36'}).waitFor({state:'attached'});
      await page.screenshot({path:'.local/capacity-36-display.png'});
      checks.push('교사를 포함한 정원 36명 화면 표시');
    }
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{
  await browser?.close();await game.close();rmSync(dataDir,{recursive:true,force:true});
}
