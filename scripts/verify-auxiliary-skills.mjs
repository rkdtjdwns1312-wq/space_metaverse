import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {ensureVitals} from '../server/vitals.js';

const dataDir=await mkdtemp(join(tmpdir(),'space-auxiliary-skills-'));
const teacherKey=randomBytes(24).toString('hex');
const game=createClassroomServer({teacherKey,studentHours:false});
const address=await game.listen();
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[],checks=[];let teacher;
const check=message=>{checks.push(message);console.log(`Auxiliary skills ${checks.length}: ${message}`);};
try{
  const probe=await browser.newPage({viewport:{width:1280,height:800}});probe.setDefaultTimeout(8000);
  probe.on('pageerror',error=>errors.push(error.message));
  await probe.goto(`http://127.0.0.1:${address.port}/`,{waitUntil:'domcontentloaded',timeout:20000});
  await probe.locator('.combat-buttons').waitFor({state:'attached'});
  await probe.evaluate(async()=>{
    const {createAuxiliarySkills}=await import('/auxiliary-skills.js');
    const state={player:{role:'student',avatar:{level:5,constellationId:'aries'}},canAct:true,transforms:0,toasts:[]};
    state.instance=createAuxiliarySkills({getPlayer:()=>state.player,canAct:()=>state.canAct&&!document.querySelector('dialog:modal'),toast:m=>state.toasts.push(m),transform:()=>state.transforms++});
    state.group=[...document.querySelectorAll('.auxiliary-skills')].at(-1);state.group.dataset.probe='true';
    state.group.hidden=false;state.group.style.cssText='position:fixed;right:16px;bottom:16px;z-index:9999;display:flex;gap:8px';state.instance.update();
    const input=document.createElement('input');input.id='aux-input-probe';document.body.append(input);
    const button=document.createElement('button');button.id='aux-button-probe';document.body.append(button);
    const world=document.createElement('div');world.id='aux-world-probe';world.tabIndex=0;document.body.append(world);
    window.__auxProbe=state;
  });
  assert.equal(await probe.locator('.auxiliary-skill[data-skill-slot="transformation"]').count(),1);
  assert.equal(await probe.locator('.auxiliary-skill').count(),1);
  await probe.locator('#aux-world-probe').focus();
  await probe.keyboard.press('1');assert.equal(await probe.evaluate(()=>window.__auxProbe.transforms),1);
  await probe.keyboard.press('2');await probe.keyboard.press('3');
  assert.equal(await probe.evaluate(()=>window.__auxProbe.transforms),1);
  await probe.locator('.auxiliary-skill[data-skill-slot="transformation"]').evaluate(button=>button.click());
  assert.equal(await probe.evaluate(()=>window.__auxProbe.transforms),2);
  await probe.keyboard.down('1');await probe.keyboard.down('1');await probe.keyboard.up('1');
  assert.equal(await probe.evaluate(()=>window.__auxProbe.transforms),3);
  check('LV5 transformation slot only; key 1 and touch/click invoke transform, keys 2/3 do nothing, held-key repeat is ignored');

  await probe.evaluate(()=>{const d=document.createElement('dialog');d.id='aux-modal-probe';document.body.append(d);d.showModal();});
  await probe.keyboard.press('1');
  await probe.evaluate(()=>document.querySelector('#aux-modal-probe').close());
  await probe.locator('#aux-input-probe').focus();await probe.keyboard.press('1');
  await probe.locator('#aux-button-probe').focus();await probe.keyboard.press('1');
  await probe.evaluate(()=>{window.__auxProbe.canAct=false;});
  await probe.locator('#aux-world-probe').focus();await probe.keyboard.press('1');
  assert.equal(await probe.evaluate(()=>window.__auxProbe.transforms),3);
  check('modal, input/button focus, and unavailable action state do not trigger transformation');

  await probe.close();

  const requests=[];game.io.on('connection',socket=>socket.onAny(event=>{if(['combat:skill','combat:transform'].includes(event))requests.push({id:socket.id,event});}));
  teacher=io(`http://127.0.0.1:${address.port}`,{transports:['websocket'],reconnection:false});
  await new Promise((resolve,reject)=>{teacher.once('connect',resolve);teacher.once('connect_error',reject);});
  const created=await teacher.timeout(5000).emitWithAck('room:create',{teacherKey,allowedNames:['보조검증']});assert.equal(created.ok,true);
  const page=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/`,{waitUntil:'domcontentloaded',timeout:20000});
  await page.locator('#join-code').fill(created.room.code);await page.locator('#nickname').fill('보조검증');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  const room=game.store.rooms.get(created.room.code),actor=[...room.players.values()].find(p=>p.nickname==='보조검증');
  const publish=()=>game.io.to(actor.socketId).emit('room:state',game.store.snapshot(room,actor));
  const setLevel=async(level,role='student')=>{
    actor.role=role;actor.avatar={...actor.avatar,level,form:level>=2?'constellation':'asteroid',constellationId:level>=2?'aries':null};publish();
    await page.waitForFunction(({level,role})=>{
      const expected=level===5&&role!=='teacher'?1:0;
      return document.querySelectorAll('.auxiliary-skill').length===expected&&
        document.querySelectorAll('.auxiliary-skill[data-skill-slot="transformation"]').length===expected&&
        document.getElementById('touch-skill').disabled===(level<2&&role!=='teacher');
    },{level,role});await page.locator('#world').focus();
  };
  for(const level of [1,2,3,4,5]){
    await setLevel(level);
    const locked=level===1;
    assert.equal(await page.locator('#touch-skill').isDisabled(),locked);
    assert.equal(await page.locator('.auxiliary-skill').count(),level===5?1:0);
  }
  check('real classroom: Q/E both locked at LV1, both unlocked at LV2–5, no auxiliary slot LV1–4 and exactly one transformation slot at LV5');
  await page.locator('#touch-skill').click();await page.waitForTimeout(150);
  assert.ok(requests.some(r=>r.event==='combat:skill'));
  const before=requests.length;
  for(const key of ['1','2','3'])await page.keyboard.press(key);
  assert.equal(requests.length,before);
  await setLevel(5);await page.locator('#world').focus();
  const transformButton=page.locator('.auxiliary-skill[data-skill-slot="transformation"]');
  for(const [width,height] of [[1440,960],[390,844]]){
    await page.setViewportSize({width,height});
    const box=await transformButton.boundingBox();
    assert.ok(box&&box.width>0&&box.height>0&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  check('LV5 transformation slot is visible on desktop/mobile without horizontal overflow');
  await page.setViewportSize({width:1440,height:960});
  await page.locator('.auxiliary-skill[data-skill-slot="transformation"]').click();
  await page.waitForFunction(()=>document.querySelector('.auxiliary-skill.is-transforming')!==null||
    document.querySelector('.auxiliary-skill .skill-cooldown:not([hidden])')!==null);
  assert.equal(actor.transformation.active,true);assert.equal(ensureVitals(actor).hp,50);assert.equal(ensureVitals(actor).mp,50);
  const hp=await ensureVitals(actor).hp,mp=await ensureVitals(actor).mp;
  const box=await transformButton.boundingBox();assert.ok(box);
  const transformsBefore=()=>requests.filter(r=>r.event==='combat:transform').length;
  const countBefore=transformsBefore();await page.keyboard.press('2');await page.keyboard.press('3');
  assert.equal(transformsBefore(),countBefore);
  await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(100);
  assert.equal(transformsBefore(),countBefore+1);
  assert.equal(ensureVitals(actor).hp,hp);assert.equal(ensureVitals(actor).mp,mp);
  check('real LV5 1-key transformation calls combat:transform and restores HP/MP to 50; 2/3 do not send further requests');
  await setLevel(1,'teacher');assert.equal(await page.locator('.auxiliary-skill').count(),0);
  await page.locator('#touch-attack').click();await page.waitForTimeout(100);
  assert.equal(transformsBefore(),countBefore+1);
  check('teacher receives no auxiliary transformation slot');
  assert.deepEqual(errors,[]);
  await mkdir('.local',{recursive:true});await writeFile('.local/auxiliary-skills-browser-result.json',JSON.stringify({checks,pageErrors:errors},null,2));
  console.log(JSON.stringify({checks,pageErrors:errors},null,2));await page.close();
}catch(error){await mkdir('.local',{recursive:true});await writeFile('.local/auxiliary-skills-browser-failure.txt',`${error.stack}\n${JSON.stringify(errors)}`);throw error;}
finally{teacher?.disconnect();await browser.close();await game.close();await rm(dataDir,{recursive:true,force:true});}
