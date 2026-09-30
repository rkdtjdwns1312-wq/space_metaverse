const MAX_NUMBERS = 80;
const LIFETIME_MS = 1100;
const BURST_WINDOW_MS = 420;
const BURST_LANES = [0, -1, 1];

const PALETTES = {
  monster: ['#fff0a5', '#ffc34d', '#ff8d68'],
  player: ['#fff0fb', '#ff9ccc', '#ec68b4'],
};

function targetKey(data) {
  return `${data.targetKind}:${data.targetId}`;
}

export function createDamageNumbers() {
  const numbers = [];
  const bursts = new Map();

  function add(data, now = performance.now()) {
    if (!data || (data.targetKind !== 'monster' && data.targetKind !== 'player')) return false;
    if (data.targetId == null || String(data.targetId).length === 0) return false;
    if (![data.x, data.y, data.damage, now].every(Number.isFinite)) return false;
    if (data.x < 0 || data.y < 0 || data.damage <= 0) return false;

    const key = targetKey(data);
    const previous = bursts.get(key);
    const count = previous && now - previous.lastAt <= BURST_WINDOW_MS ? previous.count + 1 : 0;
    bursts.set(key, { count, lastAt: now });

    numbers.push({
      key,
      targetKind: data.targetKind,
      x: data.x + BURST_LANES[count % BURST_LANES.length] * 18,
      y: data.y - (count % 5) * 24,
      damage: data.damage,
      startedAt: now,
    });
    if (numbers.length > MAX_NUMBERS) numbers.splice(0, numbers.length - MAX_NUMBERS);
    return true;
  }

  function draw(ctx, now = performance.now(), reducedMotion = false) {
    for (let index = numbers.length - 1; index >= 0; index -= 1) {
      const entry = numbers[index];
      const progress = (now - entry.startedAt) / LIFETIME_MS;
      if (progress >= 1) {
        numbers.splice(index, 1);
        continue;
      }
      if (progress < 0) continue;

      const alpha = reducedMotion
        ? Math.min(1, (1 - progress) * 3.2)
        : Math.min(1, progress / 0.12, (1 - progress) * 2.7);
      const scale = reducedMotion
        ? 1
        : progress < 0.22
          ? 1 + 0.2 * Math.sin((progress / 0.22) * Math.PI / 2)
          : 1.2 - 0.2 * Math.min(1, (progress - 0.22) / 0.3);
      const rise = reducedMotion ? 0 : 38 * (1 - (1 - progress) ** 2);
      const x = entry.x;
      const y = entry.y - rise;
      const label = `-${Math.round(entry.damage)}`;
      const [light, middle, dark] = PALETTES[entry.targetKind];

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '26px "Jua", "Malgun Gothic", sans-serif';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#37245f';
      ctx.strokeText(label, 0, 0);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff9e9';
      ctx.strokeText(label, 0, 0);

      const width = Math.max(36, ctx.measureText(label).width);
      const gradient = ctx.createLinearGradient(-width / 2, -10, width / 2, 10);
      gradient.addColorStop(0, light);
      gradient.addColorStop(0.52, middle);
      gradient.addColorStop(1, dark);
      ctx.fillStyle = gradient;
      ctx.fillText(label, 0, 0);

      ctx.globalAlpha = alpha * 0.82;
      ctx.font = '13px "Jua", "Malgun Gothic", sans-serif';
      ctx.fillStyle = entry.targetKind === 'monster' ? '#fff3bd' : '#ffe7f6';
      ctx.fillText('✦', -width / 2 - 8, -7);
      ctx.restore();
    }

    for (const [key, burst] of bursts) {
      if (now - burst.lastAt > BURST_WINDOW_MS) bursts.delete(key);
    }
  }

  function clear() {
    numbers.length = 0;
    bursts.clear();
  }

  return {
    add,
    draw,
    clear,
    get size() { return numbers.length; },
  };
}
