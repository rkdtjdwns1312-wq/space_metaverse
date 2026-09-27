import { VALLEY_LAYOUT, traceValleyFloor, onValleyFloor } from '/shared/valley-layout.js';

const images = new Map();
let background = null;
const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
const invalidate = () => { background = null; };
for (const [id, file] of Object.entries({
  sky: 'milky-valley-sky.png', paving: 'plaza-paving.png',
  evolution: 'evolution-altar.png', growth: 'growth-altar.png',
})) {
  if (typeof Image === 'undefined') break;
  const image = new Image();
  image.onload = invalidate;
  image.src = `/assets/maps/${file}`;
  images.set(id, image);
}
if (typeof document !== 'undefined') document.fonts?.load('32px Jua').then(invalidate).catch(() => {});
const ready = image => image?.complete && image.naturalWidth > 0;
// 확인한 원본의 투명 여백만 제외합니다. 원화 파일은 변경하지 않습니다.
const altarArt = {
  evolution: { width: 1230, height: 1278, crop: [236, 76, 756, 1116], orb: [617, 263] },
  growth: { width: 1234, height: 1275, crop: [224, 80, 792, 1088], orb: [618, 300] },
};

function floorTint(ctx, mini = false) {
  const tint = ctx.createLinearGradient(0, 0, VALLEY_LAYOUT.width, 0);
  tint.addColorStop(0, mini ? '#dce5f7' : '#c9d8f16b');
  tint.addColorStop(.33, mini ? '#eef1fc' : '#e1e8f442');
  tint.addColorStop(.5, mini ? '#ece6f2' : '#eee6f01a');
  tint.addColorStop(.68, mini ? '#f8e9c0' : '#f5df9855');
  tint.addColorStop(1, mini ? '#f1d496' : '#efca7980');
  return tint;
}

function drawFloor(ctx) {
  const { width, height } = VALLEY_LAYOUT;
  // 외곽선은 원·다리별 선이 아니라 공유 union 경로만 사용합니다.
  ctx.save();ctx.translate(0, 22);
  ctx.shadowColor = '#111a4290';ctx.shadowBlur = 24;ctx.shadowOffsetY = 14;
  traceValleyFloor(ctx);ctx.fillStyle = '#777c9e';ctx.fill();ctx.restore();
  ctx.save();traceValleyFloor(ctx);ctx.clip();
  ctx.fillStyle = '#eeeaf4';ctx.fillRect(0, 0, width, height);
  const paving = images.get('paving');
  if (ready(paving)) {
    const pattern = ctx.createPattern(paving, 'repeat');
    pattern.setTransform(new DOMMatrix().scale(.30));
    ctx.fillStyle = pattern;ctx.fillRect(0, 0, width, height);
  }
  ctx.fillStyle = floorTint(ctx);ctx.fillRect(0, 0, width, height);
  ctx.restore();
  ctx.save();traceValleyFloor(ctx);ctx.lineJoin = 'round';ctx.lineCap = 'round';
  ctx.lineWidth = 12;ctx.strokeStyle = '#9b94b3';ctx.stroke();
  ctx.lineWidth = 4;ctx.strokeStyle = '#fff9ec';ctx.stroke();ctx.restore();
}

function templeLabels(ctx) {
  ctx.save();ctx.font = '32px "Jua","Malgun Gothic",sans-serif';ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';ctx.lineJoin = 'round';ctx.lineWidth = 7;ctx.strokeStyle = '#fffaf0db';
  for (const temple of VALLEY_LAYOUT.temples) {
    const text = temple.id === 'evolution' ? '진화의 별 신전' : '성장의 별 신전';
    const y = temple.y + temple.ry - 64;
    ctx.strokeText(text, temple.x, y);ctx.fillStyle = temple.id === 'evolution' ? '#626d90' : '#947342';ctx.fillText(text, temple.x, y);
  }
  ctx.restore();
}

function paintBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#303657');gradient.addColorStop(.5, '#66658c');gradient.addColorStop(1, '#313a66');
  ctx.fillStyle = gradient;ctx.fillRect(0, 0, width, height);
  const sky = images.get('sky');
  if (ready(sky)) {
    const scale = Math.max(width / sky.naturalWidth, height / sky.naturalHeight);
    const w = sky.naturalWidth * scale, h = sky.naturalHeight * scale;
    ctx.drawImage(sky, (width - w) / 2, (height - h) / 2, w, h);
  }
  drawFloor(ctx);templeLabels(ctx);
}

