import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {fromRecord} from '../server/persistent-rooms.js';
import {validateCardMarkers} from '../server/item-cards.js';
import {MAP, SHOP, SHARDS, STREET, STREET_ID} from '../shared/config.js';
import {MARKET} from '../shared/market.js';
import {PLAZA_ID} from '../shared/config.js';
import {weekStart} from '../server/temple.js';

const DAY = 86_400_000, WEEK = 7 * DAY;
const key = 'lv2-integration-isolated-test-key';
const call = (socket, event, data = {}) => socket.timeout(4000).emitWithAck(event, data);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const quantity = (p, id) => p.inventory.find(item => item.id === id)?.quantity || 0;
const assets = p => structuredClone({inventory: p.inventory, starShards: p.starShards, lv2State: p.lv2State, pending: p.abilityState.pending});
async function until(predicate) {
  const end = Date.now() + 3500;
  while (!predicate() && Date.now() < end) await sleep(25);
  assert.ok(predicate(), 'periodic settlement did not finish');
}
async function fixture(t, initialTime = Date.now() + DAY) {
  const dir = mkdtempSync(join(tmpdir(), 'class-lv2-integration-'));
  let game, now = initialTime, code, teacher, first, second;
  const sockets = [];
  const start = async () => {
    game = createClassroomServer({teacherKey: key, studentHours: false, dataDir: dir,
      unattended: false, teacherManagedAccounts: true, clock: () => now,
      // Synthetic test-only recipe; never reads the private classroom recipe file.
      craftingRecipes: [{ingredients: [{id: 'alien-card', quantity: 1}], output: {id: 'galaxy-card'}}]});
    await game.listen();
  };
  const connect = async () => {
    const socket = io('http://127.0.0.1:' + game.http.address().port, {transports: ['websocket'], forceNew: true, reconnection: false});
    sockets.push(socket);
    await new Promise((resolve, reject) => {socket.once('connect', resolve); socket.once('connect_error', reject);});
    return socket;
  };
  const login = async name => {
    const socket = await connect();
    const result = await call(socket, 'room:join', {code, nickname: name, pin: '1234'});
    assert.ok(result.ok, result.error);
    return socket;
  };
  t.after(async () => {
    for (const socket of sockets) socket.disconnect();
    await game?.close();
    rmSync(dir, {recursive: true, force: true});
  });
  await start(); teacher = await connect();
  const created = await call(teacher, 'room:create', {teacherKey: key, title: 'LV2 검사', studentAccounts: [
    {nickname: '별이', pin: '1234'}, {nickname: '달이', pin: '1234'}]});
  assert.ok(created.ok, created.error); code = created.room.code;
  first = await login('별이'); second = await login('달이');
  const f = {
    get game() { return game; }, get room() { return game.store.rooms.get(code); },
    get actor() { return [...f.room.players.values()].find(p => p.nickname === '별이'); },
    get friend() { return [...f.room.players.values()].find(p => p.nickname === '달이'); },
    get teacher() { return teacher; }, get first() { return first; }, get second() { return second; },
    get now() { return now; }, setNow(value) { now = value; },
    record() { return JSON.parse(readFileSync(join(dir, code + '.json'), 'utf8')); },
    seed(work) { game.store.transact(() => work(f.actor, f.friend)); },
    async restart(nextTime = now, students = false) {
      await game.close(); now = nextTime; await start();
      teacher = await connect();
      const result = await call(teacher, 'room:open', {teacherKey: key, code});
      assert.ok(result.ok, result.error);
      if (students) { first = await login('별이'); second = await login('달이'); }
    },
    async loginActor() { first = await login('별이'); },
    place(kind) {
      const object = STREET.objects.find(o => o.kind === kind);
      assert.ok(object);
      Object.assign(f.actor, {mapId: STREET_ID, x: object.x, y: object.y});
    }
  };
  f.seed((a, b) => {for (const p of [a, b]) {p.avatar.level = 2; p.starShards = 100;}});
  return f;
}

