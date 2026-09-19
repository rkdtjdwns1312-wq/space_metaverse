import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createClassroomServer } from '../server/app.js';
import { fillNewClass } from './class-setup.mjs';
import { MAP, PLAZA_ID, STREET_ID } from '../shared/config.js';

const key = 'chat-window-browser-fixture-key';
const game = createClassroomServer({ teacherKey: key, studentHours: false });
const address = await game.listen();
const url = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
const checks = [], errors = [];
const check = text => { checks.push(text); console.log(`Chat window ${checks.length}: ${text}`); };
const contexts = [];

async function page(viewport = { width: 1440, height: 960 }) {
  const context = await browser.newContext({ viewport });
  contexts.push(context);
  context.setDefaultTimeout(10000);
  const p = await context.newPage();
  p.on('pageerror', error => errors.push(error.message));
  return p;
}
async function openChat(p) {
  if (!(await p.locator('#chat-dialog').isVisible())) {
    await p.locator('#chat-window-toggle').click();
  }
  await p.locator('#chat-dialog').waitFor({ state: 'visible' });
}
async function push(room, player, text, channel = 'map') {
  const msg = game.store.pushChat(room, { playerId: player.id, nickname: player.nickname, role: player.role, text, flagged: false, channel, ...(channel === 'map' ? { mapId: player.mapId } : {}) });
  for (const recipient of room.players.values()) {
    if (!recipient.connected || (channel === 'map' && recipient.mapId !== msg.mapId)) continue;
    const socket = game.io.sockets.sockets.get(recipient.socketId);
    if (socket) socket.emit('chat:message', msg);
  }
}

