import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {PLAYGROUND,STAR_STATION,STREET} from '../shared/config.js';
import {avatarPositionIsClear} from '../shared/avatar-boundary.js';

const baseline=process.argv.includes('--baseline'),label=baseline?'before':'after';
const station=process.argv.includes('--station'),map=station?STAR_STATION:PLAYGROUND;
const output=`.local/${station?'station':'playground'}-bridge-1111`;
const key='isolated-playground-bridge',game=createClassroomServer({teacherKey:key,studentHours:false});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[];await mkdir(output,{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);
  await fillNewClass(page,['다리검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  for(let n=0;n<12&&await page.locator('dialog[open]').count();n++)await page.keyboard.press('Escape');
  const room=[...game.store.rooms.values()][0],p=[...room.players.values()].find(p=>p.role==='teacher');
  const place=async(x,y)=>{
    Object.assign(p,{mapId:map.id,x,y,input:{x:0,y:0,at:0}});
    game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
    await page.waitForFunction(id=>document.querySelector('#minimap').dataset.mapId===id,map.id);
    await page.waitForTimeout(250);
  };
  await place(map.spawn.x,map.spawn.y);
  const art=await page.evaluate(async station=>{
    const [config,street,gates,cliff,layout,floor]=await Promise.all([import('/shared/config.js'),import('/street-art.js'),import('/gate-art.js'),import('/floating-island.js'),import('/shared/street-layout.js'),import('/visual-floor.js')]);
    await Promise.all([street.preloadStreetArt(),gates.preloadGateArt(),cliff.preloadFloatingCliff()]);
    const map=station?config.STAR_STATION:config.PLAYGROUND,b=map.viewBounds;
    const c=document.createElement('canvas');c.width=b.width/2;c.height=b.height/2;const ctx=c.getContext('2d');ctx.scale(.5,.5);ctx.translate(-b.x,-b.y);
    street.drawStreetGround(ctx,map);for(const o of map.objects.filter(o=>o.kind==='gate'))gates.drawPaintedGate(ctx,o);
    const close=document.createElement('canvas');close.width=800;close.height=500;const cc=close.getContext('2d');cc.translate(-500,-(station?b.y+b.height-500:b.y));street.drawStreetGround(cc,map);for(const o of map.objects.filter(o=>o.kind==='gate'))gates.drawPaintedGate(cc,o);
    const path=floor.visualFloorPath(layout.streetGeometryOf(map).polygons);
    const check=document.createElement('canvas').getContext('2d');
    return {overview:c.toDataURL('image/png'),closeup:close.toDataURL('image/png'),continuous:Array.from({length:211},(_,i)=>check.isPointInPath(path,900,station?b.y+b.height-i:b.y+i))};
  },station);
  for(const name of ['overview','closeup'])await writeFile(`${output}/${label}-${name}.png`,Buffer.from(art[name].split(',')[1],'base64'));
  await page.waitForTimeout(300);await page.screenshot({path:`${output}/${label}-game.png`});
  if(!baseline){
    assert(art.continuous.every(Boolean),'visible bridge reaches the crop boundary with no floor gap');
    const box=await page.locator('#joystick').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
    const walk=async(targetY)=>{
      await page.mouse.move(cx,cy);await page.mouse.down();
      const deadline=Date.now()+6000;
      try{while(Math.abs(p.y-targetY)>9&&Date.now()<deadline){await page.mouse.move(cx,cy+Math.sign(targetY-p.y)*40);await page.waitForTimeout(45);assert(avatarPositionIsClear(map,p.x,p.y,p),'actual joystick stays on connected floor');}}
      finally{await page.mouse.up();}
      assert(Math.abs(p.y-targetY)<20,`walk to ${targetY}; reached ${p.y}`);
    };
    await walk(station?1100:2335);await walk(map.spawn.y);
    const gate=map.objects.find(o=>o.id==='gate-street');
    await place(gate.x,gate.y);await page.locator('#world').focus();await page.keyboard.press('f');
    await page.waitForFunction(id=>document.querySelector('#minimap').dataset.mapId===id,STREET.id);assert.equal(p.mapId,STREET.id);
    await place(900,station?1000:2450);await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:`${output}/${label}-mobile.png`});
  }
  assert.deepEqual(errors,[]);
  const result={mode:label,mapId:map.id,floorSamples:art.continuous.length,gapSamples:art.continuous.filter(x=>!x).length,actualJoystickRoundTrip:!baseline,returnGate:!baseline,pageErrors:errors};
  await writeFile(`${output}/${label}-result.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();await game.close();}
