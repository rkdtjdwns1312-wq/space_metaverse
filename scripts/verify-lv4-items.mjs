import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {STREET,STREET_ID} from '../shared/config.js';

// 실제 수업 레시피는 읽지 않습니다. 테스트 서버만의 가상 조합입니다.
const recipe={ingredients:[{id:'space-station-card',quantity:2}],output:{id:'nebula-card'}};
const key='isolated-lv4-browser-key',dir=await mkdtemp(join(tmpdir(),'lv4-browser-'));
let game,browser,page,teacher,code;const checks=[],errors=[];
const room=()=>game.store.rooms.get(code);
const player=name=>[...room().players.values()].find(p=>p.nickname===name);
const check=text=>{checks.push(text);console.log(`LV4 ${checks.length}: ${text}`);};
const publish=()=>{for(const p of room().players.values())if(p.connected)game.io.to(p.socketId).emit('room:state',game.store.snapshot(room(),p));};
function setup(values){game.store.transact(()=>Object.assign(player('별이'),values));publish();}
async function close(p=page){for(let i=0;i<10&&await p.locator('dialog[open]').count();i++)await p.keyboard.press('Escape');}
async function use(id){await close();setup({inventory:[{id,quantity:2}],lastItemUseAt:0});await page.locator('#dock-inventory').click();await page.locator(`[data-item-id="${id}"] .slot-btn`).click();await page.locator('#bag-detail .use').click();await page.locator('#lv4-item-dialog').waitFor({state:'visible'});}
async function teacherTools(){await close(teacher);await teacher.locator('#dock-menu').click();await teacher.locator('#lv4-teacher-tools').click();await teacher.locator('#lv4-item-dialog').waitFor({state:'visible'});}
try{
  await mkdir('.local',{recursive:true});
  game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false,craftingRecipes:[recipe]});
  const url=`http://127.0.0.1:${(await game.listen()).port}`;
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  teacher=await browser.newPage({viewport:{width:1440,height:960}});teacher.setDefaultTimeout(10000);teacher.on('pageerror',e=>errors.push(e.message));
  await teacher.goto(url);await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);
  await fillNewClass(teacher,['별이','달이'],{pin:['1357','2468']});await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
  code=[...game.store.rooms.keys()][0];
  for(const [name,pin] of [['별이','1357'],['달이','2468']]){
    const p=await browser.newPage({viewport:{width:1440,height:960}});p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));
    await p.goto(`${url}/?class=${code}`);await p.locator('#nickname').fill(name);await p.locator('#student-pin').fill(pin);await p.locator('#student-form .submit').click();await p.locator('#password-offer-no').click();await p.locator('#lobby').waitFor({state:'hidden'});
    if(name==='별이')page=p;
  }
  game.store.transact(()=>{for(const p of room().players.values())if(p.role==='student'){p.avatar.level=4;p.avatar.constellationId='aries';p.starShards=20;}});
  const shop=STREET.objects.find(o=>o.kind==='shop');
  setup({mapId:STREET_ID,x:shop.x,y:shop.y+shop.radius+12,starShards:1000,inventory:[]});
  await page.locator('#world').focus();await page.keyboard.press('f');await page.locator('#shop-dialog').waitFor({state:'visible'});await page.locator('[data-shop-level="4"]').click();
  assert.equal(await page.locator('#shop-buy-list li.item').count(),7);
  assert.ok(await page.locator('#shop-buy-list img.item-art').evaluateAll(async imgs=>{for(const i of imgs)i.loading='eager';await Promise.all(imgs.map(i=>i.decode()));return imgs.every(i=>i.naturalWidth>0);}));
  assert.ok(await page.locator('[data-item-id="alien-queen-card"] .buy').isDisabled());
  await page.screenshot({path:'.local/208-lv4-shop.png'});check('상점 LV4 일곱 카드 그림 표시·미정 가격 차단');
  await page.locator('#shop-buy-list [data-item-id="nebula-card"] .buy').click();await page.waitForFunction(()=>document.querySelector('#shop-shards').textContent.includes('917'));
  assert.equal(player('별이').inventory[0].id,'nebula-card');
  await page.locator('#shop-tab-sell').click();await page.locator('#shop-sell-list [data-item-id="nebula-card"] .sell').click();await page.waitForFunction(()=>document.querySelector('#shop-shards').textContent.includes('954'));check('LV4 구매·되팔기 가격 적용');
  await use('nebula-card');assert.ok(await page.getByRole('heading',{name:'선생님 확인',exact:true}).isVisible());
  await page.setViewportSize({width:320,height:740});await page.screenshot({path:'.local/208-lv4-mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await page.locator('#lv4-item-dialog').evaluate(d=>{const r=d.getBoundingClientRect();return [...d.querySelectorAll('h2,p,button')].every(n=>{const x=n.getBoundingClientRect();return x.left>=r.left&&x.right<=r.right;});}),'좁은 화면에서도 카드 창의 글과 버튼이 잘리지 않아야 합니다');
  await page.getByRole('button',{name:'성운 사용',exact:true}).click();await page.locator('#lv4-item-dialog').waitFor({state:'hidden'});assert.ok(player('별이').cardMarkers.some(m=>m.itemId==='nebula-card'));check('모바일 효과 구분·성운 사용 기록');
  await page.setViewportSize({width:1440,height:960});
  await use('total-eclipse-card');await page.locator(`input[name="lv4-target"][value="${player('달이').id}"]`).check();await page.getByRole('button',{name:'개기 일식 사용',exact:true}).click();await page.locator('#lv4-item-dialog').waitFor({state:'hidden'});
  assert.ok(player('달이').cardMarkers.some(m=>m.itemId==='total-eclipse-card'&&m.until>Date.now()));check('개기 일식 학생 선택·7일 금지 적용');
  await use('supercluster-card');await page.getByLabel('첫 번째 금별 카드',{exact:true}).selectOption('polaris');await page.getByLabel('두 번째 금별 카드',{exact:true}).selectOption('polaris');
  await page.getByRole('button',{name:'초은하단 사용',exact:true}).click();await page.locator('#lv4-item-dialog').waitFor({state:'hidden'});assert.equal(player('별이').inventory.find(i=>i.id==='gold-polaris-card').quantity,2);check('초은하단 선택한 별 카드 2장 지급');
  await close();game.store.transact(()=>{player('별이').lv4State.stacks=3;});publish();
  await page.locator('#dock-inventory').click();if(!await page.locator('#bag-detail .holding-use').isVisible())await page.locator('[data-item-id="supercluster-card"] .slot-btn').click();await page.locator('#bag-detail .holding-use').click();
  await page.getByText('보유 스택: 3개',{exact:true}).waitFor();const beforeHolding=player('별이').starShards;
  await page.setViewportSize({width:320,height:740});await page.screenshot({path:'.local/209-holding-mobile.png'});
  assert.ok(await page.locator('#lv4-item-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth));
  await page.getByRole('button',{name:'1스택 → 별 파편 4개',exact:true}).click();await page.getByText('보유 스택: 2개',{exact:true}).waitFor();assert.equal(player('별이').starShards,beforeHolding+4);
  await page.getByRole('button',{name:'2스택 → 별 카드 1장',exact:true}).click();await page.getByText('보유 스택: 0개',{exact:true}).waitFor();
  assert.equal(player('별이').inventory.find(i=>i.id==='supercluster-card').quantity,1);assert.equal(player('별이').inventory.find(i=>i.id==='star-card').quantity,1);
  assert.ok(await page.getByRole('button',{name:'1스택 → 별 파편 4개',exact:true}).isDisabled());assert.ok(await page.getByRole('button',{name:'2스택 → 별 카드 1장',exact:true}).isDisabled());
  await close();await page.reload();await page.locator('#lobby').waitFor({state:'hidden'});assert.equal(player('별이').lv4State.stacks,0);assert.equal(player('별이').starShards,beforeHolding+4);check('보유효과 버튼·두 스택교환·원본 유지·부족 차단·재접속·320px');
  await page.setViewportSize({width:1440,height:960});
  await use('betelgeuse-card');await page.getByRole('button',{name:'탐험 기회 3회 받기',exact:true}).click();await page.locator('#lv4-item-dialog').waitFor({state:'hidden'});
  await teacherTools();const exploration=teacher.locator('.lv4-teacher-row').filter({has:teacher.getByRole('heading',{name:'별이 · 베텔기우스',exact:true})});
  await exploration.getByLabel('확인한 탐험 걸음 수',{exact:true}).fill('2');await exploration.getByLabel('실제 탐험 활동 확인 기록',{exact:true}).fill('테스트 탐험 1');await exploration.getByRole('button',{name:'탐험 확인 · 3회 중 1회 처리',exact:true}).click();
  await exploration.getByText('탐험 남음 2회',{exact:false}).waitFor();assert.equal(player('별이').cardMarkers.find(m=>m.itemId==='betelgeuse-card').remainingUses,2);check('교사 탐험 확인·잔여 횟수와 기간 저장');
  await exploration.getByRole('button',{name:'효과 종료',exact:true}).click();await exploration.waitFor({state:'detached'});assert.ok(!player('별이').cardMarkers.some(m=>m.itemId==='betelgeuse-card'));check('교사가 LV4 효과 종료');
  await use('alien-queen-card');await page.getByRole('button',{name:'면제 효과 사용',exact:true}).click();await page.locator('#lv4-item-dialog').waitFor({state:'hidden'});await teacherTools();
  await teacher.getByLabel('에일리언 퀸 보유자',{exact:true}).selectOption(player('별이').id);await teacher.getByLabel('제출 확인 기록',{exact:true}).fill('테스트 일기 제출');const beforeQueen=player('별이').starShards;
  await teacher.getByRole('button',{name:'작성 확인 · 별 파편 1개 지급',exact:true}).click();await teacher.getByLabel('제출 확인 기록',{exact:true}).filter({hasText:''}).waitFor();
  await teacher.waitForFunction(()=>document.getElementById('toast').textContent.includes('지급'));
  assert.equal(player('별이').starShards,beforeQueen+1);
  const queen=teacher.locator('.lv4-teacher-row').filter({has:teacher.getByRole('heading',{name:'별이 · 에일리언 퀸',exact:true})});await queen.getByRole('button',{name:'실제 처리 확인 후 효과 종료',exact:true}).click();await queen.waitFor({state:'detached'});check('에일리언 퀸 보유자 일기 보상·면제 종료');
  const nebula=teacher.locator('.lv4-teacher-row').filter({has:teacher.getByRole('heading',{name:'별이 · 성운',exact:true})});await nebula.getByLabel('침입 학생',{exact:true}).selectOption(player('달이').id);await nebula.getByLabel('실제 침입 확인 기록',{exact:true}).fill('테스트 침입 확인');
  const balances=[player('별이').starShards,player('달이').starShards];await nebula.getByRole('button',{name:'실제 침입 확인 후 별 파편 징수',exact:true}).click();await teacher.waitForFunction(()=>document.getElementById('toast').textContent.includes('옮겼'));
  assert.deepEqual([player('별이').starShards,player('달이').starShards],[balances[0]+1,balances[1]-1]);check('성운 실제 활동 확인 후 별 파편 이전');
  await close(teacher);await close();await page.reload();await page.locator('#lobby').waitFor({state:'hidden'});assert.ok(player('별이').cardMarkers.some(m=>m.itemId==='nebula-card'));assert.equal(player('별이').lv4State.receipts.length,3);check('재접속 후 효과와 교사 확인 기록 유지');
  const machine=STREET.objects.find(o=>o.kind==='crafting');setup({mapId:STREET_ID,x:machine.x,y:machine.y+55,inventory:structuredClone(recipe.ingredients),starShards:10});
  await page.locator('#interact-prompt').filter({hasText:'별빛 조합기'}).waitFor();await page.locator('#world').focus();await page.keyboard.press('f');
  await page.locator('#crafting-bag [data-item-id="space-station-card"]').click();await page.locator('#crafting-bag [data-item-id="space-station-card"]').click();await page.locator('#crafting-submit').click();await page.locator('#crafting-note').filter({hasText:'조합 성공'}).waitFor();assert.equal(player('별이').starShards,9);assert.equal(player('별이').inventory[0].id,'nebula-card');
  for(const path of ['/data/crafting-recipes.json','/server/lv4-item-effects.js'])assert.equal((await page.request.get(url+path)).status(),404);check('LV4 가상 조합·수수료1·비밀 경로 차단');
  assert.deepEqual(errors,[]);await writeFile('.local/208-lv4-browser.json',JSON.stringify({checks,errors},null,2));
}catch(error){await page?.screenshot({path:'.local/208-lv4-failure.png'}).catch(()=>{});throw error;}
finally{await browser?.close();await game?.close();assert.ok(resolve(dir).startsWith(resolve(join(tmpdir(),'lv4-browser-'))));await rm(dir,{recursive:true,force:true});}
