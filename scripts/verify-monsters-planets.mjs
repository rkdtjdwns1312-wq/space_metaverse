// 임시 서버/계정에서 몬스터와 행성 메뉴를 실제 키보드·터치로 검증합니다.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fillNewClass} from './class-setup.mjs';
import {createClassroomServer} from '../server/app.js';
import {monstersOf} from '../server/monsters.js';
import {MONSTER_TYPES} from '../shared/monsters.js';
import {addPlanet} from '../server/world.js';
import {PLAZA_ID,PLANET_COLORS} from '../shared/config.js';
const key='monster-ui-test-only-private',game=createClassroomServer({teacherKey:key,studentHours:false}),address=await game.listen();
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),checks=[],errors=[];
const check=text=>{checks.push(text);console.log(text);};await mkdir('.local',{recursive:true});
try{
  const teacher=await browser.newPage();await teacher.goto('http://127.0.0.1:'+address.port,{waitUntil:'domcontentloaded',timeout:25000});
  await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);await fillNewClass(teacher,['1']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0],page=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+address.port,{waitUntil:'domcontentloaded',timeout:25000});await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill('1');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  const p=[...room.players.values()].find(p=>p.role==='student'),publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
  for(const mapId of ['star-origin-1','star-origin-2','star-origin-3']){
    Object.assign(p,{mapId,x:600,y:450});publish();await page.waitForFunction(()=>document.getElementById('world').dataset.monsterCount==='5');
    await page.locator('#minimap-title').filter({hasText:mapId.replace('star-origin-','별의 시작점 ')}).waitFor();
    await page.screenshot({path:'.local/'+mapId+'-monsters.png'});
  }
  check('별의 시작점1·2·3에 각각5마리 표시·다른 맵과 분리');
  Object.assign(p,{mapId:'star-origin-1',x:600,y:450});publish();await page.locator('#world').focus();
  const movingSamples=page.evaluate(()=>new Promise(resolve=>{
    const samples=[],started=performance.now();
    function sample(){const canvas=document.getElementById('world');samples.push({avatar:+canvas.dataset.selfRenderX,monsterX:+canvas.dataset.monsterRenderX,monsterY:+canvas.dataset.monsterRenderY});
      if(performance.now()-started>=800)resolve(samples);else requestAnimationFrame(sample);}
    sample();
  }));
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(700);await page.keyboard.up('ArrowRight');
  const samples=await movingSamples;
  assert.ok(Math.max(...samples.map(sample=>sample.avatar))-Math.min(...samples.map(sample=>sample.avatar))>100);
  assert.ok(samples.some((sample,index)=>index>0&&Math.hypot(sample.monsterX-samples[0].monsterX,sample.monsterY-samples[0].monsterY)>1));
  check('아바타가 움직이는 동안 몬스터의 화면상 월드 좌표도 계속 갱신');
  const m=monstersOf(room).get('rabbit');Object.assign(p,{mapId:m.mapId,x:m.x+35,y:m.y});publish();
  await page.locator('#world').focus();await page.keyboard.press('e');assert.equal(await page.locator('#monster-dialog').count(),0);
  assert.ok(!(await page.locator('#interact-object').textContent()).includes('토끼자리'));check('몬스터 E 상호작용·정보 메뉴 제거');
  for(const [level,max] of [[1,1],[2,10],[3,20],[4,30],[5,40]]){p.avatar.level=level;publish();await page.locator('.vitals-hp .vitals-label').filter({hasText:`HP ${max}/${max}`}).waitFor();assert.equal(await page.locator('.vitals-mp progress').getAttribute('max'),String(max));}
  check('LV1~4 HP/MP 1·10·20·30 및 초월체40 서버 수치 표시');
  Object.assign(p.avatar,{level:4,constellationId:'leo',form:'constellation'});
  Object.assign(m,{dx:0,dy:0,nextDirectionAt:Date.now()+60000});Object.assign(p,{x:m.x-62,y:m.y,facing:{x:1,y:0}});publish();
  await page.locator('#world').focus();await page.keyboard.press('q');await page.waitForFunction(()=>document.getElementById('world').dataset.monsterHp==='17');
  await page.keyboard.press('w');await page.waitForFunction(()=>document.getElementById('world').dataset.lastSkillDx==='1');assert.equal(m.hp,17);check('Q 직접 타격 HP20→17·W 같은 방향 표시와 HP 무소비');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await page.locator('#touch-attack').tap();await page.waitForFunction(()=>document.getElementById('world').dataset.monsterHp==='14');
  await page.locator('#touch-skill').tap();assert.equal(m.hp,14);
  const hud=await page.locator('#vitals-hud').boundingBox(),dock=await page.locator('#bottom-dock').boundingBox(),hp=await page.locator('.vitals-hp').boundingBox(),mp=await page.locator('.vitals-mp').boundingBox();
  assert.ok(hud.y+hud.height<dock.y&&Math.abs(hp.y-mp.y)<1&&hud.width===200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'.local/monster-mobile.png'});check('390px 터치 공격/스킬·아이콘 위 일렬 HP/MP·가로 넘침 없음');
  for(let i=0;i<5;i++){await page.waitForTimeout(500);await page.locator('#touch-attack').tap();}
  await page.waitForFunction(()=>document.getElementById('world').dataset.monsterCount==='4');assert.equal(m.hp,0);assert.equal(p.avatar.xp,0);check('체력0 처치·화면에서 사라짐·미정 보상 없음');
  const lion=monstersOf(room).get('lion');Object.assign(lion,{dx:0,dy:0,nextDirectionAt:Date.now()+60000});
  p.avatar.level=5;Object.assign(p,{mapId:lion.mapId,x:lion.x-62,y:lion.y,facing:{x:1,y:0}});publish();
  await page.locator('.vitals-hp .vitals-label').filter({hasText:'HP 40/40'}).waitFor();await page.waitForTimeout(500);
  await page.locator('#world').focus();await page.keyboard.press('q');await page.waitForFunction(()=>document.getElementById('world').dataset.monsterHp==='36');
  await page.waitForTimeout(500);await page.locator('#touch-attack').tap();await page.waitForFunction(()=>document.getElementById('world').dataset.monsterHp==='32');
  assert.equal(lion.hp,32);assert.equal(await page.locator('.vitals-mp .vitals-label').textContent(),'MP 40/40');check('초월체 Q·터치 모두 공격력4: 몬스터40→36→32·최대 HP/MP40·MP40 유지');
  const planet=addPlanet(room,{name:'체육행성',description:'친구들과 건강하게 놀아요.',templateId:'sports',x:700,y:400,color:PLANET_COLORS[0],rules:['서로 응원해요.']});
  p.avatar.departmentId=planet.id;Object.assign(p,{mapId:PLAZA_ID,x:planet.x+70,y:planet.y});publish();
  await page.locator('#interact-object').filter({hasText:'체육행성'}).waitFor();await page.locator('#touch-interact').tap();await page.locator('#planet-dialog').waitFor({state:'visible'});
  const selectors=['#planet-title','.planet-description-heading','#planet-member-count','#planet-members','#planet-rules-toggle','#planet-warnings','#planet-rename','#planet-work'];
  const boxes=await Promise.all(selectors.map(selector=>page.locator(selector).boundingBox()));for(let i=1;i<boxes.length;i++)assert.ok(boxes[i].y>=boxes[i-1].y+boxes[i-1].height-1);
  await page.locator('#planet-rules-toggle').tap();await page.locator('#planet-rules-list').filter({hasText:'서로 응원'}).waitFor();await page.locator('#planet-warnings summary').tap();await page.locator('#planet-warnings p').filter({hasText:'경고 돌덩이'}).waitFor();
  await page.screenshot({path:'.local/planet-menu-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#planet-close').tap();
  check('행성 이름→설명→친구명단→규칙→경고/검은별→이름바꾸기 세로순서·규칙·경고 돌덩이 안내·닫기');
  Object.assign(p,{mapId:PLAZA_ID,x:300,y:1100});publish();await page.waitForFunction(()=>document.getElementById('world').dataset.monsterCount==='0');
  check('광장에서는 몬스터 표시 없음');
  assert.equal(MONSTER_TYPES.length,15);assert.deepEqual(errors,[]);
}finally{await writeFile('.local/monsters-planets-result.json',JSON.stringify({checks,errors},null,2));await browser.close();await game.close();}
console.log(JSON.stringify({checks:checks.length,errors}));
