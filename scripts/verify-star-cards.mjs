import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {PLAZA_ID} from '../shared/config.js';

// Real user actions run in the UI; only initial ownership and walking positions
// use fixtures. Port and persistent storage are isolated from the live classroom.
const key = 'isolated-star-card-browser-key';
const dir = await mkdtemp(join(tmpdir(), 'star-cards-browser-'));
const checks = [], errors = [], pages = [];
let game, browser, code;
const check = text => { checks.push(text); console.log(`Star cards ${checks.length}: ${text}`); };
const room = () => game.store.rooms.get(code);
const player = name => [...room().players.values()].find(p => p.nickname === name);
function publish() {
  for (const p of room().players.values()) if (p.connected) game.io.sockets.sockets.get(p.socketId)?.emit('room:state', game.store.snapshot(room(), p));
}
async function closeDialogs(page) {
  for (let n = 0; n < 12 && await page.locator('dialog[open]').count(); n++) await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  await page.locator('#world').focus();
}
async function approach(page, who, card) {
  await closeDialogs(page);
  Object.assign(who, {mapId: PLAZA_ID, x: card.x, y: card.y + 25, input: {x: 0, y: 0, at: 0}});
  publish();
  await page.locator('#interact-prompt').filter({hasText: '별 카드 효과 보기'}).waitFor({state: 'visible'});
  await page.locator('#world').focus();
}

