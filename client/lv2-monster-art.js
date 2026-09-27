// 첨부 디자인으로 만든 2×2 투명 포즈 시트를 사용합니다.
// 좌우는 같은 원화를 반전하고, 공격 연출은 서버의 실제 반격 이벤트에만 연결합니다.
export const LV2_MONSTER_ART=Object.freeze({
  'star-scorpion':Object.freeze({src:'/assets/monsters/star-scorpion-poses.png',effect:'tail',
    // 생성 원본1280px에서 발 위치를 맞춥니다. 공격의 긴 꼬리 빛이 잘리지 않도록 셀 여백도 포함합니다.
    frames:[[0,0,640,640,355,580],[640,0,640,640,355,590],[0,640,690,640,360,514],[690,640,590,640,328,515]]}),
  'chameleon-star':Object.freeze({src:'/assets/monsters/chameleon-star-poses.png',effect:'tongue',
    frames:[[0,0,640,640,340,507],[640,0,640,640,350,515],[0,640,640,640,340,477],[640,640,640,640,350,480]]})
});
const images=new Map();
function sprite(shape){
  if(!images.has(shape)&&typeof Image!=='undefined'){
    const image=new Image();image.src=LV2_MONSTER_ART[shape].src;images.set(shape,image);
  }
  return images.get(shape);
}
// 8단계 공격 리듬을 4개의 주요 포즈와 연속 이펙트로 표현합니다.
export function lv2MonsterPose(time,attack){
  if(!attack||!Number.isFinite(attack.startedAt))return {frame:0,progress:0,active:false};
  const progress=(time-attack.startedAt)/Math.max(1,attack.durationMs||600);
  if(progress<0||progress>=1)return {frame:0,progress:0,active:false};
  const phase=Math.min(7,Math.floor(progress*8));
  return {frame:[0,1,1,2,2,2,3,0][phase],progress,active:true};
}
function spark(ctx,x,y,r,color){
  ctx.fillStyle=color;ctx.beginPath();
  for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,d=i%2?r*.42:r;i?ctx.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d):ctx.moveTo(x+Math.cos(a)*d,y+Math.sin(a)*d);}
  ctx.closePath();ctx.fill();
}
function attackEffect(ctx,m,attack,progress,face){
  // 충돌·피해·사거리를 클라이언트에서 계산하지 않습니다. 이것은 시각 연출만입니다.
  if(progress<.25||progress>.87)return;
  const r=m.radius,length=Math.hypot(attack.dx,attack.dy)||1;
  const dx=Number.isFinite(attack.dx)?attack.dx/length:face,dy=Number.isFinite(attack.dy)?attack.dy/length:0;
  const extend=Math.sin((progress-.25)/.62*Math.PI),reach=Math.max(0,Math.min(attack.reach||r,r*3));
  const tip={x:m.x+dx*(reach+r*.2),y:m.y+dy*(reach+r*.2)};
  ctx.save();ctx.lineCap='round';ctx.globalAlpha=Math.min(1,extend*2);
  if(m.shape==='chameleon-star'){
    const mouth={x:m.x+face*r*1.25,y:m.y+r*.03};
    const end={x:mouth.x+(tip.x-mouth.x)*extend,y:mouth.y+(tip.y-mouth.y)*extend};
    ctx.strokeStyle='#a94374';ctx.lineWidth=r*.14;ctx.beginPath();ctx.moveTo(mouth.x,mouth.y);ctx.lineTo(end.x,end.y);ctx.stroke();
    ctx.strokeStyle='#ffbad9';ctx.lineWidth=r*.075;ctx.stroke();
    ctx.fillStyle='#f5a4c4';ctx.beginPath();ctx.ellipse(end.x,end.y,r*.105,r*.07,Math.atan2(dy,dx),0,Math.PI*2);ctx.fill();
    if(extend>.8)spark(ctx,end.x,end.y,r*.23*extend,'#fff1b4');
  }else{
    // 꼬리 자체는 포즈 시트에 있고, 그 궤적과 맞는 순간의 별빛만 덧그립니다.
    ctx.shadowColor='#c978ff';ctx.shadowBlur=r*.35;
    ctx.strokeStyle='#c787f3aa';ctx.lineWidth=r*.16;ctx.beginPath();ctx.moveTo(m.x-face*r*.5,m.y-r*.4);
    ctx.quadraticCurveTo(m.x+dx*reach*.45,m.y-r*1.7,tip.x,tip.y);ctx.stroke();
    ctx.strokeStyle='#ffdefb';ctx.lineWidth=r*.04;ctx.stroke();
    spark(ctx,tip.x,tip.y,r*(.12+.2*extend),'#fff1ff');
    for(let i=0;i<4;i++){const a=i*Math.PI/2+progress*2,d=r*(.2+progress*.3);spark(ctx,tip.x+Math.cos(a)*d,tip.y+Math.sin(a)*d,r*.05,'#e7bbff');}
  }
  ctx.restore();
}
export function drawLv2Monster(ctx,m,time=0,attack){
  if(!LV2_MONSTER_ART[m?.shape])return false;
  if(!ctx)return true;
  const image=sprite(m.shape);if(!image?.complete||!image.naturalWidth)return false;
  const r=Math.max(1,m.radius||48),size=r*3.6,face=m.facingX<0?-1:1;
  const pose=lv2MonsterPose(time,attack),phase=time*.01;
  const bob=m.moving?Math.sin(phase)*r*.045:0;
  const squash=pose.active?Math.sin(pose.progress*Math.PI)*.025:Math.sin(time*.002)*.012;
  ctx.save();ctx.fillStyle='#17162d44';ctx.beginPath();ctx.ellipse(m.x,m.y+r*.8,r*1.15,r*.28,0,0,Math.PI*2);ctx.fill();
  ctx.translate(m.x,m.y+bob);ctx.scale(face*(1+squash),1-squash);
  if(m.moving&&!pose.active)ctx.rotate(Math.sin(phase)*.025);
  const frames=LV2_MONSTER_ART[m.shape].frames;
  if(frames){
    const [sx,sy,sw,sh,ax,ay]=frames[pose.frame],sourceScale=image.naturalWidth/1280,scale=size/640;
    ctx.drawImage(image,sx*sourceScale,sy*sourceScale,sw*sourceScale,sh*sourceScale,-ax*scale,r*.8-ay*scale,sw*scale,sh*scale);
  }else{
    const w=image.naturalWidth/2,h=image.naturalHeight/2;
    ctx.drawImage(image,pose.frame%2*w,Math.floor(pose.frame/2)*h,w,h,-size/2,-size*.78+r*.8,size,size);
  }
  ctx.restore();
  if(pose.active)attackEffect(ctx,m,attack,pose.progress,face);
  return true;
}
