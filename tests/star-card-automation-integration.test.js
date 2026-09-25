import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {ITEM_USE, SHOP, STREET, STREET_ID, PLAZA_ID} from '../shared/config.js';
import {goldItemIdOf} from '../shared/star-cards.js';

const teacherKey = 'star-card-automation-integration-key';
const call = (socket, event, data = {}) => socket.timeout(4000).emitWithAck(event, data);
const ok = reply => { assert.equal(reply.ok, true, reply.error); return reply; };
const rejected = async (socket, event, data, pattern) => {
  const reply = await call(socket, event, data);
  assert.equal(reply.ok, false, `${event} unexpectedly succeeded`);
  if (pattern) assert.match(reply.error, pattern);
  return reply;
};

async function fixture(t, suffix) {
  const dataDir = await mkdtemp(join(tmpdir(), `star-card-auto-${suffix}-`));
  const sockets = [];
  let game, port, now = Date.now();
  const start = async () => {
    game = createClassroomServer({teacherKey, dataDir, studentHours: false, clock: () => now,
      starCardRandom: () => 0});
    port = (await game.listen()).port;
  };
  const connect = async () => {
    const socket = io(`http://127.0.0.1:${port}`, {transports: ['websocket'], forceNew: true, reconnection: false});
    sockets.push(socket);
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    return socket;
  };
  const disconnect = async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    if (game) { await game.close(); game = null; }
  };
  t.after(async () => {
    await disconnect();
    const expectedPrefix = resolve(join(tmpdir(), `star-card-auto-${suffix}-`));
    assert.ok(resolve(dataDir).startsWith(expectedPrefix), `refusing cleanup outside ${expectedPrefix}`);
    await rm(dataDir, {recursive: true, force: true});
  });
  await start();
  const teacher = await connect(), actor = await connect(), other = await connect();
  const created = ok(await call(teacher, 'room:create', {teacherKey, title: '자동화 검사 교실', studentAccounts: [
    {nickname: '주인학생', pin: '1357'}, {nickname: '다른학생', pin: '2468'}
  ]}));
  const code = created.room.code, teacherId = created.selfId;
  const actorId = ok(await call(actor, 'room:join', {code, nickname: '주인학생', pin: '1357'})).selfId;
  const otherId = ok(await call(other, 'room:join', {code, nickname: '다른학생', pin: '2468'})).selfId;
  const room = () => game.store.rooms.get(code);
  const player = id => room().players.get(id);
  const nearCard = (id, cardId) => {
    const record = room().starCards.find(card => card.id === cardId);
    const position = game.store.snapshot(room(), player(id)).starCards.find(card => card.id === cardId);
    Object.assign(player(id), {mapId: PLAZA_ID, x: position.x, y: position.y});
    return record;
  };
  const useTyped = async (socket, id, card) => {
    const p = player(id);
    p.lastItemUseAt = Math.min(p.lastItemUseAt || 0, now - ITEM_USE.cooldownMs);
    p.inventory = [{id: goldItemIdOf(card), quantity: 1}];
    return ok(await call(socket, 'item:use', {itemId: goldItemIdOf(card)}));
  };
  const restart = async () => {
    await disconnect();
    await start();
    const teacher2 = await connect(), actor2 = await connect(), other2 = await connect();
    ok(await call(teacher2, 'room:open', {teacherKey, code}));
    const actorJoin = ok(await call(actor2, 'room:join', {code, nickname: '주인학생', pin: '1357'}));
    ok(await call(other2, 'room:join', {code, nickname: '다른학생', pin: '2468'}));
    return {teacher: teacher2, actor: actor2, other: other2, actorId: actorJoin.selfId};
  };
  return {get game(){return game;}, get now(){return now;}, set now(v){now = v;}, room, player, nearCard,
    useTyped, restart, connect, teacher, actor, other, code, teacherId, actorId, otherId};
}

