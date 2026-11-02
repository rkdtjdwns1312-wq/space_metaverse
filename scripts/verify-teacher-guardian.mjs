import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {monsterType,MONSTER_LEVEL_STATS} from '../shared/monsters.js';
const key='teacher-guardian-browser-secret',game=createClassroomServer({teacherKey:key,studentHours:false});
const {port}=await game.listen(),url='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const checks=[],errors=[];let student;
const check=text=>{checks.push(text);console.log(text);};
await mkdir('.local/teacher-combat',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await page.goto(url);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['1']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 for(let i=0;i<12&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');
 const room=[...game.store.rooms.values()][0],p=[...room.players.values()].find(p=>p.role==='teacher'),publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 await page.locator('.vitals-hp .vitals-label').filter({hasText:'HP 1000/1000'}).waitFor();await page.locator('.vitals-mp .vitals-label').filter({hasText:'MP 1000/1000'}).waitFor();assert.equal(p.avatar.level,6);
 await page.locator('#dock-avatar').click();assert.equal(await page.locator('#self-attack-power').textContent(),'공격력 · 100');assert.equal(await page.locator('#self-defense-power').textContent(),'방어력 · 0');
 await page.locator('#self-skill-slots button').nth(0).click();await page.locator('#skill-description-dialog').waitFor({state:'visible'});assert.match(await page.locator('#skill-description-text').textContent(),/작은 별 하나[\s\S]*100%[\s\S]*다치지/);await page.locator('#skill-description-dialog button').click();
 await page.locator('#self-skill-slots button').nth(1).click();await page.locator('#skill-description-dialog').waitFor({state:'visible'});const text=await page.locator('#skill-description-text').textContent();assert.match(text,/같은 맵의 모든 몬스터[\s\S]*100%[\s\S]*회복[\s\S]*쿨타임: 1초[\s\S]*마나소모: 10/);await page.screenshot({path:'.local/teacher-combat/skill-description.png'});await page.locator('#skill-description-dialog button').click();await page.keyboard.press('Escape');check('교사100/0/1000/1000·Q별1개·E동일맵회복/피해·MP10/1초설명');
 student=io(url,{transports:['websocket'],forceNew:true,reconnection:false});await new Promise((resolve,reject)=>{student.once('connect',resolve);student.once('connect_error',reject);});const joined=await student.timeout(5000).emitWithAck('room:join',{code:room.code,nickname:'1',pin:'1234'});assert(joined.ok,joined.error);const q=room.players.get(joined.selfId);chargeHuntingStation(q,'math');
 const m=[...monstersOf(room).values()].find(m=>m.typeId==='star-scorpion');room.monsters=new Map([[m.id,m]]);Object.assign(p,{mapId:m.mapId,x:700,y:600,facing:{x:1,y:0}});Object.assign(q,{mapId:m.mapId,x:820,y:600});Object.assign(q.avatar,{level:4,constellationId:'hercules'});ensureVitals(q).hp=5;
 Object.assign(m,{x:1100,y:600,hp:1000,maxHp:1000,nextAttackAt:Number.MAX_SAFE_INTEGER,nextDirectionAt:Number.MAX_SAFE_INTEGER,patrolStartedAt:Date.now()+60000});publish();await page.waitForFunction(()=>document.getElementById('minimap-title').textContent.includes('시작점'));await page.locator('#world').focus();await page.keyboard.press('q');
 await page.waitForFunction(()=>Number(document.getElementById('world').dataset.projectileCount)===1);assert.equal(room.projectiles.length,1);assert.equal(room.projectiles[0].kind,'teacher-star');assert.equal(m.hp,1000);await page.screenshot({path:'.local/teacher-combat/star-projectile.png'});await page.waitForFunction(()=>Number(document.getElementById('world').dataset.projectileCount)===0);
 const damage=100-(monsterType(m.typeId)?.defense??MONSTER_LEVEL_STATS[monsterType(m.typeId).level].defense);assert.equal(m.hp,1000-damage);assert.equal(ensureVitals(q).hp,5);check('실제Q 별1개비행·도착시공격력100%·학생통과무피해');
 ensureVitals(p).hp=700;ensureVitals(p).mp=1000;Object.assign(q,{x:2200,y:1700});publish();await page.locator('#world').focus();await page.keyboard.press('e');await page.locator('.vitals-mp .vitals-label').filter({hasText:'MP 990/1000'}).waitFor();assert.equal(ensureVitals(p).hp,800);assert.equal(ensureVitals(q).hp,90);assert.equal(m.hp,1000-damage*2);await page.screenshot({path:'.local/teacher-combat/healing-desktop.png'});
 await page.keyboard.press('e');assert.equal(ensureVitals(p).mp,990);check('실제E 본인100회복·멀리있는동료최대HP까지회복·몬스터피해·연타차단');
 await page.waitForTimeout(Math.max(0,p.teacherCooldownUntil-Date.now()+50));await page.setViewportSize({width:390,height:844});await page.locator('#touch-skill').tap();await page.locator('.vitals-mp .vitals-label').filter({hasText:'MP 980/1000'}).waitFor();assert.equal(ensureVitals(p).hp,900);assert.equal(ensureVitals(q).hp,90);await page.screenshot({path:'.local/teacher-combat/healing-mobile.png'});check('모바일 E버튼 동일한회복·MP10·최대체력제한');
 await page.reload();await page.locator('#teacher-tab').click();await page.locator('#teacher-resume').click();await page.locator('#lobby').waitFor({state:'hidden'});await page.locator('.vitals-hp .vitals-label').filter({hasText:'HP 900/1000'}).waitFor();await page.locator('.vitals-mp .vitals-label').filter({hasText:'MP 980/1000'}).waitFor();check('새로고침재접속 현재HP/MP보존');
 assert.deepEqual(errors,[]);await writeFile('.local/teacher-combat/result.json',JSON.stringify({checks,errors},null,2));console.log('PASS teacher combat desktop/mobile actual Q/E, stats, descriptions, heal caps, mana/cooldown, no PvP, reconnect; JS errors0');
}catch(error){for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'.local/teacher-combat/failure.png'}).catch(()=>{});throw error;}
finally{student?.disconnect();await browser.close();await game.close();}
