// 실제 학급에 영향을 주지 않는 메모리 서버에서 교사·학생 2명의 전체 화면 흐름을 검증합니다.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fillNewClass} from './class-setup.mjs';
import {createClassroomServer} from '../server/app.js';
import {addPlanet} from '../server/world.js';
import {PLAZA_ID,INTERIOR,interiorIdOf,PLANET_COLORS} from '../shared/config.js';
const game=createClassroomServer({teacherKey:'department-browser-test-private',studentHours:false});
const address=await game.listen(),url='http://127.0.0.1:'+address.port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),checks=[],errors=[];
await mkdir('.local',{recursive:true});
const check=text=>{checks.push(text);console.log('Department '+checks.length+': '+text);};
try{
 const pages=[];for(let i=0;i<3;i++){const context=await browser.newContext({viewport:{width:1280,height:900}});context.setDefaultTimeout(8000);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});pages.push(page);}
 const [teacher,one,two]=pages;
 await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill('department-browser-test-private');await fillNewClass(teacher,['1','2']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0];
 for(const [page,name] of [[one,'1'],[two,'2']]){await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill(name);await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});}
 const p1=[...room.players.values()].find(p=>p.nickname==='1'),p2=[...room.players.values()].find(p=>p.nickname==='2'),t=[...room.players.values()].find(p=>p.role==='teacher');
 const planet=addPlanet(room,{name:'독서행성',description:'함께 읽어요',x:700,y:400,color:PLANET_COLORS[0],rules:[],templateId:'reading'});
 p1.avatar.departmentId=p2.avatar.departmentId=planet.id;
 const report=INTERIOR.objects.find(object=>object.kind==='report-board');
 Object.assign(p1,{mapId:interiorIdOf(planet.id),x:report.x,y:report.y+45});Object.assign(p2,{mapId:interiorIdOf(planet.id),x:report.x-50,y:report.y+35});Object.assign(t,{mapId:PLAZA_ID,x:planet.x,y:planet.y+95});
 const publish=()=>{for(const p of room.players.values())game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));};publish();
 const document=async page=>{await page.locator('#interact-prompt').filter({hasText:'부서실적 작성하기'}).waitFor({state:'visible'});await page.locator('#interact-prompt').click();await page.locator('#department-text').waitFor({state:'visible'});};
 await document(one);await one.locator('#department-text').fill('책을 종류별로 정리하고 친구에게 책을 소개했어요.');await one.locator('#department-save').click();await one.locator('#department-report-status').filter({hasText:'저장된 실적'}).waitFor();
 await one.locator('#department-work-close').click();await document(one);assert.equal(await one.locator('#department-text').inputValue(),'책을 종류별로 정리하고 친구에게 책을 소개했어요.');check('문서 F 상호작용·작성·저장·닫았다 다시 열기');
 await one.locator('#department-submit').click();await one.locator('#department-report-status').filter({hasText:'실적제출확인요함'}).waitFor();assert.equal(planet.work.report.status,'submitted');assert.equal(game.store.snapshot(room,t).planets.find(p=>p.id===planet.id).reportPending,true);
 await teacher.locator('#interact-prompt').filter({hasText:'독서행성'}).waitFor();await teacher.locator('#interact-prompt').click();await teacher.locator('#planet-work').filter({hasText:'실적제출확인요함'}).click();await teacher.locator('#department-text').waitFor({state:'visible'});assert.match(await teacher.locator('#department-text').inputValue(),/책을 종류별로/);check('제출 상태·교사 행성 상호작용에서 실제 실적 확인');
 await teacher.locator('#department-award-amount').fill('12');await teacher.locator('#department-award').click();await teacher.locator('#department-balance').filter({hasText:'12개'}).waitFor();await teacher.locator('#department-message').filter({hasText:'지급완료되었습니다'}).waitFor({state:'visible'});await teacher.screenshot({path:'.local/095-department-award.png'});await one.waitForFunction(()=>document.getElementById('department-text').value==='');assert.equal(planet.work.report.status,'draft');assert.equal(p1.starShards,0);assert.equal(p2.starShards,0);check('교사 지급은 부서 잔액에만 반영·실적 백지 초기화·학생 창 실시간 갱신');
 await one.locator('[data-tab="distribution"]').click();await one.locator('input[data-player-id="'+p1.id+'"]').fill('12');await one.locator('input[data-player-id="'+p2.id+'"]').fill('0');await one.locator('#department-propose').click();await one.locator('#department-confirmations').filter({hasText:'확인 0 / 2명'}).waitFor();
 await one.locator('#department-confirm').click();await one.locator('#department-confirmations').filter({hasText:'확인 1 / 2명'}).waitFor();assert.equal(p1.starShards,0);check('0개 포함 분배 제안·제안자도 직접 확인·전원 확인 전 지급 안 함');
 await document(two);await two.locator('[data-tab="distribution"]').click();await two.locator('#department-confirmations').filter({hasText:'확인 1 / 2명'}).waitFor();await two.locator('#department-confirm').click();await two.locator('#department-balance').filter({hasText:'0개'}).waitFor();assert.equal(p1.starShards,12);assert.equal(p2.starShards,0);assert.equal(planet.work.history.length,1);check('마지막 부원 확인에서 지정 수량 한 번 지급');
 for(const page of [one,two,teacher]){await page.locator('[data-tab="history"]').click();await page.locator('#department-history').filter({hasText:'1 · 별 파편 12개'}).waitFor();await page.locator('#department-history').filter({hasText:'2 · 별 파편 0개'}).waitFor();}
 await two.setViewportSize({width:390,height:844});assert.ok(await two.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await two.screenshot({path:'.local/department-mobile.png'});await two.locator('#department-work-close').click();await two.locator('#department-work-dialog').waitFor({state:'hidden'});check('교사·두 부원 분배결과 공유·휴대폰 폭 닫기 버튼');
 assert.deepEqual(errors,[]);
}finally{await writeFile('.local/department-browser-result.json',JSON.stringify({checks,errors},null,2));await browser.close();await game.close();}
console.log(JSON.stringify({checks:checks.length,errors}));
