// Split a painted sheet once. Remove only detached slivers crossing a cell edge;
// the deer, ornaments and soft antler lighting retain their original pixels.
export function nokseraPoseCells(image){
  const cells=[];
  for(let i=0;i<8;i++){
    const size=512,canvas=Object.assign(document.createElement('canvas'),{width:size,height:size}),ctx=canvas.getContext('2d');
    ctx.drawImage(image,i%4*image.naturalWidth/4,Math.floor(i/4)*image.naturalHeight/2,image.naturalWidth/4,image.naturalHeight/2,0,0,size,size);
    const pixels=ctx.getImageData(0,0,size,size),data=pixels.data,seen=new Uint8Array(size*size);
    for(let seed=0;seed<seen.length;seed++){
      if(seen[seed]||data[seed*4+3]<9)continue;
      const queue=[seed];seen[seed]=1;let minX=size,maxX=0;
      for(let k=0;k<queue.length;k++){
        const n=queue[k],x=n%size,y=Math.floor(n/size);minX=Math.min(minX,x);maxX=Math.max(maxX,x);
        for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
          const xx=x+dx,yy=y+dy,j=yy*size+xx;
          if(xx<0||xx>=size||yy<0||yy>=size||seen[j]||data[j*4+3]<9)continue;
          seen[j]=1;queue.push(j);
        }
      }
      if((minX<9||maxX>size-10)&&maxX-minX<36&&queue.length<2500)for(const n of queue)data[n*4+3]=0;
    }
    let foot=490;
    for(let y=size-1;y>size*.65;y--){let count=0;for(let x=0;x<size;x++)if(data[(y*size+x)*4+3]>220)count++;if(count>=8){foot=y+1;break;}}
    ctx.putImageData(pixels,0,0);cells.push({canvas,footY:foot/size});
  }
  return cells;
}
