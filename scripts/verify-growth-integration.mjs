import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createClassroomServer } from '../server/app.js';
import { createAvatar, VALLEY, VALLEY_ID } from '../shared/config.js';

const game = createClassroomServer({ teacherKey: 'growth-browser-private-key', studentHours: false });
const address = await game.listen(), url = 'http://127.0.0.1:' + address.port;
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
const checks = [], errors = [];
const check = value => { checks.push(value); console.log(value); };
await mkdir('.local', { recursive: true });

try {
  const teacher = await browser.newPage();
  await teacher.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await teacher.locator('#teacher-tab').click();
  await teacher.locator('#teacher-key').fill('growth-browser-private-key');
  await teacher.locator('#allowed-names').fill('1');
  await teacher.locator('#teacher-form .submit').click();
  await teacher.locator('#lobby').waitFor({ state: 'hidden' });
  const room = [...game.store.rooms.values()][0];

  const student = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  student.on('pageerror', error => errors.push(error.message));
  await student.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await student.locator('#join-code').fill(room.code);
  await student.locator('#nickname').fill('1');
  await student.locator('#student-pin').fill('1234');
  await student.locator('#student-form .submit').click();
  await student.locator('#lobby').waitFor({ state: 'hidden' });
  const player = [...room.players.values()].find(value => value.role === 'student');
  const growthStar = VALLEY.objects.find(value => value.id === 'growth-star');
  const evolutionStar = VALLEY.objects.find(value => value.id === 'evolution-star');
  const publish = () => game.io.to(player.socketId).emit('room:state', game.store.snapshot(room, player));

  Object.assign(player, { mapId: VALLEY_ID, x: growthStar.x, y: growthStar.y, starShards: 5, avatar: createAvatar() }); publish();
  await student.locator('#interact-object').filter({ hasText: '성장의 별' }).waitFor();
  await student.locator('#touch-interact').tap();
  await student.locator('#growth-dialog').waitFor({ state: 'visible' });
  await student.locator('#growth-info').filter({ hasText: '구매 가능5 XP' }).waitFor();
  await student.waitForFunction(() => Boolean(document.querySelector('link[data-star-ui-style]')));
  assert.equal(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  check('실제 앱 E 상호작용·동적 CSS·390px 성장 창');

  await student.locator('#growth-amount').fill('99');
  assert.equal(await student.locator('#growth-amount').inputValue(), '5');
  await student.locator('#growth-buy').tap();
  await student.locator('#growth-error').filter({ hasText: '별 파편' }).waitFor();
  assert.deepEqual({ level: player.avatar.level, xp: player.avatar.xp, balance: player.starShards }, { level: 1, xp: 5, balance: 0 });
  check('실제 소켓 성장 구매 cap·별 파편 차감·자동 진화 없음');

  await student.locator('#growth-close').tap();
  Object.assign(player, { x: evolutionStar.x, y: evolutionStar.y, avatar: { ...createAvatar(), xp: 15 } }); publish();
  await student.locator('#interact-object').filter({ hasText: '진화의 별' }).waitFor();
  await student.locator('#touch-interact').tap();
  await student.locator('#evolution-evolve').tap();
  await student.locator('[data-constellation-id="aries"]').tap();
  await student.locator('#evolution-confirm-text').filter({ hasText: '정말 진화하시겠습니까?' }).waitFor();
  await student.locator('#evolution-no').tap();
  assert.deepEqual({ level: player.avatar.level, xp: player.avatar.xp, constellationId: player.avatar.constellationId }, { level: 1, xp: 15, constellationId: null });
  check('실제 앱 진화 아니오에서 서버 mutation 0건');

  await student.locator('#evolution-evolve').tap();
  await student.locator('[data-constellation-id="aries"]').tap();
  await student.locator('#evolution-yes').tap();
  await student.locator('#evolution-summary').filter({ hasText: 'LV2' }).waitFor();
  assert.deepEqual({ level: player.avatar.level, xp: player.avatar.xp, form: player.avatar.form, constellationId: player.avatar.constellationId },
    { level: 2, xp: 0, form: 'constellation', constellationId: 'aries' });
  check('실제 소켓 첫 별자리 선택·확인·한 단계 진화');

  await student.locator('#evolution-change').tap();
  await student.locator('#evolution-grid .constellation-choice').first().waitFor();
  assert.equal(await student.locator('#evolution-grid .constellation-choice').count(), 16);
  const columns = await student.locator('#evolution-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  assert.equal(columns, 4);
  assert.equal(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await student.screenshot({ path: '.local/growth-evolution-integration-mobile.png' });
  check('실제 앱 LV2 변경 화면 390px·별자리 16개·4열·가로 넘침 없음');

  await student.locator('#evolution-header-close').tap();
  await student.setViewportSize({ width: 1440, height: 960 });
  Object.assign(player, { x: (growthStar.x + evolutionStar.x) / 2, y: evolutionStar.y }); publish();
  await student.locator('#minimap-title').filter({ hasText: '은하수계곡' }).waitFor();
  assert.equal(await student.locator('#evolution-dialog').isVisible(), false);
  assert.deepEqual(VALLEY.objects.filter(value => value.kind === 'evolution' || value.kind === 'growth').map(value => value.id), ['evolution-star', 'growth-star']);
  await student.screenshot({ path: '.local/growth-evolution-valley-desktop.png' });
  check('실제 앱 1440px 창 닫기·은하수계곡 진화의 별과 성장의 별 화면');
  assert.deepEqual(errors, []);
} finally {
  await writeFile('.local/growth-integration-result.json', JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
  await game.close();
}
console.log(JSON.stringify({ count: checks.length, errors }));
