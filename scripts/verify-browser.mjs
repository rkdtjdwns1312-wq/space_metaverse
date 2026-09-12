// 실제 UI 조작으로 검증합니다. pnpm test:browser (Windows: 설치된 Edge 사용)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClassroomServer } from '../server/app.js';
import { BLOCKED_WORDS } from '../server/chat-filter.js';
import { PLAZA_ID } from '../shared/config.js';
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
// Clicks inside the 1200x760 game-world canvas at map coordinates (mx,my), regardless of the
// canvas's current on-screen (CSS) size. Narrow (phone) layouts give the canvas a min-height with
// object-fit:contain, so the bitmap is letterboxed inside the element and the blank bands must be
// subtracted - exactly what client/world.js canvasPoint() does.
async function worldClick(page,mx,my){
  const box=await page.locator('#world').boundingBox();
  const scale=Math.min(box.width/1200,box.height/760);
  const left=box.x+(box.width-1200*scale)/2,top=box.y+(box.height-760*scale)/2;
  await page.mouse.click(left+mx*scale,top+my*scale);
}
// Holds whichever arrow keys currently move the live player toward target {x,y}, reading the
// player's real position straight from the in-process server room (not an assumed spawn point,
// since earlier movement/touch/mouse checks may have already nudged it), until the interact
// prompt appears or the timeout elapses.
async function walkNear(page,player,target,{timeoutMs=8000}={}){
  const held=new Set();
  const wanted=()=>{
    const dx=target.x-player.x,dy=target.y-player.y,codes=new Set();
    if(Math.abs(dx)>4)codes.add(dx<0?'ArrowLeft':'ArrowRight');
    if(Math.abs(dy)>4)codes.add(dy<0?'ArrowUp':'ArrowDown');
    return codes;
  };
  const start=Date.now();
  try{
    while(Date.now()-start<timeoutMs){
      const need=wanted();
      for(const code of need)if(!held.has(code)){await page.keyboard.down(code);held.add(code);}
      for(const code of [...held])if(!need.has(code)){await page.keyboard.up(code);held.delete(code);}
      if(await page.evaluate(()=>!document.getElementById('interact-prompt').hidden))return;
      await page.waitForTimeout(100);
    }
  }finally{
    for(const code of held){await page.keyboard.up(code);held.delete(code);}
  }
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
 // --- STEP 6: student-created planets ("부서행성") -----------------------------------------------
 // Reset the student viewport (left at 390px after the mobile/chat checks) so map clicks below use
 // normal desktop coordinates; item 13 switches back to 390px once this scenario is done.
 await student.setViewportSize({width:1440,height:1000});
 const teacherCanvasBeforePropose=await teacher.locator('#world').evaluate(c=>c.toDataURL());
 await student.locator('#planet-new').click();
 await student.waitForFunction(()=>document.body.classList.contains('placing'));
 checks.push('Clicking "행성 만들기" enters placement mode (body.placing)');
 await worldClick(student,300,600);
 await student.locator('#planet-create-dialog').waitFor({state:'visible'});
 await student.locator('#planet-name').fill('급식행성');
 await student.locator('#planet-desc').fill('급식 도우미 친구들');
 await student.locator('#planet-create-submit').click();
 await student.locator('#planet-create-dialog').waitFor({state:'hidden'});
 checks.push('Student proposes a new planet "급식행성" by placing it on the map and filling the create dialog');
 await teacher.locator('#proposals-panel').waitFor({state:'visible'});
 await teacher.locator('#proposals li').filter({hasText:'급식행성'}).filter({hasText:'신청: 1'}).waitFor();
 checks.push('Teacher sees the pending proposal with the proposing student\'s nickname');
 await student.locator('#self-proposal').filter({hasText:'급식행성'}).waitFor();
 checks.push('Student sees their own pending proposal in the passport panel');
 const teacherCanvasAfterPropose=await teacher.locator('#world').evaluate(c=>c.toDataURL());
 assert.notEqual(teacherCanvasBeforePropose,teacherCanvasAfterPropose);
 checks.push('Teacher canvas changes to draw the dashed pending-proposal circle');

 // Item 2: a second proposal attempt from the same student is rejected while one is pending.
 await student.locator('#planet-new').click();
 await student.waitForFunction(()=>document.body.classList.contains('placing'));
 await worldClick(student,900,600);
 await student.locator('#planet-create-dialog').waitFor({state:'visible'});
 await student.locator('#planet-name').fill('두번째행성');
 await student.locator('#planet-create-submit').click();
 await student.locator('#planet-create-error').filter({hasText:'이미 승인을 기다리는 행성이 있어요.'}).waitFor();
 checks.push('A student with one pending proposal cannot submit a second one');
 await student.locator('#planet-create-cancel').click();
 await student.locator('#planet-create-dialog').waitFor({state:'hidden'});

 // Item 3: teacher approves; the proposer becomes the first member.
 await teacher.locator('#proposals li').filter({hasText:'급식행성'}).locator('button.approve').click();
 await student.locator('#self-department').filter({hasText:'소속: 급식행성'}).waitFor();
 assert.equal(room.planets.size,1);
 const cafeteria=[...room.planets.values()][0],cafeteriaId=cafeteria.id;
 assert.equal(cafeteria.name,'급식행성');
 checks.push('Teacher approves the proposal; the room gains exactly one planet named 급식행성');
 await student.locator('#chat-log li').filter({hasText:'첫 멤버'}).waitFor();
 checks.push('Student chat log shows the approval announcement mentioning the first member');
 await teacher.locator('#proposals-panel').waitFor({state:'hidden'});
 checks.push('Teacher proposals panel hides once no proposals remain');
 await teacher.screenshot({path:'.local/05-planets.png',fullPage:true});

 // Item 4: walk the student near the new planet (direction computed live from the server's player
 // object, since earlier movement/touch/mouse checks already moved it away from its raw spawn).
 // Re-focus the world canvas first: the last chat send left focus in #chat-input, and the
 // movement keydown handler ignores arrow keys while an INPUT/TEXTAREA/BUTTON is focused.
 await student.locator('#world').focus();
 await walkNear(student,p,{x:300,y:600});
 await student.locator('#interact-prompt').filter({hasText:'급식행성 살펴보기'}).waitFor({timeout:2000});
 checks.push('Walking the student near the new planet shows the "급식행성 살펴보기 (E)" interact prompt');

 // Item 5: E opens the planet dialog for a member.
 await student.keyboard.press('e');
 await student.locator('#planet-dialog').waitFor({state:'visible'});
 await student.locator('#planet-enter').waitFor({state:'visible'});
 await student.locator('#planet-join').waitFor({state:'hidden'});
 await student.locator('#planet-leave-dept').waitFor({state:'visible'});
 await student.locator('#planet-member-count').filter({hasText:'1'}).waitFor();
 checks.push('E key opens the planet dialog for a member: enter shown, join hidden, leave shown, member count 1');
 await student.locator('#planet-rules-toggle').click();
 await student.locator('#planet-rules-list li').first().waitFor();
 assert.equal(await student.locator('#planet-rules-list li').count(),1);
 assert.equal((await student.locator('#planet-rules-list li').first().innerText()).trim(),'서로 존중하고 친절하게 말해요');
 checks.push('Planet rules list shows the single default rule');

 // Item 6: entering the planet switches to the interior map.
 const studentCanvasBeforeEnter=await student.locator('#world').evaluate(c=>c.toDataURL());
 await student.locator('#planet-enter').click();
 await student.locator('#planet-dialog').waitFor({state:'hidden'});
 await student.locator('#planet-exit').waitFor({state:'visible'});
 await student.locator('#map-caption').filter({hasText:'급식행성 안'}).waitFor();
 await teacher.locator('#players li').filter({hasText:'급식행성 안'}).waitFor();
 await student.waitForTimeout(150);
 const studentCanvasAfterEnter=await student.locator('#world').evaluate(c=>c.toDataURL());
 assert.notEqual(studentCanvasBeforeEnter,studentCanvasAfterEnter);
 checks.push('Entering the planet shows the interior caption, updates the teacher roster, and redraws the student canvas');

 // Item 7: the teacher clicks the planet directly on the plaza map (new feature) instead of
 // walking over, edits its rules from there, and students see the announcement.
 await worldClick(teacher,300,600);
 await teacher.locator('#planet-dialog').waitFor({state:'visible'});
 await teacher.locator('#planet-title').filter({hasText:'급식행성'}).waitFor();
 checks.push('Teacher clicking an existing planet on the map opens its info dialog directly (no walking required)');
 await teacher.locator('#planet-rules-toggle').click();
 await teacher.locator('#planet-rules-input').fill('줄을 서지 않으면 경고를 받아요\n급식 도구는 제자리에');
 await teacher.locator('#planet-rules-save').click();
 await teacher.locator('#planet-rules-list li').nth(1).waitFor();
 assert.equal(await teacher.locator('#planet-rules-list li').count(),2);
 checks.push('Teacher edits planet rules to two lines from the dialog opened by a map click');
 await student.locator('#chat-log li').filter({hasText:'규칙을 바꿨어요'}).waitFor();
 checks.push('Students are notified in chat that the planet rules changed');
 await teacher.locator('#planet-close').click();
 await teacher.locator('#planet-dialog').waitFor({state:'hidden'});

 // Item 8: from inside the planet, "우리 행성 정보" opens the same dialog with entry hidden; a
 // sole member's rename proposal passes immediately.
 await student.locator('#planet-info').waitFor({state:'visible'});
 await student.locator('#planet-info').click();
 await student.locator('#planet-dialog').waitFor({state:'visible'});
 await student.locator('#planet-enter').waitFor({state:'hidden'});
 checks.push('#planet-info inside the planet opens its dialog with the enter button hidden');
 await student.locator('#planet-rename-input').fill('급식별');
 await student.locator('#planet-rename-propose').click();
 await student.locator('#planet-title').filter({hasText:'급식별'}).waitFor();
 checks.push('A sole member\'s rename proposal passes immediately');
 await student.locator('#chat-log li').filter({hasText:'"급식행성" 행성의 이름이 "급식별"로 바뀌었어요!'}).waitFor();
 checks.push('Chat log announces the automatic single-member rename');
 await student.locator('#planet-close').click();
 await student.locator('#planet-dialog').waitFor({state:'hidden'});

 // Item 9: a second student joins by clicking the planet directly (no walking), then the two
 // members run a rename vote to a rejection and then to a pass.
 const student2Context=await browser.newContext({viewport:{width:1440,height:1000}});
 const student2=await student2Context.newPage();
 student2.on('pageerror',e=>errors.push(e.message));
 await student2.goto(url);await student2.locator('#connection').filter({hasText:'연결되었어요'}).waitFor();
 await student2.locator('#join-code').fill(code);await student2.locator('#nickname').fill('2');
 await student2.getByRole('button',{name:'우주 교실 입장하기'}).click();
 await student2.locator('#lobby').waitFor({state:'hidden'});
 checks.push('A second student (nickname 2) joins the same classroom');
 await worldClick(student2,300,600);
 await student2.locator('#planet-dialog').waitFor({state:'visible'});
 await student2.locator('#planet-title').filter({hasText:'급식별'}).waitFor();
 await student2.locator('#planet-join').click();
 await student2.locator('#self-department').filter({hasText:'소속: 급식별'}).waitFor();
 checks.push('Second student joins the planet via a direct map click without walking near it');
 assert.equal([...room.players.values()].filter(pl=>pl.avatar.departmentId===cafeteriaId).length,2);
 checks.push('Server room state now counts two members for the planet');
 await student2.locator('#planet-rename-input').fill('급식나라');
 await student2.locator('#planet-rename-propose').click();
 await student2.locator('#planet-rename-status').filter({hasText:'찬성 1'}).waitFor();
 await student2.locator('#planet-rename-status').filter({hasText:'2명'}).waitFor();
 checks.push('Second student proposes a rename that now needs a majority of 2 members');
 await student.locator('#planet-info').click();
 await student.locator('#planet-dialog').waitFor({state:'visible'});
 await student.locator('#planet-vote-no').click();
 await student.locator('#chat-log li').filter({hasText:'"급식나라" 이름 바꾸기가 부결되었어요.'}).waitFor();
 await student2.locator('#chat-log li').filter({hasText:'"급식나라" 이름 바꾸기가 부결되었어요.'}).waitFor();
 checks.push('A member voting no defeats the 2-member rename proposal; both members see the rejection announcement');
 await student2.locator('#planet-rename-input').fill('급식나라');
 await student2.locator('#planet-rename-propose').click();
 await student2.locator('#planet-rename-status').filter({hasText:'찬성 1'}).waitFor();
 await student.locator('#planet-vote-yes').click();
 await student.locator('#planet-title').filter({hasText:'급식나라'}).waitFor();
 await student.locator('#chat-log li').filter({hasText:'"급식별" 행성의 이름이 "급식나라"로 바뀌었어요!'}).waitFor();
 checks.push('Unanimous agreement passes the rename; both members\' dialogs and chat logs reflect the new name');
 await student.locator('#planet-close').click();await student.locator('#planet-dialog').waitFor({state:'hidden'});
 await student2.locator('#planet-close').click();await student2.locator('#planet-dialog').waitFor({state:'hidden'});

 // Item 10: student 1 exits back to the plaza, landing below the planet.
 await student.locator('#planet-exit').click();
 await student.locator('#map-caption').filter({hasText:'같은 교실의 친구들과 함께하는 공간'}).waitFor();
 await student.locator('#planet-exit').waitFor({state:'hidden'});
 assert.equal(p.mapId,PLAZA_ID);
 assert.ok(p.y>600+60);
 checks.push('Student exits the planet back to the plaza, landing below it');

 // Item 11: second student's next proposal is rejected by the teacher.
 await student2.locator('#planet-new').click();
 await student2.waitForFunction(()=>document.body.classList.contains('placing'));
 await worldClick(student2,900,600);
 await student2.locator('#planet-create-dialog').waitFor({state:'visible'});
 await student2.locator('#planet-name').fill('놀이행성');
 await student2.locator('#planet-create-submit').click();
 await student2.locator('#planet-create-dialog').waitFor({state:'hidden'});
 await teacher.locator('#proposals-panel').waitFor({state:'visible'});
 await teacher.locator('#proposals li').filter({hasText:'놀이행성'}).locator('button.reject').click();
 await teacher.locator('#proposals-panel').waitFor({state:'hidden'});
 await student2.locator('#chat-log li').filter({hasText:'돌려보냈어요'}).waitFor();
 checks.push('Teacher rejects a second student\'s new proposal; the panel hides and the student is notified');

 // Item 12: teacher removes the planet entirely from a map click; both members lose membership.
 await worldClick(teacher,300,600);
 await teacher.locator('#planet-dialog').waitFor({state:'visible'});
 await teacher.locator('#planet-title').filter({hasText:'급식나라'}).waitFor();
 teacher.once('dialog',d=>d.accept());
 await teacher.locator('#planet-remove').click();
 await teacher.locator('#planet-dialog').waitFor({state:'hidden'});
 assert.equal(room.planets.size,0);
 await student.locator('#self-department').filter({hasText:'아직 소속 행성이 없어요'}).waitFor();
 await student2.locator('#self-department').filter({hasText:'아직 소속 행성이 없어요'}).waitFor();
 await student.locator('#chat-log li').filter({hasText:'없앴어요'}).waitFor();
 checks.push('Teacher removes the planet; both students lose membership and see the removal announcement');

 // A clean explicit leave (not just closing the context) keeps room.players.size accurate for the
 // isolation checks right after this block.
 await student2.locator('#leave').click();
 await student2.locator('#leave-dialog').waitFor({state:'visible'});
 await student2.locator('#confirm-leave').click();
 await student2.locator('#lobby').waitFor({state:'visible'});
 await student2Context.close();

 // Item 13: 390px layout still holds up after all this planet activity.
 await student.setViewportSize({width:390,height:844});
 await student.locator('#planet-new').waitFor({state:'visible'});
 assert.ok(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 checks.push('#planet-new is visible with no horizontal overflow at 390px after the planet scenario');

 // Item 14: on a phone the canvas is letterboxed (min-height + object-fit:contain), so a tap must
 // still land on the map coordinate the child actually sees. Place a planet from the 390px layout
 // and confirm the server stored the spot that was tapped.
 const phoneBox=await student.locator('#world').boundingBox();
 assert.ok(Math.abs(phoneBox.width/phoneBox.height-1200/760)>0.2,'expected a letterboxed canvas at 390px');
 await student.locator('#planet-new').click();
 await student.waitForFunction(()=>document.body.classList.contains('placing'));
 await worldClick(student,900,300);
 await student.locator('#planet-create-dialog').waitFor({state:'visible'});
 await student.locator('#planet-name').fill('손가락행성');
 await student.locator('#planet-create-submit').click();
 await student.locator('#planet-create-dialog').waitFor({state:'hidden'});
 const tapped=[...room.proposals.values()].find(pr=>pr.name==='손가락행성');
 assert.ok(tapped,'the 390px tap did not create a proposal');
 assert.ok(Math.hypot(tapped.x-900,tapped.y-300)<14,'390px tap landed at '+tapped.x+','+tapped.y+' instead of 900,300');
 checks.push('A map tap on the letterboxed 390px canvas creates the planet at the tapped spot (within 14px)');
 await teacher.locator('#proposals li').filter({hasText:'손가락행성'}).locator('button.reject').click();
 await teacher.locator('#proposals-panel').waitFor({state:'hidden'});
 // --- End STEP 6 ----------------------------------------------------------------------------
 // Room isolation: a second teacher opens an independent classroom with the same teacher key
 // before the first classroom closes, and the two rooms must not leak allowlists or players.
 const teacher2Context=await browser.newContext({viewport:{width:1440,height:1000}});
 const teacher2=await teacher2Context.newPage();
 teacher2.on('pageerror',e=>errors.push(e.message));
 await teacher2.goto(url);await teacher2.locator('#connection').filter({hasText:'연결되었어요'}).waitFor();
 await teacher2.getByRole('button',{name:'선생님이에요'}).click();
 await teacher2.locator('#teacher-key').fill(teacherKey);
 await teacher2.locator('#allowed-names').fill('99');
 await teacher2.locator('#seed-planets').check();
 await teacher2.getByRole('button',{name:'교실 만들기'}).click();
 await teacher2.locator('#room-code').filter({hasText:/[A-Z0-9]{6}/}).waitFor();
 const code2=await teacher2.locator('#room-code').innerText();
 assert.equal(game.store.rooms.size,2);assert.equal(room.players.size,2);
 checks.push('Second teacher creates an isolated classroom with the same teacher key');
 const room2=game.store.rooms.get(code2);
 assert.equal(room2.planets.size,4);
 assert.ok([...room2.planets.values()].some(pl=>pl.name==='독서행성'));
 checks.push('Second classroom seeded with #seed-planets has 4 example planets including 독서행성, isolated from the first');
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
