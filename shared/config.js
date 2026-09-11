// 화면과 서버가 공유하는 수치. 서버는 클라이언트가 보낸 설정을 신뢰하지 않습니다.
export const RULES = Object.freeze({ maxPlayers: 30, maxRooms: 10, tickMs: 50, broadcastMs: 100,
  speed: 155, radius: 16, reconnectMs: 60_000, inputExpiryMs: 300 });
export const MAP = Object.freeze({ id: 'space-plaza', name: '우리들의 우주 광장', width: 1200, height: 760,
  objects: [
    { id: 'reading', name: '독서행성', x: 190, y: 175, radius: 65, color: '#98dfd2', kind: 'planet' },
    { id: 'diary', name: '일기행성', x: 1010, y: 175, radius: 61, color: '#f5bace', kind: 'planet' },
    { id: 'cleaning', name: '청소행성', x: 190, y: 565, radius: 59, color: '#b5c6f6', kind: 'planet' },
    { id: 'subject', name: '교과행성', x: 1010, y: 565, radius: 63, color: '#f5d798', kind: 'planet' },
    { id: 'square', name: '모여라, 빛나는 별', x: 600, y: 170, radius: 58, color: '#ffe59b', kind: 'star' }
  ] });
// 아직 성장/장비 동작은 구현하지 않습니다. 그림 교체와 후속 단계 연결을 위한 계약입니다.
export const PROGRESSION = Object.freeze({ maxLevel: 5, nextLevelXp: [15, 20, 25, 30], constellationSlots: 16 });
export function createAvatar() {
  return { form: 'asteroid', level: 1, xp: 0, constellationId: null,
    equipment: { pet: null, mount: null, decoration: null }, departmentId: null };
}
// 향후 인벤토리 항목: { id, name, description, icon, quantity, type, level }.
// 향후 별 파편 잔액은 0 이상의 안전한 정수로, 지급/지출은 서버에서 검증합니다.
