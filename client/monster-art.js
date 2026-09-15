const PATHS = {
  rabbit: [[-12,-18],[-17,-30],[-8,-24],[0,-18],[12,-18],[17,-30],[20,-8],[15,12],[0,20],[-15,12],[-20,-8]],
  squirrel: [[-16,-10],[-24,-22],[-20,-30],[-8,-20],[0,-18],[17,-10],[20,8],[8,20],[-10,18],[-20,5]],
  turtle: [[-21,-3],[-16,-15],[0,-20],[16,-15],[21,-3],[14,15],[0,20],[-14,15]],
  hedgehog: [[-23,8],[-25,-5],[-18,-11],[-14,-20],[-7,-14],[0,-22],[7,-14],[17,-19],[15,-10],[24,-5],[18,12],[0,20],[-17,13]],
  butterfly: [[0,-2],[-20,-20],[-24,-5],[-15,8],[0,3],[15,8],[24,-5],[20,-20],[0,-2],[0,20]],
  lion: [[-19,-10],[-20,-23],[-9,-18],[0,-25],[9,-18],[20,-23],[19,-8],[25,0],[17,8],[19,20],[5,16],[0,24],[-7,16],[-20,20],[-17,8],[-25,0]],
  tiger: [[-18,-15],[-9,-23],[0,-18],[9,-23],[18,-15],[20,8],[9,20],[-9,20],[-20,8]],
  wolf: [[-20,-8],[-18,-24],[-7,-18],[0,-22],[10,-18],[20,-25],[19,-7],[14,14],[0,21],[-15,14]],
  fox: [[-17,-9],[-19,-25],[-5,-18],[8,-21],[20,-12],[14,9],[3,20],[-14,13],[-23,2]],
  leopard: [[-19,-12],[-10,-22],[0,-18],[11,-22],[20,-10],[18,10],[7,20],[-9,19],[-20,8]],
  'star-keeper': [[-7,-12],[-12,-24],[0,-31],[12,-24],[7,-12],[13,3],[24,-4],[26,2],[12,10],[7,20],[-7,20],[-12,10],[-26,2],[-24,-4],[-13,3]],
  bear: [[-19,-9],[-18,-22],[-7,-19],[0,-23],[8,-19],[19,-22],[20,-8],[17,13],[7,21],[-7,21],[-17,13]],
  elephant: [[-18,-10],[-17,-22],[-7,-18],[4,-20],[18,-12],[18,2],[10,17],[-4,18],[-14,10],[-3,4],[3,5],[10,0],[9,27],[3,30],[0,24]],
  whale: [[-25,0],[-18,-15],[-3,-20],[13,-15],[25,-3],[14,14],[-2,20],[-17,14],[-28,8],[-20,5]],
  giraffe: [[-15,20],[-12,5],[-9,-4],[-8,-25],[-2,-31],[5,-25],[5,-5],[14,-1],[20,8],[15,20],[5,18],[0,10],[-5,20]]
};

const line = (ctx, points, x, y, scale) => { ctx.beginPath(); points.forEach(([px, py], i) => i ? ctx.lineTo(x + px * scale, y + py * scale) : ctx.moveTo(x + px * scale, y + py * scale)); ctx.closePath(); ctx.fill(); ctx.stroke(); };
const star = (ctx, x, y, r) => { ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; const px = x + Math.cos(a) * r; const py = y + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill(); };

export function drawMonster(ctx, monster, time = 0) {
  if (!ctx || !monster) return;
  const x = Number(monster.x) || 0; const y = Number(monster.y) || 0; const radius = Number(monster.radius) || 24; const scale = radius / 32;
  const fill = monster.color || '#cbd5ff';
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, radius * 0.09); ctx.strokeStyle = '#201c3a'; ctx.fillStyle = fill;
  line(ctx, PATHS[monster.shape] || PATHS.rabbit, x, y, scale);
  ctx.fillStyle = '#fff8e8'; ctx.strokeStyle = '#201c3a';
  ctx.beginPath(); ctx.arc(x - radius * .27, y - radius * .12, radius * .1, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(x + radius * .27, y - radius * .12, radius * .1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#201c3a'; ctx.beginPath(); ctx.arc(x - radius * .27, y - radius * .12, radius * .04, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + radius * .27, y - radius * .12, radius * .04, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff4a8'; ctx.fillStyle = '#fff4a8'; ctx.lineWidth = Math.max(1.5, radius * .055);
  const points = [[-.55,-.55],[-.05,-.78],[.45,-.55],[-.28,.18],[.28,.2]]; points.forEach(([dx,dy], i) => { if (i) { ctx.beginPath(); ctx.moveTo(x + points[i-1][0]*radius, y + points[i-1][1]*radius); ctx.lineTo(x + dx*radius, y + dy*radius); ctx.stroke(); } star(ctx, x + dx*radius, y + dy*radius, radius * .07); });
  if (monster.busy) { ctx.strokeStyle = '#a9f0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, radius * 1.2, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}