export function drawValleyGround(ctx, map, time = 0) {
  const width = map?.width || VALLEY_LAYOUT.width, height = map?.height || VALLEY_LAYOUT.height;
  if (!background || background.width !== width || background.height !== height) {
    const canvas = document.createElement('canvas');canvas.width = width;canvas.height = height;
    paintBackground(canvas.getContext('2d'), width, height);background = canvas;
  }
  ctx.drawImage(background, 0, 0);
  // 은하수의 작은 빛만 느리게 흘립니다. 바닥과 원화는 계속 캐시를 사용합니다.
  const t=reducedMotion?.matches?0:Number(time)||0;
  ctx.save();ctx.fillStyle='#f9f4ff';
  for(let i=0;i<30;i++){
    const u=(i/30+t/180000)%1,x=width*(.13+.76*u),y=height*(.12+.78*u)+Math.sin(i*2.1)*75;
    if(onValleyFloor({id:'milky-valley'},x,y,0))continue;
    ctx.globalAlpha=reducedMotion?.matches ? .45 : .32+.2*Math.sin(t/1900+i);
    ctx.beginPath();ctx.arc(x,y,1.5+i%3*.5,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

// 실제 공유 바닥 경로를 그대로 축소하며 장식 원이나 개별 다리 선을 덧그리지 않습니다.
export function drawValleyMiniFloor(ctx) {
  ctx.save();ctx.fillStyle = '#3e436c';ctx.fillRect(0, 0, VALLEY_LAYOUT.width, VALLEY_LAYOUT.height);
  traceValleyFloor(ctx);ctx.fillStyle = floorTint(ctx, true);ctx.fill();
  ctx.strokeStyle = '#aaa5c4';ctx.lineWidth = 12;ctx.lineJoin = 'round';ctx.stroke();ctx.restore();
}

export function drawValleyAltar(ctx, object, time = 0) {
  if (!object || !['evolution', 'growth'].includes(object.kind)) return false;
  const golden = object.kind === 'growth', radius = Math.max(1, Number(object.radius) || 65);
  const x = object.x, y = object.y, image = images.get(object.kind);
  const width = radius * (220 / 65), height = radius * (275 / 65), footY = y + radius * .45;
  let orbX = x, orbY = y - radius * 1.8;
  ctx.save();
  // 받침대 원화의 바닥을 footY에 붙이고 떠 보이게 하는 별도 타원 그림자는 그리지 않습니다.
  if (ready(image)) {
    const art = altarArt[object.kind], [sx, sy, sw, sh] = art.crop;
    const sourceX = image.naturalWidth / art.width, sourceY = image.naturalHeight / art.height;
    const scale = Math.min(width / sw, height / sh), w = sw * scale, h = sh * scale;
    ctx.drawImage(image, sx * sourceX, sy * sourceY, sw * sourceX, sh * sourceY, x - w / 2, footY - h, w, h);
    orbX = x - w / 2 + (art.orb[0] - sx) * scale;
    orbY = footY - h + (art.orb[1] - sy) * scale;
  } else {
    ctx.fillStyle = golden ? '#cfb77c' : '#b5bed2';ctx.beginPath();ctx.roundRect(x - radius * .3, y - radius * 1.3, radius * .6, radius * 1.7, radius * .12);ctx.fill();
    ctx.fillStyle = golden ? '#f5d688' : '#edf1ff';ctx.beginPath();ctx.ellipse(x, footY - 5, radius * .8, radius * .19, 0, 0, Math.PI * 2);ctx.fill();
    ctx.beginPath();ctx.arc(x, y - radius * 1.8, radius * .65, 0, Math.PI * 2);ctx.fill();
  }
  // 구슬 근처의 작은 고정 점만 천천히 반짝이며, 모션 감소 설정에서는 정지합니다.
  const t = reducedMotion?.matches ? 0 : (Number(time) || 0);
  for (const [index, [dx, dy]] of [[-.25, -.1], [.15, -.22], [.36, .16]].entries()) {
    ctx.globalAlpha = reducedMotion?.matches ? .55 : .5 + Math.sin(t / 1700 + index * 2) * .2;
    ctx.fillStyle = golden ? '#fff6cf' : '#ffffff';ctx.shadowColor = golden ? '#ffe1a1' : '#e9f5ff';ctx.shadowBlur = 6;
    ctx.beginPath();ctx.arc(orbX + dx * radius, orbY + dy * radius, 1.8 + index * .25, 0, Math.PI * 2);ctx.fill();
  }
  ctx.globalAlpha = 1;ctx.shadowBlur = 0;
  ctx.font = '20px "Jua","Malgun Gothic",sans-serif';ctx.textAlign = 'center';ctx.lineJoin = 'round';ctx.lineWidth = 5;
  const label = object.name || (golden ? '성장의 별' : '진화의 별');
  ctx.strokeStyle = '#fff9ece0';ctx.strokeText(label, x, y + radius + 30);
  ctx.fillStyle = golden ? '#886c3f' : '#66718e';ctx.fillText(label, x, y + radius + 30);
  ctx.restore();return true;
}