test('finite LV2 markers and teacher-decremented counts survive disk and restart', async t => {
  const f = await fixture(t);
  f.seed(a => {a.inventory = [{id: 'spaceman-card', quantity: 1}, {id: 'spaceship-card', quantity: 1}];});
  let used = await call(f.first, 'item:use', {itemId: 'spaceman-card', targetId: f.actor.id});
  assert.ok(used.ok, used.error);
  const markerId = f.actor.cardMarkers[0].id;
  assert.equal(f.actor.cardMarkers[0].remainingUses, 3);
  f.setNow(f.now + 2000);
  used = await call(f.first, 'item:use', {itemId: 'spaceship-card', targetId: f.friend.id});
  assert.ok(used.ok, used.error);
  const pillar = MAP.objects.find(o => o.id === 'pillar-effects');
  const teacher = [...f.room.players.values()].find(p => p.role === 'teacher');
  Object.assign(teacher, {x: pillar.x, y: pillar.y});
  assert.equal((await call(f.first, 'item:complete', {objectId: pillar.id, targetId: f.actor.id, markerId})).ok, false);
  // A rejected persistent action restores object references; fetch them again.
  Object.assign([...f.room.players.values()].find(p => p.role === 'teacher'), {x: pillar.x, y: pillar.y});
  const completed = await call(f.teacher, 'item:complete', {objectId: pillar.id, targetId: f.actor.id, markerId});
  assert.ok(completed.ok, completed.error);
  const markers = structuredClone(f.actor.cardMarkers);
  assert.equal(markers.find(m => m.id === markerId).remainingUses, 2);
  assert.ok(markers.every(m => Number.isSafeInteger(m.until)));
  assert.deepEqual(f.record().students.find(p => p.id === f.actor.id).cardMarkers, markers);
  await f.restart();
  assert.deepEqual(f.actor.cardMarkers, markers);
  assert.equal(f.actor.connected, false);
  assert.equal(f.friend.cardMarkers[0].itemId, 'spaceship-card');
});

test('LV2 persistence rejects invalid finite times/count shapes/anchors and retains expired rabbit debt', async t => {
  const f = await fixture(t);
  const valid = {id: 'marker', itemId: 'spaceman-card', until: f.now + WEEK, at: f.now,
    fromId: f.actor.id, fromNickname: f.actor.nickname, fromLevel: 2, remainingUses: 3, note: ''};
  assert.deepEqual(validateCardMarkers([valid]), [valid]);
  for (const patch of [{until: null}, {until: -1}, {until: 1.5}, {remainingUses: -1},
    {remainingUses: 1.5}, {remainingUses: 100}, {fromLevel: 7}, {at: -1}, {pendingGrant: 'yes'}]) {
    assert.throws(() => validateCardMarkers([{...valid, ...patch}]));
  }
  const debt = {...valid, itemId: 'sun-rabbit-card', until: Date.now() - 1, pendingGrant: true};
  delete debt.remainingUses;
  assert.deepEqual(validateCardMarkers([debt]), [debt]);
  for (const anchors of [[-1], [1.5], [1, 2, 3], 'invalid']) {
    const record = f.record(); record.students[0].lv2State = {galaxyNextAt: anchors};
    assert.throws(() => fromRecord(record));
  }
});

test('offline sun-rabbit expiry pays TARGET once, persists payment, never repeats after restart', async t => {
  const f = await fixture(t, Date.now() - WEEK - 5000);
  f.seed(a => {a.inventory = [{id: 'sun-rabbit-card', quantity: 1}];});
  const result = await call(f.first, 'item:use', {itemId: 'sun-rabbit-card', targetId: f.friend.id});
  assert.ok(result.ok, result.error);
  assert.ok(f.friend.cardMarkers[0].until < Date.now());
  await f.restart(Date.now());
  assert.equal(f.friend.connected, false);
  await until(() => quantity(f.friend, 'star-card') === 1);
  assert.equal(f.friend.cardMarkers.length, 0);
  assert.equal(quantity(f.actor, 'star-card'), 0);
  assert.equal(quantity(f.record().students.find(p => p.id === f.friend.id), 'star-card'), 1);
  await f.restart(); await sleep(1100);
  assert.equal(quantity(f.friend, 'star-card'), 1);
  assert.equal(f.friend.cardMarkers.length, 0);
});

