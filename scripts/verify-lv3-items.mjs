import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {STREET, STREET_ID, itemOf} from '../shared/config.js';
import {LV3_ITEMS} from '../shared/lv3-items.js';

// 실제 수업 조합과 관계없는 테스트 전용 조합입니다. 비밀 파일은 읽지 않습니다.
const recipe = {ingredients: [{id: 'android-card', quantity: 2}], output: {id: 'space-station-card'}};
const key = 'isolated-lv3-browser-teacher-key';
const dir = await mkdtemp(join(tmpdir(), 'lv3-browser-'));
const checks = [], errors = [], pages = [];
let game, browser, page, code;
const room = () => game.store.rooms.get(code);
const player = name => [...room().players.values()].find(p => p.nickname === name);
const check = label => {checks.push(label); console.log(`LV3 ${checks.length}: ${label}`);};
const publish = () => {for (const p of room().players.values()) if (p.connected) game.io.to(p.socketId).emit('room:state', game.store.snapshot(room(), p));};
async function closeDialogs() {for (let n = 0; n < 10 && await page.locator('dialog[open]').count(); n++) await page.keyboard.press('Escape');}
function setup(values) {game.store.transact(() => Object.assign(player('별이'), values)); publish();}
async function bagUse(id) {
  await closeDialogs(); setup({inventory: [{id, quantity: 1}], lastItemUseAt: 0});
  await page.locator('#dock-inventory').click();
  await page.locator(`[data-item-id="${id}"] .slot-btn`).click();
  await page.locator('#bag-detail .use').click();
}
try {
  await mkdir('.local', {recursive: true});
  game = createClassroomServer({teacherKey: key, dataDir: dir, studentHours: false, craftingRecipes: [recipe]});
  const url = `http://127.0.0.1:${(await game.listen()).port}`;
  browser = await chromium.launch({headless: true, ...(process.platform === 'win32' ? {channel: 'msedge'} : {})});
  console.log('LV3 setup: browser ready');
  const teacher = await browser.newPage({viewport: {width: 1440, height: 960}}); pages.push(teacher);
  teacher.setDefaultTimeout(10000);
  await teacher.goto(url); await teacher.locator('#teacher-tab').click(); await teacher.locator('#teacher-key').fill(key);
  await fillNewClass(teacher, ['별이', '달이', '해님'], {pin: ['1357', '2468', '9876']});
  await teacher.locator('#teacher-form .submit').click(); await teacher.locator('#lobby').waitFor({state: 'hidden'});
  code = [...game.store.rooms.keys()][0];
  console.log('LV3 setup: isolated class ready');
  for (const [name, pin] of [['별이', '1357'], ['달이', '2468'], ['해님', '9876']]) {
    const p = await browser.newPage({viewport: {width: 1440, height: 960}}); pages.push(p); p.setDefaultTimeout(10000); p.on('pageerror', e => errors.push(e.message));
    await p.goto(`${url}/?class=${code}`); await p.locator('#nickname').fill(name); await p.locator('#student-pin').fill(pin);
    await p.locator('#student-form .submit').click(); await p.locator('#password-offer-no').click(); await p.locator('#lobby').waitFor({state: 'hidden'});
    if (name === '별이') page = p;
  }
  console.log('LV3 setup: 3 students connected');
  game.store.transact(() => {for (const p of room().players.values()) if (p.role === 'student') {p.avatar.level = 3; p.avatar.constellationId = 'aries';}});
  const shop = STREET.objects.find(o => o.kind === 'shop'), machine = STREET.objects.find(o => o.kind === 'crafting');
  setup({mapId: STREET_ID, x: shop.x, y: shop.y + shop.radius + 12, starShards: 1000, inventory: []});
  await page.locator('#world').focus(); await page.keyboard.press('f'); await page.locator('#shop-dialog').waitFor({state: 'visible'});
  await page.locator('[data-shop-level="3"]').click();
  console.log('LV3 setup: shop open');
  assert.equal(await page.locator('#shop-buy-list li.item').count(), 8);
  assert.equal(await page.locator('#shop-buy-list img.item-art').evaluateAll(async imgs => {for (const i of imgs) i.loading = 'eager'; await Promise.all(imgs.map(i => i.decode())); return imgs.every(i => i.naturalWidth === 384);}), true);
  assert.equal(await page.locator('[data-item-id="alien-creature-card"] .buy').isDisabled(), true);
  check('LV3 8종·384px 이미지·미정 가격 구매 차단');
  await page.screenshot({path: '.local/197-lv3-shop-desktop.png'});
  const row = page.locator('#shop-buy-list [data-item-id="space-station-card"]');
  await row.locator('.buy').click();
  await page.waitForFunction(() => document.querySelector('#shop-shards').textContent.includes('972'));
  assert.equal(player('별이').inventory.find(i => i.id === 'space-station-card').quantity, 1);
  await page.locator('#shop-tab-sell').click(); await page.locator('#shop-sell-list [data-item-id="space-station-card"] .sell').click();
  await page.waitForFunction(() => document.querySelector('#shop-shards').textContent.includes('981'));
  check('LV3 구매·되팔기 잔액이 카탈로그 가격과 일치');
  await closeDialogs();
  setup({inventory: [{id: 'supernova-alpha-card', quantity: 2}], starShards: 1000, lv3State: {clusterNextAt: [], supernovaUsed: {}}});
  await page.locator('#world').focus(); await page.keyboard.press('f'); await page.locator('[data-shop-level="3"]').click();
  await row.locator('.buy').click();
  await page.waitForFunction(() => document.querySelector('#shop-shards').textContent.includes('986'));
  await row.locator('.buy').click();
  await page.waitForFunction(() => document.querySelector('#shop-shards').textContent.includes('958'));
  assert.equal(player('별이').inventory.find(i => i.id === 'supernova-alpha-card').quantity, 2);
  assert.ok(game.store.records.get(code).students.find(p => p.nickname === '별이').lv3State.supernovaUsed['supernova-alpha-card']);
  check('초신성 동종 2개를 보유해도 할인은 한 번·다음 구매 정상가·소모 없이 할인 이력 저장');

  await bagUse('great-spaceship-card');
  await page.locator('#use-target').selectOption(player('달이').id);
  await page.locator('#use-second-target').selectOption(player('해님').id);
  assert.equal(await page.locator('#use-third-target-row').isVisible(), false);
  await page.locator('#use-confirm').click(); await page.locator('#use-dialog').waitFor({state: 'hidden'});
  assert.ok(['별이', '달이', '해님'].every(n => player(n).cardMarkers.some(m => m.itemId === 'great-spaceship-card' && m.until === null)));
  check('대우주선은 본인+앞·뒤 친구 2명에게 자리 기록 저장');
  await bagUse('galaxy-cluster-card'); await page.locator('#use-confirm').click(); await page.locator('#use-dialog').waitFor({state: 'hidden'});
  assert.equal(player('별이').inventory.find(i => i.id === 'star-card').quantity, 2);
  await bagUse('rabbit-princess-card'); await page.locator('#use-confirm').click(); await page.locator('#use-dialog').waitFor({state: 'hidden'});
  assert.equal(player('별이').inventory.find(i => i.id === 'star-card').quantity, 1);
  check('은하단 별 카드 2장·토끼 공주 1장 실제 사용 지급');
  await closeDialogs(); setup({mapId: STREET_ID, x: machine.x, y: machine.y + 55, inventory: structuredClone(recipe.ingredients), starShards: 10});
  await page.locator('#interact-prompt').filter({hasText: '별빛 조합기'}).waitFor();
  await page.locator('#world').focus(); await page.keyboard.press('f');
  await page.locator('#crafting-bag [data-item-id="android-card"]').click(); await page.locator('#crafting-bag [data-item-id="android-card"]').click();
  await page.locator('#crafting-submit').click(); await page.locator('#crafting-note').filter({hasText: '조합 성공'}).waitFor();
  assert.equal(player('별이').starShards, 9); assert.equal(player('별이').inventory[0].id, 'space-station-card');
  for (const path of ['/data/crafting-recipes.json', '/server/lv3-item-effects.js', '/.local/lv3-source/recipes.json']) assert.equal((await page.request.get(url + path)).status(), 404);
  check('테스트 전용 LV3 조합·수수료1·비공개 경로404');
  await closeDialogs(); await page.reload(); await page.locator('#lobby').waitFor({state: 'hidden'});
  assert.equal(player('별이').inventory[0].id, 'space-station-card');
  assert.equal(player('별이').cardMarkers[0].itemId, 'great-spaceship-card');
  check('재접속 후 인벤토리·사용 기록 유지');
  setup({mapId: STREET_ID, x: shop.x, y: shop.y + shop.radius + 12});
  await page.locator('#world').focus(); await page.keyboard.press('f'); await page.locator('[data-shop-level="3"]').click();
  await page.setViewportSize({width: 390, height: 844}); await page.screenshot({path: '.local/197-lv3-shop-mobile.png'});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []); check('모바일 가로 넘침·브라우저 오류 없음');
  await writeFile('.local/197-lv3-browser.json', JSON.stringify({checks, errors}, null, 2));
} catch (error) {await page?.screenshot({path: '.local/197-lv3-failure.png'}).catch(() => {}); throw error;}
finally {
  await browser?.close(); await game?.close();
  assert.ok(resolve(dir).startsWith(resolve(join(tmpdir(), 'lv3-browser-')))); await rm(dir, {recursive: true, force: true});
}
