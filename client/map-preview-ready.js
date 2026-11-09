import {preloadPlazaGroundArt} from './plaza-art.js';
import {preloadStreetGroundArt} from './street-art.js';
import {preloadValleyGroundArt} from './valley-art.js';
import {preloadOriginGroundArt} from './origin-art.js';
import {preloadSleepingStarsArt} from './sleeping-stars-art.js';
import {preloadParadiseArt} from './paradise-art.js';
import {preloadBlackHoleGroundArt} from './black-hole-art.js';
import {preloadInteriorFloorArt} from './interior-art.js';
import {preloadFloatingCliff} from './floating-island.js';

// Tiny overview thumbnails use the renderer's real ground images. Never prepare
// boss sprites, skill sheets, props or unused interior styles for these previews.
const states=new Map();
export function prepareMapPreviewArt(map,planet){
  const key=map.id+':'+(planet?.interiorDecor?.room?.shapeId||'default');
  if(states.has(key))return states.get(key);
  const state={status:'loading',failed:0};states.set(key,state);
  let work;
  if(map.id==='space-plaza')work=preloadPlazaGroundArt();
  else if(map.theme==='starlight-street')work=preloadStreetGroundArt();
  else if(map.id==='milky-valley')work=preloadValleyGroundArt();
  else if(map.theme==='star-origin')work=preloadOriginGroundArt(map);
  else if(map.theme==='sleeping-stars')work=preloadSleepingStarsArt(map);
  else if(map.theme?.includes('paradise'))work=preloadParadiseArt();
  else if(map.id==='black-hole')work=preloadBlackHoleGroundArt();
  else if(map.planetId)work=preloadInteriorFloorArt(planet);
  else work=Promise.resolve();
  const cliff=!map.planetId&&map.id!=='black-hole'?preloadFloatingCliff().then(ok=>{if(!ok)throw Error('cliff');}):Promise.resolve();
  let timeout;
  const deadline=new Promise(resolve=>{timeout=setTimeout(()=>{state.failed=1;state.status='error';resolve();},15000);});
  const completed=Promise.allSettled([work,cliff]).then(results=>{
    clearTimeout(timeout);state.failed=results.filter(result=>result.status==='rejected').length;state.status=state.failed?'error':'ready';
  });
  state.promise=Promise.race([completed,deadline]);return state;
}
