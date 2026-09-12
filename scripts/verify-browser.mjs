// 실제 UI 조작으로 검증합니다. pnpm test:browser (Windows: 설치된 Edge 사용)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClassroomServer } from '../server/app.js';
import { BLOCKED_WORDS } from '../server/chat-filter.js';
import { PLAZA_ID, STREET_ID, STREET, MAP, SHOP, BAG, PLANET_TEMPLATES } from '../shared/config.js';
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
// Holds a single arrow key for a fixed duration. Used to step clear of something interactable
// before walking to a different, farther target with walkNear: standing next to the first object
// already shows #interact-prompt, so walkNear's "prompt appeared" success check would otherwise
// fire immediately without the player ever having moved toward the real target.
// 주의: 아래 holdKey의 시간(600ms·1500ms)은 이동 속도 RULES.speed=310 기준입니다. 속도를 바꾸면 이 값도 다시 맞추세요.
async function holdKey(page,code,ms){
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
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

 // #players and its mute buttons now live inside #crew-dialog (new layout), so open it first.
 await teacher.locator('#crew-button').click();
 await teacher.locator('#crew-dialog').waitFor({state:'visible'});
 const muteButton=teacher.locator('button.mute[data-player-id="'+id+'"]');
 await muteButton.click();
 await waitForChatInput(student,{disabled:true,placeholder:'선생님이 내 채팅을 잠시 멈췄어요'});
 await teacher.locator('#chat-log li').filter({hasText:'1 친구의 채팅이 잠시 멈췄어요.'}).waitFor();
 await muteButton.filter({hasText:'허용'}).waitFor();
 await muteButton.click();
 await waitForChatInput(student,{disabled:false,placeholder:'친구들에게 말해요 (Enter)'});
 await muteButton.filter({hasText:'금지'}).waitFor();
 checks.push('Teacher mute toggle disables/enables one student\'s chat input and announces it by nickname');
 await teacher.locator('#crew-close').click();
 await teacher.locator('#crew-dialog').waitFor({state:'hidden'});

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
 await student.locator('input[name="planet-type"][value="meal"]').check();
 await student.locator('#planet-name').fill('급식행성');
 await student.locator('#planet-desc').fill('급식 도우미 친구들');
 await student.locator('#planet-create-submit').click();
 await student.locator('#planet-create-dialog').waitFor({state:'hidden'});
 checks.push('Student proposes a new planet "급식행성" by placing it on the map, picking a planet type, and filling the create dialog');
 // #proposals-panel now lives inside #teacher-dialog (new layout): open it via "선생님 도구" first.
 await teacher.locator('#teacher-tools').click();
 await teacher.locator('#teacher-dialog').waitFor({state:'visible'});
 await teacher.locator('#proposals li').filter({hasText:'급식행성'}).filter({hasText:'신청: 1'}).waitFor();
 checks.push('Teacher opens "선생님 도구" and sees the pending proposal with the proposing student\'s nickname');
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
 await student.locator('input[name="planet-type"][value="subject"]').check();
 await student.locator('#planet-name').fill('두번째행성');
 await student.locator('#planet-create-submit').click();
 await student.locator('#planet-create-error').filter({hasText:'이미 승인을 기다리는 행성이 있어요.'}).waitFor();
 checks.push('A student with one pending proposal cannot submit a second one');
 await student.locator('#planet-create-cancel').click();
 await student.locator('#planet-create-dialog').waitFor({state:'hidden'});

 // Item 3: teacher approves; the proposer becomes the first member.
 await teacher.locator('#proposals li').filter({hasText:'급식행성'}).locator('button.approve').click();
 // #self-department now prefixes the planet's template icon (client/app.js myPlanetIcon), so the
 // membership text is '소속: 🍱 급식행성' (meal template icon), not the bare name.
 await student.locator('#self-department').filter({hasText:'소속: 🍱 급식행성'}).waitFor();
 assert.equal(room.planets.size,1);
 const cafeteria=[...room.planets.values()][0],cafeteriaId=cafeteria.id;
 assert.equal(cafeteria.name,'급식행성');
 checks.push('Teacher approves the proposal; the room gains exactly one planet named 급식행성');
 await student.locator('#chat-log li').filter({hasText:'첫 멤버'}).waitFor();
 checks.push('Student chat log shows the approval announcement mentioning the first member');
 await teacher.locator('#proposals-empty').waitFor({state:'visible'});
 checks.push('Teacher proposals list shows the empty state once no proposals remain');
 await teacher.locator('#teacher-close').click();
 await teacher.locator('#teacher-dialog').waitFor({state:'hidden'});
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
 // 새 행성은 고른 종류(급식행성 meal)의 기본 규칙으로 시작합니다.
 const mealRules=PLANET_TEMPLATES.find(t=>t.id==='meal').rules;
 assert.equal(await student.locator('#planet-rules-list li').count(),mealRules.length);
 assert.equal((await student.locator('#planet-rules-list li').first().innerText()).trim(),mealRules[0]);
 checks.push('Planet rules list starts with the chosen type\'s default rules');

 // Item 6: entering the planet switches to the interior map.
 const studentCanvasBeforeEnter=await student.locator('#world').evaluate(c=>c.toDataURL());
 await student.locator('#planet-enter').click();
 await student.locator('#planet-dialog').waitFor({state:'hidden'});
 await student.locator('#planet-exit').waitFor({state:'visible'});
 await student.locator('#map-caption').filter({hasText:'급식행성 안'}).waitFor();
 await teacher.locator('#crew-button').click();
 await teacher.locator('#crew-dialog').waitFor({state:'visible'});
 await teacher.locator('#players li').filter({hasText:'급식행성 안'}).waitFor();
 await teacher.locator('#crew-close').click();
 await teacher.locator('#crew-dialog').waitFor({state:'hidden'});
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
 // 저장 전 목록에 종류 기본 규칙 3줄이 이미 있으므로, 서버 스냅샷이 반영되어 정확히 2줄이 될 때까지 기다립니다.
 await teacher.waitForFunction(()=>document.querySelectorAll('#planet-rules-list li').length===2,{timeout:5000});
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
 await student2.locator('#self-department').filter({hasText:'소속: 🍱 급식별'}).waitFor();
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

 // --- STEP 7: star shards, star-street travel and the star shop ---------------------------------
 // Precondition matches the plan: student 1 is back in the plaza and still belongs to a planet
 // (급식나라, renamed in Item 9) right after Item 10 above; student 2 is also still connected.

 // Item 1: new layout basics, checked from student 1's own view.
 await student.locator('#crew-button').click();
 await student.locator('#crew-dialog').waitFor({state:'visible'});
 assert.ok(await student.locator('#players li').count()>=2);
 checks.push('New layout: #crew-button opens #crew-dialog listing the teacher and the students');
 await student.locator('#crew-close').click();
 await student.locator('#crew-dialog').waitFor({state:'hidden'});
 assert.equal((await student.locator('#self-shards').innerText()).trim(),'0');
 assert.ok(await student.locator('#tab-bag').evaluate(el=>el.classList.contains('selected')));
 assert.ok(await student.locator('#bag-empty').isVisible());
 checks.push('.hud passport shows 0 star shards and the bag tab is selected with an empty bag by default');
 {
   const worldBox=await student.locator('#world').boundingBox();
   const hudBox=await student.locator('.hud').boundingBox();
   assert.ok(Math.abs(worldBox.width-hudBox.width)<20,
     'expected #world width '+worldBox.width+' to match .hud width '+hudBox.width+' within 20px');
 }
 checks.push('The map canvas spans the same full width as the .hud row below it (new full-width layout)');
 await teacher.screenshot({path:'.local/07-layout.png',fullPage:true});

 // Item 2: teacher gives star shards to one student, then to everyone, then rejects an invalid amount.
 await teacher.locator('#teacher-tools').click();
 await teacher.locator('#teacher-dialog').waitFor({state:'visible'});
 await teacher.locator('#shards-target').selectOption({value:id});
 await teacher.locator('#shards-amount').fill('20');
 await teacher.locator('#shards-give').click();
 await student.locator('#self-shards').filter({hasText:'20'}).waitFor();
 // 별 파편 지급은 공개 채팅이 아니라 받는 학생에게만 가는 개인 안내(whisper, li.private)입니다(server/app.js shards:give).
 await student.locator('#chat-log li.private').filter({hasText:'선생님이 나에게 별 파편 20개를 주었어요.'}).waitFor();
 await student.locator('#chat-log li.private .private-badge').filter({hasText:'나에게만'}).first().waitFor();
 checks.push('Teacher gives 20 star shards to student 1 by id; the student (not the public chat) gets a private "나에게만" whisper naming the amount');
 await teacher.locator('#shards-target').selectOption('all');
 await teacher.locator('#shards-amount').fill('5');
 await teacher.locator('#shards-give').click();
 await student.locator('#self-shards').filter({hasText:'25'}).waitFor();
 await student.locator('#chat-log li.private').filter({hasText:'선생님이 나에게 별 파편 5개를 주었어요.'}).waitFor();
 checks.push('Teacher gives 5 star shards to everyone; student 1 now has 25 and receives the same private whisper wording, not a public announcement');
 await teacher.locator('#shards-amount').fill('0');
 await teacher.locator('#shards-give').click();
 await teacher.locator('#toast').filter({hasText:'별 파편 개수는 1~999 사이 정수로 적어주세요.'}).waitFor();
 checks.push('Giving 0 star shards is rejected with the exact validation message');
 await teacher.locator('#teacher-close').click();
 await teacher.locator('#teacher-dialog').waitFor({state:'hidden'});

 // Item 3: student walks to the plaza's star-street gate and travels there. Standing right next
 // to its own planet already shows #interact-prompt (the planet's "살펴보기" prompt) and the
 // student's x already matches the planet's x exactly, so step right first, clear of the planet's
 // column, before walking diagonally toward the gate - otherwise walkNear would either return
 // immediately (still seeing the planet's prompt) or drift back across the planet on the way.
 const streetGate=MAP.objects.find(o=>o.id==='gate-street');
 await student.locator('#world').focus();
 await holdKey(student,'ArrowRight',1500);
 await student.locator('#interact-prompt').waitFor({state:'hidden'});
 const studentCanvasInPlaza=await student.locator('#world').evaluate(c=>c.toDataURL());
 const plazaCanvasBeforeTravel=await teacher.locator('#world').evaluate(c=>c.toDataURL());
 const rosterBeforeTravel=(await teacher.locator('#player-count').innerText()).trim();
 await walkNear(student,p,{x:streetGate.x,y:streetGate.y,radius:streetGate.radius});
 await student.locator('#interact-prompt').filter({hasText:'별빛 거리로 가는 문'}).waitFor({timeout:2000});
 await student.keyboard.press('e');
 await student.locator('#map-caption').filter({hasText:'별빛 거리'}).waitFor();
 assert.equal(p.mapId,STREET_ID);
 await student.locator('#planet-new').waitFor({state:'hidden'});
 checks.push('Walking to the plaza gate and pressing E travels the student to star-street (#planet-new hides)');
 await teacher.waitForTimeout(150);
 const plazaCanvasAfterTravel=await teacher.locator('#world').evaluate(c=>c.toDataURL());
 assert.notEqual(plazaCanvasBeforeTravel,plazaCanvasAfterTravel);
 checks.push('Teacher canvas redraws once the student leaves the plaza for star-street');
 await teacher.locator('#crew-button').click();
 await teacher.locator('#crew-dialog').waitFor({state:'visible'});
 assert.equal((await teacher.locator('#crew-count').innerText()).trim(),rosterBeforeTravel);
 await teacher.locator('#crew-close').click();
 await teacher.locator('#crew-dialog').waitFor({state:'hidden'});
 checks.push('Teacher crew roster count ('+rosterBeforeTravel+') is unchanged while the student is away on another map');
 await student.waitForTimeout(150);
 const studentCanvasInStreet=await student.locator('#world').evaluate(c=>c.toDataURL());
 assert.notEqual(studentCanvasInPlaza,studentCanvasInStreet);
 checks.push('Student canvas redraws to the star-street scene after travel');

 // Item 4: the star shop.
 const shopObj=STREET.objects.find(o=>o.id==='shop');
 await walkNear(student,p,{x:shopObj.x,y:shopObj.y,radius:shopObj.radius});
 await student.locator('#interact-prompt').filter({hasText:'별상점 구경하기 (E)'}).waitFor({timeout:2000});
 await student.keyboard.press('e');
 await student.locator('#shop-dialog').waitFor({state:'visible'});
 await student.locator('#shop-shards').filter({hasText:'25'}).waitFor();
 assert.equal(await student.locator('#shop-buy-list li.item').count(),SHOP.items.length);
 checks.push('E near the shop opens #shop-dialog showing 25 star shards and all '+SHOP.items.length+' items for sale');
 await student.screenshot({path:'.local/06-street-shop.png',fullPage:true});

 const stickerRow=student.locator('#shop-buy-list li.item').first();
 await stickerRow.locator('input.qty').fill('2');
 await stickerRow.locator('button.buy').click();
 await student.locator('#toast').filter({hasText:'반짝 별 스티커 2개를 샀어요'}).waitFor();
 await student.locator('#shop-shards').filter({hasText:'15'}).waitFor();
 await student.locator('#self-shards').filter({hasText:'15'}).waitFor();
 checks.push('Buying 2 star stickers costs 10 shards, leaving 15 in both the shop dialog and the passport');

 const snackRow=student.locator('#shop-buy-list li.item').nth(1);
 await snackRow.locator('input.qty').fill('10');
 await snackRow.locator('button.buy').click();
 await student.locator('#toast').filter({hasText:'별 파편이 부족해요'}).waitFor();
 checks.push('Buying 10 space snacks (30 shards) is rejected for insufficient funds (15 available)');

 await student.locator('#shop-tab-sell').click();
 await student.locator('#shop-sell-list li').first().waitFor();
 assert.equal(await student.locator('#shop-sell-list li').count(),1);
 const sellRow=student.locator('#shop-sell-list li').first();
 await sellRow.filter({hasText:'반짝 별 스티커'}).waitFor();
 await sellRow.locator('.muted').filter({hasText:'가진 개수 2'}).waitFor();
 await sellRow.locator('.price').filter({hasText:'★ 2'}).waitFor();
 checks.push('Sell tab lists the one owned item with its held count and sell price');
 await sellRow.locator('input.qty').fill('1');
 await sellRow.locator('button.sell').click();
 await student.locator('#toast').filter({hasText:'팔았어요'}).waitFor();
 await student.locator('#shop-shards').filter({hasText:'17'}).waitFor();
 checks.push('Selling 1 star sticker back refunds 2 shards, leaving 17');
 await student.locator('#shop-close').click();
 await student.locator('#shop-dialog').waitFor({state:'hidden'});
 await student.locator('#tab-bag').click();
 // #bag-list li only holds an icon + count (see renderBag in client/app.js) - the item name is
 // never rendered as text, only as the slot button's aria-label - so check that instead of hasText.
 assert.equal(await student.locator('#bag-list li').count(),1);
 await student.locator('#bag-list li .slot-btn[aria-label="반짝 별 스티커 × 1"]').waitFor();
 checks.push('The bag tab shows exactly 1 star sticker remaining after the sale');

 // Item 5: the street/shop are only reachable from the street; walking back through the plaza gate
 // returns the student near its configured arrival point, with planet-making available again.
 // Same reasoning as Item 3: right after closing the shop dialog the student is still within its
 // interact radius (and roughly level with it, y≈300), so step down first to clear that row before
 // walking toward the far-away gate.
 const gateBack=STREET.objects.find(o=>o.id==='gate-plaza');
 await student.locator('#world').focus();
 // Step down clear of the shop's row first, then left past its column at that safe row - a direct
 // diagonal walkNear toward the far-off gate would cut back across the shop's radius on the way
 // (held arrow keys move at a fixed 45°, not a straight line at the target's exact angle, so a
 // shallow diagonal like this one swings close to whatever sits near the midpoint). The row is
 // picked to also clear the street lamps' collision radius, not just the shop's interact radius.
 await holdKey(student,'ArrowDown',600);
 await student.locator('#interact-prompt').waitFor({state:'hidden'});
 await holdKey(student,'ArrowLeft',1500);
 await student.locator('#interact-prompt').waitFor({state:'hidden'});
 await walkNear(student,p,{x:gateBack.x,y:gateBack.y,radius:gateBack.radius});
 await student.locator('#interact-prompt').filter({hasText:'우주 광장으로 가는 문'}).waitFor({timeout:2000});
 await student.keyboard.press('e');
 await student.locator('#map-caption').filter({hasText:'같은 교실의 친구들과 함께하는 공간'}).waitFor();
 assert.equal(p.mapId,PLAZA_ID);
 assert.ok(Math.hypot(p.x-gateBack.arrival.x,p.y-gateBack.arrival.y)<100,
   'expected the student near the plaza arrival point '+JSON.stringify(gateBack.arrival)+' but landed at '+p.x+','+p.y);
 await student.locator('#planet-new').waitFor({state:'visible'});
 checks.push('Walking back through the street gate returns the student to the plaza near its arrival point, with #planet-new visible again');

 // Item 6: the plan's direct-socket cross-room shop check is already covered by the server unit
 // tests (star shards/purchases stay isolated per classroom), so this checks the 390px layout
 // instead: the .hud stacks vertically with no horizontal overflow and #crew-button stays visible.
 await student.setViewportSize({width:390,height:844});
 {
   const chatBox=await student.locator('#chat-panel').boundingBox();
   const passportBox=await student.locator('.passport').boundingBox();
   assert.ok(chatBox.y>passportBox.y,'expected #chat-panel to stack below .passport at 390px');
 }
 assert.ok(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.ok(await student.locator('#crew-button').isVisible());
 checks.push('At 390px the .hud stacks vertically (chat below passport) with no horizontal overflow and #crew-button stays visible');

 // Item 7: reload keeps the star shards and bag.
 await student.reload();await student.locator('#lobby').waitFor({state:'hidden'});
 await student.locator('#self-shards').filter({hasText:'17'}).waitFor();
 assert.equal(await student.locator('#bag-list li').count(),1);
 checks.push('Reloading resumes the same session with 17 star shards and the bag intact');
 // --- End STEP 7 ----------------------------------------------------------------------------

 // Item 11: second student's next proposal is rejected by the teacher.
 await student2.locator('#planet-new').click();
 await student2.waitForFunction(()=>document.body.classList.contains('placing'));
 await worldClick(student2,900,600);
 await student2.locator('#planet-create-dialog').waitFor({state:'visible'});
 await student2.locator('input[name="planet-type"][value="show"]').check();
 await student2.locator('#planet-name').fill('놀이행성');
 await student2.locator('#planet-create-submit').click();
 await student2.locator('#planet-create-dialog').waitFor({state:'hidden'});
 await teacher.locator('#teacher-tools').click();
 await teacher.locator('#teacher-dialog').waitFor({state:'visible'});
 await teacher.locator('#proposals li').filter({hasText:'놀이행성'}).waitFor();
 await teacher.locator('#proposals li').filter({hasText:'놀이행성'}).locator('button.reject').click();
 await teacher.locator('#proposals-empty').waitFor({state:'visible'});
 await teacher.locator('#teacher-close').click();
 await teacher.locator('#teacher-dialog').waitFor({state:'hidden'});
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
 await student.locator('input[name="planet-type"][value="audit"]').check();
 await student.locator('#planet-name').fill('손가락행성');
 await student.locator('#planet-create-submit').click();
 await student.locator('#planet-create-dialog').waitFor({state:'hidden'});
 const tapped=[...room.proposals.values()].find(pr=>pr.name==='손가락행성');
 assert.ok(tapped,'the 390px tap did not create a proposal');
 assert.ok(Math.hypot(tapped.x-900,tapped.y-300)<14,'390px tap landed at '+tapped.x+','+tapped.y+' instead of 900,300');
 checks.push('A map tap on the letterboxed 390px canvas creates the planet at the tapped spot (within 14px)');
 await teacher.locator('#teacher-tools').click();
 await teacher.locator('#teacher-dialog').waitFor({state:'visible'});
 await teacher.locator('#proposals li').filter({hasText:'손가락행성'}).waitFor();
 await teacher.locator('#proposals li').filter({hasText:'손가락행성'}).locator('button.reject').click();
 await teacher.locator('#proposals-empty').waitFor({state:'visible'});
 await teacher.locator('#teacher-close').click();
 await teacher.locator('#teacher-dialog').waitFor({state:'hidden'});
 // --- End STEP 6 ----------------------------------------------------------------------------
 // --- STEP 7-2: planet templates, avatar card/bag, shard secrecy, item use, and trades -----------
 // Both students stay connected through this whole section (student2's explicit leave, previously
 // right after Item 12, is moved to run again right after Scenario 9, restoring room.players.size
 // ===2 before the Room isolation section further down, which assumes that precondition).
 await student.setViewportSize({width:1440,height:1000});
 const p2=[...room.players.values()].find(pl=>pl.nickname==='2');

 // Scenario 1: planet template shapes. The teacher (not just a student) can create a planet
 // directly from #planet-new (openPlanetCreateDialog branches on role but reuses the same
 // dialog/button and still requires a template pick), and each template's icon shows both on the
 // plaza map (canvas redraw) and in the planet dialog title.
 const teacherCanvasBeforeTypes=await teacher.locator('#world').evaluate(c=>c.toDataURL());
 await teacher.locator('#planet-new').click();
 await teacher.waitForFunction(()=>document.body.classList.contains('placing'));
 await worldClick(teacher,900,600);
 await teacher.locator('#planet-create-dialog').waitFor({state:'visible'});
 await teacher.locator('input[name="planet-type"][value="pe"]').check();
 await teacher.locator('#planet-create-submit').click();
 await teacher.locator('#planet-create-dialog').waitFor({state:'hidden'});
 const teacherCanvasAfterFirstType=await teacher.locator('#world').evaluate(c=>c.toDataURL());
 assert.notEqual(teacherCanvasBeforeTypes,teacherCanvasAfterFirstType);
 await teacher.locator('#planet-new').click();
 await teacher.waitForFunction(()=>document.body.classList.contains('placing'));
 await worldClick(teacher,600,520);
 await teacher.locator('#planet-create-dialog').waitFor({state:'visible'});
 await teacher.locator('input[name="planet-type"][value="art"]').check();
 await teacher.locator('#planet-create-submit').click();
 await teacher.locator('#planet-create-dialog').waitFor({state:'hidden'});
 const teacherCanvasAfterSecondType=await teacher.locator('#world').evaluate(c=>c.toDataURL());
 assert.notEqual(teacherCanvasAfterFirstType,teacherCanvasAfterSecondType);
 assert.equal(room.planets.size,2);
 checks.push('Teacher creates two more planets directly from #planet-new with different templates (pe, art); the teacher canvas redraws after each creation');
 await teacher.screenshot({path:'.local/09-planet-types.png',fullPage:true});
 const peScenarioPlanet=[...room.planets.values()].find(pl=>pl.templateId==='pe');
 await worldClick(teacher,peScenarioPlanet.x,peScenarioPlanet.y);
 await teacher.locator('#planet-dialog').waitFor({state:'visible'});
 await teacher.locator('#planet-title').filter({hasText:'⚽'}).waitFor();
 checks.push('Opening a template-created planet shows its template icon (⚽ for the pe template) in the #planet-title dialog heading');
 await teacher.locator('#planet-close').click();
 await teacher.locator('#planet-dialog').waitFor({state:'hidden'});

 // Scenario 2: avatar card and bag grid (student 1, reset to a normal desktop viewport since Item 14
 // left it at 390px).
 assert.ok(await student.locator('#avatar-card').isVisible());
 assert.ok((await student.locator('#self-level').innerText()).includes('LV 1'));
 const blankPortraitData=await student.evaluate(()=>{const c=document.createElement('canvas');c.width=240;c.height=150;return c.toDataURL();});
 const myPortraitData=await student.locator('#avatar-portrait').evaluate(c=>c.toDataURL());
 assert.notEqual(myPortraitData,blankPortraitData);
 assert.equal(await student.locator('#bag-list .slot').count(),BAG.columns*BAG.rows);
 const heldKindCount=p.inventory.length;
 assert.equal(await student.locator('#bag-list li').count(),heldKindCount);
 checks.push('Avatar card shows LV 1 with a non-blank portrait; the bag grid always has '+(BAG.columns*BAG.rows)+' slots and exactly '+heldKindCount+' filled li slot(s) matching the held item kinds');
 await student.screenshot({path:'.local/08-card-bag.png',fullPage:true});

 // Scenario 3: star-shard balances are secret between students (client/app.js: the crew dialog
 // badge shows only when isTeacher||p.id===selfId). Player list order is stable insertion order
 // (teacher, student1, student2), so #players li nth(1)/nth(2) are the two students.
 await student2.locator('#crew-button').click();
 await student2.locator('#crew-dialog').waitFor({state:'visible'});
 assert.equal(await student2.locator('#players li').nth(1).locator('.shards-badge').count(),0);
 assert.equal(await student2.locator('#players li').nth(2).locator('.shards-badge').count(),1);
 checks.push('Student 2\'s crew dialog shows no star-shards badge on student 1\'s row but shows one on their own row');
 await student2.locator('#crew-close').click();
 await student2.locator('#crew-dialog').waitFor({state:'hidden'});
 await teacher.locator('#crew-button').click();
 await teacher.locator('#crew-dialog').waitFor({state:'visible'});
 assert.equal(await teacher.locator('#players li').nth(1).locator('.shards-badge').count(),1);
 assert.equal(await teacher.locator('#players li').nth(2).locator('.shards-badge').count(),1);
 checks.push('Teacher\'s crew dialog shows the star-shards badge on both students\' rows');
 await teacher.locator('#crew-close').click();
 await teacher.locator('#crew-dialog').waitFor({state:'hidden'});

 // Scenario 4: student 1 uses the star sticker on themself - a public (non-secret) item use.
 await student.locator('#bag-list li').first().locator('.slot-btn').click();
 await student.locator('#bag-detail .use').waitFor({state:'visible'});
 const studentCanvasBeforeUse=await student.locator('#world').evaluate(c=>c.toDataURL());
 await student.locator('#bag-detail .use').click();
 await student.locator('#use-dialog').waitFor({state:'visible'});
 await student.locator('#use-target').selectOption({value:id});
 await student.locator('#use-confirm').click();
 await student.locator('#use-dialog').waitFor({state:'hidden'});
 await student.locator('#self-effects li').filter({hasText:'반짝반짝'}).waitFor();
 await student.locator('#chat-log li').filter({hasText:'1 친구가 반짝 별 스티커를 썼어요.'}).waitFor();
 await student.waitForTimeout(150);
 const studentCanvasAfterUse=await student.locator('#world').evaluate(c=>c.toDataURL());
 assert.notEqual(studentCanvasBeforeUse,studentCanvasAfterUse);
 await teacher.locator('#teacher-tools').click();
 await teacher.locator('#teacher-dialog').waitFor({state:'visible'});
 await teacher.locator('#item-log li').filter({hasText:'반짝 별 스티커'}).waitFor();
 await teacher.locator('#teacher-close').click();
 await teacher.locator('#teacher-dialog').waitFor({state:'hidden'});
 checks.push('Student 1 uses the star sticker on themself: the effect appears in their passport and avatar canvas, a public chat line announces it, and the teacher item log records it');

 // Scenario 5: a secret item used on someone else. Top up student 1's shards, send them to the
 // street shop to buy a space snack (secret item), then use it on student 2. The travel/shop steps
 // in between comfortably clear ITEM_USE.cooldownMs (2s) since Scenario 4's item:use.
 const preBuyShards=p.starShards;
 await teacher.locator('#teacher-tools').click();
 await teacher.locator('#teacher-dialog').waitFor({state:'visible'});
 await teacher.locator('#shards-target').selectOption({value:id});
 await teacher.locator('#shards-amount').fill('10');
 await teacher.locator('#shards-give').click();
 await student.locator('#self-shards').filter({hasText:String(preBuyShards+10)}).waitFor();
 await teacher.locator('#teacher-close').click();
 await teacher.locator('#teacher-dialog').waitFor({state:'hidden'});
 await student.locator('#world').focus();
 await walkNear(student,p,{x:streetGate.x,y:streetGate.y,radius:streetGate.radius});
 await student.locator('#interact-prompt').filter({hasText:'별빛 거리로 가는 문'}).waitFor({timeout:2000});
 await student.keyboard.press('e');
 await student.locator('#map-caption').filter({hasText:'별빛 거리'}).waitFor();
 // updateInteractPrompt() only refreshes on an 80ms interval, so right after travel the prompt can
 // still show the plaza gate's stale text for a moment; wait for it to clear before walkNear (which
 // returns as soon as ANY prompt is visible) so it does not return immediately without moving.
 await student.locator('#interact-prompt').waitFor({state:'hidden'});
 await walkNear(student,p,{x:shopObj.x,y:shopObj.y,radius:shopObj.radius});
 await student.locator('#interact-prompt').filter({hasText:'별상점 구경하기 (E)'}).waitFor({timeout:2000});
 await student.keyboard.press('e');
 await student.locator('#shop-dialog').waitFor({state:'visible'});
 const snackBuyRow=student.locator('#shop-buy-list li.item').nth(1);
 await snackBuyRow.locator('input.qty').fill('1');
 await snackBuyRow.locator('button.buy').click();
 await student.locator('#toast').filter({hasText:'우주 간식 1개를 샀어요'}).waitFor();
 await student.locator('#shop-close').click();
 await student.locator('#shop-dialog').waitFor({state:'hidden'});
 await student.locator('#world').focus();
 await holdKey(student,'ArrowDown',600);
 await student.locator('#interact-prompt').waitFor({state:'hidden'});
 await holdKey(student,'ArrowLeft',1500);
 await student.locator('#interact-prompt').waitFor({state:'hidden'});
 await walkNear(student,p,{x:gateBack.x,y:gateBack.y,radius:gateBack.radius});
 await student.locator('#interact-prompt').filter({hasText:'우주 광장으로 가는 문'}).waitFor({timeout:2000});
 await student.keyboard.press('e');
 await student.locator('#map-caption').filter({hasText:'같은 교실의 친구들과 함께하는 공간'}).waitFor();
 await student.locator('#bag-list li').first().locator('.slot-btn').click();
 await student.locator('#bag-detail .use').waitFor({state:'visible'});
 await student.locator('#bag-detail .use').click();
 await student.locator('#use-dialog').waitFor({state:'visible'});
 await student.locator('#use-target').selectOption({value:p2.id});
 await student.locator('#use-confirm').click();
 await student.locator('#use-dialog').waitFor({state:'hidden'});
 await student2.locator('#chat-log li').filter({hasText:'누군가 2 친구에게 우주 간식을 썼어요.'}).waitFor();
 await student.locator('#chat-log li').filter({hasText:'누군가 2 친구에게 우주 간식을 썼어요.'}).waitFor();
 await teacher.locator('#chat-log li.private').filter({hasText:'(선생님만) 1 친구가 2 친구에게 우주 간식을 썼어요.'}).waitFor();
 await student2.locator('#self-effects li').filter({hasText:'냠냠 행복'}).waitFor();
 checks.push('Student 1 buys a secret space snack at the street shop and uses it on student 2: the public chat only says "누군가" (not naming student 1), the teacher alone gets a private whisper naming student 1, and student 2\'s passport shows the effect');

 // Scenario 6: trade proposal -> student2 accepts -> teacher approves. Balances are compared to
 // captured "before" snapshots rather than hardcoded numbers.
 const preTradeS1Shards=p.starShards,preTradeS2Shards=p2.starShards;
 await student.locator('#trade-new').click();
 await student.locator('#trade-dialog').waitFor({state:'visible'});
 await student.locator('#trade-target').selectOption({value:p2.id});
 await student.locator('#trade-give-shards').fill('3');
 await student.locator('#trade-submit').click();
 await student.locator('#trade-dialog').waitFor({state:'hidden'});
 await student2.locator('#chat-log li.private').filter({hasText:'1 친구가 거래를 제안했어요. 가방에서 확인해보세요.'}).waitFor();
 await student2.locator('#trades li .trade-accept').click();
 await student.locator('#chat-log li.private').filter({hasText:'2 친구가 수락했어요. 선생님 승인을 기다려요.'}).waitFor();
 await teacher.locator('#teacher-badge').waitFor({state:'visible'});
 await teacher.locator('#teacher-tools').click();
 await teacher.locator('#teacher-dialog').waitFor({state:'visible'});
 await teacher.locator('#teacher-trades li .approve-trade').click();
 await student.locator('#chat-log li.private').filter({hasText:'선생님이 거래를 승인했어요. 가방을 확인해보세요.'}).waitFor();
 await student2.locator('#chat-log li.private').filter({hasText:'선생님이 거래를 승인했어요. 가방을 확인해보세요.'}).waitFor();
 await student.locator('#self-shards').filter({hasText:String(preTradeS1Shards-3)}).waitFor();
 await student2.locator('#self-shards').filter({hasText:String(preTradeS2Shards+3)}).waitFor();
 await teacher.locator('#item-log li').filter({hasText:'거래 1↔2: 승인'}).waitFor();
 await teacher.locator('#teacher-close').click();
 await teacher.locator('#teacher-dialog').waitFor({state:'hidden'});
 checks.push('Trade approval flow: student 1 proposes 3 star shards to student 2, who accepts, the teacher approves it from #teacher-trades, both sides get private whispers at each step, balances move by exactly 3, and the teacher item log records the approval');

 // Scenario 7: teacher rejection leaves both balances untouched.
 const preRejectS1Shards=p.starShards,preRejectS2Shards=p2.starShards;
 await student2.locator('#trade-new').click();
 await student2.locator('#trade-dialog').waitFor({state:'visible'});
 await student2.locator('#trade-target').selectOption({value:id});
 await student2.locator('#trade-give-shards').fill('1');
 await student2.locator('#trade-submit').click();
 await student2.locator('#trade-dialog').waitFor({state:'hidden'});
 await student.locator('#chat-log li.private').filter({hasText:'2 친구가 거래를 제안했어요. 가방에서 확인해보세요.'}).waitFor();
 await student.locator('#trades li .trade-accept').click();
 await student2.locator('#chat-log li.private').filter({hasText:'1 친구가 수락했어요. 선생님 승인을 기다려요.'}).waitFor();
 await teacher.locator('#teacher-badge').waitFor({state:'visible'});
 await teacher.locator('#teacher-tools').click();
 await teacher.locator('#teacher-dialog').waitFor({state:'visible'});
 await teacher.locator('#teacher-trades li .reject-trade').click();
 await student.locator('#chat-log li.private').filter({hasText:'선생님이 거래를 돌려보냈어요.'}).waitFor();
 await student2.locator('#chat-log li.private').filter({hasText:'선생님이 거래를 돌려보냈어요.'}).waitFor();
 assert.equal(p.starShards,preRejectS1Shards);
 assert.equal(p2.starShards,preRejectS2Shards);
 await teacher.locator('#teacher-trades-empty').waitFor({state:'visible'});
 await teacher.locator('#teacher-close').click();
 await teacher.locator('#teacher-dialog').waitFor({state:'hidden'});
 checks.push('Teacher rejecting an accepted trade (student 2 -> student 1, 1 shard) sends both sides a private "돌려보냈어요" whisper and leaves both balances unchanged');

 // Scenario 8: canceling my own outgoing trade proposal. Reuses the same propose wording as
 // Scenario 6, so wait on the newest ("last") matching private message rather than the first.
 await student.locator('#trade-new').click();
 await student.locator('#trade-dialog').waitFor({state:'visible'});
 await student.locator('#trade-target').selectOption({value:p2.id});
 await student.locator('#trade-give-shards').fill('1');
 await student.locator('#trade-submit').click();
 await student.locator('#trade-dialog').waitFor({state:'hidden'});
 await student2.locator('#chat-log li.private').filter({hasText:'1 친구가 거래를 제안했어요. 가방에서 확인해보세요.'}).last().waitFor();
 await student.locator('#trades li .trade-cancel').click();
 await student.locator('#trades-empty').waitFor({state:'visible'});
 checks.push('Student 1 cancels their own outgoing trade proposal to student 2, and #trades-empty shows again on their side');

 // Scenario 9: back to a 390px touch viewport, the bag grid must still fit without horizontal overflow.
 await student.setViewportSize({width:390,height:844});
 assert.ok(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.ok(await student.locator('#bag-list').isVisible());
 assert.ok(await student.locator('#avatar-card').isVisible());
 checks.push('At 390px after all the item/trade scenarios, the bag grid causes no horizontal overflow and #avatar-card stays visible');

 // A clean explicit leave (not just closing the context) keeps room.players.size accurate for the
 // isolation checks right after this block.
 await student2.locator('#leave').click();
 await student2.locator('#leave-dialog').waitFor({state:'visible'});
 await student2.locator('#confirm-leave').click();
 await student2.locator('#lobby').waitFor({state:'visible'});
 await student2Context.close();
 // --- End STEP 7-2 --------------------------------------------------------------------------
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
