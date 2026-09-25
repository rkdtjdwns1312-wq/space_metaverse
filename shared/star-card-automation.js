// 기존 수동 카드의 기록을 바꾸지 않습니다. 새로 쓴 카드에만 version 1을 붙입니다.
export const STAR_CARD_AUTOMATION = Object.freeze({
  zodiac: {automatic: ['별자리 제한을 무시한 변경 또는 주사위 × 3(최대 10) 경험치 중 한 번 선택'], manual: []},
  saturn: {automatic: ['아이템 종류마다 1개를 반값(소수점 내림)에 구매'], manual: []},
  pluto: {automatic: ['오늘 자정까지 사용자 외 학생의 새 아이템 사용 제한'], manual: ['독립된 자리 구성은 선생님이 확인해요.']}
});

// 할인 기회 하나는 물품 한 개에 적용됩니다. 여러 토성을 써도 한 물품에 중복 할인하지 않습니다.
export function discountedPurchase(price, quantity, discountCount = 0) {
  const discounted = Math.min(quantity, discountCount);
  return {cost: Math.floor(price / 2) * discounted + price * (quantity - discounted), discounted};
}
