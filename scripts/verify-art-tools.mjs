import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {STREET} from '../shared/config.js';
import {getArt} from '../server/art-studio.js';
const teacherKey='isolated-art-tools',game=createClassroomServer({teacherKey,studentHours:false}),errors=[];
const {port}=await game.listen(),browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
mkdirSync('.local/art-tools',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900},hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}`);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(teacherKey);
 await fillNewClass(page,['그림검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 for(let n=0;n<12&&await page.locator('dialog[open]').count();n++)await page.keyboard.press('Escape');
 const room=game.store.rooms.get(await page.locator('#room-code').textContent()),teacher=[...room.players.values()].find(p=>p.role==='teacher');
 const station=STREET.objects.find(o=>o.kind==='art-station');Object.assign(teacher,{mapId:STREET.id,x:station.x,y:station.y+80,input:{x:0,y:0,at:0}});
 game.io.to(teacher.socketId).emit('room:state',game.store.snapshot(room,teacher));await page.locator('#interact-prompt').filter({hasText:'예술'}).waitFor({state:'visible'});
 const field=name=>page.locator(`#art-studio-dialog [data-art="${name}"]`),tool=name=>page.locator(`[data-art-tool="${name}"]`);
 const open=async()=>{await page.locator('#world').focus();await page.keyboard.press('f');await page.locator('#art-studio-dialog[open]').waitFor();await page.locator('[data-art-tab=mine]').click();await page.waitForFunction(()=>!document.querySelector('[data-art=close]').disabled);};
 const position=async(x,y)=>{await field('canvas').scrollIntoViewIfNeeded();const b=await field('canvas').boundingBox();return {x:b.x+b.width*x/600,y:b.y+b.height*y/400};};
 const tap=async(x,y,touch=false)=>{const p=await position(x,y);if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await page.waitForTimeout(50);};
 const drag=async(x1,y1,x2,y2)=>{const a=await position(x1,y1),b=await position(x2,y2);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();await page.waitForTimeout(50);};
 const pixel=async(x,y)=>field('canvas').evaluate((c,[x,y])=>[...c.getContext('2d').getImageData(x,y,1,1).data],[x,y]);
 const rgb=hex=>[...hex.slice(1).match(/../g).map(h=>parseInt(h,16)),255];
 await open();await field('color').fill('#000000');
 for(const [name,x1,y1,x2,y2]of [['rectangle',40,40,180,150],['ellipse',220,40,360,150],['triangle',400,40,540,150],['star',210,220,350,370]]){await tool(name).click();await drag(x1,y1,x2,y2);}
 const targets=[[100,90,'#ef7b9c'],[290,90,'#8bcbe8'],[470,100,'#c4a7e7'],[280,285,'#f8d66d']];
 await tool('fill').click();for(const [x,y,color]of targets){await field('color').fill(color);await tap(x,y);assert.deepEqual(await pixel(x,y),rgb(color));assert.deepEqual(await pixel(10,10),rgb('#ffffff'));}
 assert.deepEqual(await pixel(40,80),rgb('#000000'));
 await field('undo').click();await page.waitForTimeout(50);assert.deepEqual(await pixel(280,285),rgb('#ffffff'));await tap(280,285);assert.deepEqual(await pixel(280,285),rgb('#f8d66d'));
 await tap(280,285);await field('status').filter({hasText:'이미 같은 색'}).waitFor();
 await tool('rectangle').click();await field('color').fill('#000000');await tap(420,250);await tool('fill').click();await field('color').fill('#93cfa6');await tap(460,290);assert.deepEqual(await pixel(460,290),rgb('#93cfa6'));
 await page.setViewportSize({width:390,height:844});await tool('ellipse').click();await field('color').fill('#000000');await tap(70,250,true);await tool('fill').click();await field('color').fill('#f5b279');await tap(110,290,true);assert.deepEqual(await pixel(110,290),rgb('#f5b279'));
 await field('title').fill('도형과 페인트통');await field('save').click();await field('status').filter({hasText:'작품을 저장했어요'}).waitFor();
 const saved=getArt(room,teacher,{id:room.teacherArtStudio[0].id}).work;assert.equal(saved.drawing.strokes.length,12);assert.equal(saved.drawing.strokes.filter(s=>s.tool==='fill').length,6);
 await field('close').click();await open();await page.locator('[data-art-work]').filter({hasText:'도형과 페인트통'}).click();await page.waitForFunction(()=>document.querySelector('[data-art=title]').value==='도형과 페인트통');await page.waitForTimeout(50);
 for(const [x,y,color]of [...targets,[460,290,'#93cfa6'],[110,290,'#f5b279']])assert.deepEqual(await pixel(x,y),rgb(color));
 for(const [label,width,height]of [['pc',1280,900],['mobile',390,844],['small',320,568]]){await page.setViewportSize({width,height});assert(await page.locator('#art-studio-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await field('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`.local/art-tools/shapes-fill-${label}.png`});}
 assert.deepEqual(errors,[]);console.log('PASS actual rectangle/ellipse/triangle/star drag, click insertion, connected-area fill isolated by outlines, undo/no-op, touch shape/fill, server save/reopen pixel equality, PC390/320, errors0');
}finally{await browser.close();await game.close();}
