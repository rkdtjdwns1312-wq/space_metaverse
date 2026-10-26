import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {parseEnv} from 'node:util';
import {createPrivateEnvironment} from '../deploy/init-env.mjs';

function temporary(t){
  const directory=mkdtempSync(join(tmpdir(),'deployment-test-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));return directory;
}

test('new deployment generates distinct private secrets and cannot overwrite an existing configuration',t=>{
  const directory=temporary(t),first=join(directory,'first.env'),second=join(directory,'second.env');
  createPrivateEnvironment(first);createPrivateEnvironment(second);
  const before=readFileSync(first,'utf8'),a=parseEnv(before),b=parseEnv(readFileSync(second,'utf8'));
  assert.match(a.TEACHER_KEY,/^[a-f0-9]{64}$/);assert.match(a.ADMIN_PASSWORD,/^[A-Za-z0-9_-]{32}$/);
  assert.notEqual(a.TEACHER_KEY,b.TEACHER_KEY);assert.notEqual(a.ADMIN_PASSWORD,b.ADMIN_PASSWORD);
  assert.equal(a.HOST,'127.0.0.1');assert.equal(a.PUBLIC_ORIGIN,'https://woozooclass.kr');
  assert.equal(a.DATA_DIR,'/var/lib/woozooclass/classes');assert.equal(a.MAX_ACTIVE_ROOMS,'1');
  assert.equal(a.STUDENT_HOURS,'true');
  if(process.platform!=='win32')assert.equal(statSync(first).mode&0o777,0o600);
  assert.throws(()=>createPrivateEnvironment(first),{code:'EEXIST'});
  assert.equal(readFileSync(first,'utf8'),before);
  assert.throws(()=>createPrivateEnvironment('relative.env'),/absolute/);
});

test('deployment startup refuses the lock of a live process and preserves it',t=>{
  const directory=temporary(t),classes=join(directory,'classes');mkdirSync(classes);
  const lock=join(classes,'.writer.lock'),contents=JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()});
  writeFileSync(lock,contents);
  const result=spawnSync(process.execPath,['deploy/prepare-store.mjs'],{cwd:resolve('.'),env:{...process.env,DATA_DIR:classes},encoding:'utf8'});
  assert.equal(result.status,1);assert.match(result.stderr,/사용 중인 서버/);
  assert.equal(readFileSync(lock,'utf8'),contents);
});

test('deployment startup recovers only a stopped writer and rejects a relative data directory',t=>{
  const directory=temporary(t),classes=join(directory,'classes');mkdirSync(classes);
  const stopped=spawnSync(process.execPath,['-e','process.exit(0)']);assert.equal(stopped.status,0);
  writeFileSync(join(classes,'.writer.lock'),JSON.stringify({pid:stopped.pid,startedAt:new Date().toISOString()}));
  const recovered=spawnSync(process.execPath,['deploy/prepare-store.mjs'],{env:{...process.env,DATA_DIR:classes},encoding:'utf8'});
  assert.equal(recovered.status,0,recovered.stderr);assert.deepEqual(readdirSync(classes),[]);
  const denied=spawnSync(process.execPath,['deploy/prepare-store.mjs'],{env:{...process.env,DATA_DIR:'data/classes'},encoding:'utf8'});
  assert.equal(denied.status,1);assert.match(denied.stderr,/absolute/);
});

test('production entry point boots a new empty private store and serves no private files',async t=>{
  const directory=temporary(t),environment=join(directory,'app.env'),classes=join(directory,'classes');
  createPrivateEnvironment(environment);const settings=parseEnv(readFileSync(environment,'utf8'));
  const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
  const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
  const child=spawn(process.execPath,['server/index.js'],{cwd:resolve('.'),env:{...process.env,...settings,PORT:String(port),DATA_DIR:classes,CRAFTING_RECIPES_FILE:join(directory,'absent-recipes.json')},stdio:['ignore','pipe','pipe']});
  let output='',errors='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);
  try{
    const started=Date.now();
    while(!output.includes('Cyber Classroom ready')){
      if(child.exitCode!==null)throw new Error(`Application exited: ${errors}`);
      if(Date.now()-started>15000)throw new Error('Application startup timed out.');
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    const base=`http://127.0.0.1:${port}`,health=await (await fetch(base+'/health')).json();
    assert.equal(health.ok,true);assert.equal(health.persistent,true);assert.equal(health.publicOrigin,'https://woozooclass.kr');
    assert.equal(readdirSync(classes).filter(name=>name.endsWith('.json')).length,0);
    for(const path of ['/.env','/data/classes/','/deploy/','/server/index.js'])assert.equal((await fetch(base+path)).status,404,path);
    const response=await fetch(base+'/socket.io/?EIO=4&transport=polling',{headers:{Origin:'https://woozooclass.kr'}});
    assert.equal(response.status,200);assert.ok((await response.text()).startsWith('0'));
    assert.equal(output.includes(settings.TEACHER_KEY),false);assert.equal(output.includes(settings.ADMIN_PASSWORD),false);
  }finally{
    if(child.exitCode===null){const closed=once(child,'exit');child.kill('SIGTERM');await closed;}
  }
});
