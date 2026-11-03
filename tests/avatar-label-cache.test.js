import test from 'node:test';
import assert from 'node:assert/strict';
import {createAvatarLabelCache} from '../client/avatar-label-cache.js';
import {spiritKingLabelTop,monsterManaLayout} from '../client/boss-label-layout.js';
import {MONSTER_ATTACK_ART,monsterAttackPose} from '../client/monster-attack-frames.js';

function context(scale=1){
  const draws=[],ctx={draws,save(){},restore(){},font:'',fillStyle:'',measureText:text=>({width:String(text).length*10}),
    getTransform:()=>({a:scale,d:scale,b:0,c:0}),setTransform(){},beginPath(){},roundRect(){},fill(){},
    fillText(text){draws.push(['text',text]);},drawImage(...args){draws.push(['image',...args]);}};
  return ctx;
}
const label={name:'검사',detail:'LV4 사자자리'};
function setup(options={}){
  const made=[],fonts=new EventTarget();
  const cache=createAvatarLabelCache({fonts,createCanvas(){const c=context(),canvas={width:0,height:0,getContext:()=>c};made.push(canvas);return canvas;},...options});
  return {cache,made,fonts};
}
test('moving repeated labels reuse pixels, renamed/evolved labels render immediately',()=>{
  const {cache,made}=setup(),ctx=context(2);
  cache.beginFrame();const width=cache.draw(ctx,label,false,100,100);
  cache.beginFrame();assert.equal(cache.draw(ctx,label,false,200,120),width);assert.equal(made.length,1);
  cache.draw(ctx,{...label,name:'새 이름'},false,200,120);cache.draw(ctx,{...label,detail:'LV5 사자자리 · 초월체'},false,200,120);
  assert.equal(made.length,3);assert.equal(cache.stats().hits,1);
  assert.equal(ctx.draws.filter(d=>d[0]==='text').length,0);
});
test('DPR and self highlight are distinct; overview stays vector text',()=>{
  const {cache,made}=setup();cache.beginFrame();
  cache.draw(context(1),label,false,0,0);cache.draw(context(2),label,false,0,0);cache.draw(context(2),label,true,0,0);
  assert.equal(made.length,3);const overview=context(.4);cache.draw(overview,label,false,0,0);
  assert.deepEqual(overview.draws.filter(d=>d[0]==='text').map(d=>d[1]),[label.name,label.detail]);assert.equal(made.length,3);
});
test('a crowd over the memory limit falls back without per-frame cache churn',()=>{
  const {cache,made}=setup({limit:22000}),ctx=context();
  for(let frame=0;frame<5;frame++){cache.beginFrame();for(let i=0;i<20;i++)cache.draw(ctx,{...label,name:'동급'+i},false,0,0);assert.ok(cache.stats().bytes<=22000);}
  assert.equal(made.length,1);assert.ok(cache.stats().hits>=4);assert.ok(cache.stats().fallbacks>=95);
  cache.beginFrame();cache.beginFrame();cache.draw(ctx,{name:'다른',detail:'새 맵'},false,0,0);
  assert.equal(made.length,2);assert.ok(cache.stats().bytes<=22000);
});
test('font completion invalidates pixel widths and excessive single labels never allocate',()=>{
  const {cache,made,fonts}=setup({limit:22000}),ctx=context();
  cache.beginFrame();cache.draw(ctx,label,false,0,0);assert.equal(made.length,1);
  fonts.dispatchEvent(new Event('loadingdone'));assert.equal(cache.stats().bytes,0);
  cache.draw(ctx,label,false,0,0);assert.equal(made.length,2);
  cache.draw(ctx,{name:'가'.repeat(10000),detail:''},false,0,0);assert.equal(made.length,2);
  cache.dispose();assert.equal(cache.stats().entries,0);
});
test('disconnected translucent labels retain their original layer blending',()=>{
  const {cache,made}=setup(),ctx=context(2);ctx.globalAlpha=.45;
  cache.draw(ctx,label,false,0,0);assert.equal(made.length,0);
  assert.deepEqual(ctx.draws.map(d=>d[1]),[label.name,label.detail]);
});
test('ordinary monster mana sits below HP text, boss mana keeps its existing position',()=>{
  const normal=monsterManaLayout(false,100,9),boss=monsterManaLayout(true,100,14);
  assert.ok(normal.y>100+9+12+3);assert.ok(normal.textY-9>normal.y+normal.height);
  assert.deepEqual(boss,{y:117,height:12,textY:127});
});
test('Spirit King idle label anchor removes the unused 0.7-radius headroom',()=>{
  const m={x:500,y:600,radius:150,moving:false};
  assert.equal(spiritKingLabelTop(m,0),m.y-m.radius*1.45);
  assert.equal(spiritKingLabelTop(m,0)-(m.y+m.radius*.9-m.radius*3.05),105);
});
test('Spirit King label anchor follows every attack/walk painted top without crossing it',()=>{
  const m={x:500,y:600,radius:150,moving:true};
  for(const time of [0,65,130,260,390,520,650,780,910]){
    const art=MONSTER_ATTACK_ART['spirit-king-walk'],b=art.bounds[Math.floor(time/130)%8];
    const top=m.y+m.radius*.9+Math.sin(time*.012)*m.radius*.025-m.radius*art.height*(b[3]-b[1])/(art.bounds[0][3]-art.bounds[0][1]);
    assert.equal(spiritKingLabelTop(m,time),top);
  }
  for(const time of [25,75,125,180,240,320,390,470]){
    const attack={startedAt:0,durationMs:500},pose=monsterAttackPose(time,attack),art=MONSTER_ATTACK_ART['spirit-king'],b=art.bounds[pose.frame];
    const top=m.y+m.radius*.9-m.radius*art.height*(b[3]-b[1])/(art.bounds[0][3]-art.bounds[0][1]);
    assert.equal(spiritKingLabelTop(m,time,attack),top);
    assert.ok(top-48+14+3+12<top,'HP + MP bars leave a gap above the actual painted top');
  }
});