test('typed zodiac XP reward persists across restart and rejects replay and foreign card choice', {timeout: 30000}, async t => {
  const f = await fixture(t, 'zodiac');
  const used = await f.useTyped(f.actor, f.actorId, 'zodiac');
  const id = used.starCard.card.id;
  f.nearCard(f.otherId, id);
  await rejected(f.other, 'star-card:choose', {id, choice: 'xp'}, /본인의/);
  const beforeXp = f.player(f.actorId).avatar.xp;
  const beforeShards = f.player(f.actorId).starShards;
  const chosen = ok(await call(f.actor, 'star-card:choose', {id, choice: 'xp'}));
  assert.equal(chosen.card.data.automation.choice, 'xp');
  assert.equal(chosen.card.data.roll, 1);
  assert.equal(chosen.card.data.xp + chosen.card.data.shards, 3);
  assert.equal(f.player(f.actorId).avatar.xp + f.player(f.actorId).starShards - beforeXp - beforeShards, 3);
  const saved = structuredClone(f.room().starCards.find(card => card.id === id).data);
  const resumed = await f.restart();
  assert.deepEqual(f.room().starCards.find(card => card.id === id).data, saved);
  f.nearCard(resumed.actorId, id);
  await rejected(resumed.actor, 'star-card:choose', {id, choice: 'xp'}, /본인의/);
  const playerAfter = structuredClone(f.player(resumed.actorId));
  await rejected(resumed.actor, 'star-card:choose', {id, choice: 'xp'}, /본인의/);
  assert.deepEqual(f.player(resumed.actorId).avatar, playerAfter.avatar);
  assert.equal(f.room().starCards.find(card => card.id === id).data.automation.choice, 'xp');
});

test('zodiac choose save failure restores choice, XP, shards and inventory, then allows one successful retry', {timeout: 30000}, async t => {
  const f = await fixture(t, 'zodiac-rollback');
  const used = await f.useTyped(f.actor, f.actorId, 'zodiac'), id = used.starCard.card.id;
  f.nearCard(f.actorId, id);
  const beforePlayer = f.player(f.actorId);
  const before = {avatar: structuredClone(beforePlayer.avatar), shards: beforePlayer.starShards,
    inventory: structuredClone(beforePlayer.inventory)};
  const beforeAutomation = structuredClone(f.room().starCards.find(card => card.id === id).data.automation);
  const files = f.game.store.files, save = files.save;
  files.save = () => { throw new Error('injected file save failure'); };
  try { await rejected(f.actor, 'star-card:choose', {id, choice: 'xp'}, /저장하지 못했어요/); }
  finally { files.save = save; }
  assert.deepEqual(f.player(f.actorId).avatar, before.avatar);
  assert.equal(f.player(f.actorId).starShards, before.shards);
  assert.deepEqual(f.player(f.actorId).inventory, before.inventory);
  assert.deepEqual(f.room().starCards.find(card => card.id === id).data.automation, beforeAutomation);
  const chosen = ok(await call(f.actor, 'star-card:choose', {id, choice: 'xp'}));
  assert.equal(chosen.card.data.automation.choice, 'xp');
  assert.equal(chosen.card.data.xp + chosen.card.data.shards, 3);
});

