// 실제 학급과 분리한 서버에서 글자 제한·말풍선·비공개 대화 범위를 확인합니다.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {mkdir} from 'node:fs/promises';
const key='chat-browser-test-only-key',game=createClassroomServer({teacherKey:key,studentHours:false});
const address=await game.listen(),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const url='http://127.0.0.1:'+address.port,errors=[];
await mkdir('.local',{recursive:true});
try{
  const pages=[];
  for(let i=0;i<3;i++){
    const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      // 한 프레임에서 실제 그린 말풍선 글자를 관찰합니다. 앱에 테스트용 상태를 추가하지 않습니다.
      window.bubbleTexts=[];window.timeOffset=0;const now=Date.now;Date.now=()=>now()+window.timeOffset;
      const proto=CanvasRenderingContext2D.prototype,fill=proto.fillText,transform=proto.setTransform;
      proto.setTransform=function(...args){if(this.canvas.id==='world'&&args[0]===1&&args[3]===1)window.bubbleTexts=[];return transform.apply(this,args);};
      proto.fillText=function(text,...args){if(this.canvas.id==='world'&&this.font.includes('13px'))window.bubbleTexts.push(text);return fill.call(this,text,...args);};
    });
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});pages.push(page);
  }
  const [teacher,one,two]=pages;
  await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);await fillNewClass(teacher,['1','2']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0];
  for(const [page,nickname] of [[one,'1'],[two,'2']]){await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill(nickname);await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});}
  const p1=[...room.players.values()].find(p=>p.nickname==='1'),p2=[...room.players.values()].find(p=>p.nickname==='2');
  const open=async()=>{await one.locator('#dock-chat').click();await one.locator('#open-chat').click();};
  const long='별'.repeat(99)+'끝';await open();await one.locator('#chat-input').fill(long+'더');assert.equal(await one.locator('#chat-input').inputValue(),long);assert.equal(await one.locator('#chat-count').innerText(),'100 / 100자');
  await one.locator('#chat-send').click();await one.locator('#chat-log li.mine').filter({hasText:long}).waitFor();await one.keyboard.press('Escape');
  await one.waitForFunction(text=>window.bubbleTexts.join('')===text,long);
  await one.screenshot({path:'.local/099-own-bubble.png'});
  await one.evaluate(()=>window.timeOffset=6000);await one.waitForFunction(text=>window.bubbleTexts.join('')===text,long);
  await one.evaluate(()=>window.timeOffset=12500);await one.waitForFunction(()=>window.bubbleTexts.length===0);console.log('100자 입력 제한·본인 말풍선 전체 줄바꿈·6초 유지·12초 이후 사라짐');
  await one.evaluate(()=>window.timeOffset=0);p1.lastChatAt=0;
  await open();await one.locator('#chat-input').fill('짧게');await one.locator('#chat-send').click();await one.keyboard.press('Escape');await one.waitForFunction(()=>window.bubbleTexts.join('')==='짧게');await one.evaluate(()=>window.timeOffset=3500);await one.waitForFunction(()=>window.bubbleTexts.length===0);console.log('짧은 말풍선은 약 3초 후 사라짐');
  // 새 글을 바로 보내면 서버 거부 안내가 채팅창 안에 보이고 입력은 보존됩니다.
  await one.evaluate(()=>window.timeOffset=0);await open();await one.locator('#chat-input').fill('또 보내기');p1.lastChatAt=Date.now();await one.locator('#chat-send').click();await one.locator('#chat-feedback').filter({hasText:'천천히'}).waitFor();assert.equal(await one.locator('#chat-input').inputValue(),'또 보내기');console.log('도배 거부 안내·전송 실패 시 입력 보존');
  for(const page of pages)await page.evaluate(()=>window.timeOffset=15000);
  await teacher.waitForFunction(()=>window.bubbleTexts.length===0);await two.waitForFunction(()=>window.bubbleTexts.length===0);
  await one.locator('#chat-channel').selectOption('direct');await one.locator('#chat-recipient').selectOption(p2.id);await one.locator('#chat-input').fill('우리둘만의말풍선');p1.lastChatAt=0;await one.locator('#chat-send').click();await one.keyboard.press('Escape');
  await one.waitForFunction(()=>window.bubbleTexts.join('')==='우리둘만의말풍선');await two.waitForFunction(()=>window.bubbleTexts.join('')==='우리둘만의말풍선');assert.equal(await teacher.evaluate(()=>window.bubbleTexts.length),0);console.log('귓속말 말풍선은 발신자·수신자에게만 표시');
  await one.setViewportSize({width:390,height:844});await one.screenshot({path:'.local/099-mobile-bubble.png'});assert.deepEqual(errors,[]);console.log('채팅 브라우저 검사 완료, 오류 없음');
}finally{await browser.close();await game.close();}
