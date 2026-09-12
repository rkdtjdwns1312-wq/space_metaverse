import { randomUUID } from 'node:crypto';
import { MAP, RULES, INTERACT, PLAZA_ID, PLANET, mapOf } from '../shared/config.js';
export function isFree(room, x, y, ignoreId = null, mapId = PLAZA_ID) {
  const r = RULES.radius, map = mapOf(mapId, room.planets.values());
  if (x < r || y < r || x > map.width-r || y > map.height-r) return false;
  if (map.objects.some(o => !o.passable && Math.hypot(x-o.x, y-o.y) < r+o.radius)) return false;
  return ![...room.players.values()].some(p => p.id !== ignoreId && p.mapId === mapId && Math.hypot(x-p.x, y-p.y) < r*2+2);
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
// spawn/문 근처 좌표를 중심으로 반지름을 0, 42, 84...로 늘리며 8방향에서 빈 자리를 찾습니다.
function nearestFree(room, cx, cy, mapId) {
  if (isFree(room, cx, cy, null, mapId)) return {x:cx, y:cy};
  for (let radius=42; radius<2000; radius+=42)
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const x=cx+dx*radius, y=cy+dy*radius;
      if (isFree(room, x, y, null, mapId)) return {x,y};
    }
  return null;
}
export function spawnInside(room, mapId) {
  const map = mapOf(mapId, room.planets.values()), pos = nearestFree(room, map.spawn.x, map.spawn.y, mapId);
  if (!pos) throw new Error('안전하게 들어갈 자리가 없습니다.');
  return pos;
}
export function exitPosition(room, planet) {
  const pos = nearestFree(room, planet.x, planet.y+planet.radius+RULES.radius+12, PLAZA_ID);
  if (!pos) throw new Error('안전하게 들어갈 자리가 없습니다.');
  return pos;
}
export function isNear(player, object) {
  return Math.hypot(player.x-object.x, player.y-object.y) <= object.radius+RULES.radius+INTERACT.radius;
}
// 광장 경계 안이고 별·행성·대기 신청 어느 것과도 겹치지 않는 자리인지 검사합니다.
export function placementFree(room, x, y) {
  const r = PLANET.radius + RULES.radius;
  if (x < r || y < r || x > MAP.width-r || y > MAP.height-r) return false;
  const bodies = [...MAP.objects, ...room.planets.values(), ...room.proposals.values()];
  return !bodies.some(o => Math.hypot(x-o.x, y-o.y) < PLANET.radius+o.radius+PLANET.minGap);
}
// 행성을 만들고 room.planets에 등록합니다. 방금 생긴 행성 자리에 서 있던 광장의 플레이어는 갇히지 않도록 밖으로 내보냅니다.
export function addPlanet(room, {name, description, x, y, color, rules, createdBy=null}) {
  const planet = { id: randomUUID(), name, description, x, y, radius: PLANET.radius, color, kind: 'planet',
    rules: [...rules], createdBy, createdAt: Date.now(), rename: null };
  room.planets.set(planet.id, planet);
  for (const p of room.players.values())
    if (p.mapId === PLAZA_ID && Math.hypot(p.x-planet.x, p.y-planet.y) < planet.radius+RULES.radius)
      Object.assign(p, exitPosition(room, planet));
  return planet;
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
    if (isFree(room,p.x+dx,p.y,p.id,p.mapId)) p.x+=dx;
    if (isFree(room,p.x,p.y+dy,p.id,p.mapId)) p.y+=dy;
  }
}
