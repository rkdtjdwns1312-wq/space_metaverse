import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {addPlanet} from '../server/world.js';
import {interiorIdOf} from '../shared/config.js';
import {fillNewClass} from './class-setup.mjs';

const key='map-preview-isolated-test',game=createClassroomServer({teacherKey:key,studentHours:false});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`,errors=[],results=[];
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),args:['--no-proxy-server']});
const output='.local/map-preview-loading';await mkdir(output,{recursive:true});
try{
  for(const mode of ['before','after']){
    const context=await browser.newContext({viewport:{width:1360,height:900}}),page=await context.newPage();
    page.on('pageerror',error=>errors.push(`${mode}: ${error.message}`));
    if(mode==='before'){
      // Reproduce the previous eager tiny-thumbnail path without changing disk files.
      const source=await readFile(new URL('../client/universe-ui.js',import.meta.url),'utf8');
      const baseline=source.replace("if(thumbnail&&!visibleThumbnails.has(canvas)){","if(false){")
        .replace("const art=thumbnail?prepareMapPreviewArt(info,planets().find(p=>p.id===info.planetId)):prepareMapArt(info,planets());","const art=prepareMapArt(info,planets());")
        .replace('for(const o of thumbnail?[]:info.objects){','for(const o of info.objects){')
        .replace('info.width*scale,info.height*scale,thumbnail);','info.width*scale,info.height*scale,false);');
      assert.notEqual(baseline,source);
      await page.route('**/universe-ui.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:baseline}));
    }
    const images=new Set();page.on('request',request=>{if(request.resourceType()==='image')images.add(new URL(request.url()).pathname);});
    await page.goto(url);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);
    await fillNewClass(page,['1']);await page.locator('#teacher-form .submit').click();
    try{await page.locator('#lobby').waitFor({state:'hidden'});}catch(error){throw new Error(await page.locator('#form-message').textContent(),{cause:error});}
    console.log(`${mode}: joined`);
    for(let i=0;i<10&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');
    const room=[...game.store.rooms.values()].at(-1),teacher=[...room.players.values()].find(p=>p.role==='teacher');
    const planet=addPlanet(room,{name:'미리보기행성',description:'',x:2940,y:2070,color:'#d5c4f3',rules:[],templateId:'art'});
    planet.interiorDecor={room:{shapeId:'star',colorId:'original'}};
    game.io.to(teacher.socketId).emit('room:state',game.store.snapshot(room,teacher));
    await page.waitForFunction(()=>document.querySelector('#minimap')?.dataset.artState==='ready');
    await page.waitForTimeout(300);const initial=new Set(images);
    await page.locator('#map-overview').click();await page.locator('#universe-dialog').waitFor({state:'visible'});
    await page.waitForFunction(()=>[...document.querySelectorAll('.universe-thumbnail')].some(c=>c.dataset.artState==='ready'));
    await page.waitForTimeout(1000);
    const opened=[...images].filter(path=>!initial.has(path));
    const deferred=await page.locator('.universe-thumbnail[data-art-state=deferred]').count();
    if(mode==='after')assert.ok(deferred>0,'offscreen thumbnails defer loading');
    await page.screenshot({path:`${output}/${mode}-overview.png`});
    if(mode==='after'){
      const thumb=page.locator(`.universe-node[data-map-id="${interiorIdOf(planet.id)}"] canvas`);
      await thumb.scrollIntoViewIfNeeded();await page.waitForFunction(id=>document.querySelector(`.universe-node[data-map-id="${id}"] canvas`)?.dataset.artState==='ready',interiorIdOf(planet.id));
      const colors=await thumb.evaluate(canvas=>{const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,set=new Set();for(let i=0;i<data.length;i+=16)set.add(`${data[i]},${data[i+1]},${data[i+2]}`);return set.size;});
      assert.ok(colors>100,'interior thumbnail contains painted image detail');
      assert.ok(images.has('/assets/interior/v2/floor-star.webp'),'selected interior floor loaded');
      const interior=[...images].filter(path=>path.includes('/assets/interior/'));
      assert.deepEqual(interior.sort(),['/assets/interior/v2/floor-default.webp','/assets/interior/v2/floor-star.webp']);
      await page.screenshot({path:`${output}/${mode}-interior.png`});
      const plaza=page.locator('.universe-node[data-map-id="space-plaza"] canvas');await plaza.scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>document.querySelector('.universe-node[data-map-id="space-plaza"] canvas')?.dataset.artState==='ready');
      assert.ok(await plaza.evaluate(canvas=>{const d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;return new Set(Array.from({length:d.length/16},(_,i)=>`${d[i*16]},${d[i*16+1]},${d[i*16+2]}`)).size>100;}));
      const fourth=page.locator('.universe-node[data-map-id="sleeping-stars-4"] .universe-node-select');
      await fourth.scrollIntoViewIfNeeded();await fourth.dblclick();await page.locator('#map-travel-confirm').waitFor({state:'visible'});
      assert.match(await page.locator('#map-travel-destination').textContent(),/3/);await page.locator('#map-travel-no').click();
    }
    results.push({mode,newImagesOnOpen:opened.length,deferred,opened});await context.close();
  }
  assert.ok(results[1].newImagesOnOpen<results[0].newImagesOnOpen*.6,'opening overview substantially reduces eager image requests');
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/result.json`,JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({before:results[0].newImagesOnOpen,after:results[1].newImagesOnOpen,deferred:results[1].deferred,checks:'painted plaza/interior, selected floor only, scroll loading, map4 gate confirmation',errors}));
}finally{await browser.close();await game.close();}
