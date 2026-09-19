// 상점·미니맵·최근 지도 렌더링을 실제 Edge UI로 확인합니다. 실제 저장소/학급은 사용하지 않습니다.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createClassroomServer } from '../server/app.js';
import { fillNewClass } from './class-setup.mjs';
import { GARDEN, GARDEN_ID, MAP, MOON_PARADISE_MAPS, PARADISE_MAPS, PLAZA_ID, SHOP, STAR_PARADISE, STREET, STREET_ID } from '../shared/config.js';

const key = 'shop-map-refresh-isolated-key';
const game = createClassroomServer({ teacherKey: key, studentHours: false });
const { port } = await game.listen();
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
const checks = [];
const errors = [];
const check = text => { checks.push(text); console.log(`Shop/map ${checks.length}: ${text}`); };
await mkdir('.local', { recursive: true });

const mapState = id => [MAP, STREET, GARDEN, STAR_PARADISE, ...PARADISE_MAPS, ...MOON_PARADISE_MAPS].find(map => map.id === id);
const publish = (room, player) => game.io.to(player.socketId).emit('room:state', game.store.snapshot(room, player));
const setPlayer = (room, player, state) => { Object.assign(player, state); publish(room, player); };
const noOverflow = async page => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth));
const gateLabel = gate => String(gate.name).replace(/[←↑→↓↔↕⬅⬆➡⬇]/gu, '').trim();
const screenshotMap = async (page, room, player, state, path) => {
  setPlayer(room, player, state);
  await page.locator('#minimap-title').filter({ hasText: mapState(state.mapId).name }).waitFor();
  await page.waitForTimeout(180);
  await page.screenshot({ path });
};

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, hasTouch: true });
  context.setDefaultTimeout(10000);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}`);
  await page.locator('#teacher-tab').click();
  await page.locator('#teacher-key').fill(key);
  await fillNewClass(page, ['1']);
  await page.locator('#teacher-form .submit').click();
  await page.locator('#lobby').waitFor({ state: 'hidden' });
  const room = [...game.store.rooms.values()][0];
  const player = [...room.players.values()][0];
  const shop = STREET.objects.find(object => object.kind === 'shop');

  setPlayer(room, player, { mapId: STREET_ID, x: shop.x, y: shop.y + shop.radius + 20, starShards: 50000, inventory: [] });
  await page.locator('#minimap-title').filter({ hasText: STREET.name }).waitFor();
  await page.locator('#world').focus();
  await page.keyboard.press('f');
  await page.locator('#shop-dialog').waitFor({ state: 'visible' });
  const saleItems = SHOP.items.filter(item => item.forSale !== false && item.level === 1);
  assert.equal(await page.locator('#shop-buy-list li.item').count(), 8);
    await page.locator('#shop-level-tabs [data-shop-level="2"]').click();
    assert.equal(await page.locator('#shop-buy-list li.item').count(), 9);
    for (const level of [3, 4, 5]) {
    await page.locator(`#shop-level-tabs [data-shop-level="${level}"]`).click();
    assert.equal(await page.locator('#shop-buy-list li.item').count(), 0);
    await page.locator('#shop-buy-empty').filter({ hasText: '준비' }).waitFor();
  }
  await page.locator('#shop-level-tabs [data-shop-level="1"]').click();
  assert.equal(await page.locator('#shop-buy-list li.item').count(), 8);
  assert.equal(await page.locator('#shop-buy-list li.item').count(), saleItems.length);
  assert.ok(saleItems.every(item => item.art?.startsWith('/assets/items/') && item.art.endsWith('-pastel.webp')));
  assert.equal(await page.locator('#shop-buy-list img.item-art').evaluateAll(images => images.every(image => image.currentSrc.endsWith('-pastel.webp'))), true);
  assert.equal(await page.locator('#shop-buy-list li').filter({ hasText: '선생님이 나눠' }).count(), 0);
  const heading = await page.locator('#shop-title').boundingBox();
  const shards = await page.locator('#shop-shards').boundingBox();
  assert.ok(Math.abs(heading.y + heading.height / 2 - (shards.y + shards.height / 2)) < 2);
  assert.ok(shards.x + shards.width >= heading.x + heading.width);
  assert.equal(await page.locator('#shop-buy-list img').evaluateAll(async images => { await Promise.all(images.map(image => image.decode())); return images.every(image => image.naturalWidth > 0); }), true);
  check('F로 가까운 별 상점을 열고 판매 중 8개·제목/잔액 정렬·설명·그림을 확인');

  await page.locator('#shop-shards').filter({ hasText: '50,000' }).waitFor();
  const food = page.locator('#shop-buy-list li[data-item-id="space-food-card"]');
  await food.locator('button.buy').click();
  await page.locator('#shop-shards').filter({ hasText: '49,998' }).waitFor();
  assert.equal(await food.locator('button.buy').count(), 1);
  await page.locator('#shop-tab-sell').click();
  assert.equal(await page.locator('#shop-level-tabs').isVisible(), false);
  await page.locator('#shop-sell-list li[data-item-id="space-food-card"]').filter({ hasText: '가진 개수 1' }).waitFor();
  check('우주 식량 1개 구매 후 잔액 49,998·수량 1');
  await page.locator('#shop-tab-buy').click();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('minimap-title')).fontSize === '26px');
  assert.equal(await page.locator('#shop-title').evaluate(element => { const r = element.getBoundingClientRect(); return Math.round(r.y + r.height / 2); }), await page.locator('#shop-shards').evaluate(element => { const r = element.getBoundingClientRect(); return Math.round(r.y + r.height / 2); }));
  await page.screenshot({ path: '.local/174-shop-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('minimap-title')).fontSize === '22px');
  assert.equal(await page.locator('#shop-title').evaluate(element => { const r = element.getBoundingClientRect(); return Math.round(r.y + r.height / 2); }), await page.locator('#shop-shards').evaluate(element => { const r = element.getBoundingClientRect(); return Math.round(r.y + r.height / 2); }));
  await noOverflow(page);
  await page.screenshot({ path: '.local/174-shop-mobile.png' });
  await page.locator('#shop-close').click();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('minimap-title')).fontSize === '26px');
  assert.equal(await page.locator('#minimap-title').evaluate(element => getComputedStyle(element).textAlign), 'center');
  await noOverflow(page);
  check('열린 상점 데스크톱/모바일 캡처·제목/잔액 중심 정렬·가로 넘침 없음, 닫힌 뒤 1440px 지도 준비');

  const gate = GARDEN.objects.find(object => object.id === 'gate-paradise');
  assert.equal(gateLabel(gate), '태양의 낙원 1');
  await screenshotMap(page, room, player, { mapId: GARDEN_ID, x: gate.x, y: gate.y + 55 }, '.local/175-gate.png');
  await screenshotMap(page, room, player, { mapId: STREET_ID, x: shop.x, y: shop.y + 170 }, '.local/176-shop-building.png');
  await screenshotMap(page, room, player, { mapId: PLAZA_ID, x: 1080, y: 800 }, '.local/178-plaza.png');
  await screenshotMap(page, room, player, { mapId: GARDEN_ID, x: 600, y: 420 }, '.local/167-crossroads.png');
  await screenshotMap(page, room, player, { mapId: STAR_PARADISE.id, x: 600, y: 380 }, '.local/168-star-paradise.png');
  for (const map of [GARDEN, STAR_PARADISE, ...PARADISE_MAPS, ...MOON_PARADISE_MAPS]) {
    setPlayer(room, player, { mapId: map.id, x: map.spawn.x, y: map.spawn.y });
    await page.locator('#minimap-title').filter({ hasText: map.name }).waitFor();
    assert.ok(map.name.length <= 10 || map.name.startsWith('태양의 낙원') || map.name.startsWith('달의 낙원'));
    for (const object of map.objects.filter(item => item.kind === 'gate')) assert.ok(gateLabel(object).length > 0);
  }
  assert.deepEqual(MAP.templeCenter, { x: 1080, y: 700 });
  assert.equal(MAP.objects.some(object => object.id === 'square'), false);
  assert.equal(MAP.objects.some(object => object.kind === 'temple-bowl'), false);
  assert.equal(MAP.objects.find(object => object.id === 'black-hole-portal').name, '블랙홀');
  await page.setViewportSize({ width: 1440, height: 960 });
  assert.deepEqual(errors, []);
  check('갈림길 위쪽 문·상점 건물·광장·갈림길·별들의 낙원 지도 캡처와 태양/달 map state 이름 확인');
} finally {
  await browser.close();
  await game.close();
}

console.log(`Shop/map verification passed: ${checks.length} checks`);
