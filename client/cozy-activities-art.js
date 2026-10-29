import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';
const props={
 'cozy-pet':{image:mapImage('/assets/cozy/baby-star-bed.webp'),width:220},
 'cozy-room':{image:mapImage('/assets/cozy/star-room-booth.webp'),width:240},
 'cozy-garden':{image:mapImage('/assets/cozy/cosmic-garden.webp'),width:280}
};
export function preloadCozyArt(){return decodeMapImages(Object.values(props).map(p=>p.image));}
export function drawCozyProp(ctx,object,time=0,reducedMotion=true){
 const prop=props[object.kind];if(!prop||!mapImageReady(prop.image))return false;
 const height=prop.width*prop.image.naturalHeight/prop.image.naturalWidth;
 ctx.save();ctx.drawImage(prop.image,object.x-prop.width/2,object.y+38-height,prop.width,height);
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='16px Jua,"Malgun Gothic",sans-serif';ctx.lineJoin='round';
 ctx.lineWidth=5;ctx.strokeStyle='#fff9ed';ctx.strokeText(object.name,object.x,object.y+61);ctx.fillStyle='#665080';ctx.fillText(object.name,object.x,object.y+61);
 if(!reducedMotion){ctx.globalAlpha=.35+.15*Math.sin(time/800);ctx.fillStyle='#fff4c7';ctx.beginPath();ctx.arc(object.x+prop.width*.27,object.y-height*.65,2.5,0,Math.PI*2);ctx.fill();}
 ctx.restore();return true;
}
