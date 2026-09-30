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
  card('supernova-alpha-card', '초신성 α', '사용하면 이 카드 1개를 소모하고 별 카드 1장을 받습니다.',
    '보유능력 사용하기를 누르면 이번 주 일요일까지 생활 별자리 능력의 확정 수치가 2배예요. Q/E 전투 스킬에는 적용하지 않아요. α·β 중 나중에 얻은 보유 종류 하나만 적용하며 주간 활성화 기회도 공유해요. LV3부터 활성 종류로 주 1회 반값 구매할 수 있어요. 월요일 0시(한국 시간)에 강화가 종료돼요. 사용·판매·재획득으로 사용 횟수는 돌아오지 않아요.', '✺', 45, 18),
  card('supernova-beta-card', '초신성 β', '사용하면 이 카드 1개를 소모하고 별 카드 1장을 받습니다.',
    '보유능력 사용하기를 누르면 이번 주 일요일까지 생활 별자리 능력을 주 2회 사용해요. 진행 중인 효과를 완료한 뒤 다시 사용해요. Q/E 전투 스킬에는 적용하지 않아요. α·β 중 나중에 얻은 보유 종류 하나만 적용하며 주간 활성화 기회도 공유해요. LV3부터 활성 종류로 주 1회 반값 구매할 수 있어요. 월요일 0시(한국 시간)에 강화가 종료되며 전환해도 사용 횟수는 유지돼요.', '✹', 44, 17),
  card('galaxy-cluster-card', '은하단', '사용하면 별 카드 2장을 받습니다.',
    '보유능력 사용하기로 주 1회, 보유 카드마다 별 파편 2개를 받아요(최대 2개). 카드는 소모하지 않으며 월요일 0시(한국 시간)에 사용 기회가 갱신돼요.', '🌌', 46, 18, {maxOwned: 2}),
  card('rabbit-princess-card', '토끼 공주', '사용하면 별 카드 1장을 받습니다.',
    '보유능력 사용하기로 주 1회 주사위를 굴려요. 1~5는 뽑기, 6은 별 카드 1장이에요. 카드는 소모하지 않으며 월요일 0시(한국 시간)에 갱신돼요.', '🐇', 47, 19),
  card('comet-card', '혜성', '모든 부서의 검은별과 경고를 해제합니다.',
    '보유능력 사용하기로 주 1회 선택한 부서의 내 경고 1개를 삭제해요. 카드는 소모하지 않으며 월요일 0시(한국 시간)에 갱신돼요.', '☄️', 27, 9),
  card('alien-creature-card', '에일리언', '하루 전에 사용을 예고하고 사용 중인 모든 아이템을 흡수하여 별로 변환합니다.',
    '보유능력 사용하기로 주 1회 활성화하면 이번 주 일요일까지 모든 마감 기한이 1일 늘어나요. 현실 과제 기한은 선생님이 확인해요. 월요일 0시(한국 시간)에 종료·갱신돼요. 아이템 흡수 사용 효과는 준비 중이에요.', '👾', null, null,
    {forSale: false, pricePending: true, usable: false})
]);
