import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {STREET, STREET_ID} from '../shared/config.js';
import {LV4_ITEMS} from '../shared/lv4-items.js';

const KEY = 'synthetic-lv4-persistence-test-key';
const NOW = Date.now(); // 저장 로더의 실제 만료 시각과 일치시켜 날짜가 지나도 유효한 검사입니다.
const WEEK = 7 * 86_400_000;
const call = (socket, event, data = {}) => socket.timeout(5000).emitWithAck(event, data);

async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lv4-persistence-'));
  let game, url, closed = false, now=NOW;
  const sockets = [];
  const start = async () => {
    game = createClassroomServer({teacherKey: KEY, dataDir: dir, studentHours: false,
      unattended: false, teacherManagedAccounts: false, clock: () => now, craftingRecipes: []});
    const address = await game.listen(); url = `http://127.0.0.1:${address.port}`; closed = false;
  };
  await start();
  t.after(async () => {
    for (const socket of sockets) socket.disconnect();
    if (!closed) await game.close();
    fs.rmSync(dir, {recursive: true, force: true});
  });
  return {get game() { return game; }, get url() { return url; }, dir, advance(ms){now+=ms;},
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
  const result = await call(teacher, 'room:create', {teacherKey: KEY, title: 'LV4 합성 저장 검사', allowedNames: ['1', '2', '3']});
  assert.equal(result.ok, true, result.error);
  return {teacher, code: result.room.code};
}

const join = (socket, code, nickname) => call(socket, 'room:join', {code, nickname, pin: '1234'});

function putAtShop(f, code, ids) {
  const room = f.game.store.rooms.get(code), shop = STREET.objects.find(object => object.kind === 'shop');
  assert.ok(shop);
  f.game.store.transact(() => {
    for (const id of ids) {
      const player = room.players.get(id);
      player.avatar.level = 4;
      player.mapId = STREET_ID; player.x = shop.x; player.y = shop.y + shop.radius + 1;
      player.starShards = 1000;
    }
  });
}

function seedEclipse(room, sourceId, targetId) {
  const target = room.players.get(targetId);
  target.cardMarkers.push({id: 'synthetic-eclipse-marker', itemId: 'total-eclipse-card', until: NOW + WEEK,
    fromId: sourceId, fromNickname: room.players.get(sourceId).nickname, note: 'synthetic seven-day test marker',
    at: NOW, fromLevel: 4});
}

