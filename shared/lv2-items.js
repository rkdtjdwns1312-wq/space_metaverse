// LV2 카드 카탈로그. 상점 연결과 레시피 연결은 별도 작업에서 수행합니다.
const card = (id, name, description, special, icon, price, sellPrice, targets, effect, { maxOwned, forSale } = {}) => ({
  id,
  name,
  description,
  special,
  art: `/assets/items/lv2/${id.replace(/-card$/, '')}.webp`,
  icon,
  type: 'tool',
  level: 2,
  price,
  ...(sellPrice === null ? { sellPrice: null } : { sellPrice }),
  targets,
  secret: false,
  mode: 'lv2',
  effect: { ...effect, durationMs: 0, style: 'card' },
  ...(maxOwned === undefined ? {} : { maxOwned }),
  ...(forSale === undefined ? {} : { forSale })
});

export const LV2_ITEMS = Object.freeze([
  card('asteroid-card', '소행성', '검은별 1개를 삭제합니다.', '검은별을 대상으로 사용해요.', '☄️', 11, 3, 'self', { label: '검은별 1개 삭제', icon: '☄️' }),
  card('spaceship-card', '우주선', '7일 동안 친구와 함께 급식 자리 위치를 선정합니다.', '사용자와 친구가 함께 급식 자리를 정해요. 선생님이 확인해요.', '🚀', 9, 2, 'other', { label: '급식 자리 위치 선정', icon: '🍱' }),
  card('satellite-card', '인공위성', '7일 동안 2명의 자리를 맞교환합니다.', '두 사람의 자리 이동은 직접 도와야 해요.', '🛰️', 9, 2, 'pair', { label: '자리 맞교환', icon: '🛰️' }),
  card('galaxy-card', '은하수', '사용하면 별 카드 1장을 받습니다.', '가방에 보유하는 동안 카드마다 7일에 별 파편 1개를 만들어요. 은하수는 최대 2개까지 보유할 수 있어요.', '🌌', 18, 7, 'self', { label: '은하수 별 카드', icon: '🌌' }, { maxOwned: 2 }),
  card('spaceman-card', '우주인', '14일 동안 일기 또는 독서록을 3회 면제받습니다.', '면제할 기록은 선생님이 확인해요.', '🧑‍🚀', 13, 4, 'self', { label: '일기·독서록 3회 면제', icon: '🧑‍🚀' }),
  card('sun-rabbit-card', '해토끼', '1명의 활성 아이템을 모두 취소하고 7일 동안 아이템 사용을 막습니다.', '효과가 끝날 때 대상에게 별카드 1장을 줍니다.', '🐇', 9, 2, 'other', { label: '활성 아이템 취소·아이템 금지', icon: '🐇' }),
  card('alien-rabbit-card', '외계토끼', '주사위를 굴려 일기·독서록 면제권 1개를 받습니다.', '모든 눈에서 외계인 카드 1개를 받아요. 3~4이면 달토끼 카드 1개, 5~6이면 별 카드 1개를 추가로 받아요.', '👽', 12, 4, 'self', { label: '주사위 보상', icon: '🎲' }),
  card('android-card', '안드로이드', '모든 제출물을 금요일까지 미룹니다.', '금요일에 사용하면 다음 월요일까지 미뤄요. 선생님이 확인해요.', '🤖', 0, null, 'self', { label: '제출 기한 연장', icon: '🤖' }, { forSale: false }),
  card('sun-card', '해', '3명의 아이템 효과를 7일 동안 통제합니다.', '지정된 사람이 아이템을 사용할 때마다 별 파편 1개를 사용자에게 줘요.', '☀️', 10, 3, 'three', { label: '아이템 사용 별 파편 세금', icon: '☀️' }),
  card('moon-card', '달', '7일 동안 청소를 면제받고 마칩니다.', '검은별이면 소멸하고, 해 효과를 삭제한 뒤 별 파편 2개를 얻어요.', '🌙', 12, 4, 'self', { label: '청소 면제·해 효과 삭제', icon: '🌙' })
]);
