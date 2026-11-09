// Keep the renderer's Image, but defer network/decode work until its map is used.
const sources=new WeakMap();
export function mapImage(src,onload){
  if(typeof Image==='undefined')return null;
  const image=new Image();image.decoding='async';if(onload)image.onload=onload;
  sources.set(image,{src,started:false,promise:null});return image;
}
export function startMapImage(image){
  const state=image&&sources.get(image);
  if(state&&!state.started){state.started=true;image.src=state.src;}
  return image;
}
function decodeMapImage(image){
  if(!image)return Promise.resolve();
  startMapImage(image);
  const state=sources.get(image);
  if(!state)return image.decode();
  if(state.promise)return state.promise;
  // Share one decode/retry sequence between the minimap and world renderer.
  // Retry only failed images, with a small bounded delay to avoid a request storm.
  state.promise=(async()=>{
    for(let attempt=0;attempt<3;attempt++){
      try{await image.decode();return;}
      catch(error){
        if(attempt===2)throw error;
        await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
        const [path,fragment]=state.src.split('#',2);
        image.src=path+(path.includes('?')?'&':'?')+'mapRetry='+(attempt+1)+(fragment===undefined?'':'#'+fragment);
      }
    }
  })();
  return state.promise;
}
export function mapImageReady(image){
  startMapImage(image);
  if(image?.complete&&!image.naturalWidth&&sources.has(image))void decodeMapImage(image).catch(()=>{});
  return !!image?.complete&&image.naturalWidth>0;
}
export async function decodeMapImages(images){await Promise.all(images.map(decodeMapImage));}

const whale=mapImage('/assets/maps/cetus-belly-interior.png');
export const whaleMapImage=()=>startMapImage(whale);
export const preloadWhaleArt=()=>decodeMapImages([whale]);