test('offline full-stack rabbit reward survives repeated restart and pays once when space opens', async t => {
  const f = await fixture(t, Date.now() - WEEK - 5000);
  f.seed((a, b) => {a.inventory = [{id: 'sun-rabbit-card', quantity: 1}]; b.inventory = [{id: 'star-card', quantity: SHOP.maxStack}];});
  assert.ok((await call(f.first, 'item:use', {itemId: 'sun-rabbit-card', targetId: f.friend.id})).ok);
  await f.restart(Date.now());
  await until(() => f.friend.cardMarkers[0]?.pendingGrant === true);
  await f.restart();
  assert.equal(f.friend.cardMarkers[0].pendingGrant, true);
  let saves = 0;
  const save = f.game.store.files.save.bind(f.game.store.files);
  f.game.store.files.save = record => {saves++; return save(record);};
  await sleep(1100); assert.equal(saves, 0, 'full-stack pending grant must not write each tick');
  f.seed((_a, b) => {b.inventory[0].quantity--;});
  await until(() => f.friend.cardMarkers.length === 0);
  assert.equal(quantity(f.friend, 'star-card'), SHOP.maxStack);
  await f.restart(); await sleep(1100);
  assert.equal(quantity(f.friend, 'star-card'), SHOP.maxStack);
});

test('shop-acquired galaxy anchors persist and offline catch-up accrues once per held card', async t => {
  const f = await fixture(t), acquiredAt = f.now;
  f.place('shop');
  assert.ok((await call(f.first, 'shop:buy', {itemId: 'galaxy-card', quantity: 1})).ok);
  f.setNow(f.now + DAY);
  assert.ok((await call(f.first, 'shop:buy', {itemId: 'galaxy-card', quantity: 1})).ok);
  assert.deepEqual(f.actor.lv2State.galaxyNextAt, [acquiredAt + WEEK, acquiredAt + DAY + WEEK]);
  const balance = f.actor.starShards;
  await f.restart(acquiredAt + 3 * WEEK + DAY);
  assert.equal(f.actor.connected, false);
  await until(() => f.actor.starShards === balance + 6);
  assert.deepEqual(f.actor.lv2State.galaxyNextAt, [acquiredAt + 4 * WEEK, acquiredAt + DAY + 4 * WEEK]);
  await f.restart(); await sleep(1100);
  assert.equal(f.actor.starShards, balance + 6);
});

test('shop maxOwned includes Gemini copied quantity and rejection consumes neither money nor pending', async t => {
  const f = await fixture(t);
  f.seed(a => {a.avatar.constellationId = 'gemini'; a.inventory = [{id: 'galaxy-card', quantity: 1}];
    a.abilityState.pending = {mode: 'shop-copy', week: weekStart(f.now)};});
  f.place('shop'); const before = assets(f.actor);
  const result = await call(f.first, 'shop:buy', {itemId: 'galaxy-card', quantity: 1});
  assert.equal(result.ok, false); assert.match(result.error, /2개까지/);
  assert.deepEqual(assets(f.actor), before);
  f.seed(a => {a.inventory = [];}); f.place('shop');
  assert.ok((await call(f.first, 'shop:buy', {itemId: 'galaxy-card', quantity: 1})).ok);
  assert.equal(quantity(f.actor, 'galaxy-card'), 2);
  assert.equal(f.actor.lv2State.galaxyNextAt.length, 2);
});

test('Corvus acquisition obeys maxOwned and budget without spending pending picks', async t => {
  const f = await fixture(t);
  for (const mode of ['dice-item', 'value-item']) {
    f.seed(a => {a.avatar.constellationId = 'corvus'; a.inventory = [{id: 'galaxy-card', quantity: 2}];
      a.abilityState.pending = mode === 'dice-item'
        ? {mode, week: weekStart(f.now), maxLevel: 2, roll: 4}
        : {mode, week: weekStart(f.now), maxLevel: 5, roll: 6, budget: 12, picks: 1, selected: []};});
    const before = assets(f.actor);
    const result = await call(f.first, 'ability:choose-item', {itemId: 'galaxy-card'});
    assert.equal(result.ok, false); assert.match(result.error, mode === 'dice-item' ? /2개까지/ : /제작 가치/);
    assert.deepEqual(assets(f.actor), before);
  }
  f.seed(a => {a.inventory[0].quantity = 1;
    a.abilityState.pending = {mode: 'dice-item', week: weekStart(f.now), maxLevel: 2, roll: 4};});
  assert.ok((await call(f.first, 'ability:choose-item', {itemId: 'galaxy-card'})).ok);
  assert.equal(quantity(f.actor, 'galaxy-card'), 2);
});

