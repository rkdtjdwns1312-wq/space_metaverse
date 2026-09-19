// 공개 카탈로그가 사용할 아이템 가격 계산기입니다.
// 비밀 레시피 자체는 이 공유 모듈에 넣지 않습니다. 서버가 계산한 숫자만 item에 담아 전달합니다.

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 10;

function integer(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function quantityError(quantity) {
  return !Number.isInteger(quantity) || quantity < MIN_QUANTITY || quantity > MAX_QUANTITY
    ? 'invalid-quantity' : null;
}

export function buyPrice(item) {
  return item?.level === 1 && integer(item?.price) ? item.price : null;
}

export function sellPrice(item) {
  if (typeof item?.sellPrice === 'number' && Number.isSafeInteger(item.sellPrice) && item.sellPrice >= 0) {
    return item.sellPrice;
  }
  if (item?.noSell === true || item?.sellPrice === null) return null;
  return item?.level === 1 && integer(item?.price) ? Math.floor(item.price / 2) : null;
}

export function deriveLv2Price(ingredientBuyTotal) {
  return integer(ingredientBuyTotal) ? ingredientBuyTotal + 5 : null;
}

export function deriveSellPrice(ingredientBuyTotal) {
  return integer(ingredientBuyTotal) ? Math.floor((ingredientBuyTotal + 1) / 2) : null;
}

export function sellQuote(item, quantity) {
  const error = quantityError(quantity);
  if (error) return { gain: 0, quantity, error };
  const pairOnly = item?.level === 1 && item?.price === 1;
  const unit = sellPrice(item);
  if (unit === null) return { gain: 0, quantity, error: 'no-sell-price' };
  if (pairOnly && quantity % 2 === 1) return { gain: 0, quantity, error: 'quantity-must-be-even' };
  const gain = pairOnly ? quantity / 2 : unit * quantity;
  return { gain, quantity };
}

export const ITEM_PRICING_LIMITS = Object.freeze({ minQuantity: MIN_QUANTITY, maxQuantity: MAX_QUANTITY });
