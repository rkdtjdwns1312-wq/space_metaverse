// Public catalog: names, effects and final prices only. Recipes stay on the server.
const card = (id, name, description, special, icon, price, sellPrice, options = {}) => Object.freeze({
  id, name, description, special, icon, price, sellPrice, type: 'tool', level: 3,
  art: `/assets/items/lv3/${id.replace(/-card$/, '')}.webp`,
  mode: 'lv3', targets: 'self', secret: false, usable: true,
  effect: {label: name, icon, durationMs: 0, style: 'card'}, ...options
});

export const LV3_ITEMS = Object.freeze([
  card('space-station-card', '우주정거장', '두 친구의 책상 자리와 급식 자리를 교체합니다.',
    '전체 자리를 바꾸는 날까지 유지해요. 실제 자리 교체와 종료는 선생님이 확인해요.', '🛸', 28, 9, {targets: 'pair'}),
  card('great-spaceship-card', '대우주선', '급식 자리를 바꾸고 내 앞과 뒤의 친구를 지정합니다.',
    '줄 규칙에 의해 밀려나지 않아요. 본인과 앞·뒤 친구를 정해 사용 기록을 남기며 실제 자리는 선생님이 확인해요.', '🚀', 28, 9, {targets: 'self-and-two'}),
  card('supernova-alpha-card', '초신성 α', 'LV3부터 보유 중 매주 아이템 1개를 자동으로 반값에 구매합니다. 카드는 소모하지 않으며 월요일 0시(한국 시간)에 할인 기회가 갱신됩니다. 같은 종류를 여러 개 보유해도 주 1회입니다.',
    '보유 능력: 별자리 능력을 2배로 만듭니다. 배율이 적용될 세부 효과는 확인 후 연결해요.', '✺', 45, 18, {usable: false, passiveOnly: true}),
  card('supernova-beta-card', '초신성 β', 'LV3부터 보유 중 매주 아이템 1개를 자동으로 반값에 구매합니다. 카드는 소모하지 않으며 월요일 0시(한국 시간)에 할인 기회가 갱신됩니다. 같은 종류를 여러 개 보유해도 주 1회입니다.',
    '보유 능력: 별자리 능력을 2회로 만듭니다. 능력 횟수 적용은 확인 후 연결해요.', '✹', 44, 17, {usable: false, passiveOnly: true}),
  card('galaxy-cluster-card', '은하단', '사용하면 별 카드 2장을 받습니다.',
    '보유 중인 은하단 한 개마다 7일에 별 파편 2개를 만들어요. 최대 2개까지 보유할 수 있어요.', '🌌', 46, 18, {maxOwned: 2}),
  card('rabbit-princess-card', '토끼 공주', '사용하면 별 카드 1장을 받습니다.',
    '보유 능력: 주사위 1~5는 뽑기, 6은 별 카드 뽑기. 보유 뽑기의 사용 주기는 확인 후 연결해요.', '🐇', 47, 19),
  card('comet-card', '혜성', '모든 부서의 검은별과 경고를 해제합니다.',
    '보유 능력: 경고 1개 삭제. 보유 효과의 사용 주기는 확인 후 연결해요.', '☄️', 27, 9),
  card('alien-creature-card', '에일리언', '하루 전에 사용을 예고하고 사용 중인 모든 아이템을 흡수하여 별로 변환합니다.',
    '보유 능력: 모든 마감 기한이 1일 늘어납니다. 흡수 대상·환산 기준·보유 효과는 확인 후 연결해요.', '👾', null, null,
    {forSale: false, pricePending: true, usable: false})
]);