test('crafting maxOwned rejection keeps ingredients and fee; successful acquisition starts anchor', async t => {
  const f = await fixture(t);
  f.seed(a => {a.inventory = [{id: 'galaxy-card', quantity: 2}, {id: 'alien-card', quantity: 1}];});
  f.place('crafting'); const before = assets(f.actor);
  const request = {ingredients: [{id: 'alien-card', quantity: 1}]};
  const rejected = await call(f.first, 'crafting:combine', request);
  assert.equal(rejected.ok, false); assert.deepEqual(assets(f.actor), before);
  f.seed(a => {a.inventory[0].quantity = 1;}); f.place('crafting');
  const result = await call(f.first, 'crafting:combine', request);
  assert.ok(result.ok && result.success, result.error);
  assert.equal(quantity(f.actor, 'galaxy-card'), 2);
  assert.equal(f.actor.lv2State.galaxyNextAt.length, 2);
});

test('mutually confirmed market trade rejects recipient maxOwned overflow without transferring items or either currency', async t => {
  const f = await fixture(t);
  f.seed((a, b) => {
    for (const p of [a, b]) Object.assign(p, {mapId: PLAZA_ID, x: MARKET.x, y: MARKET.y, cosmicEnergy: 20});
    a.inventory = [{id: 'galaxy-card', quantity: 1}]; b.inventory = [{id: 'galaxy-card', quantity: 2}];
  });
  const proposed = await call(f.first, 'trade:propose', {targetId: f.friend.id});
  assert.ok(proposed.ok, proposed.error); const tradeId = proposed.tradeId;
  assert.ok((await call(f.second, 'trade:respond', {tradeId, accept: true})).ok);
  assert.ok((await call(f.first, 'trade:offer', {tradeId, revision: 0,
    offer: {shards: 0, energy: 3, items: [{id: 'galaxy-card', quantity: 1}]}})).ok);
  assert.ok((await call(f.second, 'trade:offer', {tradeId, revision: 1,
    offer: {shards: 1, energy: 5, items: []}})).ok);
  const ref = {tradeId, revision: 2};
  assert.ok((await call(f.first, 'trade:confirm', ref)).ok);
  const before = [assets(f.actor), assets(f.friend)], energy = [f.actor.cosmicEnergy, f.friend.cosmicEnergy];
  const result = await call(f.second, 'trade:confirm', ref);
  assert.equal(result.ok, false);
  assert.deepEqual([assets(f.actor), assets(f.friend)], before);
  assert.deepEqual([f.actor.cosmicEnergy, f.friend.cosmicEnergy], energy);
  assert.equal(f.room.trades.size, 0);assert.equal(f.room.tradeLog.at(-1).result, 'failed');
  assert.equal(f.record().tradeLog.at(-1).result, 'failed');
});

test('expired unpaid rabbit reward survives a successful LV1 manual-card use', async t => {
  const f = await fixture(t);
  f.seed(a => {
    a.inventory = [{id: 'star-card', quantity: SHOP.maxStack}, {id: 'alien-card', quantity: 1}];
    a.cardMarkers = [{id: 'unpaid-rabbit', itemId: 'sun-rabbit-card', until: Date.now() - 1,
      at: Date.now() - WEEK - 1, fromLevel: 2, fromId: f.friend.id, fromNickname: f.friend.nickname,
      pendingGrant: true, note: ''}];
  });
  const result = await call(f.first, 'item:use', {itemId: 'alien-card', targetId: f.actor.id});
  assert.ok(result.ok, result.error);
  assert.ok(f.actor.cardMarkers.some(m => m.id === 'unpaid-rabbit'), 'LV1 use discarded the queued star-card reward');
  assert.ok(f.record().students.find(p => p.id === f.actor.id).cardMarkers.some(m => m.id === 'unpaid-rabbit'));
});

