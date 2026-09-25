import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createClassroomServer } from '../server/app.js';
import { fillNewClass } from './class-setup.mjs';
import { PLAZA_ID, STREET, STREET_ID } from '../shared/config.js';

const key = 'crafting-isolated-browser-fixture-key';
const recipes = []; // 실제 조합 파일을 읽지 않는 테스트 전용 배열
const game = createClassroomServer({ teacherKey: key, studentHours: false, craftingRecipes: recipes });
const { port } = await game.listen();
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
const checks = [], errors = [], contexts = [];
const check = text => { checks.push(text); console.log(`Crafting ${checks.length}: ${text}`); };
await mkdir('.local', { recursive: true });

async function openPage(viewport) {
  const context = await browser.newContext({ viewport });
  context.setDefaultTimeout(10000); contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return page;
}
async function visible(page) { await page.locator('#crafting-dialog').waitFor({ state: 'visible' }); }
async function openAt(page, player, state = {}) {
  if (await page.locator('#crafting-dialog').isVisible().catch(() => false)) await page.locator('#crafting-close').click();
  Object.assign(player, { mapId: STREET_ID, x: 1080, y: 380 + 55, ...state });
  game.io.sockets.sockets.get(player.socketId).emit('room:state', game.store.snapshot([...game.store.rooms.values()][0], player));
  await page.locator('#interact-prompt').waitFor({ state: 'visible' });
  await page.locator('#world').focus(); await page.keyboard.press('f'); await visible(page);
}

