// 화면과 서버가 공유하는 수치. 서버는 클라이언트가 보낸 설정을 신뢰하지 않습니다.
// speed: 초당 이동 픽셀. 2026-09-15 큰 맵에 맞춰 310 → 620(2배).
// 한 tick(50ms)에 31px로 아바타 충돌 간격 34px보다 작습니다.
export const RULES = Object.freeze({ maxPlayers: 30, maxRooms: 10, tickMs: 50, broadcastMs: 100,
  speed: 620, radius: 16, reconnectMs: 60_000, inputExpiryMs: 300 });
// 상호작용: 행성·문 가장자리에서 이 거리 안에 있으면 살펴보기/나가기를 할 수 있습니다. 서버도 같은 값으로 검사합니다.
export const INTERACT = Object.freeze({ radius: 40 });
// 행성 규칙 편집 한도(소속 친구와 선생님이 내부 규칙판 근처에서 수정).
export const DEPARTMENT_RULES = Object.freeze({ maxLines: 8, maxLineLength: 40 });
export const WARNING_RULES = Object.freeze({defaultThreshold:3,minThreshold:1,maxThreshold:10,maxReasonLength:120,maxEntries:3000});
// 행성(부서)은 아이들이 직접 만듭니다. 학생이 지도에서 자리를 고르고 이름·소개·색을 정해 신청하면 선생님이 승인합니다.
// 선생님은 바로 만들 수도, 없앨 수도 있습니다. 이름은 소속 학생들의 과반 투표로 바꿀 수 있습니다.
// reserved: 행성을 만들 수 없는 자리. 화면 왼쪽 아래 터치 이동 버튼이 지도를 덮는 곳이라 행성이 가려지지 않게 비워 둡니다.
export const PLANET = Object.freeze({ radius: 60, minGap: 80, maxPerRoom: 48, maxPending: 12,
  nameMin: 2, nameMax: 10, descriptionMax: 40, defaultRules: ['서로 존중하고 친절하게 말해요'],
  reserved: [{ x: 0, y: 640, width: 240, height: 120, label: '쉼터 자리' },
    {x:630,y:300,width:900,height:700,label:'별들의 신전'}] });
// 행성 색 팔레트. 뒤의 8색은 행성 종류(PLANET_TEMPLATES)의 기본색으로, 종류를 고르면 자동 선택됩니다. 목록에 없는 색은 서버가 거부합니다.
export const PLANET_COLORS = Object.freeze(['#98dfd2', '#f5bace', '#b5c6f6', '#f5d798', '#c9e7a8', '#f7c8a8', '#d9c6f2', '#a8dff2',
  '#c5c9f7', '#ffd2a8', '#ffe0b5', '#cfd8e6', '#f7e39b', '#f9c6e0', '#ffcfa3', '#bfe3d6']);
// 광장의 고정 오브젝트는 가운데 별과 오른쪽의 '오색별빛 쉼터로 가는 문'입니다. 행성은 방마다 다르게 생기므로 mapOf(mapId, planets)로 합쳐서 씁니다.
// gate: 통과 가능한 문. 가까이에서 이동하면 target 맵의 arrival 좌표 근처에 도착합니다.
export const MAP = Object.freeze({ id: 'space-plaza', name: '별의 기원', width: 2160, height: 1440, spawn:{x:1080,y:800},
  objects: [
    { id: 'square', name: '별들의 쉼터', x: 1080, y: 540, radius: 58, color: '#ffe59b', kind: 'star' },
    {id:'pillar-notice',name:'오늘의 알림장',x:760,y:594,radius:30,kind:'pillar',service:'notice',color:'#f4d9ea'},
    {id:'pillar-effects',name:'사용 중인 아이템',x:1400,y:594,radius:30,kind:'pillar',service:'effects',color:'#dacff6'},
    {id:'pillar-timetable',name:'오늘의 시간표',x:790,y:804,radius:30,kind:'pillar',service:'timetable',color:'#c9e8e0'},
    {id:'pillar-weekly',name:'이번 주 받은 별',x:1370,y:804,radius:30,kind:'pillar',service:'weekly',color:'#ffedbb'},
    { id: 'gate-street', name: '오색별빛 쉼터로 가는 문', x: 2080, y: 720, radius: 38, kind: 'gate', target: 'star-street',
      arrival: { x: 170, y: 380 }, color: '#d9c6f2', passable: true },
    { id: 'gate-garden', name: '← 태양이 머무는 낙원', x: 80, y: 720, radius: 38, kind: 'gate', target:'moon-garden',
      arrival:{x:1030,y:380},color:'#bdeade',passable:true },
    {id:'gate-valley',name:'은하수계곡 ↓',x:1080,y:1360,radius:38,kind:'gate',target:'milky-valley',arrival:{x:600,y:180},color:'#c5cff8',passable:true},
    {id:'gate-origin',name:'별의 시작점 1 ↑',x:1080,y:80,radius:38,kind:'gate',target:'star-origin-1',arrival:{x:600,y:740},color:'#d2d3ef',passable:true},
    {id:'assignment-andromeda',name:'과제안드로메다',x:260,y:260,radius:240,kind:'andromeda',passable:true},
    {id:'black-hole-portal',name:'블랙홀 입장',x:1900,y:260,radius:240,kind:'black-hole',target:'black-hole',arrival:{x:600,y:390},passable:true}
  ] });