test('draw-start exceeds 50 records and preserves pending rewards after restart', async t => {
  const f = await fixture(t);
  f.seed(a => {
    a.inventory = [{id: 'star-card', quantity: SHOP.maxStack}, {id: 'moon-rabbit-card', quantity: 1}];
    a.cardMarkers = Array.from({length: 50}, (_, i) => ({id: 'debt-' + i,
      itemId: 'sun-rabbit-card', until: Date.now() - 1, at: Date.now() - WEEK - 1,
      fromId: f.friend.id, fromNickname: f.friend.nickname, fromLevel: 2, pendingGrant: true, note: ''}));
  });
  const result = await call(f.first, 'draw:start');
  assert.ok(result.ok,result.error);
  assert.equal(f.actor.cardMarkers.length,51);
  assert.equal(quantity(f.actor,'moon-rabbit-card'),0);
  const drawId=f.actor.rabbitDraw.id;
  await f.restart();
  assert.equal(f.actor.cardMarkers.length,51);
  assert.equal(f.actor.cardMarkers.filter(m=>m.pendingGrant).length,50);
  assert.equal(f.actor.rabbitDraw.id,drawId);
  assert.doesNotThrow(() => fromRecord(f.record()));
});

test('LV1 adds unlimited records without dropping unpaid rabbit rewards', async t => {
  const f = await fixture(t);
  for (const debts of [50, 75]) {
    f.seed(a => {
      a.inventory = [{id: 'star-card', quantity: SHOP.maxStack}, {id: 'alien-card', quantity: 1}];
      a.lastItemUseAt = 0;
      a.cardMarkers = Array.from({length: debts}, (_, i) => ({id: 'debt-' + i,
        itemId: 'sun-rabbit-card', until: Date.now() - 1, at: Date.now() - WEEK - 1,
        fromId: f.friend.id, fromNickname: f.friend.nickname, fromLevel: 2, note: ''}));
    });
    const result = await call(f.first, 'item:use', {itemId: 'alien-card', targetId: f.actor.id});
    assert.ok(result.ok,result.error);
    assert.equal(quantity(f.actor, 'alien-card'),0);
    assert.equal(f.actor.cardMarkers.filter(m => m.itemId === 'sun-rabbit-card').length, debts);
    assert.equal(f.actor.cardMarkers.length,debts+1);
    assert.doesNotThrow(() => fromRecord(f.record()));
  }
});

test('sun tax applies once to LV1, LV2 and draw start; rejected use leaves disk/assets unchanged', async t => {
  const f = await fixture(t);
  f.seed(a => {
    a.inventory = [{id: 'alien-card', quantity: 2}, {id: 'spaceman-card', quantity: 1}, {id: 'moon-rabbit-card', quantity: 1}];
    a.cardMarkers = [{id: 'tax', itemId: 'sun-card', until: f.now + WEEK, at: f.now,
      fromId: f.friend.id, fromNickname: f.friend.nickname, fromLevel: 2, note: ''}];
  });
  for (const id of ['alien-card', 'spaceman-card']) {
    const result = await call(f.first, 'item:use', {itemId: id, targetId: f.actor.id});
    assert.ok(result.ok, result.error); f.setNow(f.now + 2000);
  }
  const started = await call(f.first, 'draw:start'); assert.ok(started.ok, started.error);
  assert.equal(f.actor.starShards, 97); assert.equal(f.friend.starShards, 103);
  assert.ok((await call(f.first, 'draw:start')).ok);
  assert.equal(f.actor.starShards, 97, 'resuming a draw must not tax twice');
  const noReward = f.actor.rabbitDraw.cards.find(card => card.reward.kind === 'none');
  f.seed(a=>{a.rabbitDraw.cards=[noReward,...a.rabbitDraw.cards.filter(c=>c.id!==noReward.id)];});
  assert.ok((await call(f.first, 'draw:pick', {drawId: started.draw.id})).ok);
  assert.equal(f.actor.starShards, 97); assert.equal(f.friend.starShards, 103);
  f.seed((_a, b) => {b.starShards = SHARDS.max;});
  f.setNow(f.now + 2000);
  const before = f.record(), actorBefore = assets(f.actor);
  const denied = await call(f.first, 'item:use', {itemId: 'alien-card', targetId: f.actor.id});
  assert.equal(denied.ok, false); assert.match(denied.error, /더 보낼 수/);
  assert.deepEqual(assets(f.actor), actorBefore);
  assert.deepEqual(f.record(), before);
});
