import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createClassroomServer} from '../server/app.js';
import {addPlanet} from '../server/world.js';
import {BLACK_HOLE_ID,interiorIdOf} from '../shared/config.js';

const key=randomBytes(32).toString('hex'),game=createClassroomServer({teacherKey:key,studentHours:false});
const address=await game.listen(),url='http://127.0.0.1:'+address.port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[],checks=[];
const check=text=>{checks.push(text);console.log(text);};
async function join(name,code){
  const page=await browser.newPage({viewport:{width:1440,height:960}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.locator('#join-code').fill(code);await page.locator('#nickname').fill(name);await page.locator('#student-pin').fill('1234');
  await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});return page;
}
try{
  const teacher=await browser.newPage({viewport:{width:1440,height:960}});teacher.on('pageerror',e=>errors.push(e.message));
  await teacher.goto(url);await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);
  await teacher.locator('#allowed-names').fill('1,2');await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0],actorPage=await join('1',room.code),targetPage=await join('2',room.code);
  const actor=[...room.players.values()].find(p=>p.nickname==='1'),target=[...room.players.values()].find(p=>p.nickname==='2');
  const planet=addPlanet(room,{name:'규칙행성',description:'',x:300,y:400,color:'#c5c9f7',rules:['공평하게'],templateId:'rules'});
  actor.avatar.departmentId=planet.id;Object.assign(actor,{mapId:interiorIdOf(planet.id),x:330,y:480});
  game.io.to(actor.socketId).emit('room:state',game.store.snapshot(room,actor));
  await actorPage.locator('#interact-object').filter({hasText:'경고 주기'}).waitFor();
  await actorPage.locator('#touch-interact').click();await actorPage.locator('#warning-dialog').waitFor({state:'visible'});
  assert.match(await actorPage.locator('#warning-title').textContent(),/규칙행성/);
  await actorPage.locator('#warning-threshold').fill('2');await actorPage.locator('#warning-threshold-save').click();
  await actorPage.locator('#warning-summary').filter({hasText:'2회'}).waitFor();check('부서 소속 학생이 경고 돌에서 기준 횟수를 정함');
  actorPage.on('dialog',dialog=>dialog.accept());
  await actorPage.locator('#warning-target').selectOption(target.id);await actorPage.locator('#warning-reason').fill('약속을 어김');
  await actorPage.locator('#warning-issue').click();await actorPage.locator('#warning-target option').filter({hasText:'경고 1회'}).waitFor({state:'attached'});
  await actorPage.locator('#warning-reason').fill('같은 약속을 다시 어김');await actorPage.locator('#warning-issue').click();
  await targetPage.locator('#minimap-title').filter({hasText:'블랙홀'}).waitFor();
  assert.equal(target.mapId,BLACK_HOLE_ID);assert.ok(target.avatar.blackStar);check('두 번째 직접 경고에서 학생이 검은별로 변해 블랙홀로 이동');
  Object.assign(target,{x:600,y:630});game.io.to(target.socketId).emit('room:state',game.store.snapshot(room,target));
  await targetPage.locator('#interact-object').filter({hasText:'블랙홀 밖으로 나가기'}).waitFor();
  await targetPage.locator('#touch-interact').click();await targetPage.locator('#toast').filter({hasText:'현재 검은별 상태입니다'}).waitFor();
  check('검은별 학생의 블랙홀 출구가 안내와 함께 차단됨');
  await teacher.locator('#dock-menu').click();await teacher.locator('#teacher-tools').click();
  await teacher.locator('#black-star-list-button').click();await teacher.locator('#black-star-dialog').waitFor({state:'visible'});
  assert.match(await teacher.locator('#black-star-students').textContent(),/2 · 규칙행성 경고/);
  teacher.on('dialog',dialog=>dialog.accept());await teacher.locator('#black-star-students button').click();
  await teacher.locator('#black-star-empty').waitFor({state:'visible'});
  await targetPage.locator('#minimap-title').filter({hasText:'별의 기원'}).waitFor();
  assert.equal(target.avatar.blackStar,null);check('선생님 명단에 경고 부서가 표시되고 해제 시 학생이 광장으로 돌아옴');
  assert.deepEqual(errors,[]);
}finally{await browser.close();await game.close();}
console.log(JSON.stringify({checks:checks.length,errors}));
