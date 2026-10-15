// 임시 메모리 교실만 사용합니다. 실제 학생 저장 파일에는 접근하지 않습니다.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {addPlanet} from '../server/world.js';
import {PLAZA_ID,PLANET_COLORS} from '../shared/config.js';
import {departmentSlots} from '../shared/plaza-layout.js';
import {JOURNEY_VERSION} from '../shared/tutorial-journey.js';

const key='planet-move-browser-test',game=createClassroomServer({teacherKey:key,studentHours:false}),checks=[],errors=[];
let browser,teacher;
await mkdir('.local/649-planet',{recursive:true});
try{
  const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
  teacher=io(url,{transports:['websocket'],reconnection:false});
  await new Promise((r,j)=>{teacher.once('connect',r);teacher.once('connect_error',j);});
  const made=await teacher.timeout(5000).emitWithAck('room:create',{teacherKey:key,allowedNames:['이동검사']});assert.equal(made.ok,true);
  const room=game.store.rooms.get(made.room.code),sites=departmentSlots();
  const planet=addPlanet(room,{name:'이동행성',description:'위치 이동 검사',...sites[0],color:PLANET_COLORS[0],rules:[],templateId:'reading'});
  const other=addPlanet(room,{name:'다른행성',description:'',...sites[4],color:PLANET_COLORS[1],rules:[],templateId:'meal'});
  browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.locator('#student-tab').click();await page.locator('#join-code').fill(room.code);
  await page.locator('#nickname').fill('이동검사');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();
  await page.locator('#lobby').waitFor({state:'hidden'});
  if(await page.locator('#tutorial-dialog').evaluate(d=>d.open))await page.locator('#tutorial-later').click();
  const p=[...room.players.values()].find(p=>p.role==='student');
  p.journey={version:JOURNEY_VERSION,stage:6,goals:[],claimedAt:Array(5).fill(Date.now()),practiceUntil:0};p.tutorialCompleted=true;
  Object.assign(p,{mapId:PLAZA_ID,x:planet.x,y:planet.y+100});p.avatar.departmentId=planet.id;
  const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
  publish();await page.waitForTimeout(350);
  const clickPoint=async(point,placing=false)=>{
    const coords=await page.evaluate(point=>{
      const canvas=document.querySelector('#world'),r=canvas.getBoundingClientRect();
      return {x:r.left+(point.x-Number(canvas.dataset.viewX))*Number(canvas.dataset.viewScale),y:r.top+(point.y-Number(canvas.dataset.viewY))*Number(canvas.dataset.viewScale)};
    },point);
    await page.mouse.click(coords.x,coords.y);
  };
  const open=async()=>{await page.waitForTimeout(150);await clickPoint(planet);await page.locator('#planet-dialog').waitFor({state:'visible'});};
  const start=async()=>{await open();await page.locator('#planet-move').click();
    try{await page.waitForFunction(()=>document.body.classList.contains('placing'),null,{timeout:5000});}
    catch(e){console.log(JSON.stringify({errors,state:await page.evaluate(()=>({body:document.body.className,dialog:document.querySelector('#planet-dialog').open,caption:document.querySelector('#map-caption').textContent}))}));throw e;}
    await page.waitForTimeout(100);};
  await open();assert.equal(await page.locator('#planet-move').isVisible(),true);
  assert.equal(await page.evaluate(()=>!!(document.querySelector('#planet-move').compareDocumentPosition(document.querySelector('#planet-remove'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);
  checks.push('부원 이동 버튼 표시·없애기 왼쪽 DOM 순서');
  await page.screenshot({path:'.local/649-planet/member-dialog.png'});await page.locator('#planet-close').click();
  await start();await page.keyboard.press('Escape');assert.equal(planet.x,sites[0].x);checks.push('위치 선택 Escape 취소');
  await start();await clickPoint(sites[0],true);await page.waitForFunction(()=>!document.body.classList.contains('placing'));
  assert.equal(planet.x,sites[0].x);assert.equal(await page.locator('#planet-move-dialog').isVisible(),false);checks.push('현재 위치 선택 무변경');
  await start();await clickPoint(other,true);assert.equal(await page.locator('#planet-move-dialog').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.body.classList.contains('placing')),true);checks.push('다른 행성 자리 거부');
  await clickPoint(sites[2],true);await page.locator('#planet-move-dialog').waitFor({state:'visible'});
  await page.locator('#planet-move-cancel').click();assert.equal(planet.x,sites[0].x);checks.push('확인창 취소 무변경');
  await start();await clickPoint(sites[2],true);await page.locator('#planet-move-dialog').waitFor({state:'visible'});
  await page.screenshot({path:'.local/649-planet/confirmation.png'});
  const balance=p.starShards;await page.locator('#planet-move-submit').click();await page.locator('#planet-move-dialog').waitFor({state:'hidden'});
  assert.ok(Math.hypot(planet.x-sites[2].x,planet.y-sites[2].y)<=3);assert.equal(p.starShards,balance);const movedX=planet.x;checks.push('무료 이동 서버 반영');
  Object.assign(p,{x:planet.x,y:planet.y+100});publish();await page.waitForTimeout(350);
  await open();assert.match(await page.locator('#planet-title').innerText(),/이동행성/);checks.push('새 지도 위치 클릭으로 같은 행성 정보 열기');
  p.avatar.departmentId=null;publish();await page.locator('#planet-move').waitFor({state:'hidden'});checks.push('비부원 버튼 숨김');
  p.avatar.departmentId=planet.id;p.role='teacher';publish();await page.locator('#planet-move').waitFor({state:'hidden'});checks.push('교사 버튼 숨김');
  p.role='student';publish();await page.locator('#planet-move').waitFor({state:'visible'});await page.locator('#planet-close').click();
  await start();await clickPoint(sites[3],true);await page.locator('#planet-move-dialog').waitFor({state:'visible'});
  p.avatar.departmentId=null;publish();await page.locator('#planet-move-dialog').waitFor({state:'hidden'});assert.equal(planet.x,movedX);checks.push('선택 후 소속 해제 시 확인창 취소');
  assert.deepEqual(errors,[]);await writeFile('.local/649-planet/results.json',JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({passed:checks.length,checks,errors}));
}finally{teacher?.disconnect();await browser?.close();await game.close();}
