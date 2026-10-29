import {itemOf} from '../shared/config.js';

// Only return the level/count silhouette. Ingredient identities remain private.
export function craftingHintViews(itemId, recipes) {
  const hints = new Set();
  for (const recipe of recipes || []) {
    if (recipe?.output?.id !== itemId || !Array.isArray(recipe.ingredients)) continue;
    const counts = new Map();
    for (const part of recipe.ingredients) {
      const level = itemOf(part?.id)?.level;
      if (!Number.isSafeInteger(level) || !Number.isSafeInteger(part?.quantity) || part.quantity < 1) continue;
      counts.set(level, (counts.get(level) || 0) + part.quantity);
    }
    if (!counts.size) continue;
    hints.add([...counts].sort(([a],[b])=>a-b).map(([level,quantity])=>`Lv${level} 아이템 ${quantity}개`).join(' + '));
  }
  return [...hints];
}
