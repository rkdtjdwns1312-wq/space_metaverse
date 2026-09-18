// 지도·터치 조작·카메라 회귀 검증. 실제 학급과 분리된 메모리 서버만 사용합니다.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fillNewClass} from './class-setup.mjs';
import {createClassroomServer} from '../server/app.js';
import {MAP,STREET,VALLEY,STATIC_MAPS,PLAZA_ID,STREET_ID,GARDEN_ID,VALLEY_ID,interiorIdOf,PLANET_COLORS} from '../shared/config.js';
import {addPlanet} from '../server/world.js';
const key='navigation-test-only-private-key',game=createClassroomServer({teacherKey:key,studentHours:false});
const address=await game.listen(),url='http://127.0.0.1:'+address.port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const checks=[],errors=[];await mkdir('.local',{recursive:true});
const check=t=>{checks.push(t);console.log('Navigation '+checks.length+': '+t);};
try{
 const context=await browser.newContext({viewport:{width:1440,height:960},hasTouch:true});context.setDefaultTimeout(10000);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['1']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0],p=[...room.players.values()][0];
 const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 const button=await page.locator('#map-overview').boundingBox();assert.ok(button.x>1100&&button.y<35);assert.equal(await page.locator('#menu-dialog #map-overview').count(),0);
 await page.locator('#minimap-title').filter({hasText:'별의 기원'}).waitFor();check('오른쪽 위 지도 버튼과 현재 맵 미니맵');
 await page.locator('#minimap-toggle').click();
 assert.equal(await page.locator('#minimap').isVisible(),false);assert.equal(await page.locator('#minimap-title').isVisible(),false);assert.equal(await page.locator('#map-overview').isVisible(),false);assert.equal(await page.locator('#minimap-toggle').textContent(),'지도 보기');assert.equal(await page.locator('#minimap-toggle').getAttribute('aria-expanded'),'false');
 await page.locator('#minimap-toggle').click();
 assert.equal(await page.locator('#minimap').isVisible(),true);assert.equal(await page.locator('#minimap-title').isVisible(),true);assert.equal(await page.locator('#map-overview').isVisible(),true);assert.equal(await page.locator('#minimap-toggle').textContent(),'맵 닫기');assert.equal(await page.locator('#minimap-toggle').getAttribute('aria-expanded'),'true');check('미니맵 접기·지도 보기로 다시 열기');
 await page.locator('#map-overview').click();await page.locator('#universe-dialog').waitFor({state:'visible'});
 assert.equal(await page.locator('#universe-links button').count(),Object.keys(STATIC_MAPS).length);assert.equal(await page.locator('[aria-current="location"]').getAttribute('data-map-id'),PLAZA_ID);
 await page.locator('#universe-links [data-map-id="'+GARDEN_ID+'"]').click();assert.equal(p.mapId,PLAZA_ID);assert.equal(await page.locator('#universe-preview').getAttribute('data-has-player'),'false');
 await page.locator('#universe-close').click();await page.waitForFunction(()=>document.activeElement.id==='world');
 await page.locator('#map-overview').click();await page.keyboard.press('Escape');await page.locator('#universe-dialog').waitFor({state:'hidden'});check('연결 맵과 현위치 표시, 지도 선택은 이동하지 않음, 닫기·Esc');
 // 이전 메뉴 버튼에 초점이 남아도 방향키는 맵을 조작해야 합니다.
 Object.assign(p,{x:300,y:500,mapId:PLAZA_ID});publish();await page.waitForFunction(()=>Math.abs(+document.getElementById('world').dataset.selfRenderY-500)<50);
 await page.locator('#dock-menu').click();const before=p.y;await page.keyboard.down('ArrowDown');await page.waitForTimeout(160);await page.keyboard.up('ArrowDown');assert.equal(p.y,before);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement.id==='world');await page.locator('#dock-avatar').focus();
 const samples=page.evaluate(()=>new Promise(resolve=>{const values=[],start=performance.now();function tick(){const c=document.getElementById('world'),y=+c.dataset.selfRenderY;values.push({y,screen:(y- +c.dataset.viewY)* +c.dataset.viewScale});if(performance.now()-start>700)resolve(values);else requestAnimationFrame(tick);}tick();}));
 await page.keyboard.down('ArrowDown');await page.waitForTimeout(600);await page.keyboard.up('ArrowDown');const positions=await samples;
 assert.ok(p.y>before+80,JSON.stringify({before,after:p.y,input:p.input,errors}));assert.equal(await page.locator('dialog[open]').count(),0);assert.ok(Math.max(...positions.map(v=>v.screen))-Math.min(...positions.map(v=>v.screen))<1,'camera and avatar must use identical smoothed position');
 for(let i=1;i<positions.length;i++)assert.ok(positions[i].y>=positions[i-1].y-.01,'forward movement must not rewind');
 await page.waitForFunction(y=>+document.getElementById('minimap').dataset.playerY>y,before+60);check('메뉴 후 방향키 초점 정상·열린 창 이동 차단·미니맵 점 이동·카메라 역행 없음');
 const cdp=await context.newCDPSession(page),stick=await page.locator('#joystick').boundingBox();
 const start={x:stick.x+stick.width/2,y:stick.y+stick.height/2};
 const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
 const xBefore=p.x;
 await touch('touchStart',[{...start,id:1}]);await touch('touchMove',[{x:start.x+25,y:start.y,id:1}]);await page.waitForTimeout(220);await touch('touchEnd',[]);await page.waitForTimeout(150);
 assert.ok(p.x>xBefore+30);const stopped=p.x;await page.waitForTimeout(180);assert.equal(p.x,stopped);
 await touch('touchStart',[{...start,id:1}]);await touch('touchMove',[{x:start.x-20,y:start.y,id:1}]);await page.waitForTimeout(100);await touch('touchCancel',[]);await page.waitForTimeout(100);assert.equal(p.input.x,0);check('실제 터치 조이스틱 이동·손 떼기·터치 취소 후 정지');
 const gate=MAP.objects.find(o=>o.target===GARDEN_ID);Object.assign(p,{x:gate.x,y:gate.y,mapId:PLAZA_ID});publish();
 await page.waitForFunction(()=>!document.getElementById('touch-interact').disabled);await page.locator('#touch-interact').tap();await page.locator('#minimap-title').filter({hasText:'태양이 머무는 낙원'}).waitFor();assert.equal(p.mapId,GARDEN_ID);
 await page.locator('#map-overview').click();assert.equal(await page.locator('[aria-current="location"]').getAttribute('data-map-id'),GARDEN_ID);check('오른쪽 터치 E로 실제 맵 이동, 미니맵·전체 지도 현위치 변경');
 await page.locator('#universe-close').click();
 const planet=addPlanet(room,{name:'독서행성',description:'',x:700,y:400,color:PLANET_COLORS[0],rules:[],templateId:'reading'});Object.assign(p,{mapId:interiorIdOf(planet.id),x:600,y:560});publish();
 await page.locator('#map-overview').click();await page.locator('#universe-current').filter({hasText:'독서행성'}).waitFor();assert.equal(await page.locator('#universe-planets [aria-current="location"]').count(),1);await page.locator('#universe-close').click();check('동적으로 만든 부서행성 내부에서도 현위치 표시');
 for(const width of [1440,768,390]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(100);
   const boxes=await Promise.all(['#touch-controls','.bottom-dock','#mobile-controls'].map(id=>page.locator(id).boundingBox()));
   const overlap=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.ok(!overlap(boxes[i],boxes[j]),'controls overlap at '+width);
   assert.ok(Math.abs(boxes[0].y+boxes[0].height-boxes[1].y-boxes[1].height)<2);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.screenshot({path:'.local/navigation-mobile.png'});await page.locator('#map-overview').click();await page.locator('#universe-close').waitFor({state:'visible'});await page.screenshot({path:'.local/navigation-atlas.png'});check('1440·768·390px 하단 조작 충돌 없음·같은 높이·지도 닫기 접근');
 await page.locator('#universe-close').click();await page.setViewportSize({width:1440,height:960});
 for(const id of ['pillar-notice','pillar-timetable','pillar-effects','pillar-weekly']){
   const pillar=MAP.objects.find(o=>o.id===id);Object.assign(p,{mapId:PLAZA_ID,x:pillar.x+65,y:pillar.y});publish();
   await page.locator('#interact-prompt').filter({hasText:pillar.name}).waitFor({state:'visible'});await page.locator('#touch-interact').tap();await page.locator('#temple-title').filter({hasText:pillar.name}).waitFor();
   if(pillar.service==='notice'){await page.locator('.notice-line').first().waitFor({state:'visible'});await page.locator('.notice-line').first().fill('오늘도 즐겁게');await page.locator('#temple-add-line').click();await page.locator('.notice-line').nth(1).fill('함께 배워요');await page.locator('#temple-save').click();await page.locator('.notice-line').first().waitFor();assert.equal(await page.locator('.notice-line').first().inputValue(),'오늘도 즐겁게');}
   else if(pillar.service==='timetable'){await page.getByRole('textbox',{name:'월요일 1교시 과목'}).fill('우주과학');await page.locator('#temple-save').click();await page.locator('#toast').filter({hasText:'시간표를 저장했어요'}).waitFor();assert.equal(room.temple.schedule[0][0],'우주과학');}
   else await page.locator('#temple-content').filter({hasText:/없어요/}).waitFor();
   await page.locator('#temple-close').click();
 }
 await page.screenshot({path:'.local/navigation-desktop.png'});check('기둥 4개 실제 E 상호작용·알림장/시간표 저장·목록 창 닫기');
 const valleyGate=MAP.objects.find(o=>o.target===VALLEY_ID);Object.assign(p,{mapId:PLAZA_ID,x:valleyGate.x,y:valleyGate.y});publish();
 await page.locator('#interact-prompt').filter({hasText:'은하수계곡'}).waitFor();await page.locator('#touch-interact').tap();await page.locator('#minimap-title').filter({hasText:'은하수계곡'}).waitFor();assert.equal(p.mapId,VALLEY_ID);
 await page.screenshot({path:'.local/map-valley.png'});const valleyPicture=await page.locator('#world').evaluate(c=>c.toDataURL());await page.waitForTimeout(250);assert.notEqual(await page.locator('#world').evaluate(c=>c.toDataURL()),valleyPicture);
 Object.assign(p,{x:600,y:155});publish();await page.locator('#interact-prompt').filter({hasText:'별의 기원'}).waitFor();await page.locator('#touch-interact').tap();await page.locator('#minimap-title').filter({hasText:'별의 기원'}).waitFor();assert.equal(p.mapId,PLAZA_ID);check('은하수계곡 아래 문 왕복·잔잔한 흐름 애니메이션');
 for(const [mapId,file] of [[GARDEN_ID,'map-sun'],[STREET_ID,'map-rainbow']]){Object.assign(p,{mapId,x:600,y:450});publish();await page.waitForTimeout(180);await page.screenshot({path:'.local/'+file+'.png'});}
 for(const machine of STREET.objects.filter(o=>o.kind==='arcade')){
   Object.assign(p,{mapId:STREET_ID,x:machine.x,y:machine.y+72});publish();await page.locator('#interact-prompt').filter({hasText:machine.name}).waitFor();await page.locator('#touch-interact').tap();await page.locator('#arcade-dialog').waitFor({state:'visible'});
   const board=page.locator('#arcade-board');
   // 각 게임의 경계값·완료 조건은 전용 verify-*.mjs에서 검증합니다.
   // 여기서는 실제 오락기 접근→정확한 게임 창→닫기 연결을 확인합니다.
   assert.ok(await board.locator('button').count()>0);
   if(machine.gameId==='stars'){
     await board.locator('#star-start').click();
     for(let n=0;n<10;n++){await board.getByRole('button',{name:'⭐',exact:true}).click();await board.locator('#star-timer').filter({hasText:(n+1)+' / 10'}).waitFor();}
     await board.locator('#star-timer').filter({hasText:'10 / 10'}).waitFor();
     await board.getByRole('button',{name:'랭킹 보기',exact:true}).click();
     await board.locator('#star-ranking').filter({hasText:'1위'}).waitFor();
   }
   await page.locator('#arcade-close').click();check('오락기 실제 접근·게임 창·닫기: '+machine.name);
 }
 await page.waitForTimeout(3200);assert.equal(await page.locator('#arcade-board').locator('button').count(),0);
 assert.deepEqual(errors,[]);await writeFile('.local/navigation-result.json',JSON.stringify({checks,errors},null,2));
}catch(error){for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:'.local/navigation-failure.png'}).catch(()=>{});throw error;}
finally{await browser.close();await game.close();}