test('Saturn discounts real shop purchases atomically and keeps private consumed-item state across restart', {timeout: 30000}, async t => {
  const f = await fixture(t, 'saturn');
  const used = await f.useTyped(f.actor, f.actorId, 'saturn');
  const id = used.starCard.card.id;
  const p = f.player(f.actorId), item = SHOP.items.find(value => value.forSale !== false && value.price >= 2);
  assert.ok(item, 'shared shop catalog has a sale item priced at least 2');
  Object.assign(p, {mapId: STREET_ID, x: STREET.objects.find(value => value.kind === 'shop').x,
    y: STREET.objects.find(value => value.kind === 'shop').y, starShards: 1000});
  const shopObject = STREET.objects.find(value => value.kind === 'shop');
  Object.assign(p, {mapId: STREET_ID, x: shopObject.x + shopObject.radius + 100, y: shopObject.y});
  await rejected(f.actor, 'shop:buy', {itemId: item.id, quantity: 1}, /더 가까이/);
  Object.assign(p, {mapId: PLAZA_ID});
  await rejected(f.actor, 'shop:buy', {itemId: item.id, quantity: 1}, /별상점/);
  const shopPlayer = f.player(f.actorId);
  Object.assign(shopPlayer, {mapId: STREET_ID, x: shopObject.x, y: shopObject.y});
  const initialShards = shopPlayer.starShards;
  const bought = ok(await call(f.actor, 'shop:buy', {itemId: item.id, quantity: 2}));
  assert.equal(bought.cost, Math.floor(item.price / 2) + item.price);
  assert.equal(bought.discounted, 1);
  assert.equal(f.player(f.actorId).starShards, initialShards - bought.cost);
  const record = f.room().starCards.find(card => card.id === id);
  assert.ok(record.data.automation.usedItems.includes(item.id));
  assert.equal(JSON.stringify(f.game.store.snapshot(f.room(), f.player(f.otherId))).includes('usedItems'), false,
    'public player snapshot must not reveal Saturn purchase history');

  const fresh = SHOP.items.find(value => value.forSale !== false && value.id !== item.id && value.price >= 2);
  assert.ok(fresh);
  let failurePlayer = f.player(f.actorId);
  failurePlayer.inventory = [{id: fresh.id, quantity: SHOP.maxStack}];
  failurePlayer.starShards = 0;
  const usedBeforeFailure = [...record.data.automation.usedItems];
  await rejected(f.actor, 'shop:buy', {itemId: fresh.id, quantity: 1}, /별 파편이 부족/);
  assert.deepEqual(f.room().starCards.find(card => card.id === id).data.automation.usedItems, usedBeforeFailure);
  assert.equal(f.player(f.actorId).starShards, 0);
  failurePlayer = f.player(f.actorId);
  failurePlayer.starShards = 1000;
  await rejected(f.actor, 'shop:buy', {itemId: fresh.id, quantity: 1}, /가방|99개/);
  assert.deepEqual(f.room().starCards.find(card => card.id === id).data.automation.usedItems, usedBeforeFailure);
  assert.equal(f.player(f.actorId).starShards, 1000);

  const resumed = await f.restart();
  const loaded = f.room().starCards.find(card => card.id === id);
  assert.deepEqual(loaded.data.automation.usedItems, usedBeforeFailure);
  assert.equal(JSON.stringify(f.game.store.snapshot(f.room(), f.player(resumed.otherId))).includes('usedItems'), false);
  Object.assign(f.player(resumed.actorId), {mapId: STREET_ID, x: STREET.objects.find(value => value.kind === 'shop').x,
    y: STREET.objects.find(value => value.kind === 'shop').y, inventory: [], starShards: 1000});
  const next = ok(await call(resumed.actor, 'shop:buy', {itemId: item.id, quantity: 1}));
  assert.equal(next.cost, item.price, 'a consumed item type does not receive the discount again after restart');
});

test('Saturn shop save failure restores discount use, balance and inventory, then permits one normal purchase', {timeout: 30000}, async t => {
  const f = await fixture(t, 'saturn-rollback');
  const used = await f.useTyped(f.actor, f.actorId, 'saturn'), cardId = used.starCard.card.id;
  const item = SHOP.items.find(value => value.forSale !== false && value.price >= 2);
  assert.ok(item);
  const shop = STREET.objects.find(value => value.kind === 'shop');
  const player = f.player(f.actorId);
  Object.assign(player, {mapId: STREET_ID, x: shop.x, y: shop.y, starShards: 1000,
    inventory: [{id: item.id, quantity: 1}]});
  const before = {starShards: player.starShards, inventory: structuredClone(player.inventory),
    usedItems: structuredClone(f.room().starCards.find(card => card.id === cardId).data.automation.usedItems)};
  const files = f.game.store.files, save = files.save;
  files.save = () => { throw new Error('injected file save failure'); };
  try { await rejected(f.actor, 'shop:buy', {itemId: item.id, quantity: 1}, /저장하지 못했어요/); }
  finally { files.save = save; }
  assert.equal(f.player(f.actorId).starShards, before.starShards);
  assert.deepEqual(f.player(f.actorId).inventory, before.inventory);
  assert.deepEqual(f.room().starCards.find(card => card.id === cardId).data.automation.usedItems, before.usedItems);
  const bought = ok(await call(f.actor, 'shop:buy', {itemId: item.id, quantity: 1}));
  assert.equal(bought.cost, Math.floor(item.price / 2));
  assert.equal(f.player(f.actorId).starShards, before.starShards - bought.cost);
  assert.equal(f.player(f.actorId).inventory.find(entry => entry.id === item.id).quantity, 2);
  assert.deepEqual(f.room().starCards.find(card => card.id === cardId).data.automation.usedItems, [item.id]);
});

