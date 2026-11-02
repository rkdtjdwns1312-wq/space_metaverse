import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';

const directory=mkdtempSync(join(tmpdir(),'woozooclass-entry-'));
const key='isolated-teacher-entry-test';
const game=createClassroomServer({teacherKey:key,dataDir:directory,studentHours:false});
const {port}=await game.listen();
const url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge',args:['--no-proxy-server']}:{})});
const socket=io(url,{transports:['websocket'],forceNew:true,reconnection:false});
try{
 await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
 const created=await socket.timeout(4000).emitWithAck('room:create',{teacherKey:key,title:'입장 화면 검사',allowedNames:['별이']});
 assert.equal(created.ok,true,created.error);const code=created.room.code;socket.disconnect();
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.goto(url);await page.locator('#teacher-tab').click();
 assert.equal(await page.locator('#legacy-class-mode').isVisible(),false);
 assert.equal(await page.locator('#open-class-fields').isVisible(),true);
 assert.equal(await page.locator('#new-class-fields').isVisible(),false);
 assert.equal(await page.locator('#teacher-form .submit').innerText(),'교실 입장하기');
 assert.equal(await page.locator('.lobby-hours').innerText(),'우주가 열리는 시간 · 오전 7시 ~ 오후 10시');
 mkdirSync('.local/teacher-entry',{recursive:true});
 await page.screenshot({path:'.local/teacher-entry/desktop.png'});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'.local/teacher-entry/mobile.png'});
 await page.locator('#teacher-key').fill(key);await page.locator('#open-code').fill(code);
 await page.locator('#teacher-form .submit').click();
 await page.locator('#lobby').waitFor({state:'hidden'});
 console.log('PASS teacher classroom entry, hidden mode choice, hours copy, desktop/mobile fit');
}finally{socket.disconnect();await browser.close();await game.close();rmSync(directory,{recursive:true,force:true});}
