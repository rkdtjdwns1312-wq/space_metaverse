import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {CONSTELLATIONS} from '../shared/constellations.js';
import {startTransformation,expireTransformation} from '../server/transformation.js';
import {appearanceLevelOf} from '../shared/character-skills.js';

// Use isolated players, never live classroom data. Audit every constellation's
// expiry as well as the equipment drawing that used to resemble a stuck buff.
for(const c of CONSTELLATIONS){
 for(const reason of ['deadline','death','disconnect','blackStar','constellationChange']){
  const p={role:'student',connected:true,avatar:{level:5,constellationId:c.id}};
  assert.equal(appearanceLevelOf(p),4);
  const state=startTransformation(p,1000);assert.equal(appearanceLevelOf(p),5);
  if(reason==='death')p.battleVitals.hp=0;
  if(reason==='disconnect')p.connected=false;
  if(reason==='blackStar')p.avatar.blackStar=true;
  if(reason==='constellationChange')p.avatar.constellationId=c.id==='taurus'?'cancer':'taurus';
  assert.equal(expireTransformation(p,reason==='deadline'?state.endsAt:1001),true,c.id+' '+reason);
  assert.equal(appearanceLevelOf(p),4,c.id+' restores normal appearance');
 }
}
console.log('PASS 16 constellations × 5 transformation endings');
const game=createClassroomServer({teacherKey:'isolated-aura-check',studentHours:false});
const {port}=await game.listen(),origin='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),args:['--no-proxy-server']});
mkdirSync('.local/avatar-aura',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:1120}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 if(process.env.AURA_BASELINE)await page.route('**/equipment-aura.js',r=>r.fulfill({contentType:'text/javascript',body:readFileSync(process.env.AURA_BASELINE,'utf8')}));
 await page.route('**/__aura_check__',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><style>body{background:#201f37;color:white;font:16px sans-serif;margin:16px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}figure{margin:0;text-align:center}canvas{width:225px;height:225px}h1{font-size:20px}</style><h1>Lv5 변신 중 → 변신 종료 · 저사양 장비 테두리 점검</h1><main></main>'}));
 await page.goto(origin+'/__aura_check__');
 const results=await page.evaluate(async()=>{
  const {drawEquipmentAura}=await import('/equipment-aura.js');
  const {CONSTELLATIONS,constellationOf}=await import('/shared/constellations.js');
  const {appearanceLevelOf}=await import('/shared/character-skills.js');
  const results=[];
  for(const c of CONSTELLATIONS){
   const p={avatar:{level:5,constellationId:c.id},equipmentSlots:['spirit-king-cloak+3','primordial-star-gem+9']};
   const figure=document.createElement('figure'),display=document.createElement('canvas');display.width=display.height=300;
   const dc=display.getContext('2d');figure.append(display);const caption=document.createElement('figcaption');caption.textContent=c.name;figure.append(caption);document.querySelector('main').append(figure);
   const canvas=document.createElement('canvas');canvas.width=canvas.height=300;const ctx=canvas.getContext('2d');
   for(const active of [true,false]){
    p.transformation={active};const sprite=new Image();sprite.src=constellationOf(c.id,appearanceLevelOf(p)).sprite;await sprite.decode();
    for(const aura of ['blue','orange','rainbow']){
     p.equipmentAura=aura;
     // One canvas reused across full -> reduced -> full quality: old pixels
     // must disappear after the world's usual clear, with no graphics-state leak.
     for(const low of [false,true,false]){
      ctx.clearRect(0,0,300,300);ctx.save();ctx.translate(150,150);
      const drawn=drawEquipmentAura(ctx,sprite,p,220,1500,false,low);ctx.restore();
      const bytes=ctx.getImageData(0,0,300,300).data;let pixels=0;for(let k=3;k<bytes.length;k+=4)if(bytes[k])pixels++;
      results.push({id:c.id,active,aura,low,drawn,pixels});
     }
    }
    dc.save();dc.translate(active?75:225,150);drawEquipmentAura(dc,sprite,p,145,1500,false,true);dc.drawImage(sprite,-72.5,-72.5,145,145);dc.restore();
    p.equipmentAura='';ctx.clearRect(0,0,300,300);
    if(drawEquipmentAura(ctx,sprite,p,220,1500,false,false))throw Error('unequipped aura retained');
   }
  }
  return results;
 });
 await page.screenshot({path:'.local/avatar-aura/'+(process.env.AURA_BASELINE?'before':'after')+'.png',fullPage:true});
 for(const r of results){assert.equal(r.drawn,!r.low,JSON.stringify(r));assert.equal(r.pixels>0,!r.low,JSON.stringify(r));}
 assert.deepEqual(errors,[]);console.log(`PASS ${results.length} render cases: all 16 sprites, both forms, three equipment auras, quality changes; unequip clears light`);
}finally{await browser.close();await game.close();}