test('Pluto limits student item routes, verifies teacher bypass, releases on removal, and stays room-local', {timeout: 30000}, async t => {
  const f = await fixture(t, 'pluto');
  const used = await f.useTyped(f.actor, f.actorId, 'pluto');
  const id = used.starCard.card.id;
  const actor = f.player(f.actorId);
  actor.lastItemUseAt = Math.min(actor.lastItemUseAt || 0, f.now - ITEM_USE.cooldownMs);
  actor.inventory = [{id: 'space-food-card', quantity: 1}, {id: goldItemIdOf('earth'), quantity: 1},
    {id: 'moon-rabbit-card', quantity: 1}];
  let other = f.player(f.otherId);
  other.lastItemUseAt = Math.min(other.lastItemUseAt || 0, f.now - ITEM_USE.cooldownMs);
  other.avatar = {...other.avatar, level: 2};
  other.inventory = [{id: 'space-food-card', quantity: 1}, {id: goldItemIdOf('earth'), quantity: 1},
    {id: 'moon-rabbit-card', quantity: 1}, {id: 'spaceship-card', quantity: 1}];
  ok(await call(f.actor, 'item:use', {itemId: 'space-food-card', targetId: f.actorId}));
  await rejected(f.other, 'item:use', {itemId: 'space-food-card', targetId: f.otherId}, /명왕성/);
  await rejected(f.other, 'item:use', {itemId: goldItemIdOf('earth')}, /명왕성/);
  await rejected(f.other, 'item:use', {itemId: 'spaceship-card', targetId: f.otherId}, /명왕성/);
  await rejected(f.other, 'draw:start', {}, /명왕성/);
  assert.equal(f.player(f.otherId).inventory.find(entry => entry.id === 'space-food-card').quantity, 1);

  const teacher = f.player(f.teacherId);
  teacher.inventory = [{id: 'space-food-card', quantity: 1}];
  teacher.lastItemUseAt = Math.min(teacher.lastItemUseAt || 0, f.now - ITEM_USE.cooldownMs);
  ok(await call(f.teacher, 'item:use', {itemId: 'space-food-card', targetId: f.teacherId}));

  const foreign = await f.connect();
  const foreignRoom = ok(await call(foreign, 'room:create', {teacherKey, title: '다른 교실', studentAccounts: [
    {nickname: '외부학생', pin: '9753'}
  ]}));
  const foreignStudent = await f.connect();
  const foreignId = ok(await call(foreignStudent, 'room:join', {code: foreignRoom.room.code, nickname: '외부학생', pin: '9753'})).selfId;
  const foreignPlayer = f.game.store.rooms.get(foreignRoom.room.code).players.get(foreignId);
  foreignPlayer.inventory = [{id: 'space-food-card', quantity: 1}];
  ok(await call(foreignStudent, 'item:use', {itemId: 'space-food-card', targetId: foreignId}));

  f.nearCard(f.teacherId, id);
  ok(await call(f.teacher, 'star-card:remove', {id}));
  other = f.player(f.otherId);
  other.lastItemUseAt = Math.min(other.lastItemUseAt || 0, f.now - ITEM_USE.cooldownMs);
  ok(await call(f.other, 'item:use', {itemId: 'space-food-card', targetId: f.otherId}));
});
