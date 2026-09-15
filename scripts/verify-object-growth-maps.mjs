// 요청 058~060: 실제 조작과 별도 테스트 서버로 물체 안내·성장 표시·위쪽 맵을 확인합니다.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClassroomServer} from '../server/app.js';
import {gainExperience,evolveAvatar} from '../server/progression.js';
import {createAvatar,MAP,ORIGIN_MAPS,PLAZA_ID,mapOf} from '../shared/config.js';
const game=createClassroomServer({teacherKey:'object-growth-maps-test-only-key',studentHours:false}),address=await game.listen(),url='http://127.0.0.1:'+address.port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),checks=[],errors=[];
const check=s=>{checks.push(s);console.log(s);};await mkdir('.local',{recursive:true});
try{
 const teacher=await browser.newPage();await teacher.goto(url,{waitUntil:'domcontentloaded',timeout:25000});await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill('object-growth-maps-test-only-key');await teacher.locator('#allowed-names').fill('1');await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0],page=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
 await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill('1');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const p=[...room.players.values()].find(p=>p.role==='student'),publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 const pillar=MAP.objects.find(o=>o.id==='pillar-notice');Object.assign(p,{x:pillar.x+65,y:pillar.y});publish();
 const prompt=page.locator('#interact-prompt');await prompt.filter({hasText:'E 상호작용하기'}).waitFor();await page.locator('#interact-object').filter({hasText:pillar.name}).waitFor();
 async function aligned(){await page.waitForFunction(o=>{const c=document.getElementById('world'),r=document.getElementById('interact-prompt').getBoundingClientRect(),s=+c.dataset.viewScale,x=(o.x- +c.dataset.viewX)*s,y=(o.y-o.radius- +c.dataset.viewY)*s;return Math.abs(r.x+r.width/2-x)<2&&Math.abs(r.bottom-(y-12))<2;},pillar);}
 await aligned();p.x+=10;publish();await page.waitForTimeout(180);await aligned();await page.screenshot({path:'.local/object-prompt-desktop.png'});check('물체 바로 위 E 문구, 카메라 움직임과 같은 위치 추적');
 await page.locator('#world').focus();await page.keyboard.press('e');await page.locator('#temple-dialog').waitFor({state:'visible'});await prompt.waitFor({state:'hidden'});await page.locator('#temple-close').click();check('E 키 상호작용 유지·창이 열리면 안내 숨김');
 await page.setViewportSize({width:390,height:844});await prompt.waitFor({state:'visible'});await page.waitForFunction(()=>{const r=document.getElementById('interact-prompt').getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight;});const box=await prompt.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390&&box.y>=0&&box.y+box.height<=844);await page.screenshot({path:'.local/object-prompt-mobile.png'});await prompt.tap();await page.locator('#temple-dialog').waitFor({state:'visible'});await page.locator('#temple-close').click();
 Object.assign(p,{x:300,y:1100});publish();await prompt.waitFor({state:'hidden'});assert.equal(await page.locator('#touch-interact').isDisabled(),true);check('휴대폰 물체 안내 잘림 없음·터치로 열기·멀어지면 사라짐');
 await page.locator('#dock-avatar').click();
 for(const [level,xp,denominator] of [[1,14,15],[2,5,20],[3,7,25],[4,8,30],[5,39,40]]){p.avatar={...createAvatar(),level,xp};publish();await page.locator('#self-xp').filter({hasText:xp+' / '+denominator}).waitFor();assert.equal(await page.locator('#experience-bar').getAttribute('max'),String(denominator));}
 await page.locator('#experience-next').filter({hasText:'초월체까지 1 남았어요.'}).waitFor();assert.equal(await page.locator('#avatar-card > :last-child').getAttribute('id'),'experience-panel');await page.screenshot({path:'.local/experience-lv5.png'});
 p.avatar=evolveAvatar(gainExperience(p.avatar,1));publish();await page.locator('#self-level').filter({hasText:'초월체'}).waitFor();await page.locator('#self-xp').filter({hasText:'최고 단계'}).waitFor();check('경험치 5단계 기준·정보 맨 아래 막대·LV5 다음 초월체 표시');await page.keyboard.press('Escape');
 await page.setViewportSize({width:1440,height:960});
 for(const target of [...ORIGIN_MAPS.map(m=>m.id),ORIGIN_MAPS[1].id,ORIGIN_MAPS[0].id,PLAZA_ID]){
   const gate=mapOf(p.mapId,room.planets.values()).objects.find(o=>o.target===target);assert.ok(gate);Object.assign(p,{x:gate.x,y:gate.y});publish();await page.locator('#interact-object').filter({hasText:gate.name}).waitFor();await page.locator('#touch-interact').tap();await page.locator('#minimap-title').filter({hasText:mapOf(target).name}).waitFor();assert.equal(p.mapId,target);
 }check('별의 기원→시작점1→2→3→2→1→중앙 왕복과 미니맵 갱신');
 Object.assign(p,{mapId:ORIGIN_MAPS[1].id,x:600,y:450});publish();await page.locator('#minimap-title').filter({hasText:'별의 시작점 2'}).waitFor();await page.screenshot({path:'.local/star-origin-2.png'});
 await page.locator('#map-overview').click();assert.equal(await page.locator('#universe-links button').count(),7);assert.equal(await page.locator('[aria-current="location"]').getAttribute('data-map-id'),ORIGIN_MAPS[1].id);
 const rows=await Promise.all([2,1,0].map(i=>page.locator('#universe-links [data-map-id="'+ORIGIN_MAPS[i].id+'"]').boundingBox()));assert.ok(rows[0].y<rows[1].y&&rows[1].y<rows[2].y);await page.screenshot({path:'.local/seven-map-atlas.png'});await page.locator('#universe-close').click();check('전체 지도 세 위쪽 맵 배치·현재 맵 표시·닫기');
 const render=()=>page.evaluate(async()=>{const {drawStarOrigin}=await import('/scenery.js'),{ORIGIN_MAPS}=await import('/shared/config.js'),canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;const c=canvas.getContext('2d');drawStarOrigin(c,ORIGIN_MAPS[0],1000);const a=canvas.toDataURL(),corner=[...c.getImageData(0,0,1,1).data];drawStarOrigin(c,ORIGIN_MAPS[0],4600);return {same:a===canvas.toDataURL(),corner};});
 let result=await render();assert.equal(result.same,false);assert.ok(result.corner.slice(0,3).every(v=>v<20));await page.emulateMedia({reducedMotion:'reduce'});result=await render();assert.equal(result.same,true);check('검은 우주·은은한 별 애니메이션·움직임 줄이기 지원');assert.deepEqual(errors,[]);
}finally{await writeFile('.local/object-growth-maps-result.json',JSON.stringify({checks,errors},null,2));await browser.close();await game.close();}
console.log(JSON.stringify({count:checks.length,errors}));
