// PPT의 별무늬 그림 면을 사용합니다. 내용은 F로 여는 확대 카드에만 씁니다.
const back = new Image();
back.src = '/assets/cards/star-card-back.webp';
export function drawStarCard(ctx, card, time) {
  if (card.expiresAt !== null && card.expiresAt <= Date.now()) return;
  const width=card.width||66,height=card.height||90,scale=width/66;
  const y = card.y - height/2 + Math.sin(time / 1100 + (card.slot || 0)) * 2;
  ctx.save();
  ctx.translate(card.x,y);ctx.scale(scale,scale);
  ctx.shadowColor = '#eacb81'; ctx.shadowBlur = 15;
  ctx.fillStyle = '#f6d680'; ctx.beginPath(); ctx.roundRect(-33,-46,66,92,7); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save(); ctx.beginPath(); ctx.roundRect(-30,-43,60,86,5); ctx.clip();
  if (back.complete && back.naturalWidth) ctx.drawImage(back,-30,-43,60,86);
  ctx.restore();
  ctx.restore();ctx.save();
  ctx.font = `${Math.max(9,13*scale)}px "Jua","Malgun Gothic",sans-serif`; ctx.textAlign = 'center';
  ctx.lineWidth = 4; ctx.strokeStyle = '#312b54'; ctx.fillStyle = '#fff5d5';
  const limit=card.labelWidth||150,full=card.userNickname+'이 사용';
  if(ctx.measureText(full).width<=limit){ctx.strokeText(full,card.x,card.y-height-12);ctx.fillText(full,card.x,card.y-height-12);}
  else{
    let name=card.userNickname;
    while(name.length>1&&ctx.measureText(name+'…').width>limit)name=name.slice(0,-1);
    if(name!==card.userNickname)name+='…';
    for(const [text,offset] of [[name,25],['이 사용',12]]){ctx.strokeText(text,card.x,card.y-height-offset);ctx.fillText(text,card.x,card.y-height-offset);}
  }
  ctx.restore();
}
