import {drawCorvus} from './corvus-effects.js';
import {drawAquarius} from './aquarius-effects.js';
import {drawWaterProjectile} from './water-effects.js';
import {drawSwanProjectile} from './swan-effects.js';
import {drawOphiuchusProjectile} from './ophiuchus-effects.js';
import {drawGeminiProjectile} from './gemini-effects.js';
import {drawAriesProjectile} from './aries-effects.js';
import {drawTaurusProjectile} from './taurus-effects.js';
import {drawLibraProjectile} from './libra-effects.js';
import {drawCoronaProjectile} from './corona-effects.js';
import {drawSagittarius} from './sagittarius-effects.js';
import {waterProjectilePoint} from '/shared/water-skills.js';
import {swanProjectilePoint} from '/shared/swan-skills.js';
import {drawPiscesPortalPair} from './pisces-portals.js';

export function createProjectileEffects(canvas){
  const active=new Map();
  const portals=new Map();
  function add(p){
    if(!active.has(p.id))active.set(p.id,{...p,startsAt:performance.now()-p.elapsedMs});
    if(p.piscesPortal&&p.fishIndex===0&&!portals.has(p.id))portals.set(p.id,{...p,startsAt:performance.now()-p.elapsedMs});
  }
  return {
    add,
    clear(){active.clear();portals.clear();},
    sync(list){const ids=new Set(list.map(p=>p.id));for(const id of active.keys())if(!ids.has(id))active.delete(id);for(const [id,p]of portals)if(!list.some(q=>q.piscesPortal&&q.playerId===p.playerId))portals.delete(id);list.forEach(add);},
    end(p){active.delete(p.id);canvas.dataset.lastProjectileStop=String(p.distance);},
    draw(ctx,now,reducedMotion){
      let count=0;
      for(const [id,p]of portals){const age=now-p.startsAt;if(age>=2000){portals.delete(id);continue;}drawPiscesPortalPair(ctx,p,age,reducedMotion);}
      for(const [id,p] of active){
        const age=now-p.startsAt;if(age<0)continue;
        if(age>=p.durationMs){active.delete(id);continue;}
        const progress=age/p.durationMs;
        const point=p.kind==='cygnus-attack'?swanProjectilePoint(p,progress):waterProjectilePoint(p,progress);
        const visual={...p,...point,sourceX:p.x,sourceY:p.y,projectile:true};
        if(p.visible!==false&&!drawCoronaProjectile(ctx,visual,age,reducedMotion)&&!drawLibraProjectile(ctx,visual,age,reducedMotion)&&!drawTaurusProjectile(ctx,visual,age,reducedMotion)&&!drawAriesProjectile(ctx,visual,age,reducedMotion)&&!drawGeminiProjectile(ctx,visual,age,reducedMotion)&&!drawOphiuchusProjectile(ctx,visual,age,reducedMotion)&&!drawSwanProjectile(ctx,visual,age,reducedMotion)&&!drawWaterProjectile(ctx,visual,age,reducedMotion)&&
          !drawAquarius(ctx,visual,age,reducedMotion)&&!drawCorvus(ctx,visual,progress,reducedMotion))drawSagittarius(ctx,visual,progress,now,reducedMotion);
        count++;
        if(p.visible!==false){canvas.dataset.projectileX=String(visual.x);canvas.dataset.projectileY=String(visual.y);}
      }
      for(const p of portals.values())drawPiscesPortalPair(ctx,p,now-p.startsAt,reducedMotion,true);
      canvas.dataset.projectileCount=String(count);
    }
  };
}
