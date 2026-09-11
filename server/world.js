import { MAP, RULES } from '../shared/config.js';
export function isFree(room, x, y, ignoreId = null) {
  const r = RULES.radius;
  if (x < r || y < r || x > MAP.width-r || y > MAP.height-r) return false;
  if (MAP.objects.some(o => Math.hypot(x-o.x, y-o.y) < r+o.radius)) return false;
  return ![...room.players.values()].some(p => p.id !== ignoreId && Math.hypot(x-p.x, y-p.y) < r*2+2);
}
export function spawnPosition(room) {
  // 광장 아래부터 일정 간격으로 탐색하여 새 아바타가 서로 겹치지 않게 합니다.
  for (let y=340; y<MAP.height-40; y+=42)
    for (let x=390; x<850; x+=42)
      if (isFree(room,x,y)) return {x,y};
  for (let y=40; y<MAP.height; y+=42)
    for (let x=40; x<MAP.width; x+=42)
      if (isFree(room,x,y)) return {x,y};
  throw new Error('안전하게 입장할 자리가 없습니다.');
}
export function advance(room, now) {
  // 실제 경과 시간이나 클라이언트 좌표 대신 고정 서버 tick으로 속도를 제한합니다.
  if (![...room.players.values()].some(p => p.role==='teacher' && p.connected)) return;
  for (const p of room.players.values()) {
    if (!p.connected || now-p.input.at>RULES.inputExpiryMs) continue;
    const length=Math.hypot(p.input.x,p.input.y);
    if (!length) continue;
    const step=RULES.speed*RULES.tickMs/1000;
    const dx=p.input.x/length*step, dy=p.input.y/length*step;
    if (isFree(room,p.x+dx,p.y,p.id)) p.x+=dx;
    if (isFree(room,p.x,p.y+dy,p.id)) p.y+=dy;
  }
}