export const PLAZA_ID = MAP.id;
// 두 번째 맵 '오색별빛 쉼터': 별상점이 있는 거리. 왼쪽 문으로 광장에 돌아갑니다. 행성은 만들 수 없습니다.
export const STREET = Object.freeze({ id: 'star-street', name: '오색별빛 쉼터', width: 1200, height: 760, spawn: { x: 170, y: 380 },
  objects: [
    { id: 'gate-plaza', name: '별의 기원으로 가는 문', x: 80, y: 380, radius: 38, kind: 'gate', target: 'space-plaza',
      arrival: { x: 1990, y: 720 }, color: '#d9c6f2', passable: true },
    { id: 'shop', name: '별 상점', x: 600, y: 600, radius: 72, kind: 'shop', color: '#ffe59b' },
    ...[
      ['memory','별 그림 짝 맞추기','#f2badb'],['baseball','숫자야구','#b8d6fa'],
      ['stars','반짝별 찾기','#ffdf9c'],['addition','숫자놀이터','#bce8cd'],['dodge','별 피하기','#cfbcf1']
    ].map(([gameId,name,color],i)=>({id:'arcade-'+gameId,gameId,name,color,x:240+i*180,y:150,radius:32,kind:'arcade'})),
    { id: 'lamp-left', name: '별빛 가로등', x: 380, y: 560, radius: 22, kind: 'lamp', color: '#fff2c9', passable: true },
    { id: 'lamp-right', name: '별빛 가로등', x: 820, y: 560, radius: 22, kind: 'lamp', color: '#fff2c9', passable: true }
  ] });