try {
  const page = await openPage({ width: 1440, height: 960 });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#teacher-tab').click(); await page.locator('#teacher-key').fill(key);
  await fillNewClass(page, ['1']); await page.locator('#teacher-form .submit').click();
  await page.locator('#lobby').waitFor({ state: 'hidden' });
  const room = [...game.store.rooms.values()][0]; const player = [...room.players.values()][0];
  const machine = STREET.objects.find(object => object.kind === 'crafting');
  assert.deepEqual({ x: machine.x, y: machine.y }, { x: 1080, y: 380 });
  await openAt(page, player, { inventory: [{ id: 'space-food-card', quantity: 3 }, { id: 'meteor-fragment-card', quantity: 1 }], starShards: 7 });
  assert.equal(await page.locator('#crafting-grid .crafting-slot').count(), 16);
  assert.equal(await page.locator('#crafting-bag button[data-item-id="space-food-card"]').count(), 1);
  check('1080,380 조합기 근처에서 F로 열리고 4×4 16칸과 가방이 표시됨');

  recipes.push({ingredients:[{id:'space-food-card',quantity:17}],output:{id:'android-card'}},
    {ingredients:[{id:'android-card',quantity:2}],output:{id:'space-station-card'}});
  await page.locator('#crafting-recipes-open').click();
  await page.locator('#crafting-recipes-status').filter({hasText:'LV2 조합법 1개'}).waitFor();
  assert.match(await page.locator('#crafting-recipes-list').innerText(),/우주 식량 × 17/);
  await page.locator('[data-recipe-level="3"]').click();
  await page.locator('#crafting-recipes-status').filter({hasText:'LV3 조합법 1개'}).waitFor();
  assert.match(await page.locator('#crafting-recipes-list').innerText(),/안드로이드 × 2/);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'.local/198-teacher-recipes-mobile.png'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('[data-recipe-level="4"]').click();
  await page.locator('#crafting-recipes-status').filter({hasText:'등록된 조합법이 없습니다.'}).waitFor();
  check('교사 전용 LV2/LV3 탭 재료·수량, LV4 빈 목록, 390px 확인');
  await page.locator('[data-recipe-level="3"]').click();
  await page.locator('#crafting-recipes-list li').waitFor();
  player.role='student';game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
  await page.locator('#crafting-recipes-open').waitFor({state:'hidden'});
  assert.equal(await page.locator('#crafting-recipes-list li').count(),0);
  assert.equal(await page.locator('#crafting-recipes-panel').isVisible(),false);
  check('교사 권한을 잃으면 버튼과 이미 조회한 조합 정보가 즉시 제거됨');
  player.role='teacher';recipes.length=0;await page.setViewportSize({width:1440,height:960});
  await openAt(page,player);

  const food = page.locator('#crafting-bag button[data-item-id="space-food-card"]');
  await food.click(); await food.click(); await food.click();
  assert.match(await page.locator('#crafting-grid .crafting-slot').first().innerText(), /× 3/);
  assert.match(await food.innerText(), /0개/);
  await page.locator('#crafting-grid .crafting-slot').first().click();
  assert.match(await page.locator('#crafting-grid .crafting-slot').first().innerText(), /× 2/);
  await page.locator('#crafting-clear').click();
  assert.equal(await page.locator('#crafting-grid .crafting-slot').filter({ hasText: '×' }).count(), 0);
  check('가방 반복 클릭 수량·재료 칸 하나 빼기·모두 빼기 동작');

  await food.click(); await page.locator('#crafting-close').click();
  assert.equal(await page.locator('#crafting-dialog').isVisible(), false);
  await openAt(page, player); assert.equal(await page.locator('#crafting-grid .crafting-slot').filter({ hasText: '×' }).count(), 0);
  assert.equal(player.inventory.find(item => item.id === 'space-food-card').quantity, 3);
  check('닫았다 다시 열어도 예약 재료가 실제 가방에서 사라지지 않고 예약은 초기화됨');

  assert.equal(await page.locator('#crafting-submit').isDisabled(), true);
  const beforeShards = player.starShards, beforeInventory = JSON.stringify(player.inventory);
  await page.locator('#crafting-submit').click({ force: true });
  await page.waitForTimeout(100);
  assert.equal(player.starShards, beforeShards); assert.equal(JSON.stringify(player.inventory), beforeInventory);
  await page.locator('#crafting-bag button[data-item-id="space-food-card"]').click();
  await page.locator('#crafting-submit').click({ force: true });
  await page.locator('#crafting-note').filter({ hasText: '준비 중' }).waitFor();
  assert.equal(player.starShards, beforeShards); assert.equal(JSON.stringify(player.inventory), beforeInventory);
  check('준비 중 조합 버튼이 비활성화되고 강제 클릭/조합 요청에도 별 파편·재료가 무변경');

  await page.locator('#crafting-close').click();
  await openAt(page, player, { inventory: [{ id: 'space-food-card', quantity: 1 }], starShards: 7 });
  const directCombine = async state => {
    Object.assign(player, { inventory: [{ id: 'space-food-card', quantity: 1 }], starShards: 7 });
    game.io.sockets.sockets.get(player.socketId).emit('room:state', game.store.snapshot(room, player));
    await page.waitForTimeout(50);
    if (await page.locator('#crafting-clear').isEnabled()) await page.locator('#crafting-clear').click();
    await page.locator('#crafting-bag button[data-item-id="space-food-card"]').click();
    Object.assign(player, state);
    game.io.sockets.sockets.get(player.socketId).emit('room:state', game.store.snapshot(room, player));
    await page.locator('#crafting-submit').evaluate(element => { element.disabled = false; element.click(); });
    await page.locator('#crafting-note').filter({ hasText: '조합기' }).waitFor();
    return await page.locator('#crafting-note').innerText();
  };
  const offMap = await directCombine({ mapId: PLAZA_ID, x: 1080, y: 380 });
  assert.match(offMap, /조합기/);
  const far = await directCombine({ mapId: STREET_ID, x: 700, y: 700 });
  assert.match(far, /조합기/);
  check('직접 crafting:combine도 다른 맵·먼 거리에서 거부됨');

  await page.setViewportSize({ width: 1440, height: 960 }); await page.screenshot({ path: '.local/verify-crafting-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: '.local/verify-crafting-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check('1440×960·390×844 캡처와 모바일 가로 넘침 없음');
  assert.deepEqual(errors, []);
  const report = { checks, errors, screenshots: ['.local/verify-crafting-desktop.png', '.local/verify-crafting-mobile.png'] };
  await writeFile('.local/verify-crafting-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await writeFile('.local/verify-crafting-report.json', JSON.stringify({ checks, errors, failure: error.stack }, null, 2));
  throw error;
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser.close(); await game.close();
}
