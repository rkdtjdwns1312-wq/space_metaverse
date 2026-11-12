// A small shared alpha stamp gives static props soft contact without per-frame
// blur/gradient allocation. Profiles follow visible feet, not collision radii.
let stamp;
const floorPaths=new WeakMap();
const profiles={
  'cozy-pet':[105,23,32], 'cozy-room':[113,25,32],
  'duel-arcade':[94,20,48], 'hall-of-fame':[76,17,25],
  'mission-board':[108,22,91], 'starlight-archive':[101,22,30],
  exploration:[43,12,6],
  board:[295,18,174], mailbox:[54,13,61], 'report-board':[60,14,59], 'warning-rock':[57,14,54],
  'interior-decor-machine':[75,17,62],
  'dark-star-statue':[48,12,25], 'star-record-statue':[76,17,19],
  'goddess-statue':[73,16,18]
};
export function propShadowProfile(o,painted){
  if(painted){
    const width=painted.width;
    return {x:o.x+3,y:o.y+painted.foot-5,rx:width*.48,ry:Math.max(10,width*.105),alpha:.24};
  }
  if(profiles[o.kind]){const [rx,ry,dy]=profiles[o.kind],scale=o.kind==='hall-of-fame'?Math.min(1,Math.max(.65,(o.radius||48)/48)):1;return {x:o.x+3,y:o.y+dy*scale,rx:rx*scale,ry:ry*scale,alpha:.24};}
  if(o.kind==='lamp')return {x:o.x+2,y:o.y+o.radius*.6,rx:17,ry:7,alpha:.24};
  // Floating worlds/stars use a broad, lighter patch, without a dark contact core.
  if(o.kind==='planet')return {x:o.x+3,y:o.y+o.radius*1.28,rx:o.radius*1.65,ry:o.radius*.36,alpha:.15};
  if(o.kind==='star')return {x:o.x+3,y:o.y+o.radius*.85,rx:o.radius*.85,ry:o.radius*.28,alpha:.12};
  if(o.kind==='truth-creator-statue')return {x:o.x+3,y:o.y+26,rx:72,ry:17,alpha:.14};
  if(o.kind==='evolution'||o.kind==='growth')return {x:o.x+3,y:o.y+o.radius*.45-4,rx:o.radius*1.34,ry:o.radius*.28,alpha:.24};
  // Gates, pillars, fountains, light effects and backdrop art already own their
  // grounding. Never guess an oval for unknown kinds (or objects in the void).
  return null;
}
export function drawPropShadow(ctx,profile){
  if(!profile||![profile.x,profile.y,profile.rx,profile.ry,profile.alpha].every(Number.isFinite)||profile.rx<=0||profile.ry<=0)return false;
  if(!stamp){
    stamp=document.createElement('canvas');stamp.width=256;stamp.height=128;
    const c=stamp.getContext('2d');c.scale(1,.5);
    const g=c.createRadialGradient(128,128,0,128,128,128);
    g.addColorStop(0,'rgba(43,36,58,1)');g.addColorStop(.42,'rgba(43,36,58,.7)');g.addColorStop(.75,'rgba(43,36,58,.22)');g.addColorStop(1,'rgba(43,36,58,0)');
    c.fillStyle=g;c.fillRect(0,0,256,256);
  }
  ctx.save();ctx.globalAlpha*=profile.alpha;
  ctx.drawImage(stamp,profile.x-profile.rx,profile.y-profile.ry,profile.rx*2,profile.ry*2);ctx.restore();return true;
}
export function clipPropShadowFloor(ctx,polygons){
  let path=floorPaths.get(polygons);
  if(!path){path=new Path2D();for(const poly of Number.isFinite(polygons[0]?.x)?[polygons]:polygons){path.moveTo(poly[0].x,poly[0].y);for(const p of poly.slice(1))path.lineTo(p.x,p.y);path.closePath();}floorPaths.set(polygons,path);}
  ctx.clip(path);
}
