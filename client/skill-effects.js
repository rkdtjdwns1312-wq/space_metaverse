// Canvas2D로 그리는 별자리 연출. 이미지 다운로드 없이 16개 고유 모양을4단계로 확장합니다.
// 원점은 시전자, +X가 사용 방향입니다. 호출 쪽에서 마지막 이동 방향으로 회전합니다.
const TAU=Math.PI*2;
const clamp=n=>Math.max(0,Math.min(1,n));
function line(ctx,points,color,width=2,close=false,fill=null){
  ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(close)ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function circle(ctx,x,y,r,color,width=2,fill=null){
  ctx.beginPath();ctx.arc(x,y,Math.max(.1,r),0,TAU);if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function star(ctx,x,y,r,color,points=4){
  const v=[];for(let i=0;i<points*2;i++){const a=-Math.PI/2+i*Math.PI/points,k=i%2?.35:1;v.push([x+Math.cos(a)*r*k,y+Math.sin(a)*r*k]);}
  line(ctx,v,'#fff8ed',.7,true,color);
}
function arc(ctx,x,y,r,start,end,color,width=2){ctx.beginPath();ctx.arc(x,y,r,start,end);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function feather(ctx,x,y,a,size,color,accent){
  ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.beginPath();ctx.moveTo(-size,0);ctx.quadraticCurveTo(0,-size*.65,size,0);ctx.quadraticCurveTo(0,size*.65,-size,0);ctx.fillStyle=color+'55';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.stroke();
  line(ctx,[[-size,0],[size,0]],accent,1);for(let i=-2;i<=2;i++)line(ctx,[[i*size/4,0],[i*size/4-size/5,-size*.23]],color,1);ctx.restore();
}
function fish(ctx,x,y,a,size,color,accent){
  ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.beginPath();ctx.ellipse(0,0,size,size*.48,0,0,TAU);ctx.fillStyle=color+'88';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
  line(ctx,[[-size*.8,0],[-size*1.55,-size*.6],[-size*1.5,size*.6]],accent,1.7,true,color+'66');circle(ctx,size*.5,-size*.08,1.5,accent,1,accent);ctx.restore();
}
// 별자리마다 고유한 윤곽을 그립니다. 단계가 올라가도 같은 주제의 모양을 유지합니다.
function motif(ctx,kind,r,p,c,a){
  switch(kind){
    case 'twins':{
      for(const sign of [-1,1]){const theta=p*TAU*.45+sign*Math.PI/2,x=Math.cos(theta)*r*.52,y=Math.sin(theta)*r*.7;
        arc(ctx,0,0,r*.85,theta-1.5,theta+.2,sign>0?c:a,2.5);star(ctx,x,y,r*.38,sign>0?c:a,5);}
      line(ctx,[[-r*.7,-r*.35],[r*.7,r*.35]],'#fff4d9',1);break;
    }
    case 'feathers':
      for(let i=-2;i<=2;i++)feather(ctx,i*r*.14,Math.sin(i)*r*.25,i*.43+r*.001,r*.62,c,a);
      break;
    case 'water':{
      line(ctx,[[-r*.8,-r*.4],[-r*.42,-r*.6],[-r*.12,-r*.4],[-r*.22,r*.25],[-r*.68,r*.25]],a,2.5,true,c+'44');
      for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-r*.25,-r*.2+i*r*.27);ctx.bezierCurveTo(r*.25,-r*.9+i*r*.3,r*.35,r*.9+i*r*.15,r,r*.1+i*r*.18);ctx.strokeStyle=i%2?a:c;ctx.lineWidth=3-i*.5;ctx.stroke();}
      for(let i=0;i<3;i++)circle(ctx,r*(.55+i*.17),r*(-.5+i*.25),2+i*.4,c,1,c+'66');break;
    }
    case 'spiral':
      for(const sign of [-1,1]){const pts=[];for(let i=0;i<32;i++){const t=i/31*TAU*1.3,rr=r*.55*(1-i/45);pts.push([Math.cos(t)*rr,sign*(r*.38+Math.sin(t)*rr*.7)]);}line(ctx,pts,sign>0?c:a,3);}
      star(ctx,r*.3,0,r*.19,'#fff3cf');break;
    case 'horns':
      for(const sign of [-1,1]){ctx.beginPath();ctx.moveTo(-r*.6,0);ctx.quadraticCurveTo(-r*.3,sign*r*1.05,r*.7,sign*r*.8);ctx.quadraticCurveTo(r*.1,sign*r*.3,r*.35,sign*r*.12);ctx.closePath();ctx.fillStyle=c+'66';ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=2.5;ctx.stroke();}
      line(ctx,[[-r*.8,0],[r*.7,0]],a,3);star(ctx,r*.75,0,r*.24,a);break;
    case 'shield':
      line(ctx,[[-r*.65,-r*.72],[r*.45,-r*.72],[r*.78,0],[r*.45,r*.72],[-r*.65,r*.72],[-r*.92,0]],c,3,true,c+'22');
      line(ctx,[[-r*.4,-r*.48],[r*.25,-r*.48],[r*.48,0],[r*.25,r*.48],[-r*.4,r*.48],[-r*.62,0]],a,1.5,true);star(ctx,-r*.05,0,r*.4,a,5);break;
    case 'scales':
      line(ctx,[[0,r*.7],[0,-r*.8]],a,3);line(ctx,[[-r*.8,-r*.35],[r*.8,-r*.35]],c,3);
      for(const s of [-1,1]){const x=s*r*.58,y=Math.sin(p*TAU)*s*r*.13;
        line(ctx,[[x,-r*.35],[x-r*.27,r*.25+y],[x+r*.27,r*.25+y],[x,-r*.35]],c,1.5);
        arc(ctx,x,r*.15+y,r*.29,0,Math.PI,a,3);}
      star(ctx,0,-r*.82,r*.17,a);line(ctx,[[-r*.35,r*.72],[r*.35,r*.72]],a,3);break;
    case 'whale':
      ctx.beginPath();ctx.moveTo(-r*.7,r*.2);ctx.bezierCurveTo(-r*.5,-r*.85,r*.9,-r*.85,r*.9,0);ctx.bezierCurveTo(r*.9,r*.65,-r*.5,r*.7,-r*.8,r*.25);ctx.lineTo(-r*1.1,r*.65);ctx.lineTo(-r*1.15,-r*.1);ctx.closePath();ctx.fillStyle=c+'66';ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=2;ctx.stroke();
      circle(ctx,r*.6,-r*.08,2,a,1,a);arc(ctx,r*.1,-r*.7,r*.36,Math.PI,TAU,a,2);circle(ctx,r*.45,-r*.85,3,a);break;
    case 'roar':
      for(let i=0;i<12;i++){const t=i*TAU/12;line(ctx,[[Math.cos(t)*r*.65,Math.sin(t)*r*.65],[Math.cos(t)*r,Math.sin(t)*r]],i%2?c:a,4);}
      circle(ctx,0,0,r*.57,c,2.5,c+'33');circle(ctx,-r*.19,-r*.1,1.5,a,1,a);circle(ctx,r*.19,-r*.1,1.5,a,1,a);line(ctx,[[-r*.12,r*.1],[0,r*.24],[r*.12,r*.1]],a,2);
      arc(ctx,r*.5,0,r*.74,-1.1,1.1,a,2);break;
    case 'serpent':{
      const pts=[];for(let i=0;i<=36;i++){const x=-r+i*r/18;pts.push([x,Math.sin(i/36*TAU*1.25-p*2)*r*.48]);}
      line(ctx,pts,c,6);line(ctx,pts,a,1.5);const end=pts.at(-1);ctx.beginPath();ctx.ellipse(end[0],end[1],r*.22,r*.14,0,0,TAU);ctx.fillStyle=c;ctx.fill();circle(ctx,end[0]+r*.09,end[1]-r*.03,1.3,'#356c61',1,'#356c61');break;
    }
    case 'arrow':
      arc(ctx,-r*.62,0,r*.67,-1.15,1.15,c,2.5);line(ctx,[[-r*.35,-r*.6],[-r*.7,0],[-r*.35,r*.6]],a,1.5);
      line(ctx,[[-r*.7,0],[r*.95,0]],c,3);line(ctx,[[r*.52,-r*.26],[r*.95,0],[r*.52,r*.26]],a,3);for(const y of [-1,1])line(ctx,[[-r*.75,y*r*.28],[-r*.44,0]],a,2);break;
    case 'crown':
      line(ctx,[[-r*.8,r*.5],[-r*.95,-r*.5],[-r*.4,-r*.08],[0,-r*.85],[r*.4,-r*.08],[r*.95,-r*.5],[r*.8,r*.5]],c,2.6,true,c+'44');
      line(ctx,[[-r*.76,r*.25],[r*.76,r*.25]],a,2);for(const [x,y] of [[-.95,-.5],[0,-.85],[.95,-.5]])star(ctx,x*r,y*r,r*.17,a);break;
    case 'claws':
      for(const sign of [-1,1]){ctx.save();ctx.translate(0,sign*r*.47);ctx.rotate(sign*(.15+Math.sin(p*Math.PI)*.3));arc(ctx,0,0,r*.55,-1.7,1.7,c,6);line(ctx,[[r*.12,-r*.48],[r*.62,-r*.16]],a,3);ctx.restore();}
      star(ctx,r*.7,0,r*.24,a);break;
    case 'wings':
      for(const sign of [-1,1])for(let i=0;i<5;i++)feather(ctx,-r*.1-i*r*.15,sign*(r*.15+i*r*.15),sign*(.18+i*.14),r*(.6-i*.07),c,a);
      ctx.beginPath();ctx.moveTo(-r*.2,0);ctx.bezierCurveTo(r*.7,r*.3,r*.15,-r*.75,r*.55,-r*.6);ctx.strokeStyle=c;ctx.lineWidth=5;ctx.stroke();star(ctx,r*.7,-r*.6,r*.12,a);break;
    case 'dream':
      for(const [x,y,k] of [[-.55,.15,.35],[0,0,.52],[.5,.15,.34]])circle(ctx,x*r,y*r,r*k,c,1.8,c+'88');
      arc(ctx,r*.42,-r*.65,r*.28,-1.8,1.8,a,5);for(const [x,y] of [[-.55,-.58],[.85,-.12],[-.12,-.9]])star(ctx,x*r,y*r,r*.1,a);break;
    case 'fish':
      for(const s of [-1,1]){const t=p*1.8+s*Math.PI/2;fish(ctx,Math.cos(t)*r*.45,Math.sin(t)*r*.48,t+Math.PI/2,r*.4,s>0?c:a,s>0?a:c);}
      arc(ctx,0,0,r*.87,p*2,p*2+Math.PI*1.5,c,1.5);break;
  }
}
export function drawSkillEffect(ctx,effect,progress,{reducedMotion=false,quality='full'}={}){
  if(!effect||!Number.isFinite(progress)||progress<0||progress>=1)return;
  const p=reducedMotion ? .55 : clamp(progress),stage=effect.layers,low=quality==='low';
  const fade=Math.min(1,progress*9,(1-progress)*5),c=effect.color,a=effect.accent;
  const travel=(.22+.52*(1-Math.pow(1-p,2)))*effect.extent,r=21+stage*4;
  ctx.save();ctx.globalAlpha*=fade;ctx.lineCap='round';ctx.lineJoin='round';
  // 최고 단계에는 은은한 성운을 더합니다. 화면 전체가 번쩍이는 효과는 사용하지 않습니다.
  if(stage===4&&!low){const glow=ctx.createRadialGradient(travel,0,3,travel,0,r*1.95);glow.addColorStop(0,a+'45');glow.addColorStop(.5,c+'20');glow.addColorStop(1,c+'00');ctx.fillStyle=glow;ctx.fillRect(travel-r*2,-r*2,r*4,r*4);}
  const count=low?Math.ceil(effect.particleCount/2):effect.particleCount;
  for(let i=0;i<count;i++){
    const phase=(i*.61803398875+effect.seed*.137)%1,angle=phase*TAU+p*(i%2?1:-1)*.8;
    const rad=(12+(i%5)*7+stage*4)*(.5+p*.6),x=travel*.7+Math.cos(angle)*rad,y=Math.sin(angle)*rad*.72;
    if(i%3===0)star(ctx,x,y,1.8+(i%3)+stage*.3,i%2?c:a);
    else circle(ctx,x,y,1+(i%2)*.8,i%2?c:a,.7,i%2?c+'90':a+'90');
  }
  // LV3 궤적 → LV4 고리와 잔상 → LV5 별자리 연결선과 작은 같은 모양을 추가합니다.
  if(stage>=2){for(let s=-1;s<=1;s+=2){ctx.beginPath();ctx.moveTo(0,s*9);ctx.quadraticCurveTo(travel*.5,s*(14+stage*6)*Math.sin(p*Math.PI),travel,s*r*.5);ctx.strokeStyle=s>0?c:a;ctx.lineWidth=1.4;ctx.stroke();}}
  if(stage>=3){ctx.save();ctx.translate(travel,0);ctx.scale(1,.72);arc(ctx,0,0,r*1.45,p*2,p*2+Math.PI*1.4,c,1.5);arc(ctx,0,0,r*1.65,Math.PI-p*2,Math.PI*2.3-p*2,a,1);ctx.restore();
    if(!low){ctx.save();ctx.translate(travel*.55,0);ctx.globalAlpha*=.2;motif(ctx,effect.motif,r*.7,p,c,a);ctx.restore();}}
  if(stage===4){const nodes=[];for(let i=0;i<7;i++){const t=i*TAU/7+p*.22;nodes.push([travel+Math.cos(t)*r*1.75,Math.sin(t)*r*1.4]);}line(ctx,nodes,c+'77',.8,true);for(const [x,y] of nodes)star(ctx,x,y,3,a);
    if(!low)for(const sign of [-1,1]){ctx.save();ctx.translate(travel*.56,sign*r*1.12);ctx.globalAlpha*=.45;motif(ctx,effect.motif,r*.25,p,c,a);ctx.restore();}}
  ctx.translate(travel,0);ctx.scale(.75+.25*Math.sin(Math.min(1,p*2)*Math.PI/2),.75+.25*Math.sin(Math.min(1,p*2)*Math.PI/2));
  motif(ctx,effect.motif,r,p,c,a);ctx.restore();
}