export const STREET_ID = STREET.id;
export const GARDEN = Object.freeze({id:'moon-garden',name:'태양이 머무는 낙원',width:1200,height:760,spawn:{x:1030,y:380},objects:[
  {id:'gate-plaza',name:'중앙광장 →',x:1120,y:380,radius:38,kind:'gate',target:PLAZA_ID,arrival:{x:170,y:720},color:'#d9c6f2',passable:true}
]});
export const GARDEN_ID=GARDEN.id;
export const VALLEY = Object.freeze({id:'milky-valley',name:'은하수계곡',width:1200,height:900,spawn:{x:600,y:180},objects:[
  {id:'evolution-star',name:'진화의 별',x:205,y:480,radius:105,kind:'evolution',color:'#ffffff'},
  {id:'growth-star',name:'성장의 별',x:1020,y:480,radius:80,kind:'growth',color:'#ffd76d'},
  {id:'gate-plaza',name:'별의 기원 ↑',x:600,y:80,radius:38,kind:'gate',target:PLAZA_ID,arrival:{x:1080,y:1270},color:'#f4deaa',passable:true}
]});
export const VALLEY_ID=VALLEY.id;
export const BLACK_HOLE = Object.freeze({id:'black-hole',name:'블랙홀 내부',theme:'black-hole',width:1200,height:760,spawn:{x:600,y:390},objects:[
  {id:'black-hole-star',name:'검은별',x:600,y:250,radius:80,kind:'black-star',passable:true},
  {id:'black-hole-exit',name:'블랙홀 밖으로 나가기',x:600,y:680,radius:42,kind:'gate',target:PLAZA_ID,arrival:{x:1560,y:560},passable:true}
]});
export const BLACK_HOLE_ID=BLACK_HOLE.id;
// 위쪽 맵은 1→2→3으로 이어지며, 아래 문은 바로 전 맵으로 돌아옵니다.
export const ORIGIN_MAPS=Object.freeze([1,2,3].map(n=>Object.freeze({id:'star-origin-'+n,name:'별의 시작점 '+n,theme:'star-origin',
  width:1200,height:900,spawn:{x:600,y:740},objects:[
    {id:'gate-back',name:(n===1?'별의 기원':'별의 시작점 '+(n-1))+' ↓',x:600,y:820,radius:38,kind:'gate',
      target:n===1?PLAZA_ID:'star-origin-'+(n-1),arrival:n===1?{x:1080,y:175}:{x:600,y:175},color:'#d2d3ef',passable:true},
    ...(n<3?[{id:'gate-next',name:'별의 시작점 '+(n+1)+' ↑',x:600,y:80,radius:38,kind:'gate',target:'star-origin-'+(n+1),arrival:{x:600,y:740},color:'#e0d6ff',passable:true}]:[])
  ]})));
