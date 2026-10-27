const images=new Map();
function imageFor(id){let image=images.get(id);if(!image){image=new Image();image.src=`/assets/arcade/${id}.png`;images.set(id,image);}return image;}
export async function preloadDuelArcades(ids){await Promise.all(ids.map(id=>imageFor(id).decode()));}
export function drawDuelArcade(ctx,object){
 const image=imageFor(object.id);
 ctx.save();
 if(image.complete&&image.naturalWidth){const w=210,h=195,s=Math.min(w/image.naturalWidth,h/image.naturalHeight);ctx.drawImage(image,object.x-image.naturalWidth*s/2,object.y+55-image.naturalHeight*s,image.naturalWidth*s,image.naturalHeight*s);}
 ctx.font='16px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#fffaf1';ctx.strokeText(object.name,object.x,object.y+80);ctx.fillStyle='#675380';ctx.fillText(object.name,object.x,object.y+80);
 ctx.font='13px "Jua",sans-serif';ctx.fillText('2인용 · 친구와 함께',object.x,object.y+100);ctx.restore();
}
