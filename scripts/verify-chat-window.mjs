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
async function push(room, player, text, channel = 'map', details = {}) {
  const msg = game.store.pushChat(room, { playerId: player.id, nickname: player.nickname, role: player.role, text, flagged: false, channel, ...(channel === 'map' ? { mapId: player.mapId } : {}), ...details });
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
    if(await p.locator('#password-offer-dialog').evaluate(dialog=>dialog.open))await p.locator('#password-offer-no').click();
    if(await p.locator('#tutorial-dialog').evaluate(dialog=>dialog.open))await p.locator('#tutorial-later').click();
  }
  const p1 = [...room.players.values()].find(p => p.nickname === '1');
  const p2 = [...room.players.values()].find(p => p.nickname === '2');

  await openChat(one);
  assert.equal(await one.locator('#chat-dialog').getAttribute('open'), '');
  assert.equal(await one.locator('#chat-dialog').evaluate(el => el.matches(':modal')), false);
  assert.equal(await one.locator('#chat-dialog').getAttribute('data-size'), '3');
  await one.locator('#chat-shrink').click();
  assert.equal(await one.locator('#chat-dialog').getAttribute('data-size'), '2');
  await one.locator('#chat-grow').click(); await one.locator('#chat-grow').click();
  assert.equal(await one.locator('#chat-dialog').getAttribute('data-size'), '4');
  await one.locator('#chat-window-close').click(); await openChat(one);
  assert.equal(await one.locator('#chat-dialog').getAttribute('data-size'), '4');
  check('왼쪽 위 토글이 비모달 채팅을 열고 기본 크기 3과 크기 1~5 조절·재열림을 유지');

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
  assert.equal(await one.locator('#chat-dialog').getAttribute('data-size'), '4');
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

  await push(room,p2,'행성 탭 확인','department',{departmentId:p2.departmentId});
  await push(room,p2,'귓속말 탭 확인','direct',{targetId:p1.id});
  await one.locator('#chat-log li.channel-department').filter({hasText:'행성 탭 확인'}).waitFor();
  await one.locator('#chat-log li.channel-direct').filter({hasText:'귓속말 탭 확인'}).waitFor();
  assert.equal(await one.locator('#chat-log li.channel-map .text').first().evaluate(el=>getComputedStyle(el).color),'rgb(36, 32, 43)');
  assert.equal(await one.locator('#chat-log li.channel-department .text').first().evaluate(el=>getComputedStyle(el).color),'rgb(32, 107, 62)');
  assert.equal(await one.locator('#chat-log li.channel-direct .text').first().evaluate(el=>getComputedStyle(el).color),'rgb(107, 112, 37)');
  await one.locator('[data-chat-tab="department"]').click();
  assert.equal(await one.locator('#chat-log li.channel-direct').count(),0);
  await one.locator('[data-chat-tab="direct"]').click();
  assert.equal(await one.locator('#chat-log li.channel-department').count(),0);
  await one.locator('[data-chat-tab="map"]').click();
  check('전체는 세 종류를 모두 보여주고 행성·귓속말 탭은 각각 분리하며 글자색을 구분');

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
  assert.equal(await teacher.locator('#chat-toggle').isVisible(), false);
  assert.equal(await teacher.locator('#chat-clear').isVisible(), false);
  check('채팅 끄기·지우기 버튼과 여백 제거');

  await teacher.screenshot({ path: '.local/183-chat-desktop.png', fullPage: true });
  await one.setViewportSize({ width: 390, height: 844 });
  await one.locator('#chat-shrink').click(); await one.locator('#chat-shrink').click();
  const mobileSizes = [await one.locator('#chat-dialog').boundingBox()];
  await one.locator('#chat-grow').click(); mobileSizes.push(await one.locator('#chat-dialog').boundingBox());
  await one.locator('#chat-grow').click(); mobileSizes.push(await one.locator('#chat-dialog').boundingBox());
  assert.ok(mobileSizes[0].height < mobileSizes[1].height && mobileSizes[1].height < mobileSizes[2].height, '모바일 채팅 크기가 단조 증가');
  const chatBox = await one.locator('#chat-dialog').boundingBox();
  assert.ok(chatBox.y+chatBox.height<=844,'모바일에서 채팅창이 화면 높이를 벗어나지 않음');
  check('390×844에서 크기 2→3→4 단조 증가와 화면 안 표시 확인');
  await one.screenshot({ path: '.local/183-chat-mobile.png', fullPage: true });
  assert.ok(await one.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (const id of ['#chat-window-toggle', '#chat-shrink', '#chat-window-close', '#chat-input', '#chat-send']) assert.ok(await one.locator(id).isEnabled(), id);
  assert.equal(await one.locator('#chat-grow').isEnabled(), true);
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
