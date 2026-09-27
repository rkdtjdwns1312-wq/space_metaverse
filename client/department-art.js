// 부서의 고정 종류 ID로 그림을 고릅니다. 이름을 바꿔도 소속·규칙·기존 그림 계열은 유지됩니다.
export const DEPARTMENT_VISUAL_SCALE=Math.SQRT2; // 화면 면적 200% = 가로·세로 각각 √2.
export const DEPARTMENT_ART=Object.freeze(Object.fromEntries([
  'diary','subject','reading','rules','pe','meal','facility','finance','counsel','cleaning','art','show','audit'
].map(id=>[id,Object.freeze({src:`/assets/planets/${id}.png`})])));
const images=new Map();
function imageFor(id){
  if(!DEPARTMENT_ART[id])return null;
  if(!images.has(id)&&typeof Image!=='undefined'){
    const image=new Image();image.src=DEPARTMENT_ART[id].src;images.set(id,image);
  }
  return images.get(id);
}
export async function preloadDepartmentArt(ids=Object.keys(DEPARTMENT_ART)){
  await Promise.all(ids.map(id=>imageFor(id)?.decode()));
}
export function departmentVisualBox(o){
  const radius=Number(o.radius)||36,width=radius*2.65*DEPARTMENT_VISUAL_SCALE,height=radius*3.15*DEPARTMENT_VISUAL_SCALE;
  return {x:o.x-width/2,y:o.y+radius*.9*DEPARTMENT_VISUAL_SCALE-height,width,height};
}
export function drawDepartmentHome(ctx,o,myDept,template){
  const box=departmentVisualBox(o),image=imageFor(template?.id||o.templateId);
  ctx.save();
  // 발밑 충돌과 서버 배치 간격은 기존대로 유지하고 외관만 넓힙니다.
  if(o.id===myDept){ctx.strokeStyle='#b999df';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(o.x,o.y+o.radius*.55,box.width*.43,o.radius*.5,0,0,Math.PI*2);ctx.stroke();}
  if(image?.complete&&image.naturalWidth){
    // 원화의 종횡비를 유지하고 동일한 외관 상자 안에 맞춥니다.
    const scale=Math.min(box.width/image.naturalWidth,box.height/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
    ctx.drawImage(image,box.x+(box.width-w)/2,box.y+box.height-h,w,h);
  }else{
    // 그림을 읽는 동안/기존 종류 없는 행성은 가벼운 기본 행성으로 표시합니다.
    ctx.fillStyle=o.color||'#d9c9ee';ctx.strokeStyle='#9d87b7';ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(o.x,o.y,box.width*.36,box.height*.3,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff6dd';ctx.font='26px "Jua",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(template?.icon||'✦',o.x,o.y);
  }
  ctx.restore();
}
