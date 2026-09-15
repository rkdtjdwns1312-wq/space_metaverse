import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { chromium } from 'playwright';

const files = new Map([
  ['/evolution-ui.js', ['client/evolution-ui.js', 'text/javascript; charset=utf-8']],
  ['/growth-ui.js', ['client/growth-ui.js', 'text/javascript; charset=utf-8']],
  ['/evolution.css', ['client/evolution.css', 'text/css; charset=utf-8']],
  ['/shared/constellations.js', ['shared/constellations.js', 'text/javascript; charset=utf-8']]
]);
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/evolution.css"><style>body{font-family:Arial,sans-serif}button,input{font:inherit;padding:8px}.primary{background:#7953a5;color:white}.secondary{background:#eee}.dialog-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}</style></head><body><canvas id="world" tabindex="0"></canvas></body></html>`;
const server = createServer(async (request, response) => {
  try {
    if (request.url === '/') { response.setHeader('content-type', 'text/html; charset=utf-8'); response.end(html); return; }
    const entry = files.get(request.url);
    if (!entry) { response.statusCode = 404; response.end('not found'); return; }
    response.setHeader('content-type', entry[1]); response.end(await readFile(entry[0]));
  } catch (error) { response.statusCode = 500; response.end(error.message); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const url = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
const checks = [], errors = [];
const check = value => { checks.push(value); console.log(value); };
page.on('pageerror', error => errors.push(error.message));
await mkdir('.local', { recursive: true });

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.evaluate(async () => {
    const [{ createEvolutionUI }, { createGrowthUI }, { CONSTELLATIONS }] = await Promise.all([
      import('/evolution-ui.js'), import('/growth-ui.js'), import('/shared/constellations.js')
    ]);
    const clone = value => structuredClone(value);
    window.calls = []; window.evolutionMutations = 0; window.growthMutations = 0; window.joined = true;
    window.evolutionInfo = {
      options: CONSTELLATIONS.map((value, index) => ({ ...value, count: index === 0 ? 2 : 0, available: index !== 0, current: false })),
      avatar: { form: 'asteroid', level: 1, xp: 15, constellationId: null, equipment: {}, departmentId: null },
      requiredXp: 15, canEvolve: true
    };
    window.growthInfo = {
      avatar: { form: 'asteroid', level: 1, xp: 10, constellationId: null, equipment: {}, departmentId: null },
      requiredXp: 15, remainingXp: 5, starShards: 20, maxBuy: 5, canBuy: true
    };
    window.mockRequest = async (event, data) => {
      window.calls.push({ event, data: clone(data) });
      if (event === 'evolution:info') {
        if (window.deferEvolutionInfo) return new Promise(resolve => { window.resolveEvolutionInfo = () => resolve(clone(window.evolutionInfo)); });
        return clone(window.evolutionInfo);
      }
      if (event === 'evolution:change') {
        window.evolutionMutations++;
        window.evolutionInfo.avatar.constellationId = data.constellationId;
        window.evolutionInfo.options.forEach(option => { option.current = option.id === data.constellationId; });
        return clone(window.evolutionInfo);
      }
      if (event === 'evolution:evolve') {
        window.evolutionMutations++;
        window.evolutionInfo.avatar.constellationId = data.constellationId;
        window.evolutionInfo.avatar.level += 1;
        window.evolutionInfo.avatar.xp = 0;
        window.evolutionInfo.requiredXp = 20;
        window.evolutionInfo.canEvolve = false;
        window.evolutionInfo.options.forEach(option => { option.current = option.id === data.constellationId; if (option.current) option.count = 1; });
        return clone(window.evolutionInfo);
      }
      if (event === 'growth:info') return clone(window.growthInfo);
      if (event === 'growth:buy') {
        window.growthMutations++;
        window.growthInfo.avatar.xp += data.amount;
        window.growthInfo.starShards -= data.amount;
        window.growthInfo.remainingXp = window.growthInfo.requiredXp - window.growthInfo.avatar.xp;
        window.growthInfo.maxBuy = Math.min(window.growthInfo.remainingXp, window.growthInfo.starShards);
        window.growthInfo.canBuy = window.growthInfo.maxBuy > 0;
        return clone(window.growthInfo);
      }
      throw new Error('unexpected event ' + event);
    };
    const options = { request: window.mockRequest, stop() {}, toast(value) { window.lastToast = value; }, isJoined: () => window.joined };
    window.evolutionUI = createEvolutionUI(options);
    window.growthUI = createGrowthUI(options);
  });

  await page.evaluate(() => window.evolutionUI.open());
  await page.locator('#evolution-dialog').waitFor({ state: 'visible' });
  await page.locator('#evolution-summary').filter({ hasText: '15 / 15' }).waitFor();
  assert.equal(await page.locator('#evolution-change').isDisabled(), true);
  assert.match(await page.locator('#evolution-error').textContent(), /LV1/);
  check('진화의 별 메뉴·LV1 변경 차단·경험치 표시');

  await page.locator('#evolution-evolve').click();
  await page.locator('#evolution-grid .constellation-choice').first().waitFor();
  assert.equal(await page.locator('#evolution-grid .constellation-choice').count(), 16);
  assert.equal(await page.locator('[data-constellation-id="aries"]').isDisabled(), true);
  await page.locator('[data-constellation-id="taurus"]').click();
  await page.locator('#evolution-confirm-text').filter({ hasText: '정말 진화하시겠습니까?' }).waitFor();
  await page.locator('#evolution-no').click();
  assert.equal(await page.evaluate(() => window.evolutionMutations), 0);
  check('4×4 정원 표시·마감 선택 비활성·아니오 요청 0건');

  await page.locator('#evolution-evolve').click();
  await page.locator('[data-constellation-id="taurus"]').click();
  await page.locator('#evolution-yes').click();
  await page.locator('#evolution-summary').filter({ hasText: 'LV2' }).waitFor();
  const evolveCall = await page.evaluate(() => window.calls.findLast(value => value.event === 'evolution:evolve'));
  assert.deepEqual(evolveCall.data, { constellationId: 'taurus' });
  assert.equal(await page.evaluate(() => window.evolutionInfo.avatar.xp), 0);
  check('예 확인 뒤 한 단계 진화·XP 0·선택 계보 전달');

  await page.locator('#evolution-change').click();
  await page.locator('[data-constellation-id="lyra"]').click();
  await page.waitForFunction(() => window.evolutionInfo.avatar.constellationId === 'lyra');
  assert.equal(await page.evaluate(() => window.evolutionInfo.avatar.level), 2);
  check('LV2 별자리 변경 즉시 저장·레벨 보존');

  await page.setViewportSize({ width: 390, height: 844 });
  const dialogBox = await page.locator('#evolution-dialog').boundingBox();
  assert.ok(dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= 390);
  const columns = await page.locator('#evolution-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  assert.equal(columns, 4);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: '.local/evolution-mobile.png' });
  check('390px 4열 선택표·가로 넘침 없음');

  await page.locator('#evolution-header-close').click();
  await page.evaluate(() => { window.deferEvolutionInfo = true; window.evolutionUI.open(); });
  await page.locator('#evolution-dialog').waitFor({ state: 'visible' });
  await page.locator('#evolution-header-close').click();
  await page.evaluate(() => { window.resolveEvolutionInfo(); window.deferEvolutionInfo = false; });
  await page.waitForTimeout(80);
  assert.equal(await page.locator('#evolution-dialog').isVisible(), false);
  check('닫은 뒤 늦은 응답이 창을 다시 열지 않음');

  await page.evaluate(() => window.growthUI.open());
  await page.locator('#growth-info').filter({ hasText: '10 / 15' }).waitFor();
  await page.locator('#growth-amount').fill('99');
  assert.equal(await page.locator('#growth-amount').inputValue(), '5');
  await page.locator('#growth-max').click();
  await page.locator('#growth-buy').click();
  await page.locator('#growth-info').filter({ hasText: '15 / 15' }).waitFor();
  const growthCall = await page.evaluate(() => window.calls.findLast(value => value.event === 'growth:buy'));
  assert.deepEqual(growthCall.data, { amount: 5 });
  assert.deepEqual(await page.evaluate(() => ({ level: window.growthInfo.avatar.level, xp: window.growthInfo.avatar.xp, balance: window.growthInfo.starShards })), { level: 1, xp: 15, balance: 15 });
  assert.equal(await page.locator('#growth-buy').isDisabled(), true);
  assert.match(await page.locator('#growth-error').textContent(), /진화의 별/);
  check('성장 구매 입력 cap·최대 구매·별 파편 차감·자동 진화 없음');

  await page.locator('#growth-close').click();
  await page.evaluate(() => {
    window.growthInfo.avatar.xp = 0; window.growthInfo.starShards = 3; window.growthInfo.remainingXp = 15;
    window.growthInfo.maxBuy = 3; window.growthInfo.canBuy = true; window.growthUI.open();
  });
  await page.locator('#growth-info').filter({ hasText: '3개' }).waitFor();
  await page.locator('#growth-amount').fill('-7');
  await page.waitForTimeout(0);
  assert.equal(await page.locator('#growth-amount').inputValue(), '1');
  check('성장 수량 최소·잔액 cap 입력 보정');

  assert.deepEqual(errors, []);
} finally {
  await writeFile('.local/evolution-result.json', JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
  server.closeAllConnections?.();
  await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify({ count: checks.length, errors }));
