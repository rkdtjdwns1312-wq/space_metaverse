const TAU = Math.PI * 2;

function starPath(ctx, x, y, outer, inner = outer * 0.42, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 ? inner : outer;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
}

export function drawCraftingMachine(ctx, o, time = 0) {
  if (!ctx || !o) return;
  const x = Number(o.x) || 1080;
  const y = Number(o.y) || 380;
  const radius = Number(o.radius) || 62;
  const pulse = 1 + Math.sin(time * 0.004) * 0.035;
  const orbit = time * 0.0007;

  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#8c76c8';
  ellipse(ctx, 0, radius * 1.03, radius * 0.86, radius * 0.22);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = '#4b3d67';
  ctx.lineWidth = Math.max(2, radius * 0.055);
  ctx.fillStyle = '#cdbcf1';
  ctx.beginPath();
  ctx.moveTo(-radius * 0.62, radius * 0.62);
  ctx.lineTo(-radius * 0.5, radius * 1.12);
  ctx.quadraticCurveTo(-radius * 0.3, radius * 1.22, -radius * 0.12, radius * 1.08);
  ctx.lineTo(-radius * 0.2, radius * 0.58);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#aee4d0';
  ctx.beginPath();
  ctx.moveTo(radius * 0.2, radius * 0.58);
  ctx.lineTo(radius * 0.12, radius * 1.08);
  ctx.quadraticCurveTo(radius * 0.3, radius * 1.22, radius * 0.5, radius * 1.12);
  ctx.lineTo(radius * 0.62, radius * 0.62);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#f5d99d';
  ellipse(ctx, 0, radius * 0.55, radius * 0.19, radius * 0.1);
  ctx.fill(); ctx.stroke();

  ctx.strokeStyle = '#8e79bd';
  ctx.lineWidth = Math.max(2, radius * 0.045);
  ellipse(ctx, 0, 0, radius * 1.02, radius * 0.56, -0.08); ctx.stroke();
  ctx.strokeStyle = '#8fd5c0';
  ellipse(ctx, 0, 0, radius * 0.86, radius * 0.42, 0.1); ctx.stroke();

  ctx.fillStyle = '#f4ddc0';
  ctx.strokeStyle = '#4b3d67';
  ctx.lineWidth = Math.max(2, radius * 0.06);
  ctx.beginPath();
  ctx.moveTo(-radius * 0.78, -radius * 0.12);
  ctx.quadraticCurveTo(-radius * 0.72, radius * 0.64, 0, radius * 0.77);
  ctx.quadraticCurveTo(radius * 0.72, radius * 0.64, radius * 0.78, -radius * 0.12);
  ctx.quadraticCurveTo(radius * 0.48, radius * 0.14, 0, radius * 0.16);
  ctx.quadraticCurveTo(-radius * 0.48, radius * 0.14, -radius * 0.78, -radius * 0.12);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  const glow = ctx.createRadialGradient(0, 0, radius * 0.08, 0, 0, radius * 0.5);
  glow.addColorStop(0, 'rgba(255,255,220,.95)');
  glow.addColorStop(0.45, 'rgba(255,231,142,.65)');
  glow.addColorStop(1, 'rgba(255,211,119,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, radius * 0.52 * pulse, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff4a9'; ctx.strokeStyle = '#b9894b';
  starPath(ctx, 0, 0, radius * 0.27 * pulse, radius * 0.11 * pulse); ctx.fill(); ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = Math.max(1.5, radius * 0.025);
  ellipse(ctx, 0, 0, radius * 0.64, radius * 0.25, orbit); ctx.stroke();
  ellipse(ctx, 0, 0, radius * 0.64, radius * 0.25, orbit + Math.PI / 2); ctx.stroke();
  ctx.fillStyle = '#ffd86d';
  [0.2, 0.72].forEach((phase, i) => {
    const a = orbit * (i ? -1 : 1) + phase * TAU;
    starPath(ctx, Math.cos(a) * radius * 0.64, Math.sin(a) * radius * 0.25, radius * 0.07, radius * 0.03);
    ctx.fill();
  });

  ctx.fillStyle = '#ffd86d';
  [[-0.94,-0.42,0.07],[0.92,-0.3,0.06],[-0.65,0.24,0.045],[0.68,0.36,0.05]].forEach(([dx,dy,dr]) => { starPath(ctx, dx * radius, dy * radius, dr * radius); ctx.fill(); });

  ctx.fillStyle = '#fff5d9';
  ctx.strokeStyle = '#4b3d67';
  ctx.lineWidth = Math.max(2, radius * 0.045);
  ctx.font = `${Math.max(10, radius * 0.18)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.beginPath(); ctx.roundRect(-radius * 0.64, -radius * 1.16, radius * 1.28, radius * 0.34, radius * 0.12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#594a78';
  ctx.fillText('별빛 조합기', 0, -radius * 0.99);
  ctx.restore();
}
