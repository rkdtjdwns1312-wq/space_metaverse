import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

const root=process.cwd();
const fileUrl=file=>pathToFileURL(resolve(root,file)).href;
async function moduleUrl(file,rewrites){
  let source=await readFile(resolve(root,file),'utf8');
  for(const [from,to] of rewrites)source=source.replace(from,to);
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
class FakeImage {
  static created=[];
  constructor(){FakeImage.created.push(this);}
  complete=true;
  naturalWidth=1254;
  naturalHeight=1254;
  set src(value){this._src=value;}
  get src(){return this._src;}
}
function context(){
  const calls=[],stack=[];
  return {calls,globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();},
    drawImage(...args){calls.push({op:'drawImage',image:args[0],args:args.slice(1),alpha:this.globalAlpha});},
    createRadialGradient(...args){const stops=[];calls.push({op:'gradient',args,stops});return {addColorStop:(...stop)=>stops.push(stop)};},
    beginPath(){calls.push({op:'beginPath'});},ellipse(...args){calls.push({op:'ellipse',args});},fill(){calls.push({op:'fill'});},stroke(){calls.push({op:'stroke'});}};
}

test('Cancer aura uses each cleaned original crab at a shared centered size with soft, rising bubbles',async()=>{
  const oldImage=globalThis.Image;
  globalThis.Image=FakeImage;
  FakeImage.created=[];
  try{
    const portalsUrl=await moduleUrl('client/pisces-portals.js',[["from '/shared/pisces-portals.js'",`from '${fileUrl('shared/pisces-portals.js')}'`]]);
    const effectsUrl=await moduleUrl('client/water-effects.js',[
      ["from '/shared/water-skills.js'",`from '${fileUrl('shared/water-skills.js')}'`],
      ["from './pisces-bullet.js'",`from '${fileUrl('client/pisces-bullet.js')}'`],
      ["from './pisces-portals.js'",`from '${portalsUrl}'`]
    ]);
    const {drawWaterAura,preloadWater}=await import(effectsUrl);
    const render=(stage,elapsedMs)=>{const ctx=context();drawWaterAura(ctx,{kind:'cancer',stage,elapsedMs,durationMs:10000},240,180,60);return ctx;};
    const peak=render(4,2500),crabDraws=peak.calls.filter(call=>call.op==='drawImage');
    assert.equal(crabDraws.length,1,'원본 스킬 시트에서 게 프레임 하나만 그려야 해요.');
    assert.equal(crabDraws[0].image.src,'/assets/skills/cancer/source/crab-lv4-clean.png');
    assert.deepEqual(crabDraws[0].args.slice(0,4),[0,0,1248,1254]);
    assert.ok(Math.abs(crabDraws[0].args[4]-(240-129*(1248/1254)/2))<.001);
    assert.ok(Math.abs(crabDraws[0].args[5]-(180-10.8-64.5))<.001);
    assert.ok(Math.abs(crabDraws[0].args[6]-(129*(1248/1254)))<.001);
    assert.equal(crabDraws[0].args[7],129);
    assert.equal(peak.calls.filter(call=>call.op==='ellipse').length,16,'옅은 기포 8개만 그려야 해요.');
    assert.equal(peak.calls.filter(call=>call.op==='gradient').length,8);
    assert.equal(peak.calls.some(call=>call.op==='arc'),false,'물결이나 원형 테두리를 그리지 않아야 해요.');

    const later=render(4,7500).calls.find(call=>call.op==='drawImage');
    assert.deepEqual(later.args,crabDraws[0].args,'E 지속 중 게 그림 크기는 고정이어야 해요.');
    const reduced=context();drawWaterAura(reduced,{kind:'cancer',stage:2,elapsedMs:2500,durationMs:10000},240,180,60,true);
    assert.deepEqual(reduced.calls.find(call=>call.op==='drawImage').args,render(2,2500).calls.find(call=>call.op==='drawImage').args,'동작 줄이기 설정에서도 해당 단계 크기를 유지해야 해요.');

    const normalizedDraws=[];
    for(const [stage,bounds] of [[2,[17,19,1231,1219]],[3,[0,8,1230,1246]],[4,[0,0,1248,1254]]]){
      const draw=render(stage,2500).calls.find(call=>call.op==='drawImage');
      assert.equal(draw.image.src,`/assets/skills/cancer/source/crab-lv${stage}-clean.png`,'단계별 편집 완료 원화를 연결해야 해요.');
      assert.deepEqual(draw.args.slice(0,4),bounds,'각 원화의 투명 여백을 제외한 실제 게 바운딩을 사용해야 해요.');
      const [, ,sw,sh,dx,dy,dw,dh]=draw.args;
      normalizedDraws.push({centerX:dx+dw/2,centerY:dy+dh/2,largest:Math.max(dw,dh)});
    }
    for(const bounds of normalizedDraws){
      assert.ok(Math.abs(bounds.centerX-240)<.001&&Math.abs(bounds.centerY-(180-10.8))<.001,'단계별 게 중심을 고정해야 해요.');
      assert.ok(Math.abs(bounds.largest-129)<.001,'단계별 투명 여백이 달라도 게 크기를 맞춰야 해요.');
    }

    const entry=render(4,225),exit=render(4,9775);
    assert.ok(entry.calls.find(call=>call.op==='drawImage').alpha<.51,'부드럽게 나타나야 해요.');
    assert.ok(exit.calls.find(call=>call.op==='drawImage').alpha<.51,'부드럽게 사라져야 해요.');
    assert.ok(peak.calls.find(call=>call.op==='drawImage').alpha>entry.calls.find(call=>call.op==='drawImage').alpha);
    preloadWater('cancer',['attack']);
    assert.ok(FakeImage.created.some(image=>image.src==='/assets/skills/cancer/attack.png'),'게자리 Q 원화 사전 로드를 유지해야 해요.');
  } finally {
    if(oldImage===undefined)delete globalThis.Image;else globalThis.Image=oldImage;
  }
});