export const STATIC_MAPS = Object.freeze({ [MAP.id]: MAP, [STREET.id]: STREET,[GARDEN.id]:GARDEN,[VALLEY.id]:VALLEY,[BLACK_HOLE.id]:BLACK_HOLE,...Object.fromEntries(ORIGIN_MAPS.map(m=>[m.id,m])) });
// 별 파편: 선생님이 나누어 주는 기본 재화(0 이상의 정수). 파밍으로는 얻지 않습니다.
export const SHARDS = Object.freeze({ max: 9999, giveMax: 999 });
// 별상점 목록. 사는 값은 price, 파는 값은 floor(price * sellRate).
// level: 아바타가 그 레벨 이상이어야 '사용'할 수 있습니다(구매는 레벨과 관계없이 됨). 지금은 모두 LV1이라 LV1 물건만 쓸 수 있습니다.
// targets: 'self'면 나에게만, 'any'면 친구에게도 쓸 수 있습니다. 낮은 레벨이 높은 레벨 친구에게는 쓸 수 없습니다(선생님은 LV5로 취급).
// secret: true면 누가 썼는지 친구들에게는 비밀('누군가')이고 선생님에게만 보입니다.
// effect: 사용하면 대상에게 붙는 표시(아이콘·이름·지속 시간). 지금은 겉모습 표시만 하고 이동 속도 등 실제 능력치는 바꾸지 않습니다.
// maxKinds 20 = 가방 격자 5×4칸(한 칸에 한 종류). BAG는 화면 격자 크기입니다.
export const BAG = Object.freeze({ columns: 5, rows: 4 });
export const SHOP = Object.freeze({ sellRate: 0.5, maxStack: 99, maxKinds: 20, items: [
  { id: 'star-sticker', name: '반짝 별 스티커', description: '친구 소행성에 붙여 주는 작은 별 스티커예요.', icon: '⭐', type: 'decoration', level: 1, price: 5,
    targets: 'any', secret: false, effect: { label: '반짝반짝', icon: '⭐', durationMs: 30 * 60_000, style: 'sparkle' } },
  { id: 'space-snack', name: '우주 간식', description: '달콤한 별사탕이에요. 누가 줬는지는 비밀!', icon: '🍬', type: 'consumable', level: 1, price: 3,
    targets: 'any', secret: true, effect: { label: '냠냠 행복', icon: '🍬', durationMs: 5 * 60_000, style: 'happy' } },
  { id: 'asteroid-helmet', name: '소행성 헬멧', description: '튼튼하고 귀여운 우주 헬멧이에요.', icon: '🪖', type: 'decoration', level: 1, price: 6,
    targets: 'any', secret: false, effect: { label: '튼튼 헬멧', icon: '🪖', durationMs: 30 * 60_000, style: 'helmet' } },
  { id: 'firefly-lamp', name: '반딧불 램프', description: '어두운 우주를 밝혀 주는 램프예요.', icon: '🏮', type: 'tool', level: 1, price: 8,
    targets: 'any', secret: false, effect: { label: '반딧불 빛', icon: '🏮', durationMs: 10 * 60_000, style: 'glow' } },
  { id: 'rainbow-tail', name: '무지개 꼬리', description: '움직일 때 무지개가 따라와요. (LV2부터)', icon: '🌈', type: 'decoration', level: 2, price: 12,
    targets: 'self', secret: false, effect: { label: '무지개 꼬리', icon: '🌈', durationMs: 30 * 60_000, style: 'trail' } },
  { id: 'mini-satellite', name: '작은 위성 친구', description: '내 곁을 빙글빙글 도는 귀여운 위성이에요. (LV2부터)', icon: '🛰️', type: 'pet', level: 2, price: 15,
    targets: 'self', secret: false, effect: { label: '위성 친구', icon: '🛰️', durationMs: 60 * 60_000, style: 'orbit' } },
  { id: 'starlight-cape', name: '별빛 망토', description: '별빛으로 짠 반짝이는 망토예요. (LV3부터)', icon: '🧣', type: 'decoration', level: 3, price: 25,
    targets: 'any', secret: false, effect: { label: '별빛 망토', icon: '🧣', durationMs: 30 * 60_000, style: 'cape' } },
  { id: 'meteor-board', name: '유성 보드', description: '유성을 타고 씽씽 달려요. 누가 태워 줬는지는 비밀! (LV3부터)', icon: '☄️', type: 'mount', level: 3, price: 30,
    targets: 'any', secret: true, effect: { label: '유성 질주', icon: '☄️', durationMs: 3 * 60_000, style: 'speed' } }
] });
// 아이템 사용 규칙: 연속 사용 간격, 한 사람이 동시에 가질 수 있는 효과 수(넘치면 오래된 것부터 사라짐), 선생님용 사용 기록 보관 수, 선생님의 취급 레벨.
export const ITEM_USE = Object.freeze({ cooldownMs: 2000, maxEffects: 3, logSize: 100, teacherLevel: 5, notesSize: 20 });
// 거래: 학생끼리 별 파편·아이템을 주고받을 수 있지만, 상대가 수락한 뒤 선생님이 최종 승인해야 실제로 오갑니다.
// (힘 있는 아이가 약한 아이의 것을 강제로 뺏는 일을 막기 위한 장치입니다.) 한 사람은 한 번에 하나의 거래만 진행합니다.
// declineBlockMs: 상대가 거절하면 같은 상대에게 그 시간 동안 다시 제안할 수 없습니다(계속 조르기 방지).
export const TRADE = Object.freeze({ maxPending: 10, maxItemKinds: 5, maxShards: 999, declineBlockMs: 5 * 60_000 });
export const ITEM_TYPES = Object.freeze({ decoration: '꾸미기', consumable: '간식', tool: '도구', pet: '펫', mount: '탈것' });
export const itemOf = itemId => SHOP.items.find(i => i.id === itemId) || null;
// 만들 수 있는 행성 종류(2026-09-12 사용자 지정 13종). 아이들은 이 목록에서 골라 행성을 만들고, 이름은 2~10자 안에서 바꿀 수 있습니다.
// look: 화면이 종류에 맞게 다르게 그리는 모양 스타일. icon: 행성 가운데에 그리는 그림 글자. 추후 아이들이 직접 그린 디자인(이미지)을 붙이는 기능을 붙일 자리는 image(현재 null)입니다.
export const PLANET_TEMPLATES = Object.freeze([
  { id: 'diary', name: '일기행성', icon: '📔', color: '#f5bace', look: 'ribbon', image: null,
    description: '하루를 기록하고 마음을 나누는 친구들의 행성이에요.',
    rules: ['일기는 매일 한 줄 이상 써요', '친구의 일기는 허락 없이 보지 않아요', '일기장은 정해진 자리에 제출해요'] },
  { id: 'subject', name: '교과행성', icon: '📚', color: '#f5d798', look: 'stripes', image: null,
    description: '수업을 준비하고 서로 가르쳐 주는 친구들의 행성이에요.',
    rules: ['수업 준비물을 미리 챙겨요', '모르는 것은 손을 들고 물어봐요', '친구가 물어보면 친절하게 알려줘요'] },
  { id: 'reading', name: '독서행성', icon: '📖', color: '#98dfd2', look: 'pages', image: null,
    description: '책을 아끼고 함께 읽는 친구들의 행성이에요.',
    rules: ['읽은 책은 제자리에 꽂아요', '책을 읽는 동안에는 조용히 해요', '빌린 책은 일주일 안에 돌려줘요'] },
  { id: 'rules', name: '규칙행성', icon: '📜', color: '#c5c9f7', look: 'shield', image: null,
    description: '우리 반 약속을 지키고 알려 주는 친구들의 행성이에요.',
    rules: ['약속을 어긴 친구에게는 먼저 부드럽게 알려줘요', '규칙은 모두가 함께 정해요', '경고는 누구에게나 공평하게 줘요'] },
  { id: 'pe', name: '체육행성', icon: '⚽', color: '#ffd2a8', look: 'ball', image: null,
    description: '몸을 움직이고 함께 뛰노는 친구들의 행성이에요.',
    rules: ['체육 도구는 쓴 뒤 제자리에 둬요', '준비운동을 꼭 해요', '이기고 져도 서로 박수를 쳐요'] },
  { id: 'meal', name: '급식행성', icon: '🍱', color: '#ffe0b5', look: 'plate', image: null,
    description: '맛있는 급식을 함께 준비하는 친구들의 행성이에요.',
    rules: ['차례를 지켜 줄을 서요', '음식은 먹을 만큼만 받아요', '식판은 깨끗이 정리해요'] },
  { id: 'facility', name: '시설행성', icon: '🔧', color: '#cfd8e6', look: 'bolts', image: null,
    description: '교실 물건과 시설을 돌보는 친구들의 행성이에요.',
    rules: ['고장 난 것은 바로 알려요', '물건은 소중히 다뤄요', '창문과 전등은 마지막에 확인해요'] },
  { id: 'finance', name: '재무행성', icon: '💰', color: '#f7e39b', look: 'coins', image: null,
    description: '우리 반 살림을 관리하는 친구들의 행성이에요.',
    rules: ['별 파편 기록은 정확하게 남겨요', '내 것과 반 것을 구별해요', '쓰기 전에 함께 의논해요'] },
  { id: 'counsel', name: '상담행성', icon: '💬', color: '#d9c6f2', look: 'heart', image: null,
    description: '친구의 고민을 들어 주는 친구들의 행성이에요.',
    rules: ['친구의 비밀은 지켜요', '끝까지 들어 준 다음 말해요', '힘든 친구는 선생님께 함께 가요'] },
  { id: 'cleaning', name: '청소행성', icon: '🧹', color: '#b5c6f6', look: 'sparkle', image: null,
    description: '교실을 반짝이게 만드는 친구들의 행성이에요.',
    rules: ['줄을 서지 않으면 경고를 받아요', '청소 도구는 쓴 뒤 제자리에 둬요', '내 자리는 내가 정리해요'] },
  { id: 'art', name: '예술행성', icon: '🎨', color: '#f9c6e0', look: 'splash', image: null,
    description: '그림과 만들기로 교실을 꾸미는 친구들의 행성이에요.',
    rules: ['재료는 아껴 써요', '작품은 소중히 다뤄요', '친구 작품의 좋은 점을 말해줘요'] },
  { id: 'show', name: '예능행성', icon: '🎤', color: '#ffcfa3', look: 'stars', image: null,
    description: '노래·춤·재미로 교실을 즐겁게 하는 친구들의 행성이에요.',
    rules: ['무대는 차례대로 써요', '친구를 놀리는 개그는 하지 않아요', '공연 준비는 함께 해요'] },
  { id: 'audit', name: '감찰행성', icon: '🔍', color: '#bfe3d6', look: 'eye', image: null,
    description: '교실이 공정하게 돌아가는지 살펴보는 친구들의 행성이에요.',
    rules: ['본 것만 정확하게 말해요', '친구를 몰래 지켜보지 않아요', '문제는 선생님께 먼저 알려요'] }
]);
export const templateOf = templateId => PLANET_TEMPLATES.find(t => t.id === templateId) || null;
// 선생님이 교실을 만들 때 '예시 행성으로 시작'을 켜면 아래 4개가 종류 목록의 값으로 미리 놓입니다. 이름·규칙은 나중에 바꿀 수 있습니다.
const example = (templateId, x, y) => { const t = templateOf(templateId); return { templateId, name: t.name, x, y, color: t.color, description: t.description, rules: [...t.rules] }; };
export const EXAMPLE_PLANETS = Object.freeze([
  example('reading', 650, 150), example('diary', 1450, 175), example('cleaning', 190, 565), example('subject', 1870, 565)
]);
// 행성 내부 맵 템플릿: 광장과 같은 크기의 작은 방. 위에는 규칙 게시판(충돌), 아래에는 광장으로 나가는 문(통과 가능).
export const INTERIOR = Object.freeze({ width: 1200, height: 760, spawn: { x: 600, y: 560 },
  objects: [
    { id: 'board', name: '행성 규칙 게시판', x: 600, y: 150, radius: 80, kind: 'board', color: '#fff6d6' },
    { id: 'report-board', name: '부서실적 작성하기', x: 960, y: 170, radius: 28, kind: 'report-board', color: '#fff6d6' },
    { id: 'warning-rock', name: '경고 돌덩이', x: 260, y: 590, radius: 48, kind: 'warning-rock', color: '#696477' },
    { id: 'door', name: '광장으로 나가는 문', x: 600, y: 690, radius: 34, kind: 'door', color: '#d9d3f2', passable: true }
  ] });
