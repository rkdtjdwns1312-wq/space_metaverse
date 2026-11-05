import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {monstersOf} from '../server/monsters.js';
import {beginDarkStarSkill} from '../server/dark-star-skills.js';
import {DARK_STAR} from '../shared/dark-star.js';
import {avatarPositionIsClear} from '../shared/avatar-boundary.js';
import {mapOf} from '../shared/config.js';
const key='isolated-dark-star-interaction',game=createClassroomServer({teacherKey:key,studentHours:false,dataDir:null}),errors=[];
const {port}=await game.listen(),browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
mkdirSync('.local/dark-star-interaction',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const localNow=Date.now.bind(Date);Date.now=()=>localNow()+60000;
    window.cardLabels=new Set();
    const draw=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){
      if(typeof text==='string'&&text.endsWith(' 위성'))window.cardLabels.add(text);
      return draw.call(this,text,...args);
    };
  });
  await page.goto('http://127.0.0.1:'+port);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);
  await fillNewClass(page,['검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  for(let n=0;n<12&&await page.locator('dialog[open]').count();n++)await page.keyboard.press('Escape');
  const room=[...game.store.rooms.values()][0],p=[...room.players.values()].find(p=>p.role==='teacher');
  room.darkStar={state:'active',respawnAt:null,monsterId:DARK_STAR.monsterId};
  const boss=monstersOf(room).get(DARK_STAR.monsterId);Object.assign(p,{mapId:boss.mapId,x:boss.x-300,y:boss.y});
  boss.teacherRetaliation=new Set([p.id]);assert(beginDarkStarSkill(room,boss,'puzzle',Date.now(),()=>.5));boss.sleepUntil=Date.now()+120000;
  const card=boss.darkStarSkills.cards.find(c=>c.correct),map=mapOf(boss.mapId);
  const move=async(x,y)=>{Object.assign(p,{x,y,input:{x:0,y:0,at:0}});game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));await page.waitForTimeout(350);};
  assert(avatarPositionIsClear(map,card.x,card.y+65,p,[card]),'card approach is not blocked by card collision');
  await move(card.x,card.y+65);await page.waitForFunction(()=>document.querySelector('#world').dataset.darkStarCardCount==='5');
  await page.waitForFunction(()=>!document.querySelector('#interact-prompt').hidden&&document.querySelector('#interact-object').textContent==='위성 확인하기');
  await page.locator('#world').focus();await page.keyboard.press('KeyF');await page.waitForTimeout(200);
  const checkColor=async card=>{
    const names={red:'빨강',purple:'보라',indigo:'남색',green:'초록',blue:'파랑'},name=names[card.color]+' 위성';
    const prompt=page.locator('#interact-prompt[data-satellite-color="'+card.color+'"]');
    await prompt.filter({hasText:name}).waitFor({state:'visible',timeout:2500});
    await page.waitForFunction(label=>window.cardLabels.has(label),name,{timeout:2500});
  };
  assert(card.revealUntil>Date.now(),'F from game canvas reveals card');await checkColor(card);
  await page.screenshot({path:'.local/dark-star-interaction/revealed-color-pc.png'});console.log('PASS canvas F and visible satellite color with fast client clock');
  await page.waitForTimeout(350);await page.locator('#touch-interact').focus();await page.keyboard.press('KeyF');await page.waitForTimeout(200);
  await page.screenshot({path:'.local/dark-star-interaction/button-focus-f.png'});
  assert.equal(card.hp,0,'second F must remove correct card even from game HUD button focus');assert.equal(boss.darkStarSkills.cards.length,0);console.log('PASS HUD button focus second F removes card');
  boss.sleepUntil=0;boss.darkStarSkills.ready.puzzle=0;assert(beginDarkStarSkill(room,boss,'puzzle',Date.now(),()=>.5));boss.sleepUntil=Date.now()+120000;
  const mobileCard=boss.darkStarSkills.cards.find(c=>c.correct);
  await page.setViewportSize({width:390,height:844});await move(mobileCard.x,mobileCard.y+65);
  await page.evaluate(()=>window.cardLabels.clear());await page.locator('#touch-interact').click();await page.waitForTimeout(350);assert(mobileCard.revealUntil>Date.now());await checkColor(mobileCard);
  await page.screenshot({path:'.local/dark-star-interaction/mobile-touch.png'});
  await page.locator('#touch-interact').click();await page.waitForTimeout(200);assert.equal(mobileCard.hp,0);
  assert.deepEqual(errors,[]);console.log('PASS mobile touch, JS errors 0');
}finally{await browser.close();await game.close();}
