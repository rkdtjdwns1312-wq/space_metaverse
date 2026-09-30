// 요청305: artwork only. Geometry, gates, labels and interaction belong to world.js.
const groundUrl = new URL('./assets/maps/black-hole-interior.png', import.meta.url).href;
const starUrl = new URL('./assets/maps/black-star-sanctuary.png', import.meta.url).href;
let groundImage;
let starImage;
let groundCache;
let groundCacheKey = '';
let reducedMotion;

function loadImage(url) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  return image;
}

function loaded(image) {
  return image?.complete && image.naturalWidth > 0;
}

function mapDimension(value, fallback) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

/** One cached floor raster in map coordinates; never alters map geometry. */
export function drawBlackHoleGround(ctx, map) {
  const width = mapDimension(map?.width, 1200);
  const height = mapDimension(map?.height, 760);
  groundImage ||= loadImage(groundUrl);
  ctx.save();
  try {
    if (!loaded(groundImage)) {
      // Quiet loading/error backdrop, replaced automatically once decoding completes.
      ctx.fillStyle = '#35364f';
      ctx.fillRect(0, 0, width, height);
      return false;
    }
    const key = `${width}x${height}`;
    if (!groundCache || groundCacheKey !== key) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const paint = canvas.getContext('2d');
      paint.imageSmoothingEnabled = true;
      paint.imageSmoothingQuality = 'high';
      paint.drawImage(groundImage, 0, 0, width, height);
      groundCache = canvas;
      groundCacheKey = key;
    }
    ctx.drawImage(groundCache, 0, 0);
    return true;
  } finally {
    ctx.restore();
  }
}

/** Fixed star center and radius. No label, gate, collision or interaction changes. */
export function drawBlackStar(ctx, object, time = 0) {
  if (!object || !Number.isFinite(object.x) || !Number.isFinite(object.y)) return false;
  starImage ||= loadImage(starUrl);
  if (!loaded(starImage)) return false;
  reducedMotion ||= typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const radius = Number.isFinite(object.radius) && object.radius > 0 ? object.radius : 80;
  // The generated gem occupies ~72% of its transparent canvas: body diameter ~2r.
  const size = radius * 2.8;
  const left = object.x - size / 2;
  const top = object.y - size / 2;
  const phase = Number.isFinite(time) ? time / 1400 : 0;
  const shimmer = reducedMotion.matches ? 0.025 : 0.025 + Math.sin(phase) * 0.018;
  ctx.save();
  try {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(starImage, left, top, size, size);
    // Reuse the painted nebula/glints at the exact same position; no bob or scale drift.
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha *= shimmer;
    ctx.drawImage(starImage, left, top, size, size);
    return true;
  } finally {
    ctx.restore();
  }
}
