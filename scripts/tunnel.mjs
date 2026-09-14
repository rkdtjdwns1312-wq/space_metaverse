import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, mkdir, rename, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

const READY_TIMEOUT_MS = 60_000;
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;
const URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/;
const RELEASE_API = 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest';
const ASSET_NAME = 'cloudflared-windows-amd64.exe';

// Windows에서는 프로젝트 안의 .local 폴더에만 내려받는다.
const localDirectory = path.resolve(process.cwd(), '.local');
const localExecutable = path.join(localDirectory, 'cloudflared.exe');

function isWindows() {
  return process.platform === 'win32';
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'space-metaverse-tunnel' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`cloudflared release 조회 실패: HTTP ${response.status}`);
  return response.json();
}

async function downloadVerified(asset, destination) {
  // GitHub가 digest를 주지 않으면 검증할 근거가 없으므로 중단한다.
  if (typeof asset.digest !== 'string' || !asset.digest.startsWith('sha256:')) {
    throw new Error('cloudflared 다운로드 중단: GitHub 자산에 SHA-256 digest가 없습니다.');
  }
  const expected = asset.digest.slice('sha256:'.length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expected)) throw new Error('cloudflared 다운로드 중단: SHA-256 digest 형식이 올바르지 않습니다.');

  await mkdir(localDirectory, { recursive: true });
  const temporary = path.join(localDirectory, `.cloudflared-${process.pid}-${Date.now()}.tmp`);
  let written = 0;
  const hash = createHash('sha256');
  try {
    const response = await fetch(asset.browser_download_url, {
      headers: { 'User-Agent': 'space-metaverse-tunnel' },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok || !response.body) throw new Error(`cloudflared 다운로드 실패: HTTP ${response.status}`);
    const limited = response.body.pipeThrough(new TransformStream({
      transform(chunk, controller) {
        written += chunk.byteLength;
        if (written > MAX_DOWNLOAD_BYTES) {
          controller.error(new Error('cloudflared 다운로드 중단: 100MB 상한을 초과했습니다.'));
          return;
        }
        hash.update(chunk);
        controller.enqueue(chunk);
      },
    }));
    await pipeline(limited, createWriteStream(temporary, { flags: 'wx' }));
    if (hash.digest('hex').toLowerCase() !== expected) throw new Error('cloudflared 다운로드 중단: SHA-256 검증에 실패했습니다.');
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function resolveExecutable() {
  if (!isWindows()) return 'cloudflared';
  if (await fileExists(localExecutable)) return localExecutable;
  const release = await fetchJson(RELEASE_API);
  const asset = Array.isArray(release.assets) ? release.assets.find((item) => item.name === ASSET_NAME) : null;
  if (!asset?.browser_download_url) throw new Error(`cloudflared 자산을 찾지 못했습니다: ${ASSET_NAME}`);
  await downloadVerified(asset, localExecutable);
  return localExecutable;
}

// 준비가 끝난 뒤에만 반환하며, stop은 자식 프로세스를 정리한다.
export async function startTunnel({ port, onReady } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new TypeError('port는 1~65535 정수여야 합니다.');
  if (typeof onReady !== 'function') throw new TypeError('onReady 함수가 필요합니다.');

  const executable = await resolveExecutable();
  const child = spawn(executable, ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', `http://127.0.0.1:${port}`], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let readyCalled = false;
  const onExit=()=>child.kill();process.once('exit',onExit);child.once('exit',()=>process.off('exit',onExit));
  let output='';
  let settled = false;
  let timer;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const fail = (error) => {
    if (!settled) { settled = true; clearTimeout(timer); child.kill();rejectReady(error); }
  };
  const inspect = (chunk) => {
    if (readyCalled) return;
    output=(output+String(chunk)).slice(-8192);
    const match = output.match(URL_PATTERN);
    if (!match) return;
    readyCalled = true;
    try { onReady(match[0]); } catch (error) { fail(error); return; }
    settled = true;
    clearTimeout(timer);
    resolveReady({ child, stop });
  };
  child.stdout.on('data', inspect);
  child.stderr.on('data', inspect);
  child.once('error', (error) => fail(new Error(`cloudflared 프로세스 오류: ${error.message}`)));
  child.once('exit', (code, signal) => {
    if (!settled) fail(new Error(`cloudflared가 준비 전에 종료되었습니다 (code=${code}, signal=${signal ?? '없음'}).`));
  });
  timer = setTimeout(() => {
    child.kill();
    fail(new Error('cloudflared 준비 시간 초과(60초)로 종료했습니다.'));
  }, READY_TIMEOUT_MS);

  const stop = () => new Promise((resolve) => {
    clearTimeout(timer);
    if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
    child.once('exit', resolve);
    child.kill();
  });
  return ready;
}
