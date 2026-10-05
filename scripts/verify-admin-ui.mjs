import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';

const dir=await mkdtemp(join(tmpdir(),'admin-browser-'));
const game=createClassroomServer({teacherKey:'admin-browser-private-key',dataDir:dir,studentHours:false});
const {port}=await game.listen();
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const base='http://127.0.0.1:'+port;
await mkdir('.local',{recursive:true});
try{
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:900}});
    await page.goto(base+'/admin.html');
    await page.locator('#admin-key').fill('admin-browser-private-key');
    await page.locator('#admin-login button').click();
    await page.locator('#class-name').fill('별빛 4학년');
    await page.locator('#teacher-name').fill('별빛 선생님');
    await page.locator('#create-class button').click();
    await page.locator('#issued-panel').waitFor();
    assert.equal(await page.locator('.class-row').count(),width===1440?1:2);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'관리자 화면 가로 넘침: '+width);
    await page.locator('#issued-code').evaluate(element=>element.textContent='T-••••••••••••••••••••');
    await page.screenshot({path:`.local/admin-${width}.png`,fullPage:true});
    await page.close();
    const login=await browser.newPage({viewport:{width,height:900}});
    await login.goto(base+'/');
    await login.locator('#teacher-tab').click();
    assert.equal(await login.locator('#owner-entry').isVisible(),true);
    assert.equal(await login.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'접속 화면 가로 넘침: '+width);
    await login.screenshot({path:`.local/login-${width}.png`,fullPage:true});
    await login.locator('#student-tab').click();
    assert.equal(await login.locator('#join-code').isVisible(),true,'홈페이지에서 교실 코드를 직접 입력할 수 있어야 해요.');
    assert.equal(await login.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'학생 접속 화면 가로 넘침: '+width);
    await login.screenshot({path:`.local/student-login-${width}.png`,fullPage:true});
    await login.close();
  }
  console.log('관리자·접속 화면 1440/390 너비, 생성·표시·가로 넘침 확인');
}finally{await browser.close();await game.close();await rm(dir,{recursive:true,force:true});}
