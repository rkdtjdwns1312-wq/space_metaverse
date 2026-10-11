// 실제 학생자료를 쓰지 않는 대표 연출 검사: 왕관·사자·황소·석상.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {castCorona} from '../server/corona-skills.js';
import {castTaurus} from '../server/taurus-skills.js';
import {mapOf} from '../shared/config.js';
const out='.local/569-574-visuals';await mkdir(out,{recursive:true});
const game=createClassroomServer({teacherKey:'visual-check-local',studentHours:false});let browser;
try{
 const {port}=await game.listen();browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}`);
 const result=await page.evaluate(async()=>{
  const {drawCoronaAura,drawCoronaBodyAura,coronaOpacity}=await import('/corona-effects.js');
  const {drawLeoAttack,leoAttackPose}=await import('/leo-effects.js');
  const {prepareConstellationWalk,constellationWalkFrame,LOCOMOTION_PROFILES}=await import('/constellation-locomotion.js');
  const load=async src=>{const im=new Image();im.src=src;await im.decode();return im;};
  const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const sum=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.reduce((n,v,i)=>n+(i%4===3?v:0),0);
  const sheet=make(1200,750),ctx=sheet.getContext('2d');ctx.fillStyle='#ece6f6';ctx.fillRect(0,0,1200,750);
  const crowns=[];
  for(const stage of [2,3,4]){
   const sprite=await load(`/assets/avatars/${stage===2?'':`lv${stage}/`}corona-borealis.png`);
   const crown=await load(`/assets/skills/corona-borealis/crown-lv${stage}.png`);
   const a={stage,size:160,durationMs:5000},probe=make(400,400),pc=probe.getContext('2d');pc.translate(200,200);
   drawCoronaAura(pc,a,2000);await new Promise(r=>setTimeout(r,80));
   const amounts=[];
   for(const elapsed of [0,500,2000,4500,5000]){pc.clearRect(-200,-200,400,400);drawCoronaAura(pc,a,elapsed);amounts.push(sum(probe));}
   const middle=probe.getContext('2d').getImageData(0,0,400,400); // all gone at 5000
   crowns.push({stage,amounts,transparent:middle.data.every((v,i)=>i%4!==3||v===0),loaded:crown.naturalWidth>0});
   for(let col=0;col<3;col++){
    ctx.save();ctx.translate(200+col*400,(stage-2)*250+125);
    const elapsed=[500,2000,4500][col];ctx.save();ctx.translate(-38,0);drawCoronaAura(ctx,a,elapsed);ctx.restore();
    drawCoronaBodyAura(ctx,sprite,a,elapsed,160);ctx.drawImage(sprite,-80,-80,160,160);ctx.restore();
   }
  }
  const leo=make(1200,420),lc=leo.getContext('2d');lc.fillStyle='#263047';lc.fillRect(0,0,1200,420);
  const hit={kind:'leo-attack',x:0,y:0,dx:1,dy:0,reach:0,size:180,durationMs:500};
  drawLeoAttack(lc,hit,100);await new Promise(r=>setTimeout(r,80));const tails=[];
  for(const [i,time]of [225,300,350,400,450,500].entries()){
   const c=make(220,220),cc=c.getContext('2d');cc.translate(110,110);drawLeoAttack(cc,hit,time);tails.push(sum(c));
   lc.drawImage(c,i*200,0,200,200);lc.fillStyle='white';lc.font='18px sans-serif';lc.fillText(`${time}ms`,i*200+70,205);
   lc.save();lc.translate(i*200+100,320);drawLeoAttack(lc,{...hit,dx:-1},time);lc.restore();
  }
  const sprite=await load('/assets/avatars/lv3/leo.png');await prepareConstellationWalk(sprite,'leo',3);
  const frames=Array.from({length:16},(_,i)=>constellationWalkFrame(sprite,'leo',3,i));
  const pixels=frames.map(c=>c.getContext('2d').getImageData(0,0,256,256).data),base=pixels[0];let faceChanges=0;
  for(const data of pixels)for(let y=0;y<256;y++)for(let x=0;x<256;x++){
   const k=(y*256+x)*4;if(base[k+3]<230)continue;
   if(LOCOMOTION_PROFILES.leo[3].faces.some(([cx,cy,rx,ry])=>((x/256-cx)/rx)**2+((y/256-cy)/ry)**2<.85))
    if([0,1,2,3].some(j=>Math.abs(data[k+j]-base[k+j])>3))faceChanges++;
  }
  const walk=make(1024,256),wc=walk.getContext('2d');wc.fillStyle='#e7dff0';wc.fillRect(0,0,1024,256);
  for(let i=0;i<4;i++){wc.save();wc.translate(i*256,0);if(i>1){wc.translate(256,0);wc.scale(-1,1);}wc.drawImage(frames[i%2?4:0],0,0);wc.restore();}
  const positions=Array.from({length:36},(_,i)=>leoAttackPose(i/35));
  return {crowns,tails,faceChanges,positions,crownSheet:sheet.toDataURL(),attackSheet:leo.toDataURL(),walkSheet:walk.toDataURL(),ends:[coronaOpacity({durationMs:5000},0),coronaOpacity({durationMs:5000},5000)]};
 });
 for(const [key,name]of [['crownSheet','crowns'],['attackSheet','claws'],['walkSheet','lion-left-right']]){await writeFile(`${out}/${name}.png`,Buffer.from(result[key].split(',')[1],'base64'));delete result[key];}
 assert(result.crowns.every(c=>c.loaded&&c.transparent&&c.amounts[0]===0&&c.amounts[4]===0&&c.amounts[2]>c.amounts[1]));
 assert(result.tails.every((n,i,a)=>i===0||n<a[i-1]));assert.equal(result.tails.at(-1),0);assert.equal(result.faceChanges,0);
 assert.equal(result.positions.at(-1).alpha,0);
 await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill('visual-check-local');await fillNewClass(page,['연출검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0],p=[...room.players.values()].find(p=>p.role==='teacher');
 const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 Object.assign(p,{mapId:'star-origin-1',x:600,y:460});Object.assign(p.avatar,{level:4,constellationId:'corona-borealis',form:'constellation',teacherPreview:true});publish();
 castCorona(room,p,Date.now());await page.waitForTimeout(1500);await page.screenshot({path:`${out}/crown-game.png`});p.coronaAura=null;
 await page.evaluate(()=>{window.purpleStrokes=0;const fn=CanvasRenderingContext2D.prototype.stroke;CanvasRenderingContext2D.prototype.stroke=function(...a){if(this.strokeStyle==='#8061b0')window.purpleStrokes++;return fn.apply(this,a);};});
 Object.assign(p.avatar,{level:4,constellationId:'taurus'});p.facing={x:1,y:0};publish();await page.waitForTimeout(250);
 const before=await page.evaluate(()=>window.purpleStrokes);assert(before>0);
 castTaurus(room,p,Date.now());await page.waitForTimeout(600);const during=await page.evaluate(()=>window.purpleStrokes);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.purpleStrokes),during);
 await page.screenshot({path:`${out}/taurus-game.png`});p.taurusDash=null;
 const map=mapOf('star-origin-4'),statue=map.objects.find(o=>o.kind==='goddess-statue');assert.equal(statue.x,map.width/2);assert.equal(statue.y,map.height/2);
 Object.assign(p,{mapId:map.id,x:statue.x+170,y:statue.y+140});Object.assign(p.avatar,{level:3,constellationId:'leo'});publish();await page.waitForTimeout(1000);await page.screenshot({path:`${out}/statue-game.png`});
 await page.locator('#map-overview').click();await page.locator('#map-area-view').click();await page.waitForTimeout(250);await page.screenshot({path:`${out}/statue-overview.png`});
 assert.equal(errors.length,0);await writeFile(`${out}/results.json`,JSON.stringify({...result,errors,taurusRingRemoved:true,statueCentered:true},null,2));
 console.log(JSON.stringify({crowns:3,clawFade:result.tails,leoFaceChanges:result.faceChanges,taurusRingRemoved:true,statueCentered:true,errors}));
}finally{await browser?.close();await game.close();}
