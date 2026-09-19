// PPT의 별무늬 그림 면을 사용합니다. 내용은 F로 여는 확대 카드에만 씁니다.
const back = new Image();
back.src = '/assets/cards/star-card-back.webp';
export function drawStarCard(ctx, card, time) {
  if (card.expiresAt !== null && card.expiresAt <= Date.now()) return;
  const y = card.y - 45 + Math.sin(time / 1100 + (card.slot || 0)) * 2;
  ctx.save();
  ctx.shadowColor = '#eacb81'; ctx.shadowBlur = 15;
  ctx.fillStyle = '#f6d680'; ctx.beginPath(); ctx.roundRect(card.x - 33, y - 46, 66, 92, 7); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save(); ctx.beginPath(); ctx.roundRect(card.x - 30, y - 43, 60, 86, 5); ctx.clip();
  if (back.complete && back.naturalWidth) ctx.drawImage(back, card.x - 30, y - 43, 60, 86);
  ctx.restore();
  ctx.font = '13px "Jua","Malgun Gothic",sans-serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 4; ctx.strokeStyle = '#312b54'; ctx.fillStyle = '#fff5d5';
  ctx.strokeText(card.userNickname + '이 사용', card.x, y - 55);
  ctx.fillText(card.userNickname + '이 사용', card.x, y - 55);
  ctx.restore();
}
