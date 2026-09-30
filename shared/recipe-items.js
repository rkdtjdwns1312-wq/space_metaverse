// Public wrapper metadata only. Ingredients and the actual recipe list stay on the server.
export const RECIPE_ITEM_PREFIX = 'recipe:';
export const recipeItemId = outputId => RECIPE_ITEM_PREFIX + outputId;
export function recipeOutputId(itemId) {
  return typeof itemId === 'string' && itemId.startsWith(RECIPE_ITEM_PREFIX)
    ? itemId.slice(RECIPE_ITEM_PREFIX.length) : null;
}
export function recipeItemOf(itemId, catalog) {
  const outputId = recipeOutputId(itemId);
  if (!outputId) return null;
  const output = catalog.find(item => item.id === outputId && item.level >= 2 && item.level <= 5);
  if (!output) return null;
  return {id: itemId, outputId, name: output.name + ' 조합법', level: output.level,
    type: 'tool', mode: 'recipe', icon: '📜', targets: 'self', secret: true,
    usable: true, forSale: false, price: null, sellPrice: null,
    description: '사용하면 ' + output.name + ' 조합법을 내 조합법 목록에 등록해요.',
    special: '이미 배운 조합법은 소모하지 않아요. 조합 재료는 학습한 본인만 볼 수 있어요.'};
}
