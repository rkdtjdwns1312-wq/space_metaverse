import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fillNewClass} from './class-setup.mjs';
import {createClassroomServer} from '../server/app.js';
import {addPlanet} from '../server/world.js';
import {INTERIOR,interiorIdOf,PLAZA_ID,MAP} from '../shared/config.js';

const key=randomBytes(32).toString('hex'),game=createClassroomServer({teacherKey:key,studentHours:false});
const address=await game.listen(),url='http://127.0.0.1:'+address.port;
const browser=await chromium.launch({headless:true,ignoreDefaultArgs:['--hide-scrollbars'],args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const checks=[],errors=[],check=text=>{checks.push(text);console.log(text);};
await mkdir('.local',{recursive:true});
try{
  const teacher=await browser.newPage({viewport:{width:1280,height:900}});teacher.on('pageerror',e=>errors.push(e.message));
  await teacher.goto(url);await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);await fillNewClass(teacher,['1','2']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0];
  async function join(name){const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill(name);await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});return page;}
  const memberPage=await join('1'),outsiderPage=await join('2');
  const member=[...room.players.values()].find(p=>p.nickname==='1'),outsider=[...room.players.values()].find(p=>p.nickname==='2'),teacherPlayer=[...room.players.values()].find(p=>p.role==='teacher');
  const rules=Array.from({length:8},(_,i)=>(i===7?'마지막 규칙:':'규칙 '+(i+1)+':')+'친구를 존중하고 함께 안전하게 생활해요. 바르게 이야기해요.');
  const planet=addPlanet(room,{name:'예술행성',description:'',x:2940,y:2070,color:'#d5c4f3',rules,templateId:'art'});
  member.avatar.departmentId=planet.id;outsider.avatar.departmentId=null;
  const publish=player=>game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
  const move=(player,objectId)=>{const object=INTERIOR.objects.find(item=>item.id===objectId);const y=objectId==='door'?object.y-60:object.y+object.radius+20;Object.assign(player,{mapId:interiorIdOf(planet.id),x:object.x,y,input:{x:0,y:0,at:0}});publish(player);};
  for(const id of ['board','mailbox','report-board','warning-rock','door']){
    move(member,id);await memberPage.waitForTimeout(100);assert.equal(await memberPage.locator('#interior-decorate').isVisible(),false);
  }check('각 오브젝트에는 별도 꾸미기 버튼이 없음');
  const machine=INTERIOR.objects.find(object=>object.id==='department-control-machine');
  move(outsider,machine.id);await outsiderPage.locator('#interact-prompt').waitFor({state:'hidden'});await outsiderPage.keyboard.press('f');
  await outsiderPage.waitForTimeout(100);assert.equal(await outsiderPage.locator('#interior-decor-dialog').isVisible(),false);check('비소속 학생에게 제어장치 꾸미기를 허용하지 않음');
  const styles=[['room','내부공간','하늘빛','별무늬 석판','sky','star'],['mailbox','우체통','장밋빛','달 장식','rose','moon'],['board','게시판','하늘빛','우주 석판','sky','tablet'],['report-board','실적작성표','장밋빛','별 보드','rose','star'],['warning-rock','경고제어돌','민트빛','수정 결정','mint','crystal']];
  for(const [target,name,colorName,shapeName,colorId,shapeId] of styles){
    move(member,machine.id);await memberPage.locator('#interact-object').filter({hasText:'부서행성 제어장치'}).waitFor();await memberPage.locator('#touch-interact').click();
    await memberPage.locator('#interior-decor-dialog').waitFor({state:'visible'});
    assert.deepEqual(await memberPage.locator('#interior-decor-targets [role=tab]').allTextContents(),styles.map(s=>s[1]));
    const boxes=await memberPage.locator('#interior-decor-targets [role=tab]').evaluateAll(tabs=>tabs.map(t=>{const r=t.getBoundingClientRect();return {x:r.x,y:r.y,bottom:r.bottom};}));
    for(let i=1;i<boxes.length;i++){assert.ok(Math.abs(boxes[i].x-boxes[0].x)<1);assert.ok(boxes[i].y>=boxes[i-1].bottom);}
    await memberPage.getByRole('tab',{name,exact:true}).click();
    assert.equal(await memberPage.locator('#interior-decor-colors input').count(),7);assert.equal(await memberPage.locator('#interior-decor-shapes input').count(),3);
    await memberPage.getByRole('radio',{name:colorName,exact:true}).check();await memberPage.getByRole('radio',{name:shapeName,exact:true}).check();
    if(target==='room')await memberPage.screenshot({path:'.local/285-decor-tabs-mobile.png'});
    await memberPage.locator('#interior-decor-save').click();await memberPage.locator('#interior-decor-dialog').waitFor({state:'hidden'});
    assert.deepEqual(planet.interiorDecor[target],{colorId,shapeId});
  }check('제어장치의 세로 탭5개에서 내부공간·우체통·게시판·실적작성표·경고제어돌 꾸미기 저장');
  move(teacherPlayer,machine.id);await teacher.locator('#interact-object').filter({hasText:'부서행성 제어장치'}).waitFor();await teacher.keyboard.press('f');await teacher.locator('#interior-decor-dialog').waitFor({state:'visible'});
  assert.equal(await teacher.locator('#interior-decor-leave').isVisible(),false);
  await teacher.getByRole('tab',{name:'내부공간',exact:true}).focus();await teacher.keyboard.press('ArrowDown');assert.equal(await teacher.getByRole('tab',{name:'우체통',exact:true}).getAttribute('aria-selected'),'true');
  await teacher.getByRole('tab',{name:'실적작성표',exact:true}).click();await teacher.getByRole('radio',{name:'복숭아빛'}).check();await teacher.getByRole('radio',{name:'육각 보드'}).check();await teacher.locator('#interior-decor-save').click();await teacher.locator('#interior-decor-dialog').waitFor({state:'hidden'});
  assert.deepEqual(planet.interiorDecor['report-board'],{colorId:'peach',shapeId:'hex'});check('교사 저장·탭 키보드 방향 이동도 정상');
  for(const [id,caption,dialog,close] of [['warning-rock','경고 제어돌','warning-dialog','warning-close'],['report-board','실적작성표','department-work-dialog','department-work-close'],['mailbox','가입 신청 우체통','mailbox-dialog','mailbox-close']]){
    move(member,id);await memberPage.locator('#interact-object').filter({hasText:caption}).waitFor();await memberPage.locator('#touch-interact').click();await memberPage.locator('#'+dialog).waitFor({state:'visible'});await memberPage.locator('#'+close).click();
  }check('경고·실적작성·우체통 고유 상호작용 유지');
  move(teacherPlayer,'board');await teacher.evaluate(async()=>{const {preloadInteriorArt}=await import('/interior-art.js');await preloadInteriorArt();});
  await teacher.locator('#interior-board-content').waitFor({state:'visible'});
  const metrics=await teacher.locator('#interior-board-rules').evaluate(el=>({font:parseFloat(getComputedStyle(el).fontSize),scroll:el.scrollHeight,client:el.clientHeight,width:el.clientWidth,scrollWidth:el.scrollWidth,direction:getComputedStyle(el).direction,count:el.children.length}));
  assert.equal(metrics.font,22.5);assert.equal(metrics.count,8);assert.equal(metrics.direction,'ltr');assert.ok(metrics.scroll>metrics.client);assert.ok(metrics.scrollWidth<=metrics.width);
  await teacher.screenshot({path:'.local/285-board-before-scroll.png'});
  await teacher.locator('#interior-board-rules').hover();await teacher.mouse.wheel(0,650);await teacher.waitForTimeout(180);
  const scroll=await teacher.locator('#interior-board-rules').evaluate(el=>{const p=el.getBoundingClientRect(),last=el.lastElementChild.getBoundingClientRect();return {top:el.scrollTop,lastVisible:last.bottom<=p.bottom+1};});assert.ok(scroll.top>0);assert.ok(scroll.lastVisible);
  await teacher.screenshot({path:'.local/285-board-after-scroll.png'});check('게시판 글자150%·가로 넘침 없음·오른쪽 스크롤로 마지막 규칙 확인');
  const before={x:teacherPlayer.x,y:teacherPlayer.y};await teacher.locator('#interior-board-rules').focus();await teacher.keyboard.press('Home');await teacher.keyboard.down('ArrowDown');await teacher.waitForTimeout(150);await teacher.keyboard.up('ArrowDown');assert.deepEqual({x:teacherPlayer.x,y:teacherPlayer.y},before);check('게시판 스크롤 키 입력이 아바타 이동을 일으키지 않음');
  move(member,'board');await memberPage.locator('#interior-board-content').waitFor({state:'visible'});
  await memberPage.waitForFunction(()=>Math.abs(Number(document.querySelector('#world').dataset.selfRenderX)-600)<2&&Math.abs(Number(document.querySelector('#world').dataset.selfRenderY)-250)<2);
  assert.ok(await memberPage.locator('#interior-board-rules').evaluate(el=>el.scrollWidth<=el.clientWidth));assert.ok(await memberPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await memberPage.locator('#interior-board-rules').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),'모바일 오른쪽 스크롤 손잡이가 화면 안에 있어야 합니다.');
  const boardGeometry=()=>memberPage.locator('#interior-board-content').evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,x:r.x,y:r.y,lines:[...el.querySelectorAll('li')].map(li=>li.offsetHeight)};});
  const expanded=await boardGeometry();await memberPage.locator('#minimap-toggle').click();await memberPage.waitForTimeout(100);const collapsed=await boardGeometry();
  assert.deepEqual(collapsed,expanded,'미니맵 열기/접기로 게시판 글 위치·폭·줄바꿈을 바꾸지 않음');
  await memberPage.locator('#minimap-toggle').click();await memberPage.waitForTimeout(100);
  const layered=await memberPage.evaluate(()=>{
    const board=document.querySelector('#interior-board-content').getBoundingClientRect(),nav=document.querySelector('#world-navigation'),before=nav.getAttribute('style');
    nav.style.left=board.left+'px';nav.style.top=board.top+'px';nav.style.right='auto';
    const hit=document.elementFromPoint(board.left+8,board.top+8),result=nav.contains(hit);if(before===null)nav.removeAttribute('style');else nav.setAttribute('style',before);return result;
  });assert.equal(layered,true);check('미니맵 크기가 달라도 게시판 글 위치/줄바꿈 유지, 겹치면 미니맵이 위에 표시');
  await memberPage.screenshot({path:'.local/290-board-mobile.png'});check('390px에서 규칙 줄바꿈·오른쪽 스크롤·페이지 가로 넘침 없음');
  await teacher.locator('#world').focus();await teacher.keyboard.press('f');await teacher.locator('#rules-edit-dialog').waitFor({state:'visible'});await teacher.locator('#rules-edit-input').fill('새 규칙을 함께 지켜요.');await teacher.locator('#rules-edit-save').click();await teacher.locator('#rules-edit-dialog').waitFor({state:'hidden'});
  await teacher.locator('#interior-board-rules').filter({hasText:'새 규칙을 함께 지켜요.'}).waitFor();assert.equal(await teacher.locator('#interior-board-rules li').count(),1);check('규칙 수정 후 게시판 내용을 실시간 갱신');
  Object.assign(member,{mapId:PLAZA_ID,...MAP.spawn});publish(member);await memberPage.locator('#interior-board-content').waitFor({state:'hidden'});check('행성 밖에서는 게시판 스크롤 영역 숨김');
  // 실제 학생 제어장치에서 취소/탈퇴/가입 버튼을 확인합니다.
  move(member,machine.id);await memberPage.locator('#interact-object').filter({hasText:'부서행성 제어장치'}).waitFor();await memberPage.locator('#touch-interact').click();
  await memberPage.locator('#interior-decor-dialog').waitFor({state:'visible'});
  const actionBoxes=await memberPage.locator('#interior-decor-dialog .dialog-actions button').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width};}));
  assert.equal(actionBoxes.length,3);assert.ok(actionBoxes[0].x<actionBoxes[1].x&&actionBoxes[1].x<actionBoxes[2].x);
  assert.ok(actionBoxes.every(r=>Math.abs(r.y-actionBoxes[0].y)<2));
  await memberPage.screenshot({path:'.local/290-control-leave-mobile.png'});
  await memberPage.locator('#interior-decor-leave').click();await memberPage.locator('#department-leave-dialog').waitFor({state:'visible'});
  await memberPage.locator('#department-leave-cancel').click();assert.equal(member.avatar.departmentId,planet.id);
  await memberPage.locator('#interior-decor-leave').click();await memberPage.locator('#department-leave-confirm').click();
  await memberPage.locator('#interior-decor-dialog').waitFor({state:'hidden'});assert.equal(member.avatar.departmentId,null);assert.equal(member.mapId,PLAZA_ID);
  check('390px 제어장치 같은줄 왼쪽 탈퇴·게임내 확인 취소 소속유지·확인 후 무소속/광장');
  assert.deepEqual(errors,[]);
}finally{await browser.close();await game.close();}
console.log(JSON.stringify({checks:checks.length,errors}));
