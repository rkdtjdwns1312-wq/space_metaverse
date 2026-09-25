const SUPPORTED = new Set(['star-crab', 'water-star']);
const imageCache = new Map();

function monsterImage(shape) {
  if (!imageCache.has(shape)) {
    if (typeof Image === 'undefined') return null;
    const image = new Image();
    image.src = `/assets/monsters/${shape}.png`;
    imageCache.set(shape, image);
  }
  return imageCache.get(shape);
}

function drawCrabWave(ctx, x, y, radius, reach, progress, direction) {
  const distance = reach * (0.45 + 0.5 * progress);
  const spread = radius * (0.6 + Math.sin(progress*Math.PI) * 0.5);
  ctx.save();ctx.translate(x+direction.x*distance,y+direction.y*distance);ctx.rotate(Math.atan2(direction.y,direction.x));
  ctx.globalAlpha=Math.sin(Math.PI*progress)*.9;
  const blue=ctx.createLinearGradient(-spread,0,spread,0);blue.addColorStop(0,'#368cf044');blue.addColorStop(.7,'#50dfffbb');blue.addColorStop(1,'#eeffff');
  ctx.fillStyle=blue;ctx.strokeStyle='#baf9ff';ctx.lineWidth=radius*.06;
  ctx.beginPath();ctx.moveTo(-spread*.5,-spread);
  ctx.bezierCurveTo(spread*.6,-spread*1.2,spread*.9,-spread*.2,spread*.55,spread*.65);
  ctx.quadraticCurveTo(spread*.2,spread*1.2,-spread*.8,spread);
  ctx.bezierCurveTo(spread*.35,spread*.55,spread*.55,-spread*.6,-spread*.5,-spread);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(-spread*.1,-spread*.8);ctx.bezierCurveTo(spread*.7,-spread*.7,spread*.55,spread*.45,-spread*.25,spread*.7);ctx.stroke();
  for(let i=0;i<6;i++){const a=i*1.1+progress;ctx.fillStyle=i%2?'#fff7b7':'#b9faff';ctx.beginPath();ctx.ellipse(Math.cos(a)*spread*.8,Math.sin(a)*spread*1.2,2,4,a,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

function drawWaterJet(ctx, x, y, radius, reach, progress, direction, time) {
  const distance = radius * 0.72 + reach * progress;
  const side = radius * (0.2 + Math.sin(progress * Math.PI) * 0.85);
  const perp = { x: -direction.y, y: direction.x };
  const tip = { x: x + direction.x * distance, y: y + direction.y * distance };
  ctx.save();
  ctx.globalAlpha = Math.sin(Math.PI * progress) * 0.84;
  ctx.fillStyle = '#69dcff';
  ctx.strokeStyle = '#d1f8ff';
  ctx.lineWidth = Math.max(1.5, radius * 0.055);
  ctx.beginPath();
  ctx.moveTo(x + direction.x * radius * 0.32 + perp.x * side * 0.34, y + direction.y * radius * 0.32 + perp.y * side * 0.34);
  ctx.quadraticCurveTo(x + direction.x * distance * 0.52 + perp.x * side, y + direction.y * distance * 0.52 + perp.y * side, tip.x, tip.y);
  ctx.quadraticCurveTo(x + direction.x * distance * 0.52 - perp.x * side, y + direction.y * distance * 0.52 - perp.y * side, x + direction.x * radius * 0.32 - perp.x * side * 0.34, y + direction.y * radius * 0.32 - perp.y * side * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Fixed offsets keep the spark pattern stable instead of flickering each frame.
  const sparks = [[-0.22, -0.55], [0.18, 0.46], [0.31, -0.25], [-0.38, 0.28]];
  sparks.forEach(([along, across], index) => {
    const sx = tip.x + direction.x * radius * along + perp.x * radius * across;
    const sy = tip.y + direction.y * radius * along + perp.y * radius * across;
    const twinkle = 0.65 + 0.35 * Math.sin(time * 0.018 + index * 2.1);
    ctx.globalAlpha = Math.sin(Math.PI * progress) * twinkle;
    ctx.fillStyle = '#ffd86b';
    ctx.beginPath();
    ctx.arc(sx, sy, radius * (index % 2 ? 0.065 : 0.09), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = Math.max(1, radius * 0.035);
    ctx.beginPath();
    ctx.moveTo(sx - radius * 0.12, sy);
    ctx.lineTo(sx + radius * 0.12, sy);
    ctx.moveTo(sx, sy - radius * 0.12);
    ctx.lineTo(sx, sy + radius * 0.12);
    ctx.stroke();
  });
  ctx.restore();
}

export function drawWaterMonster(ctx, monster, time = 0, attack) {
  if (!monster || !SUPPORTED.has(monster.shape)) return false;
  if (!ctx) return true;

  const now = Number.isFinite(time) ? time : (globalThis.performance?.now?.() ?? Date.now());
  const radius = Math.max(1, Number(monster.radius) || 30);
  const size = radius * 3.6;
  const x = Number(monster.x) || 0;
  const y = Number(monster.y) || 0;
  const face = Number(monster.facingX) < 0 ? -1 : 1;
  const moving = Boolean(monster.moving);
  let bob = 0;
  let roll = 0;
  let squashX = 1;
  let squashY = 1;
  let recoil = 0;
  let attackProgress = 0;
  let direction = { x: face, y: 0 };
  const duration = Math.max(1, Number(attack?.durationMs) || 600);
  if (attack && Number.isFinite(attack.startedAt)) {
    const elapsed = now - attack.startedAt;
    if (elapsed >= 0 && elapsed <= duration) {
      attackProgress = elapsed / duration;
      const magnitude = Math.hypot(Number(attack.dx) || 0, Number(attack.dy) || 0);
      if (magnitude > 0.001) direction = { x: attack.dx / magnitude, y: attack.dy / magnitude };
      recoil = Math.sin(Math.PI * attackProgress) * radius * 0.18;
    }
  }
  if (moving) {
    const phase = now * 0.012;
    bob = Math.sin(phase) * radius * 0.055;
    roll = Math.sin(phase) * 0.055;
    squashX = 1 + Math.sin(phase * 2) * 0.025;
    squashY = 1 - Math.sin(phase * 2) * 0.025;
  } else {
    const breathe = Math.sin(now * 0.0022);
    squashX = 1 - breathe * 0.012;
    squashY = 1 + breathe * 0.012;
  }
  const drawX = x - direction.x * recoil;
  const drawY = y - direction.y * recoil + bob + (attackProgress ? radius * 0.055 * Math.sin(Math.PI * attackProgress) : 0);

  ctx.save();
  try {
    // Ground shadow stays beneath the sprite while its body bobs.
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#17385f';
    ctx.beginPath();
    ctx.ellipse(x, y + radius * 0.82, radius * 1.18, radius * 0.31, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.scale(face * squashX, squashY);
    ctx.rotate(roll);
    const image = monsterImage(monster.shape);
    if (image?.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, -size / 2, -size / 2, size, size);
    } else {
      const gradient = ctx.createRadialGradient(-radius * 0.25, -radius * 0.3, radius * 0.08, 0, 0, radius * 1.25);
      gradient.addColorStop(0, '#d8fbff');
      gradient.addColorStop(0.5, monster.shape === 'star-crab' ? '#52b9ec' : '#51d7dc');
      gradient.addColorStop(1, '#2872bd');
      ctx.fillStyle = gradient;
      ctx.strokeStyle = '#e0fbff';
      ctx.lineWidth = Math.max(2, radius * 0.09);
      ctx.beginPath();
      if (monster.shape === 'star-crab') {
        for (let i = 0; i < 10; i++) {
          const angle = -Math.PI / 2 + i * Math.PI / 5;
          const r = radius * (i % 2 ? 0.86 : 1.16);
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r * 0.78;
          if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
      } else {
        ctx.ellipse(0, 0, radius * 0.91, radius * 0.79, 0, 0, Math.PI * 2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(radius * 0.3, -radius * 0.1, radius * 0.09, 0, Math.PI * 2);
      ctx.arc(radius * 0.58, -radius * 0.08, radius * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#174878';
      ctx.beginPath();
      ctx.arc(radius * 0.33, -radius * 0.08, radius * 0.035, 0, Math.PI * 2);
      ctx.arc(radius * 0.61, -radius * 0.06, radius * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (attackProgress > 0) {
      const reach = Math.max(0, Math.min(Number(attack.reach) || radius, radius * 5));
      if (monster.shape === 'star-crab') drawCrabWave(ctx, x, y, radius, reach, attackProgress, direction);
      else drawWaterJet(ctx, x, y, radius, reach, attackProgress, direction, now);
    }
  } finally {
    ctx.restore();
  }
  return true;
}
