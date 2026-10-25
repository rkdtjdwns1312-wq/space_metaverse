import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';

const dir=await mkdtemp(join(tmpdir(),'lv4-menu-'));
const game=createClassroomServer({teacherKey:'lv4-access-synthetic-key',dataDir:dir,studentHours:false});
let browser;
try{
  const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
  browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
  const page=await browser.newPage({viewport:{width:1024,height:768}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  await page.locator('#teacher-tab').click();
  await page.locator('#teacher-key').fill('lv4-access-synthetic-key');
  await fillNewClass(page,['별이']);
  await page.locator('#teacher-form .submit').click();
  await page.locator('#lobby').waitFor({state:'hidden'});
  await page.locator('#dock-menu').click();
  assert.equal(await page.locator('#lv4-teacher-tools').count(),0);
  await page.locator('#teacher-tools').click();
  await page.locator('#teacher-lv4-item-activity .teacher-tool-toggle').click();
  await page.locator('#teacher-lv4-item-open').click();
  await page.locator('#lv4-item-dialog').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);
  await mkdir('.local',{recursive:true});
  await page.screenshot({path:'.local/teacher-lv4-access.png'});
  console.log('선생님 메뉴에서 LV4 단축 버튼 제거·선생님 도구 내 활동 창 접근 통과');
}finally{if(browser)await browser.close();await game.close();await rm(dir,{recursive:true,force:true});}
