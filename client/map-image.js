// Keep the renderer's Image, but defer network/decode work until its map is used.
const sources=new WeakMap();
export function mapImage(src,onload){
  if(typeof Image==='undefined')return null;
  const image=new Image();image.decoding='async';if(onload)image.onload=onload;
  sources.set(image,src);return image;
}
export function startMapImage(image){
  if(image&&sources.has(image)){image.src=sources.get(image);sources.delete(image);}
  return image;
}
export function mapImageReady(image){startMapImage(image);return !!image?.complete&&image.naturalWidth>0;}
export async function decodeMapImages(images){await Promise.all(images.map(image=>startMapImage(image)?.decode()));}

const whale=mapImage('/assets/maps/cetus-belly-interior.png');
export const whaleMapImage=()=>startMapImage(whale);
export const preloadWhaleArt=()=>decodeMapImages([whale]);
