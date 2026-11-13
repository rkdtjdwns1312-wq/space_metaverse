import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';
const props={
 'cozy-pet':{image:mapImage('/assets/cozy/baby-star-nursery.webp'),width:242,height:220,flipX:true},
 'cozy-room':{image:mapImage('/assets/cozy/star-interior-shop.webp'),width:264,height:270.6,flipX:true},
 'cozy-garden':{image:mapImage('/assets/cozy/cosmic-garden.webp'),width:280}
};
export function preloadCozyArt(){return decodeMapImages(Object.values(props).map(p=>p.image));}
export function drawCozyProp(ctx,object,time=0,reducedMotion=true){
 const prop=props[object.kind];if(!prop||!mapImageReady(prop.image))return false;
 const scale=Math.min(prop.width/prop.image.naturalWidth,(prop.height??Infinity)/prop.image.naturalHeight);
 const width=prop.image.naturalWidth*scale,height=prop.image.naturalHeight*scale;
 ctx.save();ctx.save();
 if(prop.flipX){ctx.translate(object.x*2,0);ctx.scale(-1,1);}
 ctx.drawImage(prop.image,object.x-width/2,object.y+38-height,width,height);ctx.restore();
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='16px Jua,"Malgun Gothic",sans-serif';ctx.lineJoin='round';
 ctx.lineWidth=5;ctx.strokeStyle='#fff9ed';ctx.strokeText(object.name,object.x,object.y+61);ctx.fillStyle='#665080';ctx.fillText(object.name,object.x,object.y+61);
 if(!reducedMotion){ctx.globalAlpha=.35+.15*Math.sin(time/800);ctx.fillStyle='#fff4c7';ctx.beginPath();ctx.arc(object.x+(prop.flipX?-1:1)*prop.width*.27,object.y-height*.65,2.5,0,Math.PI*2);ctx.fill();}
 ctx.restore();return true;
}
