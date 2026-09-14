import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ClassFileStore } from '../server/store.js';

function tempDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'class-store-')); }

test('원자 저장 후 다시 읽을 수 있다', () => {
  const dir = tempDir();
  const store = new ClassFileStore(dir);
  const record = { code: 'AB2345', title: '테스트', planets: [] };
  store.save(record);
  assert.deepEqual(store.loadAll(), [{ schemaVersion: 1, ...record }]);
  store.close();
  const reloaded = new ClassFileStore(dir);
  assert.deepEqual(reloaded.loadAll(), [{ schemaVersion: 1, ...record }]);
  reloaded.close();
});

test('코드 경로 traversal을 거부한다', () => {
  const store = new ClassFileStore(tempDir());
  assert.throws(() => store.save({ code: '../x' }), /잘못된 교실 코드/);
  store.close();
});

test('손상 파일과 알 수 없는 schema를 거부한다', () => {
  for (const [name, contents, message] of [
    ['AB2345.json', '{', /저장 파일을 읽을 수 없습니다/],
    ['CD2345.json', '{"schemaVersion":99,"code":"CD2345"}', /알 수 없는 저장 schemaVersion/],
    ['EF2345.json', '{"schemaVersion":1,"code":"GH2345"}', /파일명과 일치/],
  ]) {
    const dir = tempDir(); fs.writeFileSync(path.join(dir, name), contents);
    const store = new ClassFileStore(dir);
    assert.throws(() => store.loadAll(), message);
    store.close();
  }
});

test('같은 디렉터리의 동시 소유를 거부하고 close 후 재획득한다', () => {
  const dir = tempDir(); const first = new ClassFileStore(dir);
  assert.throws(() => new ClassFileStore(dir), /저장소를 잠글 수 없습니다/);
  first.close();
  const second = new ClassFileStore(dir); second.close();
});

test('저장 실패 시 기존 정상 파일을 보존한다', () => {
  const dir = tempDir(); const store = new ClassFileStore(dir);
  const original = { code: 'AB2345', title: '기존' }; store.save(original);
  assert.throws(() => store.save({ code: 'AB2345', title: BigInt(1) }), /저장에 실패했습니다/);
  assert.deepEqual(store.loadAll(), [{ schemaVersion: 1, ...original }]);
  assert.deepEqual(fs.readdirSync(dir).filter((name) => name.endsWith('.tmp')), []);
  store.close();
});
