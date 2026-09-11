// 실제 UI 조작으로 검증합니다. pnpm test:browser (Windows: 설치된 Edge 사용)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClassroomServer } from '../server/app.js';
import { BLOCKED_WORDS } from '../server/chat-filter.js';
const teacherKey=randomBytes(32).toString('hex'),game=createClassroomServer({teacherKey});
const address=await game.listen(),url='http://127.0.0.1:'+address.port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[],checks=[];
mkdirSync('.local',{recursive:true});
// Polls the chat input's live state instead of a fixed sleep, since room:state
// broadcasts asynchronously after a teacher action's ack resolves.
async function waitForChatInput(page,{disabled,placeholder}){
  await page.waitForFunction(({disabled,placeholder})=>{
    const el=document.getElementById('chat-input');
    return !!el && el.disabled===disabled && el.placeholder===placeholder;
  },{disabled,placeholder});
}
try{
 const teacherContext=await browser.newContext({viewport:{width:1440,height:1000}});
 const studentContext=await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true});
 const teacher=await teacherContext.newPage(),student=await studentContext.newPage();
 for(const p of [teacher,student])p.on('pageerror',e=>errors.push(e.message));
 await teacher.goto(url);await teacher.locator('#connection').filter({hasText:'연결되었어요'}).waitFor();
 await teacher.screenshot({path:'.local/01-lobby.png',fullPage:true});
 await teacher.getByRole('button',{name:'선생님이에요'}).click();
 await teacher.locator('#teacher-key').fill(teacherKey);
 await teacher.getByRole('button',{name:'교실 만들기'}).click();
 await teacher.locator('#room-code').filter({hasText:/[A-Z0-9]{6}/}).waitFor();
 const code=await teacher.locator('#room-code').innerText();checks.push('Teacher creates a room from actual UI');
 await student.goto(url);await student.locator('#connection').filter({hasText:'연결되었어요'}).waitFor();
 await student.locator('#join-code').fill(code);await student.locator('#nickname').fill('허용안됨');
 await student.getByRole('button',{name:'우주 교실 입장하기'}).click();
 await student.locator('#form-message').filter({hasText:'허용한'}).waitFor();
 await student.locator('#nickname').fill('1');await student.getByRole('button',{name:'우주 교실 입장하기'}).click();
 await student.locator('#lobby').waitFor({state:'hidden'});
 await teacher.locator('#player-count').filter({hasText:'2 / 30'}).waitFor();checks.push('Allowlist enforced, same-room student appears');
 const room=game.store.rooms.get(code),p=[...room.players.values()].find(p=>p.role==='student'),id=p.id;
 const initialX=p.x;
 const canvasBefore=await teacher.locator('#world').evaluate(c=>c.toDataURL());
 await student.locator('#world').focus();await student.keyboard.down('ArrowRight');await student.waitForTimeout(450);await student.keyboard.up('ArrowRight');
 await student.waitForTimeout(220);assert.ok(p.x>initialX+20);
 const canvasAfter=await teacher.locator('#world').evaluate(c=>c.toDataURL());assert.notEqual(canvasBefore,canvasAfter);
 checks.push('Student keyboard movement reaches server and changes teacher canvas');
 await student.reload();await student.locator('#lobby').waitFor({state:'hidden'});
 assert.equal(room.players.size,2);assert.equal([...room.players.values()].find(p=>p.role==='student').id,id);
 checks.push('Browser refresh resumes the same student');
 await teacher.screenshot({path:'.local/02-classroom.png',fullPage:true});
 await student.setViewportSize({width:390,height:844});
 await student.screenshot({path:'.local/03-mobile.png',fullPage:true});
 const widthOkay=await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
 assert.ok(widthOkay);checks.push('390px touch layout has no horizontal overflow');
 assert.ok(await student.locator('#touch-controls').isVisible());
 checks.push('#touch-controls is visible on a 390px touch viewport');
 // Real CDP touch events (not synthetic dispatchEvent) exercise the actual pointer-capture path.
 const oldY=p.y;
 const touch=student.locator('[data-dx="0"][data-dy="1"]');
 const touchBox=await touch.boundingBox();
 const cx=touchBox.x+touchBox.width/2,cy=touchBox.y+touchBox.height/2;
 const cdp=await studentContext.newCDPSession(student);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy}]});
 await student.waitForTimeout(300);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.ok(p.y>oldY);checks.push('Real touch press on on-screen button moves the student');
 // The client sends {x:0,y:0} on release; the server does not keep moving on its own, so
 // movement must have fully stopped a bit after touchend and stay stopped afterwards.
 await student.waitForTimeout(250);const stoppedY=p.y;
 await student.waitForTimeout(300);assert.equal(p.y,stoppedY);
 checks.push('Releasing the on-screen touch button stops the student');
 // Mouse press/hold on the same button exercises the pointerType:"mouse" path.
 const oldX=p.x;
 const rightButton=student.locator('[data-dx="1"][data-dy="0"]');
 const rightBox=await rightButton.boundingBox();
 await student.mouse.move(rightBox.x+rightBox.width/2,rightBox.y+rightBox.height/2);
 await student.mouse.down();await student.waitForTimeout(300);await student.mouse.up();
 await student.waitForTimeout(200);
 assert.ok(p.x>oldX);checks.push('Mouse press on on-screen button moves the student');
 // --- Chat (STEP 5), exercised while the student is still joined and the classroom is mobile-sized ---
 await student.locator('#chat-input').fill('안녕하세요 선생님');
 await student.locator('#chat-input').press('Enter');
 const teacherHello=teacher.locator('#chat-log li').filter({hasText:'안녕하세요 선생님'});
 await teacherHello.waitFor();
 assert.equal((await teacherHello.locator('.who').innerText()).trim(),'1');
 await student.locator('#chat-log li.mine').filter({hasText:'안녕하세요 선생님'}).waitFor();
 checks.push('Student chat message reaches the teacher log with nickname 1 and shows as "mine" in the student log');

 await student.waitForTimeout(800); // clear the 700ms per-player cooldown before the next send
 const blockedWord=BLOCKED_WORDS[0];
 const naughty='너는 진짜 '+blockedWord+' 같아';
 const masked=naughty.replace(blockedWord,'○'.repeat(blockedWord.length));
 await student.locator('#chat-input').fill(naughty);
 await student.locator('#chat-input').press('Enter');
 const maskedEntry=teacher.locator('#chat-log li').filter({hasText:masked});
 await maskedEntry.waitFor();
 await maskedEntry.locator('.badge').filter({hasText:'순화됨'}).waitFor();
 assert.ok(!(await teacher.locator('#chat-log').innerText()).includes(blockedWord));
 checks.push('Blocked words are masked with same-length circles and flagged "순화됨", original word absent from the log');

 await teacher.locator('#chat-toggle').filter({hasText:'채팅 끄기'}).click();
 await waitForChatInput(student,{disabled:true,placeholder:'선생님이 채팅을 껐어요'});
 await teacher.locator('#chat-log li').filter({hasText:'선생님이 채팅을 껐어요.'}).waitFor();
 await student.locator('#chat-log li').filter({hasText:'선생님이 채팅을 껐어요.'}).waitFor();
 await teacher.locator('#chat-input').fill('모두 잘 들려요?');
 await teacher.locator('#chat-input').press('Enter');
 await student.locator('#chat-log li').filter({hasText:'모두 잘 들려요?'}).waitFor();
 await teacher.locator('#chat-toggle').filter({hasText:'채팅 켜기'}).click();
 await waitForChatInput(student,{disabled:false,placeholder:'친구들에게 말해요 (Enter)'});
 checks.push('Teacher chat off/on disables student input with a system message while the teacher can still speak');

 const muteButton=teacher.locator('button.mute[data-player-id="'+id+'"]');
 await muteButton.click();
 await waitForChatInput(student,{disabled:true,placeholder:'선생님이 내 채팅을 잠시 멈췄어요'});
 await teacher.locator('#chat-log li').filter({hasText:'1 친구의 채팅이 잠시 멈췄어요.'}).waitFor();
 await muteButton.filter({hasText:'허용'}).waitFor();
 await muteButton.click();
 await waitForChatInput(student,{disabled:false,placeholder:'친구들에게 말해요 (Enter)'});
 await muteButton.filter({hasText:'금지'}).waitFor();
 checks.push('Teacher mute toggle disables/enables one student\'s chat input and announces it by nickname');

 await teacher.locator('#chat-clear').click();
 await teacher.locator('#chat-log li').filter({hasText:'선생님이 채팅 기록을 지웠어요.'}).waitFor();
 await student.locator('#chat-log li').filter({hasText:'선생님이 채팅 기록을 지웠어요.'}).waitFor();
 assert.equal(await teacher.locator('#chat-log li').count(),1);
 assert.equal(await student.locator('#chat-log li').count(),1);
 checks.push('Teacher clearing chat wipes both logs down to a single system message');

 await student.reload();await student.locator('#lobby').waitFor({state:'hidden'});
 await student.locator('#chat-log li').filter({hasText:'선생님이 채팅 기록을 지웠어요.'}).waitFor();
 checks.push('Chat history is restored to the student after reload/session resume');

 await student.waitForTimeout(800);
 const bubbleCanvasBefore=await teacher.locator('#world').evaluate(c=>c.toDataURL());
 await student.locator('#chat-input').fill('말풍선 테스트');
 await student.locator('#chat-input').press('Enter');
 await teacher.locator('#chat-log li').filter({hasText:'말풍선 테스트'}).waitFor();
 await teacher.waitForTimeout(150);
 const bubbleCanvasAfter=await teacher.locator('#world').evaluate(c=>c.toDataURL());
 assert.notEqual(bubbleCanvasBefore,bubbleCanvasAfter);
 checks.push('Sending a chat message shows a speech bubble that changes the teacher canvas');

 assert.ok(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 checks.push('390px layout with the populated chat panel still has no horizontal overflow');
 await teacher.screenshot({path:'.local/04-chat.png',fullPage:true});
 // --- End chat ---------------------------------------------------------------------------------
 // Room isolation: a second teacher opens an independent classroom with the same teacher key
 // before the first classroom closes, and the two rooms must not leak allowlists or players.
 const teacher2Context=await browser.newContext({viewport:{width:1440,height:1000}});
 const teacher2=await teacher2Context.newPage();
 teacher2.on('pageerror',e=>errors.push(e.message));
 await teacher2.goto(url);await teacher2.locator('#connection').filter({hasText:'연결되었어요'}).waitFor();
 await teacher2.getByRole('button',{name:'선생님이에요'}).click();
 await teacher2.locator('#teacher-key').fill(teacherKey);
 await teacher2.locator('#allowed-names').fill('99');
 await teacher2.getByRole('button',{name:'교실 만들기'}).click();
 await teacher2.locator('#room-code').filter({hasText:/[A-Z0-9]{6}/}).waitFor();
 const code2=await teacher2.locator('#room-code').innerText();
 assert.equal(game.store.rooms.size,2);assert.equal(room.players.size,2);
 checks.push('Second teacher creates an isolated classroom with the same teacher key');
 const intruderContext=await browser.newContext({viewport:{width:1440,height:1000}});
 const intruder=await intruderContext.newPage();
 intruder.on('pageerror',e=>errors.push(e.message));
 await intruder.goto(url);await intruder.locator('#connection').filter({hasText:'연결되었어요'}).waitFor();
 await intruder.locator('#join-code').fill(code2);await intruder.locator('#nickname').fill(p.nickname);
 await intruder.getByRole('button',{name:'우주 교실 입장하기'}).click();
 await intruder.locator('#form-message').filter({hasText:'허용한'}).waitFor();
 checks.push('Room isolation: first room student name is rejected by the second room allowlist');
 await intruderContext.close();
 await teacher2.getByRole('button',{name:'교실 종료하기'}).click();await teacher2.locator('#confirm-leave').click();
 // The acting teacher's own page can show either its local "다음 여행에서 또 만나요." message
 // or the broadcast "교실이 종료되었어요" room:closed message depending on arrival order, so
 // assert on the unambiguous state (lobby visible again) instead of racing on message text.
 await teacher2.locator('#lobby').waitFor({state:'visible'});
 assert.equal(game.store.rooms.size,1);assert.equal(room.players.size,2);
 checks.push('Second classroom closes independently without affecting the first');
 await teacher2Context.close();
 await teacher.getByRole('button',{name:'교실 종료하기'}).click();await teacher.locator('#confirm-leave').click();
 await student.locator('#form-message').filter({hasText:'종료'}).waitFor();assert.equal(game.store.rooms.size,0);
 checks.push('Teacher ending room returns student to entrance');
 assert.deepEqual(errors,[]);
 writeFileSync('.local/browser-report.json',JSON.stringify({checks,errors},null,2));
 console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();await game.close();}
