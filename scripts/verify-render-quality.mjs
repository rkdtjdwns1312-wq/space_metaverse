// Isolated presentation checks; no production connection or classroom data.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {mapOf} from '../shared/config.js';
const key='render-quality-isolated',game=createClassroomServer({teacherKey:key,studentHours:false,teacherManagedAccounts:false});
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
const checks=[],errors=[];mkdirSync('.local/performance',{recursive:true});
try{
  const {port}=await game.listen(),page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:2});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+port);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);
  await fillNewClass(page,['화면검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  for(let i=0;i<12&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');
  const room=game.store.rooms.get(await page.locator('#room-code').textContent()),teacher=[...room.players.values()].find(p=>p.role==='teacher');
  const refresh=()=>game.io.to(teacher.socketId).emit('room:state',game.store.snapshot(room,teacher,Date.now()));
  async function selectMode(mode){
    await page.locator('#control-settings-open').click();await page.locator('#render-quality-select').selectOption(mode);
    await page.locator('#control-settings-save').click();await page.locator('#control-settings-close').click();
    await page.waitForFunction(mode=>document.querySelector('#world').dataset.renderMode===mode,mode);
    assert.equal(await page.evaluate(()=>localStorage.getItem('woozooclass-render-quality-v1')),mode);
  }
  await page.waitForFunction(()=>document.querySelector('#world').dataset.artStatus==='ready');
  for(const mode of ['normal','low','auto']){
    await selectMode(mode);
    const dimensions=await page.locator('#world').evaluate(c=>({css:c.getBoundingClientRect().width,pixels:c.width,dpr:+c.dataset.renderDpr}));
    if(mode==='low'){assert.equal(dimensions.dpr,1);assert.ok(Math.abs(dimensions.pixels-dimensions.css)<=1);}
    if(mode==='normal'){assert.equal(dimensions.dpr,2);assert.ok(Math.abs(dimensions.pixels-dimensions.css*2)<=1);}
  }
  checks.push('PC gear settings auto/normal/low, saved values and DPR');
  const movement={};
  for(const mode of ['normal','low']){
    await selectMode(mode);Object.assign(teacher,{x:1800,y:1400,input:{x:0,y:0,at:0}});refresh();await page.waitForTimeout(250);
    const start=teacher.x;await page.locator('#world').focus();await page.keyboard.down('ArrowRight');await page.waitForTimeout(500);await page.keyboard.up('ArrowRight');await page.waitForTimeout(100);
    movement[mode]=teacher.x-start;assert.ok(movement[mode]>100,`${mode} movement reached ${movement[mode]}`);
  }
  assert.ok(Math.abs(movement.normal-movement.low)<100,JSON.stringify(movement));
  checks.push('keyboard movement remains independent of render FPS');
  const life=mapOf('space-plaza').objects.find(o=>o.kind==='life-star');Object.assign(teacher,{x:life.x+life.radius+30,y:life.y,input:{x:0,y:0,at:0}});refresh();
  await page.waitForFunction(()=>document.querySelector('#interact-prompt').dataset.objectId==='life-star');
  const hint=await page.locator('#interact-prompt').boundingBox();assert.ok(hint.x>=0&&hint.y>=0&&hint.x+hint.width<=1280&&hint.y+hint.height<=800);
  await page.locator('#touch-interact').click();checks.push('nearby hint remains onscreen and interaction is clickable after DPR change');
  for(const size of [{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(size);await page.locator('#control-settings-open').click();
    await page.locator('#render-quality-select').scrollIntoViewIfNeeded();
    const box=await page.locator('#render-quality-select').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=size.width&&box.y>=0&&box.y+box.height<=size.height);
    await page.screenshot({path:`.local/performance/quality-settings-${size.width}.png`});
    await page.locator('#control-settings-close').click();
  }
  checks.push('portrait and landscape mobile settings fit and close');
  await page.reload();assert.equal(await page.evaluate(()=>localStorage.getItem('woozooclass-render-quality-v1')),'low');
  await page.setViewportSize({width:1280,height:800});
  const fixture=await page.evaluate(async()=>{
    const {createWorld}=await import('/world.js'),{mapOf}=await import('/shared/config.js');
    const map=mapOf('sleeping-stars-4'),x=map.width/2,y=map.height/2,now=Date.now();
    const canvas=document.createElement('canvas');canvas.id='quality-fixture';canvas.style='position:fixed;inset:0;width:1280px;height:800px;max-height:none;min-height:0;aspect-ratio:auto;object-fit:fill;z-index:99999';document.body.append(canvas);
    const ctx=canvas.getContext('2d'),seen=new Set();window.__qualitySeen=seen;
    for(const method of ['fillText','stroke','drawImage']){const original=ctx[method];ctx[method]=function(...args){
      if(method==='fillText')seen.add('text:'+args[0]);if(method==='stroke')seen.add('stroke:'+ctx.strokeStyle);if(method==='drawImage'&&args[0]?.src)seen.add('image:'+new URL(args[0].src).pathname);
      return original.apply(this,args);
    };}
    const self={id:'fixture-self',role:'teacher',nickname:'검사',connected:true,mapId:map.id,x,y,avatar:{level:1},equipment:[],inventory:[]};
    const effects={serverNow:now,paths:[{x1:x-300,y1:y+160,x2:x+300,y2:y+160,width:40,endsAt:now+60000}],projectiles:[{x:x-240,y:y+40,radius:30,endsAt:now+60000}],chasers:[{x:x+240,y:y+40,radius:35,endsAt:now+60000}],blueOrbs:[{x:x+200,y:y-60,radius:40,endsAt:now+60000,phase:'landed'}],galaxies:[{x:x-200,y:y-60,radius:50,endsAt:now+60000,dx:1,dy:0}]};
    const monster={id:'truth-fixture',typeId:'truth-creator',alive:true,mapId:map.id,x,y:y-150,radius:100,hp:30000,maxHp:30000,mp:100,maxMp:100,truthCreatorEffects:effects,warning:{x,y:y+90,radius:95,endsAt:now+60000}};
    const world=createWorld(canvas);window.__qualityWorld=world;world.setRoom({players:[self],planets:[],monsters:[monster],truthCreator:{state:'active'}},self.id);
    world.positions({mapId:map.id,positions:[],water:[{kind:'cancer',stage:2,playerId:self.id,mapId:map.id,durationMs:60000,elapsedMs:1000}]});
    return {mapId:map.id,x,y};
  });
  await page.waitForFunction(()=>document.querySelector('#quality-fixture').dataset.artStatus==='ready');
  await page.waitForFunction(()=>document.querySelector('#quality-fixture').dataset.monsterWarningCount==='1');
  assert.equal(await page.locator('#quality-fixture').getAttribute('data-render-quality'),'low');checks.push('refresh restores actual world low-quality renderer');
  for(const mode of ['normal','low']){
    await page.evaluate(mode=>{window.__qualitySeen.clear();window.__qualityWorld.setQuality(mode);},mode);
    await page.waitForTimeout(350);
    const seen=await page.evaluate(()=>[...window.__qualitySeen]);
    for(const asset of ['truth-creator-orb.png','truth-creator-chaser.png','truth-creator-blue.png','truth-creator-galaxy.png'])assert.ok(seen.some(s=>s.endsWith(asset)),`${mode}: ${asset}`);
    assert.ok(seen.some(s=>/^text:\d+초$/.test(s)),`${mode}: blue orb deadline`);
    assert.ok(seen.some(s=>/^text:\d+\.\d$/.test(s)),`${mode}: warning countdown`);
    assert.ok(seen.includes('stroke:#fffbea'),`${mode}: ground path core`);
    assert.ok(seen.includes('text:진리의 창조자'),`${mode}: boss label`);
    await page.screenshot({path:`.local/performance/quality-hazards-${mode}.png`});
  }
  checks.push('normal/low retain truth path, four projectile classes, boss labels and both countdowns');
  const initial=await page.locator('#quality-fixture').getAttribute('data-self-render-x');
  await page.evaluate(({x,y})=>{
    const packet={mapId:'space-plaza',positions:[['fixture-self',x+40,y]],monsters:[],water:[]};window.__qualityWorld.positions(packet);window.__qualityWorld.monsters(packet);
  },fixture);
  await page.waitForTimeout(350);
  assert.equal(await page.locator('#quality-fixture').getAttribute('data-monster-count'),'1');
  assert.equal(await page.locator('#quality-fixture').getAttribute('data-water-aura-count'),'1');
  assert.notEqual(await page.locator('#quality-fixture').getAttribute('data-self-render-x'),initial);
  await page.evaluate(({mapId})=>{const packet={mapId,positions:[],monsters:[],water:[]};window.__qualityWorld.positions(packet);window.__qualityWorld.monsters(packet);},fixture);
  await page.waitForFunction(()=>document.querySelector('#quality-fixture').dataset.monsterCount==='0'&&document.querySelector('#quality-fixture').dataset.waterAuraCount==='0');
  checks.push('stale map packet cannot clear monsters/effects, positions still update; current full-empty packet clears');
  assert.deepEqual(errors,[]);writeFileSync('.local/performance/quality-verification.json',JSON.stringify({checks,movement,errors},null,2));console.log(JSON.stringify({checks,movement,errors},null,2));
}finally{await browser.close();await game.close();}