test('LV4 eclipse retains its seven-day ban, charges one shard per permitted item use, and rolls back failed use', async t => {
  const f = await fixture(t), {teacher, code} = await classroom(f);
  const aSocket = await f.connect(), bSocket = await f.connect(), cSocket = await f.connect();
  const a = await join(aSocket, code, '1'), b = await join(bSocket, code, '2'), c = await join(cSocket, code, '3');
  assert.ok(a.ok && b.ok && c.ok);
  putAtShop(f, code, [a.selfId, b.selfId, c.selfId]);

  for (const [socket, itemId] of [[aSocket, 'total-eclipse-card'], [bSocket, 'nebula-card']]) {
    const bought = await call(socket, 'shop:buy', {itemId, quantity: 1});
    assert.equal(bought.ok, true, bought.error);
  }
  f.game.store.transact(() => {
    const target = f.game.store.rooms.get(code).players.get(b.selfId);
    target.inventory.find(item => item.id === 'nebula-card').quantity = 2;
    target.lastItemUseAt = 0;
  });
  const applied = await call(aSocket, 'item:use', {itemId: 'total-eclipse-card', targetIds: [b.selfId]});
  assert.equal(applied.ok, true, applied.error);
  let room = f.game.store.rooms.get(code), actor = room.players.get(b.selfId);
  const eclipse = actor.cardMarkers.find(marker => marker.itemId === 'total-eclipse-card');
  assert.ok(eclipse);
  assert.equal(eclipse.until, NOW + WEEK);

  // One shard authorizes exactly one use. The ban marker remains through the full week.
  actor.starShards = 1;
  const paidUse = await call(bSocket, 'item:use', {itemId: 'nebula-card'});
  assert.equal(paidUse.ok, true, paidUse.error);
  room = f.game.store.rooms.get(code); actor = room.players.get(b.selfId);
  assert.equal(actor.starShards, 0);
  assert.equal(actor.cardMarkers.find(marker => marker.itemId === 'total-eclipse-card')?.until, NOW + WEEK);
  assert.ok(actor.cardMarkers.some(marker => marker.itemId === 'nebula-card'));

  f.game.store.transact(() => { f.game.store.rooms.get(code).players.get(b.selfId).lastItemUseAt = 0; });
  const noFunds = await call(bSocket, 'item:use', {itemId: 'nebula-card'});
  assert.equal(noFunds.ok, false);
  assert.match(noFunds.error, /별 파편|부족/);
  room = f.game.store.rooms.get(code); actor = room.players.get(b.selfId);
  assert.equal(actor.starShards, 0);
  assert.equal(actor.inventory.find(item => item.id === 'nebula-card')?.quantity, 1);

  // A failed disk write must restore fee, item, marker, and use cooldown as one transaction.
  const before = structuredClone({actor, source: room.players.get(a.selfId), log: room.itemLog});
  const save = f.game.store.files.save.bind(f.game.store.files);
  f.game.store.files.save = () => { throw new Error('synthetic LV4 persistence write failure'); };
  try {
    const failedSave = await call(aSocket, 'shop:buy', {itemId: 'nebula-card', quantity: 1});
    assert.equal(failedSave.ok, false);
    assert.match(failedSave.error, /저장/);
  } finally { f.game.store.files.save = save; }
  room = f.game.store.rooms.get(code);
  assert.deepEqual({actor: room.players.get(b.selfId), source: room.players.get(a.selfId), log: room.itemLog}, before);

  // Restore one synthetic shard, then exercise rollback on a second item use.
  f.game.store.transact(() => {
    const target = f.game.store.rooms.get(code).players.get(b.selfId);
    target.starShards = 1; target.lastItemUseAt = 0;
  });
  const beforeFailedUse = structuredClone(f.game.store.rooms.get(code).players.get(b.selfId));
  f.game.store.files.save = () => { throw new Error('synthetic LV4 item-use write failure'); };
  try {
    const failedUse = await call(bSocket, 'item:use', {itemId: 'nebula-card'});
    assert.equal(failedUse.ok, false);
    assert.match(failedUse.error, /저장/);
  } finally { f.game.store.files.save = save; }
  room = f.game.store.rooms.get(code);
  assert.deepEqual(room.players.get(b.selfId), beforeFailedUse);

  // An insufficient balance leaves all use state unchanged.
  f.game.store.transact(() => {
    const target = f.game.store.rooms.get(code).players.get(b.selfId);
    target.starShards = 0; target.lastItemUseAt = 0;
  });
  const beforePoorUse = structuredClone(f.game.store.rooms.get(code).players.get(b.selfId));
  const poorUse = await call(bSocket, 'item:use', {itemId: 'nebula-card'});
  assert.equal(poorUse.ok, false);
  room = f.game.store.rooms.get(code);
  assert.deepEqual(room.players.get(b.selfId), beforePoorUse);

  // Student sockets cannot invoke teacher confirmation or end handlers, even with valid-looking data.
  const studentConfirm = await call(bSocket, 'lv4:teacher:confirm', {
    playerId: b.selfId, action: 'queen-writing', reference: 'synthetic-student-attempt'
  });
  assert.equal(studentConfirm.ok, false);
  assert.match(studentConfirm.error, /선생님만/);
  const studentEnd = await call(bSocket, 'lv4:teacher:end', {
    targetId: b.selfId, markerId: eclipse.id
  });
  assert.equal(studentEnd.ok, false);
  assert.match(studentEnd.error, /선생님만/);

  // Persisted synthetic LV4 state and seven-day marker restore after a server restart.
  f.game.store.transact(() => {
    const student = f.game.store.rooms.get(code).players.get(c.selfId);
    student.avatar.level = 4;
    student.inventory.push({id: 'supercluster-card', quantity: 1});
  });
  const selected = await call(cSocket, 'lv4:info');
  assert.equal(selected.ok, true, selected.error);
  const saved = JSON.parse(fs.readFileSync(path.join(f.dir, `${code}.json`), 'utf8'));
  const savedTarget = saved.students.find(student => student.id === b.selfId);
  assert.equal(savedTarget.cardMarkers.find(marker => marker.itemId === 'total-eclipse-card')?.until, NOW + WEEK);
  const savedHolder = saved.students.find(student => student.id === c.selfId);
  assert.deepEqual(savedHolder.lv4State, {stacks:0,nextStackAt:NOW+WEEK,claimIds:[],receipts:[],priorityUntil:null});

  await f.restart();
  const nextTeacher = await f.connect();
  assert.equal((await call(nextTeacher, 'room:open', {teacherKey: KEY, code})).ok, true);
  const resumedTarget = await join(await f.connect(), code, '2');
  const resumedHolder = await join(await f.connect(), code, '3');
  assert.equal(resumedTarget.ok, true, resumedTarget.error);
  assert.equal(resumedHolder.ok, true, resumedHolder.error);
  room = f.game.store.rooms.get(code);
  assert.equal(room.players.get(b.selfId).cardMarkers.find(marker => marker.itemId === 'total-eclipse-card')?.until, NOW + WEEK);
  assert.deepEqual(room.players.get(c.selfId).lv4State, {stacks:0,nextStackAt:NOW+WEEK,claimIds:[],receipts:[],priorityUntil:null});
  assert.equal(room.players.get(b.selfId).starShards, 0);
});

