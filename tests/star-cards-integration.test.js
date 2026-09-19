import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {PLAZA_ID, GARDEN_ID} from '../shared/config.js';
import {STAR_CARD_CATALOG, goldItemIdOf} from '../shared/star-cards.js';

const key = 'isolated-star-card-integration-key';
const call = (socket, event, data = {}) => socket.timeout(4000).emitWithAck(event, data);
const ok = reply => { assert.equal(reply.ok, true, reply.error); return reply; };
const count = (player, id) => player.inventory.find(item => item.id === id)?.quantity || 0;
async function until(predicate) {
  for (let i = 0; i < 60; i++) { if (predicate()) return; await delay(50); }
  assert.ok(predicate(), 'server timer did not publish expected state');
}

test('star-card sockets persist atomic rewards, enforce read/remove scope, reject replay and expire through the server clock', {timeout: 30000}, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'star-cards-integration-'));
  const sockets = [];
  let game, port, now = Date.now(), draw = 0, code, actorId, observerId, teacherId;
  const room = () => game.store.rooms.get(code);
  const player = id => room().players.get(id);
  async function start() {
    game = createClassroomServer({teacherKey: key, dataDir: dir, studentHours: false, clock: () => now, starCardRandom: () => draw});
    port = (await game.listen()).port;
  }
  async function connect() {
    const socket = io(`http://127.0.0.1:${port}`, {transports: ['websocket'], forceNew: true, reconnection: false});
    sockets.push(socket);
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    return socket;
  }
  function near(id, card) { Object.assign(player(id), {mapId: PLAZA_ID, x: card.x, y: card.y, input: {x: 0, y: 0, at: 0}}); }
  try {
    await start();
    let teacher = await connect(), actor = await connect(), observer = await connect();
    const anonymous = await connect();
    const created = ok(await call(teacher, 'room:create', {teacherKey: key, title: '별 카드 격리 검사', studentAccounts: [
      {nickname: '별이', pin: '1357'}, {nickname: '달이', pin: '2468'}
    ]}));
    code = created.room.code; teacherId = created.selfId;
    actorId = ok(await call(actor, 'room:join', {code, nickname: '별이', pin: '1357'})).selfId;
    observerId = ok(await call(observer, 'room:join', {code, nickname: '달이', pin: '2468'})).selfId;
    assert.equal(player(actorId).avatar.level, 1);
    game.store.transact(() => { player(actorId).inventory = [{id: 'star-card', quantity: 1}]; });
    let observerSnapshot;
    observer.on('room:state', value => { observerSnapshot = value; });
    const used = ok(await call(actor, 'item:use', {itemId: 'star-card', targetId: actorId, cardId: 'black-hole', quantity: 99}));
    assert.equal(used.starCard.definition.id, 'new-life');
    assert.equal(used.starCard.canRemove, false);
    assert.equal(used.starCard.card.userNickname, '별이');
    assert.match(used.starCard.card.data.messages.join(' '), /2개 지급/);
    assert.match(used.starCard.card.data.manualNote, /영구 자리/);
    const id = used.starCard.card.id;
    assert.equal(count(player(actorId), 'star-card'), 0);
    assert.equal(count(player(actorId), 'space-food-card'), 2);
    await until(() => observerSnapshot?.starCards?.some(card => card.id === id));
    let card = observerSnapshot.starCards.find(card => card.id === id);
    assert.equal(card.height, 90); assert.equal(card.slot, 0);
    assert.equal(observerSnapshot.players.find(p => p.id === actorId).inventory, undefined);
    assert.equal((await call(actor, 'item:use', {itemId: 'star-card'})).ok, false);
    now += 2001;
    assert.equal((await call(actor, 'item:use', {itemId: 'star-card'})).ok, false);
    assert.equal(count(player(actorId), 'space-food-card'), 2);
    assert.equal(room().starCards.length, 1);
    assert.equal((await call(anonymous, 'star-card:read', {id})).ok, false);
    Object.assign(player(observerId), {mapId: PLAZA_ID, x: 100, y: 100});
    assert.equal((await call(observer, 'star-card:read', {id})).ok, false);
    near(observerId, card); player(observerId).mapId = GARDEN_ID;
    assert.equal((await call(observer, 'star-card:read', {id})).ok, false);
    near(observerId, card);
    const read = ok(await call(observer, 'star-card:read', {id}));
    assert.equal(read.definition.name, '새로운 삶의 터전');
    assert.equal(read.card.userNickname, '별이'); assert.equal(read.canRemove, false);
    assert.equal((await call(observer, 'star-card:remove', {id, role: 'teacher', teacherKey: key})).ok, false);
    assert.equal(room().starCards.length, 1);
    const foreign = await connect();
    const foreignRoom = ok(await call(foreign, 'room:create', {teacherKey: key, title: '다른 격리 교실', allowedNames: ['외부']}));
    const outsider = game.store.rooms.get(foreignRoom.room.code).players.get(foreignRoom.selfId);
    Object.assign(outsider, {mapId: PLAZA_ID, x: card.x, y: card.y});
    assert.equal((await call(foreign, 'star-card:read', {id, code})).ok, false);
    assert.equal((await call(foreign, 'star-card:remove', {id, code})).ok, false);
    assert.deepEqual(game.store.snapshot(game.store.rooms.get(foreignRoom.room.code), outsider).starCards, []);

    // A real file-store restart must retain the record and already-paid rewards.
    for (const socket of sockets) socket.disconnect();
    await game.close(); game = null;
    await start(); teacher = await connect(); actor = await connect(); observer = await connect();
    teacherId = ok(await call(teacher, 'room:open', {teacherKey: key, code})).selfId;
    const resumed = ok(await call(actor, 'room:join', {code, nickname: '별이', pin: '1357'}));
    assert.equal(resumed.selfId, actorId);
    observerId = ok(await call(observer, 'room:join', {code, nickname: '달이', pin: '2468'})).selfId;
    assert.equal(count(player(actorId), 'space-food-card'), 2);
    assert.equal(count(player(actorId), 'star-card'), 0);
    assert.equal(room().starCards.length, 1);
    card = resumed.room.starCards[0];
    assert.equal(card.id, id); assert.equal(card.userNickname, '별이');
    near(observerId, card);
    assert.equal(ok(await call(observer, 'star-card:read', {id})).definition.name, '새로운 삶의 터전');
    assert.equal((await call(actor, 'item:use', {itemId: 'star-card'})).ok, false);
    near(teacherId, card);
    assert.equal(ok(await call(teacher, 'star-card:read', {id})).canRemove, true);
    ok(await call(teacher, 'star-card:remove', {id}));
    assert.equal(room().starCards.length, 0);
    assert.equal(count(player(actorId), 'space-food-card'), 2);
    assert.equal((await call(teacher, 'star-card:remove', {id})).ok, false);

    // Drive the one-day expiry with the server's injected clock, not real sleep.
    now = Date.now(); draw = STAR_CARD_CATALOG.findIndex(card => card.id === 'comet');
    game.store.transact(() => { player(actorId).inventory.push({id: 'star-card', quantity: 1}); player(actorId).lastItemUseAt = 0; });
    const timed = ok(await call(actor, 'item:use', {itemId: 'star-card'})).starCard.card;
    const timedPosition = game.store.snapshot(room(), player(actorId)).starCards.find(card => card.id === timed.id);
    near(observerId, timedPosition);
    now = timed.expiresAt - 1;
    ok(await call(observer, 'star-card:read', {id: timed.id}));
    now = timed.expiresAt;
    assert.equal((await call(observer, 'star-card:read', {id: timed.id})).ok, false);
    await until(() => !room().starCards.some(card => card.id === timed.id));
    assert.equal(game.store.records.get(code).starCards.length, 0);

    // Registration must allow typed items through the real item route and loader.
    game.store.transact(() => { player(actorId).inventory.push({id: goldItemIdOf('earth'), quantity: 1}); });
    draw = 0;
    const earth = ok(await call(actor, 'item:use', {itemId: goldItemIdOf('earth')}));
    assert.equal(earth.starCard.definition.id, 'earth');
    assert.equal(earth.starCard.card.data.rewards.length, 3);
    assert.equal(count(player(actorId), goldItemIdOf('earth')), 0);
  } finally {
    for (const socket of sockets) socket.disconnect();
    if (game) await game.close();
    assert.ok(resolve(dir).startsWith(resolve(join(tmpdir(), 'star-cards-integration-'))));
    await rm(dir, {recursive: true, force: true});
  }
});
