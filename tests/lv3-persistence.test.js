import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {SHOP, STREET, STREET_ID} from '../shared/config.js';
import {weekStart} from '../server/temple.js';

const KEY = 'lv3-persistence-tests-private-key';
const NOW = Date.parse('2026-09-21T03:00:00Z');
const call = (socket, event, data = {}) => socket.timeout(5000).emitWithAck(event, data);

async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lv3-persistence-'));
  let game, url, closed = false;
  const sockets = [];
  const start = async () => {
    game = createClassroomServer({teacherKey: KEY, dataDir: dir, studentHours: false, unattended: false,
      teacherManagedAccounts: false, clock: () => NOW, craftingRecipes: []});
    const address = await game.listen(); url = `http://127.0.0.1:${address.port}`; closed = false;
  };
  await start();
  t.after(async () => {
    for (const socket of sockets) socket.disconnect();
    if (!closed) await game.close();
    fs.rmSync(dir, {recursive: true, force: true});
  });
  return {get game() { return game; }, get url() { return url; }, dir,
    async connect() {
      const socket = io(url, {transports: ['websocket'], reconnection: false, forceNew: true}); sockets.push(socket);
      await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
      return socket;
    },
    async restart() { await game.close(); closed = true; await start(); }
  };
}

async function classroom(f) {
  const teacher = await f.connect();
  const result = await call(teacher, 'room:create', {teacherKey: KEY, title: 'LV3 저장 검증', allowedNames: ['1', '2', '3']});
  assert.equal(result.ok, true, result.error);
  return {teacher, code: result.room.code};
}

const join = (socket, code, nickname) => call(socket, 'room:join', {code, nickname, pin: '1234'});
function positionAtShop(f, code, ids) {
  const room = f.game.store.rooms.get(code), shop = STREET.objects.find(object => object.kind === 'shop');
  assert.ok(shop);
  f.game.store.transact(() => {
    for (const id of ids) {
      const player = room.players.get(id);
      player.avatar.level = 3;
      player.mapId = STREET_ID; player.x = shop.x; player.y = shop.y + shop.radius + 1;
      player.starShards = 800;
    }
  });
}

