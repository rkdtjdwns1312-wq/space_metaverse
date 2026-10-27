// A supported painted monster must never fall through to the old primitive body
// while its image is loading. Keep its position visible until the art arrives.
export function drawMonsterArtLoading(ctx,monster,image){
  ctx.save();
  ctx.font='12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.lineWidth=3;ctx.strokeStyle='#25243de6';ctx.fillStyle='#eee9ff';
  const label=image?.complete&&!image.naturalWidth?'그림 로딩 실패':'그림 불러오는 중';
  ctx.strokeText(label,monster.x,monster.y);ctx.fillText(label,monster.x,monster.y);
  ctx.restore();
  return true;
}
