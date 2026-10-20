import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {monstersOf} from '../server/monsters.js';

const output='.local/leoon-skill',game=createClassroomServer({teacherKey:'leoon-visual-check',studentHours:false,teacherManagedAccounts:false});
let browser,teacher;
try{
  await mkdir(output,{recursive:true});const url=`http://127.0.0.1:${(await game.listen()).port}`;
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),args:['--no-proxy-server']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
  const visual=await page.evaluate(async()=>{
    const {preloadBossArt,drawBossMonster}=await import('/boss-monster-art.js');
    const {drawLeoonWarning,drawLeoonImpact,leoonPoseFrame}=await import('/leoon-skill.js');
    const {LEOON_ROAR,LEOON_CHARGE}=await import('/shared/boss-skills.js');
    await preloadBossArt('leoon');
    const canvas=Object.assign(document.createElement('canvas'),{width:1200,height:900}),ctx=canvas.getContext('2d'),now=Date.now(),frames=[];
    const phases=[['glow',0],['glow',250],['glow',500],['glow',750],['warning',1000],['warning',2000],
      ['stomp',75],['stomp',450],['stomp',825],['charge-warning',1000],['dash',200],['impact',350]];
    for(const [i,[phase,elapsed]] of phases.entries()){
      const x=i%4*300,y=Math.floor(i/4)*300;ctx.save();ctx.translate(x,y);
      ctx.fillStyle='#203050';ctx.fillRect(0,0,300,300);
      const roar=['glow','warning'].includes(phase),skill=roar?
        {kind:LEOON_ROAR.kind,stage:phase,startsAt:now-(phase==='glow'?elapsed:LEOON_ROAR.glowMs+elapsed),
          stageEndsAt:now+LEOON_ROAR.warningMs-elapsed,areas:Array.from({length:5},(_,n)=>{
            const angle=n*Math.PI*2/5;return {x:150+Math.cos(angle)*104,y:180+Math.sin(angle)*104,radius:52};})}:
        {kind:LEOON_CHARGE.kind,stage:phase==='charge-warning'?'warning':phase,startsAt:now-elapsed,
          stageEndsAt:now+1000,fromX:30,fromY:215,toX:270,toY:215,halfWidth:38,repeat:0};
      const m={shape:'leoon',x:150,y:180,radius:86,facingX:1,moving:false,leoonSkill:skill};
      drawLeoonWarning(ctx,m,now);drawBossMonster(ctx,m,now);
      if(phase==='impact')drawLeoonImpact(ctx,{skillKind:LEOON_CHARGE.kind,x:30,y:215,dx:1,dy:0,reach:240,halfWidth:38},.5);
      ctx.fillStyle='#fff8d4';ctx.font='16px sans-serif';ctx.fillText(`${i+1} ${phase}`,12,25);
      frames.push(leoonPoseFrame(skill,now));ctx.restore();
    }
    const pixels=ctx.getImageData(0,0,1200,900).data,lit=[];
    for(let i=0;i<12;i++){
      const x=i%4*300,y=Math.floor(i/4)*300;let count=0;
      for(let py=y+55;py<y+270;py+=3)for(let px=x+20;px<x+280;px+=3){const p=(py*1200+px)*4;
        if(pixels[p]>170&&pixels[p+1]>90&&pixels[p+2]<180)count++;}
      lit.push(count);
    }
    return {png:canvas.toDataURL('image/png'),frames,lit};
  });
  assert(visual.lit.every(n=>n>10),'12개 동작 장면에 레오온과 황금빛 VFX가 표시되어야 합니다.');
  assert.notEqual(visual.frames[0].lift,visual.frames[3].lift);
  await writeFile(`${output}/frames.png`,Buffer.from(visual.png.split(',')[1],'base64'));delete visual.png;
  teacher=io(url,{transports:['websocket'],reconnection:false});
  await new Promise((resolve,reject)=>{teacher.once('connect',resolve);teacher.once('connect_error',reject);});
  const made=await teacher.timeout(5000).emitWithAck('room:create',{teacherKey:'leoon-visual-check',allowedNames:['검사']});assert(made.ok);
  const room=game.store.rooms.get(made.room.code);
  await page.locator('#student-tab').click();await page.locator('#join-code').fill(room.code);
  await page.locator('#nickname').fill('검사');await page.locator('#student-pin').fill('1234');
  await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  if(await page.locator('#password-offer-dialog').isVisible())await page.locator('#password-offer-no').click();
  await page.locator('#tutorial-later').click();
  const player=[...room.players.values()].find(p=>p.role==='student'),boss=monstersOf(room).get('leoon-boss');
  player.mapId=boss.mapId;player.x=boss.x+450;player.y=boss.y;
  game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
  await page.waitForFunction(()=>document.querySelector('#world')?.dataset.monsterCount==='1');
  for(let areaIndex=0;areaIndex<5;areaIndex++)game.io.to(player.socketId).emit('combat:monster-hit',{
    monsterId:boss.id,mapId:boss.mapId,x:boss.x+(areaIndex-2)*90,y:boss.y,dx:0,dy:-1,reach:0,
    skillKind:'leoon-roar',areaIndex,durationMs:800,attackOnly:true});
  await page.waitForFunction(()=>document.querySelector('#world')?.dataset.leoonImpactCount==='5');
  await page.screenshot({path:`${output}/five-impacts.png`});
  assert.deepEqual(errors,[]);await writeFile(`${output}/report.json`,JSON.stringify({visual,errors},null,2));
  console.log(JSON.stringify({frames:visual.frames.length,lit:visual.lit,impactCount:5,errors}));
}finally{teacher?.disconnect();await browser?.close();await game.close();}
