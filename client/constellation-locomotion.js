// 기존 원화의 얼굴/몸통을 보존하는 부위별 이동 모션. 좌우 반전은 world에서 한 번만 적용합니다.
const SIDE=256,COUNT=16,TAU=Math.PI*2,cache=new WeakMap();
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a));return t*t*(3-2*t);};
// 부위 중심·반경, 최대 이동(px), 흔들림의 위상. 발/옷자락의 윗부분은 고정합니다.
const part=(cx,cy,rx,ry,dx,dy,phase=0,anchorY=0)=>({ellipse:[cx,cy,rx,ry],dx,dy,phase,anchorY});
const foot=(x,y,rx=.08,ry=.11,sign=1)=>part(x,y,rx,ry,sign*3.2,-sign*3.0,0,y-ry);
const hair=(x,y,rx=.13,ry=.23)=>part(x,y,rx,ry,1.3,.45,.35,y-ry);
const cloth=(x,y,rx=.19,ry=.18,sign=1)=>part(x,y,rx,ry,sign*2.0,.7,.5,y-ry);
const wing=(root,outline,angle)=>({root,outline,angle});
// 얼굴 타원은 눈·코·입뿐 아니라 턱/볼을 포함합니다. 두 얼굴/동행 동물도 별도로 보호합니다.
export const LOCOMOTION_PROFILES=Object.freeze({
  aries:{
    2:{faces:[[.44,.40,.25,.20]],ms:90,parts:[foot(.36,.86,.09,.08,1),foot(.54,.91,.10,.08,-1),cloth(.79,.69,.20,.19)]},
    3:{faces:[[.48,.34,.17,.14],[.56,.51,.14,.14]],parts:[hair(.24,.53),hair(.78,.55),cloth(.29,.75),cloth(.70,.77,.15,.16,-1),foot(.49,.85),foot(.60,.90,.065,.07,-1)]},
    4:{faces:[[.49,.33,.17,.14],[.60,.48,.14,.12]],parts:[hair(.21,.55,.16,.27),hair(.79,.57,.16,.29),cloth(.27,.79),cloth(.72,.80,.18,.17,-1)]}
  },
  cancer:{
    2:{faces:[[.49,.48,.28,.20]],ms:85,parts:[
      part(.11,.53,.09,.15,-3.0,-2.6),part(.14,.68,.10,.18,3.1,2.4),
      part(.87,.54,.10,.16,3.0,2.6),part(.86,.70,.10,.18,-3.1,-2.4),
      part(.29,.72,.20,.14,-1.5,.6,0),part(.65,.76,.19,.13,1.5,-.6,0)]},
    3:{faces:[[.50,.34,.17,.16],[.79,.49,.15,.13]],parts:[hair(.30,.32,.10,.19),cloth(.21,.70),cloth(.78,.73,.19,.18,-1),foot(.48,.82),foot(.54,.91,.07,.08,-1)]},
    4:{faces:[[.49,.35,.17,.16],[.26,.86,.17,.10]],parts:[hair(.70,.33,.09,.17),cloth(.23,.67,.16,.18),cloth(.79,.76,.18,.18,-1),foot(.44,.88,.07,.08),foot(.62,.91,.07,.08,-1)]}
  },
  leo:{
    2:{faces:[[.48,.44,.24,.23]],ms:85,parts:[foot(.34,.86,.12,.10),foot(.51,.78,.12,.11,-1),foot(.68,.85,.10,.12),part(.85,.63,.12,.20,2.6,1.0,.3,.44),cloth(.70,.68,.13,.16,-1)]},
    3:{faces:[[.38,.32,.20,.21]],ms:85,parts:[foot(.25,.84,.09,.10),foot(.47,.87,.10,.12,-1),foot(.70,.85,.09,.11),foot(.58,.79,.07,.10,-1),part(.86,.51,.12,.18,2.5,.9,.3,.36),cloth(.68,.64,.23,.18)]},
    4:{faces:[[.51,.32,.17,.15]],parts:[hair(.26,.47,.14,.23),hair(.69,.49,.12,.20),cloth(.24,.70,.20,.21),cloth(.77,.76,.22,.23,-1),foot(.41,.85),foot(.62,.90,.075,.08,-1),part(.88,.60,.11,.14,2.0,.6,.3)]}
  },
  pisces:{
    2:{faces:[[.48,.41,.15,.16],[.59,.67,.15,.16]],ms:110,parts:[
      part(.28,.40,.16,.20,1.3,-1.7),part(.68,.26,.18,.19,2.2,-1.4),
      part(.30,.78,.16,.22,-2.0,1.5),part(.43,.90,.18,.09,-1.6,.7),part(.83,.59,.12,.23,1.4,-1.6)]},
    3:{faces:[[.38,.41,.135,.13],[.62,.50,.135,.13]],parts:[hair(.23,.54,.13,.23),hair(.78,.65,.13,.25),cloth(.27,.79,.16,.20),cloth(.68,.84,.20,.15,-1),part(.48,.18,.34,.15,1.0,.4,.3)]},
    4:{faces:[[.43,.26,.14,.15],[.65,.36,.14,.14]],parts:[hair(.81,.58,.12,.24),hair(.26,.43,.12,.19),cloth(.25,.67,.15,.24),part(.44,.81,.18,.18,2.0,.9,.3,.64),part(.74,.82,.20,.18,-2.1,.9,.3,.64)]}
  },
  ophiuchus:{
    2:{faces:[[.51,.30,.19,.16],[.21,.23,.12,.10]],parts:[hair(.71,.27,.09,.18),cloth(.29,.73,.20,.19),cloth(.78,.69,.20,.24,-1),foot(.41,.89,.10,.08),foot(.62,.93,.08,.07,-1)]},
    3:{faces:[[.49,.25,.18,.15],[.26,.31,.10,.10],[.71,.32,.10,.10]],parts:[hair(.30,.46,.10,.15),hair(.77,.51,.11,.18),cloth(.21,.72,.18,.23),cloth(.76,.75,.20,.22,-1),foot(.48,.91,.07,.08),foot(.54,.82,.07,.08,-1)]},
    4:{faces:[[.49,.25,.18,.15],[.25,.31,.10,.11],[.70,.38,.10,.11],[.36,.72,.10,.09]],parts:[hair(.66,.23,.10,.17),cloth(.26,.59,.12,.16),cloth(.79,.68,.15,.22,-1),foot(.49,.92,.09,.07),foot(.63,.84,.08,.10,-1)]}
  },
  sagittarius:{
    2:{faces:[[.48,.32,.18,.15]],parts:[hair(.22,.47,.17,.21),hair(.73,.53,.12,.18),cloth(.26,.78,.18,.16),cloth(.72,.80,.18,.16,-1),foot(.55,.91,.075,.08),foot(.55,.78,.07,.08,-1)]},
    3:{faces:[[.50,.31,.18,.16]],parts:[hair(.22,.44,.15,.27),hair(.32,.55,.13,.16),cloth(.26,.78,.18,.19),cloth(.73,.80,.19,.16,-1),foot(.46,.88,.07,.09),foot(.58,.91,.07,.08,-1)]},
    4:{faces:[[.51,.29,.17,.15]],parts:[hair(.24,.44,.15,.29),cloth(.26,.70,.19,.25),cloth(.75,.78,.18,.19,-1),foot(.43,.89,.07,.09),foot(.62,.89,.07,.09,-1)]}
  },
  cygnus:{
    2:{faces:[[.39,.25,.17,.19]],ms:105,parts:[foot(.41,.84,.12,.09),foot(.53,.91,.11,.08,-1)],wings:[
      wing([.47,.52],[[.43,.49],[.63,.34],[1,.30],[1,.94],[.58,.94],[.40,.72],[.38,.59]],.055)]},
    3:{faces:[[.49,.31,.17,.16]],parts:[hair(.23,.57,.12,.25),hair(.77,.58,.12,.26),cloth(.29,.78,.19,.19),cloth(.70,.80,.18,.17,-1),foot(.46,.84,.07,.08),foot(.54,.91,.07,.08,-1)],wings:[
      wing([.39,.48],[[.39,.46],[.29,.40],[.25,.45],[.25,.55],[.29,.63],[.36,.60],[.40,.55]],.035),
      wing([.60,.48],[[.60,.46],[.68,.40],[.75,.44],[.78,.51],[.73,.61],[.65,.59],[.60,.54]],-.035)]},
    4:{faces:[[.52,.35,.17,.15],[.33,.15,.12,.12]],ms:125,parts:[hair(.24,.55,.13,.23),hair(.78,.57,.12,.23),cloth(.25,.79,.21,.19),cloth(.75,.79,.19,.19,-1)],wings:[
      wing([.34,.43],[[.35,.43],[.29,.28],[.24,.02],[.02,.02],[.02,.53],[.23,.56],[.33,.52]],.065),
      wing([.68,.43],[[.65,.45],[.70,.28],[.78,.02],[1,.02],[1,.55],[.76,.57],[.67,.51]],-.065)]}
  },
  'corona-borealis':{
    2:{faces:[[.50,.32,.23,.16]],parts:[hair(.28,.26,.08,.13),cloth(.26,.70,.22,.21),cloth(.75,.70,.19,.21,-1),foot(.41,.89,.11,.09),foot(.66,.85,.10,.10,-1)]},
    3:{faces:[[.51,.33,.17,.15]],parts:[hair(.29,.27,.09,.16),cloth(.29,.74,.23,.19),cloth(.75,.74,.18,.19,-1),foot(.43,.89,.09,.09),foot(.58,.85,.08,.11,-1)]},
    4:{faces:[[.50,.34,.17,.15]],parts:[hair(.68,.31,.09,.15),cloth(.26,.75,.22,.22),cloth(.75,.77,.19,.20,-1),foot(.45,.90,.075,.08),foot(.57,.88,.075,.08,-1)]}
  }
});
export function locomotionProfile(id,level){return LOCOMOTION_PROFILES[id]?.[level]||null;}
function canvas(){const c=document.createElement('canvas');c.width=c.height=SIDE;return c;}
function radius(u,v,[x,y,rx,ry]){return Math.hypot((u-x)/rx,(v-y)/ry);}
function polygon(outline){const p=new Path2D();outline.forEach(([x,y],i)=>i?p.lineTo(x*SIDE,y*SIDE):p.moveTo(x*SIDE,y*SIDE));p.closePath();return p;}
function edgeDistance(u,v,outline){
  let distance=Infinity;
  for(let i=0;i<outline.length;i++){
    const [ax,ay]=outline[i],[bx,by]=outline[(i+1)%outline.length],dx=bx-ax,dy=by-ay;
    const t=clamp(((u-ax)*dx+(v-ay)*dy)/(dx*dx+dy*dy||1));
    distance=Math.min(distance,Math.hypot(u-ax-t*dx,v-ay-t*dy));
  }
  return distance;
}
function* makeRig(original,profile){
  const ctx=original.getContext('2d',{willReadFrequently:true});
  const wings=(profile.wings||[]).map(w=>{
    const mask=canvas(),c=mask.getContext('2d',{willReadFrequently:true});c.fill(polygon(w.outline));
    return {...w,mask:c.getImageData(0,0,SIDE,SIDE).data};
  });
  const source=ctx.getImageData(0,0,SIDE,SIDE).data,fields=new Float32Array(SIDE*SIDE*4);
  for(let y=0;y<SIDE;y++){
    for(let x=0;x<SIDE;x++){
    const u=(x+.5)/SIDE,v=(y+.5)/SIDE,index=(y*SIDE+x)*4;
    const protect=Math.min(...profile.faces.map(e=>smooth(1,1.3,radius(u,v,e))));
    if(!protect)continue;
    for(const p of profile.parts){
      let weight=(1-smooth(.30,1,radius(u,v,p.ellipse)))*protect;
      if(p.anchorY)weight*=smooth(p.anchorY,p.ellipse[1],v);
      // sin(t+phase)-sin(phase) = sin(t)*cos(phase)+(cos(t)-1)*sin(phase).
      fields[index]+=p.dx*weight*Math.cos(p.phase);fields[index+1]+=p.dx*weight*Math.sin(p.phase);
      fields[index+2]+=p.dy*weight*Math.cos(p.phase);fields[index+3]+=p.dy*weight*Math.sin(p.phase);
    }
    // 날개 마스크만 어깨 관절을 축으로 움직입니다. 접합부를 부드럽게 연결해 절단선/빈틈을 막습니다.
    for(const w of wings)if(w.mask[index+3]){
      const weight=smooth(0,.035,edgeDistance(u,v,w.outline))*smooth(.025,.13,Math.hypot(u-w.root[0],v-w.root[1]))*protect;
      fields[index]-=(v-w.root[1])*SIDE*w.angle*weight;
      fields[index+2]+=(u-w.root[0])*SIDE*w.angle*weight;
    }
    }
    if(y%4===3)yield;
  }
  return {original,source,fields,frames:new Map([[0,original]])};
}
function* render(rig,index){
  const frame=canvas(),ctx=frame.getContext('2d'),out=ctx.createImageData(SIDE,SIDE);
  const {source,fields}=rig,phase=index/COUNT*TAU,sin=Math.sin(phase),cos=Math.cos(phase)-1;
  for(let y=0;y<SIDE;y++){
    for(let x=0;x<SIDE;x++){
    const i=(y*SIDE+x)*4,sx=x-fields[i]*sin-fields[i+1]*cos,sy=y-fields[i+2]*sin-fields[i+3]*cos;
    if(sx===x&&sy===y){out.data.set(source.subarray(i,i+4),i);continue;}
    if(sx<0||sy<0||sx>SIDE-1||sy>SIDE-1)continue;
    const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
    const a=(iy*SIDE+ix)*4,b=(iy*SIDE+Math.min(SIDE-1,ix+1))*4,c=(Math.min(SIDE-1,iy+1)*SIDE+ix)*4,d=(Math.min(SIDE-1,iy+1)*SIDE+Math.min(SIDE-1,ix+1))*4;
    // 보간은 premultiplied alpha로 수행해 투명 경계의 검은 띠를 만들지 않습니다.
    const weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy],samples=[a,b,c,d];
    let alpha=0;for(let k=0;k<4;k++)alpha+=source[samples[k]+3]*weights[k];
    out.data[i+3]=alpha;
    if(alpha)for(let ch=0;ch<3;ch++){let value=0;for(let k=0;k<4;k++)value+=source[samples[k]+ch]*source[samples[k]+3]*weights[k];out.data[i+ch]=value/alpha;}
    }
    if(y%8===7)yield;
  }
  ctx.putImageData(out,0,0);
  // 얼굴은 위에서 원본 RGBA를 그대로 복사합니다. clipped copy의 반투명 타원 경계도 생기지 않습니다.
  return frame;
}
// 모든 아바타가 공유하는 작은 작업 큐. 이미지 최초 표시 시에도 렌더 경로에서 픽셀 계산을 하지 않습니다.
const jobs=[];let scheduled=false;
function schedule(){
  if(scheduled||!jobs.length)return;scheduled=true;
  const run=()=>{
    scheduled=false;const start=performance.now();
    do{
      const job=jobs.shift();
      try{if(job.steps.next().done)job.resolve();else jobs.push(job);}catch(error){job.reject(error);}
    }while(jobs.length&&performance.now()-start<3);
    schedule();
  };
  if(typeof requestIdleCallback==='function')requestIdleCallback(run,{timeout:100});else setTimeout(run,16);
}
function entryFor(sprite,id,level){
  const profile=locomotionProfile(id,level);if(!profile||!sprite?.complete||!sprite.naturalWidth)return null;
  let sets=cache.get(sprite);if(!sets){sets=new Map();cache.set(sprite,sets);}
  const key=`${id}:${level}`;let entry=sets.get(key);
  if(!entry){
    const original=canvas();original.getContext('2d',{willReadFrequently:true}).drawImage(sprite,0,0,SIDE,SIDE);
    entry={original,frames:new Map([[0,original]])};sets.set(key,entry);
    function* build(){
      const rig=yield* makeRig(original,profile);
      for(let index=1;index<COUNT;index++)entry.frames.set(index,yield* render(rig,index));
    }
    entry.ready=new Promise((resolve,reject)=>jobs.push({steps:build(),resolve,reject}));
    // 준비 실패 시에도 원화 표시를 유지하며 호출자는 ready 결과로 실패를 확인할 수 있습니다.
    entry.ready.catch(()=>{});schedule();
  }
  return entry;
}
export function prepareConstellationWalk(sprite,id,level){return entryFor(sprite,id,level)?.ready||Promise.resolve();}
// 최초 호출은 원화로 즉시 돌아옵니다. 계산이 끝난 프레임만 선택하여 그립니다.
export function constellationWalkFrame(sprite,id,level,index=0){
  const entry=entryFor(sprite,id,level);if(!entry)return null;
  index=((Math.floor(index)%COUNT)+COUNT)%COUNT;
  return entry.frames.get(index)||entry.original;
}

// 이동 거리/이동속도와 독립적인 느린 재생 주기. 순간이동과 맵 전환은 걷기로 보지 않습니다.
export function createLocomotionClock(){
  const actors=new Map();
  return {
    sample(id,key,x,y,time,frameMs=110,reduced=false){
      let s=actors.get(id);
      if(!s||s.key!==key||time<s.time||Math.hypot(x-s.x,y-s.y)>240){
        actors.set(id,{key,x,y,time,since:time,until:time-1});return {index:0,moving:false};
      }
      const moving=Math.hypot(x-s.x,y-s.y)>.12;
      if(moving){if(s.until<time)s.since=time;s.until=time+160;}
      Object.assign(s,{x,y,time});
      const active=!reduced&&time<s.until;
      return {index:active?Math.floor((time-s.since)/frameMs)%COUNT:0,moving:active};
    },
    clear(){actors.clear();},
    retain(ids){const keep=new Set(ids);for(const id of actors.keys())if(!keep.has(id))actors.delete(id);}
  };
}
