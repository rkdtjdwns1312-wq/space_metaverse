// 실제 입장 폼·가방·교사 도구를 이용하고 서버 인스턴스도 완전히 새로 만들어 복원을 검증합니다.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClassroomServer } from '../server/app.js';
import { STREET, STREET_ID, SHOP } from '../shared/config.js';

export async function verifyPersistence(browser){
  const dataDir=mkdtempSync(join(tmpdir(),'browser-class-')),teacherKey=randomBytes(32).toString('hex');
  let game,url;const checks=[],errors=[],contexts=[];
  const start=async()=>{game=createClassroomServer({teacherKey,dataDir,studentHours:false,unattended:false,teacherManagedAccounts:false});const a=await game.listen();url='http://127.0.0.1:'+a.port;};
  const page=async()=>{const c=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(c);
    const p=await c.newPage();p.setDefaultTimeout(10_000);p.on('pageerror',e=>errors.push(e.message));return p;};
  const visit=async(p,teacher=false)=>{await p.goto(url);await p.locator('#connection').filter({hasText:'연결되었어요'}).waitFor({state:'attached'});
    if(teacher){await p.locator('#teacher-tab').click();await p.locator('#teacher-key').fill(teacherKey);}};
  const studentJoin=async(p,code,pin)=>{await p.locator('#join-code').fill(code);await p.locator('#nickname').fill('1');
    await p.locator('#student-pin').fill(pin);await p.locator('#student-form button[type=submit]').click();};
  const closeOpenDialogs=async(p)=>{for(let i=0;i<12&&await p.locator('dialog[open]').count();i++)await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('dialog[open]'));};
  const openChat=async(p)=>{await closeOpenDialogs(p);await p.locator('#dock-chat').click();await p.locator('#social-dialog').waitFor({state:'visible'});await p.locator('#open-chat').click();await p.locator('#chat-dialog').waitFor({state:'visible'});};
  const openMenu=async(p)=>{await closeOpenDialogs(p);await p.locator('#dock-menu').click();await p.locator('#menu-dialog').waitFor({state:'visible'});};
  const clickPlanet=async(p,planet)=>{
    await openMenu(p);if(await p.locator('#map-overview').textContent()==='전체 우주 지도')await p.locator('#map-overview').click();else await closeOpenDialogs(p);
    await p.waitForTimeout(100);const box=await p.locator('#world').boundingBox();
    const v=await p.locator('#world').evaluate(c=>({x:+c.dataset.viewX,y:+c.dataset.viewY,scale:+c.dataset.viewScale}));
    await p.mouse.click(box.x+(planet.x-v.x)*v.scale,box.y+(planet.y-v.y)*v.scale);await p.locator('#planet-dialog').waitFor({state:'visible'});
  };
  try{
    await start();const teacher=await page(),student=await page();await visit(teacher,true);
    await teacher.locator('#allowed-names').fill('1, 2');await teacher.locator('#seed-planets').check();
    await teacher.locator('#teacher-form button[type=submit]').click();await teacher.locator('#lobby').waitFor({state:'hidden'});await openMenu(teacher);
    const code=(await teacher.locator('#room-code').innerText()).trim();assert.match(code,/^[A-Z2-9]{6}$/);
    await visit(student);await studentJoin(student,code,'2468');await student.locator('#lobby').waitFor({state:'hidden'});
    assert.equal(await student.locator('#student-pin').inputValue(),'');checks.push('첫 입장 PIN 등록과 입력란 비우기');
    const room=game.store.rooms.get(code),p=[...room.players.values()].find(p=>p.nickname==='1'),id=p.id,planet=[...room.planets.values()][0];
    await clickPlanet(student,planet);await student.locator('#planet-join').click();
    await student.locator('#self-department').filter({hasText:planet.name}).waitFor({state:'attached'});await student.locator('#planet-close').click();
    await clickPlanet(teacher,planet);await teacher.locator('#planet-rules-toggle').click();
    await teacher.locator('#planet-rules-input').fill('책을 소중하게 읽어요');await teacher.locator('#planet-rules-save').click();
    await teacher.locator('#planet-rules-list li').filter({hasText:'책을 소중하게 읽어요'}).waitFor({state:'attached'});await teacher.locator('#planet-close').click();
    // 이동 자체는 기존 82개 시나리오에서 검증합니다. 이 검사는 상점 앞을 시작 위치로 고정합니다.
    const shop=STREET.objects.find(o=>o.kind==='shop');Object.assign(p,{mapId:STREET_ID,x:shop.x,y:shop.y+shop.radius+30});
    await openMenu(teacher);await teacher.locator('#teacher-tools').click();await teacher.locator('#shards-target').selectOption(id);
    await teacher.locator('#shards-amount').fill('40');await teacher.locator('#shards-give').click();
    await student.locator('#self-shards').filter({hasText:'40'}).waitFor({state:'attached'});await teacher.locator('#teacher-close').click();
    await student.locator('#interact-prompt').filter({hasText:'별상점'}).click();
    await student.locator('#shop-buy-list li.item').first().getByRole('button',{name:'사기',exact:true}).click();
    const balance=String(40-SHOP.items[0].price);
    await student.locator('#self-shards').filter({hasText:balance}).waitFor({state:'attached'});await student.locator('#shop-close').click();
    await openChat(student);await openChat(teacher);await student.locator('#chat-input').fill('다음 수업에도 만나요');await student.locator('#chat-send').click();
    await student.locator('#chat-log li').filter({hasText:'다음 수업에도 만나요'}).waitFor({state:'attached'});
    assert.equal(await teacher.locator('#chat-log li').filter({hasText:'다음 수업에도 만나요'}).count(),0);
    checks.push('행성 가입·규칙 수정·개별 지급·상점 구매·채팅을 UI로 저장');
    await openMenu(teacher);await teacher.getByRole('button',{name:'수업 마치기',exact:true}).click();await teacher.locator('#confirm-leave').click();
    await student.locator('#lobby').waitFor({state:'visible'});assert.equal(game.store.rooms.size,0);
    checks.push('수업 마치기 후 학생 입장 화면 복귀와 교실 코드 보존');
    await game.close();game=null;await start();const nextTeacher=await page(),nextStudent=await page();
    await visit(nextTeacher,true);await nextTeacher.locator('#class-mode').selectOption('open');
    await nextTeacher.locator('#saved-classes-button').click();await nextTeacher.locator('#saved-classes').waitFor({state:'visible'});
    await nextTeacher.locator('#saved-classes').selectOption(code);assert.equal(await nextTeacher.locator('#open-code').inputValue(),code);
    await nextTeacher.locator('#teacher-form button[type=submit]').click();await nextTeacher.locator('#lobby').waitFor({state:'hidden'});await openMenu(nextTeacher);
    assert.equal((await nextTeacher.locator('#room-code').innerText()).trim(),code);
    checks.push('새 서버에서 교사 키로 저장 교실 목록 조회 및 같은 코드 다시 열기');
    await visit(nextStudent);await studentJoin(nextStudent,code,'1111');
    await nextStudent.locator('#form-message').filter({hasText:'비밀번호가 맞지'}).waitFor({state:'attached'});
    await studentJoin(nextStudent,code,'2468');await nextStudent.locator('#lobby').waitFor({state:'hidden'});
    await nextStudent.locator('#self-shards').filter({hasText:balance}).waitFor({state:'attached'});
    assert.equal(await nextStudent.locator('#bag-list li').count(),1);
    await nextStudent.locator('#self-department').filter({hasText:planet.name}).waitFor({state:'attached'});
    assert.equal(await nextStudent.locator('#chat-log li').filter({hasText:'다음 수업에도 만나요'}).count(),0);
    assert.ok(game.store.rooms.get(code).chat.history.some(m=>m.text==='다음 수업에도 만나요'&&m.mapId===STREET_ID));
    await nextStudent.locator('#chat-log li.private').filter({hasText:'40개'}).waitFor({state:'attached'});
    assert.equal([...game.store.rooms.get(code).players.values()].find(p=>p.nickname==='1').id,id);
    await clickPlanet(nextStudent,planet);await nextStudent.locator('#planet-rules-toggle').click();
    await nextStudent.locator('#planet-rules-list li').filter({hasText:'책을 소중하게 읽어요'}).waitFor({state:'attached'});await nextStudent.locator('#planet-close').click();
    checks.push('잘못된 PIN 거부 후 학생 id·소속·규칙·잔액·가방·개인 안내 복원, 다른 맵 대화는 저장하되 비공개');
    await nextTeacher.locator('#teacher-tools').click();await nextTeacher.locator('#pin-target').selectOption(id);
    await nextTeacher.locator('#reset-pin').fill('8642');await nextTeacher.locator('#pin-save').click();
    await nextStudent.locator('#lobby').waitFor({state:'visible'});assert.equal(await nextTeacher.locator('#reset-pin').inputValue(),'');
    await studentJoin(nextStudent,code,'2468');await nextStudent.locator('#form-message').filter({hasText:'비밀번호가 맞지'}).waitFor({state:'attached'});
    await studentJoin(nextStudent,code,'8642');await nextStudent.locator('#lobby').waitFor({state:'hidden'});
    await nextStudent.locator('#self-shards').filter({hasText:balance}).waitFor({state:'attached'});checks.push('교사 비밀번호 변경·기존 접속 해제·새 비밀번호로 소유물 유지');
    await nextTeacher.locator('#teacher-close').click();mkdirSync('.local',{recursive:true});
    await nextStudent.screenshot({path:'.local/10-persistence-restored.png',fullPage:true});
    await openMenu(nextTeacher);await nextTeacher.getByRole('button',{name:'수업 마치기',exact:true}).click();await nextTeacher.locator('#confirm-leave').click();
    await nextStudent.locator('#lobby').waitFor({state:'visible'});await nextStudent.setViewportSize({width:390,height:844});
    assert.equal(await nextStudent.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await nextStudent.locator('#student-pin').scrollIntoViewIfNeeded();assert.ok(await nextStudent.locator('#student-pin').isVisible());
    await nextStudent.screenshot({path:'.local/11-persistence-entrance.png',fullPage:true});
    checks.push('390px 학생 입장 폼 가로 넘침 없이 PIN과 입장 버튼에 접근');
    assert.deepEqual(errors,[]);return {checks,errors};
  }catch(error){errors.push(error.message);throw error;}
  finally{
    mkdirSync('.local',{recursive:true});writeFileSync('.local/persistence-browser-report.json',JSON.stringify({checks,errors},null,2));
    for(const c of contexts)await c.close();if(game)await game.close();rmSync(dataDir,{recursive:true,force:true});
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  try{console.log(JSON.stringify(await verifyPersistence(browser),null,2));}finally{await browser.close();}
}
