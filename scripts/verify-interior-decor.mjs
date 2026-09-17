import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {createClassroomServer} from '../server/app.js';
import {addPlanet} from '../server/world.js';
import {INTERIOR,interiorIdOf,PLAZA_ID} from '../shared/config.js';

const key=randomBytes(32).toString('hex'),game=createClassroomServer({teacherKey:key,studentHours:false});
const address=await game.listen(),url='http://127.0.0.1:'+address.port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const checks=[],errors=[],check=text=>{checks.push(text);console.log(text);};
await mkdir('.local',{recursive:true});
try{
  const teacher=await browser.newPage({viewport:{width:1280,height:900}});teacher.on('pageerror',e=>errors.push(e.message));
  await teacher.goto(url);await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);await teacher.locator('#allowed-names').fill('1,2');await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0];
  async function join(name){const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill(name);await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});return page;}
  const memberPage=await join('1'),outsiderPage=await join('2');
  const member=[...room.players.values()].find(p=>p.nickname==='1'),outsider=[...room.players.values()].find(p=>p.nickname==='2');
  const planet=addPlanet(room,{name:'예술행성',description:'',x:700,y:450,color:'#d5c4f3',rules:['함께 꾸며요'],templateId:'art'});
  member.avatar.departmentId=planet.id;outsider.avatar.departmentId=null;
  const publish=player=>game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
  const move=(player,objectId)=>{const object=INTERIOR.objects.find(item=>item.id===objectId);const y=objectId==='door'?object.y-60:object.y+object.radius+20;Object.assign(player,{mapId:interiorIdOf(planet.id),x:object.x,y,input:{x:0,y:0,at:0}});publish(player);};
  move(outsider,'warning-rock');await outsiderPage.locator('#interact-object').filter({hasText:'경고 주기'}).waitFor();
  assert.equal(await outsiderPage.locator('#interior-decorate').isVisible(),false);check('부서에 속하지 않은 학생에게는 꾸미기 버튼이 보이지 않음');
  const variants=[['warning-rock','민트빛','수정 결정','mint','crystal'],['report-board','장밋빛','별 보드','rose','star'],['board','하늘빛','우주 석판','sky','tablet'],['door','별빛 노랑','둥근 포털','gold','portal'],
    ['warning-rock','복숭아빛','작은 운석','peach','meteor'],['report-board','민트빛','육각 보드','mint','hex'],['board','라벤더빛','별빛 두루마리','lavender','scroll'],['door','하늘빛','별빛 문','sky','star']];
  for(const [id,colorName,shapeName,colorId,shapeId] of variants){
    move(member,id);await memberPage.locator('#interior-decorate').waitFor({state:'visible'});await memberPage.locator('#interior-decorate').click();
    await memberPage.locator('#interior-decor-dialog').waitFor({state:'visible'});
    assert.equal(await memberPage.locator('#interior-decor-colors input').count(),7);
    assert.equal(await memberPage.locator('#interior-decor-shapes input').count(),3);
    await memberPage.getByRole('radio',{name:colorName}).check();await memberPage.getByRole('radio',{name:shapeName}).check();
    await memberPage.locator('#interior-decor-save').click();await memberPage.locator('#interior-decor-dialog').waitFor({state:'hidden'});
    assert.deepEqual(planet.interiorDecor[id],{colorId,shapeId});
  }
  check('경고 돌·실적판·규칙판·출구 각각 7색·3모양을 고르고 다른 모양까지 저장함');
  move(member,'warning-rock');await memberPage.locator('#interact-object').filter({hasText:'경고 주기'}).waitFor();await memberPage.locator('#touch-interact').click();await memberPage.locator('#warning-dialog').waitFor({state:'visible'});await memberPage.locator('#warning-close').click();
  move(member,'report-board');await memberPage.locator('#interact-object').filter({hasText:'부서실적 작성하기'}).waitFor();await memberPage.locator('#touch-interact').click();await memberPage.locator('#department-work-dialog').waitFor({state:'visible'});await memberPage.locator('#department-work-close').click();
  check('꾸민 뒤에도 경고 주기와 부서실적 작성 상호작용이 유지됨');
  move(member,'board');await memberPage.locator('#interior-decorate').waitFor({state:'visible'});await memberPage.screenshot({path:'.local/interior-decor-mobile.png'});
  assert.ok(await memberPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
}finally{await browser.close();await game.close();}
console.log(JSON.stringify({checks:checks.length,errors}));
