import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {departmentSlots} from '../shared/plaza-layout.js';
import {MAP,PLANET_TEMPLATES} from '../shared/config.js';

// Synthetic classroom: exercise the real placement/editor/create UI and rendered pixels.
const teacherKey='isolated-planet-integration',game=createClassroomServer({teacherKey,studentHours:false});
const {port}=await game.listen(),errors=[],checks=[];
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
mkdirSync('.local',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(18000);
  page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${port}`);
  await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(teacherKey);await fillNewClass(page,['그림검증']);
  await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  for(let i=0;i<15&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');
  const code=await page.locator('#room-code').textContent(),room=game.store.rooms.get(code),site=departmentSlots()[24];
  await page.locator('#dock-menu').click();await page.locator('#planet-new').click();
  await page.waitForFunction(()=>document.body.classList.contains('placing'));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const point=await page.locator('#world').evaluate((c,s)=>{const b=c.getBoundingClientRect();return {x:b.x+(s.x-Number(c.dataset.viewX))*Number(c.dataset.viewScale),y:b.y+(s.y-Number(c.dataset.viewY))*Number(c.dataset.viewScale)};},site);
  await page.mouse.click(point.x,point.y);await page.locator('#planet-create-dialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#planet-types label.type').count(),PLANET_TEMPLATES.length);
  assert.equal(await page.locator('#planet-custom-design').evaluate(b=>!b.nextElementSibling||b.nextElementSibling.tagName==='CANVAS'),true);
  checks.push('Real teacher placement opens unchanged presets followed by custom design');
  await page.locator('#planet-custom-design').click();const editor=page.locator('#planet-designer-dialog');
  await editor.locator('[data-field="background"]').fill('#00ff00');await editor.locator('[data-field="background"]').dispatchEvent('change');
  await editor.locator('[data-tool="star"]').click();await editor.locator('[data-field="color"]').fill('#ff00ff');
  const b=await editor.locator('canvas').boundingBox();await page.mouse.move(b.x+b.width*.25,b.y+b.height*.18);await page.mouse.down();await page.mouse.move(b.x+b.width*.45,b.y+b.height*.38,{steps:10});await page.mouse.up();
  await editor.locator('[data-action="save"]').click();await editor.waitFor({state:'detached'});
  assert.equal(await page.locator('#planet-custom-preview').isVisible(),true);assert.equal(await page.locator('#planet-types input:checked').count(),0);
  await page.locator('#planet-custom-design').click();assert.equal(await editor.locator('[data-field="count"]').textContent(),'1 / 120');
  await editor.locator('[data-action="clear"]').click();await editor.locator('[data-action="cancel"]').click();
  await page.locator('#planet-name').fill('내가그린행성');await page.locator('#planet-desc').fill('직접 그린 부서 행성입니다.');
  await page.locator('#planet-create-submit').click();await page.locator('#planet-create-dialog').waitFor({state:'hidden'});
  assert.equal(room.planets.size,1);const planet=[...room.planets.values()][0];
  assert.equal(planet.customDesign.background,'#00ff00');assert.equal(planet.customDesign.marks.length,1);assert.equal(planet.customDesign.marks[0].tool,'star');
  assert.equal(planet.templateId,PLANET_TEMPLATES[0].id);assert.equal(planet.name,'내가그린행성');
  checks.push('Custom selection, reopened editor cancellation, and server creation preserve the saved drawing');
  await page.locator('#map-overview').click();await page.locator('#map-area-view').click();
  // Inspect the green body, away from the star and name label, on actual world/minimap canvases.
  await page.waitForFunction(({p,map})=>{
    const green=rgba=>rgba[1]>150&&rgba[0]<90&&rgba[2]<90;
    const c=document.getElementById('world'),rect=c.getBoundingClientRect(),size=p.radius*2.65*Math.SQRT2*.9;
    const x=(p.x-Number(c.dataset.viewX))*Number(c.dataset.viewScale)*c.width/rect.width,y=(p.y-size*.25-Number(c.dataset.viewY))*Number(c.dataset.viewScale)*c.height/rect.height;
    const m=document.getElementById('minimap'),scale=Math.min((m.width-24)/map.width,(m.height-24)/map.height),ox=(m.width-map.width*scale)/2,oy=(m.height-map.height*scale)/2;
    return green(c.getContext('2d').getImageData(Math.round(x),Math.round(y),1,1).data)&&green(m.getContext('2d').getImageData(Math.round(ox+p.x*scale),Math.round(oy+p.y*scale),1,1).data);
  },{p:planet,map:{width:MAP.width,height:MAP.height}});
  checks.push('Custom green drawing is visible in world and minimap pixels');
  await page.screenshot({path:'.local/planet-integration-world.png'});
  await page.locator('#map-overview').click();await page.locator(`.universe-node[data-map-id="planet:${planet.id}"]`).waitFor({state:'visible'});
  await page.screenshot({path:'.local/planet-integration-map.png'});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:checks.length,checks,errors}));
}finally{await browser.close();await game.close();}
