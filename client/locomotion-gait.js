import {walkPoseRegistration,prepareWalkPoseSheet,composeWalkPose} from './walk-pose-sheet.js';
export const hasWalkPose=(id,level)=>walkPoseRegistration(id,level)?.enabled===true;
// 원화에서 확인한 다리의 뿌리/발목 위치. 허리 위에는 변위를 주지 않습니다.
// x, 뿌리 y, 발목 x/y, 폭: 256px 원화 기준의 정규화 좌표입니다.
const leg=(x,root,footX,footY,width=.075)=>[x,root,footX,footY,width];
const pair=(left,right)=>[left,right];
export const GROUNDED_LEGS=Object.freeze({
  teacher:{1:pair(leg(.47,.76,.47,.91,.045),leg(.55,.76,.55,.89,.045))},
  aries:{2:pair(leg(.37,.73,.36,.86,.09),leg(.54,.75,.54,.91,.09))},
  taurus:{2:pair(leg(.40,.73,.37,.86,.105),leg(.63,.73,.68,.91,.105)),3:pair(leg(.48,.74,.46,.86,.065),leg(.54,.76,.51,.93,.065)),4:pair(leg(.44,.70,.41,.93,.085),leg(.59,.70,.64,.93,.085))},
  gemini:{2:[leg(.35,.66,.31,.80,.048),leg(.42,.66,.42,.84,.048),leg(.57,.66,.52,.79,.045),leg(.61,.66,.62,.84,.048)]},
  cancer:{3:pair(leg(.48,.73,.47,.83,.06),leg(.53,.74,.53,.93,.06)),4:pair(leg(.44,.75,.44,.89,.06),leg(.59,.73,.61,.91,.065))},
  leo:{2:[leg(.32,.68,.32,.87,.095),leg(.50,.64,.50,.80,.09),leg(.66,.68,.68,.86,.09)],3:[leg(.25,.66,.25,.85,.08),leg(.47,.66,.47,.88,.09),leg(.69,.70,.70,.86,.08)],4:pair(leg(.42,.72,.39,.87,.07),leg(.58,.73,.61,.93,.07))},
  sagittarius:{2:pair(leg(.48,.72,.54,.91,.055),leg(.52,.68,.53,.81,.05)),3:pair(leg(.43,.73,.44,.90,.06),leg(.57,.72,.58,.93,.06)),4:pair(leg(.44,.71,.42,.92,.065),leg(.56,.70,.61,.91,.065))},
  capricorn:{2:[leg(.46,.70,.44,.88,.07),leg(.57,.68,.54,.80,.055),leg(.67,.68,.66,.90,.07),leg(.74,.65,.73,.78,.055)],3:pair(leg(.43,.75,.46,.89,.065),leg(.59,.75,.60,.92,.065)),4:pair(leg(.44,.75,.42,.91,.065),leg(.58,.75,.63,.91,.065))},
  ophiuchus:{2:pair(leg(.42,.74,.39,.89,.075),leg(.57,.74,.61,.95,.065)),3:pair(leg(.48,.72,.47,.93,.06),leg(.55,.70,.55,.84,.05)),4:pair(leg(.49,.73,.48,.93,.075),leg(.56,.71,.57,.87,.05))},
  hercules:{2:pair(leg(.43,.67,.36,.91,.08),leg(.58,.67,.64,.91,.08)),3:pair(leg(.43,.70,.39,.91,.075),leg(.60,.70,.63,.87,.08)),4:pair(leg(.43,.69,.37,.88,.07),leg(.56,.69,.61,.92,.08))},
  corvus:{2:pair(leg(.45,.71,.39,.88,.065),leg(.53,.72,.55,.94,.06)),3:pair(leg(.47,.74,.48,.93,.055),leg(.57,.73,.57,.86,.055))},
  cygnus:{2:pair(leg(.41,.75,.39,.85,.09),leg(.53,.78,.54,.91,.09))},
  'corona-borealis':{2:pair(leg(.44,.70,.39,.92,.08),leg(.59,.70,.65,.88,.08)),3:pair(leg(.46,.70,.41,.92,.07),leg(.56,.69,.58,.87,.07)),4:pair(leg(.46,.74,.43,.92,.065),leg(.55,.74,.56,.91,.065))}
});
export function locomotionMode(id,level){return GROUNDED_LEGS[id]?.[level]?'grounded':'floating';}
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a));return t*t*(3-2*t);};
const rigs=new Map();
export function gaitRig(id,level){
  if(hasWalkPose(id,level))return null;
  const key=id+':'+level;if(rigs.has(key))return rigs.get(key);
  const legs=GROUNDED_LEGS[id]?.[level];if(!legs)return null;
  const rig=new Float32Array(256*256*3);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const u=(x+.5)/256,v=(y+.5)/256,i=(y*256+x)*3;
    legs.forEach(([hip,root,ankle,end,width],n)=>{
      const t=clamp((v-root)/(end-root)),center=hip+(ankle-hip)*t;
      const mask=(1-smooth(.45,1,Math.abs(u-center)/width))*smooth(root,root+.075,v)*(1-smooth(end+.025,end+.07,v));
      // 지지하는 발은 바닥을 밀고, 반대 발은 위로 들었다 내려놓습니다. 무릎 위 연결은 고정.
      const sign=n%2?-1:1;
      rig[i]+=sign*4.8*mask*t;
      rig[i+1+n%2]+=5.8*mask*t;
    });
  }
  rigs.set(key,rig);return rig;
}
export function gaitPhase(phase){const s=Math.sin(phase);return [s,Math.max(0,s)**2,Math.max(0,-s)**2];}
// 얼굴·눈의 변형 없이 원화 전체를 움직이는 외부 부유 동작은 locomotion-body에서 처리합니다.
const ready=new WeakMap();
export function queueMotionFrames(frames,render,{id,level}={}){
  const original=frames[0];
  const build=sheet=>new Promise((resolve,reject)=>{
    let next=sheet?0:1;const staged=[original];
    const run=()=>{try{
      const base=next===0?original:render(next);
      staged[next]=sheet?composeWalkPose(base,sheet,Math.floor(next/4),original):base;
      if(++next<frames.length)schedule(run);else{frames.splice(0,frames.length,...staged);resolve();}
    }catch(e){reject(e);}};
    schedule(run);
  });
  const promise=hasWalkPose(id,level)?prepareWalkPoseSheet(id,level).then(build):build(null);
  promise.catch(()=>{});ready.set(frames,promise);return frames;
}
function schedule(run){if(typeof requestIdleCallback==='function')requestIdleCallback(run,{timeout:100});else setTimeout(run,16);}
export function motionFramesReady(frames){return ready.get(frames)||Promise.resolve();}
export const MOTION_FACES={
  aquarius:{2:[[.50,.28,.18,.16]],3:[[.50,.28,.18,.16]],4:[[.46,.28,.15,.16]]},
  capricorn:{2:[[.57,.40,.22,.20]],3:[[.52,.33,.19,.17]],4:[[.50,.33,.18,.17]]},
  taurus:{2:[[.50,.40,.27,.22]],3:[[.50,.30,.19,.17]],4:[[.50,.27,.18,.17]]},
  gemini:{2:[[.36,.30,.13,.16],[.62,.30,.13,.16]],3:[[.38,.30,.14,.16],[.62,.30,.14,.16]],4:[[.38,.30,.14,.16],[.62,.30,.14,.16]]},
  libra:{2:[[.50,.315,.185,.185]],3:[[.50,.345,.175,.155]],4:[[.50,.345,.17,.155]]},
  hercules:{2:[[.50,.30,.18,.17]],3:[[.50,.34,.17,.155]],4:[[.50,.335,.165,.15]]},
  corvus:{2:[[.50,.33,.18,.18]],3:[[.56,.35,.17,.15]],4:[[.50,.35,.165,.15]]},
  cetus:{2:[[.65,.52,.13,.11]],3:[[.65,.52,.13,.11]],4:[[.65,.52,.13,.11]]}
};
const originals=new WeakMap(),protection=new Map();
// 얼굴 내부는 원본 RGBA를 그대로 유지하고 바깥 경계는 부드럽게 잇습니다.
// 원화 끝에 걸친 날개는 캔버스 바깥으로 늘리지 않습니다.
export function finishMotionFrame(frame,original,id,level){
  let source=originals.get(original);if(!source){source=original.getContext('2d',{willReadFrequently:true}).getImageData(0,0,256,256).data;originals.set(original,source);}
  const key=id+':'+level;let weights=protection.get(key);
  if(!weights){weights=new Float32Array(256*256);const faces=MOTION_FACES[id]?.[level]||[];
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      let keep=1-smooth(1,7,Math.min(x,y,255-x,255-y));
      for(const [cx,cy,rx,ry] of faces)keep=Math.max(keep,1-smooth(1,1.15,Math.hypot(((x+.5)/256-cx)/rx,((y+.5)/256-cy)/ry)));
      weights[y*256+x]=keep;
    }protection.set(key,weights);
  }
  const ctx=frame.getContext('2d',{willReadFrequently:true}),pixels=ctx.getImageData(0,0,256,256),out=pixels.data;
  for(let i=0;i<weights.length;i++){const w=weights[i];if(!w)continue;const p=i*4;
    if(w===1){out.set(source.subarray(p,p+4),p);continue;}
    const alpha=source[p+3]*w+out[p+3]*(1-w);
    for(let c=0;c<3;c++)out[p+c]=alpha?(source[p+c]*source[p+3]*w+out[p+c]*out[p+3]*(1-w))/alpha:0;
    out[p+3]=alpha;
  }ctx.putImageData(pixels,0,0);return frame;
}
