import {drawCorvus} from './corvus-effects.js';
import {drawSagittarius} from './sagittarius-effects.js';

export function createProjectileEffects(canvas){
  const active=new Map();
  function add(p){
    if(!active.has(p.id))active.set(p.id,{...p,startsAt:performance.now()-p.elapsedMs});
  }
  return {
    add,
    clear(){active.clear();},
    sync(list){const ids=new Set(list.map(p=>p.id));for(const id of active.keys())if(!ids.has(id))active.delete(id);list.forEach(add);},
    end(p){active.delete(p.id);canvas.dataset.lastProjectileStop=String(p.distance);},
    draw(ctx,now,reducedMotion){
      let count=0;
      for(const [id,p] of active){
        const age=now-p.startsAt;if(age<0)continue;
        if(age>=p.durationMs){active.delete(id);continue;}
        const progress=age/p.durationMs,distance=p.range*progress;
        const visual={...p,x:p.x+p.dx*distance,y:p.y+p.dy*distance,projectile:true};
        if(!drawCorvus(ctx,visual,progress,reducedMotion))drawSagittarius(ctx,visual,progress,now,reducedMotion);
        count++;canvas.dataset.projectileX=String(visual.x);canvas.dataset.projectileY=String(visual.y);
      }
      canvas.dataset.projectileCount=String(count);
    }
  };
}
