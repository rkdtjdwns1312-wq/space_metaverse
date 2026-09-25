import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {MARKET} from '../shared/market.js';
import {VALLEY,VALLEY_ID,PLAZA_ID} from '../shared/config.js';
import {CONSTELLATIONS} from '../shared/constellations.js';
// 실제 학급 파일 대신 메모리 교실에서 서로 다른 브라우저의 교환을 검증합니다.
const game=createClassroomServer({teacherKey:'market-browser-test-key',studentHours:false});
const url=`http://127.0.0.1:${(await game.listen()).port}`;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[],checks=[],check=s=>{checks.push(s);console.log(s);};
await mkdir('.local',{recursive:true});
try{
  const teacher=await browser.newPage({viewport:{width:1440,height:1000}});
  const a=await browser.newPage({viewport:{width:1440,height:1000}}),b=await browser.newPage({viewport:{width:1440,height:1000}});
  for(const page of [teacher,a,b]){page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));}
  await teacher.goto(url);await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill('market-browser-test-key');
  await fillNewClass(teacher,['1','2']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0];
  for(const [page,name] of [[a,'1'],[b,'2']]){await page.goto(url);await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill(name);await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});}
  const p=[...room.players.values()].find(v=>v.nickname==='1'),q=[...room.players.values()].find(v=>v.nickname==='2'),t=[...room.players.values()].find(v=>v.role==='teacher');
  const publish=()=>{for(const v of room.players.values())game.io.to(v.socketId).emit('room:state',game.store.snapshot(room,v));};
  const close=async page=>{for(let i=0;i<5&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');};
  const interact=async(page,label)=>{await close(page);await page.locator('#interact-object').filter({hasText:label}).waitFor();await page.locator('#interact-prompt').click();};
  p.starShards=q.starShards=30;p.cosmicEnergy=q.cosmicEnergy=20;
  p.inventory=[{id:'space-food-card',quantity:3}];q.inventory=[{id:'moon-rabbit-card',quantity:2}];
  // Both parties must be inside; the location prompt must not appear just outside the circle.
  for(const v of [p,q,t])Object.assign(v,{mapId:PLAZA_ID,x:MARKET.x,y:MARKET.y,input:{x:0,y:0,at:0}});
  p.x=MARKET.x+MARKET.radius+10;publish();await a.waitForTimeout(150);assert.ok(!(await a.locator('#interact-object').textContent()).includes('거래걸기'));
  p.x=MARKET.x;publish();await interact(a,'거래걸기');await a.locator('#market-target').selectOption(q.id);await a.locator('#market-request').click();await b.locator('#market-incoming-accept').click();
  await a.locator('#market-inventory [data-item-id="space-food-card"]').click();
  await a.locator('#market-shards').fill('4');await a.locator('#market-energy').fill('3');assert.ok(await a.locator('#market-confirm').isDisabled());await a.locator('#market-apply').click();
  await b.locator('#market-other-offer').filter({hasText:'우주 식량'}).waitFor();await a.locator('#market-confirm').click();
  await b.locator('#market-shards').fill('2');await b.locator('#market-energy').fill('5');await b.locator('#market-apply').click();
  await a.locator('#market-own-offer [data-confirmed="false"]').waitFor();assert.equal(room.trades.values().next().value.confirmed.length,0);
  check('시장 안 거래 요청·물건 선택·두 재화 올리기·미적용 수락 금지·상대 수정 시 양쪽 수락 초기화');
  for(const width of [1440,390,320]){await a.setViewportSize({width,height:1000});assert.ok(await a.locator('#market-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth));await a.screenshot({path:`.local/212-market-${width}.png`});}
  await a.locator('#market-confirm').click();await b.locator('#market-confirm').click();await a.locator('#market-dialog').waitFor({state:'hidden'});await b.locator('#market-dialog').waitFor({state:'hidden'});
  assert.deepEqual([p.starShards,q.starShards,p.cosmicEnergy,q.cosmicEnergy],[28,32,22,18]);assert.equal(p.inventory[0].quantity,2);assert.equal(q.inventory.find(i=>i.id==='space-food-card').quantity,1);
  await interact(teacher,'거래 내역');await teacher.locator('#market-history').filter({hasText:'교환 완료'}).waitFor();await teacher.locator('#market-history').filter({hasText:'우주 식량'}).waitFor();await teacher.screenshot({path:'.local/212-market-history.png'});await close(teacher);
  assert.equal(game.store.snapshot(room,p).tradeLog,undefined);check('양쪽 실제 수락으로 아이템/두 재화 교환·교사 시장내 내역 조회·320px 넘침 없음');
  // Wallet text matches the icon size, and amount is to the right in both UI locations.
  const walletCheck=async(page,selector)=>{
    const values=await page.locator(selector+' .currency-chip').evaluateAll(chips=>chips.map(c=>{
      const i=c.querySelector('img'),l=c.querySelector('.currency-label'),n=c.querySelector('.currency-amount'),ir=i.getBoundingClientRect(),lr=l.getBoundingClientRect(),nr=n.getBoundingClientRect();
      return {icon:ir.height,font:parseFloat(getComputedStyle(l).fontSize),labelX:lr.right,numberX:nr.x,dy:Math.abs((lr.y+lr.height/2)-(nr.y+nr.height/2))};
    }));assert.equal(values.length,2);for(const v of values){assert.ok(Math.abs(v.icon-v.font)<1);assert.ok(v.numberX>=v.labelX);assert.ok(v.dy<1);}
  };
  for(const width of [1440,390,320]){
    await a.setViewportSize({width,height:1000});await a.locator('#dock-inventory').click();await walletCheck(a,'#bag-currency');await a.screenshot({path:`.local/212-wallet-${width}.png`});await close(a);
    const growth=VALLEY.objects.find(o=>o.kind==='growth');Object.assign(p,{mapId:VALLEY_ID,x:growth.x,y:growth.y});publish();await interact(a,'성장의 별');await a.locator('#growth-info .currency-chip').first().waitFor();await walletCheck(a,'#growth-info');await a.screenshot({path:`.local/213-growth-${width}.png`});await close(a);
  }
  check('가방/성장의 별 1440·390·320px 아이콘=글씨크기·이름 오른쪽 보유량');
  const star=VALLEY.objects.find(o=>o.kind==='evolution');Object.assign(p,{mapId:VALLEY_ID,x:star.x,y:star.y});Object.assign(p.avatar,{level:1,xp:15,constellationId:null});publish();
  await interact(a,'진화의 별');await a.locator('#evolution-evolve').click();await a.locator('[data-constellation-type]').first().waitFor();
  const types=['생산계','제작계','공격계','수호계','특수계'];assert.deepEqual(await a.locator('[data-constellation-type]').allTextContents(),types);assert.equal(await a.locator('#evolution-grid .constellation-choice').count(),0);
  assert.ok(!(await a.locator('#evolution-dialog').textContent()).includes('별자리 그림과 성격'));
  const boxes=await a.locator('[data-constellation-type]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,color:getComputedStyle(n).color};}));assert.ok(boxes.every((v,i)=>v.x===boxes[0].x&&v.color==='rgb(255, 255, 255)'&&(!i||v.y>boxes[i-1].y)));
  await a.screenshot({path:'.local/213-evolution-types.png'});
  for(const type of types){await a.locator(`[data-constellation-type="${type}"]`).click();assert.deepEqual((await a.locator('#evolution-grid [data-constellation-id]').evaluateAll(ns=>ns.map(n=>n.dataset.constellationId))).sort(),CONSTELLATIONS.filter(c=>c.type===type).map(c=>c.id).sort());await a.locator('#evolution-types-back').click();}
  await a.locator('[data-constellation-type="특수계"]').click();await a.locator('[data-constellation-id="aries"]').click();await a.locator('#evolution-yes').click();await a.locator('#evolution-summary').filter({hasText:'LV2'}).waitFor();assert.equal(p.avatar.xp,0);check('첫 진화5계열 세로버튼·전체16종 필터 정확·LV2 양자리 진화 XP0');
  assert.deepEqual(errors,[]);
}finally{await writeFile('.local/212-market-results.json',JSON.stringify({checks,errors},null,2));await browser.close();await game.close();}
