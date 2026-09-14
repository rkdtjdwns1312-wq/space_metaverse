import fs from 'node:fs';
import path from 'node:path';

const CODE_PATTERN = /^[A-Z2-9]{6}$/;
const FILE_PATTERN = /^[A-Z2-9]{6}\.json$/;

function validateCode(code) {
  if (typeof code !== 'string' || !CODE_PATTERN.test(code)) {
    throw new Error(`잘못된 교실 코드입니다: ${String(code)}`);
  }
  return code;
}

function syncDirectory(directory) {
  try {
    const fd = fs.openSync(directory, 'r');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  } catch (error) {
    // Windows 등 디렉터리 fsync를 지원하지 않는 플랫폼에서는 건너뛴다.
    if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM', 'EBADF'].includes(error.code)) throw error;
  }
}

export class ClassFileStore {
  constructor(directory) {
    this.directory = path.resolve(directory);
    fs.mkdirSync(this.directory, { recursive: true });
    this.lockPath = path.join(this.directory, '.writer.lock');
    try {
      this.lockFd = fs.openSync(this.lockPath, 'wx', 0o600);
    } catch (error) {
      throw new Error(`저장소를 잠글 수 없습니다(이미 사용 중일 수 있습니다): ${error.message}`, { cause: error });
    }
    this.closed = false;
    // 강제 종료 후에는 살아 있는 서버가 없는지 확인하고 이 잠금 파일만 수동으로 해제합니다.
    this.lockIdentity=JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()});
    try {fs.writeFileSync(this.lockFd,this.lockIdentity);fs.fsyncSync(this.lockFd);}
    catch(error){fs.closeSync(this.lockFd);fs.unlinkSync(this.lockPath);throw error;}
  }

  loadAll() {
    if(this.closed)throw new Error('이미 닫힌 저장소입니다.');
    const names = fs.readdirSync(this.directory).filter((name) => FILE_PATTERN.test(name));
    return names.sort().map((name) => {
      const filenameCode = name.slice(0, 6);
      let value;
      try {
        value = JSON.parse(fs.readFileSync(path.join(this.directory, name), 'utf8'));
      } catch (error) {
        throw new Error(`저장 파일을 읽을 수 없습니다(${name}): ${error.message}`, { cause: error });
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`저장 파일 envelope가 올바르지 않습니다: ${name}`);
      }
      if (value.schemaVersion !== 1) {
        throw new Error(`알 수 없는 저장 schemaVersion입니다(${name}): ${String(value.schemaVersion)}`);
      }
      if (typeof value.code !== 'string' || !CODE_PATTERN.test(value.code) || value.code !== filenameCode) {
        throw new Error(`저장 파일의 교실 코드가 파일명과 일치하지 않습니다: ${name}`);
      }
      return value;
    });
  }

  save(record) {
    if(this.closed)throw new Error('이미 닫힌 저장소입니다.');
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('저장할 record가 올바르지 않습니다.');
    const code = validateCode(record.code);
    const target = path.join(this.directory, `${code}.json`);
    const temp = path.join(this.directory, `.${code}.${process.pid}.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
    const envelope = { ...record, schemaVersion: 1 };
    let fd;
    try {
      fd = fs.openSync(temp, 'wx', 0o600);
      fs.writeFileSync(fd, JSON.stringify(envelope), 'utf8');
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = undefined;
      fs.renameSync(temp, target);
      // rename이 완료되면 교체는 이미 확정됐습니다. 이후 디렉터리 동기화 실패를
      // '기존 파일이 보존된 실패'라고 돌려주면 메모리 rollback과 파일 내용이 달라집니다.
      try {syncDirectory(this.directory);}catch(error){console.error('저장 폴더 동기화 확인 필요:',error.code);}
    } catch (error) {
      if (fd !== undefined) { try { fs.closeSync(fd); } catch {} }
      try { fs.unlinkSync(temp); } catch (cleanupError) { if (cleanupError.code !== 'ENOENT') {} }
      throw new Error(`저장에 실패했습니다(${code}): ${error.message}`, { cause: error });
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try { fs.closeSync(this.lockFd); } finally {
      if(fs.existsSync(this.lockPath)&&fs.readFileSync(this.lockPath,'utf8')===this.lockIdentity)fs.unlinkSync(this.lockPath);
    }
  }
}
