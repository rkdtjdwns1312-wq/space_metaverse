// 화면과 서버가 공유하는 수치. 서버는 클라이언트가 보낸 설정을 신뢰하지 않습니다.
export const RULES = Object.freeze({ maxPlayers: 30, maxRooms: 10, tickMs: 50, broadcastMs: 100,
  speed: 155, radius: 16, reconnectMs: 60_000, inputExpiryMs: 300 });
// 상호작용: 행성·문 가장자리에서 이 거리 안에 있으면 살펴보기/나가기를 할 수 있습니다. 서버도 같은 값으로 검사합니다.
export const INTERACT = Object.freeze({ radius: 40 });
// 행성 규칙 편집 한도(선생님만 고칠 수 있음).
export const DEPARTMENT_RULES = Object.freeze({ maxLines: 8, maxLineLength: 40 });
// 행성(부서)은 아이들이 직접 만듭니다. 학생이 지도에서 자리를 고르고 이름·소개·색을 정해 신청하면 선생님이 승인합니다.
// 선생님은 바로 만들 수도, 없앨 수도 있습니다. 이름은 소속 학생들의 과반 투표로 바꿀 수 있습니다.
export const PLANET = Object.freeze({ radius: 60, minGap: 30, maxPerRoom: 12, maxPending: 6,
  nameMin: 2, nameMax: 10, descriptionMax: 40, defaultRules: ['서로 존중하고 친절하게 말해요'] });
export const PLANET_COLORS = Object.freeze(['#98dfd2', '#f5bace', '#b5c6f6', '#f5d798', '#c9e7a8', '#f7c8a8', '#d9c6f2', '#a8dff2']);
// 광장의 고정 오브젝트는 가운데 별 하나뿐입니다. 행성은 방마다 다르게 생기므로 mapOf(mapId, planets)로 합쳐서 씁니다.
export const MAP = Object.freeze({ id: 'space-plaza', name: '우리들의 우주 광장', width: 1200, height: 760,
  objects: [ { id: 'square', name: '모여라, 빛나는 별', x: 600, y: 170, radius: 58, color: '#ffe59b', kind: 'star' } ] });
export const PLAZA_ID = MAP.id;
// 선생님이 교실을 만들 때 '예시 행성으로 시작'을 켜면 아래 4개가 미리 놓입니다. 이름·규칙은 예시일 뿐이며 나중에 바꿀 수 있습니다.
export const EXAMPLE_PLANETS = Object.freeze([
  { name: '독서행성', x: 190, y: 175, color: '#98dfd2', description: '책을 아끼고 함께 읽는 친구들의 행성이에요.',
    rules: ['읽은 책은 제자리에 꽂아요', '책을 읽는 동안에는 조용히 해요', '빌린 책은 일주일 안에 돌려줘요'] },
  { name: '일기행성', x: 1010, y: 175, color: '#f5bace', description: '하루를 기록하고 마음을 나누는 친구들의 행성이에요.',
    rules: ['일기는 매일 한 줄 이상 써요', '친구의 일기는 허락 없이 보지 않아요', '일기장은 정해진 자리에 제출해요'] },
  { name: '청소행성', x: 190, y: 565, color: '#b5c6f6', description: '교실을 반짝이게 만드는 친구들의 행성이에요.',
    rules: ['줄을 서지 않으면 경고를 받아요', '청소 도구는 쓴 뒤 제자리에 둬요', '내 자리는 내가 정리해요'] },
  { name: '교과행성', x: 1010, y: 565, color: '#f5d798', description: '수업을 준비하고 서로 가르쳐 주는 친구들의 행성이에요.',
    rules: ['수업 준비물을 미리 챙겨요', '모르는 것은 손을 들고 물어봐요', '친구가 물어보면 친절하게 알려줘요'] }
]);
// 행성 내부 맵 템플릿: 광장과 같은 크기의 작은 방. 위에는 규칙 게시판(충돌), 아래에는 광장으로 나가는 문(통과 가능).
export const INTERIOR = Object.freeze({ width: 1200, height: 760, spawn: { x: 600, y: 560 },
  objects: [
    { id: 'board', name: '행성 규칙 게시판', x: 600, y: 150, radius: 80, kind: 'board', color: '#fff6d6' },
    { id: 'door', name: '광장으로 나가는 문', x: 600, y: 690, radius: 34, kind: 'door', color: '#d9d3f2', passable: true }
  ] });
export const interiorIdOf = planetId => 'planet:' + planetId;
export const planetIdOfMap = mapId => (typeof mapId === 'string' && mapId.startsWith('planet:')) ? mapId.slice(7) : null;
// planets: 그 방의 행성 목록(배열 또는 Map의 values). 광장이면 별 + 행성들이 오브젝트가 되고, 내부 맵이면 템플릿에 행성 정보를 얹습니다.
export function mapOf(mapId, planets = []) {
  const list = Array.isArray(planets) ? planets : [...planets];
  const planetId = planetIdOfMap(mapId);
  if (!planetId) return { ...MAP, objects: [...MAP.objects, ...list] };
  const planet = list.find(p => p.id === planetId);
  return { ...INTERIOR, id: mapId, planetId, name: (planet ? planet.name : '행성') + ' 안', color: planet ? planet.color : '#d9d3f2' };
}
// 아직 성장/장비 동작은 구현하지 않습니다. 그림 교체와 후속 단계 연결을 위한 계약입니다.
export const PROGRESSION = Object.freeze({ maxLevel: 5, nextLevelXp: [15, 20, 25, 30], constellationSlots: 16 });
export function createAvatar() {
  return { form: 'asteroid', level: 1, xp: 0, constellationId: null,
    equipment: { pet: null, mount: null, decoration: null }, departmentId: null };
}
// 향후 인벤토리 항목: { id, name, description, icon, quantity, type, level }.
// 향후 별 파편 잔액은 0 이상의 안전한 정수로, 지급/지출은 서버에서 검증합니다.
export const CHAT = Object.freeze({ maxLength: 120, historySize: 50, cooldownMs: 700, bubbleMs: 4000 });
