import {preloadPlazaArt} from './plaza-art.js';
import {preloadPlazaProps} from './plaza-props.js';
import {preloadStreetArt} from './street-art.js';
import {preloadPaintedProps} from './painted-props.js';
import {preloadParadiseArt} from './paradise-art.js';
import {preloadOriginArt} from './origin-art.js';
import {preloadSleepingStarsArt} from './sleeping-stars-art.js';
import {preloadValleyArt} from './valley-art.js';
import {preloadFloatingCliff} from './floating-island.js';
import {preloadGateArt} from './gate-art.js';
import {preloadInteriorArt} from './interior-art.js';
import {preloadDepartmentArt} from './department-art.js';
import {preloadBlackHoleArt} from './black-hole-art.js';
import {preloadWhaleArt} from './map-image.js';
import {preloadDuelArcades} from './duel-arcade-art.js';
import {preloadHallOfFame} from './hall-of-fame-art.js';
import {preloadDarkStarArt} from './dark-star-art.js';
import {preloadDarkStarSkillsArt} from './dark-star-skills-art.js';
import {preloadCozyArt} from './cozy-activities-art.js';

// Wait for the actual renderer's Image objects, not duplicate HTTP preloads.
// Each family is decoded once. Failed assets remain observable until refresh.
const states=new Map();
export function prepareMapArt(map,planets=[]){
  const family=map.id==='space-plaza'?'plaza':map.id==='star-street'?'street':map.id==='milky-valley'?'valley':map.theme==='star-origin'?'origin':map.theme==='sleeping-stars'?'sleeping-stars':map.theme?.includes('paradise')?'paradise':map.id==='black-hole'?'black-hole':map.theme==='whale-stomach'?'whale':'interior';
  const departments=family==='plaza'?[...new Set(planets.filter(p=>!p.customDesign).map(p=>p.templateId))].sort():[];
  const key=family+':'+(family==='sleeping-stars'?map.id:departments.join(','));
  if(states.has(key))return states.get(key);
  const state={key,status:'loading',failed:0};states.set(key,state);
  // A stalled connection must not leave an unusable loading screen forever.
  // The renderer keeps its existing fallback and an explicit failure notice.
  let timeout;
  const deadline=new Promise(resolve=>{timeout=setTimeout(()=>{state.failed=1;state.status='error';resolve();},15000);});
  const work=[preloadGateArt()];
  if(['plaza','street','valley','origin','sleeping-stars','paradise'].includes(family))work.push(preloadFloatingCliff().then(ok=>{if(!ok)throw Error('cliff');}));
  if(family==='plaza')work.push(preloadPlazaArt(),preloadPlazaProps(),preloadPaintedProps(['shop']),preloadDepartmentArt(departments));
  else if(family==='street')work.push(preloadStreetArt(),preloadPaintedProps(),preloadHallOfFame(),preloadCozyArt(),preloadDuelArcades((map.objects||[]).filter(o=>o.kind==='duel-arcade').map(o=>o.id)));
  else if(family==='valley')work.push(preloadValleyArt());
  else if(family==='origin')work.push(preloadOriginArt());
  else if(family==='sleeping-stars'){work.push(preloadSleepingStarsArt(map));if(map.id==='sleeping-stars-1')work.push(preloadDarkStarArt(),preloadDarkStarSkillsArt());}
  else if(family==='paradise')work.push(preloadParadiseArt());
  else if(family==='black-hole')work.push(preloadBlackHoleArt());
  else if(family==='interior')work.push(preloadInteriorArt());
  else work.push(preloadWhaleArt());
  const completed=Promise.allSettled(work).then(results=>{clearTimeout(timeout);state.failed=results.filter(r=>r.status==='rejected').length;state.status=state.failed?'error':'ready';});
  state.promise=Promise.race([completed,deadline]);
  return state;
}
