import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {io as socketClient} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {monstersOf} from '../server/monsters.js';
import {mapOf} from '../shared/config.js';

const baseline=process.argv.includes('--baseline'),out='.local/monster-art-loading';mkdirSync(out,{recursive:true});
const key=randomBytes(32).toString('hex'),game=createClassroomServer({teacherKey:key,studentHours:false,teacherManagedAccounts:false});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const socket=socketClient(url,{transports:['websocket'],reconnection:false}),errors=[],results=[];
try{
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  const created=await socket.timeout(5000).emitWithAck('room:create',{teacherKey:key,title:'원화 로딩 검사',allowedNames:['검사별']});assert(created.ok);
  const room=game.store.rooms.get(created.room.code),context=await browser.newContext({viewport:{width:1360,height:900}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  if(baseline){
    const files=['world.js','baby-star-art.js','water-monster-art.js','lv2-monster-art.js','sun-monster-art.js','celestial-monster-art.js','boss-monster-art.js','guardian-monster-art.js','serena-art.js','origin-monster-walk.js'];
    for(const file of files){const body=execFileSync('git',['show',`HEAD:client/${file}`],{encoding:'utf8'});await page.route(`**/${file}`,route=>route.fulfill({contentType:'text/javascript',body}));}
  }
  // Routes disable the browser's HTTP cache. Hold actual monster image responses
  // until the pending frame has been observed, rather than guessing a load delay.
  let release;let gate=new Promise(resolve=>{release=resolve;});const requests=[];
  await page.route('**/assets/monsters/**',async route=>{requests.push(new URL(route.request().url()).pathname);await gate;await route.continue();});
  await page.addInitScript(()=>{
    window.artProbe={loading:0,failed:0,legacy:0,draws:[]};
    const p=CanvasRenderingContext2D.prototype,fill=p.fill,fillText=p.fillText,draw=p.drawImage;
    p.fill=function(...args){if(this.canvas.id==='world'&&this.strokeStyle==='#201c3a'&&this.lineJoin==='round'&&this.lineCap==='round')artProbe.legacy++;return fill.apply(this,args);};
    p.fillText=function(text,...args){if(this.canvas.id==='world'){if(text==='그림 불러오는 중')artProbe.loading++;if(text==='그림 로딩 실패')artProbe.failed++;}return fillText.call(this,text,...args);};
    p.drawImage=function(image,...args){if(this.canvas.id==='world'&&image?.src?.includes('/assets/monsters/'))artProbe.draws.push(new URL(image.src).pathname);return draw.call(this,image,...args);};
  });
  await page.goto(url);await page.locator('#student-tab').click();await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill('검사별');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  if(await page.locator('#tutorial-dialog').evaluate(d=>d.open))await page.locator('#tutorial-later').click();
  assert.deepEqual(requests,[],'lobby/plaza must not preload all monster assets');
  const player=[...room.players.values()].find(p=>p.nickname==='검사별'),monsters=[...monstersOf(room).values()];
  // Keep the synthetic room still; map transitions use the real server snapshot,
  // socket listener, world renderer, image loading, and canvas in Chromium.
  for(const m of monsters){m.attackers.clear();Object.assign(m,{dx:0,dy:0,nextDirectionAt:Date.now()+120000,patrolStartedAt:Date.now()+120000});}
  player.avatar.level=3;player.avatar.constellationId='aquarius';
  async function enter(id){const m=monsters.find(m=>m.typeId===id);assert(m,id);Object.assign(player,{mapId:m.mapId,x:m.x-100,y:m.y+100,facing:{x:1,y:0},battleVitals:null});game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));await page.waitForFunction(name=>document.querySelector('#minimap-title').textContent.includes(name),mapOf(m.mapId).name);await page.waitForFunction(({x,y})=>{const d=document.querySelector('#world').dataset;return Math.abs(Number(d.selfRenderX)-x)<1&&Math.abs(Number(d.selfRenderY)-y)<1;},{x:player.x,y:player.y});return m;}
  for(const id of ['warm-star','star-scorpion','water-star','leoon','spirit-king']){
    const before=requests.length;await page.evaluate(()=>{artProbe={loading:0,failed:0,legacy:0,draws:[]};});
    await enter(id);await page.evaluate(()=>{artProbe={loading:0,failed:0,legacy:0,draws:[]};});
    await page.waitForFunction(baseline=>baseline?artProbe.legacy>0||artProbe.draws.length===0:artProbe.loading>0,baseline);
    await page.waitForTimeout(200);
    const pending=await page.evaluate(()=>({...artProbe,draws:[...new Set(artProbe.draws)]}));
    if(!baseline){assert(pending.loading>0,id);assert.equal(pending.legacy,0,id);assert.equal(pending.draws.length,0,id);}
    await page.screenshot({path:`${out}/${baseline?'before':'after'}-${id}-pending.png`});
    release();await page.waitForFunction(()=>artProbe.draws.length>0);
    await page.waitForTimeout(250);
    const ready=await page.evaluate(()=>({...artProbe,draws:[...new Set(artProbe.draws)]}));
    if(!baseline)assert.equal(ready.legacy,0,id);
    await page.screenshot({path:`${out}/${baseline?'before':'after'}-${id}-ready.png`});
    results.push({id,pending,ready,requested:requests.slice(before)});
    gate=new Promise(resolve=>{release=resolve;});
  }
  release();
  await page.evaluate(()=>{artProbe={loading:0,failed:0,legacy:0,draws:[]};});
  const before=requests.length;await enter('warm-star');await page.evaluate(()=>{artProbe={loading:0,failed:0,legacy:0,draws:[]};});await page.waitForFunction(()=>artProbe.draws.some(src=>src.includes('warm-star')));await page.waitForTimeout(100);
  const revisit=await page.evaluate(()=>({...artProbe,draws:[...new Set(artProbe.draws)]}));
  assert.equal(requests.length,before,'returning to a map reuses loaded Image objects');if(!baseline){assert.equal(revisit.loading,0);assert.equal(revisit.legacy,0);}
  let failure=null;
  if(!baseline){
    const failedSrc='/assets/monsters/star-dragon-poses.png';let failedRequests=0;
    await page.route('**'+failedSrc,route=>{failedRequests++;return route.abort('failed');});
    await enter('star-dragon');await page.waitForFunction(()=>artProbe.failed>0);
    await page.evaluate(()=>{artProbe={loading:0,failed:0,legacy:0,draws:[]};});await page.waitForTimeout(300);
    failure=await page.evaluate(()=>({...artProbe,draws:[...new Set(artProbe.draws)]}));
    assert(failure.failed>0);assert.equal(failure.legacy,0);assert.equal(failedRequests,1,'failed images do not retry every frame');
    failure.requests=failedRequests;await page.screenshot({path:out+'/after-failed-image.png'});
  }
  assert.deepEqual(errors,[]);const report={baseline,results,revisit,failure,errors};writeFileSync(`${out}/${baseline?'before':'after'}-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{socket.disconnect();await browser.close();await game.close();}
