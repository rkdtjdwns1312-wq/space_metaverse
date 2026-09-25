// 공개 카탈로그에는 아이템 설명과 효과만 둡니다. 조합 레시피나 재료 정보는 여기에 넣지 않습니다.
// 보유 보상 선택 방식은 교사의 답변을 받기 전까지 실제 운영에서 열지 않습니다.
export const LV4_HOLDING_READY = false;
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
    '친구 7명에게 태양계 행성 8개 중 7개의 역할을 정해 줍니다.',
    '수업에서 급식 위치, 책상 자리, 하교 순서를 정하는 활동은 선생님이 확인하고 직접 진행해요.',
    '☀️', 78, 34,
    {manual: Object.freeze(['친구 7명의 행성 역할 7개를 정하고, 급식·책상 자리·하교 순서를 지정하는 현실 활동'])}),

  card('black-hole-card', '블랙홀',
    '선택한 세 부서의 경고와 검은별을 해제합니다.',
    '경고 1개당 1파편, 검은별 1개당 3파편을 대상에게서 받아 소멸시켜요. 소멸한 별 파편 합계÷10일 동안 사용자는 다른 아이템의 대상이 되지 않아요. 대상 모두의 잔액이 충분할 때만 사용해요.',
    '🕳️', 81, 36,
    {automatic: Object.freeze(['대상에게 경고당 1파편·검은별당 3파편을 차감하고 상태 해제', '소멸 파편 합계÷10일 동안 아이템 대상 면역']), manual: Object.freeze([])}),

  card('nebula-card', '성운',
    '실제 교실에서 한 변이 1m인 정사각형 땅을 표시합니다.',
    '땅에 허락 없이 들어온 경우 별 파편 1개를 징수하는 처리는 선생님이 확인한 뒤 진행해요.',
    '🌌', 83, 37,
    {automatic: Object.freeze(['교사 확인 후 대상의 별 파편 1개를 사용자에게 이전']), manual: Object.freeze(['실제 교실에 1m×1m 정사각형 땅을 표시', '무단 침입 여부 확인'])}),

  card('betelgeuse-card', '베텔기우스',
    '행성을 3회 탐험하면 현실 교실에서 N주 동안 우선권을 받습니다.',
    '탐험 횟수와 실제 이동 칸 수는 선생님이 확인해요. 우선권은 급식 또는 자리에서 사용합니다. 부정적인 효과를 무시하는 것도 현실 교실에서는 선생님 확인 후 직접 처리해요. 전투 게임의 면역 효과와는 별개입니다.',
    '🔴', 64, 27,
    {manual: Object.freeze(['행성 탐험 3회와 실제 이동 칸 수를 확인', 'N주 우선권을 급식 또는 자리에서 적용', '현실 교실의 부정 효과 무시를 확인하고 적용'])}),

  card('total-eclipse-card', '개기 일식',
    '선택한 대상은 1주 동안 아이템 사용이 금지됩니다.',
    '대상은 아이템 사용 1회마다 별 파편 1개를 카드 사용자에게 내면 그 1회 사용을 허용받아요. 허용된 1회 뒤에도 1주 금지는 계속됩니다.',
    '🌑', 99, 45,
    {automatic: Object.freeze(['선택한 대상의 아이템 사용을 1주 동안 금지', '대상이 사용 1회 허용을 선택하면 별 파편 1개를 카드 사용자에게 받고 그 1회만 허용; 주간 금지는 유지'])}),

  card('supercluster-card', '초은하단',
    '사용하면 원하는 금별 카드 2장을 선택해 보상받습니다.',
    '보유 보상은 7일마다 별 파편 4개 또는 14일마다 별 카드 1장을 선택하는 방식이에요. 이 보유 효과는 응답을 기다리는 중이며, 현재 자동으로 지급되지 않습니다.',
    '✨', 102, 46,
    {automatic: Object.freeze(['사용 시 원하는 금별 카드 2장을 선택해 지급']), manual: Object.freeze(['보유 보상 규칙은 확정 응답 대기 중이며 자동 지급은 아직 연결하지 않음'])}),

  card('alien-queen-card', '에일리언 퀸',
    '일기 쓰기와 독서 기록 쓰기를 완전히 면제받습니다.',
    '카드를 보유한 채 일기나 독서 기록을 작성할 때마다 별 파편 1개를 받습니다. 면제와 작성 확인은 현실 교실에서 선생님이 관리하며, 별 파편 지급은 선생님 확인 뒤 자동 처리해요. 조합 재료와 가격 확인 중으로 구매·조합은 준비 중이며, 선생님이 지급한 카드는 사용할 수 있어요.',
    '👑', null, null,
    {forSale: false, pricePending: true, automatic: Object.freeze(['교사가 작성 사실을 확인한 뒤, 보유자에게 별 파편 1개 자동 지급']), manual: Object.freeze(['일기·독서 기록 완전 면제를 현실 교실에서 적용', '작성 사실을 확인'])})
]);
