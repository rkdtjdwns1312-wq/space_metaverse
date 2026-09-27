import { lv2MonsterPose } from './lv2-monster-art.js';

// 1280×1280 생성 원본: [sx, sy, sw, sh, 발 중심 x, 발 바닥 y].
// 공격 칸은 몸통이 위로 올라가 있으므로 각 포즈의 발을 같은 지면에 붙입니다.
export const SUN_MONSTER_ART = Object.freeze({
  'warm-star': Object.freeze({
    src: '/assets/monsters/warm-star-poses.png', radius: 48, visualScale: 1,
    frames: [[0, 0, 640, 640, 343, 549], [640, 0, 640, 640, 338, 546],
      [0, 640, 700, 640, 350, 477], [700, 640, 580, 640, 289, 505]],
  }),
  'grown-warm-star': Object.freeze({
    src: '/assets/monsters/grown-warm-star-poses.png', radius: 96, visualScale: .55,
    // 큰 궤도 장식 때문에 반경96을 그림에 그대로 쓰면 과도하게 커집니다.
    // 시각 크기만 조절하며 서버 반경·거리·충돌에는 관여하지 않습니다.
    frames: [[0, 0, 640, 640, 344, 586], [640, 0, 640, 640, 350, 570],
      [0, 640, 640, 640, 351, 500], [640, 640, 640, 640, 350, 518]],
    // 회복 칸의 왼쪽 위로 넘어온 이웃 공격 칸의 빛만 제외하고 아래 궤도는 보존합니다.
    frameMasks: { 3: [[70, 0], [640, 0], [640, 640], [0, 640], [0, 380], [70, 300]] },
  }),
});

const images = new Map();
function sprite(shape) {
  if (!images.has(shape) && typeof Image !== 'undefined') {
    const image = new Image();
    image.src = SUN_MONSTER_ART[shape].src;
    images.set(shape, image);
  }
  return images.get(shape);
}

// 기존 8단계 리듬(대기→웅크림→박치기→회복)을 그대로 사용합니다.
export const sunMonsterPose = lv2MonsterPose;

function attackDirection(attack, face) {
  const dx = Number.isFinite(attack?.dx) ? attack.dx : 0;
  const dy = Number.isFinite(attack?.dy) ? attack.dy : 0;
  const length = Math.hypot(dx, dy);
  return length > .001 ? { x: dx / length, y: dy / length } : { x: face, y: 0 };
}

function spark(ctx, x, y, size) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4, r = i % 2 ? size * .25 : size;
    const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();ctx.fill();
}

function goldenBash(ctx, x, y, r, direction, progress) {
  // 실제 서버 공격 상태가 활성일 때만 몸 주변에 태양빛을 더합니다.
  // 독립 투사체나 추가 판정·피해·이동을 만들지 않습니다.
  if (progress <= .28 || progress >= .88) return;
  const strength = Math.sin((progress - .28) / .6 * Math.PI);
  ctx.save();
  ctx.translate(x, y - r * .15);
  ctx.rotate(Math.atan2(direction.y, direction.x));
  ctx.globalAlpha *= strength * .78;
  const glow = ctx.createRadialGradient(r * .4, 0, r * .15, r * .4, 0, r * 1.65);
  glow.addColorStop(0, '#fff8c95c');glow.addColorStop(.55, '#ffd45a55');glow.addColorStop(1, '#ffbc3500');
  ctx.fillStyle = glow;ctx.fillRect(-r * 1.3, -r * 1.7, r * 3.4, r * 3.4);
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    ctx.strokeStyle = i === 0 ? '#fff5b4' : '#ffd56e';
    ctx.lineWidth = r * (i === 0 ? .055 : .035);
    ctx.beginPath();ctx.moveTo(-r * (1.35 + strength * .3), i * r * .34);
    ctx.lineTo(-r * .8, i * r * .25);ctx.stroke();
  }
  const contact = r * (1.12 + strength * .16);
  ctx.strokeStyle = '#ffdc7c';ctx.lineWidth = r * .08;
  ctx.beginPath();ctx.ellipse(contact - r * .12, 0, r * .26, r * .64, 0, -Math.PI * .48, Math.PI * .48);ctx.stroke();
  ctx.fillStyle = '#fff8cc';
  spark(ctx, contact + r * .14, 0, r * (.1 + strength * .14));
  for (let i = 0; i < 3; i++) {
    const angle = (i - 1) * .85;
    spark(ctx, contact + Math.cos(angle) * r * .3, Math.sin(angle) * r * .8, r * .065);
  }
  ctx.restore();
}

export function drawSunMonster(ctx, monster, time = 0, attack) {
  const art = SUN_MONSTER_ART[monster?.shape];
  if (!art) return false;
  if (!ctx) return true;
  const image = sprite(monster.shape);
  if (!image?.complete || !image.naturalWidth) return false;
  const now = Number.isFinite(time) ? time : 0;
  const radius = Math.max(1, Number(monster.radius) || art.radius) * art.visualScale;
  const x = Number(monster.x) || 0, y = Number(monster.y) || 0;
  const pose = sunMonsterPose(now, attack);
  const direction = attackDirection(attack, monster.facingX < 0 ? -1 : 1);
  const face = pose.active && Math.abs(direction.x) > .05 ? Math.sign(direction.x) : monster.facingX < 0 ? -1 : 1;
  const phase = now * .011;
  const bob = monster.moving && !pose.active ? Math.sin(phase) * radius * .035 : 0;
  const p = pose.progress;
  const push = !pose.active ? 0 : p < .375 ? -Math.sin(p / .375 * Math.PI) * radius * .07
    : p < .75 ? Math.sin((p - .375) / .375 * Math.PI) * radius * .2 : 0;
  const squash = pose.active ? Math.sin(p * Math.PI * 2) * .025 : Math.sin(now * .002) * .01;
  const groundY = y + radius;

  ctx.save();
  ctx.fillStyle = '#65432633';ctx.beginPath();
  ctx.ellipse(x, groundY, radius * .83, radius * .2, 0, 0, Math.PI * 2);ctx.fill();
  // 확대·축소 및 회전 기준도 발밑에 두어 포즈 전환 시 지면에서 뜨지 않게 합니다.
  ctx.translate(x + direction.x * push, groundY + direction.y * push + bob);
  ctx.scale(face * (1 + squash), 1 - squash);
  if (monster.moving && !pose.active) ctx.rotate(Math.sin(phase) * .018);
  const [sx, sy, sw, sh, ax, ay] = art.frames[pose.frame];
  const sourceX = image.naturalWidth / 1280, sourceY = image.naturalHeight / 1280;
  const scale = radius * 3 / 640;
  const mask = art.frameMasks?.[pose.frame];
  if (mask) {
    ctx.beginPath();
    mask.forEach(([px, py], index) => {
      const mx = (px - ax) * scale, my = (py - ay) * scale;
      if (index) ctx.lineTo(mx, my); else ctx.moveTo(mx, my);
    });
    ctx.closePath();ctx.clip();
  }
  ctx.drawImage(image, sx * sourceX, sy * sourceY, sw * sourceX, sh * sourceY,
    -ax * scale, -ay * scale, sw * scale, sh * scale);
  ctx.restore();
  if (pose.active) goldenBash(ctx, x + direction.x * push, y + direction.y * push, radius, direction, p);
  return true;
}
