import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {PLAZA_ID, STREET, STREET_ID, SHOP} from '../shared/config.js';
import {goldItemIdOf} from '../shared/star-cards.js';

const key = 'isolated-automation-browser-key';
const dir = await mkdtemp(join(tmpdir(), 'star-automation-browser-'));
const errors = [], checks = [];
let game, browser, code, page;
const room = () => game.store.rooms.get(code);
const player = name => [...room().players.values()].find(p => p.nickname === name);
const check = label => {checks.push(label); console.log(`Automation ${checks.length}: ${label}`);};
function publish() {
  for (const p of room().players.values()) if (p.connected) game.io.sockets.sockets.get(p.socketId)?.emit('room:state', game.store.snapshot(room(), p));
}
async function closeDialogs() {
  for (let n = 0; n < 10 && await page.locator('dialog[open]').count(); n++) await page.keyboard.press('Escape');
}
async function useCard(type) {
  await closeDialogs();
  game.store.transact(() => {player('별이').inventory = [{id: goldItemIdOf(type), quantity: 1}]; player('별이').lastItemUseAt = 0;});
  publish();
  await page.locator('#dock-inventory').click();
  await page.locator(`[data-item-id="${goldItemIdOf(type)}"] .slot-btn`).click();
  await page.locator('#bag-detail .use').click();
  await page.locator('#use-confirm').click();
  await page.locator('#star-card-dialog').waitFor({state: 'visible'});
}
try {
  await mkdir('.local', {recursive: true});
  game = createClassroomServer({teacherKey: key, dataDir: dir, studentHours: false, starCardRandom: () => 0});
  const port = (await game.listen()).port, url = `http://127.0.0.1:${port}`;
  browser = await chromium.launch({headless: true, ...(process.platform === 'win32' ? {channel: 'msedge'} : {})});
  const teacher = await browser.newPage({viewport: {width: 1440, height: 960}});
  page = await browser.newPage({viewport: {width: 1440, height: 960}});
  for (const p of [teacher, page]) {p.setDefaultTimeout(10000); p.on('pageerror', e => errors.push(e.message));}
  await teacher.goto(url);
  await teacher.locator('#teacher-tab').click(); await teacher.locator('#teacher-key').fill(key);
  await fillNewClass(teacher, ['별이', '달이', '해님'], {pin: ['1357', '2468', '9876']});
  await teacher.locator('#teacher-form .submit').click(); await teacher.locator('#lobby').waitFor({state: 'hidden'});
  code = [...game.store.rooms.keys()][0];
  await page.goto(`${url}/?class=${code}`);
  await page.locator('#nickname').fill('별이'); await page.locator('#student-pin').fill('1357');
  await page.locator('#student-form .submit').click(); await page.locator('#password-offer-no').click();
  await page.locator('#lobby').waitFor({state: 'hidden'});
  game.store.transact(() => {player('별이').avatar.xp = 14; player('별이').starShards = 0;});
  await useCard('zodiac');
  const choice = page.locator('.star-card-choice');
  assert.equal(await choice.getByRole('button', {name: '별자리 변경', exact: true}).isDisabled(), true);
  await choice.getByRole('button', {name: /경험치 받기/}).click();
  await choice.getByRole('button', {name: '취소', exact: true}).click();
  assert.equal(player('별이').avatar.xp, 14);
  await choice.getByRole('button', {name: /경험치 받기/}).click();
  publish(); await page.waitForTimeout(1200);
  assert.equal(await choice.getByRole('button', {name: '선택 확정', exact: true}).isVisible(), true);
  await choice.getByRole('button', {name: '선택 확정', exact: true}).click();
  await page.locator('.star-card-messages').filter({hasText: '초과 경험치를 별 파편 2개로 지급'}).waitFor();
  assert.equal(player('별이').avatar.xp, 15); assert.equal(player('별이').starShards, 2);
  assert.equal(await choice.isVisible(), false);
  check('LV1 별자리 선택 차단·선택 취소·스냅샷 중 확인 유지·XP 초과분 2파편 지급');

  game.store.transact(() => {
    Object.assign(player('별이').avatar, {level: 2, xp: 7, form: 'constellation', constellationId: 'aries'});
    for (const name of ['달이', '해님']) Object.assign(player(name).avatar, {level: 2, xp: 0, form: 'constellation', constellationId: 'leo'});
  });
  await useCard('zodiac');
  await choice.getByRole('button', {name: '별자리 변경', exact: true}).click();
  assert.equal(await page.locator('.star-card-constellation-options button').count(), 17);
  await choice.getByRole('button', {name: '돌아가기', exact: true}).click();
  await choice.getByRole('button', {name: '별자리 변경', exact: true}).click();
  assert.equal(await page.locator('.star-card-constellation-options button').count(), 17);
  await page.setViewportSize({width: 390, height: 844});
  const layout = await page.locator('.star-card-constellation-options').evaluate(el => ({columns: getComputedStyle(el).gridTemplateColumns.split(' ').length, fits: el.scrollWidth <= el.clientWidth}));
  assert.equal(layout.columns, 4); assert.equal(layout.fits, true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({path: '.local/196-zodiac-mobile.png', fullPage: true});
  await choice.getByRole('button', {name: '사자자리', exact: true}).click();
  await choice.getByRole('button', {name: '취소', exact: true}).click();
  await choice.getByRole('button', {name: '별자리 변경', exact: true}).click();
  await choice.getByRole('button', {name: '사자자리', exact: true}).click();
  await choice.getByRole('button', {name: '선택 확정', exact: true}).click();
  await page.locator('.star-card-messages').filter({hasText: '사자자리로 변경 완료'}).waitFor();
  assert.equal(player('별이').avatar.constellationId, 'leo'); assert.equal(player('별이').avatar.xp, 7);
  assert.equal([...room().players.values()].filter(p => p.avatar.constellationId === 'leo').length, 3);
  check('390px 4×4 별자리 선택·같은 별자리 2명 제한 예외·레벨과 XP 보존');

  await page.setViewportSize({width: 1440, height: 960});
  await useCard('saturn');
  assert.match(await page.locator('.star-card-manual-note').innerText(), /반값/);
  await closeDialogs();
  const shop = STREET.objects.find(o => o.kind === 'shop');
  game.store.transact(() => {Object.assign(player('별이'), {mapId: STREET_ID, x: shop.x, y: shop.y + 45, starShards: 100});});
  publish();
  await page.locator('#interact-prompt').filter({hasText: '별상점'}).waitFor();
  await page.locator('#world').focus(); await page.keyboard.press('f');
  await page.locator('#shop-dialog').waitFor({state: 'visible'});
  const item = SHOP.items.find(i => i.forSale !== false && i.level === 1 && i.price > 1 && i.price % 2 === 1);
  const row = page.locator(`#shop-buy-list [data-item-id="${item.id}"]`).first();
  await row.locator('.qty').fill('2');
  const cost = Math.floor(item.price / 2) + item.price;
  assert.match(await row.locator('.price').innerText(), new RegExp(`합계 ★ ${cost} · 반값 할인 1개`));
  publish(); await page.waitForTimeout(200);
  await row.locator('.buy').click();
  await page.waitForFunction(balance => document.getElementById('self-shards').textContent === String(balance), 100 - cost);
  assert.equal(player('별이').inventory.find(i => i.id === item.id).quantity, 2);
  assert.equal(await row.locator('.qty').inputValue(), '2');
  assert.equal(await row.locator('.price').innerText(), `합계 ★ ${item.price * 2}`);
  await page.screenshot({path: '.local/196-saturn-shop.png'});
  check('토성 2개 구매에서 1개 할인·잔액 일치·구매 후 할인 소진과 수량 유지');

  const cheap = SHOP.items.find(i => i.forSale !== false && i.level === 1 && i.price === 1);
  game.store.transact(() => {player('별이').starShards = 0;}); publish();
  const cheapRow = page.locator(`#shop-buy-list [data-item-id="${cheap.id}"]`).first();
  await cheapRow.locator('.buy:not(:disabled)').waitFor();
  assert.match(await cheapRow.locator('.price').innerText(), /합계 ★ 0/);
  await cheapRow.locator('.buy').click();
  await cheapRow.locator('.buy:disabled').waitFor();
  assert.equal(player('별이').starShards, 0);
  assert.equal(player('별이').inventory.find(i => i.id === cheap.id).quantity, 1);
  check('1파편 상품은 내림으로 0파편 구매 가능·할인 소진 후 잔액0 구매 차단');

  await useCard('pluto');
  assert.match(await page.locator('.star-card-manual-note').innerText(), /자정/);
  await page.screenshot({path: '.local/196-pluto-card.png'});
  assert.equal(game.store.records.get(code).starCards.at(-1).data.automation.version, 1);
  assert.deepEqual(errors, []);
  check('명왕성 자정 제한 안내·자동효과 버전 저장·브라우저 오류0');
  console.log(JSON.stringify({checks, errors}, null, 2));
} catch (error) {
  await page?.screenshot({path: '.local/196-automation-browser-failure.png'}).catch(() => {});
  throw error;
} finally {
  await browser?.close(); await game?.close();
  assert.ok(resolve(dir).startsWith(resolve(join(tmpdir(), 'star-automation-browser-'))));
  await rm(dir, {recursive: true, force: true});
}
