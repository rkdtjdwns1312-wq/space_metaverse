// 이동 판정과 분리된 장식 전용 석재 테두리입니다. 기존 외곽 선분만 사용하므로
// 원과 다리가 만나는 입구에 새 벽을 그리지 않습니다. 각 맵의 바닥 캐시에 함께 저장됩니다.
const palettes = {
  silver: ['#ede9f3', '#c3bfd3', '#858098', '#fffaf3'],
  sun: ['#f3e8d7', '#cbb69c', '#927e70', '#fff9e6'],
  moon: ['#e6ebf8', '#b9c5df', '#78849f', '#f8fcff'],
};
export const rimEdges = points => points.map((p, i) => [p, points[(i + 1) % points.length]]);

// 모서리 깎임, 돌마다 다른 색과 짧은 반사광으로 일정한 도형 선을 대신합니다.
export function drawStoneRim(ctx, edges, theme = 'silver') {
  const [light, shade, side, shine] = palettes[theme] || palettes.silver;
  const stones = [];
  for (const [a, b] of edges) {
    const dx = b.x-a.x, dy = b.y-a.y, length = Math.hypot(dx, dy);
    if (length < .5) continue;
    const count = Math.max(1, Math.ceil(length/34));
    for (let i=0; i<count; i++) {
      const t=(i+.5)/count, x=a.x+dx*t, y=a.y+dy*t;
      const seed=Math.abs(Math.sin(x*12.9898+y*78.233));
      stones.push({x,y,angle:Math.atan2(dy,dx),half:Math.max(.2,length/count/2-.45),width:6.5+seed*2,seed});
    }
  }
  function tile(s, drop=0) {
    ctx.save();ctx.translate(s.x,s.y+drop);ctx.rotate(s.angle);
    const h=s.half,w=s.width,c=Math.min(2,h*.25);
    ctx.beginPath();ctx.moveTo(-h+c,-w);ctx.lineTo(h-c,-w);
    ctx.lineTo(h,-w+2);ctx.lineTo(h,w-2);ctx.lineTo(h-c,w);
    ctx.lineTo(-h+c,w);ctx.lineTo(-h,w-2);ctx.lineTo(-h,-w+2);ctx.closePath();
  }
  ctx.save();
  // 옆면을 먼저 그려 이웃한 돌의 윗면을 그림자가 덮지 않도록 합니다.
  for (const s of stones) { tile(s,7);ctx.fillStyle=side;ctx.fill();ctx.restore(); }
  for (const s of stones) {
    tile(s);
    const g=ctx.createLinearGradient(0,-s.width,0,s.width);
    g.addColorStop(0,light);g.addColorStop(.48,light);g.addColorStop(1,shade);
    ctx.fillStyle=g;ctx.fill();ctx.clip();
    ctx.globalAlpha=s.seed*.17;ctx.fillStyle=side;ctx.fill();
    // 돌 표면의 짧은 결은 고정 좌표로 그려 이동 중 깜빡이지 않습니다.
    ctx.globalAlpha=.18;ctx.strokeStyle=shade;ctx.lineWidth=.7;
    ctx.beginPath();ctx.moveTo(-s.half*.7,-s.width*.4);
    ctx.lineTo(-s.half*.2,0);ctx.lineTo(s.half*.3,-s.width*.2);ctx.stroke();
    ctx.globalAlpha=.12+s.seed*.12;ctx.fillStyle=shine;
    ctx.fillRect(-s.half+2,-s.width+1,s.half*1.3,2);
    // 작은 광물 반사광을 드문드문 남깁니다.
    if(s.seed>.98&&s.half>6){ctx.globalAlpha=.65;ctx.fillRect(-1,-2,2,4);ctx.fillRect(-2,-1,4,2);}
    ctx.restore();
  }
  ctx.restore();
}