try {
  const teacher = await page();
  const one = await page();
  const two = await page();
  for (const p of [teacher, one, two]) await p.goto(url, { waitUntil: 'domcontentloaded' });
  await teacher.locator('#teacher-tab').click();
  await teacher.locator('#teacher-key').fill(key);
  await fillNewClass(teacher, ['1', '2']);
  await teacher.locator('#teacher-form .submit').click();
  await teacher.locator('#lobby').waitFor({ state: 'hidden' });
  const room = [...game.store.rooms.values()][0];
  for (const [p, name] of [[one, '1'], [two, '2']]) {
    await p.locator('#join-code').fill(room.code);
    await p.locator('#nickname').fill(name);
    await p.locator('#student-pin').fill('1234');
    await p.locator('#student-form .submit').click();
    await p.locator('#lobby').waitFor({ state: 'hidden' });
  }
  const p1 = [...room.players.values()].find(p => p.nickname === '1');
  const p2 = [...room.players.values()].find(p => p.nickname === '2');

  await openChat(one);
  assert.equal(await one.locator('#chat-dialog').getAttribute('open'), '');
  assert.equal(await one.locator('#chat-dialog').evaluate(el => el.matches(':modal')), false);
  assert.equal(await one.locator('#chat-dialog').getAttribute('data-size'), '2');
  await one.locator('#chat-shrink').click();
  assert.equal(await one.locator('#chat-dialog').getAttribute('data-size'), '1');
  await one.locator('#chat-grow').click(); await one.locator('#chat-grow').click();
  assert.equal(await one.locator('#chat-dialog').getAttribute('data-size'), '3');
  await one.locator('#chat-window-close').click(); await openChat(one);
  assert.equal(await one.locator('#chat-dialog').getAttribute('data-size'), '3');
  check('왼쪽 위 토글이 비모달 채팅을 열고 크기 1~3과 같은 입장 중 재열림을 유지');

  await one.locator('#world').focus();
  const beforeMove = { x: p1.x, y: p1.y };
  await one.keyboard.down('d'); await one.waitForTimeout(250); await one.keyboard.up('d');
  assert.ok(p1.x > beforeMove.x, '채팅을 연 상태에서도 세계 이동');
  const moved = { x: p1.x, y: p1.y };
  await one.locator('#chat-input').fill('wasdqef');
  await one.waitForTimeout(150);
  assert.deepEqual({ x: p1.x, y: p1.y }, moved, '입력창 타이핑은 이동하지 않음');
  check('채팅을 연 상태의 WASD 이동과 입력창 타이핑의 이동 차단');

  await one.locator('#chat-input').fill('첫 대화'); await one.locator('#chat-send').click();
  await two.locator('#chat-window-toggle').click();
  await two.locator('#chat-log').filter({ hasText: '첫 대화' }).waitFor();
  const gate = MAP.objects.find(o => o.kind === 'gate' && o.target === STREET_ID);
  Object.assign(p1, { mapId: PLAZA_ID, x: gate.x, y: gate.y });
  game.io.sockets.sockets.get(p1.socketId).emit('room:state', game.store.snapshot(room, p1));
  await one.locator('#interact-prompt').waitFor({ state: 'visible' });
  await one.locator('#world').click({ position: { x: 800, y: 700 } }); await one.keyboard.down('f'); await one.keyboard.up('f');
  const mapStarted = Date.now();
  while (Date.now() - mapStarted < 10000 && p1.mapId !== STREET_ID) await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(p1.mapId, STREET_ID);
  assert.equal(await one.locator('#chat-dialog').getAttribute('data-size'), '3');
  await one.locator('#chat-log').filter({ hasText: '첫 대화' }).waitFor();
  check('실제 문 근처 F 맵 전환 뒤 채팅창 크기와 이전 대화 유지');

  const oldVisible = await one.locator('#chat-log li').count();
  await push(room, p2, '다른 맵의 글');
  await one.waitForTimeout(200);
  assert.equal(await one.locator('#chat-log li').filter({ hasText: '다른 맵의 글' }).count(), 0);
  p2.mapId = p1.mapId;
  await push(room, p2, '같은 맵의 새 글');
  await one.locator('#chat-log').filter({ hasText: '같은 맵의 새 글' }).waitFor();
  assert.ok(await one.locator('#chat-log li').count() >= oldVisible);
  check('다른 맵 메시지는 차단되고 같은 맵 메시지는 서버 push로 수신');

  for (let i = 0; i < 12; i++) await push(room, p2, `기록 ${String(i).padStart(2, '0')}`);
  await one.locator('#chat-log').filter({ hasText: '기록 11' }).waitFor();
  const last = one.locator('#chat-log li').last();
  assert.match(await last.innerText(), /기록 11/);
  await one.locator('#chat-log').evaluate(el => { el.scrollTop = 0; });
  await push(room, p2, '스크롤 뒤 새 글');
  await one.locator('#chat-latest').waitFor({ state: 'visible' });
  await one.locator('#chat-latest').click();
  assert.ok(await one.locator('#chat-log').evaluate(el => el.scrollTop + el.clientHeight >= el.scrollHeight - 4));
  check('오래된 글이 위, 새 글이 아래이며 스크롤백 보존과 최신 글 버튼 동작');

  await teacher.locator('#chat-window-toggle').click();
  await teacher.locator('#chat-toggle').count();
  await teacher.locator('#dock-chat').click(); await teacher.locator('#open-chat').click();
  assert.equal(await teacher.locator('#chat-toggle').isVisible(), true);
  check('교사 채팅 토글 권한 UI가 기존 위치에서 유지');

  await teacher.screenshot({ path: '.local/183-chat-desktop.png', fullPage: true });
  await one.setViewportSize({ width: 390, height: 844 });
  await one.locator('#chat-shrink').click(); await one.locator('#chat-shrink').click();
  const mobileSizes = [await one.locator('#chat-dialog').boundingBox()];
  await one.locator('#chat-grow').click(); mobileSizes.push(await one.locator('#chat-dialog').boundingBox());
  await one.locator('#chat-grow').click(); mobileSizes.push(await one.locator('#chat-dialog').boundingBox());
  assert.ok(mobileSizes[0].height < mobileSizes[1].height && mobileSizes[1].height < mobileSizes[2].height, '모바일 채팅 크기가 단조 증가');
  const chatBox = await one.locator('#chat-dialog').boundingBox();
  const attackBox = await one.locator('.combat-buttons').boundingBox();
  const joystickBox = await one.locator('#joystick').boundingBox();
  assert.ok(chatBox.y + chatBox.height + 8 <= Math.min(attackBox.y, joystickBox.y), '모바일 채팅 하단이 공격 버튼·조이스틱보다 위');
  check('390×844에서 크기 1→2→3 단조 증가와 공격 버튼·조이스틱 상단 간격 확인');
  await one.screenshot({ path: '.local/183-chat-mobile.png', fullPage: true });
  assert.ok(await one.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (const id of ['#chat-window-toggle', '#chat-shrink', '#chat-window-close', '#chat-input', '#chat-send']) assert.ok(await one.locator(id).isEnabled(), id);
  assert.equal(await one.locator('#chat-grow').isDisabled(), true);
  check('1440px·390px 화면 캡처와 버튼 접근성·가로 넘침 확인');
  assert.deepEqual(errors, []);
  await writeFile('.local/183-chat-report.json', JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (error) {
  await writeFile('.local/183-chat-report.json', JSON.stringify({ checks, errors, failure: error.stack }, null, 2));
  throw error;
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser.close();
  await game.close();
}
