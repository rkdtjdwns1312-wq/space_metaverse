import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
const key='isolated-chat-notices',game=createClassroomServer({teacherKey:key,studentHours:false});
const {port}=await game.listen(),origin='http://127.0.0.1:'+port;
const teacher=io(origin,{transports:['websocket'],reconnection:false,autoConnect:false});
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),args:['--no-proxy-server']});
mkdirSync('.local/chat-notices',{recursive:true});
try{
 await new Promise((r,j)=>{teacher.once('connect',r);teacher.once('connect_error',j);teacher.connect();});
 const made=await teacher.timeout(5000).emitWithAck('room:create',{teacherKey:key,allowedNames:['시험별']});assert(made.ok);
 const room=game.store.rooms.get(made.room.code),page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin);await page.locator('#connection.is-connected').waitFor({state:'attached'});await page.locator('#student-tab').click();
 await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill('시험별');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 for(const [dialog,button] of [['password-offer-dialog','password-offer-no'],['tutorial-dialog','tutorial-later']])if(await page.locator('#'+dialog).evaluate(d=>d.open))await page.locator('#'+button).click();
 const p=[...room.players.values()].find(p=>p.role==='student'),t=[...room.players.values()].find(p=>p.role==='teacher');
 const send=(text,role='student',channel='map')=>{
  const msg=game.store.pushChat(room,{playerId:t.id,nickname:'시험교사',role,text,channel,mapId:p.mapId,toId:p.id,private:channel==='direct'});
  game.io.to(p.socketId).emit('chat:message',msg);return msg;
 };
 send('시험 안내 하나','system');send('시험 전체 대화');send('시험 귓속말','student','direct');
 await page.locator('#chat-window-toggle').click();await page.locator('#chat-log').filter({hasText:'시험 전체 대화'}).waitFor();
 assert.equal(await page.locator('#chat-log li.system').count(),0);assert.match(await page.locator('#chat-log').textContent(),/시험 귓속말/);
 await page.locator('#chat-input').fill('보관할 초안');
 await page.locator('[data-chat-tab=system]').click();await page.locator('#chat-log').filter({hasText:'시험 안내 하나'}).waitFor();
 assert.equal(await page.locator('#chat-log li:not(.system)').count(),0);assert.equal(await page.locator('#chat-form').isVisible(),false);assert(await page.locator('#chat-input').isDisabled());
 const count=room.chat.history.length;await page.locator('#chat-form').evaluate(f=>f.requestSubmit());assert.equal(room.chat.history.length,count);
 send('시험 안내 둘','system');await page.locator('#chat-log').filter({hasText:'시험 안내 둘'}).waitFor();
 for(const channel of ['department','direct','map']){await page.locator(`[data-chat-tab=${channel}]`).click();assert.equal(await page.locator('#chat-log li.system').count(),0);}
 assert.equal(await page.locator('#chat-input').inputValue(),'보관할 초안');assert.equal(await page.locator('#chat-input').isDisabled(),false);
 await page.locator('#chat-send').click();await page.locator('#chat-log li.mine').filter({hasText:'보관할 초안'}).waitFor();
 // Friend-menu whisper also restores the input immediately from read-only notices.
 await page.locator('[data-chat-tab=system]').click();await page.evaluate(id=>{const select=document.getElementById('chat-channel');select.value='direct';document.getElementById('chat-recipient').value=id;select.dispatchEvent(new Event('change'));},t.id);
 assert.equal(await page.locator('#chat-input').isDisabled(),false);
 for(const [width,height] of [[1280,900],[390,844],[320,740],[844,390]]){
  await page.setViewportSize({width,height});await page.locator('[data-chat-tab=system]').click();
  const tabs=await page.locator('[data-chat-tab]').evaluateAll(xs=>xs.map(e=>({text:e.textContent,x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,right:e.getBoundingClientRect().right})));
  assert.deepEqual(tabs.map(t=>t.text),['전체','행성','귓속말','안내']);assert(tabs.every(t=>t.x>=0&&t.right<=width));assert(tabs[3].x>tabs[2].x&&tabs[3].y===tabs[2].y,'notice button stays right of whisper');
  await page.screenshot({path:`.local/chat-notices/${width}.png`});
 }
 assert.deepEqual(errors,[]);console.log('PASS notices separate from all/planet/whisper; history/live, read-only, draft/send restoration, four viewports');
}finally{teacher.disconnect();await browser.close();await game.close();}
