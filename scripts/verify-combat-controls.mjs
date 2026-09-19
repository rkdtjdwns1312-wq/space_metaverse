import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClassroomServer} from '../server/app.js';
import {MAP} from '../shared/config.js';
const key='combat-controls-test-key',game=createClassroomServer({teacherKey:key,studentHours:false}),{port}=await game.listen(),url='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),socket=io(url,{transports:['websocket'],reconnection:false});
const checks=[],errors=[],check=t=>{checks.push(t);console.log('Controls '+checks.length+': '+t);};
await mkdir('.local',{recursive:true});
try{
 await new Promise((r,j)=>{socket.once('connect',r);socket.once('connect_error',j);});
 const created=await socket.timeout(5000).emitWithAck('room:create',{teacherKey:key,title:'조작 시험',allowedNames:['별이']});assert.ok(created.ok);
 const page=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#join-code').fill(created.room.code);await page.locator('#nickname').fill('별이');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=game.store.rooms.get(created.room.code),p=[...room.players.values()].find(p=>p.nickname==='별이'),publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 for(const [level,power] of [[2,1],[3,2],[4,3]]){p.avatar.level=level;publish();await page.locator('#dock-avatar').click();await page.waitForFunction(power=>document.getElementById('self-attack-power').textContent==='공격력 · '+power,power);await page.keyboard.press('Escape');}
 check('LV2=1·LV3=2·LV4=3 내 정보 공격력 표시');
 const before={x:p.x,y:p.y,shards:p.starShards,used:p.abilityState.usedWeek};
 await page.locator('#world').focus();await page.keyboard.press('q');await page.waitForFunction(()=>Number(document.getElementById('world').dataset.attackCount)>0);assert.equal(await page.locator('#world').getAttribute('data-last-attack-dy'),'1');
 await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');await page.locator('#toast').filter({hasText:'전투 스킬은 준비 중'}).waitFor();
 assert.equal(p.x,before.x);assert.equal(p.y,before.y);assert.equal(p.starShards,before.shards);assert.equal(p.abilityState.usedWeek,before.used);check('Q 타격 표시·W 준비 안내, W 이동/보상/주간 능력 소비 없음');
 await page.keyboard.down('ArrowDown');await page.waitForTimeout(180);await page.keyboard.up('ArrowDown');assert.ok(p.y>before.y);check('방향키 이동 유지');
 // 시간이 지난 뒤 터치해 키보드와 같은 안내를 확인합니다.
 await page.waitForTimeout(750);await page.locator('#touch-attack').tap();await page.waitForFunction(()=>Number(document.getElementById('world').dataset.attackCount)>0);await page.locator('#touch-skill').tap();await page.locator('#toast').filter({hasText:'전투 스킬'}).waitFor();check('공격/스킬 원형 터치 버튼 연결');
 await page.waitForFunction(()=>Number(document.getElementById('world').dataset.attackCount)===0);
 const avatar=JSON.stringify(p.avatar);await page.locator('#world').focus();await page.keyboard.down('ArrowLeft');await page.waitForTimeout(150);await page.keyboard.up('ArrowLeft');await page.waitForTimeout(500);await page.keyboard.press('q');
 await page.waitForFunction(()=>document.getElementById('world').dataset.lastAttackDx==='-1');assert.equal(JSON.stringify(p.avatar),avatar);
 await page.screenshot({path:'.local/attack-impact.png'});await page.waitForFunction(()=>Number(document.getElementById('world').dataset.attackCount)===0);check('마지막 왼쪽 이동 방향 유지·타격 사라짐·아바타 데이터 불변');
 // 조이스틱 실제 터치로 오른쪽 이동한 뒤 멈추어도 공격 방향은 유지됩니다.
 const cdp=await page.context().newCDPSession(page),box=await page.locator('#joystick').boundingBox(),center={x:box.x+box.width/2,y:box.y+box.height/2,id:1};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[center]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...center,x:center.x+25}]});await page.waitForTimeout(180);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(500);
 await page.locator('#touch-attack').tap();await page.waitForFunction(()=>document.getElementById('world').dataset.lastAttackDx==='1');check('터치 조이스틱 마지막 오른쪽 방향과 터치 공격 연결');
 const pillar=MAP.objects.find(o=>o.id==='pillar-notice');Object.assign(p,{x:pillar.x+65,y:pillar.y});publish();
 await page.locator('#interact-prompt').filter({hasText:pillar.name}).waitFor();await page.locator('#world').focus();await page.keyboard.press('e');await page.locator('#temple-dialog').waitFor({state:'visible'});
 const message=await page.locator('#toast').textContent();await page.keyboard.press('q');await page.keyboard.press('w');assert.equal(await page.locator('#toast').textContent(),message);await page.locator('#temple-close').click();check('E 상호작용 유지·열린 창에서 전투키 차단');
 await page.locator('#dock-chat').click();await page.locator('#open-chat').click();await page.locator('#chat-input').fill('');await page.locator('#chat-input').pressSequentially('qw');assert.equal(await page.locator('#chat-input').inputValue(),'qw');assert.equal(await page.locator('#toast').textContent(),message);await page.keyboard.press('Escape');
 // 대화창은 닫기 버튼으로 닫습니다.
 for(let i=0;i<4&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');check('채팅 입력의 Q/W는 글자로 입력');
 for(const width of [1440,768,390]){
   await page.setViewportSize({width,height:844});
   const ids=['#touch-controls','.bottom-dock','#mobile-controls'],boxes=await Promise.all(ids.map(id=>page.locator(id).boundingBox()));
   const overlap=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.ok(!overlap(boxes[i],boxes[j]),'control overlap '+width);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   for(const id of ['#touch-attack','#touch-skill']){const box=await page.locator(id).boundingBox();assert.ok(Math.abs(box.width-box.height)<2&&box.width>=48);}
 }
 await page.screenshot({path:'.local/combat-mobile.png'});check('1440/768/390px 원형 버튼·조이스틱·하단 메뉴 겹침 없음');
 assert.deepEqual(errors,[]);await writeFile('.local/combat-controls-result.json',JSON.stringify({checks,errors},null,2));
}catch(e){for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:'.local/combat-failure.png'}).catch(()=>{});throw e;}
finally{socket.disconnect();await browser.close();await game.close();}
