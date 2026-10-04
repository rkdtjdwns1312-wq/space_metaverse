import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createClassroomServer} from '../server/app.js';

const game=createClassroomServer({teacherKey:'file-bgm-browser-test-key',studentHours:false});
const {port}=await game.listen(),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
  const page=await browser.newPage();
  await page.addInitScript(()=>{
    window.__fileBgm=[];
    const original=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){window.__fileBgm.push(this);return original.call(this);};
  });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.locator('#student-tab').click();
  await page.waitForFunction(()=>window.__fileBgm.length>0&&window.__fileBgm[0].readyState>=2);
  const initial=await page.evaluate(()=>{const media=window.__fileBgm[0];return {path:new URL(media.src).pathname,loop:media.loop,paused:media.paused,duration:media.duration,volume:media.volume};});
  assert.equal(initial.path,'/assets/audio/login-in-front-of-love.mp3');
  assert.equal(initial.loop,true);assert.equal(initial.paused,false);
  assert.ok(Number.isFinite(initial.duration)&&initial.duration>1);
  await page.locator('#audio-toggle').click();
  await page.locator('#audio-volume').evaluate(input=>{input.value='60';input.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.evaluate(()=>window.__fileBgm[0].volume),.6);
  await page.locator('#audio-mute').click();
  assert.equal(await page.evaluate(()=>window.__fileBgm[0].muted),true);
  await page.evaluate(async()=>{
    const {createAudio}=await import('/audio.js');
    window.__shelterController=createAudio({storage:null});
    document.querySelector('#student-tab').addEventListener('click',()=>window.__shelterController.playBgm('star-street'),{once:true});
  });
  await page.locator('#student-tab').click();
  await page.waitForFunction(()=>window.__fileBgm.length>1&&window.__fileBgm[1].readyState>=2);
  const shelter=await page.evaluate(()=>{const media=window.__fileBgm[1];return {path:new URL(media.src).pathname,loop:media.loop,paused:media.paused,duration:media.duration};});
  assert.equal(shelter.path,'/assets/audio/star-street-pposong.mp3');
  assert.equal(shelter.loop,true);assert.equal(shelter.paused,false);
  assert.ok(Number.isFinite(shelter.duration)&&shelter.duration>1);
  await page.evaluate(()=>window.__shelterController.stopBgm());
  assert.equal(await page.evaluate(()=>window.__fileBgm[1].paused),true);
  await page.evaluate(()=>document.querySelector('#student-tab').addEventListener('click',()=>window.__shelterController.playBgm('milky-valley'),{once:true}));
  await page.locator('#student-tab').click();
  await page.waitForFunction(()=>window.__fileBgm.length>2&&window.__fileBgm[2].readyState>=2);
  const valley=await page.evaluate(()=>{const media=window.__fileBgm[2];return {path:new URL(media.src).pathname,loop:media.loop,paused:media.paused,duration:media.duration};});
  assert.equal(valley.path,'/assets/audio/milky-valley-silent-morning.mp3');
  assert.equal(valley.loop,true);assert.equal(valley.paused,false);
  assert.ok(Number.isFinite(valley.duration)&&valley.duration>1);
  await page.evaluate(()=>window.__shelterController.stopBgm());
  console.log(JSON.stringify({loginAudio:initial.path,loginSeconds:Math.round(initial.duration),shelterAudio:shelter.path,shelterSeconds:Math.round(shelter.duration),valleyAudio:valley.path,valleySeconds:Math.round(valley.duration),loop:true,volumeControl:true,muteControl:true}));
}finally{await browser.close();await game.close();}
