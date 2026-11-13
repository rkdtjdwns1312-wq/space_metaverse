import {mapImage,mapImageReady} from './map-image.js';
// Build silhouettes once; every subsequent frame only transforms a bitmap.
const shadowImages=new Map(),silhouettes=new WeakMap();
let castStamp;
function shadowImage(file){if(!shadowImages.has(file))shadowImages.set(file,mapImage(file));return shadowImages.get(file);}
export function spriteShadowProfile(image,box,flipX=false){
  return {x:box.x+box.width/2,y:box.y+box.height,rx:box.width*.48,ry:box.height*.12,alpha:.23,sprite:{image,box,flipX}};
}
function spriteSilhouette(image){
  if(silhouettes.has(image))return silhouettes.get(image);
  const scale=Math.min(1,512/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(image.naturalWidth*scale);canvas.height=Math.ceil(image.naturalHeight*scale);
  const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0,canvas.width,canvas.height);
  const data=c.getImageData(0,0,canvas.width,canvas.height);let bottom=0;
  // Strip faint glows and baked shadows, retaining the solid object silhouette.
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
    const i=(y*canvas.width+x)*4,a=data.data[i+3];
    data.data[i]=67;data.data[i+1]=54;data.data[i+2]=84;
    data.data[i+3]=a<96?0:Math.round((a-96)*255/159);
    if(a>=160)bottom=y+1;
  }
  c.putImageData(data,0,0);
  // A tiny feather is baked into the cache, never a live canvas filter.
  c.globalCompositeOperation='copy';c.filter='blur(1.5px)';c.drawImage(canvas,0,0);
  c.filter='none';c.globalCompositeOperation='source-over';
  const result={canvas,bottom};silhouettes.set(image,result);return result;
}
function drawSpriteShadow(ctx,profile){
  const {image,box,flipX}=profile.sprite;if(!mapImageReady(image))return false;
  const {canvas,bottom}=spriteSilhouette(image),sy=box.height/canvas.height;
  if(!bottom)return false;
  ctx.save();ctx.globalAlpha*=profile.alpha;
  // Both visible feet stay attached. The upper silhouette stretches back/right.
  ctx.translate(box.x+box.width/2,box.y+bottom*sy);ctx.transform(flipX?-1:1,0,-.38,.28,0,0);
  ctx.drawImage(canvas,0,0,canvas.width,bottom,-box.width/2,-bottom*sy,box.width,bottom*sy);ctx.restore();return true;
}
let stamp;
const floorPaths=new WeakMap();
const profiles={
  'cozy-pet':[115.5,25.3,32], 'cozy-room':[124.3,27.5,32],
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
    return {x:o.x,y:o.y+painted.foot-5,rx:width*.48,ry:Math.max(10,width*.105),alpha:.24,art:painted};
  }
  if(profiles[o.kind]){const [rx,ry,dy]=profiles[o.kind],scale=o.kind==='hall-of-fame'?Math.min(1,Math.max(.65,(o.radius||48)/48)):1;return {x:o.x+3,y:o.y+dy*scale,rx:rx*scale,ry:ry*scale,alpha:.24,...(o.kind==='cozy-pet'?{cozy:{file:'baby-star-nursery.webp',width:242,height:220}}:o.kind==='cozy-room'?{cozy:{file:'star-interior-shop.webp',width:264,height:270.6}}:{})};}
  if(o.kind==='lamp')return {x:o.x+2,y:o.y+o.radius*.6,rx:17,ry:7,alpha:.24};
  // Floating worlds/stars use a broad, lighter patch, without a dark contact core.
  if(o.kind==='planet')return {x:o.x+3,y:o.y+o.radius*1.28,rx:o.radius*1.65,ry:o.radius*.36,alpha:.15,floating:true};
  if(o.kind==='star')return {x:o.x+3,y:o.y+o.radius*.85,rx:o.radius*.85,ry:o.radius*.28,alpha:.12,floating:true};
  if(o.kind==='truth-creator-statue')return {x:o.x+3,y:o.y+26,rx:72,ry:17,alpha:.14};
  if(o.kind==='evolution'||o.kind==='growth')return {x:o.x+3,y:o.y+o.radius*.45-4,rx:o.radius*1.34,ry:o.radius*.28,alpha:.24};
  // Gates, pillars, fountains, light effects and backdrop art already own their
  // grounding. Never guess an oval for unknown kinds (or objects in the void).
  return null;
}
export function drawPropShadow(ctx,profile){
  if(!profile||![profile.x,profile.y,profile.rx,profile.ry,profile.alpha].every(Number.isFinite)||profile.rx<=0||profile.ry<=0)return false;
  if(profile.sprite)return drawSpriteShadow(ctx,profile);
  if(profile.art?.file){
    const image=shadowImage('/assets/maps/'+profile.art.file);if(!mapImageReady(image))return false;
    const spec=profile.art,scale=Math.min(spec.width/image.naturalWidth,spec.height/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
    return drawSpriteShadow(ctx,spriteShadowProfile(image,{x:profile.x-w/2,y:profile.y+5-h,width:w,height:h},!!spec.flipX));
  }
  if(profile.cozy){
    const {file,width,height}=profile.cozy,image=shadowImage('/assets/cozy/'+file);if(!mapImageReady(image))return false;
    const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
    return drawSpriteShadow(ctx,spriteShadowProfile(image,{x:profile.x-3-w/2,y:profile.y+6-h,width:w,height:h},true));
  }
  if(!profile.floating){
    if(!castStamp){
      castStamp=document.createElement('canvas');castStamp.width=256;castStamp.height=128;
      const c=castStamp.getContext('2d'),g=c.createLinearGradient(0,0,0,128);
      g.addColorStop(0,'rgba(67,54,84,0)');g.addColorStop(.35,'rgba(67,54,84,.5)');g.addColorStop(1,'rgba(67,54,84,.85)');
      c.fillStyle=g;c.beginPath();c.moveTo(0,124);c.bezierCurveTo(24,96,78,18,112,8);c.quadraticCurveTo(175,-8,240,12);c.lineTo(256,124);c.quadraticCurveTo(128,132,0,124);c.fill();
    }
    ctx.save();ctx.globalAlpha*=profile.alpha;
    ctx.drawImage(castStamp,profile.x-profile.rx,profile.y-profile.ry*3,profile.rx*2,profile.ry*3+2);ctx.restore();return true;
  }
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