export const interiorIdOf = planetId => 'planet:' + planetId;
export const planetIdOfMap = mapId => (typeof mapId === 'string' && mapId.startsWith('planet:')) ? mapId.slice(7) : null;
// planets: 그 방의 행성 목록(배열 또는 Map의 values). 광장이면 별·문 + 행성들이 오브젝트가 되고, 오색별빛 쉼터는 고정 맵, 내부 맵이면 템플릿에 행성 정보를 얹습니다.
export function mapOf(mapId, planets = []) {
  const list = Array.isArray(planets) ? planets : [...planets];
  if (mapId !== PLAZA_ID && STATIC_MAPS[mapId]) return STATIC_MAPS[mapId];
  const planetId = planetIdOfMap(mapId);
  if (!planetId) return { ...MAP, objects: [...MAP.objects, ...list] };
  const planet = list.find(p => p.id === planetId);
  return { ...INTERIOR, id: mapId, planetId, name: (planet ? planet.name : '행성') + ' 안', color: planet ? planet.color : '#d9d3f2' };
}
// 경험치 계산은 server/progression.js에서 수행합니다. 경험치 획득 활동과 장비·그림은 후속 연결 대상입니다.
export const PROGRESSION = Object.freeze({ maxLevel: 6, nextLevelXp: Object.freeze([15, 20, 25, 30, 40]),
  transcendentLevel: 6, transcendentName: '초월체', constellationSlots: 16 });
export function createAvatar() {
  return { form: 'asteroid', level: 1, xp: 0, constellationId: null,
    equipment: { pet: null, mount: null, decoration: null }, departmentId: null, blackStar:null };
}
// 향후 인벤토리 항목: { id, name, description, icon, quantity, type, level }.
// 향후 별 파편 잔액은 0 이상의 안전한 정수로, 지급/지출은 서버에서 검증합니다.
export const CHAT = Object.freeze({ maxLength: 120, historySize: 50, cooldownMs: 700, bubbleMs: 4000 });
