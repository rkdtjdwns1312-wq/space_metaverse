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
  const names=['별이','달이','해이','별셋','별넷','별다섯','별여섯','별일곱'];
  const pins=names.map((_,i)=>String(1357+i));
  await fillNewClass(teacher,names,{pin:pins});await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
  code=[...game.store.rooms.keys()][0];
  for(const [name,pin] of names.map((name,i)=>[name,pins[i]])){
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
  assert.equal(await page.locator('#shop-buy-list [data-item-id="alien-queen-card"] .buy').count(),0);
  assert.equal(await page.locator('#shop-buy-list [data-item-id="nebula-card"] .buy').count(),0);
  await page.screenshot({path:'.local/208-lv4-shop.png'});check('상점 LV4 일곱 카드 그림 표시·직접 구매 차단');
  await use('nebula-card');assert.ok(await page.getByRole('heading',{name:'선생님 확인',exact:true}).isVisible());
  await page.setViewportSize({width:320,height:740});await page.screenshot({path:'.local/208-lv4-mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await page.locator('#lv4-item-dialog').evaluate(d=>{const r=d.getBoundingClientRect();return [...d.querySelectorAll('h2,p,button')].every(n=>{const x=n.getBoundingClientRect();return x.left>=r.left&&x.right<=r.right;});}),'좁은 화면에서도 카드 창의 글과 버튼이 잘리지 않아야 합니다');
  for(const [i,name] of ['달이','해이','별셋'].entries())await page.getByLabel(`${i+1}번째 친구`,{exact:true}).selectOption(player(name).id);
  await page.getByRole('button',{name:'성운 사용',exact:true}).click();await page.locator('#lv4-item-dialog').waitFor({state:'hidden'});
  assert.deepEqual(player('별이').cardMarkers.find(m=>m.itemId==='nebula-card')?.seatTargetIds,['달이','해이','별셋'].map(name=>player(name).id));check('모바일 효과 구분·성운 네 명 자리 변경 기록');
  await page.setViewportSize({width:1440,height:960});
  await use('solar-system-card');for(const [i,name] of names.slice(1).entries())await page.getByLabel(`${i+1}번째 친구`,{exact:true}).selectOption(player(name).id);
  await page.getByRole('button',{name:'태양계 사용',exact:true}).click();await page.locator('#lv4-item-dialog').waitFor({state:'hidden'});
  assert.deepEqual(player('별이').cardMarkers.find(m=>m.itemId==='solar-system-card')?.lunchOrderIds,names.slice(1).map(name=>player(name).id));
  assert.ok(names.slice(1).every(name=>player(name).inventory.find(item=>item.id==='asteroid-card')?.quantity===1));check('태양계 일곱 명 급식 순서·소행성 각 1개 지급');
  await use('total-eclipse-card');await page.getByRole('button',{name:'개기 일식 사용',exact:true}).click();await page.locator('#lv4-item-dialog').waitFor({state:'hidden'});
  assert.ok(names.every(name=>player(name).cardMarkers.some(m=>m.itemId==='total-eclipse-card'&&m.until>Date.now())));check('개기 일식 전체 학생·7일 사용료 적용');
  await use('supercluster-card');await page.getByLabel('첫 번째 금별 카드',{exact:true}).selectOption('polaris');await page.getByLabel('두 번째 금별 카드',{exact:true}).selectOption('polaris');
  await page.getByRole('button',{name:'초은하단 사용',exact:true}).click();await page.locator('#lv4-item-dialog').waitFor({state:'hidden'});assert.equal(player('별이').inventory.find(i=>i.id==='gold-polaris-card').quantity,2);check('초은하단 선택한 별 카드 2장 지급');
  await close();game.store.transact(()=>{player('별이').lv4State.stacks=3;});publish();
  await page.locator('#dock-inventory').click();if(!await page.locator('#bag-detail .holding-use').isVisible())await page.locator('[data-item-id="supercluster-card"] .slot-btn').click();
  await page.locator('#bag-detail .holding-use').click();await page.locator('.holding-dialog').waitFor({state:'visible'});
  await page.getByText('은하수의 기운: 3',{exact:true}).waitFor();const beforeHolding=player('별이').starShards;
  await page.setViewportSize({width:320,height:740});await page.screenshot({path:'.local/209-holding-mobile.png'});
  assert.ok(await page.locator('.holding-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth));
  await page.locator('.holding-dialog').getByRole('button',{name:'보유능력 사용하기',exact:true}).click();await page.locator('.holding-dialog').waitFor({state:'hidden'});
  assert.equal(player('별이').lv4State.stacks,2);assert.equal(player('별이').starShards,beforeHolding+4);
  await page.locator('#bag-detail .holding-use').getByText('(이번주 사용)',{exact:true}).waitFor();
  await close();await page.reload();await page.locator('#lobby').waitFor({state:'hidden'});assert.equal(player('별이').lv4State.stacks,2);assert.equal(player('별이').starShards,beforeHolding+4);check('보유효과 주간 사용·원본 유지·재접속·320px');
  await page.setViewportSize({width:1440,height:960});
  await use('betelgeuse-card');await page.getByRole('button',{name:'탐사권 3장 받기',exact:true}).click();await page.locator('#lv4-item-dialog').waitFor({state:'hidden'});
  assert.equal(player('별이').inventory.find(item=>item.id==='exploration-ticket')?.quantity,3);
  assert.equal(player('별이').lv4State.betelgeuseDay,new Date(Date.now()+9*3600000).toISOString().slice(0,10));check('베텔기우스 탐사권 3장·당일 우선권 시작');
  await teacherTools();
  await use('alien-queen-card');await page.getByRole('button',{name:'면제 효과 사용',exact:true}).click();await page.locator('#lv4-item-dialog').waitFor({state:'hidden'});await teacherTools();
  await teacher.getByLabel('에일리언 퀸 보유자',{exact:true}).selectOption(player('별이').id);await teacher.getByLabel('제출 확인 기록',{exact:true}).fill('테스트 일기 제출');const beforeQueen=player('별이').starShards;
  await teacher.getByRole('button',{name:'작성 확인 · 별 파편 1개 지급',exact:true}).click();await teacher.getByLabel('제출 확인 기록',{exact:true}).filter({hasText:''}).waitFor();
  await teacher.waitForFunction(()=>document.getElementById('toast').textContent.includes('지급'));
  assert.equal(player('별이').starShards,beforeQueen+1);
  const queen=teacher.locator('.lv4-teacher-row').filter({has:teacher.getByRole('heading',{name:'별이 · 에일리언 퀸',exact:true})});await queen.getByRole('button',{name:'실제 처리 확인 후 효과 종료',exact:true}).click();await queen.waitFor({state:'detached'});check('에일리언 퀸 보유자 일기 보상·면제 종료');
  const nebula=teacher.locator('.lv4-teacher-row').filter({has:teacher.getByRole('heading',{name:'별이 · 성운',exact:true})});
  await nebula.getByLabel('네 명이 완전히 떨어진 자리가 아님을 확인',{exact:true}).check();await nebula.getByLabel('실제 자리 변경 확인 기록',{exact:true}).fill('테스트 자리 확인');
  await nebula.getByRole('button',{name:'실제 자리 변경 확인',exact:true}).click();await nebula.getByText('교사 확인 완료',{exact:false}).waitFor();
  assert.equal(player('별이').cardMarkers.find(m=>m.itemId==='nebula-card')?.seatingConfirmed,true);check('성운 네 명의 비분리 자리 배치 교사 확인');
  const solar=teacher.locator('.lv4-teacher-row').filter({has:teacher.getByRole('heading',{name:'별이 · 태양계',exact:true})});
  await solar.getByLabel('실제 급식 순서 변경 확인 기록',{exact:true}).fill('테스트 급식 확인');await solar.getByRole('button',{name:'실제 급식 순서 확인',exact:true}).click();
  await solar.getByText('교사 확인 완료',{exact:false}).waitFor();assert.equal(player('별이').cardMarkers.find(m=>m.itemId==='solar-system-card')?.lunchOrderConfirmed,true);check('태양계 영구 급식 순서 교사 확인');
  await close(teacher);await close();await page.reload();await page.locator('#lobby').waitFor({state:'hidden'});assert.ok(player('별이').cardMarkers.some(m=>m.itemId==='nebula-card'));assert.equal(player('별이').lv4State.receipts.length,3);check('재접속 후 효과와 교사 확인 기록 유지');
  const machine=STREET.objects.find(o=>o.kind==='crafting');setup({mapId:STREET_ID,x:machine.x,y:machine.y+55,inventory:structuredClone(recipe.ingredients),starShards:10});
  await page.locator('#interact-prompt').filter({hasText:'별빛 조합기'}).waitFor();await page.locator('#world').focus();await page.keyboard.press('f');
  await page.locator('#crafting-bag [data-item-id="space-station-card"]').click();await page.locator('#crafting-bag [data-item-id="space-station-card"]').click();await page.locator('#crafting-submit').click();await page.locator('#crafting-note').filter({hasText:'조합 성공'}).waitFor();assert.equal(player('별이').starShards,9);assert.equal(player('별이').inventory[0].id,'nebula-card');
  for(const path of ['/data/crafting-recipes.json','/server/lv4-item-effects.js'])assert.equal((await page.request.get(url+path)).status(),404);check('LV4 가상 조합·수수료1·비밀 경로 차단');
  assert.deepEqual(errors,[]);await writeFile('.local/208-lv4-browser.json',JSON.stringify({checks,errors},null,2));
}catch(error){await page?.screenshot({path:'.local/208-lv4-failure.png'}).catch(()=>{});throw error;}
finally{await browser?.close();await game?.close();assert.ok(resolve(dir).startsWith(resolve(join(tmpdir(),'lv4-browser-'))));await rm(dir,{recursive:true,force:true});}
