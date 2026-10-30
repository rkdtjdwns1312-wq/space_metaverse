import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';
import {drawDarkStarSatellite} from './dark-star-art.js';
const orb=mapImage('/assets/monsters/dark-star-orb.webp'),road=mapImage('/assets/monsters/dark-star-rainbow.webp'),cardArt=mapImage('/assets/cards/dark-star-card-back.webp');
const names={red:'빨강',purple:'보라',indigo:'남색',green:'초록',blue:'파랑'};
export const preloadDarkStarSkillsArt=()=>decodeMapImages([orb,road,cardArt]);
function label(ctx,text,x,y,size=16){ctx.save();ctx.font=size+'px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#211629';ctx.fillStyle='#fff3d7';ctx.strokeText(text,x,y);ctx.fillText(text,x,y);ctx.restore();}
export function drawDarkStarGround(ctx,e,now){
 for(const p of e.paths||[])if(now<p.endsAt){
  const length=Math.hypot(p.x2-p.x1,p.y2-p.y1);ctx.save();ctx.translate((p.x1+p.x2)/2,(p.y1+p.y2)/2);ctx.rotate(Math.atan2(p.y2-p.y1,p.x2-p.x1));
  if(mapImageReady(road))ctx.drawImage(road,-length/2,-p.width/2,length,p.width);
  ctx.restore();
 }
 if(e.aim){const a=e.aim;ctx.save();ctx.strokeStyle='#c5a9ef99';ctx.lineWidth=3;ctx.setLineDash([10,9]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.x+a.dx*700,a.y+a.dy*700);ctx.stroke();ctx.restore();}
 const a=e.absorption;
 if(a&&now<a.endsAt){
  ctx.save();ctx.fillStyle='#d9465538';ctx.strokeStyle='#ffc09b';ctx.lineWidth=5;ctx.beginPath();ctx.arc(a.x,a.y,a.radius,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#fff2d9';ctx.lineWidth=8;ctx.beginPath();ctx.arc(a.x,a.y,a.radius,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,Math.min(1,(now-a.startsAt)/(a.endsAt-a.startsAt))));ctx.stroke();
  ctx.restore();
 }
 for(const s of e.satellites||[]){ctx.save();ctx.fillStyle='#b55fff18';ctx.strokeStyle='#bca3e466';ctx.lineWidth=2;ctx.beginPath();ctx.arc(s.x,s.y,s.radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
}
export function darkStarObjectLayers(ctx,e,now,quiet){
 return [
 ...(e.cards||[]).filter(c=>now<c.endsAt).map(c=>({y:c.y+22,draw:()=>{
  ctx.save();const bob=quiet?0:Math.sin(now/500+c.x)*2;ctx.translate(c.x,c.y+bob);ctx.fillStyle='#ddd6df';ctx.strokeStyle='#c4b89e';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(-16.5,-22.5,33,45,3);ctx.fill();ctx.stroke();
  if(mapImageReady(cardArt))ctx.drawImage(cardArt,-15,-21,30,42);ctx.restore();

 }})),
 ...(e.satellites||[]).map(s=>({y:s.y+s.radius,draw:()=>drawDarkStarSatellite(ctx,s.color,s.x,s.y,s.radius*2)})),
 ...(e.projectiles||[]).filter(s=>now<s.endsAt).map(s=>({y:s.y,draw:()=>{if(mapImageReady(orb))ctx.drawImage(orb,s.x-s.radius,s.y-s.radius,s.radius*2,s.radius*2);}}))
 ];
}
export function drawDarkStarPuzzleHint(ctx,e,x,y,now){
 for(const c of e.cards||[])if(c.color&&now<c.revealUntil&&now<c.endsAt){drawDarkStarSatellite(ctx,c.color,c.x,c.y-52,38);label(ctx,names[c.color]+' 위성',c.x,c.y-79,14);}
 const a=e.absorption;if(a&&now<a.endsAt){label(ctx,'범위 밖으로! · '+Math.max(0,(a.endsAt-now)/1000).toFixed(1)+'초',a.x,a.y+a.radius*.4,24);return;}if(e.puzzleEndsAt>now)label(ctx,'위성 확인 → 다른 색 카드 공격 · '+Math.ceil((e.puzzleEndsAt-now)/1000)+'초',x,y,18);}
