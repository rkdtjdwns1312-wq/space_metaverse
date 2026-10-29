import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {STREET} from '../shared/config.js';
const key='isolated-hall-fountain',game=createClassroomServer({teacherKey:key,studentHours:false}),errors=[];
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),args:['--no-proxy-server']});
mkdirSync('.local/hall-fountain',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['가나','다라']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 for(let n=0;n<12&&await page.locator('dialog[open]').count();n++)await page.keyboard.press('Escape');
 const room=game.store.rooms.get(await page.locator('#room-code').textContent()),p=[...room.players.values()].find(p=>p.role==='teacher');
 const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 const move=(x,y)=>{Object.assign(p,{mapId:STREET.id,x,y,input:{x:0,y:0,at:0}});publish();};
 move(850,1950);await page.evaluate(async()=>{await(await import('/street-art.js')).preloadStreetArt();});await page.waitForFunction(()=>document.querySelector('#world').dataset.artStatus==='ready');await page.waitForTimeout(250);await page.screenshot({path:'.local/hall-fountain/fountain-game.png'});
 const altar=STREET.objects.find(o=>o.kind==='hall-of-fame');assert(altar);assert(!STREET.objects.some(o=>o.id==='lamp-left'));
 move(altar.x,altar.y+80);await page.waitForTimeout(300);await page.locator('#touch-interact').click();await page.locator('.hall-of-fame-dialog').waitFor({state:'visible'});assert.match(await page.locator('.hall-of-fame-dialog').textContent(),/아직 이번 주/);await page.locator('.hall-of-fame-dialog button').click();
 const students=['가나','다라'].map((nickname,i)=>({id:'isolated-ranking-'+i,nickname}));
 room.memoryRanking=students.map((p,i)=>({id:'memory-'+i,playerId:p.id,nickname:p.nickname,at:Date.now(),remainingMs:5000}));
 room.omokWinRecords=students.map((p,i)=>({id:'omok-'+i,playerId:p.id,nickname:p.nickname,at:Date.now()}));
 for(const width of [1280,390]){await page.setViewportSize({width,height:900});await page.locator('#touch-interact').click();await page.locator('.hall-of-fame-dialog li').first().waitFor();assert.deepEqual(await page.locator('.hall-of-fame-dialog li').allTextContents(),['가나','다라','가나','다라']);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`.local/hall-fountain/hall-${width}.png`});await page.locator('.hall-of-fame-dialog button').click();}
 await page.setViewportSize({width:1100,height:1050});await page.evaluate(async()=>{const {drawStreetGround,preloadStreetArt}=await import('/street-art.js'),{STREET}=await import('/shared/config.js');await preloadStreetArt();const c=document.createElement('canvas');c.id='park-review';c.width=1100;c.height=1050;document.body.append(c);c.style.cssText='position:fixed;inset:0;z-index:999999;background:#eee8f4;display:block;width:1100px;height:1050px;max-width:none';const ctx=c.getContext('2d');ctx.translate(-280,-1180);drawStreetGround(ctx,STREET);});await page.locator('#park-review').screenshot({path:'.local/hall-fountain/park-overview.png'});
 assert.deepEqual(errors,[]);console.log('PASS actual hall interaction, empty and tied rankings, desktop/mobile, fountain4x and4beds preview; JS errors 0');
}finally{await browser.close();await game.close();}
