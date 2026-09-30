import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {attackPowerOf} from '../shared/combat.js';

let now=Date.now();
const teacherKey=randomBytes(24).toString('hex'),game=createClassroomServer({teacherKey,studentHours:false,clock:()=>now});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const teacher=io(url,{transports:['websocket'],reconnection:false,autoConnect:false});
const page=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});page.setDefaultTimeout(10000);
const errors=[],checks=[];page.on('pageerror',error=>errors.push(error.message));
const check=message=>{checks.push(message);console.log(`Sagittarius ${checks.length}: ${message}`);};
try{
  await mkdir('.local',{recursive:true});
  await new Promise((resolve,reject)=>{teacher.once('connect',resolve);teacher.once('connect_error',reject);teacher.connect();});
  const created=await teacher.timeout(5000).emitWithAck('room:create',{teacherKey,allowedNames:['궁수검사']});assert.equal(created.ok,true);
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
  await page.locator('#join-code').fill(created.room.code);await page.locator('#nickname').fill('궁수검사');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  const room=game.store.rooms.get(created.room.code),player=[...room.players.values()].find(p=>p.nickname==='궁수검사');
  const monster=[...monstersOf(room).values()][0];
  for(const m of room.monsters.values()){m.nextAttackAt=Number.MAX_SAFE_INTEGER;m.x=1300;m.y=1000;}
  const publish=()=>game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
  const setLevel=async level=>{
    Object.assign(player,{mapId:'star-origin-1',x:500,y:450,facing:{x:1,y:0},battleVitals:null,sagittariusCooldowns:{},transformation:null});
    Object.assign(player.avatar,{level,constellationId:'sagittarius',form:'constellation'});room.sagittariusCasts?.clear();ensureVitals(player);
    Object.assign(monster,{mapId:'star-origin-1',x:700,y:450,hp:10000,maxHp:10000,nextAttackAt:Number.MAX_SAFE_INTEGER});publish();
    await page.waitForFunction(()=>document.querySelectorAll('#self-skill-slots button').length===3);
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#self-skill-slots button:disabled').count(),level===1?3:level<5?1:0,`profile transform lock at LV${level}`);
    assert.equal(await page.locator('#touch-skill').isDisabled(),level===1,`combat E lock at LV${level}`);
    assert.equal(await page.locator('.auxiliary-skill').count(),level===5?1:0,`auxiliary slot count at LV${level}`);
    await page.locator('#world').focus();
  };
  for(let level=1;level<=5;level++){
    await setLevel(level);
    assert.equal(await page.locator('#touch-attack').isDisabled(),level===1);
    assert.equal(await page.locator('#touch-skill').isDisabled(),level===1);
    assert.equal(await page.locator('.auxiliary-skill[data-skill-slot="transformation"]').count(),level===5?1:0);
  }
  check('LV1 Q/E locked; LV2–4 Q/E unlocked with transform locked; LV5 unlocks all three profile buttons and one transformation slot');

  await page.evaluate(()=>document.getElementById('avatar-dialog').showModal());
  await page.locator('#self-skill-slots button').nth(1).click();await page.locator('#skill-description-dialog').waitFor({state:'visible'});
  assert.match(await page.locator('#skill-description-text').textContent(),/300%.*마나 5.*5초/);
  await page.screenshot({path:'.local/293-sagittarius-description.png'});
  await page.locator('#skill-description-dialog button').click();await page.evaluate(()=>document.getElementById('avatar-dialog').close());
  check('profile E description reflects shared LV2 attack at 300%, MP5, and 5-second cooldown');

  await setLevel(2);await page.keyboard.press('q');await page.waitForFunction(()=>document.querySelector('#world').dataset.lastSagittariusSlot==='attack');
  assert.equal(ensureVitals(player).mp,10);
  assert.equal(await page.locator('#touch-attack img').getAttribute('src'),'/assets/skills/sagittarius/light-arrow.svg');
  await page.waitForTimeout(1050);await page.locator('#touch-attack').tap();await page.waitForTimeout(120);
  assert.equal(ensureVitals(player).mp,10);
  check('LV2 Q keyboard and touch use the same mana-free Sagittarius attack');

  await setLevel(2);
  const before=monster.hp;
  await page.keyboard.press('e');await page.waitForFunction(()=>document.querySelector('#world').dataset.lastSagittariusSlot==='0');
  assert.equal(ensureVitals(player).mp,5);assert.equal(before-monster.hp,attackPowerOf(2,'sagittarius')*3);
  await page.waitForFunction(()=>document.querySelector('#touch-skill .skill-cooldown')?.textContent==='5');
  await page.keyboard.press('e');await page.waitForTimeout(150);
  assert.equal(ensureVitals(player).mp,5);assert.equal(monster.hp,before-attackPowerOf(2,'sagittarius')*3);
  const oldSkill=await teacher.timeout(5000).emitWithAck('combat:skill',{slot:1});assert.equal(oldSkill.ok,false);
  check('LV2 E deals 3× attack damage, spends 5 MP, shows 5-second cooldown, rejects repeat and retired hunter slot');

  now+=5000;await page.waitForTimeout(120);const afterCooldown=monster.hp;
  await page.locator('#touch-skill').tap();await page.waitForTimeout(150);
  assert.equal(ensureVitals(player).mp,0);assert.equal(afterCooldown-monster.hp,attackPowerOf(2,'sagittarius')*3);
  check('E is usable again after five seconds through touch control');

  const transformCountBefore=player.transformation;
  await setLevel(5);await page.locator('#world').focus();await page.keyboard.press('1');
  const transformDeadline=Date.now()+3000;
  while(!player.transformation?.active&&Date.now()<transformDeadline)await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(player.transformation?.active,true,'server state confirms transformation after key 1');
  assert.equal(player.transformation.active,true);assert.equal(ensureVitals(player).hp,50);assert.equal(ensureVitals(player).mp,50);
  assert.notEqual(player.transformation,transformCountBefore);
  await page.screenshot({path:'.local/293-sagittarius-transformation.png'});
  await page.waitForFunction(()=>document.querySelector('.auxiliary-skill.is-transforming')!==null||
    document.querySelector('.auxiliary-skill .skill-cooldown:not([hidden])')!==null);
  check('LV5 key 1 starts transformation; server state confirms active and HP/MP are 50');

  // Reset the isolated fixture cooldown and publish a fresh LV5 state to exercise a successful touch activation.
  player.transformation=null;ensureVitals(player).hp=20;ensureVitals(player).mp=10;publish();
  await page.waitForFunction(()=>!document.querySelector('.auxiliary-skill.is-transforming'));
  const touchBox=await page.locator('.auxiliary-skill[data-skill-slot="transformation"]').boundingBox();assert.ok(touchBox);
  await page.touchscreen.tap(touchBox.x+touchBox.width/2,touchBox.y+touchBox.height/2);
  const touchDeadline=Date.now()+3000;
  while(!player.transformation?.active&&Date.now()<touchDeadline)await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(player.transformation?.active,true,'server state confirms transformation after touch tap');
  assert.equal(ensureVitals(player).hp,50);assert.equal(ensureVitals(player).mp,50);
  await page.waitForFunction(()=>document.querySelector('.auxiliary-skill.is-transforming')!==null||
    document.querySelector('.auxiliary-skill .skill-cooldown:not([hidden])')!==null);
  check('fresh LV5 fixture: touch activation independently starts transformation and restores HP/MP');

  for(const width of [1440,430]){
    await page.setViewportSize({width,height:width===430?932:960});
    const geometry=await page.evaluate(()=>({viewport:innerWidth,boxes:(()=>{
      const selectors=['#touch-attack','#touch-skill','.auxiliary-skill[data-skill-slot="transformation"]'];
      return selectors.map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};});
    })()}));
    assert.equal(geometry.boxes.length,3);assert.ok(geometry.boxes.every(r=>r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.right<=geometry.viewport&&r.bottom<= (width===430?932:960)));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`.local/293-sagittarius-layout-${width}.png`});
  }
  check('desktop/mobile Q, E, and transformation controls remain visible without horizontal overflow');
  assert.deepEqual(errors,[]);check('browser has no page errors');
  await writeFile('.local/sagittarius-browser-result.json',JSON.stringify({checks,pageErrors:errors},null,2));
  console.log(`PASS ${checks.length}`);
}catch(error){await mkdir('.local',{recursive:true});await writeFile('.local/sagittarius-browser-failure.txt',`${error.stack}\n${JSON.stringify(errors)}`);throw error;}
finally{teacher.disconnect();await browser.close();await game.close();}
