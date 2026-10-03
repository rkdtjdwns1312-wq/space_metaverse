// 공개 카탈로그에는 아이템 설명과 효과만 둡니다. 조합 레시피나 재료 정보는 여기에 넣지 않습니다.
const card = (id, name, description, special, icon, price, sellPrice, options = {}) => Object.freeze({
  id,
  name,
  description,
  special,
  icon,
  price,
  sellPrice,
  type: 'tool',
  level: 4,
  art: `/assets/items/lv4/${id.replace(/-card$/, '')}.png`,
  mode: 'lv4',
  targets: 'self',
  secret: false,
  usable: true,
  automatic: Object.freeze([]),
  manual: Object.freeze([]),
  effect: { label: name, icon, durationMs: 0, style: 'card' },
  ...options
});

export const LV4_ITEMS = Object.freeze([
  card('solar-system-card', '태양계',
    '친구 7명을 지정한 순서대로 급식 순서를 영구적으로 바꿉니다.',
    '지정된 친구 7명은 각각 소행성 아이템 1개를 받아요. 실제 교실의 급식 순서는 선생님이 확인해요.',
    '☀️', 78, 34,
    {automatic: Object.freeze(['지정한 7명에게 소행성(LV2) 각 1개 지급']),manual: Object.freeze(['지정한 순서대로 급식 순서를 영구 변경'])}),

  card('black-hole-card', '블랙홀',
    '선택한 세 부서의 경고와 검은별을 해제합니다.',
    '경고 주인에게서 경고 1개당 별 파편 1개, 검은별 주인에게서 검은별 1개당 2개를 받아 사용자에게 옮겨요. 2주에 한 번 사용할 수 있어요. 대상 모두의 잔액이 충분해야 해요.',
    '🕳️', 81, 36,
    {automatic: Object.freeze(['선택한 세 부서의 모든 경고·검은별 해제', '경고당 1파편·검은별당 2파편을 해당 학생에게서 받아 사용자에게 이전', '사용 후 2주 재사용 대기']), manual: Object.freeze([])}),

  card('nebula-card', '성운',
    '자신과 친구 3명, 총 4명의 교실 자리를 영구적으로 바꿉니다.',
    '네 친구가 완전히 떨어진 자리로 흩어지게 배치할 수 없어요. 실제 교실 자리와 배치는 선생님이 확인해요.',
    '🌌', 83, 37,
    {manual: Object.freeze(['사용자 포함 네 친구의 교실 자리를 영구 변경', '네 친구를 완전히 떨어진 자리로 배치하지 않았는지 확인'])}),

  card('betelgeuse-card', '베텔기우스',
    '사용하면 탐사권 3장을 받습니다.',
    '사용한 날 우주 탐사로 모은 찬란한 별의 기운 1당 급식 우선권이 1주 늘어납니다. 실제 급식 순서는 선생님이 확인해요.',
    '🔴', 64, 27,
    {automatic:Object.freeze(['탐사권 3장 지급','사용 당일 획득한 기운 1당 급식 우선권 1주 기록']),manual: Object.freeze(['실제 급식 순서에 우선권 적용'])}),

  card('total-eclipse-card', '개기 일식',
    '같은 교실의 모든 학생에게 1주일 동안 개기 일식 상태를 부여합니다.',
    '개기 일식 상태의 친구가 아이템을 사용할 때마다 사용자에게 별 파편 1개를 지급한 뒤 사용해요. 사용자의 자기 자신과 타인 아이템 보호 중인 친구는 이체 대상에서 제외됩니다.',
    '🌑', 99, 45,
    {automatic: Object.freeze(['같은 교실의 모든 학생에게 1주일간 개기 일식 상태', '아이템 사용 1회마다 사용자에게 별 파편 1개 이전; 자기 자신은 이체 없음'])}),

  card('supercluster-card', '초은하단',
    '별카드를 선택해서 2장 획득합니다.',
    '보유한 카드 1장마다 매주 월요일 0시(한국 시간)에 은하수의 기운 1을 모아요. 보유능력 사용하기로 주 1회, 기운 1로 별 파편 4개 또는 기운 2로 별 카드 1장을 받아요. 보유 카드는 소모하지 않아요.',
    '✨', 102, 46,
    {automatic: Object.freeze(['아이템 사용: 초은하단 1개를 소모하고 원하는 금별 카드 2장 지급', '보유효과 사용: 은하수의 기운 1→별 파편4개 또는 기운 2→별 카드1장, 보유 카드는 유지']), manual: Object.freeze([])}),

  card('alien-queen-card', '에일리언 퀸',
    '일기 쓰기와 독서 기록 쓰기를 완전히 면제받습니다.',
    '일기나 독서록을 작성하고 검사받을 때마다 선생님 확인 후 별 파편 1개를 받아요.',
    '👑', null, null,
    {forSale: false, pricePending: true, automatic: Object.freeze(['교사가 일기·독서록을 확인할 때마다 별 파편 1개 지급']), manual: Object.freeze(['일기·독서 기록 완전 면제를 현실 교실에서 적용', '작성 사실을 확인'])})
]);