test('weekly stacks persist, claim once, and restore both stack and reward on a failed disk write',async t=>{
  const f=await fixture(t),{code}=await classroom(f),socket=await f.connect();
  const joined=await join(socket,code,'1');assert.ok(joined.ok);putAtShop(f,code,[joined.selfId]);
  assert.ok((await call(socket,'shop:buy',{itemId:'supercluster-card',quantity:1})).ok);
  const get=()=>f.game.store.rooms.get(code).players.get(joined.selfId);
  assert.equal((await call(socket,'lv4:info')).holding.stacks,0);
  const shards=get().starShards;f.advance(3*WEEK);
  assert.deepEqual((await call(socket,'lv4:info')).holding,{stacks:3,nextAt:NOW+4*WEEK});assert.equal(get().starShards,shards);
  const claim={reward:'card',requestId:'one-card-claim'};
  assert.ok((await call(socket,'lv4:holding:use',claim)).ok);
  assert.ok((await call(socket,'lv4:holding:use',claim)).ok);
  assert.equal(get().lv4State.stacks,1);assert.equal(get().inventory.find(i=>i.id==='star-card').quantity,1);
  assert.equal(get().inventory.find(i=>i.id==='supercluster-card').quantity,1);
  const before=structuredClone(get()),save=f.game.store.files.save.bind(f.game.store.files);
  f.game.store.files.save=()=>{throw Error('synthetic weekly stack write failure');};
  try{const result=await call(socket,'lv4:holding:use',{reward:'shards',requestId:'shard-claim'});assert.equal(result.ok,false);assert.match(result.error,/저장/);}
  finally{f.game.store.files.save=save;}
  assert.deepEqual(get(),before);
  assert.ok((await call(socket,'lv4:holding:use',{reward:'shards',requestId:'shard-claim'})).ok);
  assert.equal(get().lv4State.stacks,0);assert.equal(get().starShards,shards+4);
  await f.restart();const teacher=await f.connect();assert.ok((await call(teacher,'room:open',{teacherKey:KEY,code})).ok);
  const resumed=await f.connect();assert.ok((await join(resumed,code,'1')).ok);
  assert.equal(get().lv4State.stacks,0);assert.equal(get().starShards,shards+4);assert.equal(get().inventory.find(i=>i.id==='star-card').quantity,1);
  assert.ok((await call(resumed,'lv4:holding:use',claim)).ok);assert.equal(get().inventory.find(i=>i.id==='star-card').quantity,1);
  f.advance(WEEK);assert.equal((await call(resumed,'lv4:info')).holding.stacks,1);
  // 실제 판매는 먼저 지난 기간을 정산한 뒤 보유 중단하며, 재구매는 새 주기를 시작합니다.
  putAtShop(f,code,[joined.selfId]);assert.ok((await call(resumed,'shop:sell',{itemId:'supercluster-card',quantity:1})).ok);
  assert.equal(get().lv4State.nextStackAt,null);f.advance(2*WEEK);
  assert.equal((await call(resumed,'lv4:info')).holding.stacks,1);
  assert.equal((await call(resumed,'lv4:holding:use',{reward:'shards',requestId:'without-card'})).ok,false);
  assert.ok((await call(resumed,'shop:buy',{itemId:'supercluster-card',quantity:1})).ok);
  assert.equal((await call(resumed,'lv4:info')).holding.stacks,1);assert.equal(get().lv4State.nextStackAt,NOW+7*WEEK);
});
