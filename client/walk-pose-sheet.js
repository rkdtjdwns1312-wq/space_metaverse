// 원본 상체에 23종의 실제 8포즈 하체를 등록·합성합니다.
// 원본 파일은 수정하지 않으며 확대/이동 외에 픽셀의 공간 왜곡을 하지 않습니다.
export const WALK_POSE_REGISTRATION=Object.freeze({
  'corvus:2':{"enabled":true,"source":"/assets/avatars/walk-poses/corvus-lv2.png","columns":4,"rows":2,"sourceHip":[0.5,0.72],"targetHip":[0.49,0.73],"scale":0.84,"top":0.72,"bottom":0.745,"bounds":[[0.72,0.4,0.59],[0.83,0.34,0.65],[1,0.29,0.7]]},
  'corvus:3':{"enabled":true,"source":"/assets/avatars/walk-poses/corvus-lv3.png","columns":4,"rows":2,"sourceHip":[0.51,0.79],"targetHip":[0.52,0.79],"scale":0.88,"top":0.77,"bottom":0.795,"bounds":[[0.77,0.43,0.61],[0.87,0.38,0.65],[1,0.33,0.7]]},
  'ophiuchus:2':{"enabled":true,"source":"/assets/avatars/walk-poses/ophiuchus-lv2.png","columns":4,"rows":2,"sourceHip":[0.49,0.71],"targetHip":[0.5,0.75],"scale":0.84,"top":0.74,"bottom":0.765,"bounds":[[0.74,0.38,0.61],[0.85,0.32,0.69],[1,0.25,0.77]]},
  'ophiuchus:3':{"enabled":true,"source":"/assets/avatars/walk-poses/ophiuchus-lv3.png","columns":4,"rows":2,"sourceHip":[0.5,0.76],"targetHip":[0.5,0.76],"scale":0.88,"top":0.735,"bottom":0.765,"bounds":[[0.735,0.4,0.61],[0.85,0.32,0.68],[1,0.27,0.74]]},
  'ophiuchus:4':{"enabled":true,"source":"/assets/avatars/walk-poses/ophiuchus-lv4.png","columns":4,"rows":2,"sourceHip":[0.51,0.78],"targetHip":[0.5,0.77],"scale":0.86,"top":0.75,"bottom":0.78,"bounds":[[0.75,0.4,0.61],[0.85,0.32,0.68],[1,0.27,0.75]]},
  'corona-borealis:2':{"enabled":true,"source":"/assets/avatars/walk-poses/corona-borealis-lv2.png","columns":4,"rows":2,"sourceHip":[0.51,0.72],"targetHip":[0.51,0.72],"scale":0.88,"top":0.7,"bottom":0.73,"bounds":[[0.7,0.35,0.64],[0.83,0.28,0.73],[1,0.24,0.8]]},
  'corona-borealis:3':{"enabled":true,"source":"/assets/avatars/walk-poses/corona-borealis-lv3.png","columns":4,"rows":2,"sourceHip":[0.5,0.77],"targetHip":[0.49,0.75],"scale":0.83,"top":0.73,"bottom":0.76,"bounds":[[0.73,0.36,0.62],[0.84,0.29,0.69],[1,0.25,0.75]]},
  'corona-borealis:4':{"enabled":true,"source":"/assets/avatars/walk-poses/corona-borealis-lv4.png","columns":4,"rows":2,"sourceHip":[0.51,0.83],"targetHip":[0.49,0.82],"scale":0.78,"top":0.8,"bottom":0.825,"bounds":[[0.8,0.39,0.61],[0.88,0.33,0.68],[1,0.29,0.73]]},
  'cancer:3':{"enabled":true,"source":"/assets/avatars/walk-poses/cancer-lv3.png","columns":4,"rows":2,"sourceHip":[0.51,0.82],"targetHip":[0.5,0.8],"scale":0.85,"top":0.78,"bottom":0.805,"bounds":[[0.78,0.41,0.6],[0.88,0.36,0.65],[1,0.31,0.7]]},
  'cancer:4':{"enabled":true,"source":"/assets/avatars/walk-poses/cancer-lv4.png","columns":4,"rows":2,"sourceHip":[0.51,0.8],"targetHip":[0.51,0.79],"scale":0.88,"top":0.77,"bottom":0.795,"bounds":[[0.77,0.4,0.62],[0.88,0.33,0.69],[1,0.28,0.74]]},

  'sagittarius:2':{enabled:true,source:'/assets/avatars/walk-poses/sagittarius-lv2.png',columns:4,rows:2,
    sourceHip:[.52,.67],targetHip:[.52,.69],scale:.90,top:.655,bottom:.70,bounds:[[.655,.46,.58],[.72,.41,.62],[.83,.36,.65],[.90,.34,.70],[1,.30,.78]]},
  'sagittarius:3':{enabled:true,source:'/assets/avatars/walk-poses/sagittarius-lv3.png',columns:4,rows:2,sourceHip:[.52,.70],targetHip:[.52,.72],scale:.90,top:.68,bottom:.725,bounds:[[.68,.44,.60],[.76,.40,.64],[.86,.35,.69],[1,.30,.77]]},
  'sagittarius:4':{enabled:true,source:'/assets/avatars/walk-poses/sagittarius-lv4.png',columns:4,rows:2,sourceHip:[.50,.67],targetHip:[.50,.70],scale:.86,top:.65,bottom:.70,bounds:[[.65,.45,.58],[.75,.38,.64],[.86,.31,.70],[1,.27,.79]]},
  'taurus:3':{enabled:true,"source":"/assets/avatars/walk-poses/taurus-lv3.png","columns":4,"rows":2,"sourceHip":[0.51,0.77],"targetHip":[0.49,0.77],"scale":0.9,"top":0.73,"bottom":0.79,"bounds":[[0.73,0.43,0.58],[0.83,0.38,0.63],[1,0.29,0.72]]},
  'taurus:4':{enabled:true,"source":"/assets/avatars/walk-poses/taurus-lv4.png","columns":4,"rows":2,"sourceHip":[0.51,0.76],"targetHip":[0.5,0.77],"scale":0.9,"top":0.755,"bottom":0.78,"bounds":[[0.7,0.4,0.6],[0.8,0.32,0.7],[1,0.27,0.77]]},
  'capricorn:3':{enabled:true,"source":"/assets/avatars/walk-poses/capricorn-lv3.png","columns":4,"rows":2,"sourceHip":[0.51,0.76],"targetHip":[0.51,0.76],"scale":0.93,"top":0.7,"bottom":0.78,"bounds":[[0.7,0.4,0.62],[0.84,0.34,0.7],[1,0.28,0.77]]},
  'capricorn:4':{enabled:true,"source":"/assets/avatars/walk-poses/capricorn-lv4.png","columns":4,"rows":2,"sourceHip":[0.51,0.78],"targetHip":[0.51,0.78],"scale":0.86,"top":0.785,"bottom":0.80,"bounds":[[0.72,0.41,0.61],[0.84,0.34,0.7],[1,0.28,0.76]]},
  'teacher:1':{enabled:true,"source":"/assets/avatars/walk-poses/teacher-lv1.png","columns":4,"rows":2,"sourceHip":[0.5,0.8],"targetHip":[0.51,0.79],"scale":0.9,"top":0.76,"bottom":0.83,"bounds":[[0.76,0.45,0.57],[0.86,0.38,0.64],[1,0.32,0.71]]},
  'leo:4':{enabled:true,"source":"/assets/avatars/walk-poses/leo-lv4.png","columns":4,"rows":2,"sourceHip":[0.5,0.76],"targetHip":[0.5,0.76],"scale":0.9,"top":0.7,"bottom":0.78,"bounds":[[0.7,0.4,0.6],[0.84,0.32,0.69],[1,0.25,0.77]]},
  'hercules:2':{enabled:true,"source":"/assets/avatars/walk-poses/hercules-lv2.png","columns":4,"rows":2,"sourceHip":[0.5,0.735],"targetHip":[0.49,0.69],"scale":0.92,"top":0.70,"bottom":0.72,"bounds":[[0.65,0.37,0.63],[0.78,0.31,0.69],[1,0.25,0.75]]},
  'hercules:3':{enabled:true,"source":"/assets/avatars/walk-poses/hercules-lv3.png","columns":4,"rows":2,"sourceHip":[0.5,0.76],"targetHip":[0.51,0.76],"scale":0.88,"top":0.71,"bottom":0.79,"bounds":[[0.71,0.39,0.64],[0.84,0.31,0.7],[1,0.24,0.78]]},
  'hercules:4':{enabled:true,"source":"/assets/avatars/walk-poses/hercules-lv4.png","columns":4,"rows":2,"sourceHip":[0.5,0.78],"targetHip":[0.49,0.78],"scale":0.95,"top":0.7,"bottom":0.79,"bounds":[[0.7,0.38,0.62],[0.84,0.28,0.69],[1,0.23,0.77]]},
  'gemini:2':{enabled:true,source:'/assets/avatars/walk-poses/gemini-lv2.png',columns:4,rows:2,regions:[
    {sourceHip:[.35,.68],targetHip:[.36,.70],scale:.62,top:.65,bottom:.71,bounds:[[.65,.28,.43],[.76,.25,.46],[1,.20,.48]]},
    {sourceHip:[.65,.68],targetHip:[.60,.70],scale:.62,top:.65,bottom:.71,bounds:[[.65,.53,.68],[.76,.50,.71],[1,.48,.77]]}
  ]},
});
const cache=new Map(),SIDE=256;
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const canvas=()=>{const c=document.createElement('canvas');c.width=c.height=SIDE;return c;};
export function walkPoseRegistration(id,level){return WALK_POSE_REGISTRATION[id+':'+level]||null;}
export function prepareWalkPoseSheet(id,level){
  const registration=walkPoseRegistration(id,level);if(!registration)return Promise.resolve(null);
  const key=id+':'+level;if(cache.has(key))return cache.get(key);
  const promise=(async()=>{
    const image=new Image();image.src=registration.source;await image.decode();
    if(image.naturalWidth<registration.columns||image.naturalHeight<registration.rows)throw new Error('보행 시트 크기가 맞지 않습니다.');
    const width=image.naturalWidth/registration.columns,height=image.naturalHeight/registration.rows,regions=[];
    for(const region of registration.regions||[registration]){
      const frames=[];
      for(let i=0;i<registration.columns*registration.rows;i++){
        const frame=canvas(),c=frame.getContext('2d',{willReadFrequently:true});
        const transform=region.transforms?.[i]||region,scale=transform.scale??region.scale,sourceHip=transform.sourceHip||region.sourceHip,targetHip=transform.targetHip||region.targetHip;
        const dx=(targetHip[0]-sourceHip[0]*scale)*SIDE,dy=(targetHip[1]-sourceHip[1]*scale)*SIDE;
        const col=i%registration.columns,row=Math.floor(i/registration.columns),sx=Math.round(col*width),sy=Math.round(row*height);
        c.drawImage(image,sx,sy,Math.round((col+1)*width)-sx,Math.round((row+1)*height)-sy,dx,dy,SIDE*scale,SIDE*scale);
        frames.push(c.getImageData(0,0,SIDE,SIDE).data);
      }
      regions.push({registration:region,frames});
    }
    return {registration,regions,frames:regions[0].frames};
  })();
  promise.catch(()=>{cache.delete(key);});cache.set(key,promise);return promise;
}
export function composeWalkPose(base,sheet,index,original=base){
  const result=canvas(),c=result.getContext('2d',{willReadFrequently:true});
  const image=base.getContext('2d',{willReadFrequently:true}).getImageData(0,0,SIDE,SIDE),out=image.data;
  // 움직이는 옷자락은 아래에 남기되 얼굴·몸통은 원본 바이트를 그대로 사용합니다.
  const fixed=original.getContext('2d',{willReadFrequently:true}).getImageData(0,0,SIDE,SIDE).data;
  const fixedRows=Math.floor(Math.min(...sheet.regions.map(r=>r.registration.top))*SIDE);
  out.set(fixed.subarray(0,fixedRows*SIDE*4));
  for(const region of sheet.regions){
  const pose=region.frames[((index%region.frames.length)+region.frames.length)%region.frames.length],r=region.registration;
  for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
    const u=(x+.5)/SIDE,v=(y+.5)/SIDE;
    const upper=r.bounds.findIndex(p=>p[0]>=v),a=r.bounds[Math.max(0,(upper<0?r.bounds.length:upper)-1)],b=r.bounds[upper<0?r.bounds.length-1:upper];
    const t=a===b?0:Math.max(0,Math.min(1,(v-a[0])/(b[0]-a[0]))),left=a[1]+(b[1]-a[1])*t,right=a[2]+(b[2]-a[2])*t;
    const weight=smooth(r.top,r.bottom,v)*smooth(left,left+.006,u)*(1-smooth(right-.006,right,u));
    if(!weight)continue;
    const i=(y*SIDE+x)*4,alpha=out[i+3]*(1-weight)+pose[i+3]*weight;
    for(let ch=0;ch<3;ch++)out[i+ch]=alpha?(out[i+ch]*out[i+3]*(1-weight)+pose[i+ch]*pose[i+3]*weight)/alpha:0;
    out[i+3]=alpha;
  }
  }
  c.putImageData(image,0,0);result.dataset.walkPose=String(index);return result;
}
