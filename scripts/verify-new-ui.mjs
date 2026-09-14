import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createClassroomServer} from '../server/app.js';
import {MAP,GARDEN_ID,STREET_ID,PLAZA_ID} from '../shared/config.js';
const key='new-interface-browser-test-private',dir=await mkdtemp(join(tmpdir(),'space-new-ui-'));
const game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false}),address=await game.listen();
const url='http://127.0.0.1:'+address.port,browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const checks=[],errors=[];await mkdir('.local',{recursive:true});
const check=text=>{checks.push(text);console.log('New UI '+checks.length+': '+text);};
async function page(){const context=await browser.newContext({viewport:{width:1440,height:960}});context.setDefaultTimeout(8000);const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));return p;}
async function close(p){for(let i=0;i<12&&await p.locator('dialog[open]').count();i++)await p.keyboard.press('Escape');}
async function dock(p,id){await close(p);await p.locator('#dock-'+id).click();}
async function chat(p){await dock(p,'chat');await p.locator('#open-chat').click();}
try{
  const teacher=await page(),one=await page(),two=await page();
  await teacher.goto(url,{waitUntil:'domcontentloaded',timeout:20000});await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);await teacher.locator('#allowed-names').fill('별이, 달이');await teacher.locator('#teacher-form .submit').click();
  await teacher.locator('#credentials-dialog').waitFor({state:'visible'});
  const credentials=(await teacher.locator('#credentials-text').inputValue()).split('\n').map(x=>x.split('\t'));
  const room=[...game.store.rooms.values()][0],code=room.code;assert.equal(credentials.length,2);check('교사가 계정을 만들고 배부용 초기 비밀번호를 받음');
  await close(teacher);
  for(const [p,index] of [[one,0],[two,1]]){
    await p.goto(url+'/?class='+code);await p.waitForFunction(()=>document.getElementById('join-code').hidden);
    assert.equal(await p.locator('#student-form input:visible').count(),2);
    await p.locator('#nickname').fill(credentials[index][0]);await p.locator('#student-pin').fill(credentials[index][1]);await p.locator('#student-form .submit').click();
    await p.locator('#password-offer-dialog').waitFor({state:'visible'});
    if(index===1)await p.locator('#password-offer-no').click();
  }
  await one.locator('#password-offer-yes').click();await one.locator('#password-current').fill(credentials[0][1]);
  const fresh=credentials[0][1]==='6789'?'7890':'6789';await one.locator('#password-new').fill(fresh);await one.locator('#password-confirm').fill(fresh);await one.locator('#password-save').click();
  await one.locator('#password-dialog').waitFor({state:'hidden'});check('학생은 두 칸으로 로그인하고 본인 비밀번호를 변경함');
  const box=await one.locator('#world').boundingBox();assert.deepEqual([box.x,box.y,box.width,box.height],[0,0,1440,960]);
  assert.equal(await one.locator('dialog[open]').count(),0);await one.screenshot({path:'.local/new-full-map.png'});check('기본 화면은 전체 맵과 하단 아이콘');
  await dock(one,'avatar');await one.locator('#skills-panel').waitFor({state:'visible'});check('첫 아이콘에서 내 정보와 스킬 확인');
  const p1=[...room.players.values()].find(p=>p.nickname==='별이'),p2=[...room.players.values()].find(p=>p.nickname==='달이');
  await dock(one,'chat');await one.locator('#crew-button').click();await one.locator('.friend-select[data-player-id="'+p2.id+'"]').click();await one.locator('#friend-whisper').click();
  await one.locator('#chat-input').fill('둘만의 인사');await one.locator('#chat-send').click();
  await chat(two);await two.locator('#chat-channel').selectOption('direct');await two.locator('#chat-recipient').selectOption(p1.id);await two.locator('#chat-log').filter({hasText:'둘만의 인사'}).waitFor();check('접속 친구 선택 후 실제 1:1 대화');
  await dock(one,'chat');await one.locator('#crew-button').click();await one.locator('.friend-select[data-player-id="'+p2.id+'"]').click();await one.locator('#friend-summon').click();
  await two.locator('#summon-no').click();await dock(one,'chat');await one.locator('#crew-button').click();await one.locator('.friend-select[data-player-id="'+p2.id+'"]').click();
  assert.ok(await one.locator('#friend-summon').isDisabled());await one.locator('#friend-note').filter({hasText:'24시간'}).waitFor();check('호출 거절과 24시간 재요청 제한 표시');
  // 자산 준비만 fixture로 합니다. 선택·정보·레벨 거부·폐기는 실제 UI로 검증합니다.
  game.store.transact(()=>{p1.inventory=[{id:'rainbow-tail',quantity:1},{id:'star-sticker',quantity:2}];});
  await dock(teacher,'menu');await teacher.locator('#teacher-tools').click();await teacher.locator('#shards-give').click();
  await dock(one,'inventory');await one.locator('[data-item-id="rainbow-tail"] .slot-btn').click();await one.locator('.item-info').click();await one.locator('#item-info-text').filter({hasText:'무지개 꼬리'}).waitFor();await one.keyboard.press('Escape');
  await one.locator('#bag-detail .use').click();await one.locator('#toast').filter({hasText:'캐릭터의 lv보다 높은 아이템'}).waitFor();assert.equal(p1.inventory[0].quantity,1);
  await one.locator('.item-discard').click();await one.locator('#discard-no').click();assert.equal(p1.inventory[0].quantity,1);
  await one.locator('.item-discard').click();await one.locator('#discard-yes').click();await one.waitForFunction(()=>!document.querySelector('#bag-list [data-item-id="rainbow-tail"]'));check('아이템 효과·레벨 안내·폐기 아니오/예');
  await one.locator('[data-item-id="star-sticker"] .slot-btn').click();await one.locator('#bag-detail .use').click();await one.locator('#use-confirm').click();await two.locator('#toast').filter({hasText:'별이 친구가'}).waitFor();check('일반 아이템 사용자가 광장에 표시됨');
  for(const to of [GARDEN_ID,STREET_ID]){
    await close(one);const gate=MAP.objects.find(o=>o.target===to);p1.mapId=PLAZA_ID;p1.x=gate.x;p1.y=gate.y;
    await teacher.locator('#shards-give').click();await one.locator('#interact-prompt').waitFor({state:'visible'});await one.locator('#interact-prompt').click();
    await one.waitForFunction(id=>document.getElementById('map-caption').textContent.includes(id),to===GARDEN_ID?'달구름':'별빛');assert.equal(p1.mapId,to);
  }
  check('중앙광장 왼쪽 정원과 오른쪽 별빛 거리 이동');
  await close(one);await one.setViewportSize({width:390,height:844});assert.ok(await one.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await one.screenshot({path:'.local/new-mobile-map.png'});check('작은 화면에서 맵·하단 메뉴 가로 넘침 없음');
  await dock(teacher,'menu');await teacher.locator('#teacher-tools').click();await teacher.locator('#account-target').selectOption(p2.id);
  await teacher.locator('#account-name').fill('달솔');await teacher.locator('#account-pin').fill('4321');await teacher.locator('#account-save').click();
  await two.locator('#lobby').waitFor({state:'visible'});await two.locator('#nickname').fill('달솔');await two.locator('#student-pin').fill('4321');await two.locator('#student-form .submit').click();
  await two.locator('#password-offer-no').click();assert.equal([...room.players.values()].find(p=>p.nickname==='달솔').id,p2.id);check('교사가 이름·비밀번호를 수정하고 학생이 같은 자산 계정으로 재입장');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors},null,2));
  await writeFile('.local/new-ui-result.json',JSON.stringify({checks,errors},null,2));
}catch(e){await writeFile('.local/new-ui-failure.txt',e.stack+'\n'+JSON.stringify(errors));for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:'.local/new-ui-fail-'+browser.contexts().indexOf(c)+'.png',timeout:3000}).catch(()=>{});throw e;}
finally{await browser.close();await game.close();await rm(dir,{recursive:true,force:true});}
