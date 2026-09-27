import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import { createClassroomServer } from '../server/app.js';
import { io } from 'socket.io-client';
import { SKILL_COOLDOWN_MS } from '../shared/combat.js';

const dataDir = await mkdtemp(join(tmpdir(), 'space-auxiliary-skills-'));
const teacherKey = randomBytes(24).toString('hex');
const game = createClassroomServer({ teacherKey, studentHours: false });
const address = await game.listen();
const browser = await chromium.launch({ headless: true, args:['--no-proxy-server'], ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(8000);
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
const checks = [];
let teacher;
const check = message => { checks.push(message); console.log(`Auxiliary skills ${checks.length}: ${message}`); };

try {
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.locator('.combat-buttons').waitFor({ state: 'attached' });
  await page.evaluate(async () => {
    const { createAuxiliarySkills } = await import('/auxiliary-skills.js');
    const state = { player: { role: 'student', avatar: { level: 2 } }, canAct: true, toasts: [], iconUrls: {} };
    const instance = createAuxiliarySkills({
      getPlayer: () => state.player,
      canAct: () => state.canAct && !document.querySelector('dialog:modal'),
      toast: message => state.toasts.push(message),
      iconUrls: state.iconUrls,
    });
    state.instance = instance;
    state.group = [...document.querySelectorAll('.auxiliary-skills')].at(-1);
    state.group.dataset.verification = 'true';
    const input = document.getElementById('chat-input');
    if (!input) throw new Error('실제 채팅 입력 요소를 찾을 수 없습니다.');
    document.body.append(input);
    input.disabled = false;
    input.hidden = false;
    input.style.display = 'block';
    const button = document.createElement('button');
    button.id = 'auxiliary-skill-button-focus';
    button.textContent = 'focus target';
    const world = document.createElement('div');
    world.id = 'auxiliary-skill-world-focus';
    world.tabIndex = 0;
    document.body.append(input, button, world);
    window.__auxiliarySkillVerification = state;
    window.addEventListener('keydown', event => {
      if (/^(Digit|Numpad)[1-3]$/.test(event.code)) {
        queueMicrotask(() => { window.__lastNumberKeyPrevented = event.defaultPrevented; });
      }
    });
  });

  await page.keyboard.press('1');
  await page.keyboard.press('Numpad1');
  assert.equal(await page.locator('.auxiliary-skills[data-verification="true"] button').count(), 0);
  assert.equal(await page.evaluate(() => window.__auxiliarySkillVerification.toasts.length), 0);
  check('LV2에서는 보조 스킬 버튼과 숫자키 동작이 모두 잠김');

  await page.evaluate(() => {
    const state = window.__auxiliarySkillVerification;
    state.player.avatar.level = 3;
    state.instance.update();
  });
  assert.equal(await page.locator('.auxiliary-skills[data-verification="true"] button').count(), 1);
  await page.keyboard.press('2');
  assert.equal(await page.evaluate(() => window.__auxiliarySkillVerification.toasts.length), 0);
  await page.keyboard.down('1');
  await page.keyboard.down('1');
  await page.keyboard.up('1');
  assert.deepEqual(await page.evaluate(() => window.__auxiliarySkillVerification.toasts), ['보조 스킬은 준비 중이에요.']);
  assert.equal(await page.evaluate(() => window.__lastNumberKeyPrevented), true);
  check('LV3에서 1번만 열리고 반복 keydown은 한 번만 기존 준비 중 안내를 표시');

  await page.evaluate(() => {
    const state = window.__auxiliarySkillVerification;
    state.player.avatar.level = 4;
    state.instance.update();
  });
  assert.equal(await page.locator('.auxiliary-skills[data-verification="true"] button').count(), 2);
  await page.keyboard.press('3');
  await page.keyboard.press('Numpad2');
  assert.deepEqual(await page.evaluate(() => window.__auxiliarySkillVerification.toasts), [
    '보조 스킬은 준비 중이에요.', '보조 스킬은 준비 중이에요.',
  ]);
  check('LV4에서 1·2번만 동작하고 잠긴 3번 키는 무시');

  await page.evaluate(() => {
    const state = window.__auxiliarySkillVerification;
    state.player.avatar.level = 5;
    state.instance.update();
  });
  assert.equal(await page.locator('.auxiliary-skills[data-verification="true"] button').count(), 2);
  await page.keyboard.press('1');
  await page.keyboard.press('Numpad2');
  await page.keyboard.press('3');
  await page.locator('.auxiliary-skills[data-verification="true"] button').nth(1).evaluate(button => button.click());
  assert.equal(await page.evaluate(() => window.__auxiliarySkillVerification.toasts.length), 5);
  assert.ok((await page.evaluate(() => window.__auxiliarySkillVerification.toasts)).every(message => message === '보조 스킬은 준비 중이에요.'));
  check('LV5의 숫자열·숫자패드와 2번 버튼 클릭(3번 제거)이 같은 안내 경로로 연결');

  await page.evaluate(() => {
    const dialog = document.createElement('dialog');
    dialog.id = 'auxiliary-skill-modal-check';
    document.body.append(dialog);
    dialog.showModal();
  });
  await page.keyboard.press('2');
  await page.evaluate(() => document.getElementById('auxiliary-skill-modal-check').close());
  const input = page.locator('#chat-input');
  await input.focus();
  await page.keyboard.press('3');
  assert.equal(await input.inputValue(), '3');
  await page.locator('#auxiliary-skill-button-focus').focus();
  await page.keyboard.press('2');
  await page.evaluate(() => { window.__auxiliarySkillVerification.canAct = false; });
  await page.locator('#auxiliary-skill-world-focus').focus();
  await page.keyboard.press('1');
  assert.equal(await page.evaluate(() => window.__auxiliarySkillVerification.toasts.length), 5);
  assert.deepEqual(pageErrors, []);
  check('모달·채팅 입력·버튼 포커스·행동 불가 상태에서는 키 입력을 가로채지 않음');

  // URL 설정은 효과 호출 없이 각 슬롯의 그림만 갱신합니다.
  await page.evaluate(() => {
    const state = window.__auxiliarySkillVerification;
    state.iconUrls.example = [0, 1, 2].map(slot => `/favicon.svg?skill-slot=${slot}`);
    state.player.avatar.constellationId = 'example';
    state.instance.update();
  });
  await page.waitForFunction(() => [document.getElementById('touch-skill'), ...window.__auxiliarySkillVerification.group.children]
    .every(button => !button.querySelector('img').hidden && button.querySelector('img').naturalWidth > 0));
  assert.deepEqual(await page.evaluate(() => [document.getElementById('touch-skill'), ...window.__auxiliarySkillVerification.group.children]
    .map(button => button.querySelector('img').getAttribute('src'))), [0, 1, 2].map(slot => `/favicon.svg?skill-slot=${slot}`));
  await page.evaluate(() => {
    const state = window.__auxiliarySkillVerification;
    state.iconUrls.example[0] = '/missing-skill-icon-for-verification.png';
    state.instance.update();
  });
  await page.waitForFunction(() => {
    const image = document.querySelector('#touch-skill img');
    return image.complete && !image.naturalWidth && image.hidden && !document.querySelector('#touch-skill .combat-slot-placeholder').hidden;
  });
  check('캐릭터별 E·보조1·2 URL 연결 및 없는 그림의 빈 슬롯 복원');
  await page.close();

  // 여기부터는 별도 UI 인스턴스 없이 실제 앱 로그인과 소켓 요청을 확인합니다.
  const skillRequests = [];
  game.io.on('connection', socket => socket.onAny(event => {
    if (event === 'combat:skill') skillRequests.push(socket.id);
  }));
  teacher = io(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], reconnection: false });
  await new Promise((resolve, reject) => { teacher.once('connect', resolve); teacher.once('connect_error', reject); });
  const created = await teacher.timeout(5000).emitWithAck('room:create', { teacherKey, allowedNames: ['아이콘검사'] });
  assert.equal(created.ok, true);
  const live = await browser.newPage({ viewport: { width: 1440, height: 960 }, hasTouch: true });
  live.setDefaultTimeout(10000);
  live.on('pageerror', error => pageErrors.push(error.message));
  await live.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await live.locator('#join-code').fill(created.room.code);
  await live.locator('#nickname').fill('아이콘검사');
  await live.locator('#student-pin').fill('1234');
  await live.locator('#student-form .submit').click();
  await live.locator('#lobby').waitFor({ state: 'hidden' });
  const room = game.store.rooms.get(created.room.code);
  const actor = [...room.players.values()].find(player => player.nickname === '아이콘검사');
  const publish = () => game.io.to(actor.socketId).emit('room:state', game.store.snapshot(room, actor));
  const setLevel = async (level, role = 'student') => {
    actor.role = role;
    actor.avatar = { ...actor.avatar, level, form: level >= 2 ? 'constellation' : 'asteroid', constellationId: level >= 2 ? 'aries' : null };
    publish();
    await live.waitForFunction(({ level, role }) => {
      const expected = role === 'teacher' ? 2 : Math.max(0, Math.min(2, level - 2));
      return document.querySelectorAll('.auxiliary-skill').length === expected &&
        document.getElementById('touch-skill').disabled === (level < 2 && role !== 'teacher');
    }, { level, role });
    await live.locator('#world').focus();
  };
  const skillAction = async action => {
    await live.waitForTimeout(SKILL_COOLDOWN_MS + 80);
    const before = skillRequests.length;
    await action();
    const deadline = Date.now() + 4000;
    while (skillRequests.length === before && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(skillRequests.length, before + 1);
  };
  await setLevel(1);
  await live.keyboard.press('e');
  await live.locator('#toast').filter({ hasText: '특수 공격은 LV2부터' }).waitFor();
  const lockedBox = await live.locator('#touch-skill').boundingBox();
  await live.touchscreen.tap(lockedBox.x + lockedBox.width / 2, lockedBox.y + lockedBox.height / 2);
  assert.equal(skillRequests.length, 0);
  assert.equal(await live.locator('#touch-skill .combat-slot-lock').isVisible(), true);
  await mkdir('.local', { recursive: true });
  await live.locator('#toast').waitFor({ state: 'hidden' });
  await live.screenshot({ path: '.local/260-skills-lv1-desktop.png' });
  check('실제 앱 LV1 E 잠금 표시·키보드·터치 모두 서버 요청 0건');
  await setLevel(2);
  await skillAction(() => live.keyboard.press('e'));
  await skillAction(() => live.locator('#touch-skill').tap());
  assert.equal(await live.locator('#touch-skill .combat-slot-lock').isVisible(), false);
  check('실제 앱 LV2 E 해금 후 키보드·터치가 기존 스킬 요청으로 각각 1회 연결');
  await setLevel(1, 'teacher');
  await skillAction(() => live.keyboard.press('e'));
  check('교사는 LV1 상태에서도 E 허용');

  await live.evaluate(() => {
    window.__auxiliaryClicks = [];
    document.querySelector('.auxiliary-skills').addEventListener('click', event => {
      const button = event.target.closest('button');
      if (button) window.__auxiliaryClicks.push(button.dataset.skillSlot);
    });
  });
  for (const level of [2, 3, 4, 5]) {
    await setLevel(level);
    await live.evaluate(() => { window.__auxiliaryClicks = []; });
    for (const key of ['1', '2', '3']) await live.keyboard.press(key);
    assert.deepEqual(await live.evaluate(() => window.__auxiliaryClicks), Array.from({ length: Math.max(0, Math.min(2, level - 2)) }, (_, index) => `auxiliary-${index + 1}`));
  }
  await live.evaluate(() => { window.__auxiliaryClicks = []; });
  for (const key of ['Numpad1', 'Numpad2', 'Numpad3']) await live.keyboard.press(key);
  assert.deepEqual(await live.evaluate(() => window.__auxiliaryClicks), ['auxiliary-1', 'auxiliary-2']);
  check('실제 앱 LV3·4에서 보조1·2 해금, LV5도 최대2개·같은 버튼 클릭 경로');

  await live.locator('#toast').waitFor({ state: 'hidden' });
  const frame = () => live.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  for (const [width, height] of [[1440, 960], [390, 844]]) {
    await live.setViewportSize({ width, height });
    await frame();
    const geometry = await live.evaluate(async () => {
      const selectors = ['.combat-buttons', '#touch-attack', '#touch-skill', '#vitals-hud', '#joystick', '#touch-interact'];
      const boxes = () => selectors.map(selector => {
        const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
        return { x, y, width, height };
      });
      const after = boxes();
      const sheet = [...document.styleSheets].find(sheet => sheet.href?.endsWith('/style.css'));
      const start = [...sheet.cssRules].findIndex(rule => rule.style?.getPropertyValue('--key-size'));
      if (start < 0) throw new Error('슬롯 스타일 경계를 찾을 수 없습니다.');
      const rules = [...sheet.cssRules].slice(start).map(rule => rule.cssText);
      while (sheet.cssRules.length > start) sheet.deleteRule(start);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const before = boxes();
      for (const rule of rules) sheet.insertRule(rule, sheet.cssRules.length);
      return { before, after };
    });
    for (let index = 0; index < geometry.before.length; index++) for (const prop of ['x', 'y', 'width', 'height']) {
      assert.ok(Math.abs(geometry.before[index][prop] - geometry.after[index][prop]) < 1, `${width}px 기존 조작·체력 ${index} ${prop} 보존`);
    }
    await frame();
    const slots = await live.evaluate(() => [...document.querySelectorAll('.combat-buttons button')].map(button => {
      const box = button.getBoundingClientRect(), badge = button.querySelector('.combat-key-badge').getBoundingClientRect();
      return { width: box.width, height: box.height, round: getComputedStyle(button).borderRadius,
        label: button.getAttribute('aria-label'), badgeRound: getComputedStyle(button.querySelector('.combat-key-badge')).borderRadius,
        badgeOverlaps: badge.left > box.left + box.width / 2 && badge.top > box.top + box.height / 2 && badge.right > box.right && badge.bottom > box.bottom,
        onScreen: badge.left >= 0 && badge.right <= innerWidth && badge.bottom <= innerHeight };
    }));
    assert.equal(slots.length, 4);
    assert.equal(slots[0].width, width === 390 ? 44 : 84);
    assert.equal(slots[0].width, slots[1].width);
    assert.ok(slots.every(slot => slot.width === slot.height && slot.round === '50%' && slot.badgeRound === '50%' && slot.label && slot.badgeOverlaps && slot.onScreen));
    assert.equal(await live.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await live.screenshot({ path: `.local/260-skills-${width}.png` });
    const region = await live.locator('.combat-buttons').boundingBox();
    await live.screenshot({ path: `.local/260-skills-${width}-detail.png`, clip: { x: 0, y: Math.max(0, region.y - 100), width: Math.min(width, 460), height: Math.min(height - Math.max(0, region.y - 100), 250) } });
    check(`${width}px 실제 화면: Q/E 동일 크기·4개 우하단 원형 배지·조작/체력 위치 크기 보존`);
  }
  assert.deepEqual(pageErrors, []);

  await mkdir('.local', { recursive: true });
  await writeFile('.local/auxiliary-skills-browser-result.json', JSON.stringify({ checks, pageErrors }, null, 2));
  console.log(JSON.stringify({ checks, pageErrors }, null, 2));
} catch (error) {
  await mkdir('.local', { recursive: true });
  await writeFile('.local/auxiliary-skills-browser-failure.txt', `${error.stack}\n${JSON.stringify(pageErrors)}`);
  throw error;
} finally {
  teacher?.disconnect();
  await browser.close();
  await game.close();
  await rm(dataDir, { recursive: true, force: true });
}
