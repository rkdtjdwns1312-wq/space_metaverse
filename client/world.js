import {createProjectileEffects} from './projectile-effects.js';
import {createDamageNumbers} from './damage-numbers.js';
import {drawCorvus,preloadCorvus} from './corvus-effects.js';
import {appearanceLevelOf,CORVUS_VFX} from '/shared/character-skills.js';
import {avatarFloorRadius} from '/shared/avatar-boundary.js';
import {createInteriorBoardUI} from './interior-board-ui.js';
import {inMarket} from '/shared/market.js';
import {drawPlazaLandmark,drawDepartmentHome,drawBazaar,drawPaintedStarShop,PLAZA_SIGNS,drawPlazaSign} from './plaza-props.js';
import {floorRenderPoint} from '/shared/paradise-floor.js';
import {departmentSite,DEPARTMENT_ZONE} from '/shared/plaza-layout.js';
import {drawPlazaGround,drawPlazaPillar,drawDepartmentGuide} from './plaza-art.js';
import {drawLifeStar} from './life-star-art.js';
import {drawValleyAltar} from './valley-art.js';
import {drawInteriorFloor,drawInteriorProp,drawInteriorDecoration} from './interior-art.js';
import {drawStreetGround} from './street-art.js';
import {drawPaintedProp} from './painted-props.js';
import {departmentVisualBox} from './department-art.js';
import {drawPaintedGate,gateVisualBox} from './gate-art.js';
import {drawWaterMonster} from './water-monster-art.js';
import {drawLv2Monster} from './lv2-monster-art.js';
import {drawSunMonster} from './sun-monster-art.js';
import {drawCelestialMonster,CELESTIAL_MONSTER_ART} from './celestial-monster-art.js';
import {drawCraftingMachine} from './crafting-art.js';
import {drawEnergyShop} from './energy-shop-art.js';
import {drawStarCard} from './star-card-art.js';
import {ATTACK_VISUAL} from '/shared/combat.js';
import {skillEffectById} from '/shared/skill-effects.js';
import {drawSkillEffect} from './skill-effects.js';
import {drawSagittarius} from './sagittarius-effects.js';
import { STATIC_MAPS, mapOf, PLAZA_ID, PLANET, STREET_ID, GARDEN_ID, VALLEY_ID, MAP, STREET, templateOf, planetIdOfMap } from '/shared/config.js';
import { drawCrossroads, drawParadise, drawStarParadise, drawRainbowSpace, drawValley, drawStarOrigin } from './scenery.js';
import * as config from '/shared/config.js';
import { createMotionTrack } from './motion.js';
import {monsterType,monsterVisualScale} from '/shared/monsters.js';
import {drawMonster} from './monster-art.js';
import {constellationOf} from '/shared/constellations.js';
import {avatarLabel} from '/shared/avatar-label.js';
import {TEACHER_AVATAR} from '/shared/teacher-avatar.js';
import {ENERGY_DROPS} from '/shared/energy-drops.js';
import {avatarSizeOf} from '/shared/avatar-size.js';
const TEACHER_SPRITE=TEACHER_AVATAR.sprite;
import {interiorDecorStyle,interiorDecorColor} from '/shared/interior-decor.js';
const avatarSprites=new Map();
const portraitPlayers=new WeakMap();
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
// 원화는 그대로 두고 주변 성운의 밝기·회전만 천천히 바꿉니다.
function celestialAura(ctx,color,r,time){
  const phase=reducedMotion.matches?0:time/2400;
  ctx.save();ctx.rotate(Math.sin(phase)*.12);
  const glow=ctx.createRadialGradient(0,0,r*.15,0,0,r);
  glow.addColorStop(0,color+'60');glow.addColorStop(.55,color+'30');glow.addColorStop(1,color+'00');
  ctx.fillStyle=glow;ctx.globalAlpha*=.8+Math.sin(phase)*.15;
  ctx.scale(1, .8+Math.sin(phase+.7)*.06);ctx.fillRect(-r,-r,r*2,r*2);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5+.2;drawStar(ctx,Math.cos(a)*r*.8,Math.sin(a)*r*.8,1.7+(Math.sin(phase+i)+1)*.5,'#fff3cf');}
  ctx.restore();
}
function loadedAvatarSprite(path,onLoad){
  if(!path)return null;
  let image=avatarSprites.get(path);
  if(!image){image=new Image();image.src=path;avatarSprites.set(path,image);}
  if(image.complete&&image.naturalWidth)return image;
  if(onLoad)image.addEventListener('load',onLoad,{once:true});
  return null;
}
const CHAT=config.CHAT||{maxLength:100,bubbleBaseMs:3000,bubblePerCharMs:90,bubbleMaxMs:12000};
const NEAR=(config.RULES?.radius||16)+(config.INTERACT?.radius||40);
// 여러 캔버스(광장 지도·아바타 카드 일러스트)에서 함께 쓰는 별 그리기.
function drawStar(ctx,x,y,r,fill){
  ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,s=i%2?r*.47:r;
    i?ctx.lineTo(x+Math.cos(a)*s,y+Math.sin(a)*s):ctx.moveTo(x+Math.cos(a)*s,y+Math.sin(a)*s);}
  ctx.closePath();ctx.fillStyle=fill;ctx.fill();
}
// Canvas renderer만 교체하면 서버 규칙을 바꾸지 않고 그림을 바꿀 수 있습니다.
// 행성은 정적 목록이 아니라 room.planets 스냅샷(가변 개수, 최대 PLANET.maxPerRoom)입니다.
export function createWorld(canvas) {
  const interiorBoard=createInteriorBoardUI(canvas);
  const ctx=canvas.getContext('2d'); let players=[],selfId=null,planets=[],proposals=[],myMapId=PLAZA_ID,placement=null,placing=false;
  const points=new Map(),tracks=new Map(),bubbles=new Map();
  const projectiles=createProjectileEffects(canvas);
  let hits=[],starCards=[],energyDrops=[];
  let sagittariusCasts=[],sagittariusEffects=[];
  const myEnergyDrops=()=>energyDrops.filter(d=>d.mapId===myMapId&&d.expiresAt>Date.now()&&d.shares.some(s=>s.playerId===selfId&&s.amount>0));
  const damageNumbers=createDamageNumbers();
  let monsters=[];const monsterAttacks=new Map();const monsterTracks=new Map(),monsterPoints=new Map();
  function setMonsters(data){
    monsters=data;const now=performance.now();
    for(const m of monsters){if(!monsterTracks.has(m.id))monsterTracks.set(m.id,createMotionTrack());monsterTracks.get(m.id).push(m.x,m.y,m.mapId,now);}
    for(const id of monsterTracks.keys())if(!monsters.some(m=>m.id===id)){monsterTracks.delete(id);monsterPoints.delete(id);}
  }
  let view={x:0,y:0,scale:1},overview=false;
  function recordPosition(p,now){
    if(!tracks.has(p.id))tracks.set(p.id,createMotionTrack());
    tracks.get(p.id).push(p.x,p.y,p.mapId||PLAZA_ID,now);
  }
  const stars=Array.from({length:105},(_,i)=>({x:(i*137+41)%1200,y:(i*191+23)%760,r:i%5===0?2:1}));
  const star=(x,y,r,fill)=>drawStar(ctx,x,y,r,fill);
  function currentMap(){return mapOf(myMapId,planets.map(p=>({...p,kind:'planet'})));}
  function placementOk(pt){
    const r=PLANET.radius+(config.RULES?.radius||16);
    if(!departmentSite(pt.x,pt.y,r))return false;
    if(pt.x<r||pt.y<r||pt.x>MAP.width-r||pt.y>MAP.height-r)return false;
    if((PLANET.reserved||[]).some(z=>{const cx=Math.max(z.x,Math.min(pt.x,z.x+z.width)),cy=Math.max(z.y,Math.min(pt.y,z.y+z.height));return Math.hypot(pt.x-cx,pt.y-cy)<PLANET.radius;}))return false;
    const bodies=[...mapOf(PLAZA_ID,[]).objects,...planets,...proposals];
    return !bodies.some(o=>Math.hypot(pt.x-o.x,pt.y-o.y)<PLANET.radius+(o.radius||PLANET.radius)+PLANET.minGap);
  }
  // 행성 종류(templateOf(o.templateId).look)에 따라 겉모습을 다르게 꾸며 줍니다. 종류를 모르면 장식 없이 기본 모양만 그립니다.
  function drawPlanetLook(o,template,time){
    const look=template.look;
    if(look==='ribbon'){
      ctx.save();ctx.beginPath();ctx.arc(o.x,o.y,o.radius,0,Math.PI*2);ctx.clip();
      ctx.translate(o.x,o.y);ctx.rotate(-.5);ctx.fillStyle='#ffffff59';ctx.fillRect(-o.radius*1.3,-10,o.radius*2.6,20);
      ctx.restore();
    } else if(look==='stripes'){
      ctx.save();ctx.beginPath();ctx.arc(o.x,o.y,o.radius,0,Math.PI*2);ctx.clip();
      ctx.fillStyle='#ffffff4a';for(let i=-1;i<=1;i++)ctx.fillRect(o.x-o.radius,o.y+i*16-6,o.radius*2,8);
      ctx.restore();
    } else if(look==='pages'){
      ctx.strokeStyle='#ffffff66';ctx.lineWidth=2;
      for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(o.x,o.y+6,o.radius*.5+i*8,.15*Math.PI,.85*Math.PI);ctx.stroke();}
    } else if(look==='shield'){
      ctx.strokeStyle='#ffffff80';ctx.lineWidth=3;ctx.beginPath();ctx.arc(o.x,o.y,o.radius-6,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='#ffffff45';ctx.lineWidth=2;ctx.beginPath();ctx.arc(o.x,o.y,o.radius-12,0,Math.PI*2);ctx.stroke();
    } else if(look==='ball'){
      for(let i=0;i<5;i++){const a=-Math.PI/2+i*2*Math.PI/5,r=o.radius*.55;
        ctx.fillStyle='#5c5470aa';ctx.beginPath();ctx.arc(o.x+Math.cos(a)*r,o.y+Math.sin(a)*r,4,0,Math.PI*2);ctx.fill();}
    } else if(look==='plate'){
      ctx.strokeStyle='#ffffff70';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(o.x,o.y,o.radius-8,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.arc(o.x,o.y,o.radius-16,0,Math.PI*2);ctx.stroke();
    } else if(look==='bolts'){
      for(let i=0;i<6;i++){const a=i*Math.PI/3,r=o.radius-9;
        ctx.fillStyle='#5c5470cc';ctx.beginPath();ctx.arc(o.x+Math.cos(a)*r,o.y+Math.sin(a)*r,3,0,Math.PI*2);ctx.fill();}
    } else if(look==='coins'){
      for(const [dx,dy] of [[-14,-8],[10,-14],[2,12]]){
        ctx.fillStyle='#fff3b0cc';ctx.beginPath();ctx.arc(o.x+dx,o.y+dy,7,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#c9a13ecc';ctx.lineWidth=1.4;ctx.stroke();
      }
    } else if(look==='heart'){
      const hg=ctx.createRadialGradient(o.x,o.y,4,o.x,o.y,o.radius*1.3);hg.addColorStop(0,'#ff9fc355');hg.addColorStop(1,'#ff9fc300');
      ctx.fillStyle=hg;ctx.fillRect(o.x-o.radius*1.3,o.y-o.radius*1.3,o.radius*2.6,o.radius*2.6);
    } else if(look==='sparkle'){
      for(let i=0;i<3;i++){const phase=(time||0)/300+i*2,r=o.radius*.6;
        const sx=o.x+Math.cos(phase+i)*r*.5,sy=o.y+Math.sin(phase*1.3+i)*r*.5;
        ctx.save();ctx.globalAlpha=(Math.sin(phase*2+i)+1)/2*.7+.3;star(sx,sy,5,'#ffe59b');ctx.restore();
      }
    } else if(look==='splash'){
      for(const [c,dx,dy] of [['#ff8fa8',-16,-10],['#8fd0ff',10,-14],['#ffe08f',-4,12],['#b78fff',14,8]]){
        ctx.fillStyle=c+'cc';ctx.beginPath();ctx.arc(o.x+dx,o.y+dy,5,0,Math.PI*2);ctx.fill();
      }
    } else if(look==='stars'){
      star(o.x-14,o.y-16,6,'#fff3c2');star(o.x+16,o.y-10,5,'#fff3c2');
      ctx.strokeStyle='#ffffff55';ctx.lineWidth=2;ctx.beginPath();ctx.arc(o.x,o.y,o.radius-5,0,Math.PI*2);ctx.stroke();
    } else if(look==='eye'){
      ctx.strokeStyle='#4a4361aa';ctx.lineWidth=3;ctx.beginPath();ctx.arc(o.x,o.y,o.radius*.5,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#4a4361cc';ctx.beginPath();ctx.arc(o.x,o.y,6,0,Math.PI*2);ctx.fill();
    }
  }
  // 광장 지도의 행성 하나(구체+하이라이트+내 소속 테두리+종류별 장식+가운데 아이콘)를 그립니다.
  function drawPlanet(o,myDept,time){
    drawDepartmentHome(ctx,o,myDept,templateOf(o.templateId));
  }
  function drawMap(map,time){
    drawPlazaGround(ctx,map,time);
    for(const sign of PLAZA_SIGNS)drawPlazaSign(ctx,sign);
    const me=players.find(p=>p.id===selfId),myDept=me?.departmentId;
    for(const o of map.objects){
      ctx.fillStyle='#9387b017';ctx.beginPath();ctx.ellipse(o.x,o.y+o.radius*.8,o.radius*1.08,o.radius*.4,0,0,Math.PI*2);ctx.fill();
      if(o.kind==='life-star'){
        drawLifeStar(ctx,o,time,reducedMotion.matches);
      } else if(o.kind==='star'){
        const glow=ctx.createRadialGradient(o.x,o.y,10,o.x,o.y,110);glow.addColorStop(0,'#ffe9a970');glow.addColorStop(1,'#ffe9a900');
        ctx.fillStyle=glow;ctx.fillRect(o.x-110,o.y-110,220,220);star(o.x,o.y,o.radius,'#fff2c9');star(o.x,o.y,o.radius-7,o.color);
      } else if(o.kind==='gate'){
        drawGate(o);continue;
      } else if(o.kind==='black-hole'){
        drawBlackHole(o,time);continue;
      } else if(o.kind==='andromeda'){
        drawAndromeda(o,time);continue;
      } else if(o.kind==='market'){
        drawBazaar(ctx,o);continue;
      } else if(o.kind==='pillar'){
        // 기둥은 아래에서 아바타와 발 위치 순서로 함께 그립니다.
        continue;
      } else {
        drawPlanet(o,myDept,time);
      }
      // 가장자리 행성의 긴 이름이 캔버스 밖으로 잘리지 않도록 이름표 x를 안쪽으로 밀어 넣습니다.
      ctx.font='600 17px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#716389';
      const half=ctx.measureText(o.name).width/2+8,lx=Math.min(map.width-half,Math.max(half,o.x));
      if(o.kind==='pillar'){
        // scenery의 받침대 중심은 o.y입니다. 글씨를 이미지 바닥에 겹쳐 붙입니다.
        ctx.save();ctx.strokeStyle='#fff6fc';ctx.lineWidth=4;ctx.lineJoin='round';
        ctx.strokeText(o.name,lx,o.y+5);ctx.fillText(o.name,lx,o.y+5);ctx.restore();
      }else ctx.fillText(o.name,lx,o.y+o.radius+37);
      if(o.kind==='planet'){ctx.font='12px "Jua","Malgun Gothic",sans-serif';ctx.fillStyle='#938aab';ctx.fillText('소속 '+(o.memberCount||0)+'명',lx,o.y+o.radius+53);}
      if(o.kind==='planet'&&o.reportPending){
        ctx.font='16px "Jua","Malgun Gothic",sans-serif';const width=ctx.measureText('실적제출확인요함').width+20;
        const badgeY=departmentVisualBox(o).y-32;
        ctx.fillStyle='#fff1bf';ctx.beginPath();ctx.roundRect(lx-width/2,badgeY,width,28,12);ctx.fill();
        ctx.fillStyle='#805218';ctx.fillText('실적제출확인요함',lx,badgeY+19);
      }
    }
    for(const o of proposals){
      ctx.save();ctx.globalAlpha=.6;ctx.setLineDash([5,7]);ctx.strokeStyle=o.color;ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(o.x,o.y,PLANET.radius,0,Math.PI*2);ctx.stroke();ctx.restore();
      const template=templateOf(o.templateId);
      if(template){ctx.save();ctx.globalAlpha=.85;ctx.font='22px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(template.icon,o.x,o.y);ctx.restore();}
      ctx.font='600 15px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#716389';
      ctx.fillText(o.name,o.x,o.y+PLANET.radius+22);
      ctx.font='11px "Jua","Malgun Gothic",sans-serif';ctx.fillStyle='#a09ab7';
      ctx.fillText('승인 기다리는 중',o.x,o.y+PLANET.radius+38);
    }
    for(const card of starCards)drawStarCard(ctx,card,time);
    if(placing||placement){
      drawDepartmentGuide(ctx);
      // 배치 모드: 행성을 만들 수 없는 예약 구역(이동 버튼 자리)을 빗금으로 보여 줍니다.
      for(const z of PLANET.reserved||[]){
        ctx.save();ctx.fillStyle='#9a92b41f';ctx.fillRect(z.x,z.y,z.width,z.height);
        ctx.strokeStyle='#9a92b4';ctx.lineWidth=1;ctx.setLineDash([3,5]);ctx.strokeRect(z.x+.5,z.y+.5,z.width-1,z.height-1);ctx.restore();
        ctx.font='12px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#8f84a6';ctx.fillText(z.label||'만들 수 없는 자리',z.x+z.width/2,z.y+22);
      }
    }
    if(placement){
      // 서버와 같은 규칙으로 미리 보여 주기만 합니다(경계·별·행성·신청과의 간격·예약 구역). 최종 판정은 서버가 합니다.
      const ok=placementOk(placement),color=ok?'#6353ae':'#d0506a';
      ctx.save();ctx.setLineDash([6,6]);ctx.strokeStyle=color;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(placement.x,placement.y,PLANET.radius,0,Math.PI*2);ctx.stroke();ctx.restore();
      ctx.font='600 13px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle=color;
      ctx.fillText(ok?'여기에 만들기':'여기는 안 돼요 · 다른 자리를 골라요',placement.x,placement.y+PLANET.radius+20);
    }
  }
  function drawBlackHole(o,time){
    drawPlazaLandmark(ctx,o);
  }
  function drawAndromeda(o,time){drawPlazaLandmark(ctx,o);}
  // 모든 정적 맵과 부서 출구에 공통 원화를 적용합니다.
  function drawGate(o){
    drawPaintedGate(ctx,o);
    ctx.font='600 15px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#6a5f8a';
    const destination=STATIC_MAPS[o.target],bounds=mapOf(myMapId);
    const labelX=o.x,labelY=gateVisualBox(o).y-30;
    const width=Math.max(60,Math.min(265,2*Math.min(o.x,bounds.width-o.x)-12));
    const label=destination?.name||String(o.name).replace(/[←↑→↓↔↕⬅⬆➡⬇]/gu,'').trim();
    ctx.strokeStyle='#fff9fc';ctx.lineWidth=4;ctx.strokeText(label,labelX,labelY,width);ctx.fillText(label,labelX,labelY,width);
    if(destination?.minLevel){ctx.font='13px "Jua","Malgun Gothic",sans-serif';ctx.strokeText('LV'+destination.minLevel+' 이상',labelX,labelY+18,width);ctx.fillText('LV'+destination.minLevel+' 이상',labelX,labelY+18,width);}
  }
  // 맵 아래쪽의 작은 집 상점. 지붕 위에 간판을 붙입니다.
  function drawShop(o){drawPaintedStarShop(ctx,o);}

  function drawLamp(o){
    const poleTop=o.y-o.radius*1.6;
    ctx.strokeStyle='#c8bde8';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(o.x,o.y+o.radius*.6);ctx.lineTo(o.x,poleTop);ctx.stroke();
    const glow=ctx.createRadialGradient(o.x,poleTop,2,o.x,poleTop,42);
    glow.addColorStop(0,'#fff2c9cc');glow.addColorStop(1,'#fff2c900');
    ctx.fillStyle=glow;ctx.fillRect(o.x-42,poleTop-42,84,84);
    ctx.fillStyle=o.color||'#fff2c9';ctx.beginPath();ctx.arc(o.x,poleTop,10,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#e8dba0';ctx.lineWidth=2;ctx.stroke();
  }
  function drawStreet(map){
    drawStreetGround(ctx,map);
    for(const o of map.objects){
      if(o.kind==='gate'){drawGate(o);continue;}
      if(o.kind==='shop'){drawShop(o);continue;}
      if(o.kind==='energy-shop'){drawEnergyShop(ctx,o);continue;}
      if(o.kind==='crafting'){drawCraftingMachine(ctx,o);continue;}
      if(o.kind==='lamp'){drawLamp(o);continue;}
      if(o.kind==='arcade'){
        if(drawPaintedProp(ctx,o))continue;
        ctx.fillStyle=o.color;ctx.beginPath();ctx.roundRect(o.x-33,o.y-58,66,92,12);ctx.fill();ctx.strokeStyle='#ffffffbb';ctx.lineWidth=3;ctx.stroke();
        ctx.fillStyle='#565078';ctx.beginPath();ctx.roundRect(o.x-25,o.y-46,50,43,7);ctx.fill();star(o.x,o.y-24,12,'#fff2b2');
        ctx.fillStyle='#faf2ff';ctx.beginPath();ctx.arc(o.x-13,o.y+12,7,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(o.x+15,o.y+12,4,0,Math.PI*2);ctx.fill();
        ctx.font='14px Jua,sans-serif';ctx.textAlign='center';ctx.fillStyle='#514771';ctx.fillText(o.name,o.x,o.y+58);
      }
    }
    ctx.font='13px "Jua","Malgun Gothic",sans-serif';ctx.fillStyle='#ded6f5';ctx.textAlign='center';
  }
  function drawInterior(map,time){
    if(map.id==='black-hole')return drawBlackHoleInterior(map,time);
    const planet=planets.find(p=>p.id===map.planetId);
    drawInteriorFloor(ctx,map,planet);
    for(const o of map.objects){
      if(o.kind==='door'){drawGate({...o,target:PLAZA_ID});drawInteriorDecoration(ctx,o,interiorDecorStyle(planet?.interiorDecor,o.id));}
      else drawInteriorProp(ctx,o,planet);
    }
  }
  function drawBlackHoleInterior(map,time){
    ctx.fillStyle='#010106';ctx.fillRect(0,0,1200,760);
    const g=ctx.createRadialGradient(600,350,20,600,350,620);g.addColorStop(0,'#09051a');g.addColorStop(1,'#000');ctx.fillStyle=g;ctx.fillRect(0,0,1200,760);
    for(const s of stars){ctx.fillStyle='#bda8ff55';ctx.beginPath();ctx.arc(s.x,(s.y*1.13)%760,s.r*.7,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='#3b285e';ctx.lineWidth=2;ctx.strokeRect(16,16,1168,728);
    const darkStar=map.objects?.find(o=>o.kind==='black-star');
    if(darkStar){
      const pulse=window.matchMedia('(prefers-reduced-motion: reduce)').matches?.45:(Math.sin(time/900)+1)*.18+.27;
      ctx.save();ctx.shadowColor=`rgba(255,255,255,${pulse})`;ctx.shadowBlur=28;
      drawStar(ctx,darkStar.x,darkStar.y,darkStar.radius,'#020205');
      ctx.lineWidth=2;ctx.strokeStyle=`rgba(255,255,255,${pulse+.15})`;ctx.stroke();ctx.restore();
      ctx.save();ctx.textAlign='center';ctx.font='700 17px "Jua","Malgun Gothic",sans-serif';ctx.fillStyle='#e9e5f2';ctx.fillText(darkStar.name,darkStar.x,darkStar.y+darkStar.radius+32);ctx.restore();
    }
    const door=map.objects?.find(o=>o.kind==='gate');if(door)drawGate(door);
  }
  function drawBubble(id,x,y){
    const b=bubbles.get(id);if(!b)return;
    if(Date.now()>b.until){bubbles.delete(id);return;}
    ctx.font='600 13px "Jua","Malgun Gothic",sans-serif';
    // 글자 단위로 폭을 재어 230px 안에서 줄바꿈하고, 카메라 화면 안으로 좌우를 맞춥니다.
    const maxTextWidth=208,lines=[];let line='';
    for(const char of Array.from(b.text)){
      const next=line+char;
      if(line&&ctx.measureText(next).width>maxTextWidth){lines.push(line);line=char;}else line=next;
    }
    if(line||!lines.length)lines.push(line);
    const w=Math.min(230,Math.max(44,...lines.map(value=>ctx.measureText(value).width+22)));
    const lineHeight=18,h=lines.length*lineHeight+12;
    const visibleWidth=canvas.width/Math.min(window.devicePixelRatio||1,2)/view.scale;
    const visibleLeft=view.x+8,visibleRight=view.x+visibleWidth-8;
    const bx=Math.max(visibleLeft+w/2,Math.min(visibleRight-w/2,x)),by=Math.max(view.y+8,y-38-h);
    ctx.fillStyle='#ffffff';ctx.strokeStyle='#d8d3ea';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.roundRect(bx-w/2,by,w,h,10);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(bx-6,by+h-1);ctx.lineTo(bx+6,by+h-1);ctx.lineTo(bx,by+h+8);ctx.closePath();ctx.fillStyle='#ffffff';ctx.fill();
    ctx.fillStyle='#524969';ctx.textAlign='center';
    lines.forEach((value,index)=>ctx.fillText(value,bx,by+lineHeight+index*lineHeight));
  }
  function drawAvatar(p,time){
    const point=points.get(p.id)||{x:p.x,y:p.y};
    const x=point.x,y=point.y,size=avatarSizeOf(p);
    const effects=(p.effects||[]).slice(0,3);
    ctx.save();ctx.globalAlpha=p.connected?1:.45;
    if(effects.some(e=>e.style==='glow')){
      const glow=ctx.createRadialGradient(x,y,4,x,y,40);glow.addColorStop(0,'#fff2b880');glow.addColorStop(1,'#fff2b800');
      ctx.fillStyle=glow;ctx.fillRect(x-40,y-40,80,80);
    }
    ctx.fillStyle='#7f719a29';ctx.beginPath();ctx.ellipse(x,y+19,19,6,0,0,Math.PI*2);ctx.fill();
    if(p.id===selfId&&(p.role==='teacher'||p.avatar?.level<2)){ctx.strokeStyle='#8061b0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+18,23,8,0,0,Math.PI*2);ctx.stroke();}
    ctx.translate(x,y);
    const constellation=p.avatar?.level>=2?constellationOf(p.avatar.constellationId,appearanceLevelOf(p)):null;
    if(p.role==='teacher'){
      celestialAura(ctx,'#e9c77b',58,time);
      const sprite=loadedAvatarSprite(TEACHER_SPRITE);
      if(sprite)ctx.drawImage(sprite,-48,-48,96,96);
      else star(0,0,26,'#e9c77b');
    }else if(p.avatar?.blackStar){
      const radius=24;
      star(0,0,radius,'#050509');ctx.strokeStyle='#b18cff';ctx.lineWidth=3;ctx.stroke();
      ctx.fillStyle='#fff';ctx.font='20px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✦',0,1);ctx.textBaseline='alphabetic';
    }else if(constellation){
      const sprite=loadedAvatarSprite(constellation.sprite);
      if(constellation.celestial)celestialAura(ctx,constellation.color,size*.63,time);
      // 몸 그림만 반전합니다. 이름표·말풍선·HP 글자는 원래 방향을 유지합니다.
      if(sprite){ctx.save();ctx.scale((p.facingX===-1?-1:1)*(constellation.spriteFacingX||1),1);ctx.drawImage(sprite,-size/2,-size/2,size,size);ctx.restore();}
      else{const radius=size*.4;
        star(0,0,radius,constellation.color);ctx.strokeStyle='#ffffffcf';ctx.lineWidth=1.5;ctx.stroke();
        ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(constellation.icon,0,1);ctx.textBaseline='alphabetic';}
    }else{
    ctx.beginPath();for(let i=0;i<9;i++){const a=i*2*Math.PI/9,r=16+[1,0,2,-1,1,0,1,-1,0][i];
      i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}
    ctx.closePath();ctx.fillStyle='#c9c1e6';ctx.fill();ctx.strokeStyle='#aaa0ce';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#afa4d0';ctx.beginPath();ctx.arc(-6,-7,4,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(9,8,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#524969';ctx.beginPath();ctx.arc(-4,1,1.6,0,Math.PI*2);ctx.arc(4,1,1.6,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#66577e';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(0,5,3,.15,Math.PI-.15);ctx.stroke();
    }
    if(effects.some(e=>e.style==='sparkle')){
      for(let i=0;i<3;i++){
        const phase=(time||0)/260+i*2.1,r=24+i*3;
        const sx=Math.cos(phase)*r,sy=Math.sin(phase*1.4)*r*.6-14;
        ctx.save();ctx.globalAlpha=((Math.sin(phase*2)+1)/2*.85+.15)*(p.connected?1:.45);star(sx,sy,3.5,'#ffe59b');ctx.restore();
      }
    }
    ctx.translate(-x,-y);
    if(effects.length){ctx.font='14px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#3a3450';ctx.fillText(effects.map(e=>e.icon).join(' '),x,y-size/2-22);}
    ctx.font=(p.id===selfId?'700 ':'500 ')+'14px "Jua","Malgun Gothic",sans-serif';
    const label=avatarLabel(p),nameWidth=ctx.measureText(label.name).width;
    ctx.font='11px "Jua","Malgun Gothic",sans-serif';
    const w=Math.max(nameWidth,ctx.measureText(label.detail).width)+18,top=y+(p.role==='teacher'?44:constellation?size/2+4:29);
    ctx.fillStyle='#fffffff0';ctx.beginPath();ctx.roundRect(x-w/2,top,w,40,9);ctx.fill();
    ctx.fillStyle=p.id===selfId?'#6e4d9b':'#57536d';ctx.textAlign='center';
    ctx.font='14px "Jua","Malgun Gothic",sans-serif';ctx.fillText(label.name,x,top+16);
    ctx.font='11px "Jua","Malgun Gothic",sans-serif';ctx.fillStyle='#726782';ctx.fillText(label.detail,x,top+32);
    if(p.id===selfId){canvas.dataset.selfLabelName=label.name;canvas.dataset.selfLabelDetail=label.detail;canvas.dataset.selfSprite=p.role==='teacher'?TEACHER_SPRITE:constellation?.sprite||'';canvas.dataset.selfSize=String(size);canvas.dataset.selfFacingX=String(p.facingX||1);canvas.dataset.selfLabelY=String(top);}
    if(effects.some(e=>e.style==='happy')){ctx.font='14px "Jua","Malgun Gothic",sans-serif';ctx.fillStyle='#c9628f';ctx.fillText('♪',x+w/2+11,y+46);}
    drawBubble(p.id,x,y-Math.max(0,size/2-16));
    ctx.restore();
  }
  function frame(t){
    // 도착한 위치를 시간순으로 재생합니다. 화면 프레임 수와 관계없이 같은 시각은
    // 같은 위치가 되며, 카메라도 아바타와 정확히 같은 좌표를 사용합니다.
    for(const p of players){
      const position=tracks.get(p.id)?.at(t)||{x:p.x,y:p.y};
      points.set(p.id,floorRenderPoint(mapOf(p.mapId,planets),position,{x:p.x,y:p.y},avatarFloorRadius(p)));
    }
    for(const m of monsters)monsterPoints.set(m.id,monsterTracks.get(m.id)?.at(t)||m);
    // 그림 비율을 유지하며 화면을 가득 채우고 내 위치를 따라갑니다.
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const map=currentMap();
    const zone=placing&&myMapId===PLAZA_ID?DEPARTMENT_ZONE:null;
    const scale=zone?Math.min(rect.width/(zone.rx*2+300),rect.height/(zone.ry*2+300)):(placing||overview)?Math.min(rect.width/map.width,rect.height/map.height):Math.max(rect.width/1200,rect.height/760)||1;
    const me=points.get(selfId),cw=rect.width/scale,ch=rect.height/scale;
    const x=cw>=map.width?(map.width-cw)/2:Math.max(0,Math.min(map.width-cw,(zone?.x??me?.x??map.width/2)-cw/2));
    const y=ch>=map.height?(map.height-ch)/2:Math.max(0,Math.min(map.height-ch,(zone?.y??me?.y??map.height/2)-ch/2));
    view={x,y,scale};
    interiorBoard.update({map,planet:planets.find(p=>p.id===map.planetId),view,rect,visible:!!selfId&&document.body.classList.contains('joined')});
    canvas.dataset.viewX=x;canvas.dataset.viewY=y;canvas.dataset.viewScale=scale;
    if(me){canvas.dataset.selfRenderX=me.x;canvas.dataset.selfRenderY=me.y;}
    ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#e5e5f5';ctx.fillRect(0,0,w,h);
    ctx.setTransform(dpr*scale,0,0,dpr*scale,-x*dpr*scale,-y*dpr*scale);
    if(myMapId===PLAZA_ID)drawMap(map,t);else if(myMapId===STREET_ID)drawStreet(map);else if(map.theme==='star-origin'){drawStarOrigin(ctx,map,t);for(const o of map.objects)drawGate(o);}else if(myMapId===GARDEN_ID||myMapId===VALLEY_ID||['sun-paradise','moon-paradise','star-paradise'].includes(map.theme)){
      if(myMapId===GARDEN_ID)drawCrossroads(ctx,map);else if(myMapId===VALLEY_ID)drawValley(ctx,map,t);else if(map.theme==='star-paradise')drawStarParadise(ctx,map);else drawParadise(ctx,map);
      for(const o of map.objects){if(o.kind==='gate')drawGate(o);else if(o.kind==='evolution'||o.kind==='growth')drawValleyAltar(ctx,o,t);}
    }else drawInterior(map,t);
    const visibleMonsters=monsters.filter(m=>m.alive&&m.mapId===myMapId);
    canvas.dataset.monsterCount=String(visibleMonsters.length);
    const firstMonster=visibleMonsters[0],firstMonsterPoint=firstMonster&&(monsterPoints.get(firstMonster.id)||firstMonster);
    canvas.dataset.monsterRenderX=firstMonsterPoint?.x??'';
    canvas.dataset.monsterRenderY=firstMonsterPoint?.y??'';
    for(const m of visibleMonsters){
      const pos=monsterPoints.get(m.id)||m,type=monsterType(m.typeId);if(!type)continue;
      const attack=monsterAttacks.get(m.id);
      if(attack&&t-attack.startedAt>attack.durationMs)monsterAttacks.delete(m.id);
      const visualRadius=m.radius*monsterVisualScale(m.mapId,m.typeId);
      const body={...type,...m,...pos,radius:visualRadius},activeAttack=monsterAttacks.get(m.id);
      if(!drawCelestialMonster(ctx,body,t,activeAttack)&&!drawSunMonster(ctx,body,t,activeAttack)&&!drawLv2Monster(ctx,body,t,activeAttack)&&!drawWaterMonster(ctx,body,t,activeAttack))drawMonster(ctx,body,t);
      const isWater=['star-crab','water-star'].includes(type.shape);
      // 별전갈의 높이 솟은 꼬리를 체력바가 가리지 않도록 원화 높이를 반영합니다.
      const celestial=CELESTIAL_MONSTER_ART[type.shape];
      const barScale=celestial?celestial.scale*2:type.shape==='star-scorpion'?2.15:type.shape==='warm-star'?1.9:type.shape==='grown-warm-star'?1.3:isWater?1.8:1;
      const barWidth=64,barY=pos.y-visualRadius*barScale-18;
      ctx.save();ctx.fillStyle='#302843';ctx.beginPath();ctx.roundRect(pos.x-barWidth/2,barY,barWidth,9,4);ctx.fill();
      ctx.fillStyle='#f2a3b7';ctx.fillRect(pos.x-barWidth/2+1,barY+1,(barWidth-2)*Math.max(0,Math.min(1,m.hp/m.maxHp)),7);
      ctx.fillStyle='#fff';ctx.font='11px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.strokeStyle='#554762';ctx.lineWidth=3;ctx.strokeText(m.hp+' / '+m.maxHp,pos.x,barY-4);ctx.fillText(m.hp+' / '+m.maxHp,pos.x,barY-4);ctx.restore();
      if(m===firstMonster){canvas.dataset.monsterVisualScale=String(monsterVisualScale(m.mapId,m.typeId));canvas.dataset.monsterHp=String(m.hp);canvas.dataset.monsterMaxHp=String(m.maxHp);}
      ctx.save();ctx.font='14px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#e5ddff';
      const nameY=pos.y+visualRadius*(celestial?celestial.scale:type.shape==='grown-warm-star'?.55:isWater?1.65:1)+13;
      ctx.strokeStyle='#554762';ctx.lineWidth=3;ctx.lineJoin='round';ctx.strokeText(type.name,pos.x,nameY);
      ctx.fillText(type.name,pos.x,nameY);ctx.restore();
    }
    const visibleDrops=myEnergyDrops();canvas.dataset.energyDropCount=String(visibleDrops.length);
    for(const drop of visibleDrops){
      const amount=drop.shares.find(s=>s.playerId===selfId).amount;
      const bob=reducedMotion.matches?0:Math.sin(t/350+drop.x)*3;
      const icon=loadedAvatarSprite('/assets/currencies/cosmic-energy.svg');
      ctx.save();ctx.shadowColor='#62cfff';ctx.shadowBlur=15;ctx.fillStyle='#8adfff35';
      ctx.beginPath();ctx.ellipse(drop.x,drop.y+14,22,9,0,0,Math.PI*2);ctx.fill();
      if(icon)ctx.drawImage(icon,drop.x-18,drop.y-22+bob,36,36);
      ctx.shadowBlur=0;ctx.textAlign='center';ctx.font='14px "Jua","Malgun Gothic",sans-serif';ctx.fillStyle='#e7faff';ctx.strokeStyle='#294776';ctx.lineWidth=3;
      ctx.strokeText('우주에너지 '+amount,drop.x,drop.y+35);ctx.fillText('우주에너지 '+amount,drop.x,drop.y+35);ctx.restore();
    }
    const visiblePlayers=players.filter(p=>!p.away&&(p.mapId||PLAZA_ID)===myMapId);
    if(myMapId===PLAZA_ID){
      const layers=[...visiblePlayers.map(p=>({y:points.get(p.id)?.y??p.y,draw:()=>drawAvatar(p,t)})),
        ...map.objects.filter(o=>o.kind==='pillar').map(o=>({y:o.y,draw:()=>drawPlazaPillar(ctx,o)}))];
      for(const layer of layers.sort((a,b)=>a.y-b.y))layer.draw();
    }else for(const p of visiblePlayers.sort((a,b)=>a.y-b.y))drawAvatar(p,t);
    sagittariusEffects=sagittariusEffects.filter(e=>e.until>t&&e.mapId===myMapId);
    sagittariusCasts=sagittariusCasts.filter(e=>e.until>t&&e.mapId===myMapId);
    for(const cast of sagittariusCasts){
      const mix=1-Math.exp(-Math.min(100,t-(cast.frameAt||t))/70);cast.frameAt=t;
      cast.displayX+=(cast.x-cast.displayX)*mix;cast.displayY+=(cast.y-cast.displayY)*mix;
      drawSagittarius(ctx,{...cast,x:cast.displayX,y:cast.displayY},0,t,reducedMotion.matches);
    }
    for(const effect of sagittariusEffects)if(t>=effect.startsAt)drawSagittarius(ctx,effect,1-(effect.until-t)/effect.durationMs,t,reducedMotion.matches);
    canvas.dataset.sagittariusCasts=String(sagittariusCasts.length);
    hits=hits.filter(hit=>hit.until>t&&hit.mapId===myMapId);
    canvas.dataset.attackCount=String(hits.length);
    for(const hit of hits){
      if(hit.kind==='damage')continue;
      if(hit.kind==='monster'&&['star-crab','water-star'].includes(monsterType(monsters.find(m=>m.id===hit.monsterId)?.typeId)?.shape))continue;
      const effect=hit.kind==='skill'&&skillEffectById(hit.effectId);
      const progress=1-(hit.until-t)/(CORVUS_VFX[hit.vfxId]?.durationMs??effect?.durationMs??ATTACK_VISUAL.durationMs);
      if(drawCorvus(ctx,hit,progress,reducedMotion.matches))continue;
      if(effect){
        ctx.save();ctx.translate(hit.x+hit.dx*(hit.originOffset||0),hit.y+hit.dy*(hit.originOffset||0));ctx.rotate(Math.atan2(hit.dy,hit.dx));
        drawSkillEffect(ctx,effect,progress,{reducedMotion:reducedMotion.matches,quality:hits.length>18?'low':'full'});ctx.restore();continue;
      }
      const reach=hit.reach??ATTACK_VISUAL.reach;
      const hx=hit.x+hit.dx*reach,hy=hit.y+hit.dy*reach;
      ctx.save();ctx.translate(hx,hy);ctx.rotate(Math.atan2(hit.dy,hit.dx));ctx.globalAlpha=Math.max(0,1-progress);
      const monsterHit=hit.kind==='monster';
      const playerAttack=!monsterHit&&hit.kind!=='skill';
      const radius=playerAttack?(hit.radius??ATTACK_VISUAL.hitRadius):12+progress*22;ctx.strokeStyle=hit.kind==='skill'?'#a3caff':monsterHit?'#ff8a9d':'#f1ad69';ctx.lineWidth=3;
      ctx.beginPath();ctx.ellipse(0,0,playerAttack?radius:radius*.7,radius,0,0,Math.PI*2);ctx.stroke();
      star(0,0,19*(1-progress)+6,hit.kind==='skill'?'#d8eaff':monsterHit?'#ffc078':'#fff3be');
      ctx.strokeStyle=monsterHit?'#fff0dc':'#fffdf0';ctx.lineWidth=4;
      for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.moveTo(Math.cos(a)*radius,Math.sin(a)*radius);ctx.lineTo(Math.cos(a)*(radius+9),Math.sin(a)*(radius+9));ctx.stroke();}ctx.restore();
    }
    projectiles.draw(ctx,t,reducedMotion.matches);
    damageNumbers.draw(ctx,t,reducedMotion.matches);
    canvas.dataset.damageNumberCount=String(damageNumbers.size);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {
    setRoom(room,id){
      const nextMap=room?.players.find(p=>p.id===id)?.mapId||PLAZA_ID;
      if(nextMap!==myMapId||id!==selfId){projectiles.clear();damageNumbers.clear();points.clear();tracks.clear();monsterTracks.clear();monsterPoints.clear();monsterAttacks.clear();bubbles.clear();hits=[];sagittariusCasts=[];sagittariusEffects=[];}
      players=(room?.players||[]).map(p=>({...p}));selfId=id;
      if(players.some(p=>p.avatar?.constellationId==='corvus'))preloadCorvus(['attack',...new Set(players.filter(p=>p.avatar?.constellationId==='corvus').map(p=>'skill-lv'+Math.max(2,Math.min(4,p.avatar.level))))]);
      planets=room?.planets||[];proposals=room?.proposals||[];
      starCards=room?.starCards||[];
      energyDrops=room?.energyDrops||[];
      myMapId=players.find(p=>p.id===id)?.mapId||PLAZA_ID;
      setMonsters(room?.monsters||[]);
      for(const key of points.keys())if(!players.some(p=>p.id===key))points.delete(key);
      for(const key of tracks.keys())if(!players.some(p=>p.id===key))tracks.delete(key);
      const now=performance.now();for(const p of players)recordPosition(p,now);
      for(const key of bubbles.keys())if(!players.some(p=>p.id===key))bubbles.delete(key);
    },
    projectileEnd(data){if(data.mapId===myMapId)projectiles.end(data);},
    positions(data){if(data.projectiles)projectiles.sync(data.projectiles.filter(p=>p.mapId===myMapId));const now=performance.now();for(const [id,x,y,facingX] of data.positions){const p=players.find(p=>p.id===id);if(p){p.x=x;p.y=y;if(facingX===-1||facingX===1)p.facingX=facingX;recordPosition(p,now);}}},
    monsters(data){setMonsters(data.monsters||[]);},
    energyDrops(data){energyDrops=data.drops||[];},
    sagittariusState(data){
      const previous=new Map(sagittariusCasts.map(c=>[c.id,c])),now=performance.now();
      sagittariusCasts=(data.casts||[]).filter(e=>e.mapId===myMapId).map(e=>{
        const old=previous.get(e.id);return {...e,displayX:old?.displayX??e.x,displayY:old?.displayY??e.y,frameAt:old?.frameAt??now,until:now+e.remainingMs};
      });
    },
    sagittariusEffect(data){
      if(data.mapId!==myMapId)return;
      const startsAt=performance.now()+(data.delayMs||0);
      if(data.projectile)projectiles.add(data);else sagittariusEffects.push({...data,startsAt,until:startsAt+data.durationMs});
      if(sagittariusEffects.length>80)sagittariusEffects.shift();
      canvas.dataset.lastSagittariusEffect=data.kind;canvas.dataset.lastSagittariusSlot=String(data.slot);
    },
    hit(data){
      if(data.mapId!==myMapId||!players.some(p=>p.id===data.playerId))return;
      const effect=data.kind==='skill'&&skillEffectById(data.effectId);
      if(data.projectiles)data.projectiles.forEach(projectiles.add);
      if(!data.projectiles&&data.kind!=='sagittarius-arrow')hits.push({...data,until:performance.now()+(CORVUS_VFX[data.vfxId]?.durationMs??effect?.durationMs??ATTACK_VISUAL.durationMs)});if(hits.length>60)hits.shift();
      if(data.vfxId)canvas.dataset.lastCorvusVfx=data.vfxId;
      canvas.dataset.lastAttackReach=String(data.reach??ATTACK_VISUAL.reach);canvas.dataset.lastSkillOrigin=String(data.originOffset||0);canvas.dataset.lastAttackPlayer=data.playerId;canvas.dataset.lastAttackDx=String(data.dx);canvas.dataset.lastAttackDy=String(data.dy);
      if(data.kind!=='skill')canvas.dataset.lastAttackRadius=String(data.radius??ATTACK_VISUAL.hitRadius);
      if(data.kind==='skill'){canvas.dataset.lastSkillDx=String(data.dx);canvas.dataset.lastSkillDy=String(data.dy);canvas.dataset.lastSkillEffect=effect?.id||'';}
    },
    monsterHit(data){
      if(data.mapId!==myMapId||!monsters.some(monster=>monster.id===data.monsterId))return;
      // 범위 공격이 여러 명에게 맞아도 같은 물보라 모션은 한 번만 시작합니다.
      const previous=monsterAttacks.get(data.monsterId),startedAt=performance.now();
      if(!previous||startedAt-previous.startedAt>80)monsterAttacks.set(data.monsterId,{...data,startedAt,durationMs:600});
      canvas.dataset.lastMonsterEffect=monsterType(monsters.find(m=>m.id===data.monsterId)?.typeId)?.shape||'';
      hits.push({...data,kind:'monster',until:performance.now()+ATTACK_VISUAL.durationMs});if(hits.length>60)hits.shift();
      canvas.dataset.lastMonsterDamage=String(data.damage);
      canvas.dataset.lastMonsterTarget=String(data.targetId);
    },
    damageNumbers(data){
      for(const hit of data.hits||[]){
        if(hit.mapId!==myMapId)continue;
        const monster=hit.targetKind==='monster'&&monsters.find(m=>m.id===hit.targetId);
        const player=hit.targetKind==='player'&&players.find(p=>p.id===hit.targetId);
        let head=player?avatarSizeOf(player)/2+24:42;
        if(monster){const type=monsterType(monster.typeId),celestial=CELESTIAL_MONSTER_ART[type?.shape];const scale=celestial?celestial.scale*2:type?.shape==='star-scorpion'?2.15:type?.shape==='warm-star'?1.9:type?.shape==='grown-warm-star'?1.3:['star-crab','water-star'].includes(type?.shape)?1.8:1;head=monster.radius*monsterVisualScale(monster.mapId,monster.typeId)*scale+30;}
        damageNumbers.add({...hit,y:Math.max(1,hit.y-head)});
        canvas.dataset.lastDamageNumber=String(hit.damage);canvas.dataset.lastDamageTargetKind=hit.targetKind;
      }
    },
    playerHit(data){
      if(data.mapId!==myMapId||!players.some(p=>p.id===data.targetId))return;
      hits.push({...data,kind:'damage',until:performance.now()+ATTACK_VISUAL.durationMs});if(hits.length>60)hits.shift();
      canvas.dataset.lastPlayerDamage=String(data.damage);canvas.dataset.lastPlayerTarget=data.targetId;
    },
    say(playerId,text,ms){
      if(!playerId)return;const str=String(text);
      const limited=Array.from(str).slice(0,CHAT.maxLength??100).join('');
      const duration=ms==null
        ?Math.min(CHAT.bubbleMaxMs??12000,(CHAT.bubbleBaseMs??3000)+Array.from(str).length*(CHAT.bubblePerCharMs??90))
        :ms;
      bubbles.set(playerId,{text:limited,until:Date.now()+duration});
    },
    nearby(){
      const me=players.find(p=>p.id===selfId);if(!me)return null;
      const drop=myEnergyDrops().filter(d=>Math.hypot(me.x-d.x,me.y-d.y)<=ENERGY_DROPS.pickupDistance)
        .sort((a,b)=>Math.hypot(me.x-a.x,me.y-a.y)-Math.hypot(me.x-b.x,me.y-b.y))[0];
      if(drop)return {...drop,kind:'energy-drop',name:'우주에너지 '+drop.shares.find(s=>s.playerId===selfId).amount+' 줍기'};
      if(myMapId===PLAZA_ID){
        const market=MAP.objects.find(o=>o.kind==='market');
        if(market&&inMarket(me))return {...market,x:me.x,y:me.y,radius:18,name:me.role==='teacher'?'거래 내역 조회':'거래걸기'};
        const cards=starCards.filter(c=>c.expiresAt===null||c.expiresAt>Date.now()).map(c=>({...c,kind:'star-card',name:'별 카드 효과 보기',radius:28}));
        const candidates=[...cards,...planets.map(o=>({...o,kind:'planet'})),...MAP.objects.filter(o=>o.kind==='life-star'||o.kind==='gate'||o.kind==='pillar'||o.kind==='black-hole'||o.kind==='andromeda')];
        let best=null,bestDist=Infinity;
        for(const o of candidates){
          const d=Math.hypot(me.x-o.x,me.y-o.y);
          if(d<=(o.radius||PLANET.radius)+NEAR&&d<bestDist){best=o;bestDist=d;}
        }
        if(!best)return null;
        return {...best};
      }
      if(!planetIdOfMap(myMapId)){
        const candidates=currentMap().objects.filter(o=>['gate','shop','energy-shop','arcade','crafting','evolution','growth','black-star'].includes(o.kind));
        let best=null,bestDist=Infinity;
        for(const o of candidates){
          const d=Math.hypot(me.x-o.x,me.y-o.y);
          if(d<=(o.radius||PLANET.radius)+NEAR&&d<bestDist){best=o;bestDist=d;}
        }
        if(!best)return null;
        return {...best};
      }
      const door=mapOf(myMapId,planets).objects.find(o=>o.kind==='door');
      if(door&&Math.hypot(me.x-door.x,me.y-door.y)<=door.radius+NEAR)return {...door};
      const document=mapOf(myMapId,planets).objects.find(o=>o.kind==='report-board');
      if(document&&Math.hypot(me.x-document.x,me.y-document.y)<=document.radius+NEAR)return {...document,id:planetIdOfMap(myMapId)};
      const mailbox=mapOf(myMapId,planets).objects.find(o=>o.kind==='mailbox');
      if(mailbox&&Math.hypot(me.x-mailbox.x,me.y-mailbox.y)<=mailbox.radius+NEAR)return {...mailbox,id:planetIdOfMap(myMapId)};
      const board=mapOf(myMapId,planets).objects.find(o=>o.kind==='board');
      if(board&&(me.role==='teacher'||me.departmentId===planetIdOfMap(myMapId))&&Math.hypot(me.x-board.x,me.y-board.y)<=board.radius+NEAR)
        return {...board,id:planetIdOfMap(myMapId),name:'규칙 수정하기'};
      const control=mapOf(myMapId,planets).objects.find(o=>o.kind==='interior-decor-machine');
      if(control&&(me.role==='teacher'||me.departmentId===planetIdOfMap(myMapId))&&Math.hypot(me.x-control.x,me.y-control.y)<=control.radius+NEAR)return {...control};
      const warningRock=mapOf(myMapId,planets).objects.find(o=>o.kind==='warning-rock');
      if(warningRock&&Math.hypot(me.x-warningRock.x,me.y-warningRock.y)<=warningRock.radius+NEAR)
        return {...warningRock,id:planetIdOfMap(myMapId),name:'경고 제어돌'};
      return null;
    },
    currentMapId(){return myMapId;},
    // Canvas에서 쓰는 카메라·배율과 동일하게 변환해야 물체 옆 안내가 이동 중에도 붙어 있습니다.
    screenPoint(point){const rect=canvas.getBoundingClientRect(),pos=point.kind==='monster'?(monsterPoints.get(point.id)||point):point;return {x:rect.left+(pos.x-view.x)*view.scale,y:rect.top+(pos.y-view.y)*view.scale,scale:view.scale};},
    setOverview(value){overview=!!value;},
    setPlacement(point){placement=point;},
    setPlacing(value){placing=Boolean(value);},
    placementOk,
    planetAt(point){
      return planets.find(o=>Math.hypot(point.x-o.x,point.y-o.y)<=(o.radius||PLANET.radius))||null;
    },
    canvasPoint(e){
      // 좁은 화면(휴대폰)에서는 캔버스가 object-fit:contain으로 줄어들어 위아래에 빈 띠가 생깁니다.
      // 그 여백을 빼고 실제 그림이 그려진 영역 기준으로 계산해야 누른 자리와 행성 위치가 맞습니다.
      const rect=canvas.getBoundingClientRect();
      return {x:Math.round((e.clientX-rect.left)/view.scale+view.x),y:Math.round((e.clientY-rect.top)/view.scale+view.y)};
    }
  };
}
// 아바타 카드(.card-art)의 작은 일러스트 캔버스에 그 플레이어의 소행성만 크게 그립니다(이름표 없음).
// player.deptIcon을 넘기면 오른쪽 위에 소속 행성 아이콘을 함께 그립니다(호출하는 쪽에서 미리 조회해 붙여 줍니다).
export function renderPortrait(canvas,player,effects){
  portraitPlayers.set(canvas,player);
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#2c2350');g.addColorStop(1,'#4a3a7a');
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  for(let i=0;i<24;i++){const sx=(i*53+17)%w,sy=(i*37+11)%h,r=i%4===0?1.6:1;
    ctx.fillStyle='#ffffffb0';ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();}
  const cx=w/2,cy=h/2+8,list=(effects||player?.effects||[]).slice(0,3);
  if(list.some(e=>e.style==='glow')){
    const glow=ctx.createRadialGradient(cx,cy,6,cx,cy,60);glow.addColorStop(0,'#fff2b880');glow.addColorStop(1,'#fff2b800');
    ctx.fillStyle=glow;ctx.fillRect(cx-60,cy-60,120,120);
  }
  ctx.save();ctx.translate(cx,cy);
  const constellation=player?.avatar?.level>=2?constellationOf(player.avatar.constellationId,appearanceLevelOf(player)):null;
  if(player?.role==='teacher'){
    celestialAura(ctx,'#e9c77b',76,0);
    const sprite=loadedAvatarSprite(TEACHER_SPRITE,()=>{if(portraitPlayers.get(canvas)===player)renderPortrait(canvas,player,effects);});
    if(sprite)ctx.drawImage(sprite,-72,-78,144,144);
    else drawStar(ctx,0,0,42,'#e9c77b');
  }else if(player?.avatar?.blackStar){
    drawStar(ctx,0,0,45,'#050509');ctx.strokeStyle='#b18cff';ctx.lineWidth=4;ctx.stroke();
    ctx.fillStyle='#fff';ctx.font='38px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✦',0,2);ctx.textBaseline='alphabetic';
  }else if(constellation){
    const sprite=loadedAvatarSprite(constellation.sprite,()=>{if(portraitPlayers.get(canvas)===player)renderPortrait(canvas,player,effects);});
    if(constellation.celestial)celestialAura(ctx,constellation.color,76,0);
    if(sprite)ctx.drawImage(sprite,-59,-59,118,118);
    else{drawStar(ctx,0,0,43+(Math.min(player.avatar.level,6)-2)*2,constellation.color);
      ctx.strokeStyle='#ffffffa0';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='#fff';ctx.font='38px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(constellation.icon,0,2);ctx.textBaseline='alphabetic';}
  }else{
  ctx.beginPath();for(let i=0;i<9;i++){const a=i*2*Math.PI/9,r=34+[2,0,4,-2,2,0,2,-2,0][i];
    i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}
  ctx.closePath();ctx.fillStyle='#c9c1e6';ctx.fill();ctx.strokeStyle='#aaa0ce';ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle='#afa4d0';ctx.beginPath();ctx.arc(-13,-15,8,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(19,17,6,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#524969';ctx.beginPath();ctx.arc(-8,2,3.2,0,Math.PI*2);ctx.arc(8,2,3.2,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#66577e';ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(0,10,6,.15,Math.PI-.15);ctx.stroke();
  }
  if(list.some(e=>e.style==='sparkle')){
    for(let i=0;i<3;i++){
      const phase=Date.now()/260+i*2.1,r=46+i*5;
      const sx=Math.cos(phase)*r,sy=Math.sin(phase*1.4)*r*.6-24;
      ctx.save();ctx.globalAlpha=(Math.sin(phase*2)+1)/2*.85+.15;drawStar(ctx,sx,sy,6,'#ffe59b');ctx.restore();
    }
  }
  ctx.restore();
  if(list.length){ctx.font='16px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#f2ecff';ctx.fillText(list.map(e=>e.icon).join(' '),cx,cy-52);}
  if(player?.deptIcon){ctx.save();ctx.font='22px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='right';ctx.textBaseline='top';ctx.fillText(player.deptIcon,w-10,10);ctx.restore();}
}