test('LV3 purchase/use logs, permanent markers and cluster/supernova state survive socket-server restart', async t => {
  const f = await fixture(t), {teacher, code} = await classroom(f);
  const aSocket = await f.connect(), bSocket = await f.connect(), cSocket = await f.connect();
  const a = await join(aSocket, code, '1'), b = await join(bSocket, code, '2'), c = await join(cSocket, code, '3');
  assert.ok(a.ok && b.ok && c.ok);
  positionAtShop(f, code, [a.selfId, b.selfId, c.selfId]);

  for (const itemId of ['space-station-card', 'galaxy-cluster-card', 'supernova-alpha-card']) {
    const bought = await call(aSocket, 'shop:buy', {itemId, quantity: 1});
    assert.equal(bought.ok, true, bought.error);
  }
  let room = f.game.store.rooms.get(code), actor = room.players.get(a.selfId);
  assert.deepEqual(actor.lv3State.clusterNextAt, [NOW + 7 * 86_400_000]);
  assert.deepEqual(actor.lv3State.supernovaUsed, {});

  const save = f.game.store.files.save.bind(f.game.store.files);
  f.game.store.files.save = () => { throw new Error('simulated LV3 storage failure'); };
  try {
    const failed = await call(aSocket, 'item:use', {itemId: 'space-station-card', targetIds: [b.selfId, c.selfId]});
    assert.equal(failed.ok, false); assert.match(failed.error, /저장/);
    room = f.game.store.rooms.get(code); actor = room.players.get(a.selfId);
    assert.equal(actor.inventory.find(item => item.id === 'space-station-card').quantity, 1);
    assert.equal(room.players.get(b.selfId).cardMarkers.length, 0);
    assert.equal(room.players.get(c.selfId).cardMarkers.length, 0);
    assert.equal(room.itemLog.length, 0);
  } finally { f.game.store.files.save = save; }

  const used = await call(aSocket, 'item:use', {itemId: 'space-station-card', targetIds: [b.selfId, c.selfId]});
  assert.equal(used.ok, true, used.error);
  room = f.game.store.rooms.get(code);
  for (const id of [b.selfId, c.selfId]) {
    const marker = room.players.get(id).cardMarkers.find(entry => entry.itemId === 'space-station-card');
    assert.ok(marker); assert.equal(marker.until, null);
  }
  assert.equal(room.itemLog.at(-1).itemId, 'space-station-card');

  const rabbit = SHOP.items.find(item => item.id === 'rabbit-princess-card');
  assert.ok(rabbit && Number.isSafeInteger(rabbit.price));
  const discountedCost = Math.floor(rabbit.price / 2);

  // Insufficient balance is rejected before the weekly supernova opportunity is consumed.
  f.game.store.transact(() => { f.game.store.rooms.get(code).players.get(a.selfId).starShards = discountedCost - 1; });
  const poor = await call(aSocket, 'shop:buy', {itemId: rabbit.id, quantity: 1});
  assert.equal(poor.ok, false); assert.match(poor.error, /별 파편이 부족/);
  actor = f.game.store.rooms.get(code).players.get(a.selfId);
  assert.deepEqual(actor.lv3State.supernovaUsed, {});

  // A full bag is also rejected before discounts are committed; use only known catalog IDs.
  f.game.store.transact(() => {
    actor = f.game.store.rooms.get(code).players.get(a.selfId);
    actor.starShards = 800;
    const ids = new Set(actor.inventory.map(item => item.id));
    const fillers = SHOP.items.filter(item => item.id !== rabbit.id && !ids.has(item.id));
    while (actor.inventory.length < SHOP.maxKinds) {
      const item = fillers.shift(); assert.ok(item, 'catalog needs enough distinct valid items to fill the bag');
      ids.add(item.id); actor.inventory.push({id: item.id, quantity: 1});
    }
  });
  const full = await call(aSocket, 'shop:buy', {itemId: rabbit.id, quantity: 1});
  assert.equal(full.ok, false); assert.match(full.error, /가방이 가득/);
  actor = f.game.store.rooms.get(code).players.get(a.selfId);
  assert.deepEqual(actor.lv3State.supernovaUsed, {});

  f.game.store.transact(() => {
    actor = f.game.store.rooms.get(code).players.get(a.selfId);
    actor.inventory.pop();
  });
  actor = f.game.store.rooms.get(code).players.get(a.selfId);
  const balanceBeforeFailedSave = actor.starShards;
  const savePurchase = f.game.store.files.save.bind(f.game.store.files);
  f.game.store.files.save = () => { throw new Error('simulated discounted-purchase write failure'); };
  try {
    const failedSave = await call(aSocket, 'shop:buy', {itemId: rabbit.id, quantity: 1});
    assert.equal(failedSave.ok, false); assert.match(failedSave.error, /저장/);
  } finally { f.game.store.files.save = savePurchase; }
  actor = f.game.store.rooms.get(code).players.get(a.selfId);
  assert.equal(actor.starShards, balanceBeforeFailedSave);
  assert.equal(actor.inventory.some(item => item.id === rabbit.id), false);
  assert.deepEqual(actor.lv3State.supernovaUsed, {});

  const purchased = await call(aSocket, 'shop:buy', {itemId: rabbit.id, quantity: 1});
  assert.equal(purchased.ok, true, purchased.error);
  assert.equal(purchased.discounted, 1); assert.equal(purchased.cost, discountedCost);
  assert.deepEqual(f.game.store.rooms.get(code).players.get(a.selfId).lv3State.supernovaUsed,
    {'supernova-alpha-card': weekStart(NOW)});

  const persisted = JSON.parse(fs.readFileSync(path.join(f.dir, `${code}.json`), 'utf8'));
  const savedActor = persisted.students.find(student => student.id === a.selfId);
  assert.deepEqual(savedActor.lv3State.clusterNextAt, [NOW + 7 * 86_400_000]);
  assert.deepEqual(savedActor.lv3State.supernovaUsed, {'supernova-alpha-card': weekStart(NOW)});
  for (const id of [b.selfId, c.selfId]) {
    const savedTarget = persisted.students.find(student => student.id === id);
    assert.equal(savedTarget.cardMarkers.find(marker => marker.itemId === 'space-station-card')?.until, null);
  }
  assert.equal(persisted.itemLog.at(-1).itemId, 'space-station-card');

  await f.restart();
  const nextTeacher = await f.connect();
  assert.equal((await call(nextTeacher, 'room:open', {teacherKey: KEY, code})).ok, true);
  const resumed = await join(await f.connect(), code, '1');
  assert.equal(resumed.ok, true, resumed.error);
  room = f.game.store.rooms.get(code); actor = room.players.get(a.selfId);
  assert.deepEqual(actor.lv3State.clusterNextAt, [NOW + 7 * 86_400_000]);
  assert.deepEqual(actor.lv3State.supernovaUsed, {'supernova-alpha-card': weekStart(NOW)});
  assert.equal(room.itemLog.at(-1).itemId, 'space-station-card');
  for (const id of [b.selfId, c.selfId])
    assert.equal(room.players.get(id).cardMarkers.find(marker => marker.itemId === 'space-station-card')?.until, null);
});