try {
  await mkdir('.local', {recursive: true});
  game = createClassroomServer({teacherKey: key, dataDir: dir, studentHours: false, starCardRandom: () => 0});
  const address = await game.listen(), url = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({headless: true, ...(process.platform === 'win32' ? {channel: 'msedge'} : {})});
  async function newPage() {
    const context = await browser.newContext({viewport: {width: 1440, height: 960}});
    context.setDefaultTimeout(10000);
    await context.addInitScript(() => {
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function(source, ...args) {
        if (source?.src?.includes('/assets/cards/star-card-back.webp')) window.__starCardDraw = {src: source.src, naturalWidth: source.naturalWidth, args};
        return draw.call(this, source, ...args);
      };
    });
    const page = await context.newPage(); pages.push(page);
    page.on('pageerror', error => errors.push(error.message));
    return page;
  }
  const teacher = await newPage(), actor = await newPage(), observer = await newPage();
  await teacher.goto(url);
  await teacher.locator('#teacher-tab').click();
  await teacher.locator('#teacher-key').fill(key);
  await fillNewClass(teacher, ['별이', '달이'], {pin: ['1357', '2468']});
  await teacher.locator('#teacher-form .submit').click();
  await teacher.locator('#lobby').waitFor({state: 'hidden'});
  code = [...game.store.rooms.keys()][0];
  for (const [page, nickname, pin] of [[actor, '별이', '1357'], [observer, '달이', '2468']]) {
    await page.goto(`${url}/?class=${code}`);
    await page.locator('#nickname').fill(nickname);
    await page.locator('#student-pin').fill(pin);
    await page.locator('#student-form .submit').click();
    await page.locator('#password-offer-no').waitFor({state: 'visible'});
    await page.locator('#password-offer-no').click();
    await page.locator('#lobby').waitFor({state: 'hidden'});
  }
  assert.equal(player('별이').avatar.level, 1);
  game.store.transact(() => { player('별이').inventory = [{id: 'star-card', quantity: 1}]; });
  publish();
  check('격리된 저장 교실에 교사·LV1 사용자·다른 학생 입장');
  await closeDialogs(actor);
  await actor.locator('#dock-inventory').click();
  await actor.locator('[data-item-id="star-card"] .slot-btn').click();
  await actor.locator('#bag-detail .use').click();
  await actor.locator('#use-confirm').click();
  await actor.locator('#star-card-dialog').waitFor({state: 'visible'});
  assert.equal(await actor.locator('.star-card-name').innerText(), '새로운 삶의 터전');
  assert.match(await actor.locator('.star-card-used-by').innerText(), /별이/);
  assert.match(await actor.locator('.star-card-messages').innerText(), /우주 식량 2개 지급/);
  assert.match(await actor.locator('.star-card-manual-note').innerText(), /영구 자리/);
  assert.equal(await actor.locator('.star-card-remove').isVisible(), false);
  assert.equal(player('별이').inventory.find(item => item.id === 'space-food-card').quantity, 2);
  assert.equal(player('별이').inventory.some(item => item.id === 'star-card'), false);
  assert.equal(room().starCards.length, 1);
  check('가방 → 사용 확인 → 앞면 공개, 식량 2개 자동 지급과 수동 효과 안내');
  await actor.screenshot({path: '.local/star-cards-desktop-reveal.png'});

  // Decode the actual public assets in the browser and check warm gold pixels,
  // so a successfully-loaded blue hidden PPT layer cannot pass unnoticed.
  const art = await actor.evaluate(async () => {
    const result = [];
    for (const name of ['back', 'face']) {
      const image = new Image(); image.src = `/assets/cards/star-card-${name}.webp`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 60;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, 40, 60);
      const pixels = ctx.getImageData(0, 0, 40, 60).data; let warm = 0;
      for (let n = 0; n < pixels.length; n += 4) if (pixels[n] > pixels[n + 2] + 15 && pixels[n + 1] > pixels[n + 2] + 8) warm++;
      result.push({name, width: image.naturalWidth, height: image.naturalHeight, warmRatio: warm / 2400});
    }
    return {images: result, faceBackground: getComputedStyle(document.querySelector('.star-card-face')).backgroundImage};
  });
  assert.ok(art.images.every(image => image.width > 100 && image.height > image.width && image.warmRatio > 0.15), JSON.stringify(art));
  assert.match(art.faceBackground, /star-card-face\.webp/);
  check('실제 금색 원본 앞·뒷면 이미지 디코딩과 앞면 배경 적용');

  const card = game.store.snapshot(room(), player('달이')).starCards[0];
  assert.equal(card.slot, 0); assert.equal(card.height, 90); assert.ok(Number.isFinite(card.x) && Number.isFinite(card.y));
  await approach(observer, player('달이'), card);
  await observer.waitForFunction(() => window.__starCardDraw?.naturalWidth > 0 && window.__starCardDraw.args.at(-1) === 86);
  const draw = await observer.evaluate(() => window.__starCardDraw);
    assert.deepEqual(draw.args.slice(-2), [60, 86]); // inset inside the approximately 90px card border
    // 순간 이동 fixture의 보간이 안정된 뒤 실제 물체 위 안내 좌표를 확인합니다.
    await observer.waitForTimeout(350);
    const promptPosition=await observer.evaluate(card=>{
      const canvas=document.querySelector('#world'),rect=canvas.getBoundingClientRect();
      const box=document.querySelector('#interact-prompt').getBoundingClientRect();
      return {center:box.x+box.width/2,expected:rect.x+(card.x-Number(canvas.dataset.viewX))*Number(canvas.dataset.viewScale)};
    },card);
    assert.ok(Math.abs(promptPosition.center-promptPosition.expected)<5);
  await observer.screenshot({path: '.local/star-cards-desktop-map.png'});
  await observer.keyboard.press('f');
  await observer.locator('#star-card-dialog').waitFor({state: 'visible'});
  assert.equal(await observer.locator('.star-card-name').innerText(), '새로운 삶의 터전');
  assert.match(await observer.locator('.star-card-used-by').innerText(), /별이/);
  assert.match(await observer.locator('.star-card-effect').innerText(), /자리 영구로 지정/);
  assert.equal(await observer.locator('.star-card-remove').isVisible(), false);
  check('90px 카드 지도 표시와 다른 학생의 실제 F키 열람·사용자 이름 확인');
  await observer.setViewportSize({width: 390, height: 844});
  assert.equal(await observer.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const dialogBox = await observer.locator('#star-card-dialog').boundingBox();
  assert.ok(dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= 391);
  await observer.screenshot({path: '.local/star-cards-mobile-reveal.png'});
  await closeDialogs(observer);
  await observer.screenshot({path: '.local/star-cards-mobile-map.png'});
  check('390px 모바일 열람창·지도 화면 캡처 및 가로 넘침 없음');

  const teacherPlayer = [...room().players.values()].find(p => p.role === 'teacher');
  await approach(teacher, teacherPlayer, card);
  await teacher.keyboard.press('f');
  await teacher.locator('#star-card-dialog').waitFor({state: 'visible'});
  await teacher.locator('.star-card-remove').click();
  await teacher.locator('.star-card-remove-confirm').getByRole('button', {name: '취소', exact: true}).click();
  assert.equal(room().starCards.length, 1);
  await teacher.locator('.star-card-remove').click();
  await teacher.locator('.star-card-remove-confirm').getByRole('button', {name: '종료하기', exact: true}).click();
  await teacher.locator('#star-card-dialog').waitFor({state: 'hidden'});
  assert.equal(room().starCards.length, 0);
  assert.equal(player('별이').inventory.find(item => item.id === 'space-food-card').quantity, 2);
  assert.equal(game.store.records.get(code).starCards.length, 0);
  check('교사의 삭제 취소·확정 실제 조작, 저장 반영 및 기존 보상 보존');
  assert.deepEqual(errors, []);
  await writeFile('.local/star-cards-browser-result.json', JSON.stringify({checks, errors, art, card: {x: card.x, y: card.y, slot: card.slot, height: card.height}}, null, 2));
  console.log(JSON.stringify({checks, errors}, null, 2));
} catch (error) {
  await writeFile('.local/star-cards-browser-failure.txt', `${error.stack}\n${JSON.stringify(errors)}`);
  for (const [index, page] of pages.entries()) await page.screenshot({path: `.local/star-cards-failure-${index}.png`, timeout: 3000}).catch(() => {});
  throw error;
} finally {
  if (browser) await browser.close();
  if (game) await game.close();
  assert.ok(resolve(dir).startsWith(resolve(join(tmpdir(), 'star-cards-browser-'))));
  await rm(dir, {recursive: true, force: true});
}
