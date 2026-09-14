import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {startLocalClassroom,runningClassroom} from '../scripts/local-state.mjs';
const teacherKey='local-start-test-only-not-real-key';
async function freePort(){const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(r=>server.close(r));return port;}
test('fresh startup and repeated startup reuse same live server without touching its lock',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'class-local-'));let game;t.after(async()=>{if(game)await game.close();await rm(dir,{recursive:true,force:true});});
 const port=await freePort(),first=await startLocalClassroom({port,dataDir:dir,teacherKey});game=first.game;assert.equal(first.recovered,false);
 const before=await readFile(join(dir,'.writer.lock'),'utf8');game.setPublicOrigin('https://test.example');
 const second=await startLocalClassroom({port,dataDir:dir,teacherKey});assert.equal(second.game,undefined);assert.equal(second.existing.publicOrigin,'https://test.example');assert.equal(await readFile(join(dir,'.writer.lock'),'utf8'),before);
});
test('a stopped process lock is recovered while unrelated classroom files stay unchanged',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'class-stopped-'));let game;t.after(async()=>{if(game)await game.close();await rm(dir,{recursive:true,force:true});});
 const child=spawn(process.execPath,['-e',''],{windowsHide:true});const deadPid=child.pid;await once(child,'exit');
 await writeFile(join(dir,'.writer.lock'),JSON.stringify({pid:deadPid}));await writeFile(join(dir,'preserved.txt'),'기존 저장 자료');
 const started=await startLocalClassroom({port:await freePort(),dataDir:dir,teacherKey});game=started.game;assert.equal(started.recovered,true);assert.equal(await readFile(join(dir,'preserved.txt'),'utf8'),'기존 저장 자료');
});
test('live owner and corrupt lock are preserved; unrelated HTTP service is not reused',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'class-safe-lock-'));const other=createServer((req,res)=>res.end('{"ok":true}'));t.after(async()=>{await new Promise(r=>other.close(r));await rm(dir,{recursive:true,force:true});});
 const live=JSON.stringify({pid:process.pid});await writeFile(join(dir,'.writer.lock'),live);
 await assert.rejects(startLocalClassroom({port:await freePort(),dataDir:dir,teacherKey}),/사용 중/);assert.equal(await readFile(join(dir,'.writer.lock'),'utf8'),live);
 await writeFile(join(dir,'.writer.lock'),'broken');await assert.rejects(startLocalClassroom({port:await freePort(),dataDir:dir,teacherKey}),/잠금 정보/);assert.equal(await readFile(join(dir,'.writer.lock'),'utf8'),'broken');
 other.listen(0,'127.0.0.1');await once(other,'listening');await assert.rejects(runningClassroom(other.address().port),/다른 프로그램/);
});
